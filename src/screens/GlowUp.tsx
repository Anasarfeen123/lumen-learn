import { useEffect, useRef, useState } from 'react';
import { useLumen } from '../state/store';
import { Lumo, Hat } from '../components/Lumo';
import { Moon, Sparkle, Squiggle } from '../components/Doodles';
import { GLOW_HEX, HATS, STAGES, UNLOCK_LABEL, type GlowColor, type HatId, type Stage } from '../engine/progression';
import { line } from '../data/lines';
import { sfx } from '../services/sfx';

/** Night-scene modal when Lumo reaches a new glow stage. */
export function GlowUp({ stage, onClose }: { stage: Stage; onClose: () => void }) {
  const { profile, update, say } = useLumen();
  const idx = STAGES.indexOf(stage);
  const hat = stage.unlocks.find((u): u is HatId => (HATS as string[]).includes(u));
  const glow = stage.unlocks.find((u): u is GlowColor => u in GLOW_HEX);
  const ref = useRef<HTMLDivElement>(null);
  const [message] = useState(() => line('glowUp', profile.name));

  useEffect(() => {
    sfx.chime();
    say(message);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const equip = () => {
    update((p) => ({
      ...p,
      equipped: hat ? { hat } : p.equipped,
      glowColor: glow ?? p.glowColor,
    }));
    onClose();
  };

  const hasItems = Boolean(hat || glow);

  return (
    <div className="night" role="dialog" aria-modal="true" aria-labelledby="glowup-title" ref={ref}>
      <Sparkle size={34} color="none" style={{ left: '8%', top: '12%', color: '#c4c8d8' }} />
      <Sparkle size={26} color="#8b92ab" style={{ right: '12%', top: '20%', color: '#8b92ab' }} />
      <span className="chalk-letters" style={{ left: '6%', top: '46%' }} aria-hidden="true">b d p q</span>
      <span className="chalk-letters" style={{ right: '6%', top: '48%' }} aria-hidden="true">sh ch th</span>
      <Moon style={{ right: '8%', bottom: '10%' }} />

      <div className="glowup">
        <Lumo pose="cheer" size={240} motion="glow-up" stage={idx} darkScene label={`Lumo glowing at ${stage.name}`} />
        <div className="kicker" style={{ marginTop: 18 }}>glow-up!</div>
        <h2 id="glowup-title">Lumo reached {stage.name}!</h2>
        <Squiggle color="#ffd27a" width={300} style={{ margin: '0 auto' }} />
        <p>{message}</p>

        <div className="stage-dots" aria-hidden="true">
          {STAGES.map((s, i) => (
            <span key={s.name} style={{ display: 'contents' }}>
              {i > 0 && <span className={`bar ${i > idx ? 'off' : ''}`} />}
              <span className={`dot ${i <= idx ? 'on' : ''} ${i === idx ? 'now' : ''}`} />
            </span>
          ))}
        </div>

        <div className="unlock-cards">
          {hat && (
            <div className="unlock-card">
              <span style={{ width: 54 }}><Hat id={hat} standalone /></span>
              <span><span className="new">new look!</span><br /><span className="what">{UNLOCK_LABEL[hat]}</span></span>
            </div>
          )}
          {glow && (
            <div className="unlock-card">
              <span className={`swatch ${glow}`} style={{ display: 'inline-block' }} />
              <span><span className="new">new glow!</span><br /><span className="what">{UNLOCK_LABEL[glow].replace(' glow', '')}</span></span>
            </div>
          )}
          {!hasItems && (
            <div className="unlock-card">
              <Sparkle size={40} style={{ position: 'static' }} />
              <span><span className="new">new!</span><br /><span className="what">{UNLOCK_LABEL.sparkles}</span></span>
            </div>
          )}
        </div>

        <div className="actions" style={{ justifyContent: 'center' }}>
          {hasItems && <button type="button" className="btn primary" onClick={equip}>Put them on!</button>}
          <button type="button" className="btn ghost" onClick={onClose}>{hasItems ? 'Later' : 'Yay!'}</button>
        </div>
      </div>
    </div>
  );
}
