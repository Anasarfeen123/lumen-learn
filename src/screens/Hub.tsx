import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLumen } from '../state/store';
import { useRouter } from '../router';
import { Lumo, type Pose } from '../components/Lumo';
import { Bubble, Modal } from '../components/ui';
import { Signpost, Squiggle, Tree } from '../components/Doodles';
import { Abc, Beats, Blocks, BookOpen, Bulb, Chart, Chat, Check, Flame, Lock, Music, Pair, Pencil, Puzzle, Question, Refresh, Search, Shuffle, SortWords, Speaker, Sprout, Stars, Trophy } from '../components/Icons';
import { GlowUp } from './GlowUp';
import { GAMES, type GameId, type Tag } from '../engine/types';
import { dayKey, stageProgress, type Stage } from '../engine/progression';
import { nextSlot, openChest } from '../engine/session';
import { GAME_NAME, band } from '../engine/report';
import { COURSES, courseOf, slotAt, unitAt, type CourseId } from '../engine/courses';
import { mistakeCount, UNIT_SIZE, type NodeKind } from '../engine/practice';
import { masteryOf, weakestTag } from '../engine/adaptive';
import { GAME_FOR_TAG, PLAIN_NAME } from '../engine/tags';
import { activePath, type Profile } from '../state/profile';
import { lastReading } from '../library/progress';
import type { SkillId } from '../classroom/activities';
import { useLumoStatus } from '../services/useLumoStatus';
import { sfx } from '../services/sfx';
import { celebrate } from '../services/motion';
import { line } from '../data/lines';
import { ACTIVITIES } from '../classroom/activities';
import { PlanCard } from '../personal/PlanCard';

export const GAME_META: Record<GameId, { desc: string; hatch: string; accent: string; Icon: typeof Search }> = {
  detective: { desc: 'Spot the right spelling', hatch: 'hatch-lav', accent: 'var(--accent-detective)', Icon: Search },
  sound: { desc: 'Hear it, find it', hatch: 'hatch-blush', accent: 'var(--accent-sound)', Icon: Speaker },
  builder: { desc: 'Put the letters in order', hatch: 'hatch-leaf', accent: 'var(--accent-builder)', Icon: Blocks },
  speller: { desc: 'Spell it beat by beat', hatch: 'hatch-sky', accent: 'var(--accent-speller)', Icon: Beats },
};


/** The Classroom: the main learning destination. */
export function Hub() {
  const { profile, update, go, say, loadDemo, storageOk } = useLumen();
  const { navigate } = useRouter();
  const { canSpeak } = useLumoStatus();
  const [glowUp, setGlowUp] = useState<Stage | null>(null);
  const [picker, setPicker] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const { reducedMotion } = useLumen();
  const pathLen = activePath(profile).length;
  const { ref: flowRef, trail } = useFlowTrail(pathLen % UNIT_SIZE, [pathLen, profile.activeCourse, profile.settings.size]);
  // Glide to the next lesson on wider screens. Phones start with the home block, which has its own "continue".
  useEffect(() => {
    if (window.matchMedia?.('(max-width: 760px)').matches) return;
    nextRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [reducedMotion]);
  const games: GameId[] = canSpeak ? GAMES : GAMES.filter((g) => g !== 'sound');
  const course = courseOf(profile.activeCourse);
  const slot = nextSlot(profile, games);
  const rec = profile.recommended;
  const name = profile.name;
  const mistakes = mistakeCount(profile.mistakes);

  const greeting = useMemo(() => {
    const returning = profile.rounds.length > 0;
    const hello = returning ? line('hubReturning', name) : `Hi${name ? `, ${name}` : ''}!`;
    return `${hello} I picked ${GAME_NAME[rec]} for you.`;
  }, [rec, name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { say(greeting); }, [greeting, say]);

  // Hidden demo shortcut: Shift + D loads a lived-in profile for judging.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        loadDemo();
        say('Demo profile loaded. Hi, Maya!');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loadDemo, say]);

  const progress = stageProgress(profile.xp);
  const insight = profile.insights.at(-1);

  const startGame = (game: GameId) => {
    if (!games.includes(game)) return;
    sfx.tick();
    go({ name: 'game', mode: game });
  };

  const onNext = () => {
    if (slot.kind === 'chest') {
      const { profile: next, stages } = openChest(profile);
      update(() => next);
      sfx.chime();
      celebrate('.keep-going .btn', { count: 22 });
      say('A glow chest! Here is some extra glow.');
      if (stages.length) setGlowUp(stages.at(-1)!);
      return;
    }
    sfx.tick();
    go({ name: 'game', mode: slot.kind === 'round' ? slot.game! : slot.kind });
  };

  const today = dayKey(new Date());
  const roundsToday = profile.rounds.filter((r) => dayKey(new Date(r.t)) === today).length;
  const weak = weakestTag(profile.mastery, 3);
  const suggestion: { mode: GameId; why: string } = weak && games.includes(GAME_FOR_TAG[weak])
    ? { mode: GAME_FOR_TAG[weak], why: `It practises ${PLAIN_NAME[weak].toLowerCase()}.` }
    : { mode: games.includes(rec) ? rec : 'detective', why: 'Lumo thinks you’ll enjoy it.' };
  const practising = (Object.keys(profile.mastery) as Tag[])
    .filter((t) => (profile.mastery[t]?.n ?? 0) >= 3)
    .sort((a, b) => (profile.mastery[b]?.n ?? 0) - (profile.mastery[a]?.n ?? 0))
    .slice(0, 3);

  const path = activePath(profile);
  const unitIndex = Math.floor(path.length / UNIT_SIZE);
  const unit = unitAt(course, unitIndex);
  const unitDone = path.length - unitIndex * UNIT_SIZE;
  const readToday = (lastReading()?.t ?? '').slice(0, 10) === new Date().toISOString().slice(0, 10);
  const playedToday = Object.values(profile.playground).some((g) => dayKey(new Date(g.lastT)) === today);
  const goals = [
    { done: roundsToday > 0, label: 'Complete a lesson', go: onNext },
    { done: playedToday, label: 'Play a game', go: () => navigate('/playground') },
    { done: readToday, label: 'Read a short story', go: () => navigate('/library') },
  ];

  return (
    <main className="screen classroom" id="main">
      {!canSpeak && <p className="banner" role="status">Your browser can't speak words aloud. Try Chrome or Edge.</p>}
      {!storageOk && <p className="banner" role="status">Progress won't be saved in this browser.</p>}
      <h1 className="sr-only" tabIndex={-1}>Classroom</h1>

      <div className="class-grid">
        {/* ---------------------------------------------------------- units */}
        <nav className="unit-list" aria-label={`${course.title} units`}>
          <button type="button" className="course-switch soft" onClick={() => setPicker(true)}>
            <span className="ov-label">Course</span>
            <strong>{course.title}</strong>
            <span className="muted">Change ›</span>
          </button>
          <ol>
            {Array.from({ length: Math.max(course.units.length, unitIndex + 1) }, (_, u) => {
              const it = unitAt(course, u);
              const state = u < unitIndex ? 'done' : u === unitIndex ? 'current' : 'locked';
              return (
                <li key={u} className={`unit-item ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="unit-num" aria-hidden="true">{state === 'locked' ? <Lock size={18} /> : state === 'done' ? <Check size={18} /> : it.number}</span>
                  <span>
                    <span className="unit-kicker">Unit {it.number}</span>
                    <span className="unit-name">{it.title}</span>
                    <span className="unit-about-small">{it.about}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* ---------------------------------------------------------- lessons */}
        <section className="lessons" aria-label={`Unit ${unit.number}: ${unit.title}`}>
          {/* Phones: a friendly home block first (the side column comes later on small screens). */}
          <div className="mobile-home">
            <div className="mh-greet">
              <div>
                <h2 className="title">Hi{name ? ` ${name}` : ''}!</h2>
                <p>Ready for a new step today?</p>
              </div>
              <Lumo pose="welcome" size={120} motion="float" />
            </div>
            <button type="button" className="continue-card sketch" onClick={onNext}>
              <span className="cc-icon hatch-yellow" aria-hidden="true"><BookOpen size={26} /></span>
              <span>
                <strong>Continue your journey</strong>
                <span className="muted">Unit {unit.number} · Lesson {Math.min(unitDone + 1, UNIT_SIZE)}</span>
                <span>{lessonInfo(slot.kind, slot.game).title}</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
            <div className="mh-goals">
              <div className="side-title"><span>Today's goal</span><span className="muted">{goals.filter((g) => g.done).length} / {goals.length}</span></div>
              <span className="progress mini wide"><div className="hatch-leaf" style={{ width: `${(goals.filter((g) => g.done).length / goals.length) * 100}%` }} /></span>
              <ul className="goal-circles">
                {goals.map((g) => (
                  <li key={g.label}><button type="button" className={`goal-circle ${g.done ? 'done' : ''}`} onClick={g.go}>
                    <span className="gc-ring" aria-hidden="true">{g.done && <Check size={22} />}</span>{g.label}
                  </button></li>
                ))}
              </ul>
            </div>
            <div className="explore">
              <h2 className="side-title">Explore</h2>
              <div className="explore-grid">
                <button type="button" onClick={() => navigate('/library')}><span className="ex-icon hatch-blush"><BookOpen size={26} /></span>Reading</button>
                <button type="button" onClick={() => navigate('/classroom/activity/patterns')}><span className="ex-icon hatch-lav"><Abc size={30} /></span>Spelling</button>
                <button type="button" onClick={() => navigate('/playground')}><span className="ex-icon hatch-sky"><Puzzle size={26} /></span>Games</button>
                <button type="button" onClick={() => navigate('/classroom/progress')}><span className="ex-icon hatch-leaf"><Chart size={26} /></span>Progress</button>
              </div>
            </div>
          </div>

          <header className="unit-hero">
            <div>
              <span className="unit-kicker hand">Unit {unit.number}</span>
              <h2 className="title unit-big">{unit.title}</h2>
              <Squiggle color="#f2a65a" width={240} />
              <p className="muted">{unit.about}</p>
            </div>
            <div className="unit-hero-lumo">
              <Bubble text={greeting} className="tilt-r" />
              <Lumo pose="welcome" size={130} />
            </div>
          </header>

          <div className="flow" ref={flowRef}>
            <svg className="flow-trail" aria-hidden="true" width={trail.w} height={trail.h}>
              <path d={trail.all} fill="none" stroke="var(--line-soft)" strokeWidth="4" strokeDasharray="2 12" strokeLinecap="round" />
              {/* The walked part of the trail draws itself in. */}
              <path className="trail-done" key={trail.done} d={trail.done} pathLength={1} fill="none" stroke="#ffbe46" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <Signpost style={{ left: -12, bottom: 40 }} />
            <span className="flow-scenery" aria-hidden="true">
              <Tree style={{ right: 6, top: '38%' }} />
              <Tree color="#a8d8b0" style={{ right: 50, top: '62%', transform: 'scale(.8)' }} />
              <svg className="doodle grass" viewBox="0 0 160 40" width="160" style={{ left: 10, bottom: 0 }}><path d="M5 38 q6-22 10 0 q5-28 10 0 q6-20 10 0 q5-26 10 0 q6-18 10 0 q5-24 10 0 q6-20 10 0 q5-26 10 0 q6-18 10 0" fill="none" stroke="#9fd6a8" strokeWidth="3" strokeLinecap="round" /></svg>
            </span>
          <ol className="lesson-list flowing">
            {Array.from({ length: UNIT_SIZE }, (_, i) => {
              const index = unitIndex * UNIT_SIZE + i;
              const node = path[index];
              const s = slotAt(course, index, profile.mistakes, games);
              const kind = (node?.kind ?? s.kind) as NodeKind;
              const game = node?.kind === 'round' ? node.game : s.game;
              const state = node ? 'done' : i === unitDone ? 'current' : 'locked';
              const info = lessonInfo(kind, game);
              return (
                <li key={i} className={`lesson ${state}`} style={{ '--x': FLOW[i % FLOW.length] } as CSSProperties}>
                  <span className="lesson-dot" aria-hidden="true">{state === 'done' ? <Check size={22} /> : state === 'current' ? <span className="dot-now" /> : <Lock size={18} />}</span>
                  <button type="button" className="lesson-card soft" disabled={state !== 'current'}
                    ref={state === 'current' ? nextRef : undefined}
                    onClick={onNext} aria-label={`${i + 1}. ${info.title}. ${info.desc}${state === 'done' ? '. Done' : state === 'locked' ? '. Locked' : '. Start'}`}>
                    <span className={`lesson-art ${info.hatch}`}><Lumo pose={info.pose} size={78} motion="none" /></span>
                    <span className="lesson-text">
                      <span className="lesson-title">{i + 1}. {info.title}</span>
                      <span className="lesson-desc">{info.desc}</span>
                      {node && 'stars' in node && <Stars count={node.stars} size={16} />}
                    </span>
                    <span className="lesson-end" aria-hidden="true">
                      {kind !== 'round' && kind !== 'chest' && <span className="kind-badge">{kind === 'review' ? <Refresh size={18} /> : kind === 'mixed' ? <Shuffle size={18} /> : <Trophy size={18} />}</span>}
                      {state === 'current' ? '›' : state === 'locked' ? <Lock size={18} /> : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          </div>

          {mistakes > 0 && (
            <button type="button" className="practice-card sketch" onClick={() => go({ name: 'game', mode: 'review' })}>
              <Lumo pose="guiding" size={70} motion="none" />
              <span>
                <span className="name">Practice mistakes</span>
                <span className="desc">{mistakes} {mistakes === 1 ? 'word' : 'words'} to try again. Get each one right twice and it shines!</span>
              </span>
            </button>
          )}

          <h2 className="title sub-title">Free play</h2>
          <div className="free-grid">
            {GAMES.map((g, i) => {
              const meta = GAME_META[g];
              const blocked = !games.includes(g);
              return (
                <button key={g} type="button" className={`game-card sketch ${i % 2 ? 'alt' : ''}`} onClick={() => startGame(g)} disabled={blocked} style={{ animationDelay: `${i * 50}ms` }}>
                  <span className={`icon ${meta.hatch}`}><meta.Icon size={30} /></span>
                  <span>
                    <span className="name">{GAME_NAME[g]}</span>
                    <span className="desc">{blocked ? 'Needs a browser voice' : meta.desc}</span>
                  </span>
                  <span className="stars"><Stars count={profile.stars[g] ?? 0} /></span>
                  {g === rec && <span className="ribbon">Lumo's pick!</span>}
                </button>
              );
            })}
          </div>

          <h2 className="title sub-title">Activities</h2>
          <div className="activity-grid">
            {ACTIVITIES.map((a, i) => (
              <button key={a.id} type="button" className={`activity-card sketch ${i % 2 ? 'alt' : ''}`} onClick={() => navigate(`/classroom/activity/${a.id}`)}
                disabled={a.needsSpeech && !canSpeak}>
                <span className={`activity-icon ${ACTIVITY_HATCH[a.icon]}`} aria-hidden="true">{ACTIVITY_ICONS[a.icon]}</span>
                <span className="name">{a.title}</span>
                <span className="desc">{a.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- side */}
        <aside className="class-side" aria-label="Your progress">
          <section className="side-card soft">
            <h2 className="side-title">Your progress <a className="link small-link" href={`${import.meta.env.BASE_URL}classroom/progress`} onClick={(e) => { e.preventDefault(); navigate('/classroom/progress'); }}>View all →</a></h2>
            <div className="ring-row">
              <ProgressRing value={unitDone / UNIT_SIZE} />
              <div><span className="big-num">{unitDone} / {UNIT_SIZE}</span><span className="muted">lessons in this unit</span></div>
            </div>
            <div className="glow-line">
              <span className="muted">{progress.label} · {progress.current}{progress.fraction < 1 ? ` / ${progress.target} XP` : ' XP'}</span>
              <span className="progress mini wide"><div className="hatch-yellow" style={{ width: `${Math.round(progress.fraction * 100)}%` }} /></span>
            </div>
            {profile.streak.days > 0 && <p className="muted"><Flame size={18} /> {profile.streak.days} {profile.streak.days === 1 ? 'day' : 'days'} in a row</p>}
          </section>

          <PlanCard />

          <section className="keep-going">
            <div>
              <h2 className="title">Keep going!</h2>
              <p>Every step you take helps you grow.</p>
              <button type="button" className="btn primary small" onClick={onNext}>
                {slot.kind === 'chest' ? 'Open the chest' : `Next: ${lessonInfo(slot.kind, slot.game).title}`}
              </button>
            </div>
            <Lumo pose="goodbye" size={110} motion="float" />
          </section>

          <section className="side-card soft">
            <h2 className="side-title">Today's goal <span className="muted">{goals.filter((g) => g.done).length} / {goals.length}</span></h2>
            <ul className="goals">
              {goals.map((g) => (
                <li key={g.label}>
                  <button type="button" className={`goal ${g.done ? 'done' : ''}`} onClick={g.go} aria-label={`${g.label}${g.done ? ', done' : ''}`}>
                    <span className="goal-tick" aria-hidden="true">{g.done ? <Check size={16} /> : ''}</span>{g.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="side-card soft">
            <h2 className="side-title">Suggested next</h2>
            <p style={{ margin: '0 0 10px' }}><strong>{GAME_NAME[suggestion.mode]}</strong>. <span className="muted">{suggestion.why}</span></p>
            <button type="button" className="btn small" onClick={() => startGame(suggestion.mode)}>Play {GAME_NAME[suggestion.mode]}</button>
          </section>

          <section className="noticed sticky lav">
            <span className="label">Lumo noticed…</span>
            <p className="text">{insight ?? "Let's play a round, and I'll start noticing things!"}</p>
          </section>

          <section className="side-card soft">
            <h2 className="side-title">Skills you're building</h2>
            <SkillChips />
            {practising.length > 0 && <p className="muted small-note">Practising now: {practising.map((t) => PLAIN_NAME[t].toLowerCase()).join(', ')}.</p>}
          </section>
        </aside>
      </div>

      {picker && <CoursePicker current={course.id} onClose={() => setPicker(false)} onPick={(id) => { update((p) => ({ ...p, activeCourse: id })); setPicker(false); }} />}
      {glowUp && <GlowUp stage={glowUp} onClose={() => setGlowUp(null)} />}
    </main>
  );
}

export function SkillChips() {
  const { profile } = useLumen();
  return (
    <ul className="skill-chips">
      {SKILL_CHIPS.map((sk) => {
        const m = sk.value(profile);
        return (
          <li key={sk.label} className="skill-chip">
            <span className={`skill-icon ${sk.hatch}`} aria-hidden="true">{sk.icon}</span>
            <span>{sk.label}</span>
            <span className="muted small-note">{m === null ? 'Not started' : band(m)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** How far each lesson sways along the trail (px; scaled down on phones). */
const FLOW = [0, -22, 8, 42, 58, 42, 12, -14];

/** Measures where each lesson dot is and draws a smooth trail through them. */
function useFlowTrail(done: number, deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState({ all: '', done: '', w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draw = () => {
      const box = el.getBoundingClientRect();
      const pts = [...el.querySelectorAll<HTMLElement>('.lesson-dot')].map((d) => {
        const r = d.getBoundingClientRect();
        return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
      });
      const curve = (list: { x: number; y: number }[]) => list.map((p, i) => {
        if (i === 0) return `M${p.x},${p.y}`;
        const q = list[i - 1];
        const my = (q.y + p.y) / 2;
        return `C${q.x},${my} ${p.x},${my} ${p.x},${p.y}`;
      }).join(' ');
      setTrail({ all: curve(pts), done: curve(pts.slice(0, done + 1)), w: box.width, h: box.height });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, trail };
}

export function ProgressRing({ value }: { value: number }) {
  const C = 2 * Math.PI * 34;
  return (
    <svg className="ring" viewBox="0 0 80 80" width="88" height="88" aria-hidden="true">
      <circle cx="40" cy="40" r="34" fill="none" stroke="var(--grey-a)" strokeWidth="9" />
      <circle className="ring-fill" cx="40" cy="40" r="34" fill="none" stroke="var(--leaf)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - value)} transform="rotate(-90 40 40)"
        style={{ '--ring-c': C, '--ring-to': C * (1 - value) } as CSSProperties} />
      <g transform="translate(25 25)" color="var(--leaf)"><Sprout size={30} /></g>
    </svg>
  );
}

const ACTIVITY_ICONS = {
  pair: <Pair size={26} />, puzzle: <Puzzle size={26} />, question: <Question size={26} />,
  sort: <SortWords size={26} />, book: <BookOpen size={26} />, pencil: <Pencil size={26} />,
};
const ACTIVITY_HATCH = { pair: 'hatch-lav', puzzle: 'hatch-yellow', question: 'hatch-blush', sort: 'hatch-sky', book: 'hatch-leaf', pencil: 'hatch-yellow' };

const avgOf = (p: Profile, tags: Tag[]) => {
  const ms = tags.filter((t) => (p.mastery[t]?.n ?? 0) >= 3).map((t) => masteryOf(p.mastery, t));
  return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null;
};
const skillOf = (p: Profile, id: SkillId) => ((p.learning.skills[id]?.n ?? 0) >= 3 ? p.learning.skills[id]!.m : null);

const SKILL_CHIPS: { label: string; icon: React.ReactNode; hatch: string; value: (p: Profile) => number | null }[] = [
  { label: 'Sounds', icon: <Music size={22} />, hatch: 'hatch-blush', value: (p) => avgOf(p, ['digraph', 'vowel-team', 'blend']) },
  { label: 'Reading', icon: <BookOpen size={22} />, hatch: 'hatch-sky', value: (p) => skillOf(p, 'reading') ?? avgOf(p, ['irregular', 'confusable']) },
  { label: 'Spelling', icon: <Abc size={26} />, hatch: 'hatch-lav', value: (p) => skillOf(p, 'spelling') ?? avgOf(p, ['short', 'medium', 'long']) },
  { label: 'Beats', icon: <Beats size={22} />, hatch: 'hatch-leaf', value: (p) => avgOf(p, ['multi']) },
  { label: 'Understanding', icon: <Bulb size={22} />, hatch: 'hatch-yellow', value: (p) => skillOf(p, 'comprehension') },
  { label: 'Words', icon: <Chat size={22} />, hatch: 'hatch-sky', value: (p) => skillOf(p, 'vocabulary') },
];

const LESSON_INFO: Record<Exclude<NodeKind, 'round'>, { title: string; desc: string; pose: Pose; hatch: string }> = {
  review: { title: 'Practice mistakes', desc: 'Try the words that were tricky.', pose: 'encouraging', hatch: 'hatch-blush' },
  chest: { title: 'Glow chest', desc: 'Open it for extra glow!', pose: 'love', hatch: 'hatch-yellow' },
  mixed: { title: 'Mixed practice', desc: 'A little bit of every game.', pose: 'welcome', hatch: 'hatch-sky' },
  milestone: { title: 'Unit challenge', desc: "Show what you've learnt in this unit.", pose: 'celebrating', hatch: 'hatch-yellow' },
};
const GAME_POSE: Record<GameId, Pose> = { detective: 'thinking', sound: 'happy', builder: 'laptop', speller: 'guiding' };

function lessonInfo(kind: NodeKind, game?: GameId) {
  if (kind === 'round' && game) return { title: GAME_NAME[game], desc: GAME_META[game].desc, pose: GAME_POSE[game], hatch: GAME_META[game].hatch };
  return LESSON_INFO[kind === 'round' ? 'mixed' : kind];
}

function CoursePicker({ current, onPick, onClose }: { current: CourseId; onPick: (id: CourseId) => void; onClose: () => void }) {
  const { profile } = useLumen();
  return (
    <Modal title="Choose a course" onClose={onClose}>
      <h2 className="title" style={{ fontSize: 32 }}>Choose a course</h2>
      <p className="muted">Each course keeps its own progress. You can switch any time.</p>
      <div className="course-list">
        {COURSES.map((c) => {
          const done = profile.courses[c.id]?.length ?? 0;
          return (
            <button key={c.id} type="button" className={`course-option sketch ${c.id === current ? 'on' : ''}`} aria-pressed={c.id === current} onClick={() => onPick(c.id)}>
              <span className={`course-badge ${c.hatch}`} aria-hidden="true">{c.title.slice(0, 1)}</span>
              <span>
                <span className="name">{c.title}</span>
                <span className="desc">{c.about}</span>
                <span className="muted">{c.games.map((g) => GAME_NAME[g]).join(' · ')} · {done ? `unit ${Math.floor(done / UNIT_SIZE) + 1}` : 'Not started'}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

