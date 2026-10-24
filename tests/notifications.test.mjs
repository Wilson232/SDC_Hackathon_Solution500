import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import express from 'express';
import { decideCertificateReview } from '../server/certificate-review.mjs';
import { notificationRoutes } from '../server/notifications.mjs';

test('certificate decision notifications: transactional delivery and owner-only access', async t => {
  // Isolated schema: never create test learners or decisions in the application tables.
  const schema = `notice_test_${randomUUID().replaceAll('-', '')}`;
  const adminDb = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 4 });
  let server;
  const reviewer = { user_id: 'reviewer', app_role: 'admin' };
  const courses = [1, 2, 3].map(id => ({ id: String(id), title: `Course ${id}` }));
  const transaction = async fn => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  };
  const review = (id, decision, note = '', exists = async () => true, account = reviewer) =>
    transaction(client => decideCertificateReview(client, account, id, decision, note, exists));
  const createPlan = async (owner = 'learner') => {
    const id = randomUUID();
    await db.query(`INSERT INTO certificate_plans(id,user_id,career_key,career_title,courses,status,submitted_at)
      VALUES($1,$2,$4,'Data Analyst',$3,'pending',now())`, [id, owner, JSON.stringify(courses), id]);
    for (const course of courses) {
      await db.query(`INSERT INTO certificate_files(id,plan_id,course_id,object_key,filename,mime,size,sha256,checked)
        VALUES($1,$2,$3,$3,'certificate.pdf','application/pdf',100,$3,true)`, [randomUUID(), id, course.id]);
    }
    return id;
  };
  try {
    await adminDb.query(`CREATE SCHEMA ${schema}`);
    await db.query(await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
    await db.query(`INSERT INTO app_accounts(user_id,email,app_role) VALUES
      ('learner','learner@example.invalid','member'),('other','other@example.invalid','member'),
      ('reviewer','reviewer@example.invalid','admin')`);
    const app = express();
    // Test-only trusted identity fixture, not an application authentication bypass.
    app.use((req, res, next) => {
      const id = req.headers['x-test-account'];
      if (!['learner', 'other', 'reviewer'].includes(id)) return res.sendStatus(401);
      req.account = { user_id: id, app_role: id === 'reviewer' ? 'admin' : 'member' };
      next();
    });
    app.use(notificationRoutes(db));
    app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const api = (url = '/notifications', user = 'learner', method = 'GET') =>
      fetch(base + url, { method, headers: user ? { 'x-test-account': user } : {} });
    let rejectedPlan, rejectedNotice;

    await t.test('rejection saves feedback and repeat requests deliver only once', async () => {
      rejectedPlan = await createPlan();
      const results = await Promise.allSettled([
        review(rejectedPlan, 'rejected', 'Please upload a readable issuer name.'),
        review(rejectedPlan, 'rejected', 'Please upload a readable issuer name.'),
      ]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      const notices = await (await api()).json();
      assert.equal(notices.length, 1);
      rejectedNotice = notices[0];
      assert.equal(rejectedNotice.planId, rejectedPlan);
      assert.equal(rejectedNotice.decision, 'rejected');
      assert.equal(rejectedNotice.note, 'Please upload a readable issuer name.');
      assert.equal(rejectedNotice.readAt, null);
      assert.equal((await db.query('SELECT * FROM certificate_reviews')).rowCount, 1);
      assert.equal((await db.query('SELECT * FROM career_awards')).rowCount, 0);
    });

    await t.test('anonymous, other learners and admins cannot read or mark another owner’s notices', async () => {
      assert.equal((await api('/notifications', null)).status, 401);
      assert.equal((await api(`/notifications/${rejectedNotice.id}/read`, null, 'PATCH')).status, 401);
      for (const user of ['other', 'reviewer']) {
        assert.deepEqual(await (await api('/notifications', user)).json(), []);
        const foreign = await api(`/notifications/${rejectedNotice.id}/read`, user, 'PATCH');
        const absent = await api(`/notifications/${randomUUID()}/read`, user, 'PATCH');
        assert.equal(foreign.status, 404);
        assert.deepEqual(await foreign.json(), await absent.json());
      }
      assert.equal((await api('/notifications/not-a-uuid/read', 'learner', 'PATCH')).status, 404);
      assert.equal((await (await api()).json()).length, 1);
    });

    await t.test('mark read is idempotent and cannot change persona, decisions or awards', async () => {
      const account = (await db.query('SELECT * FROM app_accounts WHERE user_id=$1', ['learner'])).rows;
      const plan = (await db.query('SELECT * FROM certificate_plans WHERE id=$1', [rejectedPlan])).rows;
      const audit = (await db.query('SELECT * FROM certificate_reviews')).rows;
      const first = await (await api(`/notifications/${rejectedNotice.id}/read`, 'learner', 'PATCH')).json();
      const second = await (await api(`/notifications/${rejectedNotice.id}/read`, 'learner', 'PATCH')).json();
      assert.ok(first.readAt);
      assert.deepEqual(second, first);
      assert.deepEqual(await (await api()).json(), []);
      assert.deepEqual((await db.query('SELECT * FROM app_accounts WHERE user_id=$1', ['learner'])).rows, account);
      assert.deepEqual((await db.query('SELECT * FROM certificate_plans WHERE id=$1', [rejectedPlan])).rows, plan);
      assert.deepEqual((await db.query('SELECT * FROM certificate_reviews')).rows, audit);
      assert.equal((await db.query('SELECT * FROM career_awards')).rowCount, 0);
    });

    await t.test('a later decision after resubmission creates a new unread notice and leaves awards intact when read', async () => {
      await db.query(`UPDATE certificate_plans SET status='pending',review_note='',submitted_at=now() WHERE id=$1`, [rejectedPlan]);
      await review(rejectedPlan, 'approved');
      await assert.rejects(review(rejectedPlan, 'approved'), /no longer pending/);
      const notices = await (await api()).json();
      assert.equal(notices.length, 1);
      assert.notEqual(notices[0].id, rejectedNotice.id);
      assert.equal(notices[0].decision, 'approved');
      const awards = (await db.query('SELECT * FROM career_awards')).rows;
      assert.equal(awards.length, 1);
      assert.equal((await api(`/notifications/${notices[0].id}/read`, 'learner', 'PATCH')).status, 200);
      assert.deepEqual((await db.query('SELECT * FROM career_awards')).rows, awards);
      assert.equal((await db.query('SELECT * FROM certificate_notifications')).rowCount, 2);
    });

    await t.test('failed storage validation and unauthorized reviews create no notice', async () => {
      const id = await createPlan('other');
      await assert.rejects(review(id, 'approved', '', async () => false), /unavailable/);
      await assert.rejects(review(id, 'approved', '', async () => true, { user_id: 'learner', app_role: 'member' }), /Admin/);
      await assert.rejects(review(id, 'approved', '', async () => true, { user_id: 'other', app_role: 'admin' }), /own/);
      await assert.rejects(review(id, 'rejected', ' '), /Explain/);
      assert.deepEqual(await (await api('/notifications', 'other')).json(), []);
      assert.equal((await db.query('SELECT status FROM certificate_plans WHERE id=$1', [id])).rows[0].status, 'pending');
    });

    await t.test('notification write failure rolls back approval, award and audit', async () => {
      const id = await createPlan();
      // Inject a database rejection at the notice insert, after the award/audit writes.
      assert.match(id, /^[a-f0-9-]{36}$/);
      await db.query(`ALTER TABLE certificate_notifications ADD CONSTRAINT test_delivery_failure CHECK(plan_id <> '${id}'::uuid)`);
      await assert.rejects(review(id, 'approved'), /test_delivery_failure/);
      await db.query('ALTER TABLE certificate_notifications DROP CONSTRAINT test_delivery_failure');
      assert.equal((await db.query('SELECT status FROM certificate_plans WHERE id=$1', [id])).rows[0].status, 'pending');
      for (const table of ['certificate_notifications', 'certificate_reviews', 'career_awards']) {
        assert.equal((await db.query(`SELECT * FROM ${table} WHERE plan_id=$1`, [id])).rowCount, 0);
      }
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.end();
    await adminDb.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminDb.end();
  }
});
