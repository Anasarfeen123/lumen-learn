import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '../router';
import { useLumen } from '../state/store';
import { Lumo } from '../components/Lumo';
import { Picture } from '../components/Picture';
import { Squiggle } from '../components/Doodles';
import { Arrow, Bulb, Check, Close, Speaker } from '../components/Icons';
import { pictureFor } from '../data/pictures';
import { shuffle } from '../engine/random';
import { stagesCrossed } from '../engine/progression';
import { speak, stopSpeaking } from '../services/speech';
import { sfx } from '../services/sfx';
import { getStory } from '../library/content';
import {
  ACTIVITY_BY_ID, ORDER, PATTERNS, RIDDLES, STORY_QUIZZES, TWINS, WRITE_PROMPTS,
  type ActivityInfo, type Choice, type OrderItem, type WritePrompt,
} from './activities';
import { dueReviews, finishRun, needsSupport, recordAttempt, type Attempt } from './learning';

type Item =
  | { kind: 'choice'; data: Choice; showPicture: boolean }
  | { kind: 'order'; data: OrderItem }
  | { kind: 'write'; data: WritePrompt };

interface ItemState {
  done: boolean;
  correct: boolean;
  hints: number;
  revealed: boolean;
  response: string;
}

function pickItems(activity: ActivityInfo, level: 1 | 2, due: string[], quizIndex: number): { items: Item[]; storyId?: string } {
  const fromPool = (pool: Choice[], n: number, showPicture: boolean): Item[] => {
    const leveled = pool.filter((c) => (level === 1 ? c.level === 1 : true));
    const review = pool.filter((c) => due.includes(c.id)).slice(0, 2);
    const rest = shuffle(leveled.filter((c) => !review.includes(c)));
    return [...review, ...rest].slice(0, n).map((data) => ({ kind: 'choice' as const, data: { ...data, options: shuffle(data.options) }, showPicture }));
  };
  switch (activity.id) {
    case 'twins': return { items: fromPool(TWINS, 5, true) };
    case 'patterns': return { items: fromPool(PATTERNS, 5, true) };
    case 'riddles': return { items: fromPool(RIDDLES, 5, false) };
    case 'order': {
      const pool = ORDER.filter((o) => (level === 1 ? o.level === 1 : true));
      return { items: shuffle(pool).slice(0, 4).map((data) => ({ kind: 'order' as const, data })) };
    }
    case 'story': {
      const quiz = STORY_QUIZZES[quizIndex % STORY_QUIZZES.length];
      return { items: quiz.questions.map((data) => ({ kind: 'choice' as const, data, showPicture: false })), storyId: quiz.storyId };
    }
    default: return { items: [{ kind: 'write', data: WRITE_PROMPTS[Math.floor(Math.random() * WRITE_PROMPTS.length)] }] };
  }
}

const newRunId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function ActivityScreen({ id }: { id: string }) {
  const activity = ACTIVITY_BY_ID.get(id);
  const { navigate } = useRouter();
  if (!activity) {
    return (
      <main className="screen" id="main">
        <h1 className="title">This activity isn't here</h1>
        <button type="button" className="btn" onClick={() => navigate('/classroom')}>Back to Classroom</button>
      </main>
    );
  }
  return <Activity activity={activity} />;
}

function Activity({ activity }: { activity: ActivityInfo }) {
  const { profile, update, say } = useLumen();
  const { navigate } = useRouter();
  const learning = profile.learning;
  const [level, setLevel] = useState<1 | 2>(learning.levels[activity.id] ?? learning.suggested[activity.id] ?? 1);
  const [phase, setPhase] = useState<'intro' | 'items' | 'support' | 'done'>('intro');
  const [runId, setRunId] = useState(newRunId);
  const [plan, setPlan] = useState<{ items: Item[]; storyId?: string }>(() => ({ items: [] }));
  const [index, setIndex] = useState(0);
  const [states, setStates] = useState<ItemState[]>([]);
  const [runAttempts, setRunAttempts] = useState<Attempt[]>([]);
  const [supportShown, setSupportShown] = useState(false);
  const [supportDue, setSupportDue] = useState(false);
  const [result, setResult] = useState<{ xp: number; firstTry: number; suggestion: 1 | 2 | null; rewarded: boolean } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [phase, index]);

  const start = () => {
    const quizIndex = learning.runs.filter((r) => r.startsWith('story')).length;
    const p = pickItems(activity, level, dueReviews(learning, activity.id), quizIndex);
    setPlan(p);
    setStates(p.items.map(() => ({ done: false, correct: false, hints: 0, revealed: false, response: '' })));
    setRunAttempts([]);
    setSupportShown(false);
    setSupportDue(false);
    setIndex(0);
    setRunId(`${activity.id}-${newRunId()}`);
    update((pr) => ({ ...pr, learning: { ...pr.learning, levels: { ...pr.learning.levels, [activity.id]: level } } }));
    setPhase('items');
  };

  const resolve = (i: number, s: ItemState) => {
    setStates((all) => all.map((x, j) => (j === i ? s : x)));
    const item = plan.items[i];
    const conditions: string[] = [];
    if (item.kind === 'choice' && item.showPicture) conditions.push('picture');
    if (activity.id === 'patterns') conditions.push('audio');
    if (item.kind === 'write') conditions.push('not-scored');
    const attempt: Attempt = {
      t: new Date().toISOString(), activity: activity.id, version: activity.version, item: item.data.id,
      response: s.response, correct: s.correct, hints: s.hints, revealed: s.revealed,
      mode: s.revealed ? 'guided' : 'independent', conditions, skill: activity.skill,
    };
    const run = [...runAttempts, attempt];
    setRunAttempts(run);
    update((p) => ({
      ...p,
      learning: {
        ...recordAttempt(p.learning, attempt),
        writing: item.kind === 'write' ? [...p.learning.writing, { t: attempt.t, prompt: item.data.prompt, text: s.response }].slice(-50) : p.learning.writing,
      },
    }));
    // Two misses in a row: explain again, once per run, before the next item.
    if (!supportShown && needsSupport(run) && i + 1 < plan.items.length) {
      setSupportShown(true);
      setSupportDue(true);
    }
  };

  const next = () => {
    if (index + 1 < plan.items.length) {
      if (supportDue) {
        setSupportDue(false);
        setPhase('support');
        say("Let's look at it together first.");
        return;
      }
      setIndex(index + 1);
      return;
    }
    // Finished: reward once. The run id is checked again inside the update, so a double tap can't pay twice.
    const o = finishRun(profile.learning, runId, activity.id, runAttempts, level);
    setResult({ xp: o.xp, firstTry: o.firstTry, suggestion: o.suggestion, rewarded: o.rewarded });
    if (o.rewarded) {
      update((p) => {
        if (p.learning.runs.includes(runId)) return p;
        const stages = stagesCrossed(p.xp, p.xp + o.xp);
        return {
          ...p,
          xp: p.xp + o.xp,
          learning: { ...p.learning, runs: o.state.runs, suggested: o.state.suggested },
          unlocked: [...new Set([...p.unlocked, ...stages.flatMap((s) => s.unlocks)])],
        };
      });
    }
    sfx.fanfare();
    say('You finished! I loved working on that with you.');
    setPhase('done');
  };

  const exit = () => { stopSpeaking(); navigate('/classroom'); };
  const story = plan.storyId ? getStory(plan.storyId, true) : undefined;

  if (phase === 'intro') {
    return (
      <main className="screen activity" id="main">
        <TopBar onExit={exit} title={activity.title} />
        <div className="teach sketch">
          <Lumo pose="guiding" size={110} motion="float" />
          <div>
            <span className="ov-label">Learn first</span>
            <h1 className="title" tabIndex={-1} ref={heading}>{activity.teach.title}</h1>
            <Squiggle color="#f2a65a" width={200} />
            <p className="learn teach-text">{activity.teach.text}</p>
            <div className="example sticky yellow">
              <span className="ov-label">Example</span>
              <p className="learn"><strong>{activity.teach.example}</strong></p>
              <p>{activity.teach.exampleNote}</p>
            </div>
            <button type="button" className="btn small" onClick={() => void speak(`${activity.teach.text} For example: ${activity.teach.example}`, { rate: profile.settings.voiceRate })}>
              <Speaker size={20} /> Read this to me
            </button>
          </div>
        </div>
        {activity.id !== 'write' && activity.id !== 'story' && (
          <div className="seg level-pick" role="group" aria-label="Which set?">
            <button type="button" aria-pressed={level === 1} onClick={() => setLevel(1)}>Gentle set</button>
            <button type="button" aria-pressed={level === 2} onClick={() => setLevel(2)}>Harder set</button>
            {learning.suggested[activity.id] && <span className="muted">Lumo suggests the {learning.suggested[activity.id] === 2 ? 'harder' : 'gentle'} set. You choose.</span>}
          </div>
        )}
        <div className="actions">
          <button type="button" className="btn go" onClick={start}>Start <Arrow size={24} /></button>
          <button type="button" className="btn" onClick={exit}>Back to Classroom</button>
        </div>
      </main>
    );
  }

  if (phase === 'support') {
    return (
      <main className="screen activity" id="main">
        <TopBar onExit={exit} title={activity.title} />
        <div className="teach sketch">
          <Lumo pose="encouraging" size={110} motion="none" />
          <div>
            <span className="ov-label">Let's look together</span>
            <h1 className="title" tabIndex={-1} ref={heading}>{activity.teach.title}</h1>
            <p className="learn teach-text">{activity.teach.text}</p>
            <div className="example sticky yellow">
              <p className="learn"><strong>{activity.teach.example}</strong></p>
              <p>{activity.teach.exampleNote}</p>
            </div>
          </div>
        </div>
        <div className="actions"><button type="button" className="btn go" onClick={() => { setPhase('items'); setIndex(index + 1); }}>Got it, next one <Arrow size={24} /></button></div>
      </main>
    );
  }

  if (phase === 'done') {
    const total = plan.items.length;
    const right = states.filter((s) => s.correct).length;
    return (
      <main className="screen activity done-screen" id="main">
        <Lumo pose="celebrating" size={180} motion="hop" />
        <h1 className="title" tabIndex={-1} ref={heading}>You finished {activity.title}!</h1>
        {activity.id === 'write'
          ? <p className="learn">Your sentence is saved. Grown-ups can read it in their notes.</p>
          : <p className="learn">{right} of {total} done{result ? `, ${result.firstTry} right on the first try` : ''}.</p>}
        {result?.rewarded && <p className="chip xp-chip">+{result.xp} XP</p>}
        {result?.suggestion && (
          <p className="sticky lav" style={{ maxWidth: 480 }}>
            {result.suggestion === 2 ? 'That went really well. Next time, try the harder set?' : 'Next time, the gentle set might feel better. You can always switch.'}
          </p>
        )}
        <div className="actions">
          <button type="button" className="btn go" onClick={() => { if (result?.suggestion) setLevel(result.suggestion); setPhase('intro'); setResult(null); }}>Try again</button>
          <button type="button" className="btn" onClick={exit}>Back to Classroom</button>
        </div>
      </main>
    );
  }

  const item = plan.items[index];
  const state = states[index];
  return (
    <main className="screen activity" id="main">
      <TopBar onExit={exit} title={activity.title} progress={(states.filter((s) => s.done).length) / plan.items.length} />
      {story && (
        <details className="story-panel sketch" open={index === 0}>
          <summary><strong>{story.title}</strong> <span className="muted">(read it again any time)</span></summary>
          {story.pages.map((p, i) => <p key={i} className="learn story-page">{p}</p>)}
          <button type="button" className="btn small" onClick={() => void speak(story.pages.join(' '), { rate: profile.settings.voiceRate })}><Speaker size={20} /> Read it to me</button>
        </details>
      )}
      <h1 className="sr-only" tabIndex={-1} ref={heading}>Question {index + 1} of {plan.items.length}</h1>
      {item.kind === 'choice' && <ChoiceView key={`${runId}-${index}`} item={item} state={state} onResolve={(s) => resolve(index, s)} activityId={activity.id} />}
      {item.kind === 'order' && <OrderView key={`${runId}-${index}`} item={item.data} state={state} onResolve={(s) => resolve(index, s)} />}
      {item.kind === 'write' && <WriteView key={`${runId}-${index}`} item={item.data} state={state} onResolve={(s) => resolve(index, s)} />}

      <nav className="item-nav" aria-label="Questions">
        <button type="button" className="btn small" onClick={() => setIndex(index - 1)} disabled={index === 0}>← Previous</button>
        <span className="hand">{index + 1} of {plan.items.length}</span>
        <button type="button" className="btn small go" onClick={next} disabled={!state.done} title={state.done ? undefined : 'Answer this one first'}>
          {index + 1 < plan.items.length ? 'Next →' : 'Finish'}
        </button>
      </nav>
    </main>
  );
}

function TopBar({ onExit, title, progress }: { onExit: () => void; title: string; progress?: number }) {
  return (
    <div className="game-top">
      <button type="button" className="icon-btn plain" onClick={onExit} aria-label="Back to Classroom"><Close size={30} /></button>
      {progress !== undefined
        ? <div className="progress" role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><div className="hatch-leaf" style={{ width: `${progress * 100}%` }} /></div>
        : <span className="hand activity-name">{title}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- multiple choice

function ChoiceView({ item, state, onResolve, activityId }: { item: Extract<Item, { kind: 'choice' }>; state: ItemState; onResolve: (s: ItemState) => void; activityId: string }) {
  const { data } = item;
  const { profile } = useLumen();
  const [picked, setPicked] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [removed, setRemoved] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const pic = pictureFor(data.picture ?? null);
  const rate = profile.settings.voiceRate;
  const readOut = () => void speak(data.say ?? data.prompt.replace(/_+( _+)*/g, 'blank'), { rate: data.say ? 0.8 : rate, style: data.say ? 'word' : 'lumo' });

  const check = () => {
    if (!picked || state.done) return;
    if (picked === data.answer) {
      sfx.correct();
      setMsg(null);
      onResolve({ done: true, correct: true, hints: tries, revealed: false, response: picked });
      void speak(`Yes! ${data.explain}`, { rate });
      return;
    }
    sfx.almost();
    if (tries === 0) {
      setTries(1);
      setRemoved([picked]);
      setPicked(null);
      setMsg(`Almost! ${data.hint}`);
      void speak(`Almost! ${data.hint}`, { rate });
      return;
    }
    // Second miss: show the answer and why.
    onResolve({ done: true, correct: false, hints: tries, revealed: true, response: picked });
    setMsg(null);
    void speak(`The answer is ${data.answer}. ${data.explain}`, { rate });
  };

  const parts = data.prompt.split(/(_+(?: _+)*)/);
  return (
    <section className="activity-item">
      <div className="prompt-row">
        <button type="button" className="listen hatch-sky" onClick={readOut} aria-label="Read it to me"><Speaker size={34} /></button>
        {pic && (item.showPicture || state.done) && <Picture picture={pic} />}
        <p className="activity-prompt learn">
          {parts.map((p, i) => (/^_/.test(p) ? <span key={i} className="gap" aria-label="blank">{state.done ? data.answer : ' '}</span> : <span key={i}>{p}</span>))}
        </p>
      </div>
      <div className="answers small" role="group" aria-label="Choices">
        {data.options.map((o, i) => {
          const isAnswer = o === data.answer;
          const cls = ['answer', removed.includes(o) && 'removed', state.done && isAnswer && (state.correct ? 'correct' : 'reveal')].filter(Boolean).join(' ');
          return (
            <button key={o} type="button" className={cls} aria-pressed={picked === o} disabled={state.done || removed.includes(o)} onClick={() => { sfx.tick(); setPicked(o); }}>
              <span className="key" aria-hidden="true">{i + 1}</span>
              <span className="answer-text" style={{ '--len': Math.max(...data.options.map((x) => x.length)) } as React.CSSProperties}>{o}</span>
            </button>
          );
        })}
      </div>
      {msg && <p className="feedback almost" role="status"><Lumo pose="guiding" size={56} motion="none" /> {msg}</p>}
      {state.done && (
        <p className={`feedback ${state.correct ? 'right' : 'almost'}`} role="status">
          <Lumo pose={state.correct ? 'celebrating' : 'encouraging'} size={56} motion="none" />
          <span>{state.correct ? 'Yes! ' : `The answer is “${data.answer}”. `}{data.explain}</span>
        </p>
      )}
      {!state.done && (
        <div className="actions">
          <button type="button" className="btn go" onClick={check} disabled={!picked}>Check</button>
          {tries === 0 && activityId !== 'story' && <button type="button" className="link" onClick={() => { setTries(1); setMsg(data.hint); }}>I'd like a hint</button>}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- sentence order

function OrderView({ item, state, onResolve }: { item: OrderItem; state: ItemState; onResolve: (s: ItemState) => void }) {
  const { profile } = useLumen();
  const tiles = useMemo(() => {
    let s = shuffle(item.words.map((w, i) => ({ w, i })));
    for (let n = 0; n < 10 && s.every((t, j) => t.i === j); n++) s = shuffle(s);
    return s;
  }, [item]);
  const [line, setLine] = useState<number[]>([]); // tile positions in `tiles`
  const [tries, setTries] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const pic = pictureFor(item.picture ?? null);
  const sentence = item.words.join(' ');
  const built = line.map((k) => tiles[k].w).join(' ');

  const check = () => {
    if (line.length !== tiles.length) return;
    if (built === sentence) {
      sfx.correct();
      onResolve({ done: true, correct: true, hints: tries, revealed: false, response: built });
      void speak(sentence, { rate: profile.settings.voiceRate });
      setMsg(null);
      return;
    }
    sfx.almost();
    if (tries === 0) {
      setTries(1);
      const firstWrong = line.findIndex((k, pos) => tiles[k].w !== item.words[pos]);
      setLine(line.slice(0, Math.max(0, firstWrong)));
      setMsg(`Almost! ${item.hint}`);
      return;
    }
    onResolve({ done: true, correct: false, hints: tries, revealed: true, response: built });
    setMsg(null);
    void speak(`Here it is: ${sentence}`, { rate: profile.settings.voiceRate });
  };

  return (
    <section className="activity-item">
      <div className="prompt-row">
        {pic && <Picture picture={pic} />}
        <p className="muted">Tap the words in order to make a sentence. Tap a word in the line to take it back.</p>
      </div>
      <div className="order-line sketch" aria-label="Your sentence" aria-live="polite">
        {(state.done ? item.words : line.map((k) => tiles[k].w)).map((w, pos) => (
          <button key={pos} type="button" className={`tile word-tile ${state.done ? (state.correct ? 'right' : 'shown') : ''}`} disabled={state.done}
            onClick={() => setLine(line.filter((_, j) => j !== pos))}>{w}</button>
        ))}
        {!state.done && line.length === 0 && <span className="muted">Your sentence goes here</span>}
      </div>
      {!state.done && (
        <div className="tray">
          {tiles.map((t, k) => (
            <button key={k} type="button" className={`tile word-tile ${tries > 0 && line.length === 0 && t.w === item.words[0] ? 'hint' : ''}`} disabled={line.includes(k)}
              onClick={() => { sfx.tick(); setLine([...line, k]); }}>{t.w}</button>
          ))}
        </div>
      )}
      {msg && <p className="feedback almost" role="status"><Lumo pose="guiding" size={56} motion="none" /> {msg}</p>}
      {state.done && (
        <p className={`feedback ${state.correct ? 'right' : 'almost'}`} role="status">
          <Lumo pose={state.correct ? 'celebrating' : 'encouraging'} size={56} motion="none" />
          <span>{state.correct ? 'Yes! ' : 'Here is the sentence. '}It starts with a capital letter and ends with a full stop: “{sentence}”</span>
        </p>
      )}
      {!state.done && <div className="actions"><button type="button" className="btn go" onClick={check} disabled={line.length !== tiles.length}>Check</button></div>}
    </section>
  );
}

// ---------------------------------------------------------------- sentence writing

function WriteView({ item, state, onResolve }: { item: WritePrompt; state: ItemState; onResolve: (s: ItemState) => void }) {
  const [text, setText] = useState(state.response);
  const pic = pictureFor(item.picture ?? null);
  const t = text.trim();
  // Gentle notes, never a score. The writer's spelling is left exactly as typed.
  const notes = state.done ? [
    /^[A-Z]/.test(t) ? { ok: true, text: 'You started with a capital letter.' } : { ok: false, text: 'Tip: sentences start with a capital letter.' },
    /[.!?]$/.test(t) ? { ok: true, text: 'You ended with a full stop (or ! or ?).' } : { ok: false, text: 'Tip: sentences end with a full stop.' },
    new RegExp(`\\b${item.word}`, 'i').test(t) ? { ok: true, text: `You wrote about the ${item.word}.` } : { ok: false, text: `Tip: try using the word “${item.word}”.` },
  ] : [];
  return (
    <section className="activity-item">
      <div className="prompt-row">
        {pic && <Picture picture={pic} />}
        <p className="activity-prompt learn">{item.prompt}</p>
      </div>
      <label>
        <span className="sr-only">Your sentence</span>
        <textarea className="text-input area learn" rows={3} value={text} onChange={(e) => setText(e.target.value)} disabled={state.done} spellCheck={false} placeholder="Write here…" />
      </label>
      {state.done ? (
        <div className="feedback right" role="status">
          <Lumo pose="love" size={56} motion="none" />
          <div>
            <p style={{ margin: 0 }}>Thank you for writing! Here's what Lumo noticed:</p>
            <ul className="notes-list">{notes.map((n) => <li key={n.text} className={n.ok ? 'ok' : ''}>{n.ok ? <Check size={18} /> : <Bulb size={18} />} {n.text}</li>)}</ul>
          </div>
        </div>
      ) : (
        <div className="actions"><button type="button" className="btn go" disabled={t.split(/\s+/).length < 2} onClick={() => onResolve({ done: true, correct: true, hints: 0, revealed: false, response: t })}>I'm done</button></div>
      )}
    </section>
  );
}
