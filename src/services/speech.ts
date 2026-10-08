// Lumo's voice. Two engines behind one API:
//
//  - natural: Groq's Orpheus voices via /api/lumo/speech (needs GROQ_API_KEY).
//    The learner's name is never sent: it's left out of the spoken audio.
//  - device:  the browser's Web Speech API. Works offline. On Linux the voice
//    list loads lazily and anything spoken before it arrives fails, so every
//    utterance first waits for voices and then picks one explicitly.
//
// Rules from the spec: cancel before every new utterance so taps never queue,
// and never let the app wait on speech forever.

export type VoiceEngine = 'auto' | 'natural' | 'device';
export type SpeechStyle = 'lumo' | 'word' | 'slow';

export interface VoicePrefs {
  engine: VoiceEngine;
  naturalVoice: string;
  deviceVoice: string | null;
  /** Words that must never leave the device (the learner's name). */
  privateWords: string[];
}

export interface Part {
  text: string;
  rate?: number;
  pauseMs?: number;
  style?: SpeechStyle;
}

export interface LumoStatus {
  ai: boolean;
  model: string | null;
  modelNote?: string;
  tts: {
    provider?: 'fish' | 'google' | 'groq' | 'none';
    state: 'ready' | 'limited' | 'needs-terms' | 'off' | 'error' | 'unknown';
    voice: string;
    voices: string[];
    labels?: Record<string, string>;
    message: string;
    /** A voice made on the server itself (works in every browser, no limits). */
    local?: 'piper' | 'espeak' | null;
  };
}

const API = import.meta.env.VITE_LUMO_API ?? '/api/lumo';
const BASE = import.meta.env.BASE_URL ?? '/';

/** The key used by the voice pack manifest and the runtime lookup. */
export function phraseKey(text: string, style: SpeechStyle): string {
  return `${style}|${text.trim().replace(/\s+/g, ' ')}`;
}
const hasWindow = typeof window !== 'undefined';
export const deviceSpeechSupported = hasWindow && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let prefs: VoicePrefs = { engine: 'auto', naturalVoice: 'hannah', deviceVoice: null, privateWords: [] };
/** After the server's speech limit is hit, skip live speech until this time (pack + device voice cover it). */
let serverLimitedUntil = 0;
let status: LumoStatus | null = null;
const statusListeners = new Set<(s: LumoStatus | null) => void>();

export function setVoicePrefs(p: Partial<VoicePrefs>) {
  prefs = { ...prefs, ...p };
}

// ------------------------------------------------------------------ status

let statusReady: Promise<unknown> | null = null;

export async function loadStatus(refresh = false): Promise<LumoStatus | null> {
  if (API === 'off') return null;
  const job = loadStatusNow(refresh);
  statusReady ??= job;
  return job;
}

async function loadStatusNow(refresh: boolean): Promise<LumoStatus | null> {
  try {
    const res = await fetch(`${API}/status${refresh ? '?refresh=1' : ''}`, { signal: AbortSignal.timeout(15_000) });
    status = res.ok ? ((await res.json()) as LumoStatus) : null;
  } catch {
    status = null;
  }
  statusListeners.forEach((fn) => fn(status));
  return status;
}

/** Why sound isn't playing, for a visible, honest notice (null when it works). */
export type SoundProblem = 'blocked' | 'device' | null;
let problem: SoundProblem = null;
const problemListeners = new Set<(p: SoundProblem) => void>();
function reportProblem(p: SoundProblem) {
  if (p === problem) return;
  problem = p;
  problemListeners.forEach((fn) => fn(p));
}
export function onSoundProblem(fn: (p: SoundProblem) => void): () => void {
  problemListeners.add(fn);
  fn(problem);
  return () => problemListeners.delete(fn);
}

export function onStatus(fn: (s: LumoStatus | null) => void): () => void {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

/** The voice actually used: the learner's choice if this provider has it, else the server's default. */
export function naturalVoice(): string {
  const voices = status?.tts.voices ?? [];
  if (voices.includes(prefs.naturalVoice)) return prefs.naturalVoice;
  if (status?.tts.voice) return status.tts.voice;
  return Object.keys(pack)[0] ?? prefs.naturalVoice;
}

/** The server can speak: a cloud voice that's ready, or its own local voice. */
export function naturalReady(): boolean {
  return status?.tts.state === 'ready' || Boolean(status?.tts.local);
}

// ------------------------------------------------------------------ prebuilt voice pack

/** public/voice/manifest.json, written by `npm run voices`: voice -> phrase key -> file. */
let pack: Record<string, Record<string, string>> = {};

export async function loadVoicePack(): Promise<void> {
  try {
    const res = await fetch(`${BASE}voice/manifest.json`, { cache: 'no-cache' });
    if (res.ok) pack = ((await res.json()) as { voices?: typeof pack }).voices ?? {};
  } catch {
    pack = {};
  }
  statusListeners.forEach((fn) => fn(status));
}

export function packVoices(): string[] {
  return Object.keys(pack).filter((v) => Object.keys(pack[v]).length > 0);
}

function packUrl(text: string, style: SpeechStyle): string | null {
  const file = pack[naturalVoice()]?.[phraseKey(text, style)];
  return file ? `${BASE}voice/${file}` : null;
}

/** The natural voice can speak if the server can make speech, or the voice pack has this voice. */
function naturalAvailable(): boolean {
  return naturalReady() || Boolean(pack[naturalVoice()] && Object.keys(pack[naturalVoice()]).length);
}

/** Which engine will speak right now. */
export function activeEngine(): 'natural' | 'device' | 'none' {
  // Over the server's speech limit and no pack for this voice? Use the device until it's back.
  const limited = (Date.now() < serverLimitedUntil || status?.tts.state === 'limited') && !status?.tts.local && !Object.keys(pack[naturalVoice()] ?? {}).length;
  if (prefs.engine !== 'device' && naturalAvailable() && !limited) return 'natural';
  return deviceSpeechSupported ? 'device' : 'none';
}

/** True when Lumo can speak at all (some voice is available). */
export function canSpeak(): boolean {
  return deviceSpeechSupported || naturalAvailable();
}

// ------------------------------------------------------------------ device voices

let deviceVoices: SpeechSynthesisVoice[] = [];
const voiceListeners = new Set<(v: SpeechSynthesisVoice[]) => void>();
let voicesReady: Promise<void> | null = null;

/** Prefer natural-sounding voices; skip espeak's novelty variants ("+whisper", "+Mr serious"…). */
function score(v: SpeechSynthesisVoice): number {
  let s = 0;
  if (/natural|neural|online|enhanced|premium/i.test(v.name)) s += 4;
  if (/google|microsoft|apple|siri|samantha|daniel|karen|moira|serena|tessa|alex|libby|sonia|ryan|aria|jenny|guy/i.test(v.name)) s += 3;
  if (/^en[-_](gb|us)/i.test(v.lang)) s += 1;
  if (v.localService) s += 1;
  if (/espeak/i.test(v.name)) s -= 2;
  return s;
}

function refreshDeviceVoices() {
  if (!deviceSpeechSupported) return;
  const all = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang) && !v.name.includes('+'));
  const seen = new Set<string>();
  deviceVoices = all
    .filter((v) => !seen.has(v.name) && seen.add(v.name))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, 40);
  voiceListeners.forEach((fn) => fn(deviceVoices));
}

/** Resolves once the browser has listed its voices (or after 3 s, whichever is first). */
function ensureVoices(): Promise<void> {
  if (!deviceSpeechSupported) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length) {
    if (!deviceVoices.length) refreshDeviceVoices();
    return Promise.resolve();
  }
  voicesReady ??= new Promise<void>((resolve) => {
    const done = () => { refreshDeviceVoices(); resolve(); };
    window.speechSynthesis.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, 3000);
  }).finally(() => { voicesReady = null; });
  return voicesReady;
}

if (deviceSpeechSupported) {
  // Asking for voices is what starts loading them on some platforms.
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshDeviceVoices);
  refreshDeviceVoices();
}

export function onDeviceVoices(fn: (v: SpeechSynthesisVoice[]) => void): () => void {
  voiceListeners.add(fn);
  fn(deviceVoices);
  void ensureVoices();
  return () => voiceListeners.delete(fn);
}

function pickDeviceVoice(): SpeechSynthesisVoice | undefined {
  return deviceVoices.find((v) => v.name === prefs.deviceVoice) ?? deviceVoices[0];
}

// ------------------------------------------------------------------ cancellation

let token = 0; // bumps on every new request; older playback stops and its callbacks are ignored
let player: HTMLAudioElement | null = null;

export function stopSpeaking() {
  token++;
  if (deviceSpeechSupported) window.speechSynthesis.cancel();
  if (player) {
    player.pause();
    player.removeAttribute('src');
  }
}

// ------------------------------------------------------------------ device engine

function sayOnDevice(text: string, rate: number, my: number, attempt = 0): Promise<void> {
  return ensureVoices().then(() => new Promise<void>((resolve) => {
    if (my !== token) return resolve();
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    const voice = pickDeviceVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } // else: no lang either. A lang with no matching voice fails on Linux.
    let settled = false;
    const done = (retry = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      if (retry && attempt === 0 && my === token) {
        // The voice list may have arrived late; refresh and try once more.
        setTimeout(() => { refreshDeviceVoices(); void sayOnDevice(text, rate, my, 1).then(resolve); }, 300);
        return;
      }
      resolve();
    };
    u.onend = () => done();
    u.onerror = (e) => {
      if (e.error === 'not-allowed') reportProblem('blocked');
      else if (attempt === 1 && (e.error === 'synthesis-failed' || e.error === 'synthesis-unavailable')) reportProblem('device');
      done(e.error === 'synthesis-failed' || e.error === 'synthesis-unavailable');
    };
    u.onstart = () => reportProblem(null);
    // Some engines never fire onend; never let the app wait on speech forever.
    const guard = setTimeout(() => done(), 2000 + (text.length * 120) / rate);
    synth.speak(u);
  }));
}

// ------------------------------------------------------------------ natural engine

const audioUrls = new Map<string, Promise<string>>();
const AUDIO_CACHE = 300;
const CACHE_NAME = 'lumo-voice-v1';

/** Leaves the learner's name out of anything sent off the device. */
export function withoutPrivateWords(text: string, words: string[] = prefs.privateWords): string {
  let out = text;
  for (const w of words.filter((x) => x.trim().length > 0)) {
    const esc = w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Letter-aware boundaries, so accented names (Zoë, José) match too.
    out = out.replace(new RegExp(`,?\\s*(?<!\\p{L})${esc}(?!\\p{L})(?:'s)?`, 'giu'), '');
  }
  return out.replace(/\s+([!?.,])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

function styleFor(part: Part): SpeechStyle {
  if (part.style) return part.style;
  const r = part.rate ?? 0.85;
  return r <= 0.75 ? 'slow' : r <= 0.8 ? 'word' : 'lumo';
}

// At most a few speech requests at once, so warm-ups never starve the line being spoken.
let active = 0;
const queue: (() => void)[] = [];
function limited<T>(job: () => Promise<T>, urgent = false): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++;
      job().then(resolve, reject).finally(() => {
        active--;
        queue.shift()?.();
      });
    };
    if (active < 3) run();
    else if (urgent) queue.unshift(run);
    else queue.push(run);
  });
}

/** Spoken lines generated on the fly are kept in Cache Storage, so they're instant next time. */
async function fromServer(text: string, style: SpeechStyle, urgent: boolean): Promise<Blob> {
  const cacheKey = `${location.origin}/__lumo-voice/${naturalVoice()}/${style}/${encodeURIComponent(text)}`;
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(cacheKey);
    if (hit) return await hit.blob();
  } catch {
    cache = null; // Cache Storage unavailable (private window, insecure origin)
  }
  if (!naturalReady() || Date.now() < serverLimitedUntil) throw new Error('natural voice not available right now');
  const blob = await limited(async () => {
    const res = await fetch(`${API}/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, voice: naturalVoice(), style }),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 429) {
      serverLimitedUntil = Date.now() + Number(res.headers.get('retry-after') ?? 60) * 1000;
      if (status) status = { ...status, tts: { ...status.tts, state: 'limited' } };
    }
    if (res.status !== 200) throw new Error(`speech ${res.status}`);
    return res.blob();
  }, urgent);
  void cache?.put(cacheKey, new Response(blob, { headers: { 'content-type': blob.type || 'audio/mpeg' } })).catch(() => {});
  return blob;
}

/** Audio URL for a line: the prebuilt pack first, then the cache, then the server. */
function fetchAudio(text: string, style: SpeechStyle, urgent = true): Promise<string> {
  const fromPack = packUrl(text, style);
  if (fromPack) return Promise.resolve(fromPack);
  const key = `${naturalVoice()}|${style}|${text}`;
  const hit = audioUrls.get(key);
  if (hit) {
    audioUrls.delete(key);
    audioUrls.set(key, hit);
    return hit;
  }
  const p = fromServer(text, style, urgent).then((blob) => URL.createObjectURL(blob));
  p.catch(() => audioUrls.delete(key));
  audioUrls.set(key, p);
  if (audioUrls.size > AUDIO_CACHE) {
    const [oldKey, oldUrl] = audioUrls.entries().next().value!;
    audioUrls.delete(oldKey);
    void oldUrl.then((u) => URL.revokeObjectURL(u)).catch(() => {});
  }
  return p;
}

/** Natural voices already speak at a calm pace; slower settings stretch them gently, keeping pitch. */
function playbackRate(rate: number): number {
  return rate >= 0.95 ? 1 : Math.max(0.8, 0.55 + 0.5 * rate);
}

function playUrl(url: string, rate: number, my: number): Promise<void> {
  return new Promise((resolve) => {
    if (my !== token) return resolve();
    player ??= new Audio();
    const a = player;
    a.src = url;
    a.preservesPitch = true;
    a.playbackRate = playbackRate(rate);
    const finish = () => {
      a.onended = a.onerror = a.onpause = null;
      resolve();
    };
    a.onended = finish;
    a.onerror = finish;
    a.onpause = finish;
    // Autoplay can be blocked before the first tap; that's fine, the bubble still shows.
    a.play().catch(finish);
  });
}

// ------------------------------------------------------------------ public API

async function sayParts(parts: Part[], my: number) {
  // On a freshly loaded page, wait briefly for the server's voice status before choosing an engine.
  if (!status && statusReady) await Promise.race([statusReady, new Promise((r) => setTimeout(r, 2000))]);
  if (my !== token) return;
  const engine = activeEngine();
  if (engine === 'none') return;
  if (engine === 'natural') {
    // Fetch every part at once, then play them in order: the beats stay evenly spaced.
    const prepared = parts.map((p) => {
      const text = withoutPrivateWords(p.text);
      return { p, text, audio: text ? fetchAudio(text, styleFor(p)) : null };
    });
    for (const { p, text, audio } of prepared) {
      if (my !== token) return;
      if (audio) {
        try {
          await playUrl(await audio, p.rate ?? 0.85, my);
        } catch {
          // Natural voice unavailable for this line: say it on the device instead.
          if (deviceSpeechSupported) await sayOnDevice(p.text, p.rate ?? 0.85, my);
        }
      } else if (!text && deviceSpeechSupported) {
        // The whole line was private (only a name): keep it on the device.
        await sayOnDevice(p.text, p.rate ?? 0.85, my);
      }
      if (p.pauseMs && my === token) await new Promise((r) => setTimeout(r, p.pauseMs));
    }
    return;
  }
  for (const p of parts) {
    if (my !== token) return;
    await sayOnDevice(p.text, p.rate ?? 0.85, my);
    if (p.pauseMs && my === token) await new Promise((r) => setTimeout(r, p.pauseMs));
  }
}

/** Speak one line, cancelling anything already speaking. Resolves when done (or cut off). */
export async function speak(text: string, { rate = 0.85, style }: { rate?: number; style?: SpeechStyle } = {}): Promise<void> {
  stopSpeaking();
  const my = token;
  if (text) await sayParts([{ text, rate, style }], my);
}

/** Speak several pieces in order, with optional pauses. Stops if anything else starts speaking. */
export async function speakSequence(parts: Part[]): Promise<void> {
  stopSpeaking();
  const my = token;
  await sayParts(parts.filter((p) => p.text), my);
}

const warmed = new Set<string>();

/**
 * Preload the voice-pack clips for lines that are about to be needed (a round's
 * words, beats and prompts), so they play instantly. Only pack files are
 * fetched: warming never spends the live speech quota.
 */
export function prefetch(parts: Part[]) {
  if (activeEngine() !== 'natural') return;
  for (const p of parts) {
    const url = packUrl(withoutPrivateWords(p.text), styleFor(p));
    if (url && !warmed.has(url)) {
      warmed.add(url);
      void fetch(url).catch(() => warmed.delete(url));
    }
  }
}

/** Preload every pack clip Lumo uses on every screen (praise, hints, prompts). */
export function prefetchCommon(lines: string[]) {
  prefetch(lines.map((text) => ({ text, style: 'lumo' as const })));
}

if (hasWindow) {
  void loadVoicePack();
  window.addEventListener('lumen:navigate', () => stopSpeaking());
}

// ------------------------------------------------------------------ read-aloud for the reader

export interface ReadAloud {
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface ReadAloudOptions {
  rate: number;
  /** Called with the character index of each word as it's spoken, when the voice reports it. */
  onWord?: (index: number) => void;
  /** Called with the index of the chunk (paragraph) being read. */
  onChunk?: (chunk: number) => void;
  onEnd?: () => void;
}

/**
 * Reads text aloud chunk by chunk (one paragraph per chunk). The device voice
 * reports word boundaries, so callers can highlight the word being spoken; the
 * natural voice doesn't, so only the chunk is reported. Nothing is faked.
 */
export function readAloud(chunks: { text: string; start: number }[], opts: ReadAloudOptions): ReadAloud {
  let my = 0;
  let i = 0;
  let resumeFrom = 0; // character offset in the current chunk, so resume carries on from the last word
  const useDevice = deviceSpeechSupported && (prefs.engine === 'device' || !naturalReady());

  const deviceChunk = async () => {
    await ensureVoices();
    if (my !== token) return;
    if (i >= chunks.length) { opts.onEnd?.(); return; }
    const { text, start } = chunks[i];
    opts.onChunk?.(i);
    const offset = resumeFrom;
    const u = new SpeechSynthesisUtterance(text.slice(offset));
    u.rate = opts.rate;
    const voice = pickDeviceVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.onboundary = (e) => {
      if (my !== token || e.name !== 'word') return;
      resumeFrom = offset + e.charIndex;
      opts.onWord?.(start + offset + e.charIndex);
    };
    const next = () => {
      if (my !== token) return;
      i++;
      resumeFrom = 0;
      void deviceChunk();
    };
    u.onend = next;
    u.onerror = next;
    window.speechSynthesis.speak(u);
  };

  const naturalChunk = async () => {
    if (my !== token) return;
    if (i >= chunks.length) { opts.onEnd?.(); return; }
    opts.onChunk?.(i);
    // Natural audio is made a sentence at a time; there are no word timings to highlight.
    const sentences = chunks[i].text.match(/[^.!?]+[.!?]+["”']?|[^.!?]+$/g) ?? [chunks[i].text];
    await sayParts(sentences.map((s) => ({ text: s.trim(), rate: opts.rate, pauseMs: 150, style: 'lumo' as const })), my);
    if (my !== token) return;
    i++;
    void naturalChunk();
  };

  const begin = () => {
    stopSpeaking();
    my = token;
    void (useDevice ? deviceChunk() : naturalChunk());
  };
  begin();

  return {
    // Pausing stops the voice and remembers the place; device voices resume from the last word,
    // natural audio from the start of the paragraph (it has no word timings).
    pause() { if (my === token) stopSpeaking(); },
    resume() { begin(); },
    stop() { if (my === token) stopSpeaking(); i = chunks.length; },
  };
}
