import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLumen } from '../state/store';
import { useRouter } from '../router';
import { Lumo } from '../components/Lumo';
import { Bulb, Trend } from '../components/Icons';
import {
  buildReport, fillName, GAME_NAME, homeIdeas, MIN_N, practiceTime, summaryStats, summaryTemplate,
  type Band, type Report, type TagRow,
} from '../engine/report';
import { band as bandOf } from '../engine/report';
import { suggestIdeas, writeSummary, type Idea } from '../services/ai';
import { storiesFinished } from '../library/progress';
import { ResetConfirm } from './Settings';
import type { SkillId } from '../classroom/activities';

const NEED_MORE = 'Lumo needs a few more rounds to spot patterns here.';

const SKILL_NAME: Record<SkillId, string> = {
  reading: 'Reading words in context', spelling: 'Spelling patterns', vocabulary: 'Word meanings',
  comprehension: 'Understanding stories', writing: 'Writing sentences',
};

const BAND_TONE: Record<Band, string> = { Confident: 'green', Growing: 'lav', 'Getting started': 'yellow' };

function BandChip({ band }: { band: Band }) {
  return <span className={`gu-chip ${BAND_TONE[band]}`}>{band}</span>;
}

/** A skill meter in words, never percentages. */
function Meter({ label, m, band, children }: { label: string; m: number; band: Band; children?: ReactNode }) {
  return (
    <div className="gu-meter">
      <div className="gu-meter-head"><span>{label}</span><BandChip band={band} /></div>
      <div className="gu-bar" aria-hidden="true"><span className={BAND_TONE[band]} style={{ width: `${Math.max(8, Math.round(m * 100))}%` }} /></div>
      {children}
    </div>
  );
}

function SkillRow({ r, examples }: { r: TagRow; examples: boolean }) {
  return (
    <Meter label={r.plain} m={r.m} band={r.band}>
      <div className="gu-meter-foot">
        {r.improving && <span className="gu-chip up">↑ improving this week</span>}
        {examples && r.examples.length > 0 && (
          <span className="gu-examples">Practise: {r.examples.map((w) => <span key={w} className="gu-word">{w}</span>)}</span>
        )}
      </div>
    </Meter>
  );
}

function dateRange(report: Report) {
  const f = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' });
  return `${f(report.days[0].date)} – ${f(report.days[6].date)}`;
}

/** Seven small bars: when practice happened this week. */
function WeekChart({ report }: { report: Report }) {
  const max = Math.max(60, ...report.days.map((d) => d.seconds));
  const summary = report.days.map((d) => `${d.label}: ${d.rounds ? `${practiceTime(d.seconds)}, ${d.rounds} ${d.rounds === 1 ? 'round' : 'rounds'}` : 'no practice'}`).join('; ');
  return (
    <div className="gu-week" role="img" aria-label={`Practice by day. ${summary}.`}>
      {report.days.map((d, i) => (
        <div key={d.date} className={`gu-day ${i === 6 ? 'today' : ''}`}>
          <span className="gu-day-val">{d.rounds ? (d.seconds < 60 ? '<1m' : `${Math.round(d.seconds / 60)}m`) : ''}</span>
          <span className="gu-day-bar"><span style={{ height: `${d.seconds ? Math.max(8, (d.seconds / max) * 100) : 0}%`, animationDelay: `${i * 60}ms` }} /></span>
          <span className="gu-day-label">{i === 6 ? 'Today' : d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Plain-language practice notes: how the week went, what's easier, what's tricky, what next. */
export function GrownUp({ onLock }: { onLock: () => void }) {
  const { profile, go, reset, savedIn } = useLumen();
  const report = useMemo(() => buildReport(profile), [profile]);
  const stats = useMemo(() => summaryStats(report), [report]);
  const template = useMemo(() => summaryTemplate(report), [report]);
  const [summary, setSummary] = useState(template);
  const [byAi, setByAi] = useState(false);
  const fallbackIdeas = useMemo(() => homeIdeas(report), [report]);
  const [ideas, setIdeas] = useState<Idea[]>(fallbackIdeas);
  const [ideasByAi, setIdeasByAi] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const name = profile.name;
  const firstTries = useMemo(() => {
    const since = Date.now() - 7 * 86_400_000;
    return profile.rounds.filter((r) => new Date(r.t).getTime() >= since).reduce((s, r) => s + r.firsts, 0);
  }, [profile.rounds]);
  const stories = useMemo(() => storiesFinished(), []);
  const activitySkills = (Object.entries(profile.learning?.skills ?? {}) as [SkillId, { m: number; n: number }][])
    .filter(([, v]) => v.n >= MIN_N);

  useEffect(() => {
    let live = true;
    setSummary(template);
    setByAi(false);
    if (report.rounds > 0) {
      void writeSummary(stats).then((text) => {
        if (live && text) { setSummary(text); setByAi(true); }
      });
    }
    setIdeas(fallbackIdeas);
    setIdeasByAi(false);
    if (report.hasData) {
      void suggestIdeas(stats).then((list) => {
        if (live && list) { setIdeas(list); setIdeasByAi(true); }
      });
    }
    return () => { live = false; };
  }, [stats, template, report.rounds, report.hasData, fallbackIdeas]);

  const KPIS = [
    { label: 'Practice time', value: practiceTime(report.seconds), tone: 'yellow' },
    { label: 'Rounds finished', value: String(report.rounds), tone: 'lav' },
    { label: 'Right first try', value: `${firstTries} ${firstTries === 1 ? 'word' : 'words'}`, tone: 'green' },
    { label: 'Stories read', value: String(stories), tone: 'blue' },
    { label: 'Days in a row', value: String(profile.streak.days), tone: 'pink' },
  ];

  return (
    <main className="screen gu" id="main">
      <header className="gu-head">
        <div className="gu-head-text">
          <p className="gu-eyebrow">Lumo's notes for grown-ups</p>
          <h1 className="gu-title" tabIndex={-1}>{name ? `${name}'s week` : 'This week'}</h1>
          <p className="gu-sub">{dateRange(report)} · {savedIn === 'account' ? 'from this learner’s account' : 'from this device'}</p>
        </div>
        <div className="gu-head-actions">
          <button type="button" className="l-btn navy small" onClick={() => go({ name: 'hub' })}>Back to learning</button>
          <button type="button" className="l-btn ghost small" onClick={onLock} title="Close the notes; holding is needed again">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            Lock
          </button>
        </div>
      </header>

      <section className="gu-kpis" aria-label="This week in numbers">
        {KPIS.map((k) => (
          <div key={k.label} className={`gu-kpi ${k.tone}`}>
            <span className="gu-kpi-value">{k.value}</span>
            <span className="gu-kpi-label">{k.label}</span>
          </div>
        ))}
      </section>

      <div className="gu-grid">
        <section className="gu-card gu-brief" aria-labelledby="brief-h">
          <div className="gu-card-head">
            <h2 id="brief-h">This week in brief</h2>
            {byAi && <span className="gu-chip ai">Written with AI</span>}
          </div>
          <div className="gu-brief-body">
            <Lumo pose="reading" size={84} motion="none" />
            <p>{report.rounds > 0 ? fillName(summary, name) : `${name || 'Your learner'} hasn't finished a round this week yet. Lumo's notes appear here after a few rounds.`}</p>
          </div>
          <p className="gu-fine">{byAi ? 'Written from practice totals only. No names or answers are sent.' : 'Written from this week’s practice totals.'}</p>
        </section>

        <section className="gu-card" aria-labelledby="week-h">
          <div className="gu-card-head"><h2 id="week-h">When practice happened</h2></div>
          <WeekChart report={report} />
          <p className="gu-fine">Little and often works best: a few minutes most days.</p>
        </section>
      </div>

      <div className="gu-grid three">
        <section className="gu-card" aria-labelledby="stronger-h">
          <div className="gu-card-head"><h2 id="stronger-h" className="green"><Trend /> Getting stronger</h2></div>
          {report.stronger.length ? report.stronger.slice(0, 4).map((r) => <SkillRow key={r.tag} r={r} examples={false} />) : <p className="gu-empty">{NEED_MORE}</p>}
        </section>

        <section className="gu-card" aria-labelledby="tricky-h">
          <div className="gu-card-head"><h2 id="tricky-h" className="amber"><Bulb /> Still tricky</h2></div>
          {report.tricky.length ? report.tricky.map((r) => <SkillRow key={r.tag} r={r} examples />) : <p className="gu-empty">{NEED_MORE}</p>}
        </section>

        <section className="gu-card gu-suggest" aria-labelledby="suggest-h">
          <div className="gu-card-head"><h2 id="suggest-h">Suggested practice</h2></div>
          {report.suggestedGame && report.suggestedTag ? (
            <>
              <p className="gu-suggest-main">Try 3 minutes of {GAME_NAME[report.suggestedGame]}.</p>
              <p>It focuses on {report.tricky[0]?.plain.toLowerCase() ?? 'the trickiest area'}, {name ? `${name}'s` : 'the'} trickiest area this week.</p>
              <button type="button" className="l-btn navy small" onClick={() => go({ name: 'game', mode: report.suggestedGame! })}>
                Start {GAME_NAME[report.suggestedGame]}
              </button>
            </>
          ) : <p className="gu-empty">{NEED_MORE}</p>}
          <span className="gu-suggest-lumo" aria-hidden="true"><Lumo pose="guiding" size={70} motion="none" /></span>
        </section>
      </div>

      <section className="gu-card" aria-labelledby="skills-h">
        <div className="gu-card-head"><h2 id="skills-h">Skill overview</h2></div>
        <h3 className="gu-sub-h">Word games</h3>
        {report.skills.some((s) => s.m !== null) ? (
          <div className="gu-meters">
            {report.skills.map((s) => s.m !== null && s.band
              ? <Meter key={s.label} label={s.label} m={s.m} band={s.band} />
              : <div key={s.label} className="gu-meter"><div className="gu-meter-head"><span>{s.label}</span></div><p className="gu-empty small">Needs {MIN_N}+ answers.</p></div>)}
          </div>
        ) : <p className="gu-empty">{NEED_MORE}</p>}
        <h3 className="gu-sub-h">Classroom activities <span>(answered without help)</span></h3>
        {activitySkills.length ? (
          <div className="gu-meters">
            {activitySkills.map(([id, v]) => <Meter key={id} label={SKILL_NAME[id]} m={v.m} band={bandOf(v.m)} />)}
          </div>
        ) : <p className="gu-empty">Activities show here after a few independent answers.</p>}
      </section>

      <section className="gu-card" aria-labelledby="ideas-h">
        <div className="gu-card-head">
          <h2 id="ideas-h">Ideas to try at home</h2>
          {ideasByAi && <span className="gu-chip ai">Suggested with AI</span>}
        </div>
        <div className="gu-ideas">
          {ideas.map((idea, i) => (
            <div key={idea.title} className={`gu-idea ${['yellow', 'green', 'blue'][i % 3]}`}>
              <strong>{idea.title}</strong>
              <p>{idea.how}</p>
            </div>
          ))}
        </div>
        <p className="gu-fine">{ideasByAi ? 'Suggested from practice totals only.' : 'Multisensory activities in the Orton-Gillingham tradition.'} A few minutes is plenty.</p>
      </section>

      <footer className="gu-foot">
        <p>
          <b>Lumen is a practice game, not a test or a diagnosis.</b> If you have concerns about reading, talk to your child's teacher or a specialist.
        </p>
        <p>
          {savedIn === 'account'
            ? 'Progress is saved to this learner’s Lumen account. Lumo’s AI only sees practice totals and words from Lumen’s word list, never names or emails.'
            : 'Progress is saved in this browser only. Lumo’s AI only sees practice totals and words from Lumen’s word list, never names.'}
        </p>
        <button type="button" className="l-btn ghost small" onClick={() => setConfirm(true)}>Reset progress…</button>
      </footer>
      {confirm && <ResetConfirm onCancel={() => setConfirm(false)} onConfirm={reset} />}
    </main>
  );
}

/* ------------------------------------------------------------------ the gate */

const HOLD_MS = 3000;

/** A big round button: press and hold until the ring is full. Works with touch, mouse and keyboard. */
function HoldToOpen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState('');
  const start = useRef<number | null>(null);
  const raf = useRef(0);
  const done = useRef(false);

  const stop = () => {
    if (done.current) return;
    cancelAnimationFrame(raf.current);
    if (start.current !== null && progress > 0.04) setHint('Almost! Keep holding until the circle is full.');
    start.current = null;
    setProgress(0);
  };
  const tick = (t: number) => {
    if (start.current === null) start.current = t;
    const p = Math.min(1, (t - start.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      done.current = true;
      navigator.vibrate?.(30);
      window.setTimeout(onDone, 180);
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };
  const begin = () => {
    if (done.current) return;
    setHint('');
    cancelAnimationFrame(raf.current);
    start.current = null;
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const C = 2 * Math.PI * 70;
  const left = Math.ceil((1 - progress) * (HOLD_MS / 1000));
  const holding = progress > 0 && progress < 1;
  const label = progress >= 1 ? 'Opening…' : holding ? `Keep holding… ${left}` : 'Press and hold';

  return (
    <div className="gate-hold">
      <button
        type="button"
        className={`gate-btn ${holding ? 'holding' : ''} ${progress >= 1 ? 'done' : ''}`}
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); begin(); }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(); }}
        onBlur={stop}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Hold to open"
        aria-describedby="gate-help"
      >
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r="70" className="gate-track" />
          <circle cx="80" cy="80" r="70" className="gate-ring" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 80 80)" />
        </svg>
        <span className="gate-icon" aria-hidden="true">
          {progress >= 1
            ? <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></svg>
            : <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>}
        </span>
      </button>
      <p className="gate-label" aria-live="polite">{label}</p>
      <p className="gate-hint" role="status">{hint}</p>
      <span id="gate-help" className="sr-only">Press and hold for 3 seconds, with a finger, the mouse, or the Space key.</span>
    </div>
  );
}

/**
 * The grown-up notes sit behind a 3-second hold. Not security: it keeps a young
 * learner from wandering in. It asks again every time the page is opened, so
 * leaving the notes (or locking them) always closes them.
 */
export function GrownUpGate() {
  const [open, setOpen] = useState(false);
  const { back } = useRouter();
  if (open) return <GrownUp onLock={() => setOpen(false)} />;
  return (
    <main className="screen gate" id="main">
      <div className="gate-card">
        <Lumo pose="guiding" size={104} motion="none" />
        <p className="gu-eyebrow">For grown&#8209;ups</p>
        <h1 className="gu-title" tabIndex={-1}>Lumo's notes</h1>
        <p className="gate-lede">How practice is going, what's getting easier, and ideas to try at home.</p>
        <HoldToOpen onDone={() => setOpen(true)} />
        <ul className="gate-inside" aria-label="Inside">
          <li><span className="gu-chip yellow">This week</span> time, rounds and stories</li>
          <li><span className="gu-chip green">Skills</span> what's easier and what's tricky</li>
          <li><span className="gu-chip lav">Next steps</span> suggested practice and home ideas</li>
        </ul>
        <p className="gate-fine">The hold keeps young learners from wandering in by accident. It isn't a password, and it asks again each time.</p>
        <button type="button" className="link" onClick={() => back('/classroom')}>← Back</button>
      </div>
    </main>
  );
}
