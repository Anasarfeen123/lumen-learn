// Production server: serves the built app from dist/ and Lumo's AI endpoints.
// Usage: npm run build && npm start   (reads .env next to package.json)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.mjs';
import { lumoApi } from './lumo-api.mjs';
import { extractApi } from './extract.mjs';
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
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
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
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found. Did you run "npm run build"?');
  }
}

createServer((req, res) => lumoApi(req, res, () => extractApi(req, res, () => serveStatic(req, res)))).listen(PORT, () => {
  console.log(`Lumen running at http://localhost:${PORT}`);
  void logSetup(env);
});
