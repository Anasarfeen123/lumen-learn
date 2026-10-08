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
