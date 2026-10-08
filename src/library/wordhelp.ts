// Word help for the reader: the local dictionary first (every story word,
// explained in its sentence), then a cached AI explanation for anything else,
// and an honest "no explanation yet" when neither is available.
import dictionary from './dictionary.json';
import { normalizeWord } from './segment';
import { BANK } from '../engine/wordbank';
import { PICTURES, pictureFor } from '../data/pictures';
import emojiIcons from './emojiIcons.json';

export interface WordHelp {
  word: string;
  meaning: string | null;
  example: string | null;
  emoji: string | null;
  /** An illustration (Fluent 3D) that shows the meaning, when one fits. Shown instead of an emoji. */
  icon: string | null;
  /** Where the explanation came from, shown to grown-ups. */
  source: 'dictionary' | 'reviewed' | 'ai' | 'none';
  /** Why there's no explanation, when there isn't one. */
  reason?: string;
}

interface Entry { meaning: string; example?: string; emoji?: string; source?: string }
const ENTRIES = (dictionary as { entries: Record<string, Entry> }).entries;
const API = import.meta.env.VITE_LUMO_API ?? '/api/lumo';
const CACHE_KEY = 'lumen.wordhelp.v1';

/** Picture emoji for bank words (e.g. "fox"), used when the explanation has none. */
const BANK_EMOJI = new Map(BANK.filter((w) => w.picture && PICTURES[w.picture]).map((w) => [w.word, PICTURES[w.picture!].emoji]));

function cached(): Record<string, Entry> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); } catch { return {}; }
}

function remember(key: string, e: Entry) {
  try {
    const all = cached();
    all[key] = e;
    // Keep the cache small: the most recent 400 explanations.
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete all[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch { /* storage full or blocked */ }
}

const ICONS = emojiIcons as Record<string, string>;
const BANK_PICTURE = new Map(BANK.filter((w) => w.picture).map((w) => [w.word, w.picture!]));

/** The word's own bank illustration first, then the illustration for its emoji, else nothing. */
export function iconFor(word: string, emoji: string | null): string | null {
  const own = BANK_PICTURE.get(normalizeWord(word));
  if (own) return pictureFor(own)?.src ?? null;
  const file = emoji ? ICONS[emoji] ?? ICONS[emoji.replace(/\uFE0F/g, '')] : null;
  return file ? `${import.meta.env.BASE_URL}pictures/${file}` : null;
}

function toHelp(word: string, e: Entry, source: WordHelp['source']): WordHelp {
  const key = normalizeWord(word);
  const emoji = e.emoji || BANK_EMOJI.get(key) || null;
  return { word, meaning: e.meaning, example: e.example || null, emoji, icon: iconFor(word, emoji), source };
}

/** Instant answer from local content, if there is one. */
export function localHelp(word: string): WordHelp | null {
  const key = normalizeWord(word);
  const e = ENTRIES[key];
  if (e) return toHelp(word, e, e.source === 'reviewed' ? 'reviewed' : 'dictionary');
  return null;
}

export async function getWordHelp(word: string, sentence: string): Promise<WordHelp> {
  const local = localHelp(word);
  if (local) return local;
  const key = `${normalizeWord(word)}|${sentence.toLowerCase().slice(0, 120)}`;
  const hit = cached()[key];
  if (hit) return toHelp(word, hit, 'ai');
  if (API === 'off') return { word, meaning: null, example: null, emoji: null, icon: iconFor(word, null), source: 'none', reason: 'offline' };
  try {
    const res = await fetch(`${API}/explain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word: word.replace(/’/g, "'"), sentence }),
      signal: AbortSignal.timeout(7000),
    });
    if (res.status === 200) {
      const e = (await res.json()) as Entry;
      remember(key, e);
      return toHelp(word, e, 'ai');
    }
    const reason = res.status === 204 ? 'no-ai' : res.status === 429 ? 'busy' : 'failed';
    return { word, meaning: null, example: null, emoji: null, icon: iconFor(word, null), source: 'none', reason };
  } catch {
    return { word, meaning: null, example: null, emoji: null, icon: iconFor(word, null), source: 'none', reason: 'failed' };
  }
}

export function forgetWordHelp() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* nothing to clear */ }
}
