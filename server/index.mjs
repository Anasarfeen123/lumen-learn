// Production server: serves the built app from dist/ and Lumo's AI endpoints.
// Usage: npm run build && npm start   (reads .env next to package.json)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.mjs';
import { lumoApi } from './lumo-api.mjs';
import { extractApi } from './extract.mjs';
import { accountApi } from './account-api.mjs';
import { personalApi } from './personal-api.mjs';
import { closeDb, dbKind } from './db.mjs';
import { logSetup } from './setup-log.mjs';

const env = loadEnv();

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Same-origin everything: fonts, pictures and voice clips are bundled; audio plays from blob: URLs.
const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; object-src 'self' blob:; frame-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

async function serveStatic(req, res) {
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(ROOT, 'index.html'); // single-page app fallback
  }
  try {
    const body = await readFile(file);
    res.setHeader('content-type', TYPES[extname(file)] || 'application/octet-stream');
    if (file.includes(`${join(ROOT, 'assets')}`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    else if (file.endsWith('.html')) res.setHeader('cache-control', 'no-cache');
    else res.setHeader('cache-control', 'public, max-age=3600');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found. Did you run "npm run build"?');
  }
}

const server = createServer((req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  if (req.url === '/healthz') { res.setHeader('content-type', 'text/plain'); return res.end(`ok · database: ${dbKind()}`); }
  return accountApi(req, res, () => personalApi(req, res, () => lumoApi(req, res, () => extractApi(req, res, () => serveStatic(req, res)))));
});
server.listen(PORT, () => {
  console.log(`Lumen running at http://localhost:${PORT}`);
  void logSetup(env);
});

// Hosting platforms stop the app with SIGTERM: finish requests, close the database cleanly.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => { closeDb(); process.exit(0); });
    setTimeout(() => process.exit(0), 8000).unref();
  });
}
