import { describe, expect, it } from 'vitest';
import { isSolvable, isSolved, matchPairs, memoryDeck, neighbours, patternPuzzle, scrambledBoard, slide, solvedBoard } from './games';
import { seeded } from '../engine/random';
import { emptyLearning, finishRun, needsSupport, recordAttempt, dueReviews, type Attempt } from '../classroom/learning';

describe('memory', () => {
  it('deals each picture exactly twice', () => {
    const deck = memoryDeck(6, seeded(3));
    expect(deck).toHaveLength(12);
    const counts = new Map<string, number>();
    deck.forEach((c) => counts.set(c.picture, (counts.get(c.picture) ?? 0) + 1));
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
  });
});

describe('slide puzzle', () => {
  it('is always solvable and never starts solved', () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const size of [3, 4]) {
        const b = scrambledBoard(size, 80, seeded(seed));
        expect(isSolvable(b, size)).toBe(true);
        expect(isSolved(b)).toBe(false);
      }
    }
  });

  it('only slides tiles next to the gap', () => {
    const b = solvedBoard(3); // gap at index 8
    expect(neighbours(8, 3).sort()).toEqual([5, 7]);
    expect(slide(b, 7, 3)).not.toEqual(b);
    expect(slide(b, 0, 3)).toEqual(b);
  });
});

describe('patterns', () => {
  it('always has exactly one right answer among three different options', () => {
    for (let seed = 1; seed < 200; seed++) {
      for (const level of [1, 2, 3] as const) {
        const p = patternPuzzle(level, seeded(seed));
        expect(p.options).toHaveLength(3);
        const keys = p.options.map((o) => `${o.shape}-${o.colour}`);
        expect(new Set(keys).size).toBe(3);
        expect(p.answer).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('word & picture match', () => {
  it('uses distinct pictures', () => {
    const pairs = matchPairs(4, seeded(9));
    expect(pairs).toHaveLength(4);
    expect(new Set(pairs.map((p) => p.picture)).size).toBe(4);
  });
});

describe('classroom learning records', () => {
  const at = (correct: boolean, extra: Partial<Attempt> = {}): Attempt => ({
    t: '2026-10-08T10:00:00Z', activity: 'twins', version: 1, item: 't1', response: 'x', correct, hints: 0, revealed: false,
    mode: 'independent', conditions: [], skill: 'reading', ...extra,
  });

  it('moves a skill only on independent answers', () => {
    let s = recordAttempt(emptyLearning(), at(true));
    expect(s.skills.reading).toEqual({ m: 0.625, n: 1 });
    s = recordAttempt(s, at(false, { revealed: true, mode: 'guided' }));
    expect(s.skills.reading?.n).toBe(1);
    s = recordAttempt(s, at(true, { conditions: ['not-scored'] }));
    expect(s.skills.reading?.n).toBe(2);
  });

  it('keeps reading, writing and other skills separate', () => {
    const s = recordAttempt(emptyLearning(), at(true, { skill: 'writing' }));
    expect(s.skills.reading).toBeUndefined();
    expect(s.skills.writing?.n).toBe(1);
  });

  it('asks for support after two misses in a row', () => {
    expect(needsSupport([at(true), at(false), at(false)])).toBe(true);
    expect(needsSupport([at(false), at(true)])).toBe(false);
  });

  it('schedules missed items for review tomorrow', () => {
    const s = recordAttempt(emptyLearning(), at(false));
    expect(dueReviews(s, 'twins', new Date('2026-10-08T12:00:00Z'))).toEqual([]);
    expect(dueReviews(s, 'twins', new Date('2026-10-09T12:00:00Z'))).toEqual(['t1']);
  });

  it('rewards a finished run only once, and suggests the harder set after strong independent work', () => {
    const run = [at(true), at(true), at(true), at(true), at(true)];
    const first = finishRun(emptyLearning(), 'run-1', 'twins', run, 1);
    expect(first.rewarded).toBe(true);
    expect(first.xp).toBe(20);
    expect(first.suggestion).toBe(2);
    const again = finishRun(first.state, 'run-1', 'twins', run, 1);
    expect(again.rewarded).toBe(false);
    expect(again.xp).toBe(0);
  });
});
