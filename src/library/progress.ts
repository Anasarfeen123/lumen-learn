// Reading position, bookmarks and "continue reading", per story or upload.
// Kept in this browser only, like the rest of the learner's data.

export type ReadingKind = 'story' | 'upload' | 'lumo';

export interface Position {
  page: number;
  /** Character index of the last selected or read word on that page. */
  index: number;
  t: string;
}

export interface Bookmark {
  page: number;
  index: number;
  label: string;
  t: string;
}

export interface LibraryState {
  positions: Record<string, Position>;
  bookmarks: Record<string, Bookmark[]>;
  last: { kind: ReadingKind; id: string; title: string; t: string } | null;
  finished: Record<string, string>;
}

const GUEST_KEY = 'lumen.library.v1';
const empty = (): LibraryState => ({ positions: {}, bookmarks: {}, last: null, finished: {} });

/**
 * Where reading progress lives: this device (guests), or the database for a
 * signed-in learner (kept in memory here and synced; nothing left behind on sign-out).
 */
let remote: { state: LibraryState; push: (s: LibraryState) => void } | null = null;

export function setRemoteLibrary(state: Partial<LibraryState> | null, push: (s: LibraryState) => void) {
  remote = { state: { ...empty(), ...(state ?? {}) }, push };
}

export function setLocalLibrary() {
  remote = null;
}

function load(): LibraryState {
  if (remote) return structuredClone(remote.state);
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(GUEST_KEY) ?? '{}') };
  } catch {
    return empty();
  }
}

function save(s: LibraryState) {
  if (remote) {
    remote.state = s;
    remote.push(s);
    return;
  }
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}

const k = (kind: ReadingKind, id: string) => `${kind}:${id}`;

export function getPosition(kind: ReadingKind, id: string): Position | null {
  return load().positions[k(kind, id)] ?? null;
}

export function savePosition(kind: ReadingKind, id: string, title: string, page: number, index: number) {
  const s = load();
  const t = new Date().toISOString();
  s.positions[k(kind, id)] = { page, index, t };
  s.last = { kind, id, title, t };
  save(s);
}

export function markFinished(kind: ReadingKind, id: string) {
  const s = load();
  s.finished[k(kind, id)] = new Date().toISOString();
  save(s);
}

export function isFinished(kind: ReadingKind, id: string): boolean {
  return Boolean(load().finished[k(kind, id)]);
}

export function getBookmarks(kind: ReadingKind, id: string): Bookmark[] {
  return load().bookmarks[k(kind, id)] ?? [];
}

export function toggleBookmark(kind: ReadingKind, id: string, page: number, index: number, label: string): Bookmark[] {
  const s = load();
  const list = s.bookmarks[k(kind, id)] ?? [];
  const exists = list.some((b) => b.page === page);
  s.bookmarks[k(kind, id)] = exists ? list.filter((b) => b.page !== page) : [...list, { page, index, label, t: new Date().toISOString() }].sort((a, b) => a.page - b.page);
  save(s);
  return s.bookmarks[k(kind, id)];
}

/** Everything started but not finished, newest first. */
export function inProgress(): { kind: ReadingKind; id: string; position: Position }[] {
  const s = load();
  return Object.entries(s.positions)
    .filter(([key]) => !s.finished[key])
    .map(([key, position]) => ({ kind: key.split(':')[0] as ReadingKind, id: key.slice(key.indexOf(':') + 1), position }))
    .sort((a, b) => b.position.t.localeCompare(a.position.t));
}

export function lastReading() {
  return load().last;
}

export function forgetLibrary() {
  if (remote) { remote.state = empty(); remote.push(remote.state); return; }
  try { localStorage.removeItem(GUEST_KEY); } catch { /* nothing to clear */ }
}

/** How many stories (not uploads) have been read to the end. */
export function storiesFinished(): number {
  return Object.keys(load().finished).filter((k) => k.startsWith('story:')).length;
}
