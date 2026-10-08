// Builds Lumo's natural-voice pack: every fixed line, word, syllable and
// letter sound, spoken by a Groq Orpheus voice and saved as small MP3s in
// public/voice/, with a manifest the app reads at startup. The pack plays
// instantly, works offline and needs no key at runtime.
//
//   npm run voices                     # default voice (GROQ_TTS_VOICE or hannah)
//   npm run voices -- --voice=austin   # another voice
//   npm run voices -- --dry-run        # show the plan only
//   npm run voices -- --max-requests=20
//   npm run voices -- --verify         # re-check built lines with Whisper; drop any that don't match
//
// Free Groq plans allow few speech requests (about 10 a minute, 100 a day), so
// several phrases are spoken per request, separated by pauses, and split at the
// right silences with ffmpeg. Lumo's sentences are aligned with Whisper word
// timings and every clip is transcribed back and compared, so a clip always
// says exactly its line. The build is resumable: run it again to finish.
import { createServer } from 'vite';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { loadEnv } from '../server/env.mjs';

const run = promisify(execFile);
loadEnv();
const { GOOGLE_VOICES, googleConfigured, googleDefaultVoice, googleSynthesize } = await import('../server/google-tts.mjs');
const { fishConfigured, fishDefaultVoice, fishSynthesize, fishVoices } = await import('../server/fish-tts.mjs');

const ROOT = fileURLToPath(new URL('../public/voice/', import.meta.url));
const MANIFEST = join(ROOT, 'manifest.json');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
// Google Chirp 3 HD when configured (or --provider=google); otherwise Groq Orpheus.
const provider = args.provider || (fishConfigured() ? 'fish' : googleConfigured() ? 'google' : 'groq');
const VOICES = provider === 'fish' ? Object.keys(fishVoices()) : provider === 'google' ? Object.keys(GOOGLE_VOICES) : ['hannah', 'autumn', 'diana', 'austin', 'daniel', 'troy'];
const voice = args.voice || (provider === 'fish' ? fishDefaultVoice() : provider === 'google' ? googleDefaultVoice() : process.env.GROQ_TTS_VOICE || 'hannah');
const synthOne = provider === 'fish' ? fishSynthesize : googleSynthesize;
const maxRequests = Number(args['max-requests'] ?? 75);
const MODEL = process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english';
const PREFIX = { lumo: '[friendly] ', word: '', slow: '[slowly] ' };
const MAX_CHARS = 195;
const MAX_ITEMS = { lumo: 3, word: 14, slow: 14 };
const WHISPER = 'whisper-large-v3-turbo';
const SEP = ' ... ';

if (!VOICES.includes(voice)) throw new Error(`Unknown voice "${voice}". Choose one of: ${VOICES.join(', ')}`);
if (provider === 'fish' && !fishConfigured() && !args['dry-run']) {
  console.error('Fish Audio isn\'t set up. Add FISH_API_KEY (and FISH_VOICE_ID) to .env.');
  process.exit(1);
}
if (provider === 'google' && !googleConfigured() && !args['dry-run']) {
  console.error('Google isn\'t set up. Add GOOGLE_TTS_API_KEY (or GOOGLE_APPLICATION_CREDENTIALS) to .env.');
  process.exit(1);
}
if (provider === 'groq' && !process.env.GROQ_API_KEY && !args['dry-run']) {
  console.error('GROQ_API_KEY is missing. Add it to .env (see .env.example).');
  process.exit(1);
}

// ------------------------------------------------------------------ phrases

async function listPhrases() {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { voicePackPhrases, phraseKey } = await vite.ssrLoadModule('/src/services/phrases.ts');
    return voicePackPhrases().map((p) => ({ ...p, key: phraseKey(p.text, p.style) }));
  } finally {
    await vite.close();
  }
}

const loadManifest = () => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { version: 1, voices: {} });
const fileFor = (key) => `${voice}/${createHash('sha1').update(`${voice}|${key}`).digest('hex').slice(0, 16)}.mp3`;

/** Groups phrases of one style into requests of at most MAX_CHARS. */
function batches(items) {
  const out = [];
  for (const style of Object.keys(PREFIX)) {
    let cur = [];
    const len = (list) => PREFIX[style].length + list.map((p) => p.text).join(SEP).length + 1;
    for (const p of items.filter((i) => i.style === style)) {
      if (cur.length && (len([...cur, p]) > MAX_CHARS || cur.length >= MAX_ITEMS[style])) {
        out.push(cur);
        cur = [];
      }
      cur.push(p);
    }
    if (cur.length) out.push(cur);
  }
  return out;
}

// ------------------------------------------------------------------ Groq

let requests = 0;
class DailyLimit extends Error {}

async function synthesize(input) {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (requests >= maxRequests) throw new DailyLimit(`stopped after ${maxRequests} requests (--max-requests)`);
    requests++;
    const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, voice, input, response_format: 'wav' }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text();
    if (body.includes('model_terms_required')) {
      throw new Error('Accept the voice model terms first: https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english');
    }
    if (res.status === 429) {
      const remaining = Number(res.headers.get('x-ratelimit-remaining-requests') ?? 1);
      const reset = res.headers.get('x-ratelimit-reset-requests');
      if (remaining <= 0 || /requests per day|RPD/i.test(body)) throw new DailyLimit(`daily speech limit reached${reset ? `; resets in ${reset}` : ''}`);
      const wait = Number(res.headers.get('retry-after') ?? 7) + 1;
      process.stdout.write(`  (rate limit, waiting ${wait}s)\n`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`Groq speech failed: ${res.status} ${body.slice(0, 200)}`);
  }
  throw new Error('Groq speech kept failing');
}

// ------------------------------------------------------------------ audio splitting

async function silences(wav) {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'silencedetect=noise=-40dB:d=0.12', '-f', 'null', '-'], { maxBuffer: 1 << 24 });
  const duration = Number(stderr.match(/Duration: (\d+):(\d+):([\d.]+)/)?.slice(1).reduce((s, v, i) => s + Number(v) * [3600, 60, 1][i], 0));
  const out = [];
  let start = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start: ([\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) start = Number(s[1]);
    if (e && start !== null) { out.push({ start, end: Number(e[1]) }); start = null; }
  }
  if (start !== null) out.push({ start, end: duration });
  return { duration, gaps: out };
}

/** Speech segments for `n` phrases: split at the n-1 longest pauses between speech. */
export function segment({ duration, gaps }, n) {
  const lead = gaps.find((g) => g.start <= 0.02);
  const tail = gaps.find((g) => g.end >= duration - 0.02 && g !== lead);
  const inner = gaps.filter((g) => g !== lead && g !== tail);
  if (inner.length < n - 1) return null;
  const cuts = inner.slice().sort((a, b) => (b.end - b.start) - (a.end - a.start)).slice(0, n - 1).sort((a, b) => a.start - b.start);
  const from = lead ? lead.end : 0;
  const to = tail ? tail.start : duration;
  const bounds = [from, ...cuts.flatMap((c) => [c.start, c.end]), to];
  const segs = [];
  for (let i = 0; i < n; i++) segs.push({ start: Math.max(0, bounds[i * 2] - 0.04), end: Math.min(duration, bounds[i * 2 + 1] + 0.08) });
  return segs.every((s) => s.end - s.start >= 0.12 && s.end - s.start <= 9) ? segs : null;
}

async function encode(wav, seg, out) {
  const d = (seg.end - seg.start).toFixed(3);
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', seg.start.toFixed(3), '-t', d, '-i', wav,
    '-af', `afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, d - 0.03).toFixed(3)}:d=0.03`, '-ac', '1', '-ar', '24000', '-b:a', '40k', out]);
}

// ------------------------------------------------------------------ Whisper alignment and checks

const norm = (t) => t.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]+/g, ' ').trim().split(/\s+/).filter(Boolean);

/** Share of expected words heard, in order (longest common subsequence). */
export function similarity(expected, heard) {
  const a = norm(expected);
  const b = norm(heard);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  }
  return dp[a.length][b.length] / Math.max(a.length, b.length, 1);
}

async function transcribe(file, words = false) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const form = new FormData();
    form.set('model', WHISPER);
    form.set('language', 'en');
    form.set('response_format', words ? 'verbose_json' : 'json');
    if (words) form.append('timestamp_granularities[]', 'word');
    form.set('file', new Blob([readFileSync(file)]), file.endsWith('.mp3') ? 'clip.mp3' : 'clip.wav');
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: form, signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) return res.json();
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, (Number(res.headers.get('retry-after') ?? 5) + 1) * 1000));
      continue;
    }
    throw new Error(`Whisper failed: ${res.status} ${(await res.text()).slice(0, 160)}`);
  }
  throw new Error('Whisper kept failing');
}

/**
 * Cuts for sentence batches: Whisper finds where each line's first word starts,
 * and the cut snaps to the real pause closest to that point.
 */
async function alignSentences(wav, batch, detected) {
  const t = await transcribe(wav, true);
  const heard = t.words ?? [];
  const counts = batch.map((p) => norm(p.text).length);
  if (heard.length !== counts.reduce((a, b) => a + b, 0)) return null;
  const { duration, gaps } = detected;
  const lead = gaps.find((g) => g.start <= 0.02);
  const tail = gaps.find((g) => g.end >= duration - 0.02 && g !== lead);
  const inner = gaps.filter((g) => g !== lead && g !== tail);
  const cuts = [];
  let idx = 0;
  for (let i = 0; i < batch.length - 1; i++) {
    idx += counts[i];
    const at = heard[idx].start;
    const gap = inner.slice().sort((a, b) => Math.abs(a.end - at) - Math.abs(b.end - at))[0];
    if (!gap || Math.abs(gap.end - at) > 0.9 || cuts.includes(gap)) return null;
    cuts.push(gap);
  }
  cuts.sort((a, b) => a.start - b.start);
  const bounds = [lead ? lead.end : 0, ...cuts.flatMap((c) => [c.start, c.end]), tail ? tail.start : duration];
  return batch.map((_, i) => ({ start: Math.max(0, bounds[i * 2] - 0.04), end: Math.min(duration, bounds[i * 2 + 1] + 0.08) }));
}

/** Lumo's lines and whole words must transcribe back to what they should say. */
async function clipMatches(file, phrase) {
  if (phrase.style === 'slow' || norm(phrase.text).length === 0) return true; // sounds and fragments ("vay", "buh")
  if (phrase.style === 'word' && phrase.text.length <= 2) return true; // single letters
  const { text } = await transcribe(file);
  return similarity(phrase.text, text) >= (phrase.style === 'word' ? 0.99 : 0.8);
}

// ------------------------------------------------------------------ main

const phrases = await listPhrases();
const manifest = loadManifest();
manifest.voices[voice] ??= {};
const done = manifest.voices[voice];
if (args.verify) {
  let dropped = 0;
  for (const p of phrases.filter((x) => done[x.key])) {
    if (!(await clipMatches(join(ROOT, done[p.key]), p))) {
      console.log(`  dropping "${p.text}" (doesn't match)`);
      rmSync(join(ROOT, done[p.key]), { force: true });
      delete done[p.key];
      dropped++;
    }
  }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 0)}\n`);
  console.log(`Verified. ${dropped} clip(s) dropped; run "npm run voices" to rebuild them.`);
  process.exit(0);
}
const todo = phrases.filter((p) => !done[p.key] || !existsSync(join(ROOT, done[p.key])));
const plan = batches(todo);
console.log(`${provider === 'fish' ? 'Fish Audio' : provider === 'google' ? 'Google Chirp 3 HD' : 'Groq Orpheus'} voice "${voice}": ${phrases.length} phrases, ${phrases.length - todo.length} already built, ${todo.length} to go in about ${provider !== 'groq' ? todo.length : plan.length} requests.`);
if (args['dry-run'] || !todo.length) process.exit(0);

mkdirSync(join(ROOT, voice), { recursive: true });

if (provider === 'google' || provider === 'fish') {
  // One request per phrase: exact audio for every line, no splitting needed.
  const save = () => writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 0)}\n`);
  let built = 0;
  const queue = todo.slice();
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      const file = fileFor(p.key);
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          writeFileSync(join(ROOT, file), await synthOne(p.text, voice, p.style));
          done[p.key] = file;
          built++;
          break;
        } catch (e) {
          if ((e.status === 429 || e.status === 503) && attempt < 3) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
          if (e.status === 402) { console.log(`  stopped: ${e.message}`); queue.length = 0; break; }
          console.log(`  skipped "${p.text}": ${e.message}`);
          break;
        }
      }
      if (built % 25 === 0) { save(); console.log(`  ${built}/${todo.length}`); }
    }
  };
  await Promise.all(provider === 'fish' ? [worker(), worker()] : [worker(), worker(), worker(), worker()]);
  save();
  console.log(`Done. ${Object.keys(done).length} phrases in public/voice/${voice}/ (${provider === 'fish' ? 'Fish Audio' : 'Google Chirp 3 HD'}).`);
  process.exit(0);
}
const tmp = join(tmpdir(), `lumo-voice-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const save = () => writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 0)}\n`);

let built = 0;
const queue = plan.slice();
try {
  while (queue.length) {
    const batch = queue.shift();
    const input = PREFIX[batch[0].style] + batch.map((p) => (/[.!?]$/.test(p.text) ? p.text : `${p.text}.`)).join(SEP);
    const wav = join(tmp, 'batch.wav');
    writeFileSync(wav, await synthesize(input));
    const detected = await silences(wav);
    const segs = batch.length === 1
      ? [segment(detected, 1)?.[0] ?? { start: 0, end: detected.duration }]
      : batch[0].style === 'lumo' ? await alignSentences(wav, batch, detected) : segment(detected, batch.length);
    if (!segs) {
      // The pauses didn't line up with the phrases: split the batch and try again.
      const mid = Math.ceil(batch.length / 2);
      queue.unshift(batch.slice(0, mid), batch.slice(mid));
      console.log(`  re-splitting a batch of ${batch.length}`);
      continue;
    }
    const files = batch.map((p) => fileFor(p.key));
    for (let i = 0; i < batch.length; i++) await encode(wav, segs[i], join(ROOT, files[i]));
    const checks = await Promise.all(batch.map((p, i) => clipMatches(join(ROOT, files[i]), p)));
    if (!checks.every(Boolean)) {
      if (batch.length > 1) {
        const mid = Math.ceil(batch.length / 2);
        queue.unshift(batch.slice(0, mid), batch.slice(mid));
        console.log(`  a clip didn't match its line; re-splitting a batch of ${batch.length}`);
      } else {
        console.log(`  kept "${batch[0].text}" although Whisper heard it differently (single phrase, no cut involved)`);
        done[batch[0].key] = files[0];
        save();
      }
      if (batch.length > 1) continue;
    }
    batch.forEach((p, i) => { done[p.key] = files[i]; });
    built += batch.length;
    save();
    console.log(`  ${built}/${todo.length}  ${batch.map((p) => p.text).join(' | ').slice(0, 90)}`);
  }
  console.log(`Done. ${Object.keys(done).length} phrases in public/voice/${voice}/ (${requests} requests).`);
} catch (e) {
  save();
  if (e instanceof DailyLimit) {
    console.log(`Paused: ${e.message}. ${built} phrases built this run. Run "npm run voices" again later to continue.`);
  } else {
    throw e;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
