import { describe, expect, it } from 'vitest';
import raw from '../data/families.json';
import { FAMILIES, checkFamilyWord, givenSyllables, loadFamilies, pickSpellerRound, showExamples, spellerRescue, spokenSyllables } from './speller';
import { ROUND_SIZE, recommendGame, type LearnerState } from './adaptive';
import { seeded } from './random';

const state = (level: number, recentWords: string[] = []): LearnerState => ({
  mastery: {},
  gameLevels: { detective: 1, sound: 1, builder: 1, speller: level },
  recentWords,
});

describe('word families', () => {
  it('every family word passes its checks', () => {
    for (const f of raw) {
      for (const w of f.words) {
        const word = { id: w.word, word: w.word, level: w.level, syllables: w.syllables, tags: w.tags, picture: null, misspellings: [], soundAlikes: [] } as never;
        expect(checkFamilyWord(word, f.given), `${f.id}:${w.word}`).toEqual([]);
        if ('say' in w) expect((w as { say: string[] }).say).toHaveLength(w.syllables.length);
      }
    }
    expect(FAMILIES.reduce((n, f) => n + f.words.length, 0)).toBe(raw.reduce((n, f) => n + f.words.length, 0));
  });

  it('every family has enough words for a round plus two examples', () => {
    for (const f of FAMILIES) expect(f.words.length).toBeGreaterThanOrEqual(ROUND_SIZE + 2);
  });

  it('skips a word whose last syllable is not the family ending', () => {
    const logs: string[] = [];
    const fams = loadFamilies([{ id: 't', label: 't', given: 'tion', words: [{ word: 'nature', syllables: ['na', 'ture'], level: 1, tags: ['medium', 'multi'] }] }], (m) => logs.push(m));
    expect(fams[0].words).toHaveLength(0);
    expect(logs[0]).toContain('tion');
  });

  it('speaks fragments the way they sound', () => {
    const vacation = FAMILIES.find((f) => f.id === 'tion')!.words.find((w) => w.word === 'vacation')!;
    expect(spokenSyllables(vacation)).toEqual(['vay', 'kay', 'shun']);
    const signature = FAMILIES.find((f) => f.id === 'ture')!.words.find((w) => w.word === 'signature')!;
    expect(spokenSyllables(signature)).toEqual(['sig', 'nuh', 'cher']);
  });
});

describe('a Syllable Speller round', () => {
  it('serves 5 distinct words from one family, easiest first, plus 2 other examples', () => {
    for (let seed = 1; seed < 50; seed++) {
      for (let L = 1; L <= 5; L++) {
        const { family, words, examples } = pickSpellerRound(state(L), seeded(seed));
        expect(words).toHaveLength(5);
        expect(new Set(words.map((w) => w.id)).size).toBe(5);
        expect(words.every((w) => w.family === family.id)).toBe(true);
        expect(words.map((w) => w.level)).toEqual(words.map((w) => w.level).slice().sort((a, b) => a - b));
        expect(examples).toHaveLength(2);
        expect(examples.some((e) => words.includes(e))).toBe(false);
      }
    }
  });

  it('does not repeat the family it just used', () => {
    const first = pickSpellerRound(state(2), seeded(3));
    const next = pickSpellerRound(state(2, first.words.map((w) => w.id)), seeded(3));
    expect(next.family.id).not.toBe(first.family.id);
  });

  it('gives the family ending at levels 1–4, nothing at level 5', () => {
    const vacation = FAMILIES[0].words.find((w) => w.word === 'vacation')!;
    expect(givenSyllables(vacation, 1, 'tion')).toEqual([false, false, true]);
    expect(givenSyllables(vacation, 5, 'tion')).toEqual([false, false, false]);
    expect(givenSyllables(vacation, 3, null)).toEqual([false, false, false]);
    expect(showExamples(4)).toBe(true);
    expect(showExamples(5)).toBe(false);
  });

  it('rescues with an easier word from the same family', () => {
    const { words } = pickSpellerRound(state(4), seeded(8));
    const easier = spellerRescue(words, 3);
    if (easier) {
      expect(easier.family).toBe(words[3].family);
      expect(easier.level).toBeLessThanOrEqual(Math.max(1, words[3].level - 1));
    }
  });

  it('is recommended when words with more beats are the weakest', () => {
    expect(recommendGame({ multi: { m: 0.2, n: 9 }, short: { m: 0.9, n: 9 } }, 'detective', false)).toBe('speller');
  });
});
