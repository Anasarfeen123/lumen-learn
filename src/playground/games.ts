// Pure logic for the Playground games, kept separate from the UI so it can be
// tested: puzzles are always solvable and patterns always have one right answer.
import { shuffle, type Rng } from '../engine/random';
import { PICTURES } from '../data/pictures';
import { BANK } from '../engine/wordbank';

// ---------------------------------------------------------------- memory

export interface MemoryCard { id: number; picture: string; matched: boolean }

/** Pairs of distinct pictures, shuffled. */
export function memoryDeck(pairs: number, rng: Rng = Math.random): MemoryCard[] {
  const pics = shuffle(Object.keys(PICTURES), rng).slice(0, pairs);
  return shuffle([...pics, ...pics], rng).map((picture, id) => ({ id, picture, matched: false }));
}

// ---------------------------------------------------------------- sliding puzzle

/** Tiles as numbers 1..n*n-1 with 0 for the gap, solved order first. */
export function solvedBoard(size: number): number[] {
  return [...Array.from({ length: size * size - 1 }, (_, i) => i + 1), 0];
}

export function neighbours(index: number, size: number): number[] {
  const r = Math.floor(index / size);
  const c = index % size;
  return [
    r > 0 ? index - size : -1,
    r < size - 1 ? index + size : -1,
    c > 0 ? index - 1 : -1,
    c < size - 1 ? index + 1 : -1,
  ].filter((i) => i >= 0);
}

/** Moves the tile at `index` into the gap if they're next to each other; otherwise returns the board unchanged. */
export function slide(board: number[], index: number, size: number): number[] {
  const gap = board.indexOf(0);
  if (!neighbours(gap, size).includes(index)) return board;
  const next = board.slice();
  [next[gap], next[index]] = [next[index], next[gap]];
  return next;
}

/** Shuffled by legal moves only, so the puzzle is always solvable. */
export function scrambledBoard(size: number, moves: number, rng: Rng = Math.random): number[] {
  let board = solvedBoard(size);
  let prev = -1;
  for (let i = 0; i < moves; i++) {
    const gap = board.indexOf(0);
    const options = neighbours(gap, size).filter((n) => n !== prev);
    const pick = options[Math.floor(rng() * options.length)];
    prev = gap;
    board = slide(board, pick, size);
  }
  return isSolved(board) ? scrambledBoard(size, moves, rng) : board;
}

export function isSolved(board: number[]): boolean {
  return board.every((v, i) => (i === board.length - 1 ? v === 0 : v === i + 1));
}

/** Standard solvability test for sliding puzzles (used in tests). */
export function isSolvable(board: number[], size: number): boolean {
  const tiles = board.filter((v) => v !== 0);
  let inversions = 0;
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inversions++;
  if (size % 2 === 1) return inversions % 2 === 0;
  const gapRowFromBottom = size - Math.floor(board.indexOf(0) / size);
  return (inversions + gapRowFromBottom) % 2 === 1;
}

// ---------------------------------------------------------------- patterns

export type Shape = 'circle' | 'square' | 'triangle' | 'star' | 'heart';
export type Colour = 'yellow' | 'lavender' | 'sky' | 'blush' | 'leaf';
export interface Token { shape: Shape; colour: Colour }

const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'star', 'heart'];
const COLOURS: Colour[] = ['yellow', 'lavender', 'sky', 'blush', 'leaf'];

export interface PatternPuzzle { shown: Token[]; options: Token[]; answer: number; rule: string }

const same = (a: Token, b: Token) => a.shape === b.shape && a.colour === b.colour;

/** A repeating pattern with one clear next item. Harder levels use longer units. */
export function patternPuzzle(level: 1 | 2 | 3, rng: Rng = Math.random): PatternPuzzle {
  const units: Record<number, number[][]> = {
    1: [[0, 1], [0, 0, 1]],
    2: [[0, 1, 2], [0, 1, 1], [0, 0, 1, 1]],
    3: [[0, 1, 2, 3], [0, 1, 0, 2], [0, 0, 1, 2]],
  };
  const unit = units[level][Math.floor(rng() * units[level].length)];
  const kinds = Math.max(...unit) + 1;
  const shapes = shuffle(SHAPES, rng);
  const colours = shuffle(COLOURS, rng);
  const tokens: Token[] = Array.from({ length: kinds }, (_, i) => ({ shape: shapes[i], colour: colours[i] }));
  const length = unit.length * 2 + Math.floor(rng() * unit.length);
  const seq = Array.from({ length: length + 1 }, (_, i) => tokens[unit[i % unit.length]]);
  const answerToken = seq[length];
  const distractors = shuffle([
    ...tokens.filter((t) => !same(t, answerToken)),
    { shape: shapes[kinds % SHAPES.length], colour: colours[kinds % COLOURS.length] },
    { shape: answerToken.shape, colour: colours.find((c) => c !== answerToken.colour)! },
  ], rng).filter((t, i, all) => !same(t, answerToken) && all.findIndex((x) => same(x, t)) === i).slice(0, 2);
  const options = shuffle([answerToken, ...distractors], rng);
  return {
    shown: seq.slice(0, length),
    options,
    answer: options.findIndex((t) => same(t, answerToken)),
    rule: `The pattern repeats every ${unit.length}.`,
  };
}

// ---------------------------------------------------------------- word & picture match

export interface MatchPair { word: string; picture: string }

/** Short, pictured words for a matching round. */
export function matchPairs(count: number, rng: Rng = Math.random): MatchPair[] {
  const pool = BANK.filter((w) => w.level <= 2 && w.picture && PICTURES[w.picture]);
  const seen = new Set<string>();
  return shuffle(pool, rng).filter((w) => !seen.has(w.picture!) && seen.add(w.picture!)).slice(0, count).map((w) => ({ word: w.word, picture: w.picture! }));
}
