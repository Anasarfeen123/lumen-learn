import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLumen } from '../state/store';
import { Lumo } from '../components/Lumo';
import { Bubble, HoldButton, Modal } from '../components/ui';
import { Cloud, Tree } from '../components/Doodles';
import { Beats, Blocks, Check, Chest, Flame, Gear, Lock, Search, Speaker, Star, Stars } from '../components/Icons';
import { GlowUp } from './GlowUp';
import { GAMES, type GameId } from '../engine/types';
import { stageProgress, type Stage } from '../engine/progression';
import { nextNodeIsChest, openChest } from '../engine/session';
import { GAME_NAME } from '../engine/report';
import { speechSupported } from '../services/speech';
import { sfx } from '../services/sfx';
import { line } from '../data/lines';
import type { PathNode } from '../state/profile';

const B = import.meta.env.BASE_URL;

export const GAME_META: Record<GameId, { desc: string; hatch: string; accent: string; Icon: typeof Search }> = {
  detective: { desc: 'Spot the right spelling', hatch: 'hatch-lav', accent: 'var(--accent-detective)', Icon: Search },
  sound: { desc: 'Hear it, find it', hatch: 'hatch-blush', accent: 'var(--accent-sound)', Icon: Speaker },
  builder: { desc: 'Put the letters in order', hatch: 'hatch-leaf', accent: 'var(--accent-builder)', Icon: Blocks },
  speller: { desc: 'Spell it beat by beat', hatch: 'hatch-sky', accent: 'var(--accent-speller)', Icon: Beats },
};

const UNIT_SIZE = 8;
const UNIT_TITLES = ['First words', 'Longer words', 'Tricky words', 'Big words', 'Word explorer'];
const ZIGZAG = [0, 70, 120, 70, 0, -70, -120, -70];
const NODE_GAP = 104;

export function Hub() {
  const { profile, update, go, say, loadDemo, storageOk } = useLumen();
  const [gate, setGate] = useState(false);
  const [glowUp, setGlowUp] = useState<Stage | null>(null);
  const rec = profile.recommended;
  const name = profile.name;

  const greeting = useMemo(() => {
    const returning = profile.rounds.length > 0;
    const hello = returning ? line('hubReturning', name) : `Hi${name ? `, ${name}` : ''}!`;
    return `${hello} I picked ${GAME_NAME[rec]} for you.`;
    // Only re-greet when the recommendation or name changes, not after every round logged.
  }, [rec, name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    say(greeting);
  }, [greeting, say]);

  // Hidden demo shortcut: Shift + D loads a lived-in profile for judging.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
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
    if (game === 'sound' && !speechSupported) return;
    sfx.tick();
    go({ name: 'game', game });
  };

  const onNext = () => {
    if (nextNodeIsChest(profile)) {
      const { profile: next, stages } = openChest(profile);
      update(() => next);
      sfx.chime();
      say('A glow chest! Here is some extra glow.');
      if (stages.length) setGlowUp(stages.at(-1)!);
      return;
    }
    startGame(speechSupported || rec !== 'sound' ? rec : 'detective');
  };

  return (
    <main className="screen" id="main">
      {!speechSupported && (
        <p className="banner" role="status">Your browser can't speak words aloud. Try Chrome or Edge.</p>
      )}
      {!storageOk && (
        <p className="banner" role="status">Progress won't be saved in this browser.</p>
      )}
      <header className="topbar">
        <img className="logo" src={`${B}lumo/wordmark.png`} alt="Lumen" style={{ height: 48 }} />
        <span className="spacer" />
        {profile.streak.days > 0 && (
          <span className="chip" title="Days in a row with a finished round">
            <Flame size={22} /> {profile.streak.days} {profile.streak.days === 1 ? 'day' : 'days'}
          </span>
        )}
        <span className="chip" aria-label={`Lumo's glow: ${progress.label}, ${progress.current} of ${progress.target} XP`}>
          <span className="hatch-yellow" style={{ width: 26, height: 26, border: '2px solid var(--ink)', display: 'inline-block' }} />
          <span>
            {progress.label} · {progress.current}{progress.fraction < 1 ? ` / ${progress.target}` : ''}
            <span className="progress" style={{ display: 'block', height: 10, width: 130, marginTop: 2 }}>
              <div className="hatch-yellow" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </span>
          </span>
        </span>
        <button type="button" className="link" onClick={() => setGate(true)}>for grown-ups</button>
        <button type="button" className="icon-btn" onClick={() => go({ name: 'settings' })} aria-label="Settings">
          <Gear />
        </button>
      </header>

      <div className="hub">
        <section aria-label="Lumo">
          <div className="hub-greet">
            <Lumo pose="wave" size={150} />
            <Bubble text={greeting} className="tilt-r" />
          </div>

          <div className="noticed sticky lav" aria-live="off">
            <span className="label">Lumo noticed...</span>
            <p className="text">{insight ?? "Let's play a round, and I'll start noticing things!"}</p>
          </div>

          <h2 className="title" style={{ fontSize: 30, margin: '0 0 14px' }}>Free play</h2>
          {GAMES.map((g, i) => {
            const meta = GAME_META[g];
            const blocked = g === 'sound' && !speechSupported;
            return (
              <button key={g} type="button" className={`game-card sketch ${i % 2 ? 'alt' : ''}`} onClick={() => startGame(g)} disabled={blocked}
                aria-describedby={blocked ? 'sound-blocked' : undefined}>
                <span className={`icon ${meta.hatch}`} style={{ color: '#2b2c5e' }}><meta.Icon size={30} /></span>
                <span>
                  <span className="name">{GAME_NAME[g]}</span>
                  <span className="desc" id={blocked ? 'sound-blocked' : undefined}>
                    {blocked ? 'Needs a browser that can speak words, such as Chrome or Edge' : meta.desc}
                  </span>
                </span>
                <span className="stars"><Stars count={profile.stars[g] ?? 0} /></span>
                {g === rec && <span className="ribbon">Lumo's pick!</span>}
              </button>
            );
          })}
          <button type="button" className="link" onClick={() => go({ name: 'closet' })}>Lumo's closet</button>
        </section>

        <section aria-label="Lumo's path">
          <LumoPath path={profile.path} onNext={onNext} nextGame={rec} />
        </section>
      </div>

      {gate && (
        <Modal title="For grown-ups" onClose={() => setGate(false)}>
          <h2 className="title" style={{ fontSize: 34 }}>For grown-ups</h2>
          <p>Press and hold for 3 seconds to see the practice summary.</p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 20 }}>
            <HoldButton onDone={() => { setGate(false); go({ name: 'grownup' }); }}>Hold to open</HoldButton>
            <button type="button" className="link" onClick={() => setGate(false)}>Back</button>
          </div>
        </Modal>
      )}
      {glowUp && <GlowUp stage={glowUp} onClose={() => setGlowUp(null)} />}
    </main>
  );
}

function LumoPath({ path, onNext, nextGame }: { path: PathNode[]; onNext: () => void; nextGame: GameId }) {
  const unit = Math.floor(path.length / UNIT_SIZE);
  const startIdx = unit * UNIT_SIZE;
  const done = path.length - startIdx;
  const title = UNIT_TITLES[Math.min(unit, UNIT_TITLES.length - 1)];
  const width = 440;
  const cx = width / 2;
  const pos = (i: number) => ({ x: cx + ZIGZAG[i % ZIGZAG.length], y: 20 + i * NODE_GAP });
  const height = 20 + UNIT_SIZE * NODE_GAP;

  const points = Array.from({ length: UNIT_SIZE }, (_, i) => pos(i));
  const center = (i: number) => ({ x: points[i].x, y: points[i].y + 40 });

  return (
    <>
      <div className="unit-banner">
        <div>
          <div className="unit">Unit {unit + 1}</div>
          <h2>{title}</h2>
        </div>
        <span className="count">{done} of {UNIT_SIZE} done</span>
      </div>
      <div className="path" style={{ height }}>
        <Cloud style={{ right: -10, top: 30 }} />
        <Tree style={{ left: 0, top: 260 }} />
        <Cloud style={{ left: -20, top: 560 }} />
        <Tree color="#f8a8b8" style={{ right: 0, top: 640 }} />
        <svg className="trail" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {points.slice(1).map((_, i) => {
            const a = center(i);
            const b = center(i + 1);
            const behind = i + 1 <= done;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={behind ? '#ffbe46' : '#a99cf0'} strokeWidth={behind ? 8 : 4}
                strokeDasharray={behind ? undefined : '8 10'} strokeLinecap="round" />
            );
          })}
        </svg>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label={`Unit ${unit + 1}: ${title}`}>
          {points.map((p, i) => {
            const node = path[startIdx + i];
            const isNext = i === done;
            const isChest = (startIdx + i + 1) % 5 === 0;
            const style = { left: `${(p.x / width) * 100}%`, top: p.y, '--r': `${(i % 3) - 1}deg` } as CSSProperties;
            if (node) {
              const hatch = node.kind === 'chest' ? 'hatch-yellow' : GAME_META[node.game].hatch;
              return (
                <li key={i} className={`node ${hatch}`} style={style}
                  aria-label={node.kind === 'chest' ? 'Glow chest, opened' : `${GAME_NAME[node.game]}, ${node.stars} stars`}>
                  {node.kind === 'chest' ? <Chest size={36} /> : <Check size={36} />}
                  {node.kind === 'round' && <span className="node-stars"><Stars count={node.stars} size={18} /></span>}
                </li>
              );
            }
            if (isNext) {
              return (
                <li key={i} style={{ position: 'absolute', left: style.left, top: p.y, width: 0, height: 0 }}>
                  <button type="button" className="node next hatch-yellow" style={{ left: 0, top: -6, '--r': '-1deg' } as CSSProperties}
                    onClick={onNext} aria-label={isChest ? 'Open the glow chest' : `Start: ${GAME_NAME[nextGame]}`}>
                    {isChest ? <Chest size={40} /> : <Star size={44} />}
                    <span className="node-label">{isChest ? 'open!' : 'start!'}</span>
                  </button>
                  <span className="path-lumo" style={{ left: 54, top: -10 }}>
                    <Lumo pose="fly" size={110} motion="float" />
                  </span>
                </li>
              );
            }
            return (
              <li key={i} className="node locked hatch-grey" style={style} aria-label={isChest ? 'Glow chest, locked' : 'Locked'}>
                {isChest ? <Chest size={32} /> : <Lock size={30} />}
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
