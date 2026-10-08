// Lumo's AI endpoints, backed by Groq. The model only ever *writes words* and
// *speaks lines*: it never picks words, marks answers or changes levels.
// Every text reply is validated here and again in the browser; anything that
// fails falls back to the app's templates.
//
//   GET  /api/lumo/status   -> { ai, model, tts: { state, voice, voices, message } }
//   POST /api/lumo/insight  { template, context }               -> { text }
//   POST /api/lumo/tip      { game, word, syllables, options, chosen, tags } -> { text }
//   POST /api/lumo/summary  { stats }                           -> { text }
//   POST /api/lumo/ideas    { stats }                           -> { ideas: [{ title, how }] }
//   POST /api/lumo/explain  { word, sentence }                  -> { meaning, example, emoji }
//   POST /api/lumo/speech   { text, voice?, style? }            -> audio/wav (natural voice)
//
// Needs GROQ_API_KEY (from .env or the environment). Without it, the POST
// routes answer 204 and the app quietly uses its templates and the device voice.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GOOGLE_VOICES, googleConfigured, googleDefaultVoice, googleSynthesize, GoogleError } from './google-tts.mjs';
import { localEngine, localSynthesize } from './local-tts.mjs';
import { FishError, fishConfigured, fishDefaultVoice, fishSynthesize, fishVoices } from './fish-tts.mjs';

const CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Spoken lines are kept on disk too, so restarts never spend the speech quota again. */
const DISK_CACHE = fileURLToPath(new URL('../.cache/lumo-voice/', import.meta.url));
const SPEECH_URL = 'https://api.groq.com/openai/v1/audio/speech';
const MAX_BODY = 16 * 1024;

const MODELS_URL = 'https://api.groq.com/openai/v1/models';
/** Smartest first. Groq retires models over time, so the server picks the first one this key can use. */
export const MODEL_PREFERENCE = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'];

let resolved = { model: null, checkedAt: 0, note: '' };

/** The text model to use: GROQ_MODEL if this key can use it, else the best available one. */
async function resolveModel() {
  if (resolved.model && Date.now() - resolved.checkedAt < 60 * 60_000) return resolved.model;
  const wanted = process.env.GROQ_MODEL?.trim();
  try {
    const res = await fetch(MODELS_URL, {
      headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`models ${res.status}`);
    const ids = new Set(((await res.json()).data ?? []).map((m) => m.id));
    const pick = [wanted, ...MODEL_PREFERENCE].find((m) => m && ids.has(m));
    resolved = {
      model: pick ?? wanted ?? MODEL_PREFERENCE[0],
      checkedAt: Date.now(),
      note: wanted && !ids.has(wanted) ? `GROQ_MODEL "${wanted}" isn't available to this key; using ${pick}` : '',
    };
  } catch {
    resolved = { model: wanted || MODEL_PREFERENCE[0], checkedAt: Date.now() - 55 * 60_000, note: '' };
  }
  return resolved.model;
}

/** Reasoning models think before answering; keep that short so replies stay fast. */
function modelParams(m) {
  if (m.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low' };
  if (m.startsWith('qwen/')) return { reasoning_effort: 'none' };
  return {};
}
const ttsModel = () => process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english';
export const TTS_VOICES = ['hannah', 'autumn', 'diana', 'austin', 'daniel', 'troy'];
const GROQ_LABELS = { hannah: 'Hannah', autumn: 'Autumn', diana: 'Diana', austin: 'Austin', daniel: 'Daniel', troy: 'Troy' };

/** Which natural voice service to use: Fish Audio, then Google Chirp 3 HD, then Groq Orpheus. */
export function ttsProvider() {
  if (fishConfigured()) return 'fish';
  if (googleConfigured()) return 'google';
  return process.env.GROQ_API_KEY ? 'groq' : 'none';
}
const voiceList = () => (ttsProvider() === 'fish' ? Object.keys(fishVoices()) : ttsProvider() === 'google' ? Object.keys(GOOGLE_VOICES) : TTS_VOICES);
const voiceLabels = () => (ttsProvider() === 'fish' ? fishVoices() : ttsProvider() === 'google' ? GOOGLE_VOICES : GROQ_LABELS);
const defaultVoice = () => {
  if (ttsProvider() === 'fish') return fishDefaultVoice();
  if (ttsProvider() === 'google') return googleDefaultVoice();
  return TTS_VOICES.includes(process.env.GROQ_TTS_VOICE) ? process.env.GROQ_TTS_VOICE : 'hannah';
};
const hasKey = () => Boolean(process.env.GROQ_API_KEY);

// ------------------------------------------------------------------ validation

export const INSIGHT_BANNED = ['wrong', 'bad', 'fail', 'easy', 'dyslexia', 'dyslexic', 'disorder', 'test', 'score', 'problem', 'stupid', 'slow'];
export const SUMMARY_BANNED = ['dyslexia', 'dyslexic', 'disorder', 'diagnosis', 'behind', 'below average', 'fail', 'struggle', 'score', 'percent', 'lazy'];

function hasBanned(text, banned) {
  const lower = text.toLowerCase();
  return banned.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
}
const words = (t) => t.trim().split(/\s+/).filter(Boolean);
const lettersOnly = (t) => t.toLowerCase().replace(/[^a-z]/g, '');

export function validInsight(text) {
  return Boolean(text) && words(text).length <= 14 && !/\d/.test(text) && !hasBanned(text, INSIGHT_BANNED);
}

/** A hint may point at sounds and letters, but must never give the answer away. */
export function validTip(text, { word, options = [] }) {
  if (!text || words(text).length > 18 || /\d/.test(text) || hasBanned(text, INSIGHT_BANNED)) return false;
  // Vowel-length labels are where models get phonics wrong; the built-in hint is safer.
  if (/\b(short|long)\b/i.test(text)) return false;
  const lower = text.toLowerCase();
  const said = [word, ...options].filter(Boolean).map((w) => w.toLowerCase());
  if (said.some((w) => new RegExp(`\\b${w}\\b`).test(lower))) return false;
  // No spelling it out letter by letter either ("f-r-i-e-n-d").
  return !word || word.length < 3 || !lettersOnly(text).includes(lettersOnly(word));
}

export function validSummary(text, stats) {
  if (!text) return false;
  const sentences = text.split(/[.!?]+(\s|$)/).filter((s) => s && s.trim());
  if (sentences.length > 5 || hasBanned(text, SUMMARY_BANNED)) return false;
  const allowed = new Set(JSON.stringify(stats).match(/\d+/g) || []);
  return (text.match(/\d+/g) || []).every((n) => allowed.has(n));
}

export function validIdeas(ideas) {
  return Array.isArray(ideas) && ideas.length >= 1 && ideas.length <= 3 && ideas.every((i) =>
    i && typeof i.title === 'string' && typeof i.how === 'string' && i.title && i.how &&
    words(i.title).length <= 7 && words(i.how).length <= 35 &&
    !/\d/.test(i.title + i.how) && !hasBanned(`${i.title} ${i.how}`, SUMMARY_BANNED));
}

// ------------------------------------------------------------------ grounding

/**
 * Exactly how an option differs from the target, so the model's hint is about
 * a real difference ("au" vs "ua"), not a guess.
 */
export function describeDiff(target, option) {
  let a = 0;
  while (a < target.length && a < option.length && target[a] === option[a]) a++;
  let b = 0;
  while (b < target.length - a && b < option.length - a && target[target.length - 1 - b] === option[option.length - 1 - b]) b++;
  const right = target.slice(a, target.length - b);
  const other = option.slice(a, option.length - b);
  const where = a === 0 ? 'at the start' : b === 0 ? 'at the end' : 'in the middle';
  if (!other) return `the other one leaves out "${right}" ${where}`;
  if (!right) return `the other one adds an extra "${other}" ${where}`;
  return `the right one has "${right}" ${where} where the other has "${other}"`;
}

// ------------------------------------------------------------------ prompts

const LUMO = `You are Lumo, a small glowing firefly who guides children aged 7 to 14 through a reading game. Many players are dyslexic and have been marked wrong for years, so you are warm, calm and specific. You never say wrong, bad, fail or easy, never mention dyslexia, never compare children, and never use numbers.`;

const INSIGHT_SYSTEM = `${LUMO}
Write ONE sentence (at most 14 words) for the end of a round, in Lumo's voice, keeping the meaning of the template exactly.
Use simple words a 7-year-old can read. At most one exclamation mark. You may name one example word only from "firstTryWords", and only to praise it. Never call a word long or short unless the template does. Do not mention the child's name.
Reply as JSON: {"text": "..."}`;

const TIP_SYSTEM = `${LUMO}
The child just picked a different answer. Give ONE short spoken hint (at most 16 words) that helps them find the right one themselves.
Rules:
- Never say or spell out the target word or any of the options.
- Base the hint on the "differences" list: they are exact. Point at that letter pattern or sound (you may quote a few letters, like "au" or "sh"), or at the number of beats.
- In detective, builder and speller, talk about LETTERS the child can see ("look for ie in the middle"), never about how letters sound.
- In sound, talk about the SOUND to listen for, named by its letters from the differences ("listen for the b at the start", "listen for the oa sound"). Never call a vowel long or short.
- Be accurate. If you're unsure, talk about counting the beats.
- Plain, friendly words. No numbers.
Game notes: detective = pick the correct spelling; sound = pick the word you heard; builder = put letter tiles in order; speller = spell each syllable into a box.
Reply as JSON: {"tip": "..."}`;

const SUMMARY_SYSTEM = `You write a short weekly summary for a parent or teacher about a child's practice in a reading game.
Rules:
- 3 or 4 sentences, plain English, warm and specific.
- Start with what went well. Then one thing that is still tricky (name an example word if one is given). End with one practical suggestion that names a game.
- Use "{name}" for the child and "they" only if needed; otherwise keep using "{name}".
- Never use: ${SUMMARY_BANNED.join(', ')}.
- Only state facts present in the data. Do not invent numbers.
Reply as JSON: {"text": "..."}`;

const IDEAS_SYSTEM = `You suggest short, playful offline activities a parent or teacher can do at home with a child aged 7 to 14 who is practising reading and spelling.
Base them on the "tricky" areas in the data. Prefer multisensory, Orton-Gillingham style ideas: tracing letters in sand or on a back, tapping or clapping syllables, building words with letter cards, saying sounds while writing.
Rules: 2 or 3 ideas. Each has a title (at most 6 words) and "how" (at most 30 words, one or two sentences). No numbers, no jargon, never use: ${SUMMARY_BANNED.join(', ')}. Use example words from the data when helpful.
Reply as JSON: {"ideas": [{"title": "...", "how": "..."}]}`;

const EXPLAIN_SYSTEM = `You explain words to children aged 7 to 14 who are learning to read, many of them dyslexic.
For each item, explain the word as it is used in its sentence.
Rules:
- "meaning": at most 14 simple words, no jargon, never use the word itself or a form of it.
- "example": a new short sentence (at most 10 words) that uses the word the same way.
- "emoji": ONE emoji only if it clearly shows the meaning (like a dog for "pup"); otherwise "".
- For names of people or animals, the meaning is "a name" plus who they are in the sentence.
- For small words like "the", "of", "was", explain how the word is used, simply.
Never use: ${INSIGHT_BANNED.join(', ')}.
Reply as JSON: {"items": [{"word": "...", "meaning": "...", "example": "...", "emoji": "..."}]}`;

/** A single emoji (with optional variation selector or joiners), or nothing. */
export function validEmoji(e) {
  if (!e) return true;
  return /^\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u.test(e);
}

export function validExplanation(x, word) {
  if (!x || typeof x.meaning !== 'string' || !x.meaning.trim()) return false;
  if (words(x.meaning).length > 16 || hasBanned(x.meaning, INSIGHT_BANNED)) return false;
  if (x.example && (typeof x.example !== 'string' || words(x.example).length > 14 || hasBanned(x.example, INSIGHT_BANNED))) return false;
  if (!validEmoji(x.emoji ?? '')) return false;
  const w = String(word).toLowerCase();
  // The meaning shouldn't just repeat the word (short function words excepted).
  return w.length <= 3 || !new RegExp(`\\b${w.replace(/[^a-z']/g, '')}\\b`, 'i').test(x.meaning);
}

/** Explains several words in their sentences. Used live (uploads) and by `npm run dictionary`. */
export async function explainWords(items, timeoutMs = 8000) {
  const out = await chatJson(EXPLAIN_SYSTEM, JSON.stringify({ items }), timeoutMs, 150 * items.length);
  const list = Array.isArray(out.items) ? out.items : [];
  return items.map(({ word }) => {
    const x = list.find((i) => String(i?.word ?? '').toLowerCase() === word.toLowerCase());
    const clean2 = x && { meaning: clean(x.meaning), example: clean(x.example ?? ''), emoji: String(x.emoji ?? '').trim() };
    return clean2 && validExplanation(clean2, word) ? clean2 : null;
  });
}

// ------------------------------------------------------------------ Groq calls

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chat completion with JSON output and one retry on rate limits or server errors, within a deadline. */
async function chatJson(system, user, timeoutMs, maxTokens = 300) {
  const deadline = Date.now() + timeoutMs;
  const model = await resolveModel();
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - Date.now();
    if (left < 400) break;
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(left),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model,
        // Reasoning tokens count toward the limit; leave room for them.
        max_tokens: maxTokens + 400,
        ...modelParams(model),
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      try {
        return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
      } catch {
        return {};
      }
    }
    if (res.status !== 429 && res.status < 500) throw new Error(`Groq chat failed: ${res.status}`);
    await sleep(250);
  }
  throw new Error('Groq chat timed out');
}

const clean = (t) => (typeof t === 'string' ? t.trim().replace(/^["“](.*)["”]$/s, '$1').trim() : '');

/** Small LRU cache: the same hint or spoken line is reused across rounds and learners. */
class Lru {
  constructor(max) { this.max = max; this.map = new Map(); }
  get(k) {
    const v = this.map.get(k);
    if (v !== undefined) { this.map.delete(k); this.map.set(k, v); }
    return v;
  }
  set(k, v) {
    this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }
}
const tipCache = new Lru(500);
const explainCache = new Lru(2000);
const audioCache = new Lru(400);
const audioInFlight = new Map();

// ------------------------------------------------------------------ natural voice (TTS)

let tts = { state: 'unknown', checkedAt: 0, message: '' };
/** While Groq says we're over the speech limit, don't ask again until this time. */
let limitedUntil = 0;

/** "3h36m0s" / "6s" / "1.5s" -> milliseconds. */
function parseDuration(s) {
  if (!s) return 0;
  let ms = 0;
  for (const [, n, unit] of String(s).matchAll(/([\d.]+)(h|ms|m|s)/g)) ms += Number(n) * { h: 3600e3, m: 60e3, s: 1e3, ms: 1 }[unit];
  return ms;
}

function diskPath(key) {
  return `${DISK_CACHE}${createHash('sha1').update(key).digest('hex')}.wav`;
}

/** Orpheus vocal directions: Lumo sounds friendly; slow beats are spoken slowly. */
const STYLE_PREFIX = { lumo: '[friendly] ', cheer: '[cheerful] ', word: '', slow: '[slowly] ' };

class RateLimited extends Error {}

async function synthesize(text, voice, style) {
  if (ttsProvider() === 'fish') {
    if (Date.now() < limitedUntil) throw new RateLimited('Fish Audio limit reached; using another voice for now');
    try {
      const audio = await fishSynthesize(text, voice, style);
      tts = { state: 'ready', checkedAt: Date.now(), message: '' };
      return audio;
    } catch (e) {
      if (e instanceof FishError && (e.status === 402 || e.status === 429 || e.status === 503)) {
        // Quota or overload: pause Fish for a while; the local voice covers it.
        limitedUntil = Date.now() + (e.status === 402 ? 60 * 60_000 : 30_000);
        tts = { state: 'limited', checkedAt: Date.now(), message: e.message };
        throw new RateLimited(e.message);
      }
      tts = { state: 'error', checkedAt: Date.now(), message: String(e.message || e) };
      throw e;
    }
  }
  if (ttsProvider() === 'google') {
    try {
      const audio = await googleSynthesize(text, voice, style);
      tts = { state: 'ready', checkedAt: Date.now(), message: '' };
      return audio;
    } catch (e) {
      if (e instanceof GoogleError && e.status === 429) {
        limitedUntil = Date.now() + 30_000;
        throw new RateLimited('Google speech is busy');
      }
      tts = { state: 'error', checkedAt: Date.now(), message: String(e.message || e) };
      throw e;
    }
  }
  if (Date.now() < limitedUntil) throw new RateLimited('speech limit reached; using the device voice for now');
  const input = `${STYLE_PREFIX[style] ?? ''}${text}`.slice(0, 200);
  const res = await fetch(SPEECH_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: ttsModel(), input, voice, response_format: 'wav' }),
  });
  if (!res.ok) {
    let code = '';
    try { code = (await res.json()).error?.code ?? ''; } catch { /* not JSON */ }
    if (code === 'model_terms_required') {
      tts = { state: 'needs-terms', checkedAt: Date.now(), message: 'Accept the voice model terms in the Groq console.' };
    }
    if (res.status === 429) {
      const daily = Number(res.headers.get('x-ratelimit-remaining-requests') ?? 1) <= 0;
      const wait = daily ? parseDuration(res.headers.get('x-ratelimit-reset-requests')) : (Number(res.headers.get('retry-after') ?? 10)) * 1000;
      limitedUntil = Date.now() + Math.max(wait, 5000);
      tts = { state: 'limited', checkedAt: Date.now(), message: daily ? 'daily speech limit reached' : 'speech rate limit reached' };
      throw new RateLimited(daily ? 'daily speech limit reached' : 'speech rate limit reached');
    }
    throw new Error(`Groq speech failed: ${res.status}${code ? ` ${code}` : ''}`);
  }
  tts = { state: 'ready', checkedAt: Date.now(), message: '' };
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Speech for one line: the cloud voice when it works, otherwise a local voice on
 * this server (Piper or espeak-ng), so Lumo is never silent because of quotas.
 */
async function speechWithFallback(text, voice, style) {
  if (ttsProvider() !== 'none') {
    try {
      return { audio: await speech(text, voice, style), local: false };
    } catch (e) {
      if (!(await localEngine())) throw e;
    }
  }
  const key = `local|${style}|${text}`;
  const hit = audioCache.get(key);
  if (hit) return { audio: hit, local: true };
  const audio = await localSynthesize(text, style);
  audioCache.set(key, audio);
  return { audio, local: true };
}

function speech(text, voice, style) {
  const key = `${ttsProvider() === 'fish' ? 'fish' : ttsProvider() === 'google' ? 'google' : ttsModel()}|${voice}|${style}|${text}`;
  const hit = audioCache.get(key);
  if (hit) return Promise.resolve(hit);
  if (audioInFlight.has(key)) return audioInFlight.get(key);
  const file = diskPath(key);
  if (existsSync(file)) {
    const buf = readFileSync(file);
    audioCache.set(key, buf);
    return Promise.resolve(buf);
  }
  const p = synthesize(text, voice, style)
    .then((buf) => {
      audioCache.set(key, buf);
      try {
        mkdirSync(DISK_CACHE, { recursive: true });
        writeFileSync(file, buf);
      } catch { /* disk cache is best-effort */ }
      return buf;
    })
    .finally(() => audioInFlight.delete(key));
  audioInFlight.set(key, p);
  return p;
}

/** Checks (at most every 10 minutes, or on request) whether the natural voice works with this key. */
async function ttsStatus(force = false) {
  if (ttsProvider() === 'none') return { state: 'off', message: 'Add GOOGLE_TTS_API_KEY (or GROQ_API_KEY) to .env' };
  const fresh = Date.now() - tts.checkedAt < 10 * 60_000;
  if (!force && fresh && tts.state !== 'unknown') return tts;
  try {
    // Uses the disk cache when it can, so checking doesn't spend the speech quota.
    await (force ? synthesize('Hi!', defaultVoice(), 'lumo') : speech('Hi!', defaultVoice(), 'lumo'));
  } catch (e) {
    if (e instanceof RateLimited) {
      // The key and terms are fine; we're only over the limit for now.
      tts = { state: 'limited', checkedAt: Date.now(), message: `${e.message}; the voice pack and device voice cover it` };
    } else if (tts.state !== 'needs-terms') {
      tts = { state: 'error', checkedAt: Date.now(), message: String(e.message || e) };
    }
  }
  return tts;
}

// ------------------------------------------------------------------ HTTP plumbing

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

const str = (v, max) => String(v ?? '').slice(0, max);
const strList = (v, max = 6) => (Array.isArray(v) ? v.slice(0, max).map((x) => str(x, 40)) : []);

let localName = null;
void localEngine().then((e) => { localName = e; });

/** Secret-free status for the browser and the startup log. */
export function publicStatus(t = tts) {
  return {
    ai: hasKey(),
    model: hasKey() ? resolved.model ?? process.env.GROQ_MODEL ?? MODEL_PREFERENCE[0] : null,
    modelNote: resolved.note,
    tts: {
      provider: ttsProvider(),
      state: ttsProvider() === 'none' ? 'off' : Date.now() < limitedUntil ? 'limited' : t.state,
      voice: defaultVoice(),
      voices: voiceList(),
      labels: voiceLabels(),
      message: ttsProvider() !== 'none' ? t.message || '' : 'Add GOOGLE_TTS_API_KEY (or GROQ_API_KEY) to .env',
      /** A voice made on this server (Piper or espeak-ng), used when the cloud voice can't answer. */
      local: localName,
    },
  };
}

/** Connect-style middleware. Calls next() for anything that isn't ours. */
export async function lumoApi(req, res, next) {
  const [url, query = ''] = (req.url || '').split('?');
  if (!url.startsWith('/api/lumo/')) return next ? next() : send(res, 404, { error: 'not found' });

  if (url === '/api/lumo/status') {
    if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
    if (hasKey()) await resolveModel();
    return send(res, 200, publicStatus(await ttsStatus(query.includes('refresh'))));
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (url === '/api/lumo/speech') {
    // Speech works without a Groq key: Google, or the local voice on this server.
  } else if (!hasKey()) {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const body = await readJson(req);

    if (url === '/api/lumo/speech') {
      const text = str(body.text, 180).replace(/[\u0000-\u001f[\]]/g, ' ').trim();
      if (!text) return send(res, 400, { error: 'text required' });
      const voice = voiceList().includes(body.voice) ? body.voice : defaultVoice();
      const style = Object.hasOwn(STYLE_PREFIX, body.style) ? body.style : 'lumo';
      try {
        const { audio, local } = await speechWithFallback(text, voice, style);
        res.statusCode = 200;
        res.setHeader('x-lumo-voice', local ? 'local' : ttsProvider());
        res.setHeader('content-type', !local && (ttsProvider() === 'google' || ttsProvider() === 'fish') ? 'audio/mpeg' : 'audio/wav');
        res.setHeader('cache-control', 'private, max-age=86400');
        return res.end(audio);
      } catch (e) {
        const status = e instanceof RateLimited ? 429 : tts.state === 'needs-terms' ? 503 : 502;
        if (e instanceof RateLimited) res.setHeader('retry-after', String(Math.ceil((limitedUntil - Date.now()) / 1000)));
        return send(res, status, { error: String(e.message || e), tts: tts.state });
      }
    }

    if (url === '/api/lumo/insight') {
      const template = str(body.template, 200);
      if (!template) return send(res, 400, { error: 'template required' });
      const user = JSON.stringify({ template, context: body.context ?? {} }).slice(0, 1500);
      const text = clean((await chatJson(INSIGHT_SYSTEM, user, 2500, 120)).text);
      return validInsight(text) ? send(res, 200, { text }) : send(res, 422, { error: 'invalid reply' });
    }

    if (url === '/api/lumo/tip') {
      const input = {
        game: str(body.game, 12),
        target: str(body.word, 30),
        syllables: strList(body.syllables),
        options: strList(body.options),
        chosen: str(body.chosen, 30),
        tags: strList(body.tags),
      };
      input.differences = input.options.map((o) => describeDiff(input.target, o));
      if (!input.target) return send(res, 400, { error: 'word required' });
      const key = JSON.stringify(input);
      let text = tipCache.get(key);
      if (!text) {
        text = clean((await chatJson(TIP_SYSTEM, JSON.stringify(input), 3500, 120)).tip);
        if (!validTip(text, { word: input.target, options: input.options })) return send(res, 422, { error: 'invalid reply' });
        tipCache.set(key, text);
      }
      return send(res, 200, { text });
    }

    if (url === '/api/lumo/explain') {
      const word = str(body.word, 40).trim();
      const sentence = str(body.sentence, 300).trim();
      if (!word || !/^[\p{L}'’-]+$/u.test(word)) return send(res, 400, { error: 'a single word is required' });
      const key = `${word.toLowerCase()}|${sentence.toLowerCase()}`;
      let x = explainCache.get(key);
      if (!x) {
        [x] = await explainWords([{ word, sentence }], 5000);
        if (!x) return send(res, 422, { error: 'invalid reply' });
        explainCache.set(key, x);
      }
      return send(res, 200, x);
    }

    if (url === '/api/lumo/summary') {
      const stats = body.stats;
      if (!stats || typeof stats !== 'object') return send(res, 400, { error: 'stats required' });
      const text = clean((await chatJson(SUMMARY_SYSTEM, JSON.stringify(stats).slice(0, 4000), 4500, 300)).text);
      return validSummary(text, stats) ? send(res, 200, { text }) : send(res, 422, { error: 'invalid reply' });
    }

    if (url === '/api/lumo/ideas') {
      const stats = body.stats;
      if (!stats || typeof stats !== 'object') return send(res, 400, { error: 'stats required' });
      const out = await chatJson(IDEAS_SYSTEM, JSON.stringify(stats).slice(0, 4000), 5000, 400);
      const ideas = Array.isArray(out.ideas) ? out.ideas.map((i) => ({ title: clean(i?.title), how: clean(i?.how) })) : [];
      return validIdeas(ideas) ? send(res, 200, { ideas }) : send(res, 422, { error: 'invalid reply' });
    }

    return send(res, 404, { error: 'not found' });
  } catch (err) {
    return send(res, 502, { error: err instanceof Error ? err.message : 'upstream error' });
  }
}
