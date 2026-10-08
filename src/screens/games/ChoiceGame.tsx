import { useCallback, useEffect, useState } from 'react';
import { useLumen } from '../../state/store';
import { Sheet } from './Sheet';
import { Speaker } from '../../components/Icons';
import { Squiggle } from '../../components/Doodles';
import { arrangeOptions, detectiveDistractors, firstSound, sayableSound, soundDistractors } from '../../engine/items';
import { ITEM_XP } from '../../engine/progression';
import { GAME_NAME } from '../../engine/report';
import { GAME_INTRO, line } from '../../data/lines';
import { pictureFor } from '../../data/pictures';
import { sfx } from '../../services/sfx';
import type { Result } from '../../engine/types';
import type { ItemProps } from './GameScreen';

type Phase = 'answer' | 'almost' | 'reveal' | 'correct';

const RESULT_NOTE: Record<Result, string> = { first: 'first try', hint: 'with a hint', shown: 'learned together' };

/** Word Detective and Sound Match: select a card, then press Check. */
export function ChoiceGame({ mode, word, level, index, idle, firstStreak, positions, onResolved, onContinue }: ItemProps & { mode: 'detective' | 'sound' }) {
  const { profile, say, speakWord, speakParts } = useLumen();
  const answer = word.word;
  const [options] = useState(() => {
    const distractors = mode === 'detective' ? detectiveDistractors(word, level) : soundDistractors(word, level);
    const order = arrangeOptions(answer, distractors, positions.slice(0, index));
    positions[index] = order.indexOf(answer); // by index, so a double-run initializer is harmless
    return order;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [misses, setMisses] = useState(0);
  const [phase, setPhase] = useState<Phase>('answer');
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState('');
  const [hint, setHint] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const picture = pictureFor(word.picture);
  // Detective shows the picture except at level 5; Sound Match only as a reward.
  const showPicture = picture && (mode === 'detective' ? level < 5 : phase === 'correct');
  const name = profile.name;
  const rate = profile.settings.voiceRate;

  const playWord = useCallback(async () => {
    setSpeaking(true);
    await speakWord(answer);
    setSpeaking(false);
  }, [answer, speakWord]);

  // Spoken prompt for each item. The target word is only ever heard, never shown.
  useEffect(() => {
    const intro = index === 0 ? [{ text: GAME_INTRO[mode], rate, pauseMs: mode === 'sound' ? 600 : 200 }] : [];
    const prompt = mode === 'detective'
      ? [{ text: 'Find:', rate, pauseMs: 150 }, { text: answer, rate: 0.8 }]
      : [{ text: answer, rate: 0.8 }];
    const t = window.setTimeout(() => void speakParts([...intro, ...prompt]), mode === 'sound' && index > 0 ? 600 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (opt: string) => {
    if (removed.has(opt)) return;
    if (phase === 'reveal') {
      // The learner always ends the item by tapping the right answer.
      if (opt === answer) resolve('shown');
      return;
    }
    if (phase !== 'answer') return;
    sfx.tick();
    setSelected(opt);
  };

  const resolve = (r: Result) => {
    setResult(r);
    setPhase('correct');
    setSelected(answer);
    sfx.correct();
    onResolved(r);
    const msg = r === 'first' ? (firstStreak + 1 === 3 ? line('streak', name) : line('first', name))
      : r === 'hint' ? line('afterHint', name)
      : 'Now you know it!';
    setMessage(msg);
    say(msg, { silent: true });
    void speakParts([{ text: msg, rate, pauseMs: 200 }, { text: `${answer}!`, rate: 0.8 }]);
  };

  const check = () => {
    if (phase !== 'answer' || !selected) return;
    if (selected === answer) {
      resolve(misses === 0 ? 'first' : 'hint');
      return;
    }
    const nextMisses = misses + 1;
    setMisses(nextMisses);
    const gone = new Set(removed).add(selected);
    if (nextMisses === 1) {
      // Exactly two cards remain: the answer and one distractor. Never fewer.
      const wrongLeft = options.filter((o) => o !== answer && !gone.has(o));
      if (wrongLeft.length > 1) gone.add(wrongLeft[0]);
      setRemoved(gone);
      setSelected(null);
      setPhase('almost');
      sfx.almost();
      const msg = line('miss', name);
      setMessage(msg);
      if (mode === 'detective') {
        const parts = word.syllables;
        setHint(parts.length > 1 ? `Listen to the beats: ${parts.join(' · ')}` : 'Listen slowly, sound by sound.');
        say(msg, { silent: true });
        void speakParts([
          { text: msg, rate, pauseMs: 300 },
          ...parts.map((s, i) => ({ text: s, rate: 0.7, pauseMs: i < parts.length - 1 ? 350 : 0 })),
        ]);
      } else {
        const head = firstSound(answer);
        setHint(head);
        say(msg, { silent: true });
        void speakParts([
          { text: msg, rate, pauseMs: 300 },
          { text: sayableSound(head), rate: 0.7, pauseMs: 400 },
          { text: answer, rate: 0.7 },
        ]);
      }
      return;
    }
    // Second miss: reveal the answer; the learner taps it to finish.
    setRemoved(gone);
    setSelected(null);
    setPhase('reveal');
    const msg = line('reveal', name);
    setMessage(msg);
    say(msg);
  };

  const tryAgain = () => {
    setPhase('answer');
    setSelected(null);
  };

  // Keyboard play: 1–4 pick, Enter checks/continues, Space replays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('.overlay')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        choose(options[n - 1]);
      } else if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        void playWord();
      } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        if (phase === 'answer') check();
        else if (phase === 'almost') tryAgain();
        else if (phase === 'correct') onContinue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const title = mode === 'detective' ? "Find the word that's spelled right!" : 'Listen, then tap the word you hear!';
  const accent = mode === 'detective' ? 'var(--accent-detective)' : 'var(--accent-sound)';
  const listenHatch = mode === 'detective' ? 'hatch-lav' : 'hatch-blush';

  const sheet = (() => {
    if (idle && phase === 'answer') {
      return <Sheet tone="neutral" pose="sleep" motion="none" title={line('idle')} sub="Tap a word when you're ready." />;
    }
    switch (phase) {
      case 'correct':
        return (
          <Sheet tone="correct" pose="cheer" motion="hop" title={message} sub={<span className="learn">{answer}</span>}
            meta={`+${ITEM_XP[result!]} XP · ${RESULT_NOTE[result!]}`}
            action={{ label: 'Continue', onClick: onContinue, variant: 'go' }} />
        );
      case 'almost':
        return (
          <Sheet tone="almost" pose="point" motion="wiggle" title={message}
            sub={mode === 'sound'
              ? <>Listen to the first sound: <span className="chunk">{hint}</span></>
              : hint}
            meta="played slowly"
            action={{ label: 'Try again', onClick: tryAgain, variant: 'amber' }} />
        );
      case 'reveal':
        return <Sheet tone="almost" pose="read" motion="none" title={message} sub="Tap the glowing word." />;
      default:
        return (
          <Sheet tone="neutral" pose="float"
            title={mode === 'detective' ? 'Which one is spelled right?' : 'Which word did you hear?'}
            sub={selected ? 'Happy with that? Press Check.' : 'Tap a word, then press Check.'}
            action={{ label: 'Check', onClick: check, variant: 'go', disabled: !selected }} />
        );
    }
  })();

  return (
    <>
      <div className="game-head">
        <div className="kicker" style={{ color: accent }}>{GAME_NAME[mode]} · level {level}</div>
        <h1 className="title">{title}</h1>
        <Squiggle color={accent} />
      </div>

      <div className="prompt-row" style={mode === 'sound' ? { justifyContent: 'center' } : undefined}>
        <button type="button" className={`listen ${listenHatch} ${mode === 'sound' ? 'big' : ''} ${speaking ? 'speaking' : ''}`}
          onClick={() => void playWord()} aria-label="Hear the word again">
          <Speaker size={mode === 'sound' ? 64 : 40} />
        </button>
        {showPicture && <div className={`picture sketch ${mode === 'sound' ? 'pop' : ''}`} role="img" aria-label={word.picture ?? ''}>{picture}</div>}
        {mode === 'detective' && <p className="hint-text">Tap a word, then press <mark>Check!</mark></p>}
      </div>

      <div className="answers" role="group" aria-label="Answer cards">
        {options.map((opt, i) => {
          const isRemoved = removed.has(opt);
          const isAnswer = opt === answer;
          const cls = [
            'answer',
            isRemoved && 'removed',
            phase === 'correct' && isAnswer && 'correct',
            phase === 'reveal' && isAnswer && 'reveal',
          ].filter(Boolean).join(' ');
          return (
            <button key={opt} type="button" className={cls} lang="en"
              aria-pressed={selected === opt && phase === 'answer'}
              disabled={isRemoved || phase === 'correct' || phase === 'almost' || (phase === 'reveal' && !isAnswer)}
              onClick={() => choose(opt)}>
              <span className="key" aria-hidden="true">{i + 1}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {mode === 'sound' && phase !== 'correct' && (
        <p className="hint-text" style={{ marginTop: 18 }}>No picture yet. It pops in as a reward once you find the word.</p>
      )}
      {sheet}
    </>
  );
}
