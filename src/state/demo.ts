// The demo profile behind Shift + D on the Hub, so every screen looks lived-in
// during judging (references/09-thinkroot-build.md, follow-up prompt 8).
import { BY_ID } from '../engine/wordbank';
import { dayKey } from '../engine/progression';
import type { GameId, Mastery, Result } from '../engine/types';
import { newProfile, type HistoryEntry, type PathNode, type Profile, type RoundLog } from './profile';
import { seeded } from '../engine/random';

export const DEMO_MASTERY: Mastery = {
  short: { m: 0.85, n: 14 },
  digraph: { m: 0.78, n: 8 },
  'vowel-team': { m: 0.55, n: 6 },
  confusable: { m: 0.38, n: 9 },
  long: { m: 0.42, n: 5 },
  irregular: { m: 0.44, n: 6 },
  blend: { m: 0.7, n: 5 },
};

/** Mastery at the start of the week, so "Getting stronger" has something to show. */
const WEEK_AGO: Mastery = {
  short: { m: 0.6, n: 4 },
  digraph: { m: 0.55, n: 2 },
  blend: { m: 0.55, n: 1 },
};

const PLAYED: [GameId, string, Result][] = [
  ['detective', 'cat', 'first'], ['detective', 'bed', 'hint'], ['detective', 'dog', 'first'], ['detective', 'ship', 'first'], ['detective', 'fish', 'first'],
  ['sound', 'ship', 'first'], ['sound', 'fish', 'first'], ['sound', 'sun', 'hint'], ['sound', 'pig', 'first'], ['sound', 'cat', 'first'],
  ['builder', 'cat', 'first'], ['builder', 'sun', 'first'], ['builder', 'pig', 'first'], ['builder', 'bed', 'hint'], ['builder', 'dog', 'first'],
  ['detective', 'hand', 'hint'], ['detective', 'boat', 'shown'], ['detective', 'duck', 'first'], ['detective', 'because', 'shown'], ['detective', 'moon', 'hint'],
  ['sound', 'rain', 'first'], ['sound', 'boat', 'hint'], ['sound', 'star', 'first'], ['sound', 'frog', 'first'], ['sound', 'duck', 'first'],
  ['builder', 'frog', 'first'], ['builder', 'star', 'first'], ['builder', 'rain', 'hint'], ['builder', 'hand', 'first'], ['builder', 'moon', 'first'],
  ['detective', 'rabbit', 'shown'], ['detective', 'said', 'hint'], ['detective', 'friend', 'first'], ['detective', 'elephant', 'hint'], ['detective', 'bed', 'first'],
  ['sound', 'ship', 'first'], ['sound', 'fish', 'first'], ['sound', 'duck', 'hint'], ['sound', 'boat', 'first'], ['sound', 'moon', 'first'],
];

export function demoProfile(now = new Date()): Profile {
  const rng = seeded(42);
  const p = newProfile(now);
  const history: HistoryEntry[] = [];
  const rounds: RoundLog[] = [];
  const path: PathNode[] = [];
  const minutesPerRound = [3, 2, 3, 3, 2, 3, 2, 3]; // 21 min across 8 rounds
  for (let r = 0; r < PLAYED.length / 5; r++) {
    const daysAgo = 4 - Math.floor(r * 5 / 8);
    const start = new Date(now);
    start.setDate(now.getDate() - daysAgo);
    start.setHours(16, 10 + r * 6, 0, 0);
    const items = PLAYED.slice(r * 5, r * 5 + 5);
    items.forEach(([game, id, result], i) => {
      const w = BY_ID.get(id)!;
      history.push({
        t: new Date(start.getTime() + (i * 30 + Math.floor(rng() * 20)) * 1000).toISOString(),
        game, word: id, level: w.level, result, tags: w.tags,
      });
    });
    const game = items[0][0];
    const firsts = items.filter(([, , res]) => res === 'first').length;
    rounds.push({ t: start.toISOString(), game, seconds: minutesPerRound[r] * 60, firsts, xp: 40 });
    path.push({ kind: 'round', game, stars: firsts >= 4 ? 3 : firsts >= 2 ? 2 : 1 });
    if ((path.length + 1) % 5 === 0) path.push({ kind: 'chest' });
  }
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 5);

  return {
    ...p,
    name: 'Maya',
    onboarded: true,
    xp: 280,
    unlocked: ['gold', 'leaf-cap', 'mint'],
    gameLevels: { detective: 2, sound: 2, builder: 2, speller: 1 },
    mastery: structuredClone(DEMO_MASTERY),
    history,
    rounds,
    path,
    recentWords: [],
    insights: ["'b' and 'd' words are tricky. Let's practise a few more."],
    streak: { days: 3, lastDay: dayKey(now) },
    stars: { detective: 2, sound: 3, builder: 3, speller: 0 },
    weekSnapshot: { date: weekAgo.toISOString(), mastery: WEEK_AGO },
    recommended: 'builder',
  };
}
