import { Router } from 'express';

// Mounted behind requireAccount; even administrators only see their own notices.
export function notificationRoutes(db) {
  const router = Router();
  router.get('/notifications', async (req, res) => {
    const result = await db.query(`SELECT id,plan_id AS "planId",career_title AS "careerTitle",
      decision,note,created_at AS "createdAt",read_at AS "readAt"
      FROM certificate_notifications WHERE user_id=$1 AND read_at IS NULL
      ORDER BY created_at DESC,id DESC`, [req.account.user_id]);
    res.json(result.rows);
  });
  router.patch('/notifications/:noticeId/read', async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.noticeId)) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    const result = await db.query(`UPDATE certificate_notifications SET read_at=COALESCE(read_at,now())
      WHERE id=$1 AND user_id=$2 RETURNING id,read_at AS "readAt"`,
      [req.params.noticeId, req.account.user_id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Notification not found.' });
    res.json(result.rows[0]);
  });
  return router;
}
