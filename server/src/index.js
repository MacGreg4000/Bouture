import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { api } from './routes/api.js';
import { migrate, seed } from './db/migrate.js';
import { pool, waitForDatabase } from './db/pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..', 'web');
const port = Number.parseInt(process.env.PORT, 10) || 3000;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use('/api', api);
// max-age=0 + ETag : le navigateur revalide a chaque fois, donc une mise a jour
// deployee sur le serveur est visible immediatement sur les telephones.
app.use(express.static(webRoot, { maxAge: 0, etag: true, index: 'index.html' }));
app.get('*', (_req, res) => res.sendFile(join(webRoot, 'index.html')));

await waitForDatabase();
await migrate();
await seed();

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[bouture] à l'écoute sur http://0.0.0.0:${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
