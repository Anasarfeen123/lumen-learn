import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from '../router';
import { useLumen } from '../state/store';
import { useAuth } from '../account/auth';
import { Lumo, type Pose } from '../components/Lumo';
import { Picture } from '../components/Picture';
import { pictureFor } from '../data/pictures';
import { speak } from '../services/speech';
import { burst, motionOn } from '../services/motion';
import { activePath } from '../state/profile';
import { courseOf, unitAt } from '../engine/courses';
import { UNIT_SIZE } from '../engine/practice';

const B = import.meta.env.BASE_URL;
const INTRO_KEY = 'lumen.introSeen';
const REPO = 'https://github.com/Anasarfeen123/lumen-learn';

function introSeen(): boolean {
  try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; }
}

/* ------------------------------------------------------------ small drawings */

function Star({ size = 22, color = '#f6c445', className = '', style }: { size?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`doodle-star ${className}`} style={style} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.1l6.1-.7z" fill={color} stroke="#2b2c5e" strokeOpacity=".15" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

/** A loose crayon underline under a word. */
function Underline({ color = '#f2a65a', width = 160 }: { color?: string; width?: number }) {
  return (
    <svg className="crayon-line" width={width} height="12" viewBox={`0 0 ${width} 12`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`M3 8 C ${width * 0.25} 3, ${width * 0.5} 10, ${width * 0.75} 5 S ${width - 4} 6, ${width - 3} 6`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}

function Cloud({ className = '' }: { className?: string }) {
  return (
    <svg className={`cloud ${className}`} viewBox="0 0 120 60" aria-hidden="true">
      <path d="M18 50c-9 0-14-6-13-13 1-8 9-12 16-10 2-11 12-18 24-16 8-9 25-8 31 3 11-3 22 4 22 15 9 0 15 6 14 13-1 6-6 8-12 8z" />
    </svg>
  );
}

function ArrowRight({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ------------------------------------------------------------ live preview */

/** A real, playable slice of a lesson: the product preview is the product. */
function LessonPreview() {
  const [picked, setPicked] = useState<string | null>(null);
  const right = picked === 'a';
  const lumoLine = picked === null ? 'Listen to the middle sound. What do you hear?' : right ? 'Yes! c-a-t, cat. Lovely listening.' : 'Close! Tap the speaker and listen again.';
  const cat = pictureFor('cat');
  return (
    <div className="preview-device" role="group" aria-label="Try a tiny lesson">
      <div className="preview-side" aria-hidden="true">
        <img src={`${B}lumo/wordmark.png`} alt="" className="preview-logo" />
        {['Home', 'Learn', 'Games', 'Stories', 'Progress'].map((l) => (
          <span key={l} className={`preview-nav ${l === 'Learn' ? 'on' : ''}`}>{l}</span>
        ))}
      </div>
      <div className="preview-main">
        <div className="preview-top">
          <span className="preview-bar" aria-hidden="true"><span style={{ width: right ? '72%' : '58%' }} /></span>
          <span className="preview-xp"><Star size={16} /> {right ? 22 : 12} XP</span>
        </div>
        <p className="preview-q">Find the missing letter</p>
        <div className="preview-task">
          {cat && <Picture picture={cat} className="preview-pic" />}
          <div className="preview-word" aria-label={`c, ${picked && right ? 'a' : 'blank'}, t`}>
            <span>c</span><span className={`gap ${right ? 'filled' : ''}`}>{right ? 'a' : ''}</span><span>t</span>
          </div>
          <button type="button" className="preview-audio" onClick={() => void speak('cat', { style: 'word', rate: 0.85 })} aria-label="Hear the word">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
          </button>
        </div>
        <div className="preview-options" role="radiogroup" aria-label="Pick a letter">
          {['a', 'o', 'u'].map((l) => (
            <button key={l} type="button" role="radio" aria-checked={picked === l}
              className={`preview-opt ${picked === l ? (l === 'a' ? 'right' : 'try') : ''}`}
              onClick={(e) => { setPicked(l); if (l === 'a') burst(e.currentTarget, { count: 20 }); }}>{l}</button>
          ))}
        </div>
        <div className="preview-lumo" aria-live="polite">
          <Lumo pose={picked === null ? 'thinking' : right ? 'celebrating' : 'encouraging'} size={64} motion="none" />
          <p className="preview-bubble">{lumoLine}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ pointer motion */

/** Gentle depth: layers drift a little with the pointer (mouse only, never with reduced motion). */
function useParallax() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia?.('(pointer: fine)').matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (!motionOn()) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--px', String(((e.clientX - r.left) / r.width - 0.5).toFixed(3)));
        el.style.setProperty('--py', String(((e.clientY - r.top) / r.height - 0.5).toFixed(3)));
      });
    };
    const reset = () => { el.style.setProperty('--px', '0'); el.style.setProperty('--py', '0'); };
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', reset);
    return () => { window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', reset); cancelAnimationFrame(frame); };
  }, []);
  return ref;
}

/** A card that tilts toward the pointer, like picking up a real card. */
function tiltHandlers() {
  return {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse' || !motionOn()) return;
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--rx', `${(((e.clientY - r.top) / r.height) - 0.5) * -7}deg`);
      e.currentTarget.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 9}deg`);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.style.setProperty('--rx', '0deg');
      e.currentTarget.style.setProperty('--ry', '0deg');
    },
  };
}

/* ------------------------------------------------------------ page */

function Reveal({ children, className = '', as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div'; id?: string; 'aria-labelledby'?: string; 'aria-label'?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as never} className={`${className} reveal ${shown ? 'in' : ''}`} {...rest}>{children}</Tag>;
}

const VALUES: { title: string; text: string; pose: Pose }[] = [
  { title: 'Short, focused practice', text: 'Small activities that are easy to start and finish.', pose: 'reading' },
  { title: 'Words you can hear', text: 'Tap to listen to any word or sentence.', pose: 'idle' },
  { title: 'Games that adapt', text: 'Activities follow your pace and what you like.', pose: 'laptop' },
  { title: 'Progress without pressure', text: 'Celebrate effort, not speed.', pose: 'celebrating' },
];

const PLACES = [
  { to: '/playground', title: 'Playground', text: 'Memory, puzzles and patterns. Just for fun.', pose: 'happy' as Pose, tone: 'pink', props: ['star', 'drum'] },
  { to: '/library', title: 'Library', text: 'Stories and pages where every word can be heard and explored.', pose: 'reading' as Pose, tone: 'blue', props: ['stack of books'] },
  { to: '/classroom', title: 'Classroom', text: 'Short word games that grow with you.', pose: 'guiding' as Pose, tone: 'yellow', props: [] as string[] },
];

const FLOW = [
  { title: 'Try', text: 'Do an activity at your own pace.', tone: 'green', icon: <path d="M9 7l8 5-8 5z" fill="currentColor" /> },
  { title: 'Notice', text: 'Lumen sees what feels easy or tricky.', tone: 'lav', icon: <path d="M6 18v-5M11 18V9M16 18V6" strokeWidth="3" /> },
  { title: 'Adapt', text: 'New activities match what you need.', tone: 'pink', icon: <path d="M5 8h14M5 16h14M9 5v6M15 13v6" /> },
  { title: 'Grow', text: 'Keep building skills over time.', tone: 'yellow', icon: <path d="M12 3.5l2.4 5 5.5.6-4.1 3.8 1.1 5.4-4.9-2.8-4.9 2.8 1.1-5.4L4.1 9.1l5.5-.6z" fill="currentColor" /> },
];

const MOODS: [Pose, string][] = [['happy', 'Happy'], ['thinking', 'Thinking'], ['encouraging', 'Encouraging'], ['guiding', 'Helping'], ['celebrating', 'Celebrating'], ['resting', 'Resting']];

/** The front page: what Lumen is, and the way in. */
export function Hero() {
  const { profile, reducedMotion } = useLumen();
  const { auth } = useAuth();
  const { navigate } = useRouter();
  const inside = auth.status === 'signedIn' || auth.status === 'guest';
  const returning = inside && profile.onboarded;
  // Lumo's short opening: on the first visit only, skippable, and never with reduced motion.
  const [intro, setIntro] = useState(() => !reducedMotion && !introSeen());
  const heading = useRef<HTMLHeadingElement>(null);
  const art = useParallax();

  useEffect(() => {
    if (!intro) return;
    try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }
    const t = window.setTimeout(() => setIntro(false), 2400);
    return () => window.clearTimeout(t);
  }, [intro]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  const start = () => navigate(!inside ? '/signup' : profile.onboarded ? '/classroom' : '/start');
  const open = (to: string) => navigate(!inside ? `/login?next=${encodeURIComponent(to)}` : !profile.onboarded && to.startsWith('/classroom') ? '/start' : to);
  const link = (to: string, label: ReactNode, className = '') => (
    <a className={className} href={`${B}${to.slice(1)}`} onClick={(e) => { e.preventDefault(); open(to); }}>{label}</a>
  );
  const course = courseOf(profile.activeCourse);
  const unit = unitAt(course, Math.floor(activePath(profile).length / UNIT_SIZE));

  return (
    <div className={`landing ${intro ? 'landing-intro' : ''}`}>
      {intro && <button type="button" className="skip-intro" onClick={() => setIntro(false)}>Skip intro</button>}

      <header className="l-nav">
        <a href={B} className="l-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }); }}>
          <img src={`${B}lumo/wordmark.png`} alt="Lumen" />
        </a>
        <nav className="l-links" aria-label="Lumen">
          {link('/classroom', 'Learn')}
          {link('/playground', 'Games')}
          {link('/library', 'Stories')}
          {link('/classroom/progress', 'Progress')}
        </nav>
        <div className="l-nav-end">
          {!inside && <a className="l-login" href={`${B}login`} onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Log in</a>}
          <button type="button" className="l-btn navy small" onClick={start}>{returning ? 'Open Lumen' : 'Get started'} <ArrowRight size={18} /></button>
        </div>
      </header>

      <main id="main">
        {/* 1. hero */}
        <section className="l-hero" aria-labelledby="hero-h">
          <div className="l-hero-copy">
            <p className="l-eyebrow">Learn differently.<Underline width={150} /></p>
            <h1 id="hero-h" className="l-h1" tabIndex={-1} ref={heading}>Read, play, and learn at your own pace.</h1>
            <p className="l-lede">Lumen turns reading practice into playful little steps — with helpful words, short games, and Lumo cheering you on.</p>
            <div className="l-ctas">
              <button type="button" className="l-btn navy" onClick={start}>{returning ? 'Continue learning' : 'Start learning'} <ArrowRight /></button>
              <a className="l-btn ghost" href="#how" onClick={(e) => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); }}>See how it works</a>
            </div>
            {returning ? (
              <p className="l-note">{profile.name ? `Welcome back, ${profile.name}. ` : 'Welcome back. '}You're on {course.title}, unit {unit.number}.</p>
            ) : (
              <p className="l-note"><span className="l-sun" aria-hidden="true" /> Designed with dyslexic learners in mind.</p>
            )}
          </div>
          <div className="l-hero-art" aria-hidden="true" ref={art}>
            <Cloud className="c1" /><Cloud className="c2" /><Cloud className="c3" />
            <span className="l-glow" />
            {intro && <span className="l-flyer"><Lumo pose="goodbye" size={150} motion="none" /></span>}
            <img className="l-books" src={`${B}lumo/lumo-books.png`} alt="" />
            <Star size={30} style={{ left: '10%', top: '14%' }} className="twinkle" />
            <Star size={20} color="#b9b4f0" style={{ right: '14%', top: '6%' }} className="twinkle d2" />
            <Star size={16} style={{ right: '4%', bottom: '28%' }} className="twinkle d3" />
          </div>
        </section>

        {/* 2. value strip */}
        <Reveal className="l-values" aria-label="Why Lumen">
          {VALUES.map((v) => (
            <div key={v.title} className="l-value">
              <span className="l-value-art"><Lumo pose={v.pose} size={78} motion="none" /></span>
              <h2>{v.title}</h2>
              <p>{v.text}</p>
            </div>
          ))}
        </Reveal>

        {/* 3. learning that fits you */}
        <Reveal className="l-section" id="how" aria-labelledby="fits-h">
          <h2 id="fits-h" className="l-h2">Learning that fits you.<Underline width={240} /></h2>
          <p className="l-sub">Practice reading, spelling, sounds and comprehension through activities that adapt as you learn.</p>
          <div className="l-places">
            {PLACES.map((p) => (
              <a key={p.to} href={`${B}${p.to.slice(1)}`} className={`l-place ${p.tone}`} onClick={(e) => { e.preventDefault(); open(p.to); }} {...tiltHandlers()}>
                <span className="l-place-art" aria-hidden="true">
                  {p.props.map((name) => { const pic = pictureFor(name); return pic ? <Picture key={name} picture={pic} className="l-prop" /> : null; })}
                  {p.tone === 'yellow' && <span className="l-tiles"><span>a</span><span>b</span><span>c</span></span>}
                  <Lumo pose={p.pose} size={118} motion="none" />
                </span>
                <span className="l-place-body">
                  <span className="l-place-title">{p.title}</span>
                  <span className="l-place-text">{p.text}</span>
                  <span className="l-place-go" aria-hidden="true"><ArrowRight size={18} /></span>
                </span>
              </a>
            ))}
          </div>
        </Reveal>

        {/* 4. adaptive */}
        <Reveal className="l-adapt" aria-labelledby="adapt-h">
          <div className="l-adapt-art" aria-hidden="true">
            <Cloud className="c4" />
            {(() => { const pic = pictureFor('stack of books'); return pic ? <Picture picture={pic} className="l-adapt-books" /> : null; })()}
            <span className="l-open-book">
              <span className="page left"><i /><i /><i /><i /></span>
              <span className="page right"><i /><i /><i /><i /></span>
            </span>
            <span className="l-adapt-lumo"><Lumo pose="guiding" size={170} motion="none" /></span>
            <span className="l-say">You can<br />do it!</span>
            <Star size={26} style={{ left: '18%', top: '12%' }} />
            <Star size={20} style={{ right: '30%', top: '18%' }} color="#f6a7bb" />
          </div>
          <div className="l-adapt-copy">
            <h2 id="adapt-h" className="l-h2">Your practice changes with you.<Underline width={260} /></h2>
            <p className="l-sub">Lumen notices which activities feel easy and which feel tricky, then gently shapes what comes next. More of what helps, less of what's already easy.</p>
            <ol className="l-flow">
              {FLOW.map((f, i) => (
                <li key={f.title} className={`l-flow-step ${f.tone}`}>
                  <span className="l-flow-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
                  </span>
                  <b>{f.title}</b>
                  <span>{f.text}</span>
                  {i < FLOW.length - 1 && <span className="l-flow-arrow" aria-hidden="true">→</span>}
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        {/* 5 + 6. meet Lumo, and the product itself */}
        <Reveal className="l-meet" aria-labelledby="meet-h">
          <div className="l-meet-copy">
            <h2 id="meet-h" className="l-h2">Meet Lumo.<Underline width={170} /></h2>
            <p className="l-sub">A little learning buddy who celebrates the wins, helps when you're stuck, and never minds a mistake.</p>
            <ul className="l-moods">
              {MOODS.map(([pose, label]) => (
                <li key={pose}><Lumo pose={pose} size={70} motion="none" /><span>{label}</span></li>
              ))}
            </ul>
          </div>
          <div className="l-preview">
            <div className="l-preview-tilt" {...tiltHandlers()}><LessonPreview /></div>
            <p className="l-preview-note">This is real: tap a letter, or the speaker.</p>
          </div>
        </Reveal>

        {/* 7. final call */}
        <Reveal className="l-final" aria-labelledby="final-h">
          <div className="l-final-copy">
            <h2 id="final-h" className="l-h2 light">Ready to take the next little step?<Underline width={200} color="#f6c445" /></h2>
            <p>Learning doesn't have to feel like a race.</p>
            <button type="button" className="l-btn yellow" onClick={start}>{returning ? 'Continue learning' : 'Start learning'} <ArrowRight /></button>
          </div>
          <img className="l-night" src={`${B}lumo/night-hill.png`} alt="" aria-hidden="true" />
        </Reveal>
      </main>

      <footer className="l-foot">
        <div className="l-foot-brand">
          <img src={`${B}lumo/wordmark.png`} alt="Lumen" />
          <span>Learn differently.</span>
        </div>
        <nav aria-label="About Lumen" className="l-foot-links">
          <a href={`${B}about`} onClick={(e) => { e.preventDefault(); navigate('/about'); }}>About</a>
          <a href={`${B}about?section=accessibility`} onClick={(e) => { e.preventDefault(); navigate('/about?section=accessibility'); }}>Accessibility</a>
          <a href={`${B}about?section=privacy`} onClick={(e) => { e.preventDefault(); navigate('/about?section=privacy'); }}>Privacy</a>
          <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">Contact</a>
        </nav>
        <p className="l-foot-note">Designed for curious minds. Built for a kinder learning journey.</p>
      </footer>
    </div>
  );
}

/** About, accessibility and privacy, in plain words. */
export function AboutPage() {
  const { navigate, location } = useRouter();
  useEffect(() => {
    const id = location.query.get('section');
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [location.key]);
  return (
    <div className="landing about">
      <header className="l-nav">
        <a href={B} className="l-logo" onClick={(e) => { e.preventDefault(); navigate('/'); }}><img src={`${B}lumo/wordmark.png`} alt="Lumen home" /></a>
        <span />
        <button type="button" className="l-btn ghost small" onClick={() => navigate('/')}>Back to start</button>
      </header>
      <main id="main" className="about-body">
        <h1 className="l-h1 small" tabIndex={-1}>About Lumen</h1>
        <section id="about">
          <p>Lumen is a playful place to practise reading and spelling, built with dyslexic learners in mind and open to everyone. It offers short word games, stories where every word can be heard and explained, and a playground for breaks. Lumen is a learning tool. It doesn't diagnose or treat anything.</p>
        </section>
        <section id="accessibility">
          <h2 className="l-h2">Accessibility</h2>
          <ul>
            <li>Every word and instruction can be read aloud.</li>
            <li>Choose a reading font (Lexend, OpenDyslexic or Atkinson Hyperlegible), text size, colours and spacing in Settings.</li>
            <li>No timers on learning activities. Mistakes get hints, never red crosses.</li>
            <li>Works with a keyboard (press <kbd>?</kbd> for shortcuts) and screen readers, and respects “reduce motion”.</li>
          </ul>
        </section>
        <section id="privacy">
          <h2 className="l-h2">Privacy</h2>
          <ul>
            <li>With an account, progress, uploads and Lumo's stories are kept in Lumen's own database, only for you. You can delete your account and everything in it from “About me”.</li>
            <li>As a guest, everything stays in this browser.</li>
            <li>Passwords are stored as secure hashes. Sessions use a private cookie that page scripts can't read.</li>
            <li>Lumo's AI only sees the topics you like, which skills you're practising, and words from Lumen's word list. Never your name or email.</li>
            <li>Uploaded pages are read on Lumen's server. Printed text and PDFs never leave it; handwriting is read by an AI vision model (Groq) when that's switched on.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
