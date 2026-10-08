import { describe, expect, it } from 'vitest';
import raw from '../data/words.json';
import { checkWord, loadBank } from './wordbank';
import { PICTURES } from '../data/pictures';
import type { Word } from './types';

const words = raw as Word[];

describe('word bank', () => {
  it.each(words.map((w) => [w.id, w] as const))('%s passes every check', (_, w) => {
    expect(checkWord(w)).toEqual([]);
  });

  it('has 32 unique words across 5 levels', () => {
    expect(new Set(words.map((w) => w.id)).size).toBe(32);
    expect(new Set(words.map((w) => w.level))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('has a picture for every non-null picture description', () => {
    for (const w of words) if (w.picture) expect(PICTURES[w.picture], w.picture).toBeTruthy();
  });

  it('skips and logs invalid entries instead of showing them', () => {
    const bad = { ...words[0], id: 'bad', syllables: ['c', 'a'] };
    const logs: string[] = [];
    const bank = loadBank([words[0], bad], (m) => logs.push(m));
    expect(bank).toHaveLength(1);
    expect(logs[0]).toContain('bad');
  });
});
