import { useCallback, useEffect, useRef, useState } from 'react';
import { useLumen } from '../../state/store';
import { Sheet } from './Sheet';
import { Speaker } from '../../components/Icons';
import { Squiggle } from '../../components/Doodles';
import { builderTiles, type Tile } from '../../engine/items';
import { ITEM_XP } from '../../engine/progression';
import { line } from '../../data/lines';
import { pictureFor } from '../../data/pictures';
import { sfx } from '../../services/sfx';
import type { Result } from '../../engine/types';
import type { ItemProps } from './GameScreen';

type Phase = 'answer' | 'almost' | 'filling' | 'shown' | 'correct';

const FILL_STEP_MS = 600; // slow enough for each letter to be heard

/** Word Builder: tap tiles into slots, then Check. Partial credit shows where to look. */
export function BuilderGame({ word, level, index, idle, firstStreak, onResolved, onContinue }: ItemProps) {
  const { profile, say, speakWord, speakParts } = useLumen();
  const [{ units, tiles }] = useState(() => builderTiles(word, level));
  const [slots, setSlots] = useState<(string | null)[]>(() => units.map(() => null)); // tile ids
  const [locked, setLocked] = useState<boolean[]>(() => units.map(() => false));
  const [checks, setChecks] = useState(0);
  const [phase, setPhase] = useState<Phase>('answer');
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const fillTimer = useRef<number[]>([]);

  const byId = (id: string) => tiles.find((t) => t.id === id)!;
  const placed = new Set(slots.filter(Boolean) as string[]);
  const tray = tiles.filter((t) => !placed.has(t.id));
  const full = slots.every(Boolean);
  const chunks = units.some((u) => u.length > 1);
  const pieceWord = chunks ? 'pieces' : 'letters';
  const name = profile.name;
  const rate = profile.settings.voiceRate;
  const picture = pictureFor(word.picture);

  // After the first wrong check, the tile for the first empty slot glows.
  const firstEmpty = slots.findIndex((s) => !s);
  const hintTile = checks >= 1 && (phase === 'answer' || phase === 'almost') && firstEmpty >= 0
    ? tray.find((t) => !t.decoy && t.text === units[firstEmpty])
    : undefined;

  const playWord = useCallback(async () => {
    setSpeaking(true);
    await speakWord(word.word);
    setSpeaking(false);
  }, [word.word, speakWord]);

  useEffect(() => {
    const intro = index === 0 ? [{ text: 'Build the word.', rate, pauseMs: 200 }] : [];
    void speakParts([...intro, { text: word.word, rate: 0.8 }]);
    const timers = fillTimer.current;
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const place = (tile: Tile) => {
    if (phase !== 'answer') return;
    const i = slots.findIndex((s) => !s);
    if (i < 0) return;
    sfx.tick();
    setSlots(slots.map((s, j) => (j === i ? tile.id : s)));
  };

  const unplace = (i: number) => {
    if (phase !== 'answer' || locked[i] || !slots[i]) return;
    setSlots(slots.map((s, j) => (j === i ? null : s)));
  };

  const resolve = (r: Result) => {
    setResult(r);
    setPhase('correct');
    sfx.correct();
    onResolved(r);
    const msg = r === 'first' && firstStreak + 1 === 3 ? line('streak', name) : 'You built it!';
    setMessage(msg);
    say(msg, { silent: true });
    const beats = word.syllables.length > 1 ? word.syllables.join(' ... ') : word.word;
    void speakParts([{ text: msg, rate, pauseMs: 200 }, { text: beats, rate: 0.75, pauseMs: 250 }, { text: word.word, rate: 0.8 }]);
  };

  const check = () => {
    if (phase !== 'answer' || !full) return;
    const right = slots.map((id, i) => byId(id!).text === units[i]);
    if (right.every(Boolean)) {
      setLocked(units.map(() => true));
      resolve(checks === 0 ? 'first' : 'hint');
      return;
    }
    // Right pieces lock in place; the rest go back to the tray. No shaking.
    setLocked(right);
    setSlots(slots.map((id, i) => (right[i] ? id : null)));
    const n = right.filter(Boolean).length;
    const nextChecks = checks + 1;
    setChecks(nextChecks);
    sfx.almost();

    if (nextChecks === 1) {
      const msg = n > 0 ? `${n} of ${units.length} ${pieceWord} are right! Fix the rest.` : line('miss', name);
      setMessage(msg);
      setPhase('almost');
      say(msg);
      return;
    }
    // Second wrong check: the word fills itself in slowly, saying each piece.
    setPhase('filling');
    const msg = line('reveal', name).replace(' Tap it!', '');
    setMessage(msg);
    say(msg, { silent: true });
    const fillOrder = units.map((_, i) => i).filter((i) => !right[i]);
    const usedIds = new Set(slots.filter((id, i) => right[i] && id) as string[]);
    const assign = fillOrder.map((i) => {
      const t = tiles.find((tile) => !usedIds.has(tile.id) && !tile.decoy && tile.text === units[i])!;
      usedIds.add(t.id);
      return [i, t.id] as const;
    });
    void speakParts([{ text: msg, rate, pauseMs: 100 }]);
    assign.forEach(([i, id], k) => {
      fillTimer.current.push(window.setTimeout(() => {
        setSlots((cur) => cur.map((s, j) => (j === i ? id : s)));
        setLocked((cur) => cur.map((l, j) => (j === i ? true : l)));
        void speakWord(units[i], 0.8);
      }, 1800 + k * FILL_STEP_MS));
    });
    fillTimer.current.push(window.setTimeout(() => {
      setPhase('shown');
      setResult('shown');
      onResolved('shown');
      void speakWord(word.word, 0.8);
    }, 1800 + assign.length * FILL_STEP_MS + 400));
  };

  const tryAgain = () => {
    setPhase('answer');
    if (hintTile) void speakWord(hintTile.text, 0.8);
    else {
      const i = slots.findIndex((s) => !s);
      if (i >= 0) void speakWord(units[i], 0.8);
    }
  };

  const gotIt = () => onContinue();

  // Keyboard: type letters into slots, Backspace returns the last one, Enter checks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('.overlay')) return;
      const k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k) && phase === 'answer' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = tray.find((tile) => tile.text.startsWith(k));
        if (t) place(t);
      } else if (e.key === 'Backspace' && phase === 'answer') {
        e.preventDefault();
        for (let i = slots.length - 1; i >= 0; i--) if (slots[i] && !locked[i]) { unplace(i); break; }
      } else if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        void playWord();
      } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        if (phase === 'answer') check();
        else if (phase === 'almost') tryAgain();
        else if (phase === 'correct') onContinue();
        else if (phase === 'shown') gotIt();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const revealWord = phase === 'correct' || phase === 'shown' || phase === 'filling';

  const sheet = (() => {
    if (idle && phase === 'answer') {
      return <Sheet tone="neutral" pose="sleep" motion="none" title={line('idle')} sub="Tap a letter when you're ready." />;
    }
    switch (phase) {
      case 'correct':
        return (
          <Sheet tone="correct" pose="cheer" motion="hop" title={message}
            sub={word.syllables.length > 1 ? `${word.syllables.join(' ... ')}.` : <span className="learn">{word.word}</span>}
            meta={`+${ITEM_XP[result!]} XP · ${result === 'first' ? 'first try' : 'with a hint'}`}
            action={{ label: 'Continue', onClick: onContinue, variant: 'go' }} />
        );
      case 'almost':
        return (
          <Sheet tone="almost" pose="point" motion="wiggle" title="Almost!" sub={message}
            meta={`The glowing ${chunks ? 'piece' : 'letter'} goes next.`}
            action={{ label: 'Try again', onClick: tryAgain, variant: 'amber' }} />
        );
      case 'filling':
        return <Sheet tone="almost" pose="read" motion="none" title={message} sub="Watch it build, piece by piece." />;
      case 'shown':
        return (
          <Sheet tone="correct" pose="read" motion="none" title="Now you know it!" sub={<span className="learn">{word.word}</span>}
            meta={`+${ITEM_XP.shown} XP · learned together`}
            action={{ label: 'Got it', onClick: gotIt, variant: 'go' }} />
        );
      default:
        return (
          <Sheet tone="neutral" pose="float" title="Build the word you hear."
            sub={full ? 'Happy with that? Press Check.' : `Tap the ${pieceWord} in order.`}
            action={{ label: 'Check', onClick: check, variant: 'go', disabled: !full }} />
        );
    }
  })();

  return (
    <>
      <div className="game-head">
        <div className="kicker" style={{ color: 'var(--accent-builder)' }}>Word Builder · level {level}</div>
        <h1 className="title">Build the word{revealWord ? <>: <span className="learn" style={{ fontWeight: 600 }}>{word.word}</span></> : '!'}</h1>
        <Squiggle color="#7fc796" />
      </div>

      <div className="prompt-row" style={{ justifyContent: 'center' }}>
        <button type="button" className={`listen hatch-leaf ${speaking ? 'speaking' : ''}`} onClick={() => void playWord()} aria-label="Hear the word again">
          <Speaker size={40} />
        </button>
        {picture && <div className="picture sketch" role="img" aria-label={word.picture ?? ''}>{picture}</div>}
      </div>

      <div className="slots" role="group" aria-label={`Word slots, ${units.length} ${pieceWord}`}>
        {slots.map((id, i) => {
          const t = id ? byId(id) : null;
          return (
            <button key={i} type="button" className={`slot ${t ? 'filled' : ''} ${locked[i] ? 'locked' : ''}`}
              onClick={() => unplace(i)} disabled={!t || locked[i] || phase !== 'answer'}
              aria-label={t ? `Slot ${i + 1}: ${t.text}${locked[i] ? ', locked in' : ', tap to send back'}` : `Slot ${i + 1}, empty`}>
              {t?.text ?? ''}
            </button>
          );
        })}
      </div>
      {phase === 'correct' && word.syllables.length > 1 && !chunks && (
        <p className="syllable-hint">{word.syllables.join(' · ')}</p>
      )}

      <div className="tray" role="group" aria-label="Tiles">
        {tray.map((t) => (
          <button key={t.id} type="button" className={`tile ${hintTile?.id === t.id ? 'hint' : ''}`}
            onClick={() => place(t)} disabled={phase !== 'answer'} aria-label={`Tile ${t.text}`}>
            {t.text}
          </button>
        ))}
      </div>
      {sheet}
    </>
  );
}
