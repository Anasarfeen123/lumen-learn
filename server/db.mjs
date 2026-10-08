// Lumen's database: SQLite through libSQL. The same code runs on a local file
// (development, or a server with a disk) and on Turso's hosted database (free
// hosting without a disk).
//
//   TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io  + TURSO_AUTH_TOKEN=...   hosted
//   LUMEN_DB=/path/to/lumen.db                                                local file (default data/lumen.db)
//
// Every query that touches a learner's data is scoped by user_id.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

const DEFAULT = fileURLToPath(new URL('../data/lumen.db', import.meta.url));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- The learner profile (progress, settings, mastery) as JSON, with a version for conflict checks.
CREATE TABLE IF NOT EXISTS profiles (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- Reading positions, bookmarks and finished stories.
CREATE TABLE IF NOT EXISTS library_progress (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Uploaded reading material: the original file, the raw transcription and the confirmed text, kept apart.
CREATE TABLE IF NOT EXISTS uploads (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  file       BLOB,
  raw        TEXT,
  confirmed  TEXT,
  mode       TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS uploads_user ON uploads(user_id);

-- What Lumo knows to personalise practice: interests, age band, story feedback, notes.
CREATE TABLE IF NOT EXISTS personalization (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Stories Lumo wrote for this learner.
CREATE TABLE IF NOT EXISTS stories (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS stories_user ON stories(user_id);
`;

/** Tables holding a learner's data, cleared explicitly on account deletion (a hosted DB may not enforce cascades). */
export const USER_TABLES = ['sessions', 'profiles', 'library_progress', 'uploads', 'personalization', 'stories'];

let client = null;
let ready = null;

function connect() {
  if (process.env.TURSO_DATABASE_URL) return createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  const path = process.env.LUMEN_DB || DEFAULT;
  if (path === ':memory:') return createClient({ url: ':memory:' });
  mkdirSync(dirname(path), { recursive: true });
  return createClient({ url: pathToFileURL(path).href });
}

/** The database, with its tables created. */
export async function db() {
  if (!client) {
    client = connect();
    ready = (async () => {
      if (!process.env.TURSO_DATABASE_URL) await client.execute('PRAGMA journal_mode = WAL').catch(() => {});
      await client.execute('PRAGMA foreign_keys = ON').catch(() => {});
      await client.executeMultiple(SCHEMA);
    })();
    ready.catch(() => { client = null; }); // let the next request retry
  }
  await ready;
  return client;
}

export const dbKind = () => (process.env.TURSO_DATABASE_URL ? 'turso' : 'file');

/** All rows. */
export async function all(sql, ...args) {
  return (await (await db()).execute({ sql, args })).rows;
}

/** The first row, or undefined. */
export async function one(sql, ...args) {
  return (await all(sql, ...args))[0];
}

/** Run a change. */
export async function run(sql, ...args) {
  return (await db()).execute({ sql, args });
}

/** Several changes at once, all or nothing. */
export async function batch(statements) {
  return (await db()).batch(statements.map(([sql, ...args]) => ({ sql, args })), 'write');
}

export function closeDb() {
  client?.close();
  client = null;
  ready = null;
}

/** For tests: a fresh in-memory database. */
export async function resetDbForTests() {
  closeDb();
  delete process.env.TURSO_DATABASE_URL;
  process.env.LUMEN_DB = ':memory:';
  return db();
}

export const now = () => new Date().toISOString();
