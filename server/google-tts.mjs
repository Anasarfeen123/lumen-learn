// Google Cloud Text-to-Speech with Chirp 3 HD voices.
// Auth (server-side only, from .env or the environment):
//   GOOGLE_TTS_API_KEY=...                          an API key restricted to the Text-to-Speech API, or
//   GOOGLE_APPLICATION_CREDENTIALS=/path/key.json   a service account key (a signed JWT is exchanged for a token)
// Optional: GOOGLE_TTS_VOICE (default en-US-Chirp3-HD-Leda).
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/** A friendly set of Chirp 3 HD English voices (name → label). */
export const GOOGLE_VOICES = {
  'en-US-Chirp3-HD-Leda': 'Leda (warm)',
  'en-US-Chirp3-HD-Aoede': 'Aoede (bright)',
  'en-US-Chirp3-HD-Kore': 'Kore (calm)',
  'en-US-Chirp3-HD-Achernar': 'Achernar (soft)',
  'en-US-Chirp3-HD-Sulafat': 'Sulafat (gentle)',
  'en-US-Chirp3-HD-Puck': 'Puck (cheerful)',
  'en-US-Chirp3-HD-Charon': 'Charon (deep)',
  'en-GB-Chirp3-HD-Leda': 'Leda, British',
};

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_TTS_API_KEY || (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)));
}

export function googleDefaultVoice() {
  const v = process.env.GOOGLE_TTS_VOICE;
  return v && /Chirp3-HD/.test(v) ? v : 'en-US-Chirp3-HD-Leda';
}

let token = { value: '', expires: 0 };

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** OAuth token from a service account key: sign a JWT with the key, exchange it at Google's token endpoint. */
async function serviceAccountToken() {
  if (token.value && Date.now() < token.expires - 60_000) return token.value;
  const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${head}.${claims}`);
  const jwt = `${head}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status}). Check the service account key.`);
  const data = await res.json();
  token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return token.value;
}

/** Speaking rate per style: Lumo's lines at a calm pace, words a little slower, beats slower still. */
const RATE = { lumo: 0.95, cheer: 1, word: 0.9, slow: 0.78 };

export class GoogleError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Synthesizes MP3 audio for one line. */
export async function googleSynthesize(text, voice, style = 'lumo') {
  const name = voice in GOOGLE_VOICES ? voice : googleDefaultVoice();
  const headers = { 'content-type': 'application/json' };
  let url = ENDPOINT;
  if (process.env.GOOGLE_TTS_API_KEY) url += `?key=${encodeURIComponent(process.env.GOOGLE_TTS_API_KEY)}`;
  else headers.authorization = `Bearer ${await serviceAccountToken()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: name.slice(0, 5), name },
      audioConfig: { audioEncoding: 'MP3', speakingRate: RATE[style] ?? 0.95 },
    }),
  });
  if (!res.ok) {
    let message = `Google speech failed (${res.status})`;
    try { message += `: ${(await res.json()).error?.message ?? ''}`; } catch { /* not JSON */ }
    throw new GoogleError(res.status, message);
  }
  const data = await res.json();
  return Buffer.from(data.audioContent ?? '', 'base64');
}
