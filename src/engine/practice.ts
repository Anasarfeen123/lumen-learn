// Practice from mistakes (like Duolingo's "let's try that again") and the
// variety on Lumo's path: mixed rounds, mistake reviews, chests, milestones.
// Plain, testable code, like the rest of the engine.
import { pickRound, type LearnerState } from './adaptive';
import { pickSpellerRound, FAMILY_BY_ID } from './speller';
import { shuffle, type Rng } from './random';
import { BANK, BY_ID } from './wordbank';
import { GAMES, type GameId, type Result, type Word } from './types';

/** A word the learner needed help with, and where. */
export interface Mistake {
  game: GameId;
  misses: number;
  /** First-try answers since the last miss; two in a row clears the mistake. */
  rights: number;
  t: string;
}

export type Mistakes = Record<string, Mistake>;
export const CLEAR_AFTER = 2;
export const SECOND_CHANCE_MAX = 2;
export const SECOND_CHANCE_XP = 5;

/** Any answer that needed a hint or a reveal goes in; two clean answers take it out. */
export function trackMistake(mistakes: Mistakes, word: Word, game: GameId, result: Result, now = new Date()): Mistakes {
  const next = { ...mistakes };
  const cur = next[word.id];
  if (result !== 'first') {
    next[word.id] = { game, misses: (cur?.misses ?? 0) + 1, rights: 0, t: now.toISOString() };
  } else if (cur) {
    if (cur.rights + 1 >= CLEAR_AFTER) delete next[word.id];
    else next[word.id] = { ...cur, rights: cur.rights + 1, t: now.toISOString() };
  }
  return next;
}

export function mistakeCount(mistakes: Mistakes): number {
  return Object.keys(mistakes).length;
}

/** Looks a word up in the main bank or the Syllable Speller families. */
export function findWord(id: string): Word | undefined {
  if (BY_ID.has(id)) return BY_ID.get(id);
  const family = FAMILY_BY_ID.get(id.split(':')[0]);
  return family?.words.find((w) => w.id === id);
}

/** A round item: which word, in which game. */
export interface RoundItem {
  word: Word;
  game: GameId;
  /** A second-chance repeat of something missed earlier in this round. */
  bonus?: boolean;
}

/**
 * Duolingo-style second chances: after the main items, up to two words that
 * needed help come back once more. Reveals first, then hints.
 */
export function secondChances(items: RoundItem[], results: Result[]): RoundItem[] {
  const missed = items
    .map((item, i) => ({ item, r: results[i] }))
    .filter(({ item, r }) => r && r !== 'first' && !item.bonus)
    .sort((a, b) => (a.r === 'shown' ? 0 : 1) - (b.r === 'shown' ? 0 : 1));
  return missed.slice(0, SECOND_CHANCE_MAX).map(({ item }) => ({ ...item, bonus: true }));
}

/** Words that are eligible for a game (Sound Match needs sound-alikes, and so on). */
function playableIn(word: Word, game: GameId): boolean {
  if (game === 'speller') return Boolean(word.family);
  if (word.family) return false;
  if (game === 'detective') return word.misspellings.length >= 2;
  if (game === 'sound') return word.soundAlikes.length >= 2;
  return true;
}

/** A review round: the mistakes missed most (and longest ago) first, each in the game it was missed in. */
export function pickReviewRound(mistakes: Mistakes, games: GameId[] = GAMES, size = 5): RoundItem[] {
  return Object.entries(mistakes)
    .map(([id, m]) => ({ word: findWord(id), m }))
    .filter((x): x is { word: Word; m: Mistake } => Boolean(x.word))
    .map(({ word, m }) => ({ word, m, game: games.includes(m.game) && playableIn(word, m.game) ? m.game : word.family ? 'speller' as GameId : 'detective' as GameId }))
    .filter(({ game }) => games.includes(game))
    .sort((a, b) => b.m.misses - a.m.misses || a.m.t.localeCompare(b.m.t))
    .slice(0, size)
    .map(({ word, game }) => ({ word, game }));
}

/** A mixed round: one word at a time from different games, at each game's level. */
export function pickMixedRound(state: LearnerState, games: GameId[] = GAMES, rng: Rng = Math.random, size = 5): RoundItem[] {
  const order = shuffle(games, rng);
  const items: RoundItem[] = [];
  const used = new Set<string>();
  for (let i = 0; items.length < size && i < size * 3; i++) {
    const game = order[i % order.length];
    const pool = game === 'speller' ? pickSpellerRound(state, rng).words : pickRound(state, BANK, game, rng);
    const word = pool.find((w) => !used.has(w.id));
    if (!word) continue;
    used.add(word.id);
    items.push({ word, game });
  }
  return items;
}

// ---------------------------------------------------------------- Lumo's path

export type NodeKind = 'round' | 'review' | 'chest' | 'mixed' | 'milestone';

/** Every unit of 8 follows the same rhythm, so the path feels varied but familiar. */
export const UNIT_PATTERN: NodeKind[] = ['round', 'round', 'round', 'review', 'chest', 'round', 'mixed', 'milestone'];
export const UNIT_SIZE = UNIT_PATTERN.length;
export const MILESTONE_BONUS = 20;

/** What the node at this path position is. A review with too few mistakes becomes a mixed round. */
export function nodeKindAt(index: number, mistakes: Mistakes): NodeKind {
  const kind = UNIT_PATTERN[index % UNIT_SIZE];
  return kind === 'review' && mistakeCount(mistakes) < 2 ? 'mixed' : kind;
}

export interface UnitTheme {
  title: string;
  /** Banner colour and the scenery drawn along the path. */
  banner: string;
  scenery: 'meadow' | 'seaside' | 'forest' | 'mountains' | 'space';
}

export const UNIT_THEMES: UnitTheme[] = [
  { title: 'First words', banner: '#2b2c5e', scenery: 'meadow' },
  { title: 'Longer words', banner: '#2d5a8a', scenery: 'seaside' },
  { title: 'Tricky words', banner: '#23603f', scenery: 'forest' },
  { title: 'Big words', banner: '#6a3f8f', scenery: 'mountains' },
  { title: 'Word explorer', banner: '#1f2a44', scenery: 'space' },
];

export function themeFor(unit: number): UnitTheme {
  return UNIT_THEMES[Math.min(unit, UNIT_THEMES.length - 1)];
}
