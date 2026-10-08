import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { paragraphs, sentenceAt, type Token } from './segment';
import { getWordHelp, localHelp, type WordHelp } from './wordhelp';
import { getBookmarks, getPosition, markFinished, savePosition, toggleBookmark, type Bookmark, type ReadingKind } from './progress';
import { readAloud, speak, stopSpeaking, deviceSpeechSupported, type ReadAloud } from '../services/speech';
import { useLumen } from '../state/store';
import { Lumo } from '../components/Lumo';
import { Arrow, Close, Speaker } from '../components/Icons';
import type { Feeling } from '../personal/personal';

const FEELINGS: { id: Feeling; label: string; pose: 'love' | 'happy' | 'thinking' }[] = [
  { id: 'loved', label: 'Loved it', pose: 'love' },
  { id: 'ok', label: 'It was OK', pose: 'happy' },
  { id: 'not-for-me', label: 'Not for me', pose: 'thinking' },
];

interface Props {
  kind: ReadingKind;
  id: string;
  title: string;
  pages: string[];
  onBack: () => void;
  backLabel: string;
  /** Shown under the title, e.g. "Your upload" or the story level. */
  subtitle?: string;
  /** Ask "How was this story?" on the last page; the answer helps Lumo choose what comes next. */
  feeling?: { value: Feeling | null; onChange: (f: Feeling) => void };
}

interface Prefs { size: number; spacing: number; width: 'narrow' | 'medium' | 'wide'; focus: boolean; rate: number }
const PREFS_KEY = 'lumen.reader.v1';
const DEFAULT_PREFS: Prefs = { size: 1, spacing: 1.9, width: 'medium', focus: false, rate: 0.9 };

function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }; } catch { return DEFAULT_PREFS; }
}

type Playback = 'stopped' | 'playing' | 'paused';

/** The whole-word reader used for stories and confirmed uploads. */
export function Reader({ kind, id, title, pages, onBack, backLabel, subtitle, feeling }: Props) {
  const { profile } = useLumen();
  const saved = useMemo(() => getPosition(kind, id), [kind, id]);
  const [page, setPage] = useState(() => Math.min(saved?.page ?? 0, pages.length - 1));
  const [selected, setSelected] = useState<number | null>(null); // token start index on this page
  const [cursor, setCursor] = useState<number | null>(saved?.index ?? null); // roving focus
  const [help, setHelp] = useState<WordHelp | null>(null);
  const [helpLoading, setHelpLoading] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [showPrefs, setShowPrefs] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => getBookmarks(kind, id));
  const [playback, setPlayback] = useState<Playback>('stopped');
  const [spoken, setSpoken] = useState<number | null>(null); // word being read aloud (only with real timings)
  const [chunk, setChunk] = useState<number | null>(null); // paragraph being read aloud
  const [snap, setSnap] = useState<{ text: string; x: number; y: number } | null>(null);
  const controller = useRef<ReadAloud | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const helpReq = useRef(0);

  const text = pages[page] ?? '';
  const paras = useMemo(() => paragraphs(text), [text]);
  const wordTokens = useMemo(() => paras.flatMap((p) => p.tokens.filter((t) => t.word)), [paras]);
  const last = page === pages.length - 1;

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* blocked */ } }, [prefs]);

  // Save the place whenever the page or the selected word changes.
  useEffect(() => {
    savePosition(kind, id, title, page, selected ?? cursor ?? 0);
  }, [kind, id, title, page, selected, cursor]);

  // Never speak by itself; stop any speech when leaving the reader or turning the page.
  const stopReading = useCallback(() => {
    controller.current?.stop();
    controller.current = null;
    setPlayback('stopped');
    setSpoken(null);
    setChunk(null);
  }, []);
  useEffect(() => () => { controller.current?.stop(); stopSpeaking(); }, []);

  const goPage = (n: number) => {
    stopReading();
    setHelp(null);
    setSelected(null);
    setCursor(null);
    setPage(n);
    textRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  };

  const openHelp = async (tok: Token) => {
    setSelected(tok.start);
    setCursor(tok.start);
    const local = localHelp(tok.text);
    const req = ++helpReq.current;
    if (local) { setHelp(local); setHelpLoading(false); return; }
    setHelp({ word: tok.text, meaning: null, example: null, emoji: null, icon: null, source: 'none' });
    setHelpLoading(true);
    const h = await getWordHelp(tok.text, sentenceAt(text, tok.start));
    if (req === helpReq.current) { setHelp(h); setHelpLoading(false); }
  };

  const closeHelp = () => {
    setHelp(null);
    const at = selected;
    setSelected(null);
    // Return focus to the same word, so reading continues from the same place.
    requestAnimationFrame(() => textRef.current?.querySelector<HTMLElement>(`[data-start="${at}"]`)?.focus());
  };

  const sayWord = (w: string) => void speak(w, { rate: 0.8, style: 'word' });

  // Read aloud: one chunk per paragraph. Word highlighting only appears if the voice reports word timings.
  const play = () => {
    if (playback === 'paused' && controller.current) {
      controller.current.resume();
      setPlayback('playing');
      return;
    }
    stopReading();
    const from = selected ?? cursor ?? 0;
    const chunks = paras.map((p) => ({
      text: p.tokens.map((t) => t.text).join(''),
      start: p.tokens[0]?.start ?? 0,
    })).filter((c) => c.start + c.text.length > from);
    // Start from the selected word's paragraph, if one is selected.
    if (chunks.length && from > chunks[0].start) {
      const cut = from - chunks[0].start;
      chunks[0] = { text: chunks[0].text.slice(cut), start: from };
    }
    const firstPara = paras.length - chunks.length;
    setPlayback('playing');
    controller.current = readAloud(chunks, {
      rate: prefs.rate,
      onWord: (index) => setSpoken(index),
      onChunk: (c) => setChunk(firstPara + c),
      onEnd: () => { setPlayback('stopped'); setSpoken(null); setChunk(null); },
    });
  };
  const pause = () => { controller.current?.pause(); setPlayback('paused'); };

  // Roving focus: one tab stop for the text; arrow keys move word by word.
  const onTextKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = wordTokens.findIndex((t) => t.start === cursor);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(wordTokens.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = wordTokens.length - 1;
    else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) { e.preventDefault(); void openHelp(wordTokens[i]); return; }
    else return;
    e.preventDefault();
    const t = wordTokens[next];
    if (!t) return;
    setCursor(t.start);
    textRef.current?.querySelector<HTMLElement>(`[data-start="${t.start}"]`)?.focus();
  };

  // A drag selection snaps to whole words and offers to read it aloud. Normal selection still works.
  const onPointerUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textRef.current?.contains(sel.anchorNode)) { setSnap(null); return; }
    const wordEl = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('[data-start]') ?? null;
    let a = wordEl(sel.anchorNode);
    let b = wordEl(sel.focusNode);
    if (!a || !b) return;
    if (Number(a.dataset.start) > Number(b.dataset.start)) [a, b] = [b, a];
    const range = document.createRange();
    range.setStartBefore(a);
    range.setEndAfter(b);
    sel.removeAllRanges();
    sel.addRange(range);
    const rect = range.getBoundingClientRect();
    setSnap({ text: range.toString(), x: rect.left + rect.width / 2, y: rect.top });
  };

  const bookmarked = bookmarks.some((b) => b.page === page);
  const toggleMark = () => setBookmarks(toggleBookmark(kind, id, page, selected ?? cursor ?? 0, `Page ${page + 1}`));
  const tabTarget = cursor ?? wordTokens[0]?.start;

  return (
    <main className={`reader width-${prefs.width} ${prefs.focus ? 'focus-mode' : ''}`} id="main"
      style={{ '--read-size': prefs.size, '--read-spacing': prefs.spacing } as React.CSSProperties}>
      <header className="reader-top">
        <button type="button" className="btn small" onClick={() => { stopReading(); onBack(); }}>
          <span aria-hidden="true">←</span> {backLabel}
        </button>
        <div className="reader-title">
          <h1 className="title" tabIndex={-1} ref={headingRef}>{title}</h1>
          <p className="muted">{subtitle ? `${subtitle} · ` : ''}Page {page + 1} of {pages.length}</p>
        </div>
        <div className="reader-tools">
          <button type="button" className={`icon-btn ${bookmarked ? 'on' : ''}`} onClick={toggleMark} aria-pressed={bookmarked} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z" fill={bookmarked ? '#ffbe46' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="icon-btn" onClick={() => setShowPrefs((v) => !v)} aria-expanded={showPrefs} aria-label="Reading settings">
            <span aria-hidden="true" style={{ fontFamily: 'var(--font-learn)', fontWeight: 700 }}>Aa</span>
          </button>
        </div>
      </header>

      {showPrefs && (
        <section className="reader-prefs sketch" aria-label="Reading settings">
          <label>Text size
            <input type="range" min={0.8} max={1.8} step={0.1} value={prefs.size} onChange={(e) => setPrefs({ ...prefs, size: Number(e.target.value) })} />
          </label>
          <label>Line spacing
            <input type="range" min={1.4} max={2.8} step={0.1} value={prefs.spacing} onChange={(e) => setPrefs({ ...prefs, spacing: Number(e.target.value) })} />
          </label>
          <div className="seg" role="group" aria-label="Reading width">
            {(['narrow', 'medium', 'wide'] as const).map((w) => (
              <button key={w} type="button" aria-pressed={prefs.width === w} onClick={() => setPrefs({ ...prefs, width: w })}>{w[0].toUpperCase() + w.slice(1)}</button>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={prefs.focus} onChange={(e) => setPrefs({ ...prefs, focus: e.target.checked })} /> Focus on one paragraph</label>
          <label>Reading speed
            <input type="range" min={0.6} max={1.3} step={0.05} value={prefs.rate} onChange={(e) => setPrefs({ ...prefs, rate: Number(e.target.value) })} />
          </label>
        </section>
      )}

      <div className="read-controls" role="group" aria-label="Read aloud">
        {playback === 'playing'
          ? <button type="button" className="btn small" onClick={pause}>Pause</button>
          : <button type="button" className="btn small primary" onClick={play}>
              <Speaker size={22} /> {playback === 'paused' ? 'Resume' : selected !== null ? 'Read from this word' : 'Read aloud'}
            </button>}
        {playback !== 'stopped' && <button type="button" className="btn small" onClick={stopReading}>Stop</button>}
        {!deviceSpeechSupported && <span className="muted">Read-aloud needs a browser voice.</span>}
        {bookmarks.length > 0 && (
          <span className="bookmarks">Bookmarks: {bookmarks.map((b) => (
            <button key={b.page} type="button" className="link" onClick={() => goPage(b.page)}>p.{b.page + 1}</button>
          ))}</span>
        )}
      </div>

      <div className="read-text learn" ref={textRef} onKeyDown={onTextKey} onPointerUp={onPointerUp}
        role="group" aria-label="Story text. Choose any word for help; use the arrow keys to move between words.">
        {paras.map((p, pi) => (
          <p key={pi} className={`read-para ${chunk === pi ? 'reading' : ''} ${prefs.focus && chunk !== null && chunk !== pi ? 'dim' : ''}`}>
            {p.tokens.map((t, ti) => t.word ? (
              <span key={ti} role="button" data-start={t.start}
                className={`w ${selected === t.start ? 'sel' : ''} ${spoken !== null && spoken >= t.start && spoken < t.start + t.text.length ? 'spoken' : ''}`}
                tabIndex={t.start === tabTarget ? 0 : -1}
                aria-label={`${t.text}. Show help`}
                onClick={() => void openHelp(t)}
                onFocus={() => setCursor(t.start)}>{t.text}</span>
            ) : t.text.includes('\n')
              ? <Fragment key={ti}>{t.text.split('\n').map((part, k) => <Fragment key={k}>{k > 0 && <br />}{part}</Fragment>)}</Fragment>
              : <Fragment key={ti}>{t.text}</Fragment>)}
          </p>
        ))}
      </div>

      {snap && (
        <div className="snap-pop sketch" style={{ left: snap.x, top: snap.y }}>
          <button type="button" className="btn small" onClick={() => { void speak(snap.text, { rate: prefs.rate, style: 'lumo' }); setSnap(null); }}>
            <Speaker size={18} /> Read these words
          </button>
        </div>
      )}

      {last && feeling && (
        <section className="feeling sketch" aria-labelledby="feeling-h">
          <h2 id="feeling-h" className="hand">How was this story?</h2>
          <div className="feeling-row" role="radiogroup" aria-labelledby="feeling-h">
            {FEELINGS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={feeling.value === f.id}
                className={`feeling-btn ${feeling.value === f.id ? 'on' : ''}`} onClick={() => feeling.onChange(f.id)}>
                <Lumo pose={f.pose} size={44} motion="none" /> {f.label}
              </button>
            ))}
          </div>
          {feeling.value && <p className="muted small">Thanks! Lumo will use this to pick your next stories.</p>}
        </section>
      )}

      <nav className="page-nav" aria-label="Pages">
        <button type="button" className="btn" onClick={() => goPage(page - 1)} disabled={page === 0} aria-label="Previous page">
          <span aria-hidden="true">←</span> Back
        </button>
        <span className="hand">Page {page + 1} of {pages.length}</span>
        {last
          ? <button type="button" className="btn go" onClick={() => { stopReading(); markFinished(kind, id); onBack(); }}>I finished! <Arrow size={22} /></button>
          : <button type="button" className="btn go" onClick={() => goPage(page + 1)}>Next page <Arrow size={22} /></button>}
      </nav>

      {help && (
        <aside className="word-help sketch" role="dialog" aria-modal="false" aria-labelledby="wh-word"
          onKeyDown={(e) => { if (e.key === 'Escape') closeHelp(); }}>
          <div className="wh-head">
            {help.icon && <img className="wh-icon" src={help.icon} alt="" aria-hidden="true" />}
            <h2 id="wh-word" className="learn">{help.word}</h2>
            <button type="button" className="icon-btn" onClick={() => sayWord(help.word)} aria-label={`Say ${help.word}`} autoFocus>
              <Speaker size={24} />
            </button>
            <button type="button" className="icon-btn plain" onClick={closeHelp} aria-label="Close word help"><Close size={24} /></button>
          </div>
          {helpLoading ? (
            <p className="wh-loading"><Lumo pose="loading" size={60} motion="none" /> Lumo is thinking about this word…</p>
          ) : help.meaning ? (
            <>
              <p className="wh-meaning learn">{help.meaning}</p>
              {help.example && <p className="wh-example">For example: <em className="learn">{help.example}</em></p>}
              {help.source === 'ai' && <p className="wh-source muted">Explained by AI for this sentence.</p>}
            </>
          ) : (
            <p className="wh-meaning">
              {help.reason === 'no-ai' || help.reason === 'offline'
                ? "Lumo doesn't have an explanation for this word yet. You can still hear it."
                : "Lumo couldn't get an explanation just now. You can still hear it, or try again."}
              {help.reason !== 'no-ai' && help.reason !== 'offline' && (
                <button type="button" className="link" onClick={() => { const t = wordTokens.find((w) => w.start === selected); if (t) void openHelp(t); }}>Try again</button>
              )}
            </p>
          )}
          <p className="wh-hint muted">{profile.name ? `${profile.name}, you` : 'You'} can keep reading from here.</p>
        </aside>
      )}
    </main>
  );
}
