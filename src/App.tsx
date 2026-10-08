import { useEffect, type ReactNode } from 'react';
import { useRouter, match } from './router';
import { useAuth, type AuthState } from './account/auth';
import { AuthPage, MePage } from './account/AccountPages';
import { useLumen } from './state/store';
import { WobbleDefs } from './components/Doodles';
import { Shell } from './components/Shell';
import { Lumo } from './components/Lumo';
import { Hero, AboutPage } from './screens/Hero';
import { Welcome } from './screens/Welcome';
import { Hub } from './screens/Hub';
import { GameScreen } from './screens/games/GameScreen';
import { RoundComplete } from './screens/RoundComplete';
import { Closet } from './screens/Closet';
import { ProgressPage } from './screens/Progress';
import { Settings } from './screens/Settings';
import { GrownUpGate } from './screens/GrownUp';
import { Library, AddReading, ReviewUpload, ReadStory, ReadUpload, ReadLumoStory } from './library/LibraryPages';
import { Playground, PlaygroundGame } from './playground/Playground';
import { ActivityScreen } from './classroom/ActivityScreen';
import { isGame, type RoundMode, type RoundSummary } from './engine/session';
import type { RoundItem } from './engine/practice';
import { ShortcutsHelp } from './components/Shortcuts';
import { SoundNotice } from './components/SoundNotice';

const MODES: RoundMode[] = ['detective', 'sound', 'builder', 'speller', 'mixed', 'review', 'milestone'];

function Redirect({ to }: { to: string }) {
  const { navigate } = useRouter();
  useEffect(() => { navigate(to, { replace: true }); }, [navigate, to]);
  return null;
}

function NotFound() {
  const { navigate } = useRouter();
  return (
    <main className="screen not-found" id="main">
      <Lumo pose="thinking" size={140} motion="none" />
      <h1 className="title" tabIndex={-1}>Lumo can't find that page</h1>
      <p>It may have moved. Let's go somewhere we know.</p>
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => navigate('/classroom')}>Go to the Classroom</button>
        <button type="button" className="btn" onClick={() => navigate('/')}>Start page</button>
      </div>
    </main>
  );
}

/** Resolves the current URL to a screen. `bare` screens hide the section navigation. */
/** Pages anyone can open. Everything else needs an account or guest mode. */
const PUBLIC = ['/', '/login', '/signup', '/about'];

function Loading() {
  return (
    <main className="screen loading-screen" id="main" aria-busy="true">
      <Lumo pose="loading" size={120} />
      <p className="hand">Getting your things ready…</p>
    </main>
  );
}

function resolve(path: string, search: string, state: unknown, onboarded: boolean, auth: AuthState, dataReady: boolean): { node: ReactNode; bare?: boolean; title: string } {
  let m: Record<string, string> | null;
  if (path === '/') return { node: <Hero />, bare: true, title: 'Lumen' };
  if (path === '/about') return { node: <AboutPage />, bare: true, title: 'About' };
  if (path === '/login') return { node: <AuthPage mode="login" />, bare: true, title: 'Log in' };
  if (path === '/signup') return { node: <AuthPage mode="signup" />, bare: true, title: 'Make an account' };
  if (!PUBLIC.includes(path)) {
    if (auth.status === 'loading' || !dataReady) return { node: <Loading />, bare: true, title: 'Loading' };
    if (auth.status === 'signedOut') return { node: <Redirect to={`/login?next=${encodeURIComponent(path + search)}`} />, bare: true, title: 'Log in' };
  }
  if (path === '/me') return { node: <MePage />, title: 'About me' };
  if (path === '/start') return { node: onboarded ? <Redirect to="/classroom" /> : <Welcome />, bare: true, title: 'Welcome' };
  if (path.startsWith('/classroom') && !onboarded) return { node: <Redirect to="/start" />, bare: true, title: 'Welcome' };
  if (path === '/classroom') return { node: <Hub />, title: 'Classroom' };
  if ((m = match('/classroom/play/:mode', path))) {
    const mode = m.mode as RoundMode;
    if (!MODES.includes(mode)) return { node: <NotFound />, title: 'Not found' };
    const items = (state as { items?: RoundItem[] } | null)?.items;
    return { node: <GameScreen mode={mode} items={items} />, bare: true, title: isGame(mode) ? 'Playing' : 'Practice' };
  }
  if (path === '/classroom/done') {
    const summary = (state as { summary?: RoundSummary } | null)?.summary;
    return { node: summary ? <RoundComplete summary={summary} /> : <Redirect to="/classroom" />, bare: true, title: 'Round complete' };
  }
  if ((m = match('/classroom/activity/:id', path))) return { node: <ActivityScreen id={m.id} />, bare: true, title: 'Activity' };
  if (path === '/classroom/closet') return { node: <Closet />, title: "Lumo's closet" };
  if (path === '/classroom/progress') return { node: <ProgressPage />, title: 'Your progress' };
  if (path === '/library') return { node: <Library />, title: 'Library' };
  if (path === '/library/add') return { node: <AddReading />, title: 'Add reading' };
  if ((m = match('/library/review/:id', path))) return { node: <ReviewUpload id={m.id} />, title: 'Check the text' };
  if ((m = match('/library/read/story/:id', path))) return { node: <ReadStory id={m.id} />, bare: true, title: 'Reading' };
  if ((m = match('/library/read/lumo/:id', path))) return { node: <ReadLumoStory id={m.id} />, bare: true, title: 'Reading' };
  if ((m = match('/library/read/upload/:id', path))) return { node: <ReadUpload id={m.id} />, bare: true, title: 'Reading' };
  if (path === '/playground') return { node: <Playground />, title: 'Playground' };
  if ((m = match('/playground/:game', path))) return { node: <PlaygroundGame id={m.game} />, bare: true, title: 'Playground' };
  if (path === '/settings') return { node: <Settings />, title: 'Settings' };
  if (path === '/grown-ups') return { node: <GrownUpGate />, title: 'For grown-ups' };
  return { node: <NotFound />, title: 'Not found' };
}

export function App() {
  const { location } = useRouter();
  const { profile, dataReady } = useLumen();
  const { auth } = useAuth();
  const { node, bare, title } = resolve(location.path, location.query.toString() ? `?${location.query.toString()}` : '', location.state, profile.onboarded, auth, dataReady);

  // Each page sets a clear title and moves focus to its heading. (Speech from the page
  // before is stopped at navigation time, so the new page's first words aren't cut off.)
  useEffect(() => {
    document.title = title === 'Lumen' ? 'Lumen · Read, play and learn' : `${title} · Lumen`;
    requestAnimationFrame(() => {
      const h = document.querySelector<HTMLElement>('#main h1');
      if (h && !h.contains(document.activeElement)) {
        if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    });
  }, [location.key, title]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <WobbleDefs />
      <Shell bare={bare}>
        <div className="route" key={location.key}>{node}</div>
      </Shell>
      <ShortcutsHelp />
      <SoundNotice />
    </>
  );
}
