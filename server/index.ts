import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { createServer as createViteServer } from 'vite';
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from './clerk-proxy';
import { requireAccount, currentAccount } from './auth';
import { certificateRoutes } from './certificates';
import { notificationRoutes } from './notifications.mjs';
import { pool } from './db.mjs';
import path from 'node:path';

const app = express();
app.set('trust proxy', 1);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(express.json({ limit: '64kb' }));
app.use(clerkMiddleware(req => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? '', process.env.CLERK_PUBLISHABLE_KEY),
})));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    try {
      if (new URL(req.headers.origin || '').host !== getClerkProxyHost(req)) {
        return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
      }
    } catch { return res.status(403).json({ error: 'A same-site request is required.' }); }
  }
  next();
}, requireAccount);
app.get('/api/me', currentAccount);
app.patch('/api/me/account-type', async (req: any, res) => {
  const valid = ['displaced_worker','fresh_grad','tvet_uni','hr_ld'];
  if (!valid.includes(req.body.persona)) return res.status(400).json({ error: 'Choose a valid account type.' });
  await pool.query('UPDATE app_accounts SET persona=$2 WHERE user_id=$1', [req.account.user_id, req.body.persona]);
  req.account.persona = req.body.persona;
  await currentAccount(req, res);
});
app.use('/api', certificateRoutes);
app.use('/api', notificationRoutes(pool));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((error: any, _req: any, res: any, _next: any) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Certificates must be 5 MB or smaller.' });
  if (error.name === 'MulterError') return res.status(400).json({ error: 'Upload one certificate file at a time.' });
  const status = error.status || (error.code === '23505' ? 409 : error.code ? 500 : 400);
  if (status >= 500) console.error('Request failed:', error.name, error.code || '', error.status || '');
  res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : error.message });
});
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true, allowedHosts: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.listen(5000, '0.0.0.0', () => console.log('FindMyCareer server listening on port 5000'));
