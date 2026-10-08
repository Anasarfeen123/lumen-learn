// Builds the concrete content of one game item from a word and a game level
// (references/03-games.md).
import { shuffle, type Rng } from './random';
import type { Word } from './types';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const CONFUSABLE_PAIRS: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p', m: 'w', w: 'm', n: 'u', u: 'n' };
const DIGRAPHS = ['sh', 'ch', 'th', 'ph', 'wh', 'kn', 'qu', 'ck'];

export function optionCount(level: number): number {
  return level >= 4 ? 4 : 3;
}

function sortedLetters(s: string): string {
  return s.split('').sort().join('');
}

/** "Obvious" misspellings: an anagram of the word, or one letter shorter. */
export function isObvious(word: string, miss: string): boolean {
  return sortedLetters(word) === sortedLetters(miss) || miss.length === word.length - 1;
}

/** Same length, one substitution that is a look-alike letter or a vowel swap. */
export function isClose(word: string, miss: string): boolean {
  if (word.length !== miss.length) {
    // A vowel or letter doubled/dropped inside a vowel team still counts as close.
    return Math.abs(word.length - miss.length) === 1 && !isObvious(word, miss);
  }
  const diffs: [string, string][] = [];
  for (let i = 0; i < word.length; i++) if (word[i] !== miss[i]) diffs.push([word[i], miss[i]]);
  return diffs.length >= 1 && diffs.length <= 2 && diffs.every(
    ([a, b]) => CONFUSABLE_PAIRS[a] === b || (VOWELS.has(a) && VOWELS.has(b)),
  );
}

/** Prefer items matching `prefer`, then fill from the rest, keeping `count` items. */
function preferred<T>(items: T[], prefer: (t: T) => boolean, count: number, rng: Rng): T[] {
  const yes = shuffle(items.filter(prefer), rng);
  const no = shuffle(items.filter((t) => !prefer(t)), rng);
  return [...yes, ...no].slice(0, count);
}

export function detectiveDistractors(word: Word, level: number, rng: Rng = Math.random): string[] {
  const n = optionCount(level) - 1;
  const ms = word.misspellings;
  if (level <= 1) return preferred(ms, (m) => isObvious(word.word, m), n, rng);
  if (level === 2) return shuffle(ms, rng).slice(0, n);
  return preferred(ms, (m) => isClose(word.word, m), n, rng);
}

/** Sound-alike that differs only in its first sound: ship / chip, cat / hat. */
export function differsInFirstSound(word: string, alike: string): boolean {
  const head = (s: string) => DIGRAPHS.find((d) => s.startsWith(d)) ?? s[0];
  return word.slice(head(word).length) === alike.slice(head(alike).length) && head(word) !== head(alike);
}

/** Sound-alike that differs only in its vowels: ship / sheep. */
export function differsInVowel(word: string, alike: string): boolean {
  const skeleton = (s: string) => s.replace(/[aeiou]+/g, '_');
  return word !== alike && skeleton(word) === skeleton(alike);
}

export function soundDistractors(word: Word, level: number, rng: Rng = Math.random): string[] {
  const n = optionCount(level) - 1;
  const sa = word.soundAlikes;
  if (level <= 1) return preferred(sa, (a) => differsInFirstSound(word.word, a), n, rng);
  if (level === 3) return preferred(sa, (a) => differsInVowel(word.word, a), n, rng);
  return shuffle(sa, rng).slice(0, n);
}

/**
 * Shuffle answer + distractors, making sure the answer doesn't sit in the same
 * position more than twice in a row.
 */
export function arrangeOptions(answer: string, distractors: string[], lastPositions: number[], rng: Rng = Math.random): string[] {
  const all = [answer, ...distractors];
  const banned = lastPositions.length >= 2 && lastPositions.at(-1) === lastPositions.at(-2) ? lastPositions.at(-1) : undefined;
  for (let attempt = 0; attempt < 20; attempt++) {
    const order = shuffle(all, rng);
    if (order.indexOf(answer) !== banned) return order;
  }
  const order = shuffle(distractors, rng);
  const pos = banned === 0 ? 1 : 0;
  order.splice(pos, 0, answer);
  return order;
}

/** First letter group for the Sound Match hint: "sh" for ship, "c" for cat. */
export function firstSound(word: string): string {
  return DIGRAPHS.find((d) => word.startsWith(d)) ?? word[0];
}

/** A spoken stand-in for a letter group's sound (speech engines read single letters as names). */
const SOUND_SAY: Record<string, string> = {
  b: 'buh', c: 'kuh', d: 'duh', f: 'fff', g: 'guh', h: 'huh', j: 'juh', k: 'kuh', l: 'lll', m: 'mmm',
  n: 'nnn', p: 'puh', r: 'rrr', s: 'sss', t: 'tuh', v: 'vvv', w: 'wuh', y: 'yuh', z: 'zzz',
  a: 'ah', e: 'eh', i: 'ih', o: 'oh', u: 'uh',
  sh: 'shh', ch: 'ch', th: 'thh', ph: 'fff', wh: 'wuh', kn: 'nnn', qu: 'kw', ck: 'kuh',
};

export function sayableSound(group: string): string {
  return SOUND_SAY[group] ?? group;
}

// ---------------------------------------------------------------- Word Builder

export interface Tile {
  id: string;
  text: string;
  decoy: boolean;
}

/** The pieces the word is built from: letters, or syllable chunks for long words at low levels. */
export function builderUnits(word: Word, level: number): string[] {
  const n = word.word.length;
  const useSyllables =
    word.syllables.length > 1 &&
    ((level <= 1 && n > 5) || (level === 2 && n > 6) || (level === 3 && n > 7));
  return useSyllables ? word.syllables.slice() : word.word.split('');
}

export function decoyCount(level: number): number {
  return level >= 5 ? 2 : level === 4 ? 1 : 0;
}

/** Confusable decoys: b for d, p for q, then an extra vowel. */
export function decoys(word: string, count: number, rng: Rng = Math.random): string[] {
  const out: string[] = [];
  for (const ch of shuffle(word.split(''), rng)) {
    const twin = CONFUSABLE_PAIRS[ch];
    if (out.length < count && twin && !word.includes(twin) && !out.includes(twin)) out.push(twin);
  }
  for (const v of shuffle(['a', 'e', 'i', 'o', 'u'], rng)) {
    if (out.length < count && !out.includes(v) && !word.includes(v)) out.push(v);
  }
  return out;
}

function positionsDiffer(a: string[], b: string[]): number {
  return a.reduce((n, t, i) => n + (t !== b[i] ? 1 : 0), 0);
}

/** Shuffle until at least half the positions differ from the answer. Never in order. */
export function scramble(units: string[], rng: Rng = Math.random): string[] {
  if (units.length < 2) return units.slice();
  const need = Math.ceil(units.length / 2);
  let best = units.slice();
  for (let attempt = 0; attempt < 50; attempt++) {
    const s = shuffle(units, rng);
    if (positionsDiffer(s, units) >= need) return s;
    if (positionsDiffer(s, units) > positionsDiffer(best, units)) best = s;
  }
  // Every unit identical (e.g. "aa") is the only way to get here; rotate as a last resort.
  return best.length && positionsDiffer(best, units) ? best : [...units.slice(1), units[0]];
}

export function builderTiles(word: Word, level: number, rng: Rng = Math.random): { units: string[]; tiles: Tile[] } {
  const units = builderUnits(word, level);
  const extra = units.every((u) => u.length === 1) ? decoys(word.word, decoyCount(level), rng) : [];
  const order = scramble(units, rng);
  // Decoys go in at random positions, so they don't always sit at the end.
  const texts = order.slice();
  for (const d of extra) texts.splice(Math.floor(rng() * (texts.length + 1)), 0, d);
  // Decoy letters never appear in the word itself, so text alone identifies them.
  const tiles = texts.map((text, i) => ({ id: `t${i}`, text, decoy: extra.includes(text) }));
  return { units, tiles };
}
