import { describe, expect, it } from 'vitest';
import { buildReport, practiceTime } from './report';
import { newProfile } from '../state/profile';

describe('grown-up report: one honest list per skill', () => {
  it('never lists the same skill as both stronger and tricky; a tricky skill that improved says so', () => {
    const p = newProfile();
    p.weekSnapshot = { date: '2026-10-01', mastery: { confusable: { m: 0.2, n: 5 }, digraph: { m: 0.5, n: 5 } } };
    p.mastery = { confusable: { m: 0.55, n: 8 }, digraph: { m: 0.85, n: 8 } };
    const r = buildReport(p);
    const strong = r.stronger.map((x) => x.tag);
    const tricky = r.tricky.map((x) => x.tag);
    expect(strong.filter((t) => tricky.includes(t))).toEqual([]);
    expect(strong).toContain('digraph');
    expect(r.tricky.find((x) => x.tag === 'confusable')?.improving).toBe(true);
  });

  it('describes practice time honestly, and covers the last seven days', () => {
    expect(practiceTime(40)).toBe('under a minute');
    expect(practiceTime(0)).toBe('no practice yet');
    expect(practiceTime(125)).toBe('2 minutes');
    const p = newProfile();
    p.rounds = [{ t: new Date().toISOString(), game: 'detective', seconds: 40, firsts: 3, xp: 20 }];
    const r = buildReport(p);
    expect(r.days).toHaveLength(7);
    expect(r.days[6]).toMatchObject({ seconds: 40, rounds: 1 });
    expect(r.seconds).toBe(40);
  });
});
