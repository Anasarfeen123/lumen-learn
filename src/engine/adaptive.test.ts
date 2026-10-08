import { describe, expect, it } from 'vitest';
import {
  computeInsight, levelAfterRound, needsRescue, pickRound, pushRecent, recommendGame, rescueItem,
  updateMastery, weakness, type LearnerState,
} from './adaptive';
import { seeded } from './random';
import { ALL_TAGS } from './tags';
import { BANK, BY_ID } from './wordbank';
import type { Mastery } from './types';

const fresh = (over: Partial<LearnerState> = {}): LearnerState => ({
  mastery: {},
  gameLevels: { detective: 1, sound: 1, builder: 1, speller: 1 },
  recentWords: [],
  ...over,
});

describe('updateMastery', () => {
  const ship = BY_ID.get('ship')!;

  it('starts unseen tags at 0.5 and moves 25% toward the score', () => {
    const m = updateMastery({}, ship, 'first');
    expect(m.short).toEqual({ m: 0.625, n: 1 });
    expect(m.digraph).toEqual({ m: 0.625, n: 1 });
    expect(updateMastery({}, ship, 'hint').short!.m).toBe(0.5);
    expect(updateMastery({}, ship, 'shown').short!.m).toBe(0.375);
  });

  it('does not mutate the input', () => {
    const before: Mastery = { short: { m: 0.5, n: 1 } };
    updateMastery(before, ship, 'first');
    expect(before.short).toEqual({ m: 0.5, n: 1 });
  });

  it('moves most of the way after four consistent answers', () => {
    let m: Mastery = {};
    for (let i = 0; i < 4; i++) m = updateMastery(m, ship, 'first');
    expect(m.short!.m).toBeGreaterThan(0.8);
  });
});

describe('weakness', () => {
  it('averages 1 - m over tags, treating unseen as 0.5', () => {
    const bed = BY_ID.get('bed')!; // short, confusable
    expect(weakness({}, bed)).toBe(0.5);
    expect(weakness({ short: { m: 1, n: 5 } }, bed)).toBe(0.25);
  });
});

describe('levelAfterRound', () => {
  it.each([
    [['first', 'first', 'first', 'first', 'hint'], 2, 3],
    [['first', 'first', 'first', 'first', 'first'], 5, 5],
    [['first', 'first', 'hint', 'hint', 'shown'], 3, 3],
    [['first', 'hint', 'shown', 'shown', 'hint'], 3, 2],
    [['shown', 'shown', 'shown', 'shown', 'shown'], 1, 1],
  ] as const)('%j at level %i -> %i', (results, level, expected) => {
    expect(levelAfterRound(level, [...results])).toBe(expected);
  });
});

describe('pickRound', () => {
  it('serves 5 distinct words within the level band', () => {
    for (let seed = 1; seed < 40; seed++) {
      for (const game of ['detective', 'sound', 'builder'] as const) {
        for (let L = 1; L <= 5; L++) {
          const state = fresh({ gameLevels: { detective: L, sound: L, builder: L, speller: 1 } });
          const round = pickRound(state, BANK, game, seeded(seed));
          expect(round).toHaveLength(5);
          expect(new Set(round.map((w) => w.id)).size).toBe(5);
          for (const w of round) expect([L, L - 1]).toContain(w.level);
        }
      }
    }
  });

  it('avoids recently served words when it can', () => {
    const recent = ['hand', 'frog', 'star', 'boat', 'rain', 'moon', 'duck', 'cat'];
    const state = fresh({ gameLevels: { detective: 2, sound: 2, builder: 2, speller: 1 }, recentWords: recent });
    for (let seed = 1; seed < 20; seed++) {
      const round = pickRound(state, BANK, 'builder', seeded(seed));
      // 14 words in band, 8 recent: the 6 fresh ones are enough for the first 5 picks.
      expect(round.filter((w) => recent.includes(w.id))).toHaveLength(0);
    }
  });

  it('still fills a round when the small level-1 pool has all been served', () => {
    const recent = ['cat', 'bed', 'dog', 'sun', 'pig', 'ship', 'fish'];
    const round = pickRound(fresh({ recentWords: recent }), BANK, 'detective', seeded(3));
    expect(round).toHaveLength(5);
  });

  it('opens and closes on warm-ups: the strongest available words', () => {
    const mastery: Mastery = { short: { m: 0.95, n: 10 }, digraph: { m: 0.99, n: 10 }, confusable: { m: 0.1, n: 10 } };
    const round = pickRound(fresh({ mastery }), BANK, 'detective', seeded(5));
    // fish (short + digraph) is the strongest level-1 word.
    expect(round[0].id).toBe('fish');
    // The closer is the strongest word still unused after the middle picks.
    const left = BANK.filter((w) => w.level === 1 && !round.slice(0, 4).includes(w));
    const best = Math.min(...left.map((w) => weakness(mastery, w)));
    expect(weakness(mastery, round[4])).toBe(best);
  });

  it('leans toward weak tags', () => {
    // Every tag strong except look-alike letters.
    const mastery: Mastery = Object.fromEntries(ALL_TAGS.map((t) => [t, { m: t === 'confusable' ? 0.05 : 0.9, n: 20 }]));
    let confusable = 0;
    let total = 0;
    for (let seed = 1; seed < 200; seed++) {
      const round = pickRound(fresh({ mastery, gameLevels: { detective: 2, sound: 2, builder: 2, speller: 1 } }), BANK, 'builder', seeded(seed));
      for (const w of round.slice(1, 4)) {
        total++;
        if (w.tags.includes('confusable')) confusable++;
      }
    }
    // Weighting should push confusable words well above their share of the level band.
    // Baseline: their share of the band, weighted by level the way the engine is (level L ×3).
    const band = BANK.filter((w) => w.level === 2 || w.level === 1);
    const lw = (w: (typeof BANK)[number]) => (w.level === 2 ? 3 : 1);
    const base = band.filter((w) => w.tags.includes('confusable')).reduce((s, w) => s + lw(w), 0) / band.reduce((s, w) => s + lw(w), 0);
    expect(confusable / total).toBeGreaterThan(base + 0.08);
  });
});

describe('rescue rule', () => {
  it('triggers after two reveals in a row', () => {
    expect(needsRescue(['first', 'shown', 'shown'])).toBe(true);
    expect(needsRescue(['shown', 'hint', 'shown'])).toBe(false);
  });

  it('draws from one level lower without changing the stored level', () => {
    const state = fresh({ gameLevels: { detective: 3, sound: 3, builder: 3, speller: 1 } });
    const w = rescueItem(state, BANK, 'detective', [], seeded(9))!;
    expect([1, 2]).toContain(w.level);
    expect(state.gameLevels.detective).toBe(3);
  });
});

describe('pushRecent', () => {
  it('keeps the last 8 ids without duplicates', () => {
    const r = pushRecent(['a', 'b', 'c', 'd', 'e', 'f', 'g'], ['b', 'x', 'y']);
    expect(r).toEqual(['c', 'd', 'e', 'f', 'g', 'b', 'x', 'y']);
  });
});

describe('computeInsight', () => {
  const base = { short: { m: 0.82, n: 14 }, long: { m: 0.6, n: 6 } } as Mastery;

  it('prioritises a level-up and names the strongest tag', () => {
    const i = computeInsight({ mastery: base, sessionStart: base, oldLevel: 2, newLevel: 3 });
    expect(i.kind).toBe('level-up');
    expect(i.text).toBe("You're doing great with short words. Let's try longer words!");
  });

  it('reports improvement of 0.15+ since the session started', () => {
    const start = { ...base, long: { m: 0.4, n: 3 } };
    const i = computeInsight({ mastery: base, sessionStart: start, oldLevel: 2, newLevel: 2 });
    expect(i.text).toBe('Long words are getting easier. I can tell!');
  });

  it('flags a weak tag at or below 0.45', () => {
    const m = { ...base, confusable: { m: 0.38, n: 9 } };
    const i = computeInsight({ mastery: m, sessionStart: m, oldLevel: 2, newLevel: 2 });
    expect(i.text).toBe("'b' and 'd' words are tricky. Let's practise a few more.");
  });

  it('celebrates a strong tag', () => {
    const i = computeInsight({ mastery: base, sessionStart: base, oldLevel: 2, newLevel: 2 });
    expect(i.text).toBe("You're great at short words now!");
  });

  it('ignores tags with fewer than 3 answers', () => {
    const m: Mastery = { confusable: { m: 0.1, n: 2 } };
    const i = computeInsight({ mastery: m, sessionStart: m, oldLevel: 1, newLevel: 1 });
    expect(i.kind).toBe('generic');
  });

  it('never exceeds 14 words or contains digits', () => {
    for (let L = 2; L <= 5; L++) {
      const i = computeInsight({ mastery: { multi: { m: 0.9, n: 5 } }, sessionStart: {}, oldLevel: L - 1, newLevel: L });
      expect(i.text.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(i.text).not.toMatch(/\d/);
    }
  });
});

describe('recommendGame', () => {
  it('replays the same game after a level-up', () => {
    expect(recommendGame({ confusable: { m: 0.1, n: 9 } }, 'builder', true)).toBe('builder');
  });
  it('follows the weakest tag otherwise', () => {
    expect(recommendGame({ confusable: { m: 0.1, n: 9 }, short: { m: 0.9, n: 9 } }, 'builder', false)).toBe('detective');
    expect(recommendGame({ 'vowel-team': { m: 0.2, n: 9 } }, 'detective', false)).toBe('sound');
  });
});
