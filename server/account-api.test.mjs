import { beforeEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { accountApi, hashPassword, verifyPassword } from './account-api.mjs';
import { resetDbForTests } from './db.mjs';

/** Calls the middleware like a browser would, carrying cookies between calls. */
function client() {
  let cookie = '';
  return async function call(method, url, body, { header = true } = {}) {
    const req = new EventEmitter();
    Object.assign(req, { method, url, destroy() {}, socket: { remoteAddress: '1.2.3.4' }, headers: { cookie, ...(header ? { 'x-lumen': '1' } : {}) } });
    const res = await new Promise((resolve) => {
      const r = {
        statusCode: 200, headers: {},
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        end(data) { resolve({ status: this.statusCode, headers: this.headers, body: data && this.headers['content-type'] === 'application/json' ? JSON.parse(data) : data }); },
      };
      accountApi(req, r, () => resolve({ status: 'next' }));
      queueMicrotask(() => { if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end'); });
    });
    const set = res.headers['set-cookie'];
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    return res;
  };
}

describe('accounts', () => {
  beforeEach(() => resetDbForTests());

  it('hashes passwords with scrypt and verifies them', async () => {
    const h = await hashPassword('correct horse');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });

  it('signs up, stays signed in, logs out, and the session really ends', async () => {
    const call = client();
    const s = await call('POST', '/api/auth/signup', { email: 'Sam@Example.com', password: 'longenough', name: 'Sam' });
    expect(s.status).toBe(201);
    expect(s.headers['set-cookie']).toMatch(/HttpOnly; SameSite=Lax/);
    expect((await call('GET', '/api/auth/me')).body.user.email).toBe('sam@example.com');
    expect((await call('POST', '/api/auth/logout')).status).toBe(204);
    expect((await call('GET', '/api/auth/me')).body.user).toBeNull();
    expect((await call('GET', '/api/data/profile')).status).toBe(401);
  });

  it('logs in with the right password only, with one message for both mistakes', async () => {
    const a = client();
    await a('POST', '/api/auth/signup', { email: 'a@b.co', password: 'password1' });
    const b = client();
    const wrong = await b('POST', '/api/auth/login', { email: 'a@b.co', password: 'nope' });
    const nobody = await b('POST', '/api/auth/login', { email: 'x@b.co', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe(nobody.body.error);
    expect((await b('POST', '/api/auth/login', { email: 'A@B.co', password: 'password1' })).status).toBe(200);
  });

  it('rejects weak input and duplicate emails', async () => {
    const call = client();
    expect((await call('POST', '/api/auth/signup', { email: 'nope', password: 'longenough' })).status).toBe(400);
    expect((await call('POST', '/api/auth/signup', { email: 'a@b.co', password: 'short' })).status).toBe(400);
    await call('POST', '/api/auth/signup', { email: 'a@b.co', password: 'longenough' });
    expect((await client()('POST', '/api/auth/signup', { email: 'a@b.co', password: 'longenough' })).status).toBe(409);
  });

  it('refuses changes without the x-lumen header (cross-site forms)', async () => {
    const call = client();
    expect((await call('POST', '/api/auth/signup', { email: 'a@b.co', password: 'longenough' }, { header: false })).status).toBe(403);
  });

  it('rate-limits repeated failed logins', async () => {
    const call = client();
    for (let i = 0; i < 8; i++) await call('POST', '/api/auth/login', { email: 'z@b.co', password: 'x' });
    expect((await call('POST', '/api/auth/login', { email: 'z@b.co', password: 'x' })).status).toBe(429);
  });

  it('saves the profile with version checks, so two devices cannot silently overwrite each other', async () => {
    const call = client();
    await call('POST', '/api/auth/signup', { email: 'a@b.co', password: 'longenough', profile: { xp: 5 } });
    const first = await call('GET', '/api/data/profile');
    expect(first.body).toEqual({ data: { xp: 5 }, version: 1 });
    expect((await call('PUT', '/api/data/profile', { data: { xp: 20 }, version: 1 })).body.version).toBe(2);
    const stale = await call('PUT', '/api/data/profile', { data: { xp: 10 }, version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.data).toEqual({ xp: 20 });
  });

  it('keeps each learner\'s uploads private to them', async () => {
    const a = client();
    const b = client();
    await a('POST', '/api/auth/signup', { email: 'a@b.co', password: 'longenough' });
    await b('POST', '/api/auth/signup', { email: 'c@d.co', password: 'longenough' });
    const up = await a('POST', '/api/data/uploads', { name: 'Note', kind: 'image', mime: 'image/png', fileBase64: Buffer.from('png-bytes').toString('base64'), raw: { text: 'hi', pages: [], warnings: [] } });
    const uid = up.body.upload.id;
    expect((await a('GET', `/api/data/uploads/${uid}/file`)).body.toString()).toBe('png-bytes');
    expect((await b('GET', `/api/data/uploads/${uid}`)).status).toBe(404);
    expect((await b('GET', `/api/data/uploads/${uid}/file`)).status).toBe(404);
    expect((await b('DELETE', `/api/data/uploads/${uid}`)).status).toBe(404);
    expect((await b('GET', '/api/data/uploads')).body.uploads).toEqual([]);
    const put = await a('PUT', `/api/data/uploads/${uid}`, { confirmed: 'Hi there' });
    expect(put.body.upload.confirmed).toBe('Hi there');
    expect(put.body.upload.raw.text).toBe('hi'); // the raw transcription is kept separately
  });

  it('deleting the account erases everything', async () => {
    const call = client();
    await call('POST', '/api/auth/signup', { email: 'a@b.co', password: 'longenough', profile: { xp: 1 } });
    await call('POST', '/api/data/uploads', { name: 'x', kind: 'text', raw: { text: 'x' } });
    expect((await call('DELETE', '/api/account')).status).toBe(204);
    expect((await call('GET', '/api/auth/me')).body.user).toBeNull();
    expect((await client()('POST', '/api/auth/login', { email: 'a@b.co', password: 'longenough' })).status).toBe(401);
  });
});
