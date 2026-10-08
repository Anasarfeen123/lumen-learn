// The adaptive engine: plain, deterministic code. The language model never
// touches anything in this file (see references/04-adaptive-engine.md).
import { pickOne, weightedPick, type Rng } from './random';
import { capitalize, GAME_FOR_TAG, SHORT_NAME } from './tags';
import { GAMES, type GameId, type Mastery, type Result, type Tag, type Word } from './types';

export const RATE = 0.25;
export const SCORE: Record<Result, number> = { first: 1, hint: 0.5, shown: 0 };
export const ROUND_SIZE = 5;
export const RECENT_LIMIT = 8;
export const EXPLORE_CHANCE = 0.15;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

export interface LearnerState {
  mastery: Mastery;
  gameLevels: Record<GameId, number>;
  recentWords: string[];
}

/** Exponential moving average per tag. Response time is never part of the score. */
export function updateMastery(mastery: Mastery, word: Word, result: Result): Mastery {
  const next: Mastery = { ...mastery };
  for (const tag of word.tags) {
    const t = next[tag] ?? { m: 0.5, n: 0 };
    next[tag] = { m: t.m + RATE * (SCORE[result] - t.m), n: t.n + 1 };
  }
  return next;
}

export function masteryOf(mastery: Mastery, tag: Tag): number {
  return mastery[tag]?.m ?? 0.5;
}

export function weakness(mastery: Mastery, word: Word): number {
  const ms = word.tags.map((t) => masteryOf(mastery, t));
  return 1 - ms.reduce((a, b) => a + b, 0) / ms.length;
}

export function eligible(word: Word, game: GameId): boolean {
  if (game === 'detective') return word.misspellings.length >= 2;
  if (game === 'sound') return word.soundAlikes.length >= 2;
  return true;
}

function inLevelBand(word: Word, level: number): boolean {
  return word.level === level || word.level === level - 1;
}

/**
 * Candidate words at level L or L-1, not already in the round. Words served
 * recently are avoided; if that empties the pool (a small bank at level 1),
 * the least recently served words are allowed back rather than ending early.
 */
function candidates(bank: Word[], game: GameId, level: number, recent: string[], taken: Word[]): Word[] {
  const avail = bank.filter((w) => eligible(w, game) && inLevelBand(w, level) && !taken.includes(w));
  const fresh = avail.filter((w) => !recent.includes(w.id));
  if (fresh.length) return fresh;
  // Oldest half of the recent list first.
  const oldest = avail.filter((w) => recent.indexOf(w.id) < recent.length / 2);
  return oldest.length ? oldest : avail;
}

function warmUp(state: LearnerState, pool: Word[]): Word | undefined {
  return pool.slice().sort((a, b) => weakness(state.mastery, a) - weakness(state.mastery, b))[0];
}

function weightedItem(state: LearnerState, pool: Word[], level: number, rng: Rng): Word {
  if (rng() < EXPLORE_CHANCE) return pickOne(pool, rng);
  return weightedPick(pool, (w) => (w.level === level ? 3 : 1) * (1 + 2 * weakness(state.mastery, w)), rng);
}

/** Item 1 and 5 are warm-ups (likely successes); items 2–4 lean toward weak tags. */
export function pickRound(state: LearnerState, bank: Word[], game: GameId, rng: Rng = Math.random): Word[] {
  const level = state.gameLevels[game] ?? 1;
  const round: Word[] = [];
  const pool = () => candidates(bank, game, level, state.recentWords, round);

  const first = warmUp(state, pool());
  if (first) round.push(first);
  for (let i = 0; i < ROUND_SIZE - 2; i++) {
    const p = pool();
    if (!p.length) break;
    round.push(weightedItem(state, p, level, rng));
  }
  const last = warmUp(state, pool());
  if (last) round.push(last);
  return round;
}

/**
 * Rescue rule: after two `shown` results in a row, the next item comes from one
 * level lower, without changing the stored level.
 */
export function rescueItem(state: LearnerState, bank: Word[], game: GameId, taken: Word[], rng: Rng = Math.random): Word | undefined {
  const level = Math.max(MIN_LEVEL, (state.gameLevels[game] ?? 1) - 1);
  const pool = candidates(bank, game, level, state.recentWords, taken);
  return pool.length ? weightedItem(state, pool, level, rng) : undefined;
}

export function needsRescue(results: Result[]): boolean {
  const n = results.length;
  return n >= 2 && results[n - 1] === 'shown' && results[n - 2] === 'shown';
}

export function firstTryCount(results: Result[]): number {
  return results.filter((r) => r === 'first').length;
}

export function levelAfterRound(level: number, results: Result[]): number {
  const firsts = firstTryCount(results);
  if (firsts >= 4) return Math.min(MAX_LEVEL, level + 1);
  if (firsts <= 1) return Math.max(MIN_LEVEL, level - 1);
  return level;
}

export function pushRecent(recent: string[], ids: string[]): string[] {
  return [...recent.filter((id) => !ids.includes(id)), ...ids].slice(-RECENT_LIMIT);
}

// ---------------------------------------------------------------- insights

export type InsightKind = 'level-up' | 'improved' | 'tricky' | 'strong' | 'generic';

export interface Insight {
  kind: InsightKind;
  text: string;
  tag?: Tag;
  /** Aggregate context that may be sent to the language model for rephrasing. */
  context: Record<string, string>;
}

export function nextChallenge(level: number): string {
  if (level >= 5) return 'the longest words';
  if (level === 4) return 'tricky words';
  return 'longer words';
}

function knownTags(mastery: Mastery, minN = 3): [Tag, number][] {
  return (Object.entries(mastery) as [Tag, { m: number; n: number }][])
    .filter(([, v]) => v.n >= minN)
    .map(([t, v]) => [t, v.m]);
}

export function strongestTag(mastery: Mastery, minN = 3): Tag | undefined {
  const tags = knownTags(mastery, minN).sort((a, b) => b[1] - a[1]);
  return tags[0]?.[0];
}

export function weakestTag(mastery: Mastery, minN = 3): Tag | undefined {
  const tags = knownTags(mastery, minN).sort((a, b) => a[1] - b[1]);
  return tags[0]?.[0];
}

export interface InsightInput {
  mastery: Mastery;
  sessionStart: Mastery;
  oldLevel: number;
  newLevel: number;
}

/** One "Lumo noticed" sentence per round, by fixed priority. */
export function computeInsight({ mastery, sessionStart, oldLevel, newLevel }: InsightInput): Insight {
  const levels = { level: `${oldLevel}->${newLevel}` };

  if (newLevel > oldLevel) {
    const strong = strongestTag(mastery);
    const name = strong ? SHORT_NAME[strong] : 'these words';
    return {
      kind: 'level-up',
      tag: strong,
      text: `You're doing great with ${name}. Let's try ${nextChallenge(newLevel)}!`,
      context: { ...levels, ...(strong ? { tag: strong } : {}) },
    };
  }

  const rises = knownTags(mastery)
    .map(([t, m]) => [t, m - masteryOf(sessionStart, t)] as const)
    .filter(([, d]) => d >= 0.15)
    .sort((a, b) => b[1] - a[1]);
  if (rises.length) {
    const [tag, d] = rises[0];
    return {
      kind: 'improved',
      tag,
      text: `${capitalize(SHORT_NAME[tag])} are getting easier. I can tell!`,
      context: { ...levels, tag, change: `+${d.toFixed(2)}` },
    };
  }

  const weak = weakestTag(mastery);
  if (weak && masteryOf(mastery, weak) <= 0.45) {
    return {
      kind: 'tricky',
      tag: weak,
      text: `${capitalize(SHORT_NAME[weak])} are tricky. Let's practise a few more.`,
      context: { ...levels, tag: weak },
    };
  }

  const strong = strongestTag(mastery);
  if (strong && masteryOf(mastery, strong) >= 0.75) {
    return { kind: 'strong', tag: strong, text: `You're great at ${SHORT_NAME[strong]} now!`, context: { ...levels, tag: strong } };
  }

  return { kind: 'generic', text: "Great practice! Let's keep going.", context: levels };
}

/** "Next" follows the insight: same game after a level-up, else the game for the weakest tag. */
export function recommendGame(mastery: Mastery, justPlayed: GameId | null, leveledUp: boolean): GameId {
  if (leveledUp && justPlayed) return justPlayed;
  const weak = weakestTag(mastery);
  if (weak) return GAME_FOR_TAG[weak];
  if (!justPlayed) return 'detective';
  return GAMES[(GAMES.indexOf(justPlayed) + 1) % GAMES.length];
}
