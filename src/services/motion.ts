// Lumen's motion helpers. Everything here does nothing when motion is reduced
// (the `anim` class on <html> is only set when the learner, or their device,
// hasn't asked for less motion).
import { flushSync } from 'react-dom';

export const motionOn = () => typeof document !== 'undefined' && document.documentElement.classList.contains('anim');

type Direction = 'forward' | 'back';

interface ViewTransition { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void>; skipTransition: () => void }
interface ViewTransitionDoc { startViewTransition?: (cb: () => void) => ViewTransition }

let pending: ViewTransition | null = null;

/**
 * Finish any page transition still in flight, so the page shown and the app's
 * idea of the current page agree before something else changes.
 */
export function settleTransitions() {
  pending?.skipTransition();
  pending = null;
}

/** Browsers that can animate between pages. */
export const canTransition = () => typeof document !== 'undefined' && typeof (document as unknown as ViewTransitionDoc).startViewTransition === 'function';

/**
 * Run a page change as a view transition: the new page slides in from the side
 * you're travelling to, while the header and tabs stay put. Without support or
 * with reduced motion, the change just happens.
 */
export function pageTransition(update: () => void, direction: Direction) {
  const doc = document as unknown as ViewTransitionDoc;
  if (!motionOn() || !canTransition()) { update(); return; }
  const root = document.documentElement;
  root.dataset.nav = direction;
  try {
    const t = doc.startViewTransition!(() => flushSync(update));
    pending = t;
    // A newer page change can skip this one; that's expected, not an error.
    const quiet = () => {};
    t.ready.catch(quiet);
    t.updateCallbackDone.catch(quiet);
    void t.finished.catch(quiet).finally(() => {
      if (pending === t) pending = null;
      if (root.dataset.nav === direction) delete root.dataset.nav;
    });
  } catch {
    delete root.dataset.nav;
    update();
  }
}

const COLORS = ['#ffbe46', '#f28ca0', '#8e80e3', '#78afe6', '#4fb26f', '#ffd36a'];

/**
 * A small burst of stars and dots from an element (or a point), for real wins:
 * a right answer, a finished round. Purely decorative: hidden from assistive tech.
 */
export function burst(from: Element | { x: number; y: number }, { count = 18, spread = 1 }: { count?: number; spread?: number } = {}) {
  if (!motionOn() || typeof document === 'undefined') return;
  const r = 'getBoundingClientRect' in from ? from.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : (from as { x: number }).x;
  const y = r ? r.top + r.height / 2 : (from as { y: number }).y;
  const layer = document.createElement('div');
  layer.className = 'burst-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  let left = count;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    const star = i % 3 === 0;
    p.className = star ? 'burst-star' : 'burst-dot';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--c', COLORS[i % COLORS.length]);
    layer.appendChild(p);
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = (70 + Math.random() * 70) * spread;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const spin = (Math.random() - 0.5) * 540;
    const scale = star ? 1 + Math.random() * 0.5 : 0.6 + Math.random() * 0.6;
    const anim = p.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.75}px), calc(-50% + ${dy * 0.75 - 18}px)) scale(${scale}) rotate(${spin * 0.7}deg)`, opacity: 1, offset: 0.55 },
      // a little gravity at the end
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 34}px)) scale(${scale * 0.6}) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: 750 + Math.random() * 350, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    anim.onfinish = () => { if (--left === 0) layer.remove(); };
  }
  window.setTimeout(() => layer.remove(), 2000); // safety net
}

/** Burst from the first element matching `selector`, once it has rendered. */
export function celebrate(selector: string, opts: { count?: number; spread?: number; delay?: number } = {}) {
  if (!motionOn()) return;
  const go = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.querySelector(selector);
    if (el) burst(el, opts);
  }));
  if (opts.delay) window.setTimeout(go, opts.delay); else go();
}
