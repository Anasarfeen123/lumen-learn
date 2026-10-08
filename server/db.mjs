// Lumen's database: a single SQLite file (Node's built-in node:sqlite, no
// extra services). Set LUMEN_DB to choose the path (default data/lumen.db).
// Every query that touches a learner's data is scoped by user_id.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// node:sqlite prints an "experimental" warning once; it's stable enough for this use.
const quiet = process.emitWarning;
process.emitWarning = (w, ...rest) => (String(w).includes('SQLite') ? undefined : quiet.call(process, w, ...rest));
const { DatabaseSync } = await import('node:sqlite');
process.emitWarning = quiet;

const DEFAULT = fileURLToPath(new URL('../data/lumen.db', import.meta.url));

let db = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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

export function openDb(path = process.env.LUMEN_DB || DEFAULT) {
  if (db) return db;
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

export function closeDb() {
  db?.close();
  db = null;
}

/** For tests: a fresh in-memory database. */
export function resetDbForTests() {
  db?.close();
  db = null;
  return openDb(':memory:');
}

export const now = () => new Date().toISOString();
