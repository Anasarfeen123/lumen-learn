// Learning records for Classroom activities, kept separate from the word
// games' tag mastery and from Playground scores. Plain, testable rules:
//  - every answer is recorded with the conditions it was given under;
//  - only independent answers (no picture-only match, not revealed) move a skill;
//  - two misses in a row trigger an explanation and a supported example;
//  - strong independent success suggests the harder set (the learner can change it);
//  - missed items come back in a later session;
//  - a finished run is rewarded once, even if submitted twice.
import type { SkillId } from './activities';

export interface Attempt {
  t: string;
  activity: string;
  version: number;
  item: string;
  response: string;
  correct: boolean;
  hints: number;
  revealed: boolean;
  /** Guided: a supported example, or Lumo showed the way. Independent: the learner's own answer. */
  mode: 'guided' | 'independent';
  /** Conditions that matter for judging the answer (e.g. a picture was shown). */
  conditions: string[];
  skill: SkillId;
}

export interface LearningState {
  attempts: Attempt[];
  skills: Partial<Record<SkillId, { m: number; n: number }>>;
  /** Chosen difficulty per activity (1 gentler, 2 more demanding). */
  levels: Record<string, 1 | 2>;
  /** A suggestion only; the learner or a grown-up decides. */
  suggested: Record<string, 1 | 2>;
  /** "activity:item" -> ISO date when it should come back. */
  review: Record<string, string>;
  /** Finished runs, so a run can never be rewarded twice. */
  runs: string[];
  writing: { t: string; prompt: string; text: string }[];
}

export const ATTEMPT_LIMIT = 500;
const RATE = 0.25;

export function emptyLearning(): LearningState {
  return { attempts: [], skills: {}, levels: {}, suggested: {}, review: {}, runs: [], writing: [] };
}

/** Records an answer. Skills only move on independent answers that weren't revealed. */
export function recordAttempt(s: LearningState, a: Attempt): LearningState {
  const next: LearningState = { ...s, attempts: [...s.attempts, a].slice(-ATTEMPT_LIMIT), skills: { ...s.skills }, review: { ...s.review } };
  const key = `${a.activity}:${a.item}`;
  const counts = a.mode === 'independent' && !a.revealed && !a.conditions.includes('picture-only');
  if (counts) {
    const score = a.correct ? (a.hints === 0 ? 1 : 0.5) : 0;
    const cur = next.skills[a.skill] ?? { m: 0.5, n: 0 };
    next.skills[a.skill] = { m: cur.m + RATE * (score - cur.m), n: cur.n + 1 };
  }
  // Missed or revealed items come back tomorrow; a clean answer clears them.
  if (!a.correct || a.revealed || a.hints > 0) {
    const due = new Date(a.t);
    due.setDate(due.getDate() + 1);
    next.review[key] = due.toISOString();
  } else {
    delete next.review[key];
  }
  return next;
}

/** Two misses in a row: time to explain again with a supported example. */
export function needsSupport(runAttempts: Attempt[]): boolean {
  const last = runAttempts.slice(-2);
  return last.length === 2 && last.every((a) => !a.correct || a.revealed);
}

/** Items due for review in this activity, oldest first. */
export function dueReviews(s: LearningState, activity: string, now = new Date()): string[] {
  return Object.entries(s.review)
    .filter(([k, due]) => k.startsWith(`${activity}:`) && new Date(due) <= now)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([k]) => k.slice(activity.length + 1));
}

export interface RunResult {
  state: LearningState;
  xp: number;
  /** False if this run was already rewarded (a double submit). */
  rewarded: boolean;
  firstTry: number;
  suggestion: 1 | 2 | null;
}

/** Settles a finished run: rewards it once, and suggests a level from fresh, independent answers. */
export function finishRun(s: LearningState, runId: string, activity: string, run: Attempt[], level: 1 | 2): RunResult {
  const independent = run.filter((a) => a.mode === 'independent');
  const firstTry = independent.filter((a) => a.correct && a.hints === 0 && !a.revealed).length;
  if (s.runs.includes(runId)) return { state: s, xp: 0, rewarded: false, firstTry, suggestion: null };
  // Reward taking part and progress, never punish hints or retries.
  const xp = 10 + 2 * run.filter((a) => a.correct).length;
  let suggestion: 1 | 2 | null = null;
  if (level === 1 && independent.length >= 4 && firstTry >= independent.length - 1) suggestion = 2;
  if (level === 2 && independent.length >= 4 && firstTry <= 1) suggestion = 1;
  const suggested = { ...s.suggested };
  if (suggestion) suggested[activity] = suggestion;
  return { state: { ...s, runs: [...s.runs, runId].slice(-200), suggested }, xp, rewarded: true, firstTry, suggestion };
}
