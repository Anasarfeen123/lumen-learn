import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, sectionOf } from '../router';
import { useLumen } from '../state/store';
import { stopSpeaking } from '../services/speech';
import { Modal } from './ui';

const B = import.meta.env.BASE_URL;

type Tab = 'playground' | 'library' | 'classroom' | 'progress';
const TABS: { id: Tab; label: string; Icon: () => ReactNode }[] = [
  { id: 'classroom', label: 'Classroom', Icon: ClassIcon },
  { id: 'library', label: 'Library', Icon: BookIcon },
  { id: 'playground', label: 'Playground', Icon: PlayIcon },
  { id: 'progress', label: 'Progress', Icon: ChartIcon },
];

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M5 20V12M12 20V5M19 20v-9" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="7" width="19" height="11" rx="5" /><path d="M7.5 10.5v4M5.5 12.5h4" /><circle cx="15.5" cy="11.5" r="1" fill="currentColor" /><circle cx="17.5" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5v13c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5z" /><path d="M12 6v13" />
    </svg>
  );
}
function ClassIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5 2.5 8.5 12 13.5l9.5-5z" /><path d="M6 10.5v5c2 2 10 2 12 0v-5" /><path d="M21.5 8.5v6" />
    </svg>
  );
}

/** The account menu: this device's learner profile. Lumen has no accounts by design. */
function AccountMenu() {
  const { profile, go, reset } = useLumen();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const [forget, setForget] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  const exit = () => {
    // Progress is saved on every answer; exiting just stops sound and goes home.
    stopSpeaking();
    setOpen(false);
    navigate('/');
  };

  const initial = (profile.name || 'Me').slice(0, 1).toUpperCase();
  return (
    <div className="account" ref={ref}>
      <button type="button" className="account-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{initial}</span>
        <span className="account-name">{profile.name || 'Learner'}</span>
      </button>
      {open && (
        <div className="menu sketch" role="menu" aria-label="Account">
          <p className="menu-note">Progress is saved on this device. Lumen has no accounts or passwords.</p>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); go({ name: 'settings' }); }}>Settings</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); go({ name: 'grownup' }); }}>For grown-ups</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); go({ name: 'closet' }); }}>Lumo's closet</button>
          <hr />
          <button type="button" role="menuitem" onClick={exit}>Exit to start page</button>
          <button type="button" role="menuitem" className="danger-soft" onClick={() => { setOpen(false); setForget(true); }}>Forget this device…</button>
        </div>
      )}
      {forget && (
        <Modal title="Forget this device?" onClose={() => setForget(false)}>
          <h2 className="title" style={{ fontSize: 32 }}>Forget this device?</h2>
          <p>This removes {profile.name ? `${profile.name}'s` : 'this learner’s'} progress, uploads and settings from this browser. It can't be undone.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setForget(false)}>Keep everything</button>
            <button type="button" className="btn amber" onClick={() => { setForget(false); void reset({ everything: true }); }}>Forget</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Top bar (desktop) and bottom bar (mobile) shared by the three sections. */
export function Shell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const { location, navigate, openSection } = useRouter();
  // Progress lives inside the Classroom, but has its own tab.
  const active = location.path.startsWith('/classroom/progress') ? 'progress' : sectionOf(location.path);

  if (bare) return <>{children}</>;
  return (
    <div className="shell">
      <header className="appbar">
        <a className="brand" href={`${B}`} onClick={(e) => { e.preventDefault(); navigate('/'); }} aria-label="Lumen home">
          <img src={`${B}lumo/wordmark.png`} alt="Lumen" />
        </a>
        <nav className="tabs" aria-label="Main">
          {TABS.map(({ id, label, Icon }) => (
            <a key={id} href={`${B}${id === 'progress' ? 'classroom/progress' : id}`} className={`tab ${active === id ? 'active' : ''}`} aria-current={active === id ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); if (id === 'progress') navigate('/classroom/progress'); else openSection(id); }}>
              <Icon /><span>{label}</span>
            </a>
          ))}
        </nav>
        <AccountMenu />
      </header>
      <div className="shell-body">{children}</div>
    </div>
  );
}
