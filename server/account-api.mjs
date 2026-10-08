// Accounts and the learner's data.
//
//   POST   /api/auth/signup   { email, password, name, profile? }  -> { user }   (sets the session cookie)
//   POST   /api/auth/login    { email, password }                  -> { user }
//   POST   /api/auth/logout                                        -> 204       (ends the session on the server)
//   GET    /api/auth/me                                            -> { user } | 401
//   DELETE /api/account                                            -> 204       (erases the account and everything in it)
//
//   GET/PUT /api/data/profile          { data, version }   (409 if the stored version moved on)
//   GET/PUT /api/data/library          { data }
//   GET/PUT /api/data/personal         { data }
//   GET    /api/data/uploads           list (no file bytes)
//   POST   /api/data/uploads           { name, kind, mime, size, fileBase64?, raw?, mode? } -> { upload }
//   GET    /api/data/uploads/:id       one upload (no bytes)   GET .../file -> the original file
//   PUT    /api/data/uploads/:id       { confirmed?, raw?, name? }
//   DELETE /api/data/uploads/:id
//   GET    /api/data/stories           Lumo's stories for this learner
//
// Security: scrypt password hashes; random session tokens (only their SHA-256
// is stored); httpOnly SameSite=Lax cookie; state-changing requests must send
// the x-lumen header (blocks cross-site form posts); login attempts are
// rate-limited; every data query is scoped to the signed-in user.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { openDb, now } from './db.mjs';

const scryptAsync = promisify(scrypt);
const COOKIE = 'lumen_session';
const SESSION_DAYS = 30;
const MAX_JSON = 2 * 1024 * 1024;
const MAX_UPLOAD = 22 * 1024 * 1024; // base64 of a 15 MB file

// ---------------------------------------------------------------- helpers

const id = (bytes = 12) => randomBytes(bytes).toString('base64url');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(key, expected);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('cache-control', 'no-store');
  if (body === undefined) return res.end();
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('bad json'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setSessionCookie(req, res, token, maxAgeSeconds) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted;
  res.setHeader('set-cookie', `${COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`);
}

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.display_name, createdAt: u.created_at });

function createSession(userId) {
  const token = id(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  openDb().prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), userId, now(), expires);
  return token;
}

/** The signed-in user for this request, or null. */
export function currentUser(req) {
  const token = cookies(req)[COOKIE];
  if (!token) return null;
  const row = openDb().prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), now());
  return row ?? null;
}

// Login rate limit: 8 tries per 15 minutes per email + address.
const attempts = new Map();
function tooManyAttempts(key) {
  const t = Date.now();
  const list = (attempts.get(key) ?? []).filter((x) => t - x < 15 * 60_000);
  attempts.set(key, list);
  return list.length >= 8;
}
/** The visitor's address: behind Fly/Render/etc. the socket is the proxy, so use the header it sets. */
function clientIp(req) {
  const h = req.headers;
  return String(h['fly-client-ip'] ?? h['x-real-ip'] ?? String(h['x-forwarded-for'] ?? '').split(',')[0] ?? '').trim() || req.socket?.remoteAddress || '';
}
const noteAttempt = (key) => attempts.set(key, [...(attempts.get(key) ?? []), Date.now()]);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------------------------------------------------------------- handlers

async function signup(req, res) {
  const body = await readBody(req, MAX_JSON);
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const name = String(body.name ?? '').trim().slice(0, 40);
  if (!EMAIL.test(email)) return send(res, 400, { error: 'Please enter a real email address.' });
  if (password.length < 8) return send(res, 400, { error: 'Please use a password of at least 8 characters.' });
  const db = openDb();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return send(res, 409, { error: 'There is already an account with that email. Try logging in.' });
  const user = { id: id(), email, password_hash: await hashPassword(password), display_name: name, created_at: now() };
  db.prepare('INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)').run(user.id, user.email, user.password_hash, user.display_name, user.created_at);
  // Keep the progress made as a guest, if the learner chose to.
  if (body.profile && typeof body.profile === 'object') {
    db.prepare('INSERT INTO profiles (user_id, data, version, updated_at) VALUES (?, ?, 1, ?)').run(user.id, JSON.stringify(body.profile), now());
  }
  if (body.library && typeof body.library === 'object') {
    db.prepare('INSERT INTO library_progress (user_id, data, updated_at) VALUES (?, ?, ?)').run(user.id, JSON.stringify(body.library), now());
  }
  setSessionCookie(req, res, createSession(user.id), SESSION_DAYS * 86400);
  return send(res, 201, { user: publicUser(user) });
}

async function login(req, res) {
  const body = await readBody(req, MAX_JSON);
  const email = String(body.email ?? '').trim().toLowerCase();
  const key = `${email}|${clientIp(req)}`;
  if (tooManyAttempts(key)) return send(res, 429, { error: 'Too many tries. Please wait a few minutes and try again.' });
  const user = openDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Same message whether the email or the password was wrong.
  if (!user || !(await verifyPassword(String(body.password ?? ''), user.password_hash))) {
    noteAttempt(key);
    return send(res, 401, { error: "That email and password don't match." });
  }
  attempts.delete(key);
  setSessionCookie(req, res, createSession(user.id), SESSION_DAYS * 86400);
  return send(res, 200, { user: publicUser(user) });
}

function logout(req, res) {
  const token = cookies(req)[COOKIE];
  if (token) openDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  setSessionCookie(req, res, '', 0);
  return send(res, 204);
}

function getJsonRow(table, userId) {
  return openDb().prepare(`SELECT * FROM ${table} WHERE user_id = ?`).get(userId);
}

async function putProfile(req, res, user) {
  const body = await readBody(req, MAX_JSON);
  if (!body.data || typeof body.data !== 'object') return send(res, 400, { error: 'data required' });
  const db = openDb();
  const row = getJsonRow('profiles', user.id);
  // Optimistic concurrency: a save based on an old version is refused, so two devices can't silently overwrite each other.
  if (row && Number.isInteger(body.version) && body.version !== row.version) {
    return send(res, 409, { error: 'conflict', data: JSON.parse(row.data), version: row.version });
  }
  const version = (row?.version ?? 0) + 1;
  if (row) db.prepare('UPDATE profiles SET data = ?, version = ?, updated_at = ? WHERE user_id = ?').run(JSON.stringify(body.data), version, now(), user.id);
  else db.prepare('INSERT INTO profiles (user_id, data, version, updated_at) VALUES (?, ?, ?, ?)').run(user.id, JSON.stringify(body.data), version, now());
  return send(res, 200, { version });
}

async function putSimple(req, res, user, table) {
  const body = await readBody(req, MAX_JSON);
  if (!body.data || typeof body.data !== 'object') return send(res, 400, { error: 'data required' });
  openDb().prepare(`INSERT INTO ${table} (user_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).run(user.id, JSON.stringify(body.data), now());
  return send(res, 200, { ok: true });
}

const uploadMeta = (r) => ({
  id: r.id, name: r.name, kind: r.kind, mime: r.mime, size: r.size, mode: r.mode ?? undefined,
  hasFile: r.has_file === 1 || Boolean(r.file), createdAt: r.created_at, updatedAt: r.updated_at,
  raw: r.raw ? JSON.parse(r.raw) : undefined, confirmed: r.confirmed ?? undefined,
});

async function uploadsApi(req, res, user, rest) {
  const db = openDb();
  const [uploadId, sub] = rest;
  if (!uploadId) {
    if (req.method === 'GET') {
      const rows = db.prepare('SELECT id, name, kind, mime, size, mode, raw, confirmed, created_at, updated_at, file IS NOT NULL AS has_file FROM uploads WHERE user_id = ? ORDER BY updated_at DESC').all(user.id);
      return send(res, 200, { uploads: rows.map(uploadMeta) });
    }
    if (req.method === 'POST') {
      const b = await readBody(req, MAX_UPLOAD);
      const name = String(b.name ?? '').trim().slice(0, 80) || 'My reading';
      const kind = ['text', 'txt', 'pdf', 'image'].includes(b.kind) ? b.kind : null;
      if (!kind) return send(res, 400, { error: 'kind required' });
      const file = b.fileBase64 ? Buffer.from(String(b.fileBase64), 'base64') : null;
      const row = { id: id(), name, kind, mime: String(b.mime ?? 'text/plain').slice(0, 60), size: Number(b.size) || file?.length || 0 };
      db.prepare(`INSERT INTO uploads (id, user_id, name, kind, mime, size, file, raw, confirmed, mode, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(row.id, user.id, row.name, row.kind, row.mime, row.size, file,
        b.raw ? JSON.stringify(b.raw) : null, typeof b.confirmed === 'string' ? b.confirmed : null, b.mode ?? null, now(), now());
      return send(res, 201, { upload: uploadMeta(db.prepare('SELECT *, file IS NOT NULL AS has_file FROM uploads WHERE id = ?').get(row.id)) });
    }
    return send(res, 405, { error: 'method' });
  }
  // Ownership check on every single-upload request.
  const row = db.prepare('SELECT *, file IS NOT NULL AS has_file FROM uploads WHERE id = ? AND user_id = ?').get(uploadId, user.id);
  if (!row) return send(res, 404, { error: 'not found' });
  if (sub === 'file') {
    if (!row.file) return send(res, 404, { error: 'no file' });
    res.statusCode = 200;
    res.setHeader('content-type', row.mime);
    res.setHeader('cache-control', 'private, no-store');
    return res.end(Buffer.from(row.file));
  }
  if (req.method === 'GET') return send(res, 200, { upload: uploadMeta(row) });
  if (req.method === 'PUT') {
    const b = await readBody(req, MAX_JSON);
    db.prepare('UPDATE uploads SET name = ?, confirmed = ?, raw = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
      typeof b.name === 'string' ? b.name.slice(0, 80) : row.name,
      typeof b.confirmed === 'string' ? b.confirmed : row.confirmed,
      b.raw ? JSON.stringify(b.raw) : row.raw,
      now(), row.id, user.id);
    return send(res, 200, { upload: uploadMeta(db.prepare('SELECT *, file IS NOT NULL AS has_file FROM uploads WHERE id = ?').get(row.id)) });
  }
  if (req.method === 'DELETE') {
    db.prepare('DELETE FROM uploads WHERE id = ? AND user_id = ?').run(row.id, user.id);
    return send(res, 204);
  }
  return send(res, 405, { error: 'method' });
}

// ---------------------------------------------------------------- router

/** Connect-style middleware for /api/auth/*, /api/account and /api/data/*. */
export async function accountApi(req, res, next) {
  const path = (req.url || '').split('?')[0];
  if (!path.startsWith('/api/auth/') && !path.startsWith('/api/data/') && path !== '/api/account') return next ? next() : undefined;
  try {
    // Changes need the x-lumen header: a cross-site form can't send it.
    if (req.method !== 'GET' && req.headers['x-lumen'] !== '1') return send(res, 403, { error: 'missing x-lumen header' });

    if (path === '/api/auth/signup' && req.method === 'POST') return await signup(req, res);
    if (path === '/api/auth/login' && req.method === 'POST') return await login(req, res);
    if (path === '/api/auth/logout' && req.method === 'POST') return logout(req, res);

    const user = currentUser(req);
    // Signed out isn't an error here: the page just asks who is using it.
    if (path === '/api/auth/me') return send(res, 200, { user: user ? publicUser(user) : null });
    if (!user) return send(res, 401, { error: 'not signed in' });

    if (path === '/api/account' && req.method === 'DELETE') {
      openDb().prepare('DELETE FROM users WHERE id = ?').run(user.id); // cascades to every table
      setSessionCookie(req, res, '', 0);
      return send(res, 204);
    }

    const parts = path.slice('/api/data/'.length).split('/').filter(Boolean);
    const [what, ...rest] = parts;
    if (what === 'profile') {
      if (req.method === 'GET') {
        const row = getJsonRow('profiles', user.id);
        return send(res, 200, row ? { data: JSON.parse(row.data), version: row.version } : { data: null, version: 0 });
      }
      if (req.method === 'PUT') return await putProfile(req, res, user);
    }
    if (what === 'library' || what === 'personal') {
      const table = what === 'library' ? 'library_progress' : 'personalization';
      if (req.method === 'GET') {
        const row = getJsonRow(table, user.id);
        return send(res, 200, { data: row ? JSON.parse(row.data) : null });
      }
      if (req.method === 'PUT') return await putSimple(req, res, user, table);
    }
    if (what === 'uploads') return await uploadsApi(req, res, user, rest);
    if (what === 'stories' && req.method === 'GET') {
      const rows = openDb().prepare('SELECT data FROM stories WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(user.id);
      return send(res, 200, { stories: rows.map((r) => JSON.parse(r.data)) });
    }
    if (what === 'stories' && rest[0] && req.method === 'DELETE') {
      openDb().prepare('DELETE FROM stories WHERE id = ? AND user_id = ?').run(rest[0], user.id);
      return send(res, 204);
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, e.status ?? 500, { error: e.status ? e.message : 'Something went wrong. Please try again.' });
  }
}
