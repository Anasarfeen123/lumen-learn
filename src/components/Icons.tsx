// Simple rounded line icons, 2px stroke. Decorative unless given a label.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const Speaker = (p: P) => (
  <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" /></Svg>
);
export const Close = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const Gear = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </Svg>
);
export const Check = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const Bulb = (p: P) => (
  <Svg {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></Svg>
);
export const Arrow = (p: P) => <Svg {...p}><path d="M4 12h15M14 6.5l5.5 5.5-5.5 5.5" /></Svg>;
export const Lock = (p: P) => <Svg {...p}><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Svg>;
export const Search = (p: P) => <Svg {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></Svg>;
export const Blocks = (p: P) => (
  <Svg {...p}><rect x="4" y="12.5" width="7" height="7" rx="1" /><rect x="13" y="12.5" width="7" height="7" rx="1" /><rect x="8.5" y="4.5" width="7" height="7" rx="1" /></Svg>
);
export const Flame = (p: P) => (
  <Svg {...p}><path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.6 3-5.2 3.6-9.4 2.7 1.6 3.2 4 3.2 5.4.9-.6 1.6-1.7 1.8-3 1.9 1.8 3.4 4 3.4 7 0 3.2-2.4 5.6-6 5.6z" /></Svg>
);
export const Beats = (p: P) => (
  <Svg {...p}><rect x="2.5" y="8" width="5.5" height="8" rx="1" /><rect x="9.25" y="8" width="5.5" height="8" rx="1" /><rect x="16" y="8" width="5.5" height="8" rx="1" /><path d="M5 19.5h14" /></Svg>
);
export const Trend = (p: P) => <Svg {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></Svg>;
export const Chest = (p: P) => (
  <Svg {...p}><rect x="3.5" y="8" width="17" height="11" rx="2" /><path d="M3.5 12.5h17" /><path d="M5 8a7 4 0 0 1 14 0" /><rect x="10.5" y="11" width="3" height="3.5" rx="0.8" /></Svg>
);

export function Star({ on = true, size = 24 }: { on?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={on ? 'star-on' : 'star-off'}>
      <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
        fill={on ? '#ffd27a' : 'none'} stroke="currentColor" strokeWidth={on ? 1.8 : 1.6} strokeLinejoin="round" />
    </svg>
  );
}

export function Stars({ count, max = 3, size = 22 }: { count: number; max?: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${count} of ${max} stars`} style={{ display: 'inline-flex', gap: 2, color: '#8a5d00' }}>
      {Array.from({ length: max }, (_, i) => <Star key={i} on={i < count} size={size} />)}
    </span>
  );
}
