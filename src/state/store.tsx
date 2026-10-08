import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createStorage, newProfile, type Profile, type Settings } from './profile';
import { demoProfile } from './demo';
import { rollWeekSnapshot, type RoundSummary } from '../engine/session';
import type { GameId, Mastery, Word } from '../engine/types';
import { setSfxEnabled } from '../services/sfx';
import { speak, speakSequence, stopSpeaking } from '../services/speech';
import { toBubbles } from '../data/lines';

export type Screen =
  | { name: 'welcome' }
  | { name: 'hub' }
  | { name: 'game'; game: GameId; words?: Word[] }
  | { name: 'complete'; summary: RoundSummary }
  | { name: 'closet' }
  | { name: 'settings' }
  | { name: 'grownup' };

interface LumenContext {
  profile: Profile;
  update: (fn: (p: Profile) => Profile) => void;
  storageOk: boolean;
  /** Mastery when the app opened, used to detect improvement this session. */
  sessionStart: Mastery;
  screen: Screen;
  /** Increments on every navigation; keys screens so "Play again" starts fresh. */
  navId: number;
  go: (s: Screen) => void;
  reducedMotion: boolean;
  loadDemo: () => void;
  reset: () => void;
  /** Lumo's current line(s), shown in a bubble and spoken. */
  say: (text: string, opts?: { silent?: boolean }) => void;
  speakWord: (text: string, rate?: number) => Promise<void>;
  speakParts: (parts: { text: string; rate?: number; pauseMs?: number }[]) => Promise<void>;
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
  const [screen, setScreen] = useState<Screen>(() => (profile.onboarded ? { name: 'hub' } : { name: 'welcome' }));
  const [navId, setNavId] = useState(0);
  const [liveText, setLiveText] = useState('');
  const systemReduced = usePrefersReducedMotion();
  const reducedMotion = profile.settings.motion === 'reduced' || (profile.settings.motion === 'system' && systemReduced);

  useEffect(() => { storage.save(profile); }, [profile, storage]);
  useEffect(() => { applySettings(profile.settings, reducedMotion); }, [profile.settings, reducedMotion]);

  const settingsRef = useRef(profile.settings);
  settingsRef.current = profile.settings;

  const update = useCallback((fn: (p: Profile) => Profile) => setProfile((p) => fn(p)), []);

  const go = useCallback((s: Screen) => {
    stopSpeaking();
    setScreen(s);
    setNavId((n) => n + 1);
    window.scrollTo?.({ top: 0 });
  }, []);

  const announce = useCallback((text: string) => {
    // Clear first so repeating the same words is announced again.
    setLiveText('');
    requestAnimationFrame(() => setLiveText(text));
  }, []);

  const speakParts = useCallback(
    (parts: { text: string; rate?: number; pauseMs?: number }[]) => speakSequence(parts, settingsRef.current.voiceName),
    [],
  );

  const say = useCallback((text: string, opts: { silent?: boolean } = {}) => {
    announce(text);
    if (opts.silent) return;
    const rate = settingsRef.current.voiceRate;
    void speakSequence(toBubbles(text).map((t) => ({ text: t, rate, pauseMs: 250 })), settingsRef.current.voiceName);
  }, [announce]);

  const speakWord = useCallback((text: string, rate = 0.8) => {
    // Word prompts are a little slower than Lumo's lines, so each sound is clear.
    const r = settingsRef.current.voiceRate >= 1 ? rate + 0.1 : rate;
    return speak(text, { rate: r, voiceName: settingsRef.current.voiceName });
  }, []);

  const loadDemo = useCallback(() => {
    const demo = demoProfile();
    setProfile((p) => ({ ...demo, settings: p.settings }));
    setSessionStart(structuredClone(demo.mastery));
  }, []);

  const reset = useCallback(() => {
    stopSpeaking();
    storage.clear();
    const fresh = newProfile();
    setProfile((p) => ({ ...fresh, settings: p.settings }));
    setSessionStart({});
    setScreen({ name: 'welcome' });
  }, [storage]);

  const value: LumenContext = {
    profile, update, storageOk: storage.available, sessionStart, screen, navId, go, reducedMotion,
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
