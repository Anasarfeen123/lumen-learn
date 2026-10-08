import { useEffect, useRef, useState, type FormEvent } from 'react';
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

  // Already signed in: there's nothing to do here.
  useEffect(() => {
    if (auth.status === 'signedIn') navigate(next, { replace: true });
  }, [auth.status, navigate, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = mode === 'login' ? await logIn(email, password) : await signUp(email, password, name.trim(), guestData && keep);
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

  const other = mode === 'login' ? '/signup' : '/login';
  return (
    <main className="screen auth-page" id="main">
      <a className="auth-logo" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
        <img src={`${B}lumo/wordmark.png`} alt="Lumen home" />
      </a>
      <div className="auth-wrap">
        <div className="auth-art" aria-hidden="true">
          <Lumo pose={mode === 'login' ? 'welcome' : 'reading'} size={200} />
          <p className="hand">{mode === 'login' ? 'Welcome back!' : 'Small steps, big progress.'}</p>
        </div>
        <form className="auth-card sketch" onSubmit={(e) => void submit(e)} noValidate>
          <h1 className="title" tabIndex={-1}>{mode === 'login' ? 'Log in' : 'Make your account'}</h1>
          <p className="muted">{mode === 'login' ? 'Your progress is waiting for you.' : 'Save your progress and pick up on any device.'}</p>
          {!accountsAvailable && <p className="banner">Accounts need Lumen's server. You can still learn as a guest on this device.</p>}
          {error && <p className="banner error" role="alert" tabIndex={-1} ref={errRef}>{error}</p>}
          {mode === 'signup' && (
            <label className="field">
              <span>What should Lumo call you? <span className="muted">(optional)</span></span>
              <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" />
            </label>
          )}
          <label className="field">
            <span>Email {mode === 'signup' && <span className="muted">(a grown-up's is fine)</span>}</span>
            <input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Password {mode === 'signup' && <span className="muted">(8 or more characters)</span>}</span>
            <span className="pw-row">
              <input className="text-input" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required />
              <button type="button" className="btn small" onClick={() => setShowPw((s) => !s)} aria-pressed={showPw}>{showPw ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          {guestData && (
            <label className="check">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
              <span>Keep the progress I made on this device</span>
            </label>
          )}
          <button type="submit" className="btn primary big" disabled={busy || !accountsAvailable} aria-busy={busy}>
            {busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
          <p className="auth-switch">
            {mode === 'login' ? 'New to Lumen?' : 'Already have an account?'}{' '}
            <a href={other} onClick={(e) => { e.preventDefault(); navigate(`${other}${location.query.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true }); }}>
              {mode === 'login' ? 'Make an account' : 'Log in'}
            </a>
          </p>
          <div className="auth-or"><span>or</span></div>
          <button type="button" className="btn" onClick={guest}>Try it as a guest</button>
          <p className="muted small">Guest progress stays on this device only.</p>
        </form>
      </div>
    </main>
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
          <label className="field">
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
