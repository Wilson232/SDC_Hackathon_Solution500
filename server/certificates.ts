import { Router } from 'express';
import multer from 'multer';
import { randomUUID, createHash } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { pool, transaction } from './db.mjs';
import { requireAdmin } from './auth';
import { ALLOWED_TYPES, MAX_FILE_BYTES, validateCourses, assertEditable, assertReady, canDownload } from './certificate-rules.mjs';
import { decideCertificateReview } from './certificate-review.mjs';
import { putFile, getFile, fileExists, deleteFile } from './storage.mjs';

const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 0 } });
export const certificateRoutes = Router();
certificateRoutes.param('planId', (req, res, next, value) => {
  if (!/^[0-9a-f-]{36}$/i.test(value)) return res.status(400).json({ error: 'Invalid plan identifier.' });
  next();
});
async function readPlan(id: string, db = pool) {
  const plan = (await db.query(`SELECT p.*,a.email FROM certificate_plans p JOIN app_accounts a ON a.user_id=p.user_id WHERE p.id=$1`, [id])).rows[0];
  if (!plan) throw fail('Submission not found.', 404);
  const files = (await db.query(`SELECT id,course_id AS "courseId",filename,mime,size,checked FROM certificate_files WHERE plan_id=$1 ORDER BY created_at`, [id])).rows;
  return { id: plan.id, careerKey: plan.career_key, careerTitle: plan.career_title, courses: plan.courses,
    status: plan.status, reviewNote: plan.review_note, submittedAt: plan.submitted_at, reviewedAt: plan.reviewed_at,
    awardedRole: plan.status === 'approved' ? plan.career_title : null,
    certificates: files, owner: { email: plan.email } };
}
async function ownedPlan(req: any, db = pool, lock = false) {
  const row = (await db.query(`SELECT * FROM certificate_plans WHERE id=$1 AND user_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [req.params.planId, req.account.user_id])).rows[0];
  if (!row) throw fail('Submission not found.', 404);
  return row;
}
function courseExists(plan: any, id: string) {
  if (!plan.courses.some(c => c.id === id)) throw fail('Course not found in this career plan.', 404);
}
certificateRoutes.post('/certificate-plans', async (req: any, res) => {
  const courses = validateCourses(req.body.courses);
  const key = String(req.body.careerKey || '').trim();
  const title = String(req.body.careerTitle || '').trim();
  if (!key || key.length > 120 || !title || title.length > 200) throw fail('Select a valid career path.');
  const id = await transaction(async db => {
    // Lock the account to serialize plan creation and enforce the per-user cap.
    await db.query('SELECT user_id FROM app_accounts WHERE user_id=$1 FOR UPDATE', [req.account.user_id]);
    const existing = await db.query('SELECT id FROM certificate_plans WHERE user_id=$1 AND career_key=$2', [req.account.user_id, key]);
    if (existing.rowCount) return existing.rows[0].id;
    const count = await db.query('SELECT count(*)::int AS n FROM certificate_plans WHERE user_id=$1', [req.account.user_id]);
    if (count.rows[0].n >= 20) throw fail('You have reached the limit of 20 career plans.', 409);
    const id = randomUUID();
    await db.query('INSERT INTO certificate_plans(id,user_id,career_key,career_title,courses) VALUES($1,$2,$3,$4,$5)',
      [id, req.account.user_id, key, title, JSON.stringify(courses)]);
    return id;
  });
  res.json(await readPlan(id));
});
certificateRoutes.get('/certificate-plans/:planId', async (req: any, res) => {
  await ownedPlan(req); res.json(await readPlan(req.params.planId));
});
certificateRoutes.put('/certificate-plans/:planId/courses/:courseId/certificate', upload.single('file'), async (req: any, res) => {
  if (!req.file?.buffer?.length) throw fail('Choose a PDF, PNG or JPEG certificate.');
  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || !ALLOWED_TYPES.has(detected.mime)) throw fail('Only genuine PDF, PNG and JPEG files are accepted.');
  const hash = createHash('sha256').update(req.file.buffer).digest('hex');
  const id = randomUUID();
  const key = `private/certificates/${req.account.user_id}/${req.params.planId}/${id}.${detected.ext}`;
  const filename = String(req.file.originalname || 'certificate').replace(/[\x00-\x1f/\\]/g, '_').slice(0, 180);
  let oldKey: string | undefined;
  // Hold the plan lock through upload to avoid concurrent submit/replace races.
  try {
    await transaction(async db => {
      const plan = await ownedPlan(req, db, true); assertEditable(plan); courseExists(plan, req.params.courseId);
      const duplicate = await db.query('SELECT id FROM certificate_files WHERE plan_id=$1 AND sha256=$2 AND course_id<>$3',
        [plan.id, hash, req.params.courseId]);
      if (duplicate.rowCount) throw fail('This certificate is already uploaded for another course.');
      oldKey = (await db.query('SELECT object_key FROM certificate_files WHERE plan_id=$1 AND course_id=$2', [plan.id, req.params.courseId])).rows[0]?.object_key;
      await putFile(key, req.file.buffer);
      await db.query(`INSERT INTO certificate_files(id,plan_id,course_id,object_key,filename,mime,size,sha256)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(plan_id,course_id) DO UPDATE SET
        id=EXCLUDED.id,object_key=EXCLUDED.object_key,filename=EXCLUDED.filename,mime=EXCLUDED.mime,size=EXCLUDED.size,sha256=EXCLUDED.sha256,checked=false,created_at=now()`,
        [id, plan.id, req.params.courseId, key, filename, detected.mime, req.file.size, hash]);
      await db.query(`UPDATE certificate_plans SET status='draft' WHERE id=$1`, [plan.id]);
    });
  } catch (error) {
    // Remove only the new unreferenced object; do not affect an existing certificate.
    try { await deleteFile(key); } catch { /* No new file may have been stored. */ }
    throw error;
  }
  if (oldKey) try { await deleteFile(oldKey); } catch { console.error('Superseded certificate cleanup failed'); }
  res.json(await readPlan(req.params.planId));
});
certificateRoutes.delete('/certificate-plans/:planId/courses/:courseId/certificate', async (req: any, res) => {
  await transaction(async db => {
    const plan = await ownedPlan(req, db, true); assertEditable(plan); courseExists(plan, req.params.courseId);
    const old = (await db.query('SELECT object_key FROM certificate_files WHERE plan_id=$1 AND course_id=$2', [plan.id, req.params.courseId])).rows[0];
    if (old) {
      await deleteFile(old.object_key);
      await db.query('DELETE FROM certificate_files WHERE plan_id=$1 AND course_id=$2', [plan.id, req.params.courseId]);
    }
    await db.query(`UPDATE certificate_plans SET status='draft' WHERE id=$1`, [plan.id]);
  });
  res.json(await readPlan(req.params.planId));
});
certificateRoutes.put('/certificate-plans/:planId/courses/:courseId/checked', async (req: any, res) => {
  if (typeof req.body.checked !== 'boolean') throw fail('Choose a valid checkbox value.');
  await transaction(async db => {
    const plan = await ownedPlan(req, db, true); assertEditable(plan); courseExists(plan, req.params.courseId);
    const changed = await db.query('UPDATE certificate_files SET checked=$3 WHERE plan_id=$1 AND course_id=$2 RETURNING id',
      [plan.id, req.params.courseId, req.body.checked]);
    if (!changed.rowCount) throw fail('Upload a certificate before checking this course.');
  });
  res.json(await readPlan(req.params.planId));
});
certificateRoutes.post('/certificate-plans/:planId/submit', async (req: any, res) => {
  await transaction(async db => {
    const plan = await ownedPlan(req, db, true); assertEditable(plan);
    const files = (await db.query('SELECT * FROM certificate_files WHERE plan_id=$1', [plan.id])).rows;
    assertReady(plan, files);
    for (const f of files) if (!await fileExists(f.object_key)) throw fail('A certificate is missing from storage. Replace it before submitting.', 409);
    await db.query(`UPDATE certificate_plans SET status='pending',submitted_at=now(),reviewed_at=null,reviewed_by=null,review_note='' WHERE id=$1`, [plan.id]);
  });
  res.json(await readPlan(req.params.planId));
});
certificateRoutes.get('/certificates/:fileId/download', async (req: any, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.fileId)) throw fail('File not found.', 404);
  const file = (await pool.query(`SELECT f.*,p.user_id FROM certificate_files f JOIN certificate_plans p ON p.id=f.plan_id WHERE f.id=$1`,
    [req.params.fileId])).rows[0];
  if (!file || !canDownload(file.user_id, req.account)) throw fail('File not found.', 404);
  const bytes = await getFile(file.object_key);
  res.set({ 'Content-Type': file.mime, 'Content-Disposition': `attachment; filename="certificate.${file.mime === 'application/pdf' ? 'pdf' : file.mime === 'image/png' ? 'png' : 'jpg'}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
  res.send(bytes);
});
certificateRoutes.get('/admin/submissions', requireAdmin, async (_req, res) => {
  const rows = (await pool.query(`SELECT id FROM certificate_plans WHERE status<>'draft' ORDER BY (status='pending') DESC,submitted_at DESC LIMIT 200`)).rows;
  res.json(await Promise.all(rows.map(r => readPlan(r.id))));
});
certificateRoutes.post('/admin/submissions/:planId/review', requireAdmin, async (req: any, res) => {
  const note = String(req.body.note || '').trim().slice(0, 2000);
  await transaction(db => decideCertificateReview(db, req.account, req.params.planId, req.body.decision, note, fileExists));
  res.json(await readPlan(req.params.planId));
});
