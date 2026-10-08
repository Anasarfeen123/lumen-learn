import { useEffect, useState } from 'react';
import { useLumen } from '../state/store';
import { Lumo } from '../components/Lumo';
import { CountUp } from '../components/ui';
import { Squiggle } from '../components/Doodles';
import { Arrow, Bulb, Star } from '../components/Icons';
import { GlowUp } from './GlowUp';
import { GAME_NAME } from '../engine/report';
import { nextChallenge } from '../engine/adaptive';
import { SHORT_NAME } from '../engine/tags';
import { line } from '../data/lines';
import { sfx } from '../services/sfx';
import { celebrate } from '../services/motion';
import { rephraseInsight } from '../services/ai';
import type { RoundSummary } from '../engine/session';

export function RoundComplete({ summary }: { summary: RoundSummary }) {
  const { profile, update, go, say, speakParts, reducedMotion } = useLumen();
  const [insight, setInsight] = useState(summary.insight.text);
  const [glowUp, setGlowUp] = useState(false);
  const leveledUp = summary.newLevel > summary.oldLevel;

  useEffect(() => {
    sfx.fanfare();
    celebrate('.stars-row', { count: 30, spread: 1.6, delay: 450 });
    const cheer = line('roundDone', profile.name);
    const rate = profile.settings.voiceRate;
    say(`${cheer} ${summary.insight.text}`, { silent: true });
    void speakParts([{ text: cheer, rate, pauseMs: 300 }, { text: summary.insight.text, rate }]);

    // Show the template now; swap in an AI phrasing only if it arrives in time and passes checks.
    // The model gets the round's bank words and tags, so it can be specific ("rabbit and garden").
    let live = true;
    const context = {
      ...summary.insight.context,
      game: GAME_NAME[summary.game],
      firstTryWords: summary.words.filter((_, i) => summary.results[i] === 'first'),
      tag: summary.insight.tag ? SHORT_NAME[summary.insight.tag] : undefined,
    };
    void rephraseInsight(summary.insight.text, context).then((text) => {
      if (!live || !text) return;
      setInsight(text);
      update((p) => ({ ...p, insights: [...p.insights.slice(0, -1), text] }));
    });

    // Glow-up opens once the XP count-up has finished.
    const t = summary.stages.length ? window.setTimeout(() => setGlowUp(true), reducedMotion ? 300 : 1300) : 0;
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextLabel = leveledUp ? `Next: ${nextChallenge(summary.newLevel)}` : `Next: ${GAME_NAME[summary.recommended]}`;
  const detail = `${summary.firsts} of ${summary.results.length} right on the first try. ` +
    (leveledUp ? `${GAME_NAME[summary.game]} moves up to level ${summary.newLevel}.` : 'Every answer helps me pick what comes next.');

  return (
    <main className="screen" id="main">
      <div className="complete">
        <div style={{ display: 'grid', justifyItems: 'center' }}>
          <Lumo pose="cheer" size={280} motion="hop" label="Lumo cheering" />
          <div className="stars-row" role="img" aria-label={`${summary.stars} of 3 stars`}>
            {[1, 2, 3].map((n) => (
              <span key={n} style={{ animationDelay: `${n * 180}ms`, display: 'inline-block', color: 'var(--ink)' }}>
                <Star on={n <= summary.stars} size={n === 2 ? 76 : 62} />
              </span>
            ))}
          </div>
        </div>

        <div>
          <h1 className="title" style={{ fontSize: 'clamp(44px, 6vw, 64px)' }}>Round complete!</h1>
          <Squiggle color="#ffbe46" width={280} />
          <div className="stats">
            <div className="sticky yellow tilt-l"><div className="k">XP earned</div><div className="v">+<CountUp to={summary.xp} /></div></div>
            <div className="sticky leaf"><div className="k">First try</div><div className="v">{summary.firsts} of {summary.results.length}</div></div>
            <div className="sticky lav tilt-r">
              <div className="k">Level</div>
              <div className="v">{summary.oldLevel === summary.newLevel ? summary.newLevel : `${summary.oldLevel} → ${summary.newLevel}`}</div>
            </div>
          </div>

          <div className="lined sketch">
            <div className="label"><Bulb size={20} /> Lumo noticed...</div>
            <p className="insight" aria-live="polite">{insight}</p>
            <p className="detail">{detail}</p>
          </div>

          <div className="actions">
            <button type="button" className="btn go" onClick={() => go({ name: 'game', mode: summary.recommended })} autoFocus>
              {nextLabel} <Arrow size={26} />
            </button>
            <button type="button" className="btn" onClick={() => go({ name: 'game', mode: summary.mode })}>Play again</button>
            <button type="button" className="btn" onClick={() => go({ name: 'hub' })}>Map</button>
          </div>
        </div>
      </div>
      {glowUp && <GlowUp stage={summary.stages.at(-1)!} onClose={() => setGlowUp(false)} />}
    </main>
  );
}
