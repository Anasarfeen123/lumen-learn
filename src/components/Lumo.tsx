import type { CSSProperties } from 'react';
import { useLumen } from '../state/store';
import { GLOW_HEX, STAGES, stageIndex, type HatId } from '../engine/progression';

export type Pose = 'float' | 'wave' | 'read' | 'point' | 'think' | 'cheer' | 'fly' | 'sit' | 'sleep' | 'hero';

const B = import.meta.env.BASE_URL;
const SRC: Record<Pose, string> = {
  float: `${B}lumo/pose-float.png`,
  wave: `${B}lumo/pose-wave.png`,
  read: `${B}lumo/pose-read.png`,
  point: `${B}lumo/pose-point.png`,
  think: `${B}lumo/pose-think.png`,
  cheer: `${B}lumo/pose-cheer.png`,
  fly: `${B}lumo/pose-fly.png`,
  sit: `${B}lumo/pose-sit.png`,
  sleep: `${B}lumo/pose-sleep.png`,
  hero: `${B}lumo/lumo-hero.png`,
};

export type Motion = 'float' | 'hop' | 'wiggle' | 'glow-up' | 'none';

interface Props {
  pose?: Pose;
  size?: number;
  motion?: Motion;
  /** Override the learner's equipped hat (closet preview). */
  hat?: HatId | null;
  glow?: keyof typeof GLOW_HEX;
  /** Override XP-based stage (glow-up preview). */
  stage?: number;
  darkScene?: boolean;
  label?: string;
  style?: CSSProperties;
}

/** Lumo, drawn in crayon. The halo grows with the glow stage; hats sit on top. */
export function Lumo({ pose = 'float', size = 140, motion = 'float', hat, glow, stage, darkScene, label, style }: Props) {
  const { profile } = useLumen();
  const s = stage ?? stageIndex(profile.xp);
  const halo = STAGES[s].halo;
  const color = GLOW_HEX[glow ?? profile.glowColor];
  const wornHat = hat === undefined ? profile.equipped.hat : hat;
  const sparkles = s >= 4;

  return (
    <span
      className={`lumo ${motion !== 'none' ? motion : ''} ${darkScene ? 'dark-scene' : ''}`}
      style={{ width: size, '--glow-color': color, '--halo-scale': halo.scale, '--halo-opacity': halo.opacity + 0.25, ...style } as CSSProperties}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="lumo-halo" />
      <img src={SRC[pose]} alt="" draggable={false} />
      {wornHat && <Hat id={wornHat} />}
      {sparkles && <Sparkles color={color} />}
    </span>
  );
}

export function Hat({ id, standalone }: { id: HatId; standalone?: boolean }) {
  const cls = standalone ? undefined : 'lumo-hat';
  if (id === 'leaf-cap') {
    return (
      <svg className={cls} viewBox="0 0 60 36" aria-hidden="true">
        <path d="M8 30 Q30 4 52 30 Z" fill="#7fc796" stroke="#2b2c5e" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M30 8 Q34 0 44 2 Q40 10 30 8z" fill="#2e8b57" stroke="#2b2c5e" strokeWidth="2" />
        <path d="M30 28 V12" stroke="#2b2c5e" strokeWidth="2" />
      </svg>
    );
  }
  if (id === 'star-crown') {
    return (
      <svg className={cls} viewBox="0 0 60 36" aria-hidden="true">
        <path d="M8 32 L10 10 L20 20 L30 4 L40 20 L50 10 L52 32 Z" fill="#ffd27a" stroke="#2b2c5e" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="30" cy="22" r="3.5" fill="#f28ca0" stroke="#2b2c5e" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 60 36" aria-hidden="true">
      <ellipse cx="30" cy="30" rx="28" ry="5" fill="#c9a26b" stroke="#2b2c5e" strokeWidth="2.5" />
      <path d="M14 30 Q14 8 30 8 Q46 8 46 30 Z" fill="#d8b47c" stroke="#2b2c5e" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M15 24 H45" stroke="#2e8b57" strokeWidth="4" />
    </svg>
  );
}

function Sparkles({ color }: { color: string }) {
  return (
    <svg className="lumo-sparkles" viewBox="0 0 100 100" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((a) => {
        const r = (a * Math.PI) / 180;
        const x = 50 + 46 * Math.cos(r);
        const y = 50 + 46 * Math.sin(r);
        return <path key={a} d={`M${x} ${y - 4} L${x + 1} ${y - 1} L${x + 4} ${y} L${x + 1} ${y + 1} L${x} ${y + 4} L${x - 1} ${y + 1} L${x - 4} ${y} L${x - 1} ${y - 1}Z`} fill={color} stroke="#2b2c5e" strokeWidth="0.6" />;
      })}
    </svg>
  );
}
