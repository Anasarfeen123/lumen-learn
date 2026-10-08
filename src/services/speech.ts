// Web Speech API wrapper. Free, offline-capable, no network dependency.
// Rules: cancel before every utterance so rapid taps never queue; the first
// speech must follow a user tap (browsers block audio before interaction).

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<(v: SpeechSynthesisVoice[]) => void>();

function refreshVoices() {
  if (!speechSupported) return;
  voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  listeners.forEach((fn) => fn(voices));
}

if (speechSupported) {
  refreshVoices();
  // Chrome loads voices asynchronously.
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

export function englishVoices(): SpeechSynthesisVoice[] {
  return voices;
}

export function onVoices(fn: (v: SpeechSynthesisVoice[]) => void): () => void {
  listeners.add(fn);
  fn(voices);
  return () => listeners.delete(fn);
}

/** Prefer on-device English voices; they're faster and work offline. */
export function pickVoice(name: string | null): SpeechSynthesisVoice | undefined {
  if (name) {
    const chosen = voices.find((v) => v.name === name);
    if (chosen) return chosen;
  }
  return voices.find((v) => v.localService) ?? voices[0];
}

export interface SpeakOptions {
  rate?: number;
  voiceName?: string | null;
  onEnd?: () => void;
}

let token = 0; // bumps on every utterance; an old utterance's onEnd is ignored
let seq = 0; // bumps when a new speech request (single or sequence) starts

function utter(text: string, { rate = 0.85, voiceName = null, onEnd }: SpeakOptions): Promise<void> {
  const my = ++token;
  if (!speechSupported || !text) {
    onEnd?.();
    return Promise.resolve();
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.lang = 'en-GB';
    const voice = pickVoice(voiceName);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      if (my === token) onEnd?.();
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    // Some engines never fire onend; never let the app wait on speech forever.
    const guard = setTimeout(done, 1500 + (text.length * 120) / rate);
    synth.speak(u);
  });
}

/** Speak one piece of text, cancelling anything already speaking. Resolves when done (or cut off). */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  seq++;
  return utter(text, options);
}

/** Speak several pieces in order, with optional pauses. Stops if anything else starts speaking. */
export async function speakSequence(parts: { text: string; rate?: number; pauseMs?: number }[], voiceName: string | null): Promise<void> {
  const id = ++seq;
  for (const part of parts) {
    if (id !== seq) return;
    await utter(part.text, { rate: part.rate, voiceName });
    if (part.pauseMs) await new Promise((r) => setTimeout(r, part.pauseMs));
  }
}

export function stopSpeaking() {
  seq++;
  token++;
  if (speechSupported) window.speechSynthesis.cancel();
}
