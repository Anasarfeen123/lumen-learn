// Who is using Lumen: a signed-in account (data in the database), a guest
// (data on this device only), or nobody yet. Sessions live in an httpOnly
// cookie the page can't read; the server is always the judge.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface User { id: string; email: string; name: string; createdAt: string }
export type AuthState =
  | { status: 'loading' }
  | { status: 'signedIn'; user: User }
  | { status: 'guest' }
  | { status: 'signedOut' };

const GUEST_KEY = 'lumen.guest';
const API_OFF = (import.meta.env.VITE_LUMO_API ?? '') === 'off';

/** JSON request to Lumen's server. Changes carry the x-lumen header (CSRF protection). */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: T }> {
  const method = init.method ?? 'GET';
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { ...(method !== 'GET' ? { 'x-lumen': '1' } : {}), ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = res.status === 204 ? (null as T) : ((await res.json().catch(() => null)) as T);
  return { status: res.status, data };
}

interface AuthContext {
  auth: AuthState;
  signUp: (email: string, password: string, name: string, keepGuestData: boolean) => Promise<string | null>;
  logIn: (email: string, password: string) => Promise<string | null>;
  logOut: () => Promise<void>;
  continueAsGuest: () => void;
  exitGuest: () => void;
  deleteAccount: () => Promise<boolean>;
  /** Server accounts need Lumen's server; static builds are guest-only. */
  accountsAvailable: boolean;
}

const Ctx = createContext<AuthContext | null>(null);

/** Handlers that clean up everything private on this device (set by the data layer). */
const cleanups = new Set<() => void | Promise<void>>();
export function onSignOut(fn: () => void | Promise<void>) {
  cleanups.add(fn);
  return () => { cleanups.delete(fn); };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const guest = (() => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; } })();
    if (API_OFF) { setAuth(guest ? { status: 'guest' } : { status: 'signedOut' }); return; }
    void api<{ user: User }>('/api/auth/me').then(
      ({ status, data }) => setAuth(status === 200 && data?.user ? { status: 'signedIn', user: data.user } : guest ? { status: 'guest' } : { status: 'signedOut' }),
      () => setAuth(guest ? { status: 'guest' } : { status: 'signedOut' }),
    );
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, keepGuestData: boolean) => {
    let profile: unknown;
    let library: unknown;
    if (keepGuestData) {
      try {
        profile = JSON.parse(localStorage.getItem('lumen.profile.v1') ?? 'null') ?? undefined;
        library = JSON.parse(localStorage.getItem('lumen.library.v1') ?? 'null') ?? undefined;
      } catch { /* nothing to keep */ }
    }
    const { status, data } = await api<{ user?: User; error?: string }>('/api/auth/signup', { method: 'POST', body: { email, password, name, profile, library } });
    if (status !== 201 || !data?.user) return data?.error ?? 'Something went wrong. Please try again.';
    try { localStorage.removeItem(GUEST_KEY); } catch { /* blocked */ }
    setAuth({ status: 'signedIn', user: data.user });
    return null;
  }, []);

  const logIn = useCallback(async (email: string, password: string) => {
    const { status, data } = await api<{ user?: User; error?: string }>('/api/auth/login', { method: 'POST', body: { email, password } });
    if (status !== 200 || !data?.user) return data?.error ?? 'Something went wrong. Please try again.';
    try { localStorage.removeItem(GUEST_KEY); } catch { /* blocked */ }
    setAuth({ status: 'signedIn', user: data.user });
    return null;
  }, []);

  const clearPrivate = useCallback(async () => {
    for (const fn of cleanups) await fn();
  }, []);

  const logOut = useCallback(async () => {
    // End the session on the server first, then clear everything private here.
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await clearPrivate();
    setAuth({ status: 'signedOut' });
  }, [clearPrivate]);

  const continueAsGuest = useCallback(() => {
    try { localStorage.setItem(GUEST_KEY, '1'); } catch { /* blocked */ }
    setAuth({ status: 'guest' });
  }, []);

  const exitGuest = useCallback(() => {
    // Guest progress stays on this device for next time; only the guest session ends.
    try { localStorage.removeItem(GUEST_KEY); } catch { /* blocked */ }
    setAuth({ status: 'signedOut' });
  }, []);

  const deleteAccount = useCallback(async () => {
    const { status } = await api('/api/account', { method: 'DELETE' });
    if (status !== 204) return false;
    await clearPrivate();
    setAuth({ status: 'signedOut' });
    return true;
  }, [clearPrivate]);

  const value = useMemo(() => ({ auth, signUp, logIn, logOut, continueAsGuest, exitGuest, deleteAccount, accountsAvailable: !API_OFF }),
    [auth, signUp, logIn, logOut, continueAsGuest, exitGuest, deleteAccount]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
