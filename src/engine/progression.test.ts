import { describe, expect, it } from 'vitest';
import { nextStreak, roundXp, stageFor, stageProgress, stagesCrossed, starsFor } from './progression';

describe('progression', () => {
  it('earns 20 to 60 XP for a full round, before the daily bonus', () => {
    expect(roundXp(['shown', 'shown', 'shown', 'shown', 'shown'], false)).toBe(20);
    expect(roundXp(['first', 'first', 'first', 'first', 'first'], false)).toBe(60);
    expect(roundXp(['first', 'first', 'first', 'first', 'first'], true)).toBe(65);
  });

  it('never gives 0 stars', () => {
    expect(starsFor(['shown', 'shown', 'shown', 'shown', 'shown'])).toBe(1);
    expect(starsFor(['first', 'first', 'hint', 'shown', 'shown'])).toBe(2);
    expect(starsFor(['first', 'first', 'first', 'first', 'shown'])).toBe(3);
  });

  it('maps XP to glow stages', () => {
    expect(stageFor(0).name).toBe('Spark');
    expect(stageFor(99).name).toBe('Spark');
    expect(stageFor(100).name).toBe('Glow');
    expect(stageFor(1000).name).toBe('Beacon');
  });

  it('shows progress to the next stage only', () => {
    expect(stageProgress(280)).toMatchObject({ label: 'Glow', current: 280, target: 300 });
    expect(stageProgress(1200).fraction).toBe(1);
  });

  it('detects the demo glow-up: 280 + a good round crosses Shine', () => {
    expect(stagesCrossed(280, 280 + 56).map((s) => s.name)).toEqual(['Shine']);
    expect(stagesCrossed(280, 290)).toEqual([]);
  });

  it('keeps streaks gentle', () => {
    const d = (s: string) => new Date(`${s}T12:00:00`);
    expect(nextStreak({ days: 3, lastDay: '2026-10-07' }, d('2026-10-08'))).toEqual({ days: 4, lastDay: '2026-10-08' });
    expect(nextStreak({ days: 4, lastDay: '2026-10-08' }, d('2026-10-08'))).toEqual({ days: 4, lastDay: '2026-10-08' });
    expect(nextStreak({ days: 9, lastDay: '2026-10-01' }, d('2026-10-08'))).toEqual({ days: 1, lastDay: '2026-10-08' });
  });
});
