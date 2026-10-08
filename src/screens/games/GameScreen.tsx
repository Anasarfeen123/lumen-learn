import { useCallback, useEffect, useRef, useState } from 'react';
import { useLumen } from '../../state/store';
import { Close } from '../../components/Icons';
import { Modal } from '../../components/ui';
import { ChoiceGame } from './ChoiceGame';
import { BuilderGame } from './BuilderGame';
import { SpellerGame } from './SpellerGame';
import { BANK } from '../../engine/wordbank';
import { needsRescue, pickRound, rescueItem, type LearnerState } from '../../engine/adaptive';
import { pickSpellerRound, spellerRescue } from '../../engine/speller';
import { completeRound, markServed, recordAnswer } from '../../engine/session';
import { ITEM_XP } from '../../engine/progression';
import { line } from '../../data/lines';
import { sfx } from '../../services/sfx';
import type { GameId, Result, Word } from '../../engine/types';

const IDLE_MS = 60_000;

function startRound(state: LearnerState, game: GameId): { words: Word[]; examples: Word[] } {
  if (game === 'speller') return pickSpellerRound(state);
  return { words: pickRound(state, BANK, game), examples: [] };
}

export interface ItemProps {
  word: Word;
  level: number;
  index: number;
  idle: boolean;
  /** Consecutive first-try answers just before this item. */
  firstStreak: number;
  /** Where the answer sat in recent items, so it doesn't stay put. */
  positions: number[];
  onResolved: (result: Result) => void;
  onContinue: () => void;
  /** Every word in the round so far (Syllable Speller shows finished ones as example rows). */
  round: Word[];
  /** Worked examples picked at the start of the round (Syllable Speller). */
  examples: Word[];
}

export function GameScreen({ game, words }: { game: GameId; words?: Word[] }) {
  const { profile, update, go, say, sessionStart } = useLumen();
  const [start] = useState(() => (words ? { words, examples: [] } : startRound(profile, game)));
  const [round, setRound] = useState<Word[]>(start.words);
  const [level] = useState(() => profile.gameLevels[game]);
  const [startedAt] = useState(() => new Date());
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);
  const [idle, setIdle] = useState(false);
  const positions = useRef<number[]>([]);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Mark the round's words as served once, as it starts.
  useEffect(() => {
    update((p) => markServed(p, round));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle for 60 s: Lumo dozes off and says it's fine to take time. Never a timer.
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);
  useEffect(() => {
    if (idle) say(line('idle'));
  }, [idle, say]);

  const leave = useCallback(() => go({ name: 'hub' }), [go]);
  const requestClose = useCallback(() => {
    // Only ask when the round is over half done.
    if (index >= Math.ceil(round.length / 2)) setConfirmClose(true);
    else leave();
  }, [index, round.length, leave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmClose) requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose, confirmClose]);

  const onResolved = (result: Result) => {
    const word = round[index];
    const next = [...results, result];
    setResults(next);
    update((p) => recordAnswer(p, game, word, result));
    // Rescue rule: two reveals in a row → next item from one level lower.
    if (needsRescue(next) && index + 1 < round.length) {
      const easier = game === 'speller'
        ? spellerRescue(round, index + 1)
        : rescueItem(profileRef.current, BANK, game, round.slice(0, index + 1));
      if (easier) setRound((r) => r.map((w, i) => (i === index + 1 ? easier : w)));
    }
  };

  const onContinue = () => {
    if (index + 1 < round.length) {
      sfx.tick();
      setIndex(index + 1);
      return;
    }
    const { profile: next, summary } = completeRound(profileRef.current, game, results, round, startedAt, sessionStart);
    update(() => next);
    go({ name: 'complete', summary });
  };

  const earned = results.reduce((s, r) => s + ITEM_XP[r], 0);
  const done = results.length;
  let firstStreak = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === 'first'; i--) firstStreak++;
  if (results.length > index) firstStreak = 0; // current item already resolved; streak is for the next

  if (!round.length) {
    return (
      <main className="screen">
        <p>Lumo couldn't find words for this game yet.</p>
        <button type="button" className="btn" onClick={leave}>Back to the map</button>
      </main>
    );
  }

  const item: ItemProps = {
    word: round[index], level, index, idle, firstStreak, positions: positions.current, onResolved, onContinue,
    round, examples: start.examples,
  };
  const key = `${index}-${round[index].id}`;

  return (
    <main className="game" id="main">
      <div className="game-top">
        <button type="button" className="icon-btn plain" onClick={requestClose} aria-label="Back to the map">
          <Close size={30} />
        </button>
        <div className="progress" role="progressbar" aria-label="Round progress" aria-valuemin={0} aria-valuemax={round.length} aria-valuenow={done}>
          <div className="hatch-leaf" style={{ width: `${(done / round.length) * 100}%` }} />
        </div>
        <span className="chip xp-chip" aria-label={`${earned} XP this round`}>+{earned} XP</span>
      </div>

      {game === 'builder' && <BuilderGame key={key} {...item} />}
      {game === 'speller' && <SpellerGame key={key} {...item} />}
      {(game === 'detective' || game === 'sound') && <ChoiceGame key={key} mode={game} {...item} />}

      {confirmClose && (
        <Modal title="Leave this round?" onClose={() => setConfirmClose(false)}>
          <h2 className="title" style={{ fontSize: 34 }}>Leave this round?</h2>
          <p>You're nearly done. Your practice so far still counts.</p>
          <div className="actions">
            <button type="button" className="btn go" onClick={() => setConfirmClose(false)}>Keep playing</button>
            <button type="button" className="btn" onClick={leave}>Leave</button>
          </div>
        </Modal>
      )}
    </main>
  );
}
