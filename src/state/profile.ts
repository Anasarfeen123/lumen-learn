import { GAMES, type GameId, type Mastery, type Result, type Tag } from '../engine/types';
import type { GlowColor, HatId, UnlockId } from '../engine/progression';

export const STORAGE_KEY = 'lumen.profile.v1';
export const HISTORY_LIMIT = 300;
export const ROUND_LOG_LIMIT = 200;

export type TextSize = 'normal' | 'large' | 'xl';
export type FontChoice = 'lexend' | 'opendyslexic' | 'atkinson';
export type Theme = 'cream' | 'blue' | 'green' | 'dark';
export type MotionChoice = 'system' | 'full' | 'reduced';

export interface Settings {
  size: TextSize;
  font: FontChoice;
  theme: Theme;
  voiceRate: number;
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

export type PathNode = { kind: 'round'; game: GameId; stars: number } | { kind: 'chest' };

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
  path: PathNode[];
  rounds: RoundLog[];
  weekSnapshot: { date: string; mastery: Mastery } | null;
  recommended: GameId;
}

export const DEFAULT_SETTINGS: Settings = {
  size: 'large',
  font: 'lexend',
  theme: 'cream',
  voiceRate: 0.85,
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
    gameLevels: { detective: 1, sound: 1, builder: 1 },
    mastery: {},
    recentWords: [],
    history: [],
    insights: [],
    streak: { days: 0, lastDay: null },
    stars: { detective: 0, sound: 0, builder: 0 },
    path: [],
    rounds: [],
    weekSnapshot: { date: now.toISOString(), mastery: {} },
    recommended: 'detective',
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
  };
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
