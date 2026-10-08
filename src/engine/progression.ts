// XP, stars, glow stages and unlockables (references/05-progression.md).
// Rewards pay for effort and practice, never only for being right.
import { firstTryCount } from './adaptive';
import type { Result } from './types';

export const ITEM_XP: Record<Result, number> = { first: 10, hint: 6, shown: 2 };
export const ROUND_BONUS = 10;
export const DAILY_BONUS = 5;
export const CHEST_BONUS = 15;

export type GlowColor = 'gold' | 'mint' | 'sky' | 'rose';
export type HatId = 'leaf-cap' | 'star-crown' | 'explorer-hat';
export type UnlockId = GlowColor | HatId | 'sparkles';

export const GLOW_HEX: Record<GlowColor, string> = {
  gold: '#FFE08A',
  mint: '#9FE3C1',
  sky: '#A9D4FF',
  rose: '#FFB8C8',
};

export interface Stage {
  name: 'Spark' | 'Glow' | 'Shine' | 'Bright' | 'Beacon';
  xp: number;
  unlocks: UnlockId[];
  halo: { scale: number; opacity: number };
}

// Halo radius 54..78 from the mascot spec, expressed as a scale of the base size.
export const STAGES: Stage[] = [
  { name: 'Spark', xp: 0, unlocks: ['gold'], halo: { scale: 54 / 66, opacity: 0.18 } },
  { name: 'Glow', xp: 100, unlocks: ['leaf-cap', 'mint'], halo: { scale: 60 / 66, opacity: 0.26 } },
  { name: 'Shine', xp: 300, unlocks: ['star-crown', 'sky'], halo: { scale: 1, opacity: 0.32 } },
  { name: 'Bright', xp: 600, unlocks: ['explorer-hat', 'rose'], halo: { scale: 72 / 66, opacity: 0.4 } },
  { name: 'Beacon', xp: 1000, unlocks: ['sparkles'], halo: { scale: 78 / 66, opacity: 0.48 } },
];

export const UNLOCK_LABEL: Record<UnlockId, string> = {
  gold: 'Gold glow',
  mint: 'Mint glow',
  sky: 'Sky glow',
  rose: 'Rose glow',
  'leaf-cap': 'Leaf cap',
  'star-crown': 'Star crown',
  'explorer-hat': 'Explorer hat',
  sparkles: 'Orbiting sparkles',
};

export const HATS: HatId[] = ['leaf-cap', 'star-crown', 'explorer-hat'];
export const GLOWS: GlowColor[] = ['gold', 'mint', 'sky', 'rose'];

export function stageIndex(xp: number): number {
  let i = 0;
  while (i + 1 < STAGES.length && xp >= STAGES[i + 1].xp) i++;
  return i;
}

export function stageFor(xp: number): Stage {
  return STAGES[stageIndex(xp)];
}

export function stageUnlocking(id: UnlockId): Stage {
  return STAGES.find((s) => s.unlocks.includes(id)) ?? STAGES[0];
}

/** Progress shown on the Hub: toward the next stage only, never a running total. */
export function stageProgress(xp: number): { label: string; current: number; target: number; fraction: number } {
  const i = stageIndex(xp);
  const stage = STAGES[i];
  const next = STAGES[i + 1];
  if (!next) return { label: stage.name, current: xp, target: xp, fraction: 1 };
  return {
    label: stage.name,
    current: xp,
    target: next.xp,
    fraction: (xp - stage.xp) / (next.xp - stage.xp),
  };
}

export function starsFor(results: Result[]): 1 | 2 | 3 {
  const firsts = firstTryCount(results);
  return firsts >= 4 ? 3 : firsts >= 2 ? 2 : 1;
}

export function roundXp(results: Result[], firstRoundToday: boolean): number {
  return results.reduce((s, r) => s + ITEM_XP[r], 0) + ROUND_BONUS + (firstRoundToday ? DAILY_BONUS : 0);
}

/** Stages newly reached when XP moves from `before` to `after`. */
export function stagesCrossed(before: number, after: number): Stage[] {
  return STAGES.filter((s) => s.xp > before && s.xp <= after);
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Gentle streak: counts consecutive days; a gap quietly starts again at 1. */
export function nextStreak(streak: { days: number; lastDay: string | null }, today: Date): { days: number; lastDay: string } {
  const key = dayKey(today);
  if (streak.lastDay === key) return { days: streak.days, lastDay: key };
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const days = streak.lastDay === dayKey(yesterday) ? streak.days + 1 : 1;
  return { days, lastDay: key };
}
