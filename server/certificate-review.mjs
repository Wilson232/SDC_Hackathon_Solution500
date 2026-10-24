import { randomUUID } from 'node:crypto';
import { assertReady, assertReview } from './certificate-rules.mjs';

// Caller supplies the transaction: the decision, award, audit and notice commit together.
export async function decideCertificateReview(db, reviewer, planId, decision, note, fileExists) {
  const plan = (await db.query('SELECT * FROM certificate_plans WHERE id=$1 FOR UPDATE', [planId])).rows[0];
  if (!plan) throw Object.assign(new Error('Submission not found.'), { status: 404 });
  assertReview(plan, reviewer, decision, note);
  if (decision === 'approved') {
    const files = (await db.query('SELECT * FROM certificate_files WHERE plan_id=$1', [plan.id])).rows;
    assertReady(plan, files);
    for (const f of files) {
      if (!await fileExists(f.object_key)) {
        throw Object.assign(new Error('A certificate file is unavailable. Do not approve this submission.'), { status: 409 });
      }
    }
    await db.query('INSERT INTO career_awards(plan_id,user_id,career_key,career_title) VALUES($1,$2,$3,$4)',
      [plan.id, plan.user_id, plan.career_key, plan.career_title]);
  }
  await db.query('UPDATE certificate_plans SET status=$2,review_note=$3,reviewed_at=now(),reviewed_by=$4 WHERE id=$1',
    [plan.id, decision, note, reviewer.user_id]);
  const reviewId = randomUUID();
  await db.query('INSERT INTO certificate_reviews(id,plan_id,reviewer_id,decision,note) VALUES($1,$2,$3,$4,$5)',
    [reviewId, plan.id, reviewer.user_id, decision, note]);
  // One notice per immutable review, never one per browser request or plan.
  await db.query(`INSERT INTO certificate_notifications(id,user_id,plan_id,career_title,decision,note)
    VALUES($1,$2,$3,$4,$5,$6)`, [reviewId, plan.user_id, plan.id, plan.career_title, decision, note]);
}
