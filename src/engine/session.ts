// Pure state transitions for a round: recording answers and settling a
// finished round into XP, stars, level, insight and recommendation.
import {
  computeInsight, firstTryCount, levelAfterRound, pushRecent, recommendGame, updateMastery, type Insight,
} from './adaptive';
import { CHEST_BONUS, dayKey, nextStreak, roundXp, stagesCrossed, starsFor, type Stage } from './progression';
import { MILESTONE_BONUS, SECOND_CHANCE_XP, trackMistake, type RoundItem } from './practice';
import { courseOf, slotAt } from './courses';
import { GAMES, type GameId, type Mastery, type Result, type Word } from './types';
import { activePath, HISTORY_LIMIT, ROUND_LOG_LIMIT, withNode, type PathNode, type Profile } from '../state/profile';

/** A single game, or a round that mixes games. */
export type RoundMode = GameId | 'mixed' | 'review' | 'milestone';

export function isGame(mode: RoundMode): mode is GameId {
  return (GAMES as string[]).includes(mode);
}

export function recordAnswer(p: Profile, game: GameId, word: Word, result: Result, now = new Date()): Profile {
  const mistakes = trackMistake(p.mistakes, word, game, result, now);
  const fixed = p.mistakes[word.id] && !mistakes[word.id] ? 1 : 0;
  return {
    ...p,
    mastery: updateMastery(p.mastery, word, result),
    mistakes,
    mistakesFixed: (p.mistakesFixed ?? 0) + fixed,
    wordsLearned: p.wordsLearned + (result === 'first' ? 1 : 0),
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
  mode: RoundMode;
  /** The game to "Play again" (for mixed rounds, the first item's game). */
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
  /** Second-chance items answered right first time. */
  bonusFixed: number;
  bonusTotal: number;
  /** Mistakes the learner cleared this round. */
  cleared: number;
}

/**
 * A summary read back from browser history may come from an older version of
 * Lumen (or a restored session). Only a complete one is shown.
 */
export function isRoundSummary(x: unknown): x is RoundSummary {
  const s = x as Partial<RoundSummary> | null;
  return Boolean(s && typeof s === 'object'
    && typeof s.mode === 'string' && typeof s.game === 'string' && typeof s.recommended === 'string'
    && Array.isArray(s.results) && Array.isArray(s.words) && Array.isArray(s.stages)
    && typeof s.firsts === 'number' && typeof s.xp === 'number' && typeof s.xpBefore === 'number'
    && typeof s.oldLevel === 'number' && typeof s.newLevel === 'number'
    && typeof s.bonusFixed === 'number' && typeof s.bonusTotal === 'number' && typeof s.cleared === 'number'
    && s.insight && typeof s.insight.text === 'string');
}

export function isFirstRoundToday(p: Profile, now = new Date()): boolean {
  const today = dayKey(now);
  return !p.rounds.some((r) => dayKey(new Date(r.t)) === today);
}

export function completeRound(
  p: Profile,
  mode: RoundMode,
  items: RoundItem[],
  results: Result[],
  bonusResults: Result[],
  startedAt: Date,
  sessionStart: Mastery,
  now = new Date(),
  mistakesBefore = p.mistakes,
): { profile: Profile; summary: RoundSummary } {
  const game = isGame(mode) ? mode : items[0]?.game ?? 'detective';
  const oldLevel = p.gameLevels[game];
  // Only single-game rounds move a game's level; mixed and review rounds are practice.
  const newLevel = isGame(mode) ? levelAfterRound(oldLevel, results) : oldLevel;
  const stars = starsFor(results);
  const bonusFixed = bonusResults.filter((r) => r === 'first').length;
  const xp = roundXp(results, isFirstRoundToday(p, now)) + bonusFixed * SECOND_CHANCE_XP + (mode === 'milestone' ? MILESTONE_BONUS : 0);
  const words = items.map((i) => i.word);
  const firstTryTags = words.filter((_, i) => results[i] === 'first').map((w) => w.tags);
  const cleared = Object.keys(mistakesBefore).filter((id) => !p.mistakes[id]).length;
  let insight = computeInsight({ mastery: p.mastery, sessionStart, oldLevel, newLevel, firstTryTags });
  if (mode === 'review' && cleared > 0) {
    insight = { kind: 'improved', text: cleared === 1 ? 'You fixed a tricky word. It will stay bright now!' : 'You fixed some tricky words. Look at them glow!', context: { kind: 'review' } };
  }
  const recommended = recommendGame(p.mastery, game, newLevel > oldLevel);
  const stages = stagesCrossed(p.xp, p.xp + xp);
  const seconds = Math.max(10, Math.round((now.getTime() - startedAt.getTime()) / 1000));
  const node: PathNode = isGame(mode) ? { kind: 'round', game, stars } : { kind: mode, stars };

  const profile: Profile = withNode({
    ...p,
    xp: p.xp + xp,
    gameLevels: { ...p.gameLevels, [game]: newLevel },
    stars: isGame(mode) ? { ...p.stars, [game]: Math.max(p.stars[game] ?? 0, stars) } : p.stars,
    insights: [...p.insights, insight.text].slice(-20),
    streak: nextStreak(p.streak, now),
    rounds: [...p.rounds, { t: startedAt.toISOString(), game, seconds, firsts: firstTryCount(results), xp }].slice(-ROUND_LOG_LIMIT),
    recommended,
    unlocked: [...new Set([...p.unlocked, ...stages.flatMap((s) => s.unlocks)])],
  }, node);
  return {
    profile,
    summary: {
      mode, game, results, firsts: firstTryCount(results), stars, xp, xpBefore: p.xp,
      oldLevel, newLevel, insight, recommended, stages, words: words.map((w) => w.word),
      bonusFixed, bonusTotal: bonusResults.length, cleared,
    },
  };
}

/** The next node on the active course's path, and the game it plays. */
export function nextSlot(p: Profile, available: GameId[] = GAMES) {
  return slotAt(courseOf(p.activeCourse), activePath(p).length, p.mistakes, available);
}

export function nextNodeIsChest(p: Profile): boolean {
  return nextSlot(p).kind === 'chest';
}

export function openChest(p: Profile): { profile: Profile; stages: Stage[] } {
  const stages = stagesCrossed(p.xp, p.xp + CHEST_BONUS);
  return {
    stages,
    profile: withNode({
      ...p,
      xp: p.xp + CHEST_BONUS,
      unlocked: [...new Set([...p.unlocked, ...stages.flatMap((s) => s.unlocks)])],
    }, { kind: 'chest' }),
  };
}

/** Keeps a mastery snapshot about a week old, used for "Getting stronger". */
export function rollWeekSnapshot(p: Profile, now = new Date()): Profile {
  const snap = p.weekSnapshot;
  if (snap && now.getTime() - new Date(snap.date).getTime() < 7 * 86400_000) return p;
  return { ...p, weekSnapshot: { date: now.toISOString(), mastery: structuredClone(p.mastery) } };
}
