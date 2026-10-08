// Client for Lumo's AI endpoints. Only bank words, tags and aggregate numbers
// are ever sent: never the learner's name, never anything the learner typed.
// Templates always show first; an AI reply replaces them only if it arrives
// in time and passes the same checks the server runs.
import type { GameId, Tag } from '../engine/types';

const INSIGHT_BANNED = ['wrong', 'bad', 'fail', 'easy', 'dyslexia', 'dyslexic', 'disorder', 'test', 'score', 'problem', 'stupid', 'slow'];
const SUMMARY_BANNED = ['dyslexia', 'dyslexic', 'disorder', 'diagnosis', 'behind', 'below average', 'fail', 'struggle', 'score', 'percent', 'lazy'];

function hasBanned(text: string, banned: string[]): boolean {
  const lower = text.toLowerCase();
  return banned.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
}
const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const lettersOnly = (t: string) => t.toLowerCase().replace(/[^a-z]/g, '');

export function validInsight(text: string): boolean {
  return text.trim().length > 0 && wordCount(text) <= 14 && !/\d/.test(text) && !hasBanned(text, INSIGHT_BANNED);
}

/** A hint may point at sounds and letters, but must never give the answer away. */
export function validTip(text: string, word: string, options: string[] = []): boolean {
  if (!text.trim() || wordCount(text) > 18 || /\d/.test(text) || hasBanned(text, INSIGHT_BANNED)) return false;
  // Vowel-length labels are where models get phonics wrong; the built-in hint is safer.
  if (/\b(short|long)\b/i.test(text)) return false;
  const lower = text.toLowerCase();
  if ([word, ...options].some((w) => w && new RegExp(`\\b${w.toLowerCase()}\\b`).test(lower))) return false;
  return word.length < 3 || !lettersOnly(text).includes(lettersOnly(word));
}

export function validSummary(text: string, stats: unknown): boolean {
  if (!text.trim()) return false;
  const sentences = text.split(/[.!?]+(\s|$)/).filter((s) => s && s.trim());
  if (sentences.length > 5 || hasBanned(text, SUMMARY_BANNED)) return false;
  const allowed = new Set(JSON.stringify(stats).match(/\d+/g) ?? []);
  return (text.match(/\d+/g) ?? []).every((n) => allowed.has(n));
}

export interface Idea {
  title: string;
  how: string;
}

export function validIdeas(ideas: unknown): ideas is Idea[] {
  return Array.isArray(ideas) && ideas.length >= 1 && ideas.length <= 3 && ideas.every((i) =>
    i && typeof i.title === 'string' && typeof i.how === 'string' && i.title && i.how &&
    wordCount(i.title) <= 7 && wordCount(i.how) <= 35 &&
    !/\d/.test(i.title + i.how) && !hasBanned(`${i.title} ${i.how}`, SUMMARY_BANNED));
}

// Static hosting (e.g. GitHub Pages) has no server: build with VITE_LUMO_API=off.
const API = import.meta.env.VITE_LUMO_API ?? '/api/lumo';

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T | null> {
  if (API === 'off') return null;
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 200) return null; // 204: AI not configured; use the template
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Rephrase a template insight in Lumo's voice, or null to keep the template. */
export async function rephraseInsight(template: string, context: Record<string, unknown>): Promise<string | null> {
  const r = await post<{ text?: string }>('/insight', { template, context }, 3000);
  const text = r?.text?.trim();
  return text && validInsight(text) ? text : null;
}

export interface TipRequest {
  game: GameId;
  word: string;
  syllables: string[];
  options?: string[];
  tags: Tag[];
}

const tips = new Map<string, Promise<string | null>>();

/**
 * A hint written for this exact word and these options. Requested when the
 * item appears, so it's ready the moment the learner needs it.
 */
export function getTip(req: TipRequest): Promise<string | null> {
  const key = JSON.stringify(req);
  let p = tips.get(key);
  if (!p) {
    p = post<{ text?: string }>('/tip', req, 4000).then((r) => {
      const text = r?.text?.trim();
      return text && validTip(text, req.word, req.options) ? text : null;
    });
    tips.set(key, p);
  }
  return p;
}

/** Weekly grown-up summary from aggregate stats. `{name}` is filled in on the device. */
export async function writeSummary(stats: object): Promise<string | null> {
  const r = await post<{ text?: string }>('/summary', { stats }, 5000);
  const text = r?.text?.trim();
  return text && validSummary(text, stats) ? text : null;
}

/** Two or three playful offline activities for grown-ups, based on what's tricky. */
export async function suggestIdeas(stats: object): Promise<Idea[] | null> {
  const r = await post<{ ideas?: unknown }>('/ideas', { stats }, 6000);
  return r && validIdeas(r.ideas) ? r.ideas : null;
}
