import { describe, expect, it } from 'vitest';
import raw from '../data/words.json';
import { checkWord, loadBank } from './wordbank';
import { existsSync } from 'node:fs';
import { PICTURES, pictureSlug } from '../data/pictures';
import type { Word } from './types';

const words = raw as Word[];

describe('word bank', () => {
  it.each(words.map((w) => [w.id, w] as const))('%s passes every check', (_, w) => {
    expect(checkWord(w)).toEqual([]);
  });

  it('has unique words across all 5 levels, with plenty at each', () => {
    expect(new Set(words.map((w) => w.id)).size).toBe(words.length);
    for (let L = 1; L <= 5; L++) expect(words.filter((w) => w.level === L).length).toBeGreaterThanOrEqual(10);
    expect(new Set(words.map((w) => w.level))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('has an illustration (and emoji fallback) for every picture description', () => {
    for (const w of words) {
      if (!w.picture) continue;
      expect(PICTURES[w.picture], w.picture).toBeTruthy();
      expect(existsSync(new URL(`../../public/pictures/${pictureSlug(w.picture)}.png`, import.meta.url)), w.picture).toBe(true);
    }
  });

  it('skips and logs invalid entries instead of showing them', () => {
    const bad = { ...words[0], id: 'bad', syllables: ['c', 'a'] };
    const logs: string[] = [];
    const bank = loadBank([words[0], bad], (m) => logs.push(m));
    expect(bank).toHaveLength(1);
    expect(logs[0]).toContain('bad');
  });
});
