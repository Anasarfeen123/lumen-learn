import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from '../router';
import { useLumen } from '../state/store';
import { Lumo, type Pose } from '../components/Lumo';
import { Picture } from '../components/Picture';
import { Squiggle } from '../components/Doodles';
import { Arrow, Pause, Speaker } from '../components/Icons';
import { pictureFor } from '../data/pictures';
import { sfx } from '../services/sfx';
import { celebrate } from '../services/motion';
import { speak, stopSpeaking } from '../services/speech';
import { isSolved, matchPairs, memoryDeck, patternPuzzle, scrambledBoard, slide, type MemoryCard, type PatternPuzzle, type Token } from './games';

type GameId = 'memory' | 'slide' | 'patterns' | 'match';
type Difficulty = 'easy' | 'medium' | 'hard';

interface Outcome {
  /** Lower is better for moves; higher for correct counts. */
  score: number;
  better: 'lower' | 'higher';
  line: string;
}

interface GameDef {
  id: GameId;
  title: string;
  blurb: string;
  how: string[];
  pose: Pose;
  hatch: string;
  learning: boolean;
}

const GAMES: GameDef[] = [
  { id: 'memory', title: 'Memory match', blurb: 'Find the pairs of pictures.', pose: 'thinking', hatch: 'hatch-lav', learning: false,
    how: ['Tap a card to turn it over.', 'Tap another card. If the pictures match, they stay up.', 'Find every pair. Take as long as you like.'] },
  { id: 'slide', title: 'Slide puzzle', blurb: 'Slide the tiles to fix the picture.', pose: 'laptop', hatch: 'hatch-sky', learning: false,
    how: ['Tap a tile next to the gap to slide it in.', 'Arrow keys work too.', 'Put the picture back together. "Peek" shows the finished picture.'] },
  { id: 'patterns', title: 'Pattern train', blurb: 'What comes next in the pattern?', pose: 'guiding', hatch: 'hatch-yellow', learning: false,
    how: ['Look at the shapes on the train.', 'Find the part that repeats.', 'Choose the shape that comes next.'] },
  { id: 'match', title: 'Word & picture match', blurb: 'Match each word to its picture.', pose: 'happy', hatch: 'hatch-leaf', learning: false,
    how: ['Tap a word, then tap its picture.', 'Tap the speaker to hear a word.', 'Match all the pairs.'] },
];

const DIFFICULTY_TEXT: Record<GameId, Record<Difficulty, string>> = {
  memory: { easy: '4 pairs', medium: '6 pairs', hard: '8 pairs' },
  slide: { easy: '3 × 3, with numbers', medium: '3 × 3', hard: '4 × 4' },
  patterns: { easy: 'Short patterns', medium: 'Longer patterns', hard: 'Tricky patterns' },
  match: { easy: '3 pairs', medium: '4 pairs', hard: '5 pairs' },
};

// ======================================================================= Playground home

export function Playground() {
  const { navigate } = useRouter();
  const { profile } = useLumen();
  return (
    <main className="screen playground" id="main">
      <div className="section-head">
        <div>
          <h1 className="title" tabIndex={-1}>Playground</h1>
          <p className="muted">Games for a break. They're just for fun, so they don't change your learning progress.</p>
        </div>
        <Lumo pose="happy" size={110} motion="float" />
      </div>
      <div className="cards play-cards">
        {GAMES.map((g, i) => {
          const stats = profile.playground[g.id];
          return (
            <a key={g.id} href={`${import.meta.env.BASE_URL}playground/${g.id}`} className={`play-card sketch ${i % 2 ? 'alt' : ''}`} style={{ animationDelay: `${i * 60}ms` }}
              onClick={(e) => { e.preventDefault(); navigate(`/playground/${g.id}`); }}>
              <span className={`play-art ${g.hatch}`}><Preview id={g.id} /></span>
              <span className="story-title">{g.title}</span>
              <span className="story-summary">{g.blurb}</span>
              <span className="muted">{stats ? `Played ${stats.plays} ${stats.plays === 1 ? 'time' : 'times'}` : 'New!'}</span>
            </a>
          );
        })}
      </div>
    </main>
  );
}

function Preview({ id }: { id: GameId }) {
  const cat = pictureFor('cat')!.src;
  const frog = pictureFor('frog')!.src;
  if (id === 'memory') return <span className="preview-grid" aria-hidden="true">{['?', 'cat', '?', 'cat'].map((p, i) => <span key={i} className="mini-card">{p === '?' ? '?' : <img src={cat} alt="" />}</span>)}</span>;
  if (id === 'slide') return <span className="preview-grid three" aria-hidden="true">{[1, 2, 3, 4, 5, '', 7, 8, 6].map((n, i) => <span key={i} className="mini-tile">{n}</span>)}</span>;
  if (id === 'patterns') return <span className="preview-row" aria-hidden="true"><Shape t={{ shape: 'circle', colour: 'yellow' }} /><Shape t={{ shape: 'star', colour: 'lavender' }} /><Shape t={{ shape: 'circle', colour: 'yellow' }} /><span className="mini-q">?</span></span>;
  return <span className="preview-row" aria-hidden="true"><span className="mini-word">frog</span><img className="mini-pic" src={frog} alt="" /></span>;
}

// ======================================================================= One game

export function PlaygroundGame({ id }: { id: string }) {
  const def = GAMES.find((g) => g.id === id);
  const { navigate } = useRouter();
  if (!def) {
    return (
      <main className="screen" id="main">
        <h1 className="title">This game isn't here</h1>
        <button type="button" className="btn" onClick={() => navigate('/playground')}>Back to Playground</button>
      </main>
    );
  }
  return <GameShell def={def} />;
}

function GameShell({ def }: { def: GameDef }) {
  const { profile, update, say } = useLumen();
  const { navigate } = useRouter();
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [guide, setGuide] = useState(true);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [newBest, setNewBest] = useState(false);
  const stats = profile.playground[def.id];

  useEffect(() => () => stopSpeaking(), []);
  const leave = () => navigate('/playground');

  const finish = (o: Outcome) => {
    const prev = profile.playground[def.id];
    const key = `${def.id}-${difficulty}`;
    const prevBest = profile.playground[key]?.best ?? null;
    const best = prevBest === null ? o.score : o.better === 'lower' ? Math.min(prevBest, o.score) : Math.max(prevBest, o.score);
    setNewBest(prevBest !== null && best !== prevBest);
    // Casual scores only: nothing here touches reading or spelling progress.
    update((p) => ({
      ...p,
      playground: {
        ...p.playground,
        [def.id]: { plays: (prev?.plays ?? 0) + 1, best: null, lastT: new Date().toISOString() },
        [key]: { plays: (p.playground[key]?.plays ?? 0) + 1, best, lastT: new Date().toISOString() },
      },
    }));
    setOutcome(o);
    sfx.fanfare();
    celebrate('#main h1', { count: 26, spread: 1.4, delay: 200 });
    say(o.line);
    setPhase('done');
  };

  if (phase === 'intro') {
    return (
      <main className="screen play-intro" id="main">
        <button type="button" className="btn small" onClick={leave}><span aria-hidden="true">←</span> Back to Playground</button>
        <div className="teach sketch">
          <span className={`play-art big ${def.hatch}`}><Preview id={def.id} /></span>
          <div>
            <h1 className="title" tabIndex={-1}>{def.title}</h1>
            <Squiggle color="#f2a65a" width={180} />
            <ol className="how">{def.how.map((h) => <li key={h}>{h}</li>)}</ol>
            {stats && <p className="muted">You've played {stats.plays} {stats.plays === 1 ? 'time' : 'times'}.</p>}
          </div>
        </div>
        <div className="seg" role="group" aria-label="How hard?">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} type="button" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
              {d[0].toUpperCase() + d.slice(1)} <span className="muted">· {DIFFICULTY_TEXT[def.id][d]}</span>
            </button>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} /> Lumo gives tips while I play</label>
        <div className="actions">
          <button type="button" className="btn go" onClick={() => { setRound((r) => r + 1); setPaused(false); setPhase('play'); }}>Start <Arrow size={24} /></button>
        </div>
      </main>
    );
  }

  if (phase === 'done' && outcome) {
    return (
      <main className="screen activity done-screen" id="main">
        <Lumo pose="celebrating" size={180} motion="hop" />
        <h1 className="title" tabIndex={-1}>{def.title}: done!</h1>
        <p className="learn">{outcome.line}</p>
        {newBest && <p className="chip xp-chip">New personal best!</p>}
        <div className="actions">
          <button type="button" className="btn go" onClick={() => { setRound((r) => r + 1); setPhase('play'); }}>Play again</button>
          <button type="button" className="btn" onClick={() => setPhase('intro')}>Change level</button>
          <button type="button" className="btn" onClick={leave}>Back to Playground</button>
        </div>
      </main>
    );
  }

  const props = { difficulty, guide, paused, onFinish: finish, say };
  return (
    <main className="screen play-screen" id="main">
      <div className="game-top">
        <button type="button" className="btn small" onClick={() => setPaused(true)} >
          <Pause size={18} /> Pause
        </button>
        <h1 className="hand play-title" tabIndex={-1}>{def.title}</h1>
        <button type="button" className="link" onClick={leave}>Leave</button>
      </div>
      <div className={paused ? 'paused-board' : ''} aria-hidden={paused}>
        {def.id === 'memory' && <Memory key={round} {...props} />}
        {def.id === 'slide' && <Slide key={round} {...props} />}
        {def.id === 'patterns' && <Patterns key={round} {...props} />}
        {def.id === 'match' && <Match key={round} {...props} />}
      </div>
      {paused && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Paused">
          <div className="modal sketch" style={{ textAlign: 'center' }}>
            <Lumo pose="drinking" size={110} motion="none" />
            <h2 className="title" style={{ fontSize: 34 }}>Paused</h2>
            <p>Take a break. Your game will wait.</p>
            <div className="actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn go" onClick={() => setPaused(false)} autoFocus>Keep playing</button>
              <button type="button" className="btn" onClick={leave}>Back to Playground</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

interface GameProps {
  difficulty: Difficulty;
  guide: boolean;
  paused: boolean;
  onFinish: (o: Outcome) => void;
  say: (text: string) => void;
}

function Tip({ show, children, pose = 'guiding' }: { show: boolean; children: ReactNode; pose?: Pose }) {
  if (!show) return null;
  return <p className="feedback tip" role="status"><Lumo pose={pose} size={52} motion="none" /> <span>{children}</span></p>;
}

// ======================================================================= Memory match

function Memory({ difficulty, guide, paused, onFinish }: GameProps) {
  const pairs = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 8;
  const [deck, setDeck] = useState<MemoryCard[]>(() => memoryDeck(pairs));
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [tip, setTip] = useState('Turn over two cards.');
  const busy = useRef(false);

  const flip = (i: number) => {
    if (paused || busy.current || deck[i].matched || open.includes(i)) return;
    sfx.tick();
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next;
    if (deck[a].picture === deck[b].picture) {
      sfx.correct();
      const d = deck.map((c, j) => (j === a || j === b ? { ...c, matched: true } : c));
      setDeck(d);
      setOpen([]);
      setTip(`A pair of ${deck[a].picture}s!`);
      if (d.every((c) => c.matched)) setTimeout(() => onFinish({ score: moves + 1, better: 'lower', line: `You found all ${pairs} pairs in ${moves + 1} turns!` }), 500);
    } else {
      busy.current = true;
      setTip('Not a pair. Try to remember where they were.');
      // A short look at both cards before they turn back. Not a timer: nothing is lost.
      setTimeout(() => { setOpen([]); busy.current = false; }, 1000);
    }
  };

  return (
    <>
      <div className="memory-grid" style={{ '--cols': pairs <= 4 ? 4 : pairs <= 6 ? 4 : 4 } as CSSProperties}>
        {deck.map((c, i) => {
          const shown = c.matched || open.includes(i);
          const pic = pictureFor(c.picture);
          return (
            <button key={c.id} type="button" className={`memory-card sketch ${shown ? 'up' : ''} ${c.matched ? 'matched' : ''}`} onClick={() => flip(i)}
              aria-label={shown ? `${c.picture}${c.matched ? ', matched' : ''}` : `Card ${i + 1}, face down`} disabled={c.matched}>
              <span className="face back" aria-hidden="true">?</span>
              <span className="face front" aria-hidden="true">{pic && <img src={pic.src} alt="" />}</span>
            </button>
          );
        })}
      </div>
      <p className="hand play-stat">Turns: {moves}</p>
      <Tip show={guide}>{tip}</Tip>
    </>
  );
}

// ======================================================================= Slide puzzle

const SLIDE_PICTURES = ['rocket', 'butterfly', 'dragon', 'whale', 'rainbow', 'octopus'];

function Slide({ difficulty, guide, paused, onFinish }: GameProps) {
  const size = difficulty === 'hard' ? 4 : 3;
  const numbers = difficulty === 'easy';
  const picture = useMemo(() => SLIDE_PICTURES[Math.floor(Math.random() * SLIDE_PICTURES.length)], []);
  const pic = pictureFor(picture)!;
  const [board, setBoard] = useState(() => scrambledBoard(size, size === 3 ? 40 : 90));
  const [moves, setMoves] = useState(0);
  const [peek, setPeek] = useState(false);

  const move = (i: number) => {
    if (paused) return;
    const next = slide(board, i, size);
    if (next === board) return;
    sfx.tick();
    setBoard(next);
    setMoves((m) => m + 1);
    if (isSolved(next)) setTimeout(() => onFinish({ score: moves + 1, better: 'lower', line: `You fixed the ${picture} in ${moves + 1} moves!` }), 400);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const gap = board.indexOf(0);
      // Arrow keys slide the tile on that side of the gap into it.
      const from = { ArrowLeft: gap + 1, ArrowRight: gap - 1, ArrowUp: gap + size, ArrowDown: gap - size }[e.key];
      if (from === undefined) return;
      e.preventDefault();
      if (from >= 0 && from < board.length && (Math.floor(from / size) === Math.floor(gap / size) || from % size === gap % size)) move(from);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className="slide-board sketch" style={{ '--n': size } as CSSProperties} role="group" aria-label={`Slide puzzle of a ${picture}`}>
        {board.map((v, i) => v === 0 ? <span key="gap" className="slide-gap" aria-label="Gap" /> : (
          <button key={v} type="button" className="slide-tile" onClick={() => move(i)} aria-label={`Tile ${v}`}
            style={{ backgroundImage: `url(${pic.src})`, backgroundSize: `${size * 100}% ${size * 100}%`, backgroundPosition: `${((v - 1) % size) * (100 / (size - 1))}% ${Math.floor((v - 1) / size) * (100 / (size - 1))}%` }}>
            {numbers && <span className="tile-num">{v}</span>}
          </button>
        ))}
      </div>
      <div className="actions" style={{ justifyContent: 'center' }}>
        <span className="hand play-stat">Moves: {moves}</span>
        <button type="button" className="btn small" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setPeek(true); }} onKeyUp={() => setPeek(false)}>Hold to peek</button>
      </div>
      {peek && <div className="peek sketch"><img src={pic.src} alt={`The finished ${picture}`} /></div>}
      <Tip show={guide}>Tip: put the top row in place first, then the next row.</Tip>
    </>
  );
}

// ======================================================================= Pattern train

const COLOUR_HEX: Record<Token['colour'], string> = { yellow: '#ffbe46', lavender: '#8e80e3', sky: '#78afe6', blush: '#f28ca0', leaf: '#2e8b57' };

function Shape({ t, size = 46 }: { t: Token; size?: number }) {
  const fill = COLOUR_HEX[t.colour];
  const common = { fill, stroke: '#2b2c5e', strokeWidth: 3, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={`${t.colour} ${t.shape}`}>
      {t.shape === 'circle' && <circle cx="24" cy="24" r="18" {...common} />}
      {t.shape === 'square' && <rect x="7" y="7" width="34" height="34" rx="4" {...common} />}
      {t.shape === 'triangle' && <path d="M24 6 L43 40 H5 Z" {...common} />}
      {t.shape === 'star' && <path d="M24 4l5.9 12.4 13.6 1.7-10 9.4 2.6 13.5L24 34.4 11.9 41l2.6-13.5-10-9.4 13.6-1.7z" {...common} />}
      {t.shape === 'heart' && <path d="M24 42S5 30 5 17a9.5 9.5 0 0 1 19-3 9.5 9.5 0 0 1 19 3c0 13-19 25-19 25z" {...common} />}
    </svg>
  );
}

function Patterns({ difficulty, guide, paused, onFinish }: GameProps) {
  const level = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  const total = 6;
  const [n, setN] = useState(0);
  const [puzzle, setPuzzle] = useState<PatternPuzzle>(() => patternPuzzle(level));
  const [right, setRight] = useState(0);
  const [tries, setTries] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);

  const choose = (i: number) => {
    if (paused || answered !== null) return;
    if (i === puzzle.answer) {
      sfx.correct();
      if (tries === 0) setRight((r) => r + 1);
      setAnswered(i);
    } else {
      sfx.almost();
      setTries((t) => t + 1);
      if (tries >= 1) setAnswered(puzzle.answer);
    }
  };
  const next = () => {
    if (n + 1 >= total) { onFinish({ score: right, better: 'higher', line: `You finished the pattern train! ${right} of ${total} right on the first try.` }); return; }
    setN(n + 1);
    setPuzzle(patternPuzzle(level));
    setTries(0);
    setAnswered(null);
  };

  return (
    <>
      <p className="hand play-stat">Carriage {n + 1} of {total}</p>
      <div className="pattern-train sketch" aria-label="The pattern so far">
        {puzzle.shown.map((t, i) => <span key={i} className="car"><Shape t={t} /></span>)}
        <span className="car next" aria-label="What comes next?">{answered !== null ? <Shape t={puzzle.options[puzzle.answer]} /> : '?'}</span>
      </div>
      <div className="answers small" role="group" aria-label="Choose what comes next">
        {puzzle.options.map((t, i) => (
          <button key={i} type="button" className={`answer shape-answer ${answered === i ? 'correct' : ''}`} onClick={() => choose(i)} disabled={answered !== null}>
            <span className="key" aria-hidden="true">{i + 1}</span><Shape t={t} size={56} />
          </button>
        ))}
      </div>
      {tries === 1 && answered === null && <Tip show>Look again: {puzzle.rule}</Tip>}
      {answered !== null && (
        <div className="actions" style={{ justifyContent: 'center' }}>
          <p className="feedback right"><Lumo pose={tries === 0 ? 'celebrating' : 'encouraging'} size={52} motion="none" /> {tries === 0 ? 'Yes! That comes next.' : `This one comes next. ${puzzle.rule}`}</p>
          <button type="button" className="btn go" onClick={next} autoFocus>{n + 1 >= total ? 'Finish' : 'Next carriage'}</button>
        </div>
      )}
      <Tip show={guide && n === 0 && tries === 0 && answered === null}>Say the shapes out loud. Can you hear the part that repeats?</Tip>
    </>
  );
}

// ======================================================================= Word & picture match

function Match({ difficulty, guide, paused, onFinish }: GameProps) {
  const count = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5;
  const [pairs] = useState(() => matchPairs(count));
  const [pictureOrder] = useState(() => [...pairs].sort(() => Math.random() - 0.5));
  const [matched, setMatched] = useState<string[]>([]);
  const [word, setWord] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [msg, setMsg] = useState('');

  const pickPicture = (picture: string) => {
    if (paused || !word) { setMsg('Tap a word first.'); return; }
    setTries((t) => t + 1);
    const pair = pairs.find((p) => p.word === word)!;
    if (pair.picture === picture) {
      sfx.correct();
      const m = [...matched, word];
      setMatched(m);
      setWord(null);
      setMsg(`Yes: ${word}!`);
      if (m.length === pairs.length) setTimeout(() => onFinish({ score: tries + 1, better: 'lower', line: `You matched all ${pairs.length} words in ${tries + 1} tries!` }), 400);
    } else {
      sfx.almost();
      setMsg('Not that one. Look at the word again.');
    }
  };

  return (
    <>
      <p className="muted">Just for fun. This game doesn't change your reading progress.</p>
      <div className="match-board">
        <div className="match-col" role="group" aria-label="Words">
          {pairs.map((p) => (
            <div key={p.word} className="match-word-row">
              <button type="button" className={`answer match-word ${word === p.word ? 'on' : ''} ${matched.includes(p.word) ? 'correct' : ''}`} aria-pressed={word === p.word}
                disabled={matched.includes(p.word)} onClick={() => { sfx.tick(); setWord(p.word); setMsg(''); }}>
                <span className="learn">{p.word}</span>
              </button>
              <button type="button" className="icon-btn" onClick={() => void speak(p.word, { rate: 0.8, style: 'word' })} aria-label={`Hear ${p.word}`}><Speaker size={20} /></button>
            </div>
          ))}
        </div>
        <div className="match-col pics" role="group" aria-label="Pictures">
          {pictureOrder.map((p) => {
            const pic = pictureFor(p.picture)!;
            const done = matched.includes(p.word);
            return (
              <button key={p.picture} type="button" className={`match-pic ${done ? 'done' : ''}`} disabled={done} onClick={() => pickPicture(p.picture)} aria-label={done ? `${p.picture}, matched` : `Picture: ${p.picture}`}>
                <Picture picture={pic} />
              </button>
            );
          })}
        </div>
      </div>
      {msg && <p className="feedback tip" role="status">{msg}</p>}
      <Tip show={guide && matched.length === 0 && !word}>Read a word, then find its picture.</Tip>
    </>
  );
}
