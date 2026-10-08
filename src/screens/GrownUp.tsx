import { useEffect, useMemo, useState } from 'react';
import { useLumen } from '../state/store';
import { Lumo } from '../components/Lumo';
import { Bulb, Trend } from '../components/Icons';
import { buildReport, fillName, GAME_NAME, homeIdeas, MIN_N, summaryStats, summaryTemplate, type Band, type TagRow } from '../engine/report';
import { suggestIdeas, writeSummary, type Idea } from '../services/ai';
import { PRIVACY_LINE, ResetConfirm } from './Settings';

const NEED_MORE = 'Lumo needs a few more rounds to spot patterns here.';

const BAND_HATCH: Record<Band, string> = { Confident: 'hatch-leaf', Growing: 'hatch-lav', 'Getting started': 'hatch-yellow' };

function Meter({ label, m, band, example }: { label: string; m: number; band: Band; example?: string }) {
  return (
    <div className="meter-row">
      <div className="meter-head">
        <span>{label}</span>
        <span className={`band-${band.split(' ')[0]}`}>{band}</span>
      </div>
      {/* Bars show words, not percentages. */}
      <div className="meter" aria-hidden="true"><div className={BAND_HATCH[band]} style={{ width: `${Math.max(8, Math.round(m * 100))}%` }} /></div>
      {example && <div className="example">e.g. {example}</div>}
    </div>
  );
}

const rowMeter = (r: TagRow, withExample: boolean) => (
  <Meter key={r.tag} label={r.plain} m={r.m} band={r.band} example={withExample ? r.examples.join(', ') || undefined : undefined} />
);

/** Plain-language practice summary: what's easier, what's tricky, what next. */
export function GrownUp() {
  const { profile, go, reset } = useLumen();
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
  const owner = name ? `${name}'s` : "Your learner's";

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

  return (
    <main className="screen grownup" id="main">
      <header className="head">
        <Lumo pose="sit" size={96} motion="none" />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="kicker">Lumo's notes for grown-ups · this week</div>
          <h1 className="title">{owner} practice</h1>
        </div>
        <div className="stat-box sketch"><div className="n">{report.minutes} min</div><div className="l">practised</div></div>
        <div className="stat-box sketch alt"><div className="n">{report.rounds}</div><div className="l">rounds finished</div></div>
        <button type="button" className="btn navy small" onClick={() => go({ name: 'hub' })}>Back to {name ? `${name}'s` : 'the'} map</button>
      </header>

      <section className="brief sketch" aria-labelledby="brief-h">
        <h2 id="brief-h">This week in brief</h2>
        <p>{report.rounds > 0 ? fillName(summary, name) : `${name || 'Your learner'} hasn't finished a round this week yet. Lumo's notes appear here after a few rounds.`}</p>
        <p className="note">{byAi ? 'Written by AI from practice totals only. No names or answers are sent.' : 'Written from practice totals on this device.'}</p>
      </section>

      <div className="panels">
        <section className="panel sketch" aria-labelledby="stronger-h">
          <h2 id="stronger-h" style={{ color: 'var(--success-text)' }}><Trend /> Getting stronger</h2>
          {report.stronger.length ? report.stronger.slice(0, 4).map((r) => rowMeter(r, false)) : <p className="empty">{NEED_MORE}</p>}
        </section>

        <section className="panel sketch alt" aria-labelledby="tricky-h">
          <h2 id="tricky-h" style={{ color: 'var(--try-text)' }}><Bulb /> Still tricky</h2>
          {report.tricky.length ? report.tricky.map((r) => rowMeter(r, true)) : <p className="empty">{NEED_MORE}</p>}
        </section>

        <section className="panel sticky lav" aria-labelledby="suggest-h" style={{ color: '#2b2c5e' }}>
          <h2 id="suggest-h" style={{ color: '#4a3fb0' }}>Suggested practice</h2>
          {report.suggestedGame && report.suggestedTag ? (
            <>
              <p className="learn" style={{ fontWeight: 600, fontSize: 22, margin: '0 0 8px' }}>Try 3 minutes of {GAME_NAME[report.suggestedGame]}.</p>
              <p style={{ marginTop: 0 }}>It focuses on {report.tricky[0]?.plain.toLowerCase() ?? 'the trickiest area'}, {name ? `${name}'s` : 'the'} trickiest area this week.</p>
              <button type="button" className="btn primary small" onClick={() => go({ name: 'game', game: report.suggestedGame! })}>
                Start {GAME_NAME[report.suggestedGame]}
              </button>
            </>
          ) : <p className="empty" style={{ color: '#545682' }}>{NEED_MORE}</p>}
        </section>
      </div>

      <section className="panel sketch" style={{ marginTop: 24, minHeight: 0 }} aria-labelledby="skills-h">
        <h2 id="skills-h">Skill overview</h2>
        {report.skills.some((s) => s.m !== null) ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 28px' }}>
            {report.skills.map((s) => s.m !== null && s.band
              ? <Meter key={s.label} label={s.label} m={s.m} band={s.band} />
              : <div key={s.label} className="meter-row"><div className="meter-head"><span>{s.label}</span></div><p className="empty">Needs {MIN_N}+ answers.</p></div>)}
          </div>
        ) : <p className="empty">{NEED_MORE}</p>}
      </section>

      <section className="panel sketch alt" style={{ marginTop: 24, minHeight: 0 }} aria-labelledby="ideas-h">
        <h2 id="ideas-h">Ideas to try at home</h2>
        <div className="ideas">
          {ideas.map((idea, i) => (
            <div key={idea.title} className={`idea sticky ${['yellow', 'leaf', 'sky'][i % 3]}`}>
              <strong>{idea.title}</strong>
              <p>{idea.how}</p>
            </div>
          ))}
        </div>
        <p className="note muted" style={{ fontSize: 13, margin: '10px 0 0' }}>
          {ideasByAi ? 'Suggested by AI from practice totals only.' : 'Multisensory activities in the Orton-Gillingham tradition.'} A few minutes is plenty.
        </p>
      </section>

      <footer className="footer-note">
        <p style={{ margin: 0, maxWidth: 620 }}>
          Lumen is a practice game, not a test or a diagnosis. If you have concerns about reading, talk to your child's teacher or a specialist.
        </p>
        <div style={{ maxWidth: 360 }}>
          <p style={{ margin: '0 0 8px' }}>{PRIVACY_LINE}</p>
          <button type="button" className="btn small" onClick={() => setConfirm(true)}>Reset progress</button>
        </div>
      </footer>
      {confirm && <ResetConfirm onCancel={() => setConfirm(false)} onConfirm={reset} />}
    </main>
  );
}
