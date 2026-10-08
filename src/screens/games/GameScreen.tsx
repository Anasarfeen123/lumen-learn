import { useCallback, useEffect, useRef, useState } from 'react';
import { useLumen } from '../../state/store';
import { Close, Flame } from '../../components/Icons';
import { Modal } from '../../components/ui';
import { ChoiceGame } from './ChoiceGame';
import { BuilderGame } from './BuilderGame';
import { SpellerGame } from './SpellerGame';
import { BANK } from '../../engine/wordbank';
import { needsRescue, pickRound, rescueItem, type LearnerState } from '../../engine/adaptive';
import { pickSpellerRound, spellerRescue, spokenSyllables } from '../../engine/speller';
import { pickMixedRound, pickReviewRound, secondChances, SECOND_CHANCE_XP, type Mistakes, type RoundItem } from '../../engine/practice';
import { completeRound, isGame, markServed, recordAnswer, type RoundMode } from '../../engine/session';
import { ITEM_XP } from '../../engine/progression';
import { GAME_NAME } from '../../engine/report';
import { line, GAME_INTRO } from '../../data/lines';
import { pictureFor } from '../../data/pictures';
import { preloadPictures } from '../../components/Picture';
import { sfx } from '../../services/sfx';
import { prefetch, canSpeak, type Part } from '../../services/speech';
import type { GameId, Result, Word } from '../../engine/types';

const IDLE_MS = 60_000;

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
  /** Words finished earlier in this round (Syllable Speller shows them as example rows). */
  round: Word[];
  /** Worked examples picked at the start of the round (Syllable Speller). */
  examples: Word[];
  /** True for a "let's try that again" repeat of a missed word. */
  bonus?: boolean;
}

export const MODE_NAME: Record<Exclude<RoundMode, GameId>, string> = {
  mixed: 'Mixed practice',
  review: 'Practice mistakes',
  milestone: 'Unit challenge',
};

export function modeName(mode: RoundMode): string {
  return isGame(mode) ? GAME_NAME[mode] : MODE_NAME[mode];
}

function startRound(state: LearnerState & { mistakes: Mistakes }, mode: RoundMode, games: GameId[]): { items: RoundItem[]; examples: Word[] } {
  if (mode === 'speller') {
    const r = pickSpellerRound(state);
    return { items: r.words.map((word) => ({ word, game: mode })), examples: r.examples };
  }
  if (isGame(mode)) return { items: pickRound(state, BANK, mode).map((word) => ({ word, game: mode })), examples: [] };
  if (mode === 'review') {
    const review = pickReviewRound(state.mistakes, games);
    // Top up a short review with mixed practice so it's always a full round.
    const extra = review.length < 5 ? pickMixedRound(state, games).filter((i) => !review.some((r) => r.word.id === i.word.id)) : [];
    return { items: [...review, ...extra].slice(0, 5), examples: [] };
  }
  return { items: pickMixedRound(state, games), examples: [] };
}

export function GameScreen({ mode, items: given }: { mode: RoundMode; items?: RoundItem[] }) {
  const { profile, update, go, say, sessionStart } = useLumen();
  const [start] = useState(() => {
    const games: GameId[] = canSpeak() ? ['detective', 'sound', 'builder', 'speller'] : ['detective', 'builder', 'speller'];
    return given ? { items: given, examples: [] as Word[] } : startRound(profile, mode, games);
  });
  const [items, setItems] = useState<RoundItem[]>(start.items);
  const [mainCount] = useState(start.items.length);
  const [levels] = useState(() => profile.gameLevels);
  const [mistakesBefore] = useState(() => profile.mistakes);
  const [startedAt] = useState(() => new Date());
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);
  const [idle, setIdle] = useState(false);
  const positions = useRef<number[]>([]);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Mark the round's words as served once, as it starts, and preload every
  // word, beat, prompt and picture in it so nothing waits on the network.
  useEffect(() => {
    const rate = profile.settings.voiceRate;
    const parts: Part[] = [{ text: 'Find:', rate }, { text: 'Build the word.', rate }];
    for (const g of new Set(items.map((i) => i.game))) parts.push({ text: GAME_INTRO[g], rate });
    for (const { word } of items) {
      parts.push({ text: word.word, rate: 0.8 });
      for (const b of word.family ? spokenSyllables(word) : word.syllables) parts.push({ text: b, rate: 0.7 });
    }
    prefetch(parts);
    preloadPictures(items.map((i) => pictureFor(i.word.picture)));
    update((p) => markServed(p, items.map((i) => i.word)));
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
    if (index >= Math.ceil(mainCount / 2)) setConfirmClose(true);
    else leave();
  }, [index, mainCount, leave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmClose && !document.querySelector('.overlay')) requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose, confirmClose]);

  const onResolved = (result: Result) => {
    const item = items[index];
    const next = [...results, result];
    setResults(next);
    update((p) => recordAnswer(p, item.game, item.word, result));
    // Rescue rule: two reveals in a row → next main item from one level lower (single-game rounds).
    if (isGame(mode) && index + 1 < mainCount && needsRescue(next)) {
      const words = items.map((i) => i.word);
      const easier = mode === 'speller'
        ? spellerRescue(words, index + 1)
        : rescueItem(profileRef.current, BANK, mode, words.slice(0, index + 1));
      if (easier) setItems((list) => list.map((it, i) => (i === index + 1 ? { ...it, word: easier } : it)));
    }
    // Duolingo-style: once the main items are done, missed words come back for a second try.
    if (index === mainCount - 1) {
      const again = secondChances(items.slice(0, mainCount), next);
      if (again.length) setItems((list) => [...list.slice(0, mainCount), ...again]);
    }
  };

  const onContinue = () => {
    if (index + 1 < items.length) {
      sfx.tick();
      if (index + 1 === mainCount) say("Let's try these again. You've got this!");
      setIndex(index + 1);
      return;
    }
    const { profile: next, summary } = completeRound(
      profileRef.current, mode, items.slice(0, mainCount), results.slice(0, mainCount), results.slice(mainCount),
      startedAt, sessionStart, new Date(), mistakesBefore,
    );
    update(() => next);
    go({ name: 'complete', summary });
  };

  if (!items.length) {
    return (
      <main className="screen">
        <p>Lumo couldn't find words for this round yet.</p>
        <button type="button" className="btn" onClick={leave}>Back to the map</button>
      </main>
    );
  }

  const item = items[index];
  const earned = results.reduce((s, r, i) => s + (i < mainCount ? ITEM_XP[r] : r === 'first' ? SECOND_CHANCE_XP : 0), 0);
  let combo = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === 'first'; i--) combo++;
  // The streak Lumo celebrates is the one before the current item.
  const firstStreak = results.length > index ? 0 : combo;

  const props: ItemProps = {
    word: item.word,
    level: levels[item.game],
    index,
    idle,
    firstStreak,
    positions: positions.current,
    onResolved,
    onContinue,
    round: items.slice(0, index).filter((i) => i.game === item.game).map((i) => i.word),
    examples: start.examples,
    bonus: item.bonus,
  };
  const key = `${index}-${item.word.id}`;

  return (
    <main className="game" id="main">
      <div className="game-top">
        <button type="button" className="icon-btn plain" onClick={requestClose} aria-label="Back to the map">
          <Close size={30} />
        </button>
        <div className="progress-wrap">
          {combo >= 3 && (
            <span className="combo" key={combo} aria-live="polite"><Flame size={16} /> {combo} in a row!</span>
          )}
          <div className="progress" role="progressbar" aria-label="Round progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={results.length}>
            <div className="hatch-leaf" style={{ width: `${(results.length / items.length) * 100}%` }} />
          </div>
        </div>
        <span className="chip xp-chip" aria-label={`${earned} XP this round`}>+{earned} XP</span>
      </div>

      {(!isGame(mode) || item.bonus) && (
        <div className={`mode-tag ${item.bonus ? 'again' : ''}`}>
          {item.bonus ? "Let's try that again!" : `${modeName(mode)} · ${GAME_NAME[item.game]}`}
        </div>
      )}

      {item.game === 'builder' && <BuilderGame key={key} {...props} />}
      {item.game === 'speller' && <SpellerGame key={key} {...props} />}
      {(item.game === 'detective' || item.game === 'sound') && <ChoiceGame key={key} mode={item.game} {...props} />}

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
