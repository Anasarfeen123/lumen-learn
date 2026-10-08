import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from '../router';
import { useAuth } from './auth';
import { useLumen } from '../state/store';
import { Lumo } from '../components/Lumo';
import { Picture } from '../components/Picture';
import { Modal } from '../components/ui';
import { pictureFor } from '../data/pictures';
import { INTERESTS, setInterests, usePersonal } from '../personal/personal';

const B = import.meta.env.BASE_URL;

/** Only same-site paths are allowed as "next" (no open redirects). */
function safeNext(q: URLSearchParams): string {
  const next = q.get('next') ?? '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/classroom';
}

function hasGuestProgress(): boolean {
  try {
    const p = JSON.parse(localStorage.getItem('lumen.profile.v1') ?? 'null');
    return Boolean(p && (p.xp > 0 || p.onboarded));
  } catch { return false; }
}

function Icon({ d, size = 20 }: { d: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  );
}
const ICON = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.5 4.6-1.2" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

const PERKS: { pose: 'reading' | 'laptop' | 'celebrating'; title: string; text: string }[] = [
  { pose: 'laptop', title: 'Pick up anywhere', text: 'Your progress follows you to any device.' },
  { pose: 'reading', title: 'Stories just for you', text: 'Lumo writes stories about what you like.' },
  { pose: 'celebrating', title: 'Never lose a win', text: 'Badges, streaks and stars stay safe.' },
];

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { auth, logIn, signUp, continueAsGuest, accountsAvailable } = useAuth();
  const { location, navigate } = useRouter();
  const next = safeNext(location.query);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [keep, setKeep] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const errRef = useRef<HTMLParagraphElement>(null);
  const guestData = mode === 'signup' && hasGuestProgress();
  const signup = mode === 'signup';
  const longEnough = password.length >= 8;

  // Already signed in: there's nothing to do here.
  useEffect(() => {
    if (auth.status === 'signedIn') navigate(next, { replace: true });
  }, [auth.status, navigate, next]);
  useEffect(() => { setError(''); }, [mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Please fill in your email and password.'); requestAnimationFrame(() => errRef.current?.focus()); return; }
    if (signup && !longEnough) { setError('Please use a password of at least 8 characters.'); requestAnimationFrame(() => errRef.current?.focus()); return; }
    setBusy(true);
    setError('');
    const err = signup ? await signUp(email, password, name.trim(), guestData && keep) : await logIn(email, password);
    setBusy(false);
    if (err) {
      setError(err);
      requestAnimationFrame(() => errRef.current?.focus());
    }
  };

  const guest = () => {
    continueAsGuest();
    navigate(next, { replace: true });
  };

  const switchTo = (m: 'login' | 'signup') => {
    if (m === mode) return;
    const q = location.query.get('next') ? `?next=${encodeURIComponent(next)}` : '';
    navigate(`/${m}${q}`, { replace: true });
  };

  return (
    <div className="landing au-page">
      <header className="au-top">
        <a href={B} onClick={(e) => { e.preventDefault(); navigate('/'); }} className="au-logo">
          <img src={`${B}lumo/wordmark.png`} alt="Lumen home" />
        </a>
        <a href={B} className="au-home" onClick={(e) => { e.preventDefault(); navigate('/'); }}>← Back to home</a>
      </header>

      <main id="main" className="au-wrap">
        <section className="au-card">
          <aside className="au-side" aria-hidden="true">
            <span className="au-cloud c1" /><span className="au-cloud c2" />
            <div className="au-side-lumo">
              <Lumo pose={signup ? 'reading' : 'welcome'} size={170} motion="none" />
            </div>
            <p className="au-side-hand">{signup ? 'Small steps, big progress.' : 'Welcome back, friend!'}</p>
            <ul className="au-perks">
              {PERKS.map((p) => (
                <li key={p.title}>
                  <span className="au-perk-art"><Lumo pose={p.pose} size={44} motion="none" /></span>
                  <span><b>{p.title}</b><span>{p.text}</span></span>
                </li>
              ))}
            </ul>
          </aside>

          <form className="au-form" onSubmit={(e) => void submit(e)} noValidate>
            <div className="au-switch" role="tablist" aria-label="Account">
              <button type="button" role="tab" aria-selected={!signup} className={!signup ? 'on' : ''} onClick={() => switchTo('login')}>Log in</button>
              <button type="button" role="tab" aria-selected={signup} className={signup ? 'on' : ''} onClick={() => switchTo('signup')}>Create account</button>
            </div>

            <h1 className="au-title" tabIndex={-1}>{signup ? 'Make your Lumen account' : 'Welcome back!'}</h1>
            <p className="au-sub">{signup ? 'Save your progress and keep learning on any device.' : 'Log in to pick up right where you left off.'}</p>

            {!accountsAvailable && <p className="au-note">Accounts need Lumen's server. You can still learn as a guest on this device.</p>}
            {error && <p className="au-error" role="alert" tabIndex={-1} ref={errRef}>{error}</p>}

            {signup && (
              <label className="au-field">
                <span className="au-label">What should Lumo call you? <em>optional</em></span>
                <span className="au-input">
                  <Icon d={ICON.user} />
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="Your first name or a nickname" />
                </span>
              </label>
            )}

            <label className="au-field">
              <span className="au-label">Email {signup && <em>a grown-up's email is fine</em>}</span>
              <span className="au-input">
                <Icon d={ICON.mail} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required inputMode="email" />
              </span>
            </label>

            <label className="au-field">
              <span className="au-label">Password</span>
              <span className="au-input">
                <Icon d={ICON.lock} />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required
                  placeholder={signup ? 'At least 8 characters' : 'Your password'} aria-describedby={signup ? 'pw-rule' : undefined} />
                <button type="button" className="au-eye" onClick={() => setShowPw((s) => !s)} aria-pressed={showPw} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  <Icon d={showPw ? ICON.eyeOff : ICON.eye} />
                </button>
              </span>
            </label>
            {signup && (
              <p id="pw-rule" className={`au-rule ${longEnough ? 'ok' : ''}`}>
                <span className="au-rule-dot"><Icon d={ICON.check} size={14} /></span> 8 or more characters
              </p>
            )}

            {guestData && (
              <label className="au-check">
                <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                <span>Keep the progress I made on this device</span>
              </label>
            )}

            <button type="submit" className="l-btn navy au-submit" disabled={busy || !accountsAvailable} aria-busy={busy}>
              {busy ? 'One moment…' : signup ? 'Create account' : 'Log in'} {!busy && <Icon d={ICON.arrow} />}
            </button>

            <div className="au-or"><span>or</span></div>
            <button type="button" className="l-btn ghost au-guest" onClick={guest}>Try it as a guest</button>
            <p className="au-fine">Guest progress stays on this device only. {signup ? 'Your password is stored securely, and Lumo’s AI never sees your name or email.' : ''}</p>
          </form>
        </section>
      </main>
    </div>
  );
}

/** "About me": what Lumo uses to personalise practice, and the account itself. */
export function MePage() {
  const { auth, logOut, deleteAccount } = useAuth();
  const { profile, savedIn, syncOk } = useLumen();
  const { navigate } = useRouter();
  const personal = usePersonal();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');

  const toggle = (id: string) => setInterests(personal.interests.includes(id) ? personal.interests.filter((x) => x !== id) : [...personal.interests, id]);

  return (
    <main className="screen me-page" id="main">
      <div className="section-head">
        <div>
          <h1 className="title" tabIndex={-1}>About me</h1>
          <p className="muted">Lumo uses this to choose stories and practice for you.</p>
        </div>
      </div>

      <section className="soft me-block" aria-labelledby="likes-h">
        <h2 id="likes-h" className="title small-title">Things I like</h2>
        <p className="muted">Pick up to six. Lumo writes stories about them.</p>
        <div className="interest-grid">
          {INTERESTS.map((i) => {
            const on = personal.interests.includes(i.id);
            const pic = pictureFor(i.picture);
            return (
              <button key={i.id} type="button" className={`interest ${on ? 'on' : ''}`} aria-pressed={on}
                disabled={!on && personal.interests.length >= 6} onClick={() => toggle(i.id)}>
                {pic && <Picture picture={pic} className="interest-pic" />}
                <span>{i.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="soft me-block" aria-labelledby="acct-h">
        <h2 id="acct-h" className="title small-title">My account</h2>
        {auth.status === 'signedIn' ? (
          <>
            <dl className="facts">
              <div><dt>Name</dt><dd>{profile.name || auth.user.name || '—'}</dd></div>
              <div><dt>Email</dt><dd>{auth.user.email}</dd></div>
              <div><dt>Progress</dt><dd>{syncOk ? 'Saved to your account' : 'Saving… (will retry)'}</dd></div>
            </dl>
            <div className="actions">
              <button type="button" className="btn" onClick={() => void logOut().then(() => navigate('/', { replace: true }))}>Log out</button>
              <button type="button" className="btn danger-soft" onClick={() => setConfirm(true)}>Delete my account…</button>
            </div>
          </>
        ) : (
          <>
            <p>You're learning as a guest. Progress is saved {savedIn === 'device' ? 'on this device only' : ''}.</p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => navigate('/signup?next=/me')}>Make an account to keep it</button>
              <button type="button" className="btn" onClick={() => navigate('/login?next=/me')}>Log in</button>
            </div>
          </>
        )}
        <p className="muted small">What Lumo's AI sees: the topics you like, which skills you're practising, and words from Lumen's word list. Never your name, email, or anything you upload.</p>
      </section>

      {confirm && auth.status === 'signedIn' && (
        <Modal title="Delete your account?" onClose={() => setConfirm(false)}>
          <h2 className="title" style={{ fontSize: 30 }}>Delete your account?</h2>
          <p>This erases your progress, uploads, Lumo's stories and settings from Lumen's database. It can't be undone.</p>
          <label className="field stack">
            <span>Type <b>delete</b> to confirm</span>
            <input className="text-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          {error && <p className="banner error" role="alert">{error}</p>}
          <div className="actions">
            <button type="button" className="btn" onClick={() => setConfirm(false)}>Keep my account</button>
            <button type="button" className="btn amber" disabled={typed.trim().toLowerCase() !== 'delete'}
              onClick={() => void deleteAccount().then((ok) => ok ? navigate('/', { replace: true }) : setError("That didn't work. Please try again."))}>
              Delete forever
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
