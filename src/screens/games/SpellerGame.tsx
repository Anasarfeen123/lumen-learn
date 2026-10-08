import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLumen } from '../../state/store';
import { Sheet } from './Sheet';
import { Speaker } from '../../components/Icons';
import { Squiggle } from '../../components/Doodles';
import { FAMILY_BY_ID, givenSyllables, showExamples, spokenSyllables } from '../../engine/speller';
import { ITEM_XP } from '../../engine/progression';
import { line } from '../../data/lines';
import { sfx } from '../../services/sfx';
import { celebrate } from '../../services/motion';
import type { Result, Word } from '../../engine/types';
import type { ItemProps } from './GameScreen';
import { useTip } from './useTip';

type Phase = 'answer' | 'almost' | 'filling' | 'shown' | 'correct';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const MAX_BOX = 6;
const FILL_STEP_MS = 600;
const DRAG_THRESHOLD = 8;

/**
 * Syllable Speller (Orton-Gillingham style): the word is said beat by beat,
 * finished words sit above as examples, the family's ending is given, and the
 * learner taps or drags letters from the alphabet into each syllable box.
 */
export function SpellerGame({ word, level, index, idle, firstStreak, onResolved, onContinue, round, examples }: ItemProps) {
  const { profile, say, speakParts } = useLumen();
  const family = FAMILY_BY_ID.get(word.family ?? '');
  const syl = word.syllables;
  const [given] = useState(() => givenSyllables(word, level, family?.given ?? null));
  const [boxes, setBoxes] = useState<string[]>(() => syl.map((s, i) => (given[i] ? s : '')));
  const [locked, setLocked] = useState<boolean[]>(() => given.slice());
  const [active, setActive] = useState(() => given.indexOf(false));
  const [checks, setChecks] = useState(0);
  const [phase, setPhase] = useState<Phase>('answer');
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [drag, setDrag] = useState<{ letter: string; x: number; y: number } | null>(null);
  const dragStart = useRef<{ letter: string; x: number; y: number; moved: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const tip = useTip({ game: 'speller', word: word.word, syllables: word.syllables, tags: word.tags });
  const [aiTip, setAiTip] = useState<string | null>(null);
  const rate = profile.settings.voiceRate;
  const name = profile.name;

  const open = syl.map((_, i) => !locked[i]);
  const canCheck = phase === 'answer' && boxes.every((b, i) => locked[i] || b.length > 0);
  const said = spokenSyllables(word);
  // Example rows: the worked examples, then each word finished this round.
  const exampleRows: Word[] = showExamples(level) ? [...examples, ...round.slice(0, index)].slice(-2) : [];

  /** "va … ca … tion", then the whole word. */
  const sayBeats = useCallback(async (lead: { text: string; rate?: number; pauseMs?: number }[] = []) => {
    setSpeaking(true);
    await speakParts([
      ...lead,
      ...said.map((s, i) => ({ text: s, rate: 0.7, pauseMs: i < said.length - 1 ? 450 : 500 })),
      { text: word.word, rate: 0.8 },
    ]);
    setSpeaking(false);
  }, [said, speakParts, word.word]);

  useEffect(() => {
    const intro = index === 0 ? [{ text: 'Spell the word one beat at a time.', rate, pauseMs: 250 }] : [];
    void sayBeats([...intro, { text: word.word, rate: 0.8, pauseMs: 400 }]);
    const t = timers.current;
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextOpen = (from: number, dir = 1) => {
    for (let i = from; i >= 0 && i < syl.length; i += dir) if (!locked[i]) return i;
    return -1;
  };

  const addLetter = (letter: string, at = active) => {
    if (phase !== 'answer' || at < 0 || locked[at]) return;
    if (boxes[at].length >= MAX_BOX) return;
    sfx.tick();
    setBoxes((b) => b.map((v, i) => (i === at ? v + letter : v)));
    setActive(at);
  };

  const backspace = () => {
    if (phase !== 'answer') return;
    if (active >= 0 && boxes[active]) {
      setBoxes((b) => b.map((v, i) => (i === active ? v.slice(0, -1) : v)));
      return;
    }
    const prev = nextOpen(active - 1, -1);
    if (prev >= 0) setActive(prev);
  };

  const moveActive = (dir: 1 | -1) => {
    const n = nextOpen(active + dir, dir);
    if (n >= 0) setActive(n);
  };

  // ------------------------------------------------ drag (pointer) or tap
  const onLetterDown = (e: ReactPointerEvent<HTMLButtonElement>, letter: string) => {
    if (phase !== 'answer') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { letter, x: e.clientX, y: e.clientY, moved: false };
  };
  const onLetterMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragStart.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_THRESHOLD) d.moved = true;
    if (d.moved) setDrag({ letter: d.letter, x: e.clientX, y: e.clientY });
  };
  const onLetterUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragStart.current;
    dragStart.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) {
      addLetter(d.letter);
      return;
    }
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-box]');
    if (target) addLetter(d.letter, Number(target.dataset.box));
  };

  // ------------------------------------------------ checking
  const resolve = (r: Result) => {
    setResult(r);
    setPhase('correct');
    setLocked(syl.map(() => true));
    sfx.correct();
    celebrate('.sheet.correct .sheet-title');
    onResolved(r);
    const msg = r === 'first' ? (firstStreak + 1 === 3 ? line('streak', name) : line('first', name)) : line('afterHint', name);
    setMessage(msg);
    say(msg, { silent: true });
    void sayBeats([{ text: msg, rate, pauseMs: 300 }]);
  };

  const check = () => {
    if (!canCheck) return;
    const right = syl.map((s, i) => locked[i] || boxes[i] === s);
    if (right.every(Boolean)) {
      resolve(checks === 0 ? 'first' : 'hint');
      return;
    }
    const openIdx = syl.map((_, i) => i).filter((i) => !locked[i]);
    const nRight = openIdx.filter((i) => right[i]).length;
    const wrong = openIdx.filter((i) => !right[i]);
    setLocked(right);
    setBoxes((b) => b.map((v, i) => (right[i] ? v : '')));
    setActive(wrong[0]);
    const nextChecks = checks + 1;
    setChecks(nextChecks);
    sfx.almost();

    if (nextChecks === 1) {
      const msg = nRight > 0 ? `${nRight} of ${openIdx.length} beats are right! Fix the rest.` : line('miss', name);
      setMessage(msg);
      setPhase('almost');
      const smart = tip.current;
      setAiTip(smart);
      say(smart ? `${msg} ${smart}` : msg, { silent: true });
      // Replay just the beats that need fixing, slowly.
      void speakParts([
        { text: msg, rate, pauseMs: 300 },
        ...(smart ? [{ text: smart, rate, pauseMs: 300 }] : []),
        ...wrong.map((i) => ({ text: said[i], rate: 0.65, pauseMs: 450 })),
        { text: word.word, rate: 0.8 },
      ]);
      return;
    }

    // Second miss: fill the word in beat by beat, letter by letter.
    setPhase('filling');
    const msg = "This one's tricky. Watch the beats.";
    setMessage(msg);
    say(msg, { silent: true });
    void speakParts([{ text: msg, rate }]);
    let step = 0;
    for (const i of wrong) {
      syl[i].split('').forEach((_, k) => {
        timers.current.push(window.setTimeout(() => {
          setBoxes((b) => b.map((v, j) => (j === i ? syl[i].slice(0, k + 1) : v)));
          if (k === syl[i].length - 1) {
            setLocked((l) => l.map((x, j) => (j === i ? true : x)));
            void speakParts([{ text: said[i], rate: 0.7 }]);
          }
        }, 1600 + step++ * FILL_STEP_MS));
      });
      step += 1; // a beat's pause between syllables
    }
    timers.current.push(window.setTimeout(() => {
      setPhase('shown');
      setResult('shown');
      onResolved('shown');
      void sayBeats();
    }, 1600 + step * FILL_STEP_MS + 300));
  };

  const tryAgain = () => setPhase('answer');

  // ------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('.overlay')) return;
      const k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        addLetter(k);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (e.key === 'ArrowRight' || e.key === '-' || e.key === '/') {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === ' ' && el.tagName !== 'BUTTON') {
        e.preventDefault();
        void sayBeats();
      } else if (e.key === 'Enter' && el.tagName !== 'BUTTON') {
        // One press, one step: stop the browser from also pressing the button that gets focus next
        // (the feedback sheet focuses Continue), and ignore a held-down key.
        e.preventDefault();
        if (e.repeat) return;
        if (phase === 'answer') check();
        else if (phase === 'almost') tryAgain();
        else if (phase === 'correct' || phase === 'shown') onContinue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const revealed = phase === 'correct' || phase === 'shown';

  const sheet = (() => {
    if (idle && phase === 'answer') {
      return <Sheet tone="neutral" pose="sleep" motion="none" title={line('idle')} sub="Tap a letter when you're ready." />;
    }
    switch (phase) {
      case 'correct':
        return (
          <Sheet tone="correct" pose="cheer" motion="hop" title={message} sub={`${syl.join(' · ')}`}
            meta={`+${ITEM_XP[result!]} XP · ${result === 'first' ? 'first try' : 'with a hint'}`}
            action={{ label: 'Continue', onClick: onContinue, variant: 'go' }} />
        );
      case 'almost':
        return (
          <Sheet tone="almost" pose="point" motion="wiggle" title="Almost!" sub={message}
            meta={aiTip ?? 'The dots show how many letters each beat needs.'}
            action={{ label: 'Try again', onClick: tryAgain, variant: 'amber' }} />
        );
      case 'filling':
        return <Sheet tone="almost" pose="read" motion="none" title={message} sub="Listen to each beat as it fills in." />;
      case 'shown':
        return (
          <Sheet tone="correct" pose="read" motion="none" title="Now you know it!" sub={syl.join(' · ')}
            meta={`+${ITEM_XP.shown} XP · learned together`}
            action={{ label: 'Got it', onClick: onContinue, variant: 'go' }} />
        );
      default:
        return (
          <Sheet tone="neutral" pose="float" title="Spell it beat by beat."
            sub={canCheck ? 'Happy with that? Press Check.' : 'Tap or drag letters into the boxes.'}
            action={{ label: 'Check', onClick: check, variant: 'go', disabled: !canCheck }} />
        );
    }
  })();

  return (
    <>
      <div className="game-head">
        <div className="kicker" style={{ color: 'var(--accent-speller)' }}>
          Syllable Speller · level {level}{family ? ` · ${family.label}` : ''}
        </div>
        <h1 className="title">Spell it one beat at a time!</h1>
        <Squiggle color="#78afe6" />
      </div>

      <div className="alphabet" role="group" aria-label="Alphabet. Tap a letter, or drag it into a box.">
        {ALPHABET.map((ch) => (
          <button key={ch} type="button" className="key-letter"
            disabled={phase !== 'answer'}
            onPointerDown={(e) => onLetterDown(e, ch)}
            onPointerMove={onLetterMove}
            onPointerUp={onLetterUp}
            onPointerCancel={() => { dragStart.current = null; setDrag(null); }}
            onClick={(e) => { if (e.detail === 0) addLetter(ch); /* keyboard activation */ }}
            aria-label={`Letter ${ch}`}>
            {ch}
          </button>
        ))}
        <button type="button" className="key-letter key-back" onClick={backspace} disabled={phase !== 'answer'} aria-label="Delete a letter">⌫</button>
      </div>

      <div className="speller-rows">
        {exampleRows.map((w) => (
          <div key={w.id} className="speller-row example" aria-label={`Example: ${w.word}, ${w.syllables.join(', ')}`}>
            {w.syllables.map((s, i) => <span key={i} className="beat done">{s}</span>)}
            <span className="row-word" aria-hidden="true">{w.word}</span>
          </div>
        ))}

        <div className="speller-row current">
          <button type="button" className={`listen hatch-sky ${speaking ? 'speaking' : ''}`} onClick={() => void sayBeats()}
            aria-label="Hear the word beat by beat" style={{ width: 72, height: 72 }}>
            <Speaker size={32} />
          </button>
          {syl.map((s, i) => {
            const isGiven = given[i];
            const isActive = i === active && phase === 'answer' && open[i];
            const showDots = checks >= 1 && !locked[i] && !boxes[i];
            return (
              <button key={i} type="button" data-box={i}
                className={['beat', 'box', isGiven && 'given', locked[i] && !isGiven && 'locked', isActive && 'active'].filter(Boolean).join(' ')}
                onClick={() => open[i] && setActive(i)}
                disabled={!open[i] || phase !== 'answer'}
                aria-label={isGiven ? `Beat ${i + 1}, given: ${s}` : `Beat ${i + 1}: ${boxes[i] || 'empty'}${isActive ? ', selected' : ''}`}>
                {boxes[i] || (showDots ? <span className="dots" aria-hidden="true">{'·'.repeat(s.length)}</span> : '')}
              </button>
            );
          })}
          {revealed && <span className="row-word">{word.word}</span>}
        </div>
      </div>

      {drag && (
        <span className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">{drag.letter}</span>
      )}
      {sheet}
    </>
  );
}
