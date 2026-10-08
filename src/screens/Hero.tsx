import { useEffect, useRef, useState } from 'react';
import { useRouter } from '../router';
import { useLumen } from '../state/store';
import { Lumo } from '../components/Lumo';
import { Squiggle, Sparkle } from '../components/Doodles';
import { Arrow } from '../components/Icons';
import { activePath } from '../state/profile';
import { courseOf, unitAt } from '../engine/courses';
import { UNIT_SIZE } from '../engine/practice';
import { lastReading } from '../library/progress';

const B = import.meta.env.BASE_URL;
const INTRO_KEY = 'lumen.introSeen';

function introSeen(): boolean {
  try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; }
}

/** The welcoming front page, with Lumo's short opening. */
export function Hero() {
  const { profile, reducedMotion } = useLumen();
  const { navigate } = useRouter();
  const returning = profile.onboarded;
  // Full opening on the first visit; a quick hello after that; nothing moving with reduced motion.
  const [phase, setPhase] = useState<'intro' | 'short' | 'done'>(() => (reducedMotion ? 'done' : introSeen() ? 'short' : 'intro'));
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (phase === 'done') return;
    const t = window.setTimeout(() => setPhase('done'), phase === 'intro' ? 2600 : 700);
    try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  const course = courseOf(profile.activeCourse);
  const nodes = activePath(profile).length;
  const unit = unitAt(course, Math.floor(nodes / UNIT_SIZE));
  const reading = lastReading();
  const start = () => navigate(returning ? '/classroom' : '/start');

  return (
    <main className={`hero hero-${phase}`} id="main">
      {phase !== 'done' && (
        <button type="button" className="skip-intro link" onClick={() => setPhase('done')}>Skip intro</button>
      )}
      <div className="hero-stage">
        <div className="hero-art" aria-hidden="true">
          <span className="hero-glow" />
          {/* Lumo flies in, then settles on the books. */}
          {phase !== 'done' && <span className="hero-lumo flyer"><Lumo pose="goodbye" size={170} motion="none" /></span>}
          <img className="hero-books" src={`${B}lumo/lumo-books.png`} alt="" />
          <Sparkle size={30} style={{ left: '8%', top: '12%' }} />
          <Sparkle size={22} color="#f6a7bb" style={{ right: '6%', top: '70%' }} />
        </div>

        <div className="hero-copy">
          <img className="hero-wordmark" src={`${B}lumo/wordmark.png`} alt="Lumen" />
          <div className="hero-heading">
            <h1 className="title hero-title" tabIndex={-1} ref={heading}>Read, play, and learn at your own pace.</h1>
            <span className="hero-wave" aria-hidden="true"><Lumo pose="welcome" size={78} motion={phase === 'done' ? 'hop' : 'none'} /></span>
          </div>
          <Squiggle color="#f2a65a" width={280} />
          <p className="hero-lede">
            Short word games, stories with help on every word, and a playground for breaks.
            No timers, no red crosses, and every word can be read aloud.
          </p>

          <div className="hero-actions">
            <button type="button" className="btn primary" onClick={start}>
              {returning ? 'Continue learning' : 'Start learning'} <Arrow size={26} />
            </button>
            {returning && (
              <p className="hero-continue">
                {profile.name ? `Welcome back, ${profile.name}. ` : 'Welcome back. '}
                You're on <strong>{course.title}</strong>, unit {unit.number}: {unit.title}.
                {reading && <> Or <a href={`${B}library/read/${reading.kind}/${reading.id}`} onClick={(e) => { e.preventDefault(); navigate(`/library/read/${reading.kind}/${reading.id}`); }}>keep reading “{reading.title}”</a>.</>}
              </p>
            )}
          </div>

          <div className="meet-lumo sticky yellow">
            <strong>Meet Lumo.</strong> Lumo is a little firefly who glows brighter as you practise.
            Lumo reads words aloud, gives hints, and never minds a mistake.
          </div>
        </div>
      </div>

      <section className="how-strip" aria-label="How Lumen works">
        {[
          { n: 1, title: 'Pick a place', text: 'Classroom, Library or Playground.', pose: 'guiding' as const },
          { n: 2, title: 'Learn your way', text: 'Short games that change with you.', pose: 'laptop' as const },
          { n: 3, title: 'Get help on any word', text: 'Tap a word to hear it and learn it.', pose: 'reading' as const },
          { n: 4, title: 'Watch Lumo glow', text: 'Practice makes Lumo brighter.', pose: 'love' as const },
        ].map((s) => (
          <div key={s.n} className="how-step">
            <Lumo pose={s.pose} size={86} motion="none" />
            <span className="step-n" aria-hidden="true">{s.n}</span>
            <strong>{s.title}</strong>
            <span className="muted">{s.text}</span>
          </div>
        ))}
      </section>

      <nav className="hero-cards" aria-label="Sections">
        {[
          { to: '/playground', title: 'Playground', text: 'Memory, puzzles and patterns. Just for fun.', pose: 'happy' as const, hatch: 'hatch-blush' },
          { to: '/library', title: 'Library', text: 'Stories, and your own pages. Tap any word for help.', pose: 'reading' as const, hatch: 'hatch-sky' },
          { to: '/classroom', title: 'Classroom', text: 'Word games that grow with you.', pose: 'guiding' as const, hatch: 'hatch-yellow' },
        ].map((c, i) => (
          <a key={c.to} href={`${B}${c.to.slice(1)}`} className={`hero-card sketch ${i === 1 ? 'alt' : ''}`} style={{ animationDelay: `${120 + i * 80}ms` }}
            onClick={(e) => { e.preventDefault(); navigate(c.to === '/classroom' && !returning ? '/start' : c.to); }}>
            <span className={`hero-card-art ${c.hatch}`}><Lumo pose={c.pose} size={86} motion="none" /></span>
            <span className="hero-card-title">{c.title}</span>
            <span className="hero-card-text">{c.text}</span>
          </a>
        ))}
      </nav>

      <section className="moods" aria-label="Lumo's moods">
        {([['happy', 'Happy'], ['thinking', 'Thinking'], ['encouraging', 'Encouraging'], ['guiding', 'Helping'], ['celebrating', 'Celebrating'], ['resting', 'Resting']] as const).map(([pose, label]) => (
          <span key={pose} className="mood"><Lumo pose={pose} size={64} motion="none" />{label}</span>
        ))}
      </section>

      <p className="hand muted hero-foot">Designed for dyslexic learners. Enjoyable for everyone. No sign-up: progress stays on this device.</p>
    </main>
  );
}
