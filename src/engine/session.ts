// Pure state transitions for a round: recording answers and settling a
// finished round into XP, stars, level, insight and recommendation.
import {
  computeInsight, firstTryCount, levelAfterRound, pushRecent, recommendGame, updateMastery, type Insight,
} from './adaptive';
import { CHEST_BONUS, dayKey, nextStreak, roundXp, stagesCrossed, starsFor, type Stage } from './progression';
import type { GameId, Mastery, Result, Word } from './types';
import { HISTORY_LIMIT, ROUND_LOG_LIMIT, type Profile } from '../state/profile';

export function recordAnswer(p: Profile, game: GameId, word: Word, result: Result, now = new Date()): Profile {
  return {
    ...p,
    mastery: updateMastery(p.mastery, word, result),
    history: [
      ...p.history,
      { t: now.toISOString(), game, word: word.id, level: p.gameLevels[game], result, tags: word.tags },
    ].slice(-HISTORY_LIMIT),
  };
}

/** Marks words as served as soon as a round starts, so nothing repeats too soon. */
export function markServed(p: Profile, words: Word[]): Profile {
  return { ...p, recentWords: pushRecent(p.recentWords, words.map((w) => w.id)) };
}

export interface RoundSummary {
  game: GameId;
  results: Result[];
  firsts: number;
  stars: 1 | 2 | 3;
  xp: number;
  xpBefore: number;
  oldLevel: number;
  newLevel: number;
  insight: Insight;
  recommended: GameId;
  stages: Stage[];
  words: string[];
}

export function isFirstRoundToday(p: Profile, now = new Date()): boolean {
  const today = dayKey(now);
  return !p.rounds.some((r) => dayKey(new Date(r.t)) === today);
}

export function completeRound(
  p: Profile,
  game: GameId,
  results: Result[],
  words: Word[],
  startedAt: Date,
  sessionStart: Mastery,
  now = new Date(),
): { profile: Profile; summary: RoundSummary } {
  const oldLevel = p.gameLevels[game];
  const newLevel = levelAfterRound(oldLevel, results);
  const stars = starsFor(results);
  const xp = roundXp(results, isFirstRoundToday(p, now));
  const firstTryTags = words.filter((_, i) => results[i] === 'first').map((w) => w.tags);
  const insight = computeInsight({ mastery: p.mastery, sessionStart, oldLevel, newLevel, firstTryTags });
  const recommended = recommendGame(p.mastery, game, newLevel > oldLevel);
  const stages = stagesCrossed(p.xp, p.xp + xp);
  const seconds = Math.max(10, Math.round((now.getTime() - startedAt.getTime()) / 1000));

  const profile: Profile = {
    ...p,
    xp: p.xp + xp,
    gameLevels: { ...p.gameLevels, [game]: newLevel },
    stars: { ...p.stars, [game]: Math.max(p.stars[game] ?? 0, stars) },
    insights: [...p.insights, insight.text].slice(-20),
    streak: nextStreak(p.streak, now),
    rounds: [...p.rounds, { t: startedAt.toISOString(), game, seconds, firsts: firstTryCount(results), xp }].slice(-ROUND_LOG_LIMIT),
    path: [...p.path, { kind: 'round', game, stars }],
    recommended,
    unlocked: [...new Set([...p.unlocked, ...stages.flatMap((s) => s.unlocks)])],
  };
  return {
    profile,
    summary: {
      game, results, firsts: firstTryCount(results), stars, xp, xpBefore: p.xp,
      oldLevel, newLevel, insight, recommended, stages, words: words.map((w) => w.word),
    },
  };
}

/** Every fifth node on Lumo's path is a glow chest. */
export function nextNodeIsChest(p: Profile): boolean {
  return (p.path.length + 1) % 5 === 0;
}

export function openChest(p: Profile): { profile: Profile; stages: Stage[] } {
  const stages = stagesCrossed(p.xp, p.xp + CHEST_BONUS);
  return {
    stages,
    profile: {
      ...p,
      xp: p.xp + CHEST_BONUS,
      path: [...p.path, { kind: 'chest' }],
      unlocked: [...new Set([...p.unlocked, ...stages.flatMap((s) => s.unlocks)])],
    },
  };
}

/** Keeps a mastery snapshot about a week old, used for "Getting stronger". */
export function rollWeekSnapshot(p: Profile, now = new Date()): Profile {
  const snap = p.weekSnapshot;
  if (snap && now.getTime() - new Date(snap.date).getTime() < 7 * 86400_000) return p;
  return { ...p, weekSnapshot: { date: now.toISOString(), mastery: structuredClone(p.mastery) } };
}
