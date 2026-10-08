// Hand-drawn decoration. Everything here is aria-hidden: it is never content.
import type { CSSProperties } from 'react';

/** Shared wobble filter, rendered once in App. */
export function WobbleDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="wobble">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" />
        <feDisplacementMap in="SourceGraphic" scale="3" />
      </filter>
    </svg>
  );
}

const base = { 'aria-hidden': true, focusable: false } as const;

export function Squiggle({ color = 'var(--lav)', width = 260, style }: { color?: string; width?: number; style?: CSSProperties }) {
  return (
    <svg {...base} className="squiggle-line" viewBox="0 0 260 12" preserveAspectRatio="none" style={{ width, ...style }}>
      <path d="M3 7 Q 32 2 62 6 T 122 6 T 182 5 T 257 6" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" filter="url(#wobble)" />
    </svg>
  );
}

export function Cloud({ style }: { style?: CSSProperties }) {
  return (
    <svg {...base} className="doodle" viewBox="0 0 120 50" width="120" style={style}>
      <path d="M14 44 Q2 44 4 33 Q6 24 18 26 Q20 12 36 14 Q44 2 60 8 Q72 0 82 12 Q98 8 100 22 Q116 22 116 34 Q116 44 104 44 Z"
        fill="var(--card)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" filter="url(#wobble)" />
    </svg>
  );
}

export function Tree({ color = '#7fc796', style }: { color?: string; style?: CSSProperties }) {
  return (
    <svg {...base} className="doodle" viewBox="0 0 60 100" width="56" style={style}>
      <line x1="30" y1="52" x2="30" y2="98" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="30" cy="30" r="25" fill={color} stroke="currentColor" strokeWidth="2.5" filter="url(#wobble)" />
      <path d="M18 30 L28 20 M24 38 L36 26" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function Sparkle({ size = 28, color = '#ffd27a', style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg {...base} className="doodle" viewBox="0 0 24 24" width={size} style={style}>
      <path d="M12 2 Q13 11 22 12 Q13 13 12 22 Q11 13 2 12 Q11 11 12 2z" fill={color} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function Moon({ style }: { style?: CSSProperties }) {
  return (
    <svg {...base} className="doodle" viewBox="0 0 80 100" width="80" style={style}>
      <path d="M58 6 A44 44 0 1 0 74 88 A36 36 0 1 1 58 6z" fill="none" stroke="#c4c8d8" strokeWidth="3" filter="url(#wobble)" />
    </svg>
  );
}

/** A crayon signpost: "Small steps / Big progress". */
export function Signpost({ style }: { style?: CSSProperties }) {
  return (
    <svg {...base} className="doodle signpost" viewBox="0 0 180 230" width="170" style={style}>
      <g filter="url(#wobble)">
        <rect x="80" y="40" width="14" height="185" rx="3" fill="#c9a26b" stroke="#2b2c5e" strokeWidth="2.5" />
        <path d="M14 34 L150 22 L172 52 L150 80 L18 88 Z" fill="#ffd98a" stroke="#2b2c5e" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M8 112 L144 104 L166 134 L144 164 L12 168 Z" fill="#ffd98a" stroke="#2b2c5e" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <text x="86" y="62" textAnchor="middle" fontFamily="Gaegu, cursive" fontWeight="700" fontSize="26" fill="#2b2c5e" transform="rotate(-4 86 62)">Small steps</text>
      <text x="84" y="143" textAnchor="middle" fontFamily="Gaegu, cursive" fontWeight="700" fontSize="26" fill="#2b2c5e" transform="rotate(-3 84 143)">Big progress</text>
      <path d="M40 222 q8-16 14 0 q8-18 14 0 q8-14 12 0" fill="none" stroke="#7fc796" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
