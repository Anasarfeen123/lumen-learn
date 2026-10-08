// Sound effects synthesized with Web Audio: no files to host, nothing to fail
// loading. Kept quiet (gain 0.05–0.12) so they never drown out spoken words.

let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

function tone(freq: number, start: number, dur: number, vol = 0.12) {
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function guarded(fn: () => void) {
  return () => {
    if (!enabled) return;
    try {
      fn();
    } catch {
      /* audio is decoration; never let it break play */
    }
  };
}

export const sfx = {
  tick: guarded(() => tone(880, 0, 0.05, 0.05)),
  correct: guarded(() => { tone(523.25, 0, 0.14); tone(659.25, 0.12, 0.22); }), // C5 then E5
  almost: guarded(() => tone(293.66, 0, 0.25, 0.08)), // soft D4
  fanfare: guarded(() => { tone(523.25, 0, 0.15); tone(659.25, 0.14, 0.15); tone(783.99, 0.28, 0.35); }),
  chime: guarded(() => { tone(659.25, 0, 0.2, 0.1); tone(783.99, 0.18, 0.2, 0.1); tone(1046.5, 0.36, 0.45, 0.1); }),
};
