import raw from '../data/words.json';
import { LENGTH_TAGS } from './tags';
import type { Tag, Word } from './types';

function lengthTag(word: string): Tag {
  const n = word.length;
  return n <= 4 ? 'short' : n <= 6 ? 'medium' : 'long';
}

/** Returns the list of problems with a word entry; empty means it is safe to show. */
export function checkWord(w: Word): string[] {
  const problems: string[] = [];
  if (w.syllables.join('') !== w.word) problems.push('syllables do not join to the word');
  const lengths = w.tags.filter((t) => LENGTH_TAGS.includes(t));
  if (lengths.length !== 1) problems.push('needs exactly one length tag');
  else if (lengths[0] !== lengthTag(w.word)) problems.push(`length tag should be ${lengthTag(w.word)}`);
  if (w.tags.includes('multi') !== w.syllables.length > 1) problems.push('multi tag must match syllable count');
  if (w.tags.length < 1 || w.tags.length > 4) problems.push('needs 1 to 4 tags');
  if (w.misspellings.includes(w.word)) problems.push('a misspelling equals the word');
  if (w.misspellings.some((m) => w.soundAlikes.includes(m))) problems.push('a misspelling is also a sound-alike');
  if (w.soundAlikes.includes(w.word)) problems.push('a sound-alike equals the word');
  if (w.misspellings.length < 3) problems.push('needs at least 3 misspellings');
  if (w.soundAlikes.length < 3) problems.push('needs at least 3 sound-alikes');
  if (new Set(w.misspellings).size !== w.misspellings.length) problems.push('duplicate misspellings');
  if (w.level < 1 || w.level > 5) problems.push('level must be 1 to 5');
  return problems;
}

/** Validates a raw bank. Failing words are skipped and logged, never shown. */
export function loadBank(entries: Word[], log: (msg: string) => void = console.warn): Word[] {
  const seen = new Set<string>();
  return entries.filter((w) => {
    const problems = checkWord(w);
    if (seen.has(w.id)) problems.push('duplicate id');
    seen.add(w.id);
    if (problems.length) log(`[lumen] skipped word "${w.id}": ${problems.join('; ')}`);
    return problems.length === 0;
  });
}

export const BANK: Word[] = loadBank(raw as Word[]);
export const BY_ID: Map<string, Word> = new Map(BANK.map((w) => [w.id, w]));
