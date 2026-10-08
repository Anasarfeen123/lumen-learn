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
export const BookOpen = (p: P) => <Svg {...p}><path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5v13c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5z" /><path d="M12 6v13" /></Svg>;
export const Music = (p: P) => <Svg {...p}><path d="M9 18V5.5l11-2V16" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></Svg>;
export const Pencil = (p: P) => <Svg {...p}><path d="M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z" /><path d="M14 6.5l3 3" /></Svg>;
export const Sprout = (p: P) => <Svg {...p}><path d="M12 21v-8" /><path d="M12 13c0-4-3-6.5-7.5-6.5 0 4 3 6.5 7.5 6.5z" /><path d="M12 11c0-3.5 2.5-6 6.5-6 0 3.5-2.5 6-6.5 6z" /></Svg>;
export const Trophy = (p: P) => <Svg {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4" /><path d="M12 13v4M8.5 20h7M10 17h4" /></Svg>;
export const Refresh = (p: P) => <Svg {...p}><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 20v-4h-4" /></Svg>;
export const Shuffle = (p: P) => <Svg {...p}><path d="M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6C14.3 16 15.5 17 17.5 17H21" /><path d="M18 14l3 3-3 3" /><path d="M3 17h3.5c1.4 0 2.4-.5 3.2-1.4M14.3 8.4C15.1 7.5 16.1 7 17.5 7H21" /><path d="M18 4l3 3-3 3" /></Svg>;
export const Puzzle = (p: P) => <Svg {...p}><path d="M5 8h3.5a2 2 0 1 1 4 0H16v3.5a2 2 0 1 1 0 4V19H12.5a2 2 0 1 0-4 0H5v-3.5a2 2 0 1 0 0-4z" /></Svg>;
export const Pair = (p: P) => <Svg {...p}><rect x="3" y="6" width="9" height="12" rx="2" /><rect x="12" y="6" width="9" height="12" rx="2" /><path d="M6 12h3M15 12h3" /></Svg>;
export const Question = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></Svg>;
export const SortWords = (p: P) => <Svg {...p}><rect x="3" y="5" width="7" height="5" rx="1.5" /><rect x="14" y="5" width="7" height="5" rx="1.5" /><rect x="3" y="14" width="18" height="5" rx="1.5" /><path d="M6.5 10v4M17.5 10v4" /></Svg>;
export const Pause = (p: P) => <Svg {...p}><path d="M8 5v14M16 5v14" /></Svg>;
export const Abc = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><text x="12" y="16.5" textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight="700" fontSize="10" fill="currentColor">abc</text></svg>
);
export const Chat = (p: P) => <Svg {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></Svg>;
export const Chart = (p: P) => <Svg {...p}><path d="M5 20V12M12 20V5M19 20v-9" /></Svg>;
export const Home = (p: P) => <Svg {...p}><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /></Svg>;
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
