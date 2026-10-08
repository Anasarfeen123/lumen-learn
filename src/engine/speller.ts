// Syllable Speller: an Orton-Gillingham style activity. Words from one family
// (-tion, -ture, -ble, closed syllables) are spelled beat by beat into syllable
// boxes, with worked examples above and the shared ending given.
import raw from '../data/families.json';
import { ROUND_SIZE, weakness, type LearnerState } from './adaptive';
import { shuffle, weightedPick, type Rng } from './random';
import { LENGTH_TAGS } from './tags';
import type { Tag, Word } from './types';

export interface Family {
  id: string;
  label: string;
  /** The shared ending, pre-filled at levels 1–4; null for families without one. */
  given: string | null;
  words: Word[];
}

interface RawFamily {
  id: string;
  label: string;
  given: string | null;
  words: { word: string; syllables: string[]; level: number; tags: string[]; say?: string[] }[];
}

/**
 * Speech engines read syllable fragments badly ("ac" as "A C", "tion" as
 * "tee-on"), so each syllable has a spoken form. Words can override it
 * where a vowel is reduced (sig-NUH-ture).
 */
const SAY: Record<string, string> = {
  tion: 'shun', ture: 'cher', ble: 'bull',
  ac: 'ack', lec: 'leck', rec: 'reck', frac: 'frack', ad: 'add', pic: 'pick', nic: 'nick', tic: 'tick',
  bas: 'bass', ket: 'kit', tas: 'tass', pos: 'poss', com: 'cum', ed: 'id',
  va: 'vay', ca: 'kay', na: 'nay', la: 'lay', ta: 'tay', sta: 'stay', re: 'ree', e: 'ee', mo: 'moe', lo: 'low',
  fu: 'few', u: 'you', crea: 'cree', di: 'dih', ni: 'nih', si: 'sih', ri: 'rih', ter: 'tair', a: 'uh',
};

const sayOverrides = new Map<string, string[]>();

/** How to pronounce each syllable of a family word, for slow beat-by-beat speech. */
export function spokenSyllables(word: Word): string[] {
  return sayOverrides.get(word.id) ?? word.syllables.map((s) => SAY[s] ?? s);
}

function lengthTag(n: number): Tag {
  return n <= 4 ? 'short' : n <= 6 ? 'medium' : 'long';
}

export function checkFamilyWord(w: Word, given: string | null): string[] {
  const problems: string[] = [];
  if (w.syllables.join('') !== w.word) problems.push('syllables do not join to the word');
  if (w.syllables.length < 2) problems.push('needs 2 or more syllables');
  if (given && w.syllables.at(-1) !== given) problems.push(`last syllable should be "${given}"`);
  const lengths = w.tags.filter((t) => LENGTH_TAGS.includes(t));
  if (lengths.length !== 1 || lengths[0] !== lengthTag(w.word.length)) problems.push('wrong length tag');
  if (!w.tags.includes('multi')) problems.push('needs the multi tag');
  if (w.tags.length > 4) problems.push('at most 4 tags');
  if (!/^[a-z]+$/.test(w.word)) problems.push('lowercase letters only');
  return problems;
}

export function loadFamilies(data: RawFamily[], log: (m: string) => void = console.warn): Family[] {
  return data.map((f) => ({
    id: f.id,
    label: f.label,
    given: f.given,
    words: f.words
      .map((w): Word => {
        const id = `${f.id}:${w.word}`;
        if (w.say?.length === w.syllables.length) sayOverrides.set(id, w.say);
        return {
          id,
          word: w.word,
          level: w.level,
          syllables: w.syllables,
          tags: w.tags as Tag[],
          picture: null,
          misspellings: [],
          soundAlikes: [],
          family: f.id,
        };
      })
      .filter((w) => {
        const problems = checkFamilyWord(w, f.given);
        if (problems.length) log(`[lumen] skipped speller word "${w.word}": ${problems.join('; ')}`);
        return problems.length === 0;
      }),
  }));
}

export const FAMILIES: Family[] = loadFamilies(raw as RawFamily[]);
export const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));

/** Words close to level L: L and L-1 first, then the nearest levels, so a round always fills. */
function nearLevel(words: Word[], level: number): Word[] {
  const dist = (w: Word) => (w.level === level || w.level === level - 1 ? 0 : Math.abs(w.level - level));
  return words.slice().sort((a, b) => dist(a) - dist(b));
}

/** The family to practise: leans toward families whose words have weaker tags. */
export function pickFamily(state: LearnerState, rng: Rng = Math.random, avoid?: string): Family {
  const options = FAMILIES.filter((f) => f.id !== avoid && f.words.length >= ROUND_SIZE + 2);
  const avg = (f: Family) => f.words.reduce((s, w) => s + weakness(state.mastery, w), 0) / f.words.length;
  return weightedPick(options, (f) => 1 + 2 * avg(f), rng);
}

export interface SpellerRound {
  family: Family;
  words: Word[];
  /** Worked examples shown above the first word. */
  examples: Word[];
}

export function pickSpellerRound(state: LearnerState, rng: Rng = Math.random): SpellerRound {
  const level = state.gameLevels.speller ?? 1;
  const lastFamily = state.recentWords.findLast((id) => id.includes(':'))?.split(':')[0];
  const family = pickFamily(state, rng, lastFamily);
  const fresh = family.words.filter((w) => !state.recentWords.includes(w.id));
  const pool = nearLevel(fresh.length >= ROUND_SIZE ? fresh : family.words, level);
  // Take the closest-level words, then order easiest first so the round warms up.
  const words = shuffle(pool.slice(0, ROUND_SIZE + 1), rng).slice(0, ROUND_SIZE).sort((a, b) => a.level - b.level);
  const examples = family.words
    .filter((w) => !words.includes(w))
    .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level) || a.level - b.level)
    .slice(0, 2);
  return { family, words, examples };
}

/** Rescue rule: an easier word from the same family. */
export function spellerRescue(round: Word[], index: number): Word | undefined {
  const family = FAMILY_BY_ID.get(round[index]?.family ?? '');
  if (!family) return undefined;
  const target = round[index].level - 1;
  return family.words
    .filter((w) => !round.includes(w) && w.level <= Math.max(1, target))
    .sort((a, b) => b.level - a.level)[0];
}

/** Which syllables come pre-filled. Levels 1–4 give the family's ending; level 5 gives nothing. */
export function givenSyllables(word: Word, level: number, given: string | null): boolean[] {
  return word.syllables.map((s, i) => level < 5 && given !== null && i === word.syllables.length - 1 && s === given);
}

/** Worked examples are hidden at level 5. */
export function showExamples(level: number): boolean {
  return level < 5;
}
