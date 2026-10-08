import { describe, expect, it } from 'vitest';
import { completeRound, markServed, nextNodeIsChest, openChest, recordAnswer, rollWeekSnapshot } from './session';
import { secondChances } from './practice';
import { buildReport, fillName, summaryStats, summaryTemplate } from './report';
import { BY_ID } from './wordbank';
import { migrate, newProfile } from '../state/profile';
import { demoProfile } from '../state/demo';
import { validInsight, validSummary } from '../services/ai';
import { toBubbles } from '../data/lines';
import type { Result } from './types';

const NOW = new Date('2026-10-08T10:00:00');

describe('a round, end to end', () => {
  it('records answers, levels up, and recommends the same game', () => {
    let p = newProfile(NOW);
    const words = ['cat', 'sun', 'pig', 'dog', 'fish'].map((id) => BY_ID.get(id)!);
    p = markServed(p, words);
    const results: Result[] = ['first', 'first', 'first', 'hint', 'first'];
    words.forEach((w, i) => { p = recordAnswer(p, 'builder', w, results[i], NOW); });
    expect(p.history).toHaveLength(5);
    expect(p.recentWords).toEqual(['cat', 'sun', 'pig', 'dog', 'fish']);

    const start = new Date(NOW.getTime() - 75_000);
    const { profile, summary } = completeRound(p, 'builder', words.map((word) => ({ word, game: 'builder' as const })), results, [], start, {}, NOW);
    expect(summary.newLevel).toBe(2);
    expect(summary.stars).toBe(3);
    expect(summary.xp).toBe(10 * 4 + 6 + 10 + 5); // items + round bonus + first round today
    expect(summary.insight.kind).toBe('level-up');
    expect(summary.recommended).toBe('builder');
    expect(profile.xp).toBe(summary.xp);
    expect(profile.rounds[0].seconds).toBe(75);
    expect(profile.courses.explorer).toEqual([{ kind: 'round', game: 'builder', stars: 3 }]);
    expect(profile.streak.days).toBe(1);
  });

  it('caps history at 300 entries', () => {
    let p = newProfile(NOW);
    const cat = BY_ID.get('cat')!;
    for (let i = 0; i < 320; i++) p = recordAnswer(p, 'detective', cat, 'first', NOW);
    expect(p.history).toHaveLength(300);
  });

  it('the demo profile crosses into Shine after a good Word Builder round', () => {
    const p = demoProfile(NOW);
    const words = ['hand', 'frog', 'boat', 'star', 'moon'].map((id) => BY_ID.get(id)!);
    const results: Result[] = ['first', 'first', 'first', 'first', 'hint'];
    let q = p;
    words.forEach((w, i) => { q = recordAnswer(q, 'builder', w, results[i], NOW); });
    const { summary, profile } = completeRound(q, 'builder', words.map((word) => ({ word, game: 'builder' as const })), results, [], NOW, p.mastery, NOW);
    expect(summary.newLevel).toBe(3);
    expect(summary.insight.text).toBe("You're doing great with short words. Let's try longer words!");
    expect(summary.stages.map((s) => s.name)).toEqual(['Shine']);
    expect(profile.unlocked).toContain('star-crown');
  });

  it('the fifth node of every unit is a glow chest', () => {
    let p = newProfile(NOW);
    p = { ...p, courses: { explorer: Array.from({ length: 4 }, () => ({ kind: 'round' as const, game: 'detective' as const, stars: 2 })) } };
    expect(nextNodeIsChest(p)).toBe(true);
    const opened = openChest(p);
    expect(opened.profile.courses.explorer?.at(-1)).toEqual({ kind: 'chest' });
    expect(opened.profile.xp).toBe(15);
  });

  it('brings missed words back as second chances, and gives bonus XP for fixing them', () => {
    const p = newProfile(NOW);
    const words = ['cat', 'sun', 'pig', 'dog', 'fish'].map((id) => BY_ID.get(id)!);
    const items = words.map((word) => ({ word, game: 'detective' as const }));
    const results: Result[] = ['first', 'shown', 'first', 'hint', 'first'];
    const again = secondChances(items, results);
    expect(again.map((i) => i.word.id)).toEqual(['sun', 'dog']); // reveals first
    const { summary } = completeRound(p, 'detective', items, results, ['first', 'hint'], NOW, {}, NOW);
    expect(summary.bonusFixed).toBe(1);
    expect(summary.xp).toBe(10 * 3 + 2 + 6 + 10 + 5 + 5);
  });

  it('keeps a mistakes bank: a miss goes in, two clean answers take it out', () => {
    let p = newProfile(NOW);
    const sun = BY_ID.get('sun')!;
    p = recordAnswer(p, 'detective', sun, 'hint', NOW);
    expect(p.mistakes.sun).toMatchObject({ misses: 1, rights: 0 });
    p = recordAnswer(p, 'detective', sun, 'first', NOW);
    expect(p.mistakes.sun?.rights).toBe(1);
    p = recordAnswer(p, 'detective', sun, 'first', NOW);
    expect(p.mistakes.sun).toBeUndefined();
  });

  it('mixed and review rounds never change a game level', () => {
    const p = newProfile(NOW);
    const items = ['cat', 'sun', 'pig', 'dog', 'fish'].map((id) => ({ word: BY_ID.get(id)!, game: 'builder' as const }));
    const { summary, profile } = completeRound(p, 'mixed', items, ['first', 'first', 'first', 'first', 'first'], [], NOW, {}, NOW);
    expect(summary.newLevel).toBe(summary.oldLevel);
    expect(profile.courses.explorer?.at(-1)).toEqual({ kind: 'mixed', stars: 3 });
  });
});

describe('profile storage', () => {
  it('migrates partial or old profiles over defaults', () => {
    const p = migrate({ name: 'Sam', xp: 40, settings: { sfx: false }, gameLevels: { detective: 9 } });
    expect(p.onboarded).toBe(true);
    expect(p.settings.sfx).toBe(false);
    expect(p.settings.font).toBe('lexend');
    expect(p.gameLevels).toEqual({ detective: 5, sound: 1, builder: 1, speller: 1 });
  });
  it('survives garbage', () => {
    expect(migrate('nonsense').xp).toBe(0);
    expect(migrate(null).onboarded).toBe(false);
  });
  it('refreshes the weekly snapshot after 7 days', () => {
    const p = { ...newProfile(NOW), weekSnapshot: { date: '2026-09-01T00:00:00Z', mastery: {} }, mastery: { short: { m: 0.9, n: 9 } } };
    expect(rollWeekSnapshot(p, NOW).weekSnapshot!.mastery).toEqual({ short: { m: 0.9, n: 9 } });
  });
});

describe('grown-up report', () => {
  const r = buildReport(demoProfile(NOW), NOW);

  it('summarises the demo week', () => {
    expect(r.rounds).toBe(8);
    expect(r.minutes).toBe(21);
    expect(r.stronger.map((s) => s.tag)).toEqual(expect.arrayContaining(['short', 'digraph', 'blend']));
    expect(r.tricky[0].tag).toBe('confusable');
    expect(r.tricky[0].examples.length).toBeGreaterThan(0);
    expect(r.suggestedGame).toBe('detective');
  });

  it('hides tags with fewer than 5 answers', () => {
    const p = { ...newProfile(NOW), mastery: { confusable: { m: 0.1, n: 4 } } };
    const empty = buildReport(p, NOW);
    expect(empty.tricky).toEqual([]);
    expect(empty.hasData).toBe(false);
  });

  it('never sends the name, and the template passes its own validation', () => {
    const stats = summaryStats(r);
    expect(JSON.stringify(stats)).not.toContain('Maya');
    const text = summaryTemplate(r);
    expect(validSummary(text, stats)).toBe(true);
    expect(fillName(text, 'Maya')).toMatch(/^Maya practised for 21 minutes across 8 rounds/);
  });
});

describe('AI output validation', () => {
  it('rejects banned words, digits and long insights', () => {
    expect(validInsight('Vowel teams are getting easier for you!')).toBe(true); // "easier" is fine, "easy" isn't
    expect(validInsight('Look-alike letters are tricky. We can practise together.')).toBe(true);
    expect(validInsight('That was wrong but okay.')).toBe(false);
    expect(validInsight('You got 3 right.')).toBe(false);
    expect(validInsight('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen')).toBe(false);
  });
  it('rejects summaries with invented numbers', () => {
    expect(validSummary('{name} practised for 99 minutes.', { minutes: 24 })).toBe(false);
    expect(validSummary('{name} practised for 24 minutes.', { minutes: 24 })).toBe(true);
  });
});

describe('speech bubbles', () => {
  it('splits lines longer than 12 words at sentence breaks', () => {
    expect(toBubbles('Yes! You got it!')).toEqual(['Yes! You got it!']);
    const b = toBubbles("You're doing great with words with more beats. Let's try the longest words!");
    expect(b).toHaveLength(2);
    b.forEach((s) => expect(s.split(/\s+/).length).toBeLessThanOrEqual(12));
  });
});

describe('round summaries from browser history', () => {
  it('rejects partial or old-shaped summaries, so the page never crashes', async () => {
    const { isRoundSummary } = await import('./session');
    expect(isRoundSummary(null)).toBe(false);
    expect(isRoundSummary({ mode: 'detective', results: [] })).toBe(false);
    expect(isRoundSummary({
      mode: 'detective', game: 'detective', recommended: 'sound', results: ['first'], words: ['cat'], stages: [],
      firsts: 1, stars: 3, xp: 10, xpBefore: 0, oldLevel: 1, newLevel: 1, bonusFixed: 0, bonusTotal: 0, cleared: 0,
      insight: { text: 'Nice.' },
    })).toBe(true);
  });
});
