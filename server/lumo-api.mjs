// Lumo's language endpoints. The model only ever *phrases* text: it never
// decides levels or marks answers. Every reply is validated here and again
// in the browser; anything that fails falls back to the template.
//
//   POST /api/lumo/insight  { template, context }  -> { text }
//   POST /api/lumo/summary  { stats }              -> { text }
//
// Requires ANTHROPIC_API_KEY. Without it, both routes answer 503 and the app
// uses its built-in templates.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.LUMEN_MODEL || 'claude-haiku-4-5-20251001';
const MAX_BODY = 8 * 1024;

const INSIGHT_BANNED = ['wrong', 'bad', 'fail', 'easy', 'dyslexia', 'disorder', 'test', 'score', 'problem'];
const SUMMARY_BANNED = ['dyslexia', 'disorder', 'diagnosis', 'behind', 'below average', 'fail', 'struggle', 'score', 'percent'];

const INSIGHT_SYSTEM = `You write one short, warm sentence for a children's reading game mascot named Lumo.
Rules: at most 14 words. Simple words a 7-year-old can read. Encouraging. No exclamation overload (max one).
Never use: ${INSIGHT_BANNED.join(', ')}.
Do not mention the child's name. Reply with the sentence only.`;

const SUMMARY_SYSTEM = `You write a short weekly summary for a parent or teacher about a child's practice in a reading game.
Rules:
- 3 or 4 sentences, plain English, warm and specific.
- Start with what went well. Then one thing that is still tricky. End with one practical suggestion that names a game.
- Use "{name}" for the child and "she/he/they" only if pronoun is given; otherwise keep using "{name}".
- Never use: ${SUMMARY_BANNED.join(', ')}.
- Only state facts present in the data. Do not invent numbers.
Reply with the summary only.`;

function hasBanned(text, banned) {
  const lower = text.toLowerCase();
  return banned.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
}

export function validInsight(text) {
  if (!text) return false;
  const words = text.trim().split(/\s+/);
  return words.length <= 14 && !/\d/.test(text) && !hasBanned(text, INSIGHT_BANNED);
}

export function validSummary(text, stats) {
  if (!text) return false;
  const sentences = text.split(/[.!?]+\s/).filter((s) => s.trim());
  if (sentences.length > 5 || hasBanned(text, SUMMARY_BANNED)) return false;
  const allowed = new Set((JSON.stringify(stats).match(/\d+/g) || []));
  return (text.match(/\d+/g) || []).every((n) => allowed.has(n));
}

async function callModel(system, user, timeoutMs) {
  const res = await fetch(API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Model call failed: ${res.status}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

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

/** Connect-style middleware. Calls next() for anything that isn't ours. */
export async function lumoApi(req, res, next) {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/api/lumo/')) return next ? next() : send(res, 404, { error: 'not found' });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { error: 'AI not configured' });

  try {
    const body = await readJson(req);
    if (url === '/api/lumo/insight') {
      const template = String(body.template || '').slice(0, 200);
      const context = JSON.stringify(body.context || {}).slice(0, 300);
      if (!template) return send(res, 400, { error: 'template required' });
      const user = `Rewrite this message in Lumo's voice, keeping its meaning exactly:\n"${template}"\nContext (do not repeat numbers): ${context}`;
      const text = await callModel(INSIGHT_SYSTEM, user, 2500);
      return validInsight(text) ? send(res, 200, { text }) : send(res, 422, { error: 'invalid reply' });
    }
    if (url === '/api/lumo/summary') {
      const stats = body.stats;
      if (!stats || typeof stats !== 'object') return send(res, 400, { error: 'stats required' });
      const text = await callModel(SUMMARY_SYSTEM, JSON.stringify(stats), 4000);
      return validSummary(text, stats) ? send(res, 200, { text }) : send(res, 422, { error: 'invalid reply' });
    }
    return send(res, 404, { error: 'not found' });
  } catch (err) {
    return send(res, 502, { error: err instanceof Error ? err.message : 'upstream error' });
  }
}
