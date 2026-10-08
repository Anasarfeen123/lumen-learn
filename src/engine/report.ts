// The grown-up view's numbers (references/06-grown-up-view.md). Sections need
// at least 5 answers per tag; less than that is noise dressed up as insight.
import { masteryOf, weakestTag } from './adaptive';
import { GAME_FOR_TAG, PLAIN_NAME, SKILLS, capitalize } from './tags';
import type { GameId, Tag } from './types';
import type { Profile } from '../state/profile';

export const MIN_N = 5;
const WEEK_MS = 7 * 86400_000;

export const GAME_NAME: Record<GameId, string> = {
  detective: 'Word Detective',
  sound: 'Sound Match',
  builder: 'Word Builder',
  speller: 'Syllable Speller',
};

export type Band = 'Getting started' | 'Growing' | 'Confident';

export function band(m: number): Band {
  return m < 0.4 ? 'Getting started' : m <= 0.7 ? 'Growing' : 'Confident';
}

export interface TagRow {
  tag: Tag;
  plain: string;
  m: number;
  band: Band;
  examples: string[];
}

export interface Report {
  minutes: number;
  rounds: number;
  games: Record<GameId, number>;
  stronger: TagRow[];
  tricky: TagRow[];
  suggestedGame: GameId | null;
  suggestedTag: Tag | null;
  skills: { label: string; m: number | null; band: Band | null }[];
  hasData: boolean;
}

function examplesFor(p: Profile, tag: Tag): string[] {
  const missed = p.history
    .filter((h) => h.result !== 'first' && h.tags.includes(tag))
    .map((h) => h.word)
    .reverse();
  return [...new Set(missed)].slice(0, 2);
}

function row(p: Profile, tag: Tag): TagRow {
  const m = masteryOf(p.mastery, tag);
  return { tag, plain: PLAIN_NAME[tag], m, band: band(m), examples: examplesFor(p, tag) };
}

export function buildReport(p: Profile, now = new Date()): Report {
  const since = now.getTime() - WEEK_MS;
  const week = p.rounds.filter((r) => new Date(r.t).getTime() >= since);
  const games: Record<GameId, number> = { detective: 0, sound: 0, builder: 0, speller: 0 };
  week.forEach((r) => games[r.game]++);

  const known = (Object.keys(p.mastery) as Tag[]).filter((t) => (p.mastery[t]?.n ?? 0) >= MIN_N);
  const before = p.weekSnapshot?.mastery ?? {};
  const stronger = known
    .filter((t) => masteryOf(p.mastery, t) - masteryOf(before, t) >= 0.1)
    .sort((a, b) => masteryOf(p.mastery, b) - masteryOf(p.mastery, a))
    .map((t) => row(p, t));
  const tricky = known
    .slice()
    .sort((a, b) => masteryOf(p.mastery, a) - masteryOf(p.mastery, b))
    .filter((t) => masteryOf(p.mastery, t) <= 0.7)
    .slice(0, 3)
    .map((t) => row(p, t));
  const weak = weakestTag(p.mastery, MIN_N) ?? null;

  const skills = SKILLS.map(({ label, tags }) => {
    const ms = tags.filter((t) => (p.mastery[t]?.n ?? 0) >= MIN_N).map((t) => masteryOf(p.mastery, t));
    if (!ms.length) return { label, m: null, band: null };
    const m = ms.reduce((a, b) => a + b, 0) / ms.length;
    return { label, m, band: band(m) };
  });

  return {
    minutes: Math.round(week.reduce((s, r) => s + r.seconds, 0) / 60),
    rounds: week.length,
    games,
    stronger,
    tricky,
    suggestedGame: weak ? GAME_FOR_TAG[weak] : null,
    suggestedTag: weak,
    skills,
    hasData: known.length > 0,
  };
}

/** Aggregates only. The learner's name is never included; `{name}` is filled in on the device. */
export function summaryStats(r: Report) {
  return {
    pronoun: null,
    minutesThisWeek: r.minutes,
    roundsThisWeek: r.rounds,
    games: r.games,
    stronger: r.stronger.map((s) => ({ tag: s.tag, plain: s.plain.toLowerCase() })),
    tricky: r.tricky.map((s) => ({ tag: s.tag, plain: s.plain.toLowerCase(), example: s.examples[0] ?? null })),
    suggestedGame: r.suggestedGame ? GAME_NAME[r.suggestedGame] : null,
  };
}

/** Template fallback for "This week in brief". */
export function summaryTemplate(r: Report): string {
  const parts = [`{name} practised for ${r.minutes} ${r.minutes === 1 ? 'minute' : 'minutes'} across ${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'} this week.`];
  if (r.stronger[0]) parts.push(`${capitalize(r.stronger[0].plain.toLowerCase())} are going well.`);
  if (r.tricky[0]) parts.push(`${capitalize(r.tricky[0].plain.toLowerCase())} are still tricky.`);
  if (r.suggestedGame) parts.push(`Try a few minutes of ${GAME_NAME[r.suggestedGame]}.`);
  return parts.join(' ');
}

export function fillName(text: string, name: string): string {
  return text.replaceAll('{name}', name || 'Your learner');
}
