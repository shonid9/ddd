import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { router } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// CORS: in production restrict to configured origins; in dev allow everything
// (the Vite dev server proxies /api so cross-origin rarely matters there).
if (config.corsOrigin.length > 0) {
  app.use(cors({ origin: config.corsOrigin }));
} else if (!config.isProduction) {
  app.use(cors());
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, models: config.models });
});

app.use('/api', router);

// Serve the built client in production (single-service deploy).
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Central error handler — surfaces useful info without leaking the API key.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err?.error?.message || err.message || 'Internal server error';
  console.error('[error]', status, message);
  res.status(status).json({ error: 'server_error', message });
});

app.listen(config.port, () => {
  console.log(`\n🟣 Oracle server listening on http://localhost:${config.port}`);
  console.log(`   chat=${config.models.chat}  tts=${config.models.tts}  stt=${config.models.transcribe}\n`);
});
