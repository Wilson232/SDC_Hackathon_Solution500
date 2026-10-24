import { clerkClient, getAuth } from '@clerk/express';
import { pool, transaction } from './db.mjs';
const identities = new Map<string, { email: string; until: number }>();
export async function requireAccount(req: any, res: any, next: any) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Sign in to continue.' });
    let identity = identities.get(userId);
    if (!identity || identity.until < Date.now()) {
      const user = await clerkClient.users.getUser(userId);
      const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
      if (!primary || primary.verification?.status !== 'verified') {
        return res.status(403).json({ error: 'Verify your email address before uploading certificates.' });
      }
      identity = { email: primary.emailAddress.toLowerCase(), until: Date.now() + 30000 };
      identities.set(userId, identity);
    }
    const email = identity.email;
    const admins = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    req.account = await transaction(async db => {
      await db.query(`INSERT INTO app_accounts(user_id,email) VALUES($1,$2)
        ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email`, [userId, email]);
      if (admins.includes(email)) {
        const grant = await db.query(`INSERT INTO admin_bootstrap_grants(email,user_id) VALUES($1,$2)
          ON CONFLICT(email) DO NOTHING RETURNING user_id`, [email, userId]);
        if (grant.rowCount) await db.query(`UPDATE app_accounts SET app_role='admin' WHERE user_id=$1`, [userId]);
      }
      return (await db.query('SELECT * FROM app_accounts WHERE user_id=$1', [userId])).rows[0];
    });
    next();
  } catch (error) { next(error); }
}
export function requireAdmin(req: any, res: any, next: any) {
  if (req.account?.app_role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}
export async function currentAccount(req: any, res: any) {
  const awards = (await pool.query(`SELECT career_key AS "careerKey",career_title AS "careerTitle",
    granted_at AS "grantedAt" FROM career_awards WHERE user_id=$1 ORDER BY granted_at DESC`, [req.account.user_id])).rows;
  res.json({ id: req.account.user_id, email: req.account.email, persona: req.account.persona,
    isAdmin: req.account.app_role === 'admin', awards });
}
