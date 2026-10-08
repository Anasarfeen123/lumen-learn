import { describe, expect, it } from 'vitest';
import {
  arrangeOptions, builderTiles, builderUnits, decoys, detectiveDistractors, differsInFirstSound, differsInVowel,
  firstSound, isClose, isObvious, scramble, soundDistractors,
} from './items';
import { seeded } from './random';
import { BANK, BY_ID } from './wordbank';

describe('Word Detective distractors', () => {
  it('uses obvious misspellings at level 1', () => {
    expect(isObvious('cat', 'cta')).toBe(true);
    expect(isObvious('cat', 'ct')).toBe(true);
    expect(isObvious('cat', 'kat')).toBe(false);
    const d = detectiveDistractors(BY_ID.get('cat')!, 1, seeded(1));
    expect(d.sort()).toEqual(['ct', 'cta']);
  });

  it('prefers look-alike or vowel swaps at level 3+', () => {
    expect(isClose('dog', 'doq')).toBe(true);
    expect(isClose('pig', 'qig')).toBe(true);
    expect(isClose('dog', 'dgo')).toBe(false);
    const d = detectiveDistractors(BY_ID.get('dog')!, 3, seeded(2));
    expect(d).toContain('doq');
  });

  it('gives 2 distractors below level 4 and 3 from level 4', () => {
    for (const w of BANK) {
      for (let L = 1; L <= 5; L++) {
        const d = detectiveDistractors(w, L, seeded(L));
        expect(d).toHaveLength(L >= 4 ? 3 : 2);
        expect(d).not.toContain(w.word);
        expect(new Set(d).size).toBe(d.length);
      }
    }
  });
});

describe('Sound Match distractors', () => {
  it('detects first-sound and vowel differences', () => {
    expect(differsInFirstSound('ship', 'chip')).toBe(true);
    expect(differsInFirstSound('cat', 'hat')).toBe(true);
    expect(differsInFirstSound('ship', 'sheep')).toBe(false);
    expect(differsInVowel('ship', 'sheep')).toBe(true);
    expect(differsInVowel('ship', 'chip')).toBe(false);
  });

  it('prefers first-sound changes at level 1 and vowel changes at level 3', () => {
    expect(soundDistractors(BY_ID.get('ship')!, 1, seeded(4))).toContain('chip');
    expect(soundDistractors(BY_ID.get('ship')!, 3, seeded(4))).toContain('sheep');
  });

  it('first sound keeps digraphs together', () => {
    expect(firstSound('ship')).toBe('sh');
    expect(firstSound('queen')).toBe('qu');
    expect(firstSound('cat')).toBe('c');
  });
});

describe('arrangeOptions', () => {
  it('never puts the answer in the same slot three times running', () => {
    const rng = seeded(11);
    const positions: number[] = [];
    for (let i = 0; i < 300; i++) {
      const order = arrangeOptions('cat', ['cta', 'ct'], positions, rng);
      positions.push(order.indexOf('cat'));
    }
    for (let i = 2; i < positions.length; i++) {
      expect(positions[i] === positions[i - 1] && positions[i] === positions[i - 2]).toBe(false);
    }
  });
});

describe('Word Builder', () => {
  it('uses syllable tiles for long words at low levels only', () => {
    const butterfly = BY_ID.get('butterfly')!;
    expect(builderUnits(butterfly, 1)).toEqual(['but', 'ter', 'fly']);
    expect(builderUnits(butterfly, 2)).toEqual(['but', 'ter', 'fly']);
    expect(builderUnits(butterfly, 4)).toHaveLength(9);
    expect(builderUnits(BY_ID.get('rabbit')!, 1)).toEqual(['rab', 'bit']);
    expect(builderUnits(BY_ID.get('rabbit')!, 2)).toHaveLength(6);
    expect(builderUnits(BY_ID.get('frog')!, 1)).toEqual(['f', 'r', 'o', 'g']);
  });

  it('scrambles so at least half the positions differ', () => {
    const rng = seeded(7);
    for (const w of BANK) {
      const units = w.word.split('');
      for (let i = 0; i < 20; i++) {
        const s = scramble(units, rng);
        const differ = s.filter((t, j) => t !== units[j]).length;
        expect(differ).toBeGreaterThanOrEqual(Math.ceil(units.length / 2));
        expect(s.slice().sort()).toEqual(units.slice().sort());
      }
    }
  });

  it('adds confusable decoys that are not in the word', () => {
    expect(decoys('dog', 1, seeded(1))).toEqual(['b']);
    for (const w of BANK) {
      for (const d of decoys(w.word, 2, seeded(3))) expect(w.word).not.toContain(d);
    }
  });

  it('builds tiles with decoys at levels 4 and 5', () => {
    const { units, tiles } = builderTiles(BY_ID.get('animal')!, 5, seeded(2));
    expect(tiles).toHaveLength(units.length + 2);
    expect(tiles.filter((t) => t.decoy)).toHaveLength(2);
    const l3 = builderTiles(BY_ID.get('animal')!, 3, seeded(2));
    expect(l3.tiles.some((t) => t.decoy)).toBe(false);
  });
});
