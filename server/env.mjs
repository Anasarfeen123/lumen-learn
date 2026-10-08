// One place that reads the app's .env, used by both `npm run dev` (vite.config)
// and `npm start` (server/index.mjs). Variables already set in the real
// environment win over the file, so hosting platforms can override it.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));

/** Minimal dotenv parser: KEY=value, # comments, optional quotes. */
export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, ''); // trailing comment on an unquoted value
    out[m[1]] = value;
  }
  return out;
}

/** Loads ../.env into process.env (without overriding). Returns what it found, for logging. */
export function loadEnv(path = ENV_PATH) {
  if (!existsSync(path)) return { path, found: false, keys: [] };
  const values = parseEnv(readFileSync(path, 'utf8'));
  for (const [k, v] of Object.entries(values)) {
    if (process.env[k] === undefined && v !== '') process.env[k] = v;
  }
  return { path, found: true, keys: Object.keys(values).filter((k) => values[k] !== '') };
}

/** A one-line, secret-free description of the AI setup. */
export function describeSetup(status) {
  const ai = process.env.GROQ_API_KEY ? `on (Groq · ${status.model})` : 'off — add GROQ_API_KEY to .env';
  return `Lumo's AI: ${ai}`;
}
