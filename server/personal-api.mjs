// Lumo's personalisation: a daily plan and stories written for one learner.
//
//   POST /api/personal/plan   { interests, weak, strong, mistakes, goalMinutes, minutesToday, candidates } -> Plan
//   POST /api/personal/story  { interest, words, level }                                                -> { story }
//   POST /api/personal/story/:id/feedback { feeling: 'loved' | 'ok' | 'not-for-me' }                    -> 204
//
// What is sent to the AI: interest topics, skill tags, and words from Lumen's
// own word bank. Never the learner's name, email, or anything they uploaded.
// The AI may only choose from the candidates the app offers; every reply is
// checked, and a rule-based plan is always there when the AI isn't.
import { randomBytes } from 'node:crypto';
import { chatJson } from './lumo-api.mjs';
import { currentUser } from './account-api.mjs';
import { openDb, now } from './db.mjs';

export const INTERESTS = {
  animals: 'animals and pets', space: 'space and planets', dinosaurs: 'dinosaurs', ocean: 'the ocean and sea creatures',
  sport: 'sport and games outside', food: 'cooking and food', music: 'music and dancing', robots: 'robots and inventions',
  art: 'drawing and making things', nature: 'trees, plants and bugs', vehicles: 'trains, boats and rockets', magic: 'dragons and magic',
};

const SKILL_WORDS = {
  short: 'short words', medium: 'medium words', long: 'long words', multi: 'words with more than one beat',
  irregular: 'tricky words', digraph: 'letter pairs like sh and ch', blend: 'blends like st and fr',
  'vowel-team': 'vowel teams like ai and oa', confusable: 'look-alike letters like b and d', silent: 'silent letters',
};

const BANNED = ['dyslexia', 'dyslexic', 'disorder', 'diagnosis', 'behind', 'fail', 'failure', 'stupid', 'lazy', 'wrong', 'bad', 'test', 'score',
  'blood', 'kill', 'die', 'dead', 'death', 'gun', 'weapon', 'scary', 'monster', 'hate', 'fight', 'hurt', 'cry', 'lost forever'];

const words = (t) => String(t).trim().split(/\s+/).filter(Boolean);
const hasBanned = (t) => {
  const lower = String(t).toLowerCase();
  return BANNED.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
};
const clean = (t) => (typeof t === 'string' ? t.trim().replace(/\s+/g, ' ') : '');
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const list = (v, max = 12, len = 30) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.slice(0, len)).slice(0, max) : []);

// ------------------------------------------------------------------ plan

/** Plan choices the app offers; the AI may only pick from these ids. */
function cleanCandidates(c) {
  return (Array.isArray(c) ? c : []).slice(0, 24).filter((x) => x && typeof x.id === 'string' && typeof x.label === 'string')
    .map((x) => ({ id: x.id.slice(0, 60), label: x.label.slice(0, 60), kind: ['game', 'activity', 'story', 'practice', 'lumo-story'].includes(x.kind) ? x.kind : 'game', skill: str(x.skill, 20), topic: str(x.topic, 30) }));
}

/** The plan without AI: practise the weakest skill, fix mistakes, then read something on a favourite topic. */
export function rulePlan(input) {
  const { candidates, weak, interests, mistakes } = input;
  const pick = [];
  const take = (pred) => {
    const c = candidates.find((x) => pred(x) && !pick.some((p) => p.id === x.id));
    if (c) pick.push(c);
    return c;
  };
  const focus = weak[0] ?? null;
  if (mistakes.length) take((c) => c.kind === 'practice');
  if (focus) take((c) => (c.kind === 'game' || c.kind === 'activity') && c.skill === focus);
  take((c) => (c.kind === 'story' || c.kind === 'lumo-story') && interests.some((i) => c.topic?.toLowerCase().includes(i)));
  take((c) => c.kind === 'story' || c.kind === 'lumo-story');
  take((c) => c.kind === 'game' || c.kind === 'activity');
  const why = (c) => c.kind === 'practice' ? 'A few words to try again, now that you know them better.'
    : c.kind === 'story' || c.kind === 'lumo-story' ? (interests.some((i) => c.topic?.toLowerCase().includes(i)) ? 'A story about something you like.' : 'A calm story to read at your own pace.')
    : focus && c.skill === focus ? `Practice for ${SKILL_WORDS[focus]}.` : 'A short round to keep your skills warm.';
  return {
    greeting: focus ? `Today let's work on ${SKILL_WORDS[focus]}, one small step at a time.` : "Here's a calm plan for today. Pick any step you like.",
    focus,
    steps: pick.slice(0, 3).map((c) => ({ id: c.id, why: why(c) })),
    source: 'rules',
  };
}

export function validPlan(plan, candidates) {
  if (!plan || typeof plan !== 'object') return false;
  const greeting = clean(plan.greeting);
  if (!greeting || words(greeting).length > 18 || /\d/.test(greeting) || hasBanned(greeting)) return false;
  if (!Array.isArray(plan.steps) || plan.steps.length < 2 || plan.steps.length > 3) return false;
  const ids = new Set();
  for (const s of plan.steps) {
    if (!s || !candidates.some((c) => c.id === s.id) || ids.has(s.id)) return false;
    ids.add(s.id);
    const why = clean(s.why);
    if (!why || words(why).length > 16 || /\d/.test(why) || hasBanned(why)) return false;
  }
  return true;
}

const PLAN_SYSTEM = `You are Lumo, a warm learning buddy in a reading app for children who learn differently.
Choose today's plan: 2 or 3 steps, picked ONLY from "candidates" by their exact "id".
Guidance: start with something the learner can do well or something they like, put at most one step for the "weak" skills,
include "practice" when there are mistakes to revisit, and include a story that matches an interest when one exists.
Write a "greeting" (max 16 words) and for each step a "why" (max 14 words), addressed to the learner as "you".
Plain, calm, kind words. No numbers, no names, no mention of tests, scores, difficulty labels or conditions.
Reply as JSON: {"greeting": string, "steps": [{"id": string, "why": string}]}`;

// ------------------------------------------------------------------ story

const LEVEL_RULES = {
  1: { maxWords: 8, sentences: [5, 8], note: 'very short sentences, mostly one-beat words' },
  2: { maxWords: 10, sentences: [6, 9], note: 'short sentences, simple words' },
  3: { maxWords: 12, sentences: [7, 10], note: 'short sentences, a few longer words' },
  4: { maxWords: 14, sentences: [8, 12], note: 'clear sentences, some longer words' },
  5: { maxWords: 16, sentences: [8, 12], note: 'clear sentences, varied words' },
};

const sentencesOf = (text) => (String(text).match(/[^.!?]+[.!?]+["”’]?/g) ?? []).map((s) => s.trim()).filter(Boolean);

export function validStory(story, { words: focus, level }) {
  if (!story || typeof story !== 'object') return { ok: false, why: 'shape' };
  const title = clean(story.title);
  const text = String(story.text ?? '').trim();
  const rules = LEVEL_RULES[level] ?? LEVEL_RULES[2];
  if (!title || words(title).length > 6 || hasBanned(title)) return { ok: false, why: 'title' };
  if (/\d/.test(text) || hasBanned(text)) return { ok: false, why: 'words' };
  const sentences = sentencesOf(text);
  if (sentences.length < rules.sentences[0] || sentences.length > rules.sentences[1]) return { ok: false, why: 'length' };
  if (sentences.some((s) => words(s).length > rules.maxWords + 2)) return { ok: false, why: 'sentence too long' };
  const lower = text.toLowerCase();
  const used = focus.filter((w) => new RegExp(`\\b${w.toLowerCase()}s?\\b`).test(lower));
  if (focus.length && used.length < Math.min(3, focus.length)) return { ok: false, why: 'focus words' };
  return { ok: true, title, sentences, used };
}

const STORY_SYSTEM = `You write short, gentle stories for a reading app used by children who learn differently.
Rules: present tense or simple past, everyday words, one clear idea per sentence, no names of real people,
nothing scary or sad, no numbers written as digits. Use the given "words" naturally (at least three of them).
Characters can be animals or children with simple names like Sam, Ava or Pip. End on a happy, calm note.
Reply as JSON: {"title": string (max 5 words), "text": string (the story; sentences separated by spaces)}.`;

/** Lay sentences out as pages of short paragraphs, like the bundled stories. */
function toPages(sentences) {
  const pages = [];
  for (let i = 0; i < sentences.length; i += 4) {
    const chunk = sentences.slice(i, i + 4);
    pages.push([chunk.slice(0, 2).join(' '), chunk.slice(2).join(' ')].filter(Boolean).join('\n\n'));
  }
  return pages;
}

const COVER = { animals: 'dog', space: 'rocket', dinosaurs: 'dinosaur', ocean: 'whale', sport: 'flag', food: 'pizza', music: 'drum', robots: 'robot', art: 'pencil', nature: 'tree', vehicles: 'train', magic: 'dragon' };

// ------------------------------------------------------------------ http

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('cache-control', 'no-store');
  if (body === undefined) return res.end();
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 64_000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const hasKey = () => Boolean(process.env.GROQ_API_KEY);

export async function personalApi(req, res, next) {
  const path = (req.url || '').split('?')[0];
  if (!path.startsWith('/api/personal/')) return next ? next() : undefined;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (req.headers['x-lumen'] !== '1') return send(res, 403, { error: 'missing x-lumen header' });
  try {
    const body = await readJson(req);

    if (path === '/api/personal/plan') {
      const input = {
        interests: list(body.interests).filter((i) => INTERESTS[i]),
        weak: list(body.weak, 4).filter((t) => SKILL_WORDS[t]),
        strong: list(body.strong, 4).filter((t) => SKILL_WORDS[t]),
        mistakes: list(body.mistakes, 8),
        candidates: cleanCandidates(body.candidates),
      };
      if (!input.candidates.length) return send(res, 400, { error: 'candidates required' });
      const fallback = rulePlan(input);
      if (!hasKey()) return send(res, 200, fallback);
      try {
        const ask = {
          likes: input.interests.map((i) => INTERESTS[i]),
          weak: input.weak.map((t) => SKILL_WORDS[t]),
          strong: input.strong.map((t) => SKILL_WORDS[t]),
          mistakesToRevisit: input.mistakes.length,
          candidates: input.candidates.map(({ id, label, kind, skill, topic }) => ({ id, label, kind, skill: SKILL_WORDS[skill] ?? undefined, topic: topic || undefined })),
        };
        const out = await chatJson(PLAN_SYSTEM, JSON.stringify(ask), 6000, 300);
        if (validPlan(out, input.candidates)) {
          return send(res, 200, { greeting: clean(out.greeting), focus: fallback.focus, steps: out.steps.map((s) => ({ id: s.id, why: clean(s.why) })), source: 'ai' });
        }
      } catch { /* fall through to the rule-based plan */ }
      return send(res, 200, fallback);
    }

    if (path === '/api/personal/story') {
      if (!hasKey()) return send(res, 503, { error: "Lumo's story writer needs the AI to be set up (GROQ_API_KEY)." });
      const interest = INTERESTS[body.interest] ? body.interest : 'animals';
      const level = Math.min(5, Math.max(1, Math.round(Number(body.level) || 2)));
      const focus = list(body.words, 6, 20).filter((w) => /^[a-z]+$/i.test(w)).map((w) => w.toLowerCase());
      const rules = LEVEL_RULES[level];
      const ask = JSON.stringify({ topic: INTERESTS[interest], words: focus, sentences: `${rules.sentences[0]} to ${rules.sentences[1]}`, maxWordsPerSentence: rules.maxWords, style: rules.note });
      let check = { ok: false };
      for (let attempt = 0; attempt < 2 && !check.ok; attempt++) {
        try {
          const out = await chatJson(STORY_SYSTEM, ask, 12000, 600);
          check = validStory(out, { words: focus, level });
        } catch { /* try once more */ }
      }
      if (!check.ok) return send(res, 422, { error: "Lumo couldn't write a story that's just right this time. Please try again." });
      const story = {
        id: `lumo-${randomBytes(6).toString('base64url')}`,
        title: check.title,
        summary: `A story about ${INTERESTS[interest]}, written by Lumo for you.`,
        topic: interest, level, cover: COVER[interest] ?? 'stack of books',
        pages: toPages(check.sentences), focusWords: check.used, createdAt: now(), feeling: null,
      };
      const user = currentUser(req);
      if (user) openDb().prepare('INSERT INTO stories (id, user_id, data, created_at) VALUES (?, ?, ?, ?)').run(story.id, user.id, JSON.stringify(story), story.createdAt);
      return send(res, 200, { story, saved: Boolean(user) });
    }

    const fb = path.match(/^\/api\/personal\/story\/([\w-]+)\/feedback$/);
    if (fb) {
      const feeling = ['loved', 'ok', 'not-for-me'].includes(body.feeling) ? body.feeling : null;
      const user = currentUser(req);
      if (!user) return send(res, 204);
      const row = openDb().prepare('SELECT data FROM stories WHERE id = ? AND user_id = ?').get(fb[1], user.id);
      if (!row) return send(res, 404, { error: 'not found' });
      const data = { ...JSON.parse(row.data), feeling };
      openDb().prepare('UPDATE stories SET data = ? WHERE id = ? AND user_id = ?').run(JSON.stringify(data), fb[1], user.id);
      return send(res, 204);
    }

    return send(res, 404, { error: 'not found' });
  } catch {
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
