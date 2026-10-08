import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createStorage, migrate, newProfile, type Profile, type Settings } from './profile';
import { api, onSignOut, useAuth } from '../account/auth';
import { jsonSaver, loadProfile, ProfileSaver } from '../account/remote';
import { setLocalLibrary, setRemoteLibrary, type LibraryState } from '../library/progress';
import { setUploadsBackend } from '../library/uploads';
import { loadPersonal, setPersonalBackend } from '../personal/personal';
import { demoProfile } from './demo';
import { rollWeekSnapshot, type RoundMode, type RoundSummary } from '../engine/session';
import type { RoundItem } from '../engine/practice';
import type { Mastery } from '../engine/types';
import { useRouter } from '../router';
import { setSfxEnabled } from '../services/sfx';
import { loadStatus, setVoicePrefs, speak, speakSequence, stopSpeaking, type Part } from '../services/speech';
import { toBubbles } from '../data/lines';
import { forgetLibrary } from '../library/progress';
import { forgetWordHelp } from '../library/wordhelp';
import { clearUploads } from '../library/uploads';

/** In-app destinations. Each maps to a real URL (see screenPath). */
export type Screen =
  | { name: 'welcome' }
  | { name: 'hub' }
  | { name: 'game'; mode: RoundMode; items?: RoundItem[] }
  | { name: 'complete'; summary: RoundSummary }
  | { name: 'closet' }
  | { name: 'settings' }
  | { name: 'grownup' };

export function screenPath(s: Screen): string {
  switch (s.name) {
    case 'welcome': return '/start';
    case 'hub': return '/classroom';
    case 'game': return `/classroom/play/${s.mode}`;
    case 'complete': return '/classroom/done';
    case 'closet': return '/classroom/closet';
    case 'settings': return '/settings';
    case 'grownup': return '/grown-ups';
  }
}

interface LumenContext {
  profile: Profile;
  update: (fn: (p: Profile) => Profile) => void;
  storageOk: boolean;
  /** Where progress is kept: this device, or the learner's account. */
  savedIn: 'device' | 'account';
  /** False while a signed-in learner's data is loading from the database. */
  dataReady: boolean;
  /** False when the last save to the account failed (it is retried). */
  syncOk: boolean;
  /** Mastery when the app opened, used to detect improvement this session. */
  sessionStart: Mastery;
  go: (s: Screen) => void;
  reducedMotion: boolean;
  loadDemo: () => void;
  /** Reset progress (keeps settings), or with `everything` forget this device entirely. */
  reset: (opts?: { everything?: boolean }) => Promise<void>;
  /** Lumo's current line(s), shown in a bubble and spoken. */
  say: (text: string, opts?: { silent?: boolean }) => void;
  speakWord: (text: string, rate?: number) => Promise<void>;
  speakParts: (parts: Part[]) => Promise<void>;
  announce: (text: string) => void;
}

const Ctx = createContext<LumenContext | null>(null);

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return Boolean(match);
}

function applySettings(s: Settings, still: boolean) {
  const root = document.documentElement;
  root.dataset.size = s.size;
  root.dataset.font = s.font;
  root.dataset.theme = s.theme;
  root.classList.toggle('still', still);
  root.classList.toggle('anim', !still);
  setSfxEnabled(s.sfx);
}

export function LumenProvider({ children }: { children: ReactNode }) {
  const storage = useMemo(() => createStorage(), []);
  const [profile, setProfile] = useState<Profile>(() => rollWeekSnapshot(storage.load() ?? newProfile()));
  const [sessionStart, setSessionStart] = useState<Mastery>(() => structuredClone(profile.mastery));
  const { navigate } = useRouter();
  const [liveText, setLiveText] = useState('');
  const systemReduced = usePrefersReducedMotion();
  const reducedMotion = profile.settings.motion === 'reduced' || (profile.settings.motion === 'system' && systemReduced);

  // ---- Where the profile lives: this device (guests) or the account database.
  const { auth } = useAuth();
  const userId = auth.status === 'signedIn' ? auth.user.id : null;
  const ownerRef = useRef<string | null>(null);
  const saverRef = useRef<ProfileSaver<Profile> | null>(null);
  const skipSaveRef = useRef(false);
  const [dataReady, setDataReady] = useState(true);
  const [syncOk, setSyncOk] = useState(true);

  useEffect(() => {
    if (auth.status === 'loading') { setDataReady(false); return; }
    if (!userId) {
      setDataReady(true);
      if (ownerRef.current) {
        // Signed out: nothing of the account stays in memory; back to this device's guest data.
        ownerRef.current = null;
        saverRef.current = null;
        setUploadsBackend(false);
        setLocalLibrary();
        setPersonalBackend(false);
        skipSaveRef.current = true;
        const local = rollWeekSnapshot(storage.load() ?? newProfile());
        setProfile(local);
        setSessionStart(structuredClone(local.mastery));
      }
      return;
    }
    if (ownerRef.current === userId) return;
    let alive = true;
    setDataReady(false);
    void (async () => {
      try {
        const [remote, lib] = await Promise.all([
          loadProfile<Profile>(),
          api<{ data: Partial<LibraryState> | null }>('/api/data/library'),
        ]);
        if (!alive) return;
        const lsave = jsonSaver('/api/data/library');
        setRemoteLibrary(lib.data?.data ?? null, (s) => lsave.schedule(s));
        setUploadsBackend(true);
        setPersonalBackend(true);
        await loadPersonal().catch(() => {});
        const fresh = remote.data ? rollWeekSnapshot(migrate(remote.data)) : { ...newProfile(), name: auth.status === 'signedIn' ? auth.user.name : '' };
        ownerRef.current = userId;
        saverRef.current = new ProfileSaver<Profile>(remote.version,
          (server) => { skipSaveRef.current = true; setProfile(rollWeekSnapshot(migrate(server))); },
          setSyncOk);
        if (remote.data) skipSaveRef.current = true;
        setProfile(fresh);
        setSessionStart(structuredClone(fresh.mastery));
        setDataReady(true);
      } catch {
        if (alive) { setSyncOk(false); setDataReady(true); }
      }
    })();
    return () => { alive = false; };
  }, [auth, userId, storage]);

  useEffect(() => {
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    if (ownerRef.current) saverRef.current?.schedule(profile);
    else if (auth.status !== 'signedIn' && auth.status !== 'loading') storage.save(profile);
  }, [profile, storage, auth.status]);

  // Don't lose the last answer when the tab closes.
  useEffect(() => {
    const flush = () => { void saverRef.current?.flush(); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  // Logging out clears what's private on this device: speech, word help for uploads, page memory.
  useEffect(() => onSignOut(async () => {
    stopSpeaking();
    await saverRef.current?.flush();
    forgetWordHelp();
    try { sessionStorage.clear(); } catch { /* blocked */ }
  }), []);
  useEffect(() => { void loadStatus(); }, []);
  // The learner's name never leaves the device, including in the natural voice.
  useEffect(() => {
    const s = profile.settings;
    setVoicePrefs({ engine: s.voiceEngine, naturalVoice: s.naturalVoice, deviceVoice: s.voiceName, privateWords: [profile.name] });
  }, [profile.settings, profile.name]);
  useEffect(() => { applySettings(profile.settings, reducedMotion); }, [profile.settings, reducedMotion]);

  const settingsRef = useRef(profile.settings);
  settingsRef.current = profile.settings;

  const update = useCallback((fn: (p: Profile) => Profile) => setProfile((p) => fn(p)), []);

  const go = useCallback((s: Screen) => {
    stopSpeaking();
    const state = s.name === 'game' ? { items: s.items } : s.name === 'complete' ? { summary: s.summary } : undefined;
    // A finished round replaces the round page, so "back" returns to the Classroom, not a restarted round.
    navigate(screenPath(s), { state, replace: s.name === 'complete' });
    window.scrollTo?.({ top: 0 });
  }, [navigate]);

  const announce = useCallback((text: string) => {
    // Clear first so repeating the same words is announced again.
    setLiveText('');
    requestAnimationFrame(() => setLiveText(text));
  }, []);

  const speakParts = useCallback((parts: Part[]) => speakSequence(parts), []);

  const say = useCallback((text: string, opts: { silent?: boolean } = {}) => {
    announce(text);
    if (opts.silent) return;
    const rate = settingsRef.current.voiceRate;
    void speakSequence(toBubbles(text).map((t) => ({ text: t, rate, pauseMs: 250, style: 'lumo' as const })));
  }, [announce]);

  const speakWord = useCallback((text: string, rate = 0.8) => {
    // Word prompts are a little slower than Lumo's lines, so each sound is clear.
    const r = settingsRef.current.voiceRate >= 1 ? rate + 0.1 : rate;
    return speak(text, { rate: r, style: 'word' });
  }, []);

  const loadDemo = useCallback(() => {
    const demo = demoProfile();
    setProfile((p) => ({ ...demo, settings: p.settings }));
    setSessionStart(structuredClone(demo.mastery));
  }, []);

  const reset = useCallback(async (opts: { everything?: boolean } = {}) => {
    stopSpeaking();
    if (!userId) storage.clear();
    forgetLibrary();
    forgetWordHelp();
    await clearUploads();
    if (opts.everything) {
      // Forget this device: settings, uploads, cached voice and intro too.
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith('lumen.')) localStorage.removeItem(k);
        sessionStorage.clear();
        if ('caches' in window) await caches.delete('lumo-voice-v1');
      } catch { /* storage blocked */ }
    }
    const fresh = newProfile();
    setProfile((p) => ({ ...fresh, settings: opts.everything ? fresh.settings : p.settings }));
    setSessionStart({});
    navigate('/', { replace: true });
  }, [storage, navigate]);

  const value: LumenContext = {
    profile, update, storageOk: storage.available || Boolean(userId), sessionStart, go, reducedMotion,
    savedIn: userId ? 'account' : 'device', dataReady, syncOk,
    loadDemo, reset, say, speakWord, speakParts, announce,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">{liveText}</div>
    </Ctx.Provider>
  );
}

export function useLumen(): LumenContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLumen must be used inside <LumenProvider>');
  return ctx;
}
