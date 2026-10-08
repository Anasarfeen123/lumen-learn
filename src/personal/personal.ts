// What Lumo knows about one learner, to personalise practice: their interests,
// how stories felt, and the stories Lumo wrote for them. Kept in the account
// database when signed in, or on this device for guests.
//
// Sent to the AI: interest topics, skill tags and Lumen word-bank words only.
import { useSyncExternalStore } from 'react';
import type { Profile } from '../state/profile';
import type { GameId, Tag } from '../engine/types';
import { ALL_TAGS, GAME_FOR_TAG } from '../engine/tags';
import { GAME_NAME } from '../engine/report';
import { findWord } from '../engine/practice';
import { ACTIVITIES } from '../classroom/activities';
import { listStories } from '../library/content';
import { isFinished } from '../library/progress';
import { BANK } from '../engine/wordbank';

export const INTERESTS: { id: string; label: string; picture: string }[] = [
  { id: 'animals', label: 'Animals', picture: 'dog' },
  { id: 'space', label: 'Space', picture: 'rocket' },
  { id: 'dinosaurs', label: 'Dinosaurs', picture: 'dinosaur' },
  { id: 'ocean', label: 'The ocean', picture: 'whale' },
  { id: 'sport', label: 'Sport', picture: 'flag' },
  { id: 'food', label: 'Food', picture: 'pizza' },
  { id: 'music', label: 'Music', picture: 'drum' },
  { id: 'robots', label: 'Robots', picture: 'robot' },
  { id: 'art', label: 'Drawing', picture: 'pencil' },
  { id: 'nature', label: 'Nature', picture: 'tree' },
  { id: 'vehicles', label: 'Trains & boats', picture: 'train' },
  { id: 'magic', label: 'Dragons & magic', picture: 'dragon' },
];

export type Feeling = 'loved' | 'ok' | 'not-for-me';

export interface Personal {
  interests: string[];
  /** How the learner felt about stories (bundled or Lumo's), by story id. */
  feelings: Record<string, Feeling>;
}

export interface LumoStory {
  id: string;
  title: string;
  summary: string;
  topic: string;
  level: number;
  cover: string;
  pages: string[];
  focusWords: string[];
  createdAt: string;
  feeling: Feeling | null;
}

export interface PlanStep { id: string; why: string }
export interface Plan { greeting: string; focus: Tag | null; steps: PlanStep[]; source: 'ai' | 'rules' }

const LOCAL_KEY = 'lumen.personal.v1';
const LOCAL_STORIES = 'lumen.lumostories.v1';
const API_OFF = (import.meta.env.VITE_LUMO_API ?? '') === 'off';
const empty = (): Personal => ({ interests: [], feelings: {} });

let server = false;
let state: Personal = loadLocal();
let stories: LumoStory[] | null = null;
const planCache = new Map<string, Plan>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function loadLocal(): Personal {
  try { return { ...empty(), ...JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') }; } catch { return empty(); }
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<{ status: number; data: T | null }> {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { ...(method !== 'GET' ? { 'x-lumen': '1' } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: res.status === 204 ? null : ((await res.json().catch(() => null)) as T | null) };
}

/** Signed in: read and write the account; guest: this device. */
export function setPersonalBackend(toServer: boolean) {
  server = toServer;
  stories = null;
  planCache.clear();
  state = toServer ? empty() : loadLocal();
  emit();
}

export async function loadPersonal(): Promise<void> {
  if (!server) return;
  const { data } = await call<{ data: Partial<Personal> | null }>('/api/data/personal');
  state = { ...empty(), ...(data?.data ?? {}) };
  emit();
}

async function persist() {
  if (server) await call('/api/data/personal', 'PUT', { data: state }).catch(() => {});
  else { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch { /* blocked */ } }
}

export function getPersonal(): Personal { return state; }

export function setInterests(interests: string[]) {
  state = { ...state, interests: interests.filter((i) => INTERESTS.some((x) => x.id === i)).slice(0, 6) };
  emit();
  void persist();
}

export function usePersonal(): Personal {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

// ------------------------------------------------------------------ Lumo's stories

export async function listLumoStories(): Promise<LumoStory[]> {
  if (stories) return stories;
  if (server) {
    const { data } = await call<{ stories: LumoStory[] }>('/api/data/stories');
    stories = data?.stories ?? [];
  } else {
    try { stories = JSON.parse(localStorage.getItem(LOCAL_STORIES) ?? '[]'); } catch { stories = []; }
  }
  return stories!;
}

function saveLocalStories() {
  if (server || !stories) return;
  try { localStorage.setItem(LOCAL_STORIES, JSON.stringify(stories.slice(0, 30))); } catch { /* blocked */ }
}

export async function getLumoStory(id: string): Promise<LumoStory | undefined> {
  return (await listLumoStories()).find((s) => s.id === id);
}

/** Words to weave into a story: the learner's mistakes first, then words from their weakest skill. */
export function focusWordsFor(p: Profile, max = 5): string[] {
  const out: string[] = [];
  for (const id of Object.keys(p.mistakes)) {
    const w = findWord(id);
    if (w && /^[a-z]+$/.test(w.word) && !out.includes(w.word)) out.push(w.word);
  }
  const weak = weakTags(p)[0];
  if (weak) {
    for (const w of BANK) {
      if (out.length >= max) break;
      if (w.tags.includes(weak) && w.level <= p.gameLevels.detective + 1 && /^[a-z]+$/.test(w.word) && !out.includes(w.word)) out.push(w.word);
    }
  }
  return out.slice(0, max);
}

export async function writeStory(p: Profile, interest: string): Promise<{ story?: LumoStory; error?: string }> {
  if (API_OFF) return { error: "Lumo's stories need Lumen's server." };
  const level = Math.min(5, Math.max(1, Math.round((p.gameLevels.detective + p.gameLevels.sound + p.gameLevels.builder) / 3)));
  try {
    const { status, data } = await call<{ story?: LumoStory; error?: string }>('/api/personal/story', 'POST', { interest, level, words: focusWordsFor(p) });
    if (status !== 200 || !data?.story) return { error: data?.error ?? "Lumo couldn't write a story just now. Please try again." };
    stories = [data.story, ...(await listLumoStories()).filter((s) => s.id !== data.story!.id)];
    saveLocalStories();
    emit();
    return { story: data.story };
  } catch {
    return { error: "Lumo couldn't reach the story writer. Please try again." };
  }
}

export async function deleteLumoStory(id: string) {
  stories = (await listLumoStories()).filter((s) => s.id !== id);
  if (server) await call(`/api/data/stories/${encodeURIComponent(id)}`, 'DELETE').catch(() => {});
  else saveLocalStories();
  emit();
}

/** "How was this story?" Shapes which topics Lumo suggests next. */
export async function setFeeling(storyId: string, feeling: Feeling) {
  state = { ...state, feelings: { ...state.feelings, [storyId]: feeling } };
  const s = stories?.find((x) => x.id === storyId);
  if (s) s.feeling = feeling;
  saveLocalStories();
  emit();
  await persist();
  if (server && storyId.startsWith('lumo-')) await call(`/api/personal/story/${storyId}/feedback`, 'POST', { feeling }).catch(() => {});
}

// ------------------------------------------------------------------ plan

export function weakTags(p: Profile): Tag[] {
  return ALL_TAGS.filter((t) => (p.mastery[t]?.n ?? 0) >= 3).sort((a, b) => (p.mastery[a]?.m ?? 0) - (p.mastery[b]?.m ?? 0)).filter((t) => (p.mastery[t]?.m ?? 1) < 0.7).slice(0, 3);
}
export function strongTags(p: Profile): Tag[] {
  return ALL_TAGS.filter((t) => (p.mastery[t]?.n ?? 0) >= 3 && (p.mastery[t]?.m ?? 0) >= 0.8).slice(0, 3);
}

/** Interests, nudged by story feelings: a loved topic counts even if it wasn't picked. */
export function effectiveInterests(personal: Personal, lumoStories: LumoStory[] = []): string[] {
  const topicOf = (id: string) => lumoStories.find((s) => s.id === id)?.topic ?? listStories().find((s) => s.id === id)?.topic.toLowerCase();
  const loved = Object.entries(personal.feelings).filter(([, f]) => f === 'loved').map(([id]) => topicOf(id)).filter(Boolean) as string[];
  const notForMe = new Set(Object.entries(personal.feelings).filter(([, f]) => f === 'not-for-me').map(([id]) => topicOf(id)));
  return [...new Set([...personal.interests, ...loved])].filter((t) => !notForMe.has(t) || personal.interests.includes(t));
}

export interface Candidate { id: string; label: string; kind: 'game' | 'activity' | 'story' | 'practice' | 'lumo-story'; skill?: string; topic?: string }

const STORY_TOPIC: Record<string, string> = { Animals: 'animals', Space: 'space', Nature: 'nature', Ocean: 'ocean', Food: 'food', Music: 'music', Dinosaurs: 'dinosaurs', Robots: 'robots', Vehicles: 'vehicles', Magic: 'magic', Sport: 'sport', Art: 'art' };

export function planCandidates(p: Profile, lumoStories: LumoStory[]): Candidate[] {
  const out: Candidate[] = [];
  if (Object.keys(p.mistakes).length) out.push({ id: 'practice', label: 'Practise words to try again', kind: 'practice' });
  const games = new Set<GameId>();
  for (const t of weakTags(p)) games.add(GAME_FOR_TAG[t]);
  for (const g of ['detective', 'sound', 'builder', 'speller'] as GameId[]) games.add(g);
  for (const g of games) {
    const skill = (Object.entries(GAME_FOR_TAG) as [Tag, GameId][]).find(([t, gg]) => gg === g && weakTags(p).includes(t))?.[0];
    out.push({ id: `game:${g}`, label: GAME_NAME[g], kind: 'game', skill });
  }
  for (const a of ACTIVITIES) out.push({ id: `activity:${a.id}`, label: a.title, kind: 'activity' });
  for (const s of listStories(false)) if (!isFinished('story', s.id)) out.push({ id: `story:${s.id}`, label: s.title, kind: 'story', topic: STORY_TOPIC[s.topic] ?? s.topic.toLowerCase() });
  for (const s of lumoStories.filter((x) => !isFinished('lumo', x.id)).slice(0, 4)) out.push({ id: `lumo:${s.id}`, label: s.title, kind: 'lumo-story', topic: s.topic });
  return out;
}

/** Where a plan step goes. */
export function stepPath(id: string): string {
  const [kind, rest] = id.split(/:(.*)/s);
  if (kind === 'practice') return '/classroom/play/review';
  if (kind === 'game') return `/classroom/play/${rest}`;
  if (kind === 'activity') return `/classroom/activity/${rest}`;
  if (kind === 'story') return `/library/read/story/${rest}`;
  if (kind === 'lumo') return `/library/read/lumo/${rest}`;
  return '/classroom';
}


export async function getPlan(p: Profile, personal: Personal): Promise<{ plan: Plan; candidates: Candidate[] } | null> {
  if (API_OFF) return null;
  const lumo = await listLumoStories().catch(() => []);
  const candidates = planCandidates(p, lumo);
  const body = {
    interests: effectiveInterests(personal, lumo),
    weak: weakTags(p), strong: strongTags(p),
    mistakes: Object.keys(p.mistakes).slice(0, 8),
    candidates,
  };
  // One plan per day and situation, so it doesn't change every visit.
  const key = `${new Date().toDateString()}|${JSON.stringify(body)}`;
  const hit = planCache.get(key);
  if (hit) return { plan: hit, candidates };
  try {
    const { status, data } = await call<Plan>('/api/personal/plan', 'POST', body);
    if (status !== 200 || !data) return null;
    planCache.set(key, data);
    return { plan: data, candidates };
  } catch {
    return null;
  }
}
