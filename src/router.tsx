// A small History API router: every screen has a real URL, so browser back,
// forward, refresh and direct links all work. Each main section remembers the
// last page you were on, so switching tabs returns you to where you left off.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Section = 'home' | 'classroom' | 'library' | 'playground' | 'settings';

export interface Location {
  /** Changes on every navigation, so a screen can remount (e.g. "Play again"). */
  key: number;
  path: string;
  query: URLSearchParams;
  /** Data passed with a navigation (e.g. a finished round's summary). Survives refresh, not new tabs. */
  state: unknown;
}

interface RouterContext {
  location: Location;
  navigate: (to: string, opts?: { state?: unknown; replace?: boolean }) => void;
  back: (fallback: string) => void;
  /** Go to a section, resuming the last page visited inside it. */
  openSection: (section: Exclude<Section, 'home' | 'settings'>) => void;
}

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const MEMORY_KEY = 'lumen.sections.v1';

let navCount = 0;

function read(): Location {
  const raw = window.location.pathname.slice(BASE.length) || '/';
  return { key: ++navCount, path: raw.replace(/\/+$/, '') || '/', query: new URLSearchParams(window.location.search), state: window.history.state?.data ?? null };
}

export function sectionOf(path: string): Section {
  const first = path.split('/')[1] ?? '';
  if (first === 'classroom' || first === 'library' || first === 'playground' || first === 'settings') return first;
  if (first === 'grown-ups' || first === 'start') return 'classroom';
  return 'home';
}

function loadMemory(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(MEMORY_KEY) ?? '{}');
  } catch {
    return {};
  }
}

const Ctx = createContext<RouterContext | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(read);

  useEffect(() => {
    const onPop = () => {
      window.dispatchEvent(new Event('lumen:navigate'));
      setLocation(read());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Remember the last page in each section (with its search and filters).
  useEffect(() => {
    const section = sectionOf(location.path);
    if (section === 'home' || section === 'settings') return;
    const memory = loadMemory();
    const q = location.query.toString();
    memory[section] = location.path + (q ? `?${q}` : '');
    try { sessionStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch { /* private mode */ }
  }, [location]);

  const navigate = useCallback((to: string, opts: { state?: unknown; replace?: boolean } = {}) => {
    const url = `${BASE}${to.startsWith('/') ? to : `/${to}`}`;
    // Stop the old page's speech now, before the new page starts its own.
    window.dispatchEvent(new Event('lumen:navigate'));
    // Entries we push are marked, so "back" knows the previous page is part of Lumen.
    const entry = { data: opts.state ?? null, inApp: opts.replace ? Boolean(window.history.state?.inApp) : true };
    if (opts.replace) window.history.replaceState(entry, '', url);
    else window.history.pushState(entry, '', url);
    setLocation(read());
  }, []);

  const back = useCallback((fallback: string) => {
    // Opened directly (no in-app history)? Go to the sensible parent instead of leaving the app.
    if (window.history.state?.inApp) window.history.back();
    else navigate(fallback);
  }, [navigate]);

  const openSection = useCallback((section: 'classroom' | 'library' | 'playground') => {
    const last = loadMemory()[section];
    // Resume list-style pages only; never drop the learner back into the middle of an old round.
    // Progress has its own tab, so it's never what "Classroom" resumes to.
    const resumable = last && !/\/(play|done|activity|read|game|review)\//.test(`${last}/`) && !last.startsWith('/classroom/progress');
    navigate(resumable ? last : `/${section}`);
  }, [navigate]);

  const value = useMemo(() => ({ location, navigate, back, openSection }), [location, navigate, back, openSection]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRouter(): RouterContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>');
  return ctx;
}

/** Matches "/library/story/:id" style patterns. Returns params, or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
