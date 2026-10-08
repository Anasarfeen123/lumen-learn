import { useEffect, useRef, type ReactNode } from 'react';
import { Lumo, type Motion, type Pose } from '../../components/Lumo';

export interface SheetAction {
  label: string;
  onClick: () => void;
  variant?: 'go' | 'amber' | 'primary';
  disabled?: boolean;
}

interface Props {
  tone: 'neutral' | 'correct' | 'almost';
  pose: Pose;
  motion?: Motion;
  title: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  action?: SheetAction;
}

/** The bottom bar: Lumo's corner. Becomes the green or amber feedback sheet after Check. */
export function Sheet({ tone, pose, motion = 'float', title, sub, meta, action }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  // Keep the page's bottom padding in step with the sheet's height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--sheet-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Move focus to the feedback button so Enter / screen readers land on it.
  useEffect(() => {
    if (tone !== 'neutral') btn.current?.focus({ preventScroll: true });
  }, [tone, action?.label]);

  return (
    <div ref={ref} className={`sheet ${tone}`} role="region" aria-label="Lumo">
      <div className="sheet-inner">
        <Lumo pose={pose} size={104} motion={motion} />
        <div className="sheet-text">
          <p className="sheet-title">{title}</p>
          {sub && <p className="sheet-sub">{sub}</p>}
          {meta && <p className="sheet-meta">{meta}</p>}
        </div>
        {action && (
          <button ref={btn} type="button" className={`btn ${action.variant ?? 'go'}`} onClick={action.onClick} disabled={action.disabled}
            style={{ minWidth: 200 }}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
