import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Speaker } from './Icons';
import { useLumen } from '../state/store';

/** Lumo's speech bubble. Every bubble can be replayed aloud. */
export function Bubble({ text, className = '' }: { text: string; className?: string }) {
  const { say } = useLumen();
  return (
    <div className={`bubble sketch ${className}`}>
      <span>{text}</span>
      <button type="button" className="icon-btn plain replay" onClick={() => say(text)} aria-label="Hear Lumo again">
        <Speaker size={22} />
      </button>
    </div>
  );
}

/** Modal dialog with focus moved in and Escape to close. */
export function Modal({ title, children, onClose, labelledBy }: { title?: string; children: ReactNode; onClose: () => void; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, [href], input, select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal sketch" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  );
}

/**
 * Press and hold for 3 seconds. Not security: it only keeps a young learner
 * from wandering into the grown-up view by accident.
 */
export function HoldButton({ onDone, seconds = 3, children }: { onDone: () => void; seconds?: number; children: ReactNode }) {
  const [progress, setProgress] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef(0);

  const stop = () => {
    start.current = null;
    cancelAnimationFrame(raf.current);
    setProgress(0);
  };
  const tick = (t: number) => {
    if (start.current === null) start.current = t;
    const p = Math.min(1, (t - start.current) / (seconds * 1000));
    setProgress(p);
    if (p >= 1) {
      start.current = null;
      onDone();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };
  const begin = () => {
    cancelAnimationFrame(raf.current);
    start.current = null;
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const C = 2 * Math.PI * 46;
  return (
    <span className="hold">
      <button
        type="button"
        className="btn navy"
        onPointerDown={(e) => { e.preventDefault(); begin(); }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(); }}
        onContextMenu={(e) => e.preventDefault()}
        aria-describedby="hold-help"
      >
        {children}
      </button>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="4" y="4" width="92" height="92" rx="20" fill="none" stroke="var(--yellow)" strokeWidth="5"
          pathLength={C} strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
      </svg>
      <span id="hold-help" className="sr-only">Press and hold for {seconds} seconds.</span>
    </span>
  );
}

/** Animated number count-up; jumps straight to the end under reduced motion. */
export function CountUp({ to, ms = 1000 }: { to: number; ms?: number }) {
  const { reducedMotion } = useLumen();
  const [n, setN] = useState(reducedMotion ? to : 0);
  useEffect(() => {
    if (reducedMotion) { setN(to); return; }
    let raf = 0;
    let t0: number | null = null;
    const step = (t: number) => {
      t0 ??= t;
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, reducedMotion]);
  return <>{n}</>;
}
