import { GAMES, type GameId, type Mastery, type Result, type Tag } from '../engine/types';
import type { GlowColor, HatId, UnlockId } from '../engine/progression';
import type { Mistakes } from '../engine/practice';
import type { CourseId } from '../engine/courses';
import { emptyLearning, type LearningState } from '../classroom/learning';

export const STORAGE_KEY = 'lumen.profile.v1';
export const HISTORY_LIMIT = 300;
export const ROUND_LOG_LIMIT = 200;

export type TextSize = 'normal' | 'large' | 'xl';
export type FontChoice = 'lexend' | 'opendyslexic' | 'atkinson';
export type Theme = 'cream' | 'blue' | 'green' | 'dark';
export type MotionChoice = 'system' | 'full' | 'reduced';

export type VoiceEngine = 'auto' | 'natural' | 'device';

export interface Settings {
  size: TextSize;
  font: FontChoice;
  theme: Theme;
  voiceRate: number;
  /** auto: the natural voice when it's set up, otherwise the device's voice. */
  voiceEngine: VoiceEngine;
  naturalVoice: string;
  /** Device (browser) voice name, or null for the best available. */
  voiceName: string | null;
  sfx: boolean;
  motion: MotionChoice;
}

export interface HistoryEntry {
  t: string;
  game: GameId;
  word: string;
  level: number;
  result: Result;
  tags: Tag[];
}

export interface RoundLog {
  t: string;
  game: GameId;
  seconds: number;
  firsts: number;
  xp: number;
}

export type PathNode =
  | { kind: 'round'; game: GameId; stars: number }
  | { kind: 'review' | 'mixed' | 'milestone'; stars: number }
  | { kind: 'chest' };

export interface Profile {
  name: string;
  createdAt: string;
  onboarded: boolean;
  xp: number;
  glowColor: GlowColor;
  equipped: { hat: HatId | null };
  unlocked: UnlockId[];
  settings: Settings;
  gameLevels: Record<GameId, number>;
  mastery: Mastery;
  recentWords: string[];
  history: HistoryEntry[];
  insights: string[];
  streak: { days: number; lastDay: string | null };
  stars: Record<GameId, number>;
  // Additions beyond the spec's example JSON, needed by the Hub path and grown-up view.
  /** Progress along each course's path. */
  courses: Partial<Record<CourseId, PathNode[]>>;
  activeCourse: CourseId;
  rounds: RoundLog[];
  weekSnapshot: { date: string; mastery: Mastery } | null;
  recommended: GameId;
  /** Words that needed help, waiting to be practised again. */
  mistakes: Mistakes;
  /** Achievement ids already earned. */
  badges: string[];
  /** Total words answered right on the first try, ever. */
  wordsLearned: number;
  /** Words that left the mistakes bank after two clean answers. */
  mistakesFixed: number;
  /** Classroom activity records (separate from word-game mastery). */
  learning: LearningState;
  /** Playground scores: just for fun, never counted as learning. */
  playground: Record<string, { plays: number; best: number | null; lastT: string }>;
}

export const DEFAULT_SETTINGS: Settings = {
  size: 'large',
  font: 'lexend',
  theme: 'cream',
  voiceRate: 0.85,
  voiceEngine: 'auto',
  naturalVoice: 'hannah',
  voiceName: null,
  sfx: true,
  motion: 'system',
};

export function newProfile(now = new Date()): Profile {
  return {
    name: '',
    createdAt: now.toISOString(),
    onboarded: false,
    xp: 0,
    glowColor: 'gold',
    equipped: { hat: null },
    unlocked: ['gold'],
    settings: { ...DEFAULT_SETTINGS },
    gameLevels: { detective: 1, sound: 1, builder: 1, speller: 1 },
    mastery: {},
    recentWords: [],
    history: [],
    insights: [],
    streak: { days: 0, lastDay: null },
    stars: { detective: 0, sound: 0, builder: 0, speller: 0 },
    courses: { explorer: [] },
    activeCourse: 'explorer',
    rounds: [],
    weekSnapshot: { date: now.toISOString(), mastery: {} },
    recommended: 'detective',
    mistakes: {},
    badges: [],
    wordsLearned: 0,
    mistakesFixed: 0,
    learning: emptyLearning(),
    playground: {},
  };
}

/** Merge stored JSON over defaults, so older or partial profiles still load. */
export function migrate(data: unknown): Profile {
  const base = newProfile();
  if (!data || typeof data !== 'object') return base;
  const d = data as Partial<Profile>;
  const p: Profile = {
    ...base,
    ...d,
    settings: { ...base.settings, ...(d.settings ?? {}) },
    gameLevels: { ...base.gameLevels, ...(d.gameLevels ?? {}) },
    stars: { ...base.stars, ...(d.stars ?? {}) },
    equipped: { ...base.equipped, ...(d.equipped ?? {}) },
    streak: { ...base.streak, ...(d.streak ?? {}) },
    mistakes: { ...(d.mistakes ?? {}) },
    courses: { explorer: [], ...(d.courses ?? {}) },
    learning: { ...emptyLearning(), ...(d.learning ?? {}) },
    playground: { ...(d.playground ?? {}) },
    badges: [...(d.badges ?? [])],
  };
  // Profiles from before courses existed: their path becomes Word Explorer's.
  const legacy = (d as { path?: PathNode[] }).path;
  if (legacy?.length && !d.courses) p.courses = { explorer: legacy };
  delete (p as { path?: unknown }).path;
  if (!['explorer', 'sounds', 'spelling', 'look'].includes(p.activeCourse)) p.activeCourse = 'explorer';
  // A profile saved before `onboarded` existed was onboarded if it has any progress.
  if (d.onboarded === undefined) p.onboarded = Boolean(d.name || d.xp);
  for (const g of GAMES) p.gameLevels[g] = Math.min(5, Math.max(1, Math.round(p.gameLevels[g]) || 1));
  if (!GAMES.includes(p.recommended)) p.recommended = 'detective';
  p.history = (p.history ?? []).slice(-HISTORY_LIMIT);
  p.rounds = (p.rounds ?? []).slice(-ROUND_LOG_LIMIT);
  if (!p.unlocked.includes(p.glowColor)) p.unlocked = [...p.unlocked, p.glowColor];
  return p;
}

export interface Storage {
  load(): Profile | null;
  save(p: Profile): boolean;
  clear(): void;
  available: boolean;
}

/** Every storage access is wrapped: a private window falls back to memory. */
/** The active course's path. */
export function activePath(p: Profile): PathNode[] {
  return p.courses[p.activeCourse] ?? [];
}

export function withNode(p: Profile, node: PathNode): Profile {
  return { ...p, courses: { ...p.courses, [p.activeCourse]: [...activePath(p), node] } };
}

export function createStorage(key = STORAGE_KEY): Storage {
  let available = true;
  try {
    const probe = '__lumen_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch {
    available = false;
  }
  return {
    available,
    load() {
      if (!available) return null;
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? migrate(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    save(p) {
      if (!available) return false;
      try {
        window.localStorage.setItem(key, JSON.stringify(p));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* nothing to clear */
      }
    },
  };
}
