// Fish Audio text-to-speech (https://docs.fish.audio), free tier model "s2.1-pro-free".
//   FISH_API_KEY=...          required (server-side only)
//   FISH_VOICE_ID=...         the voice's reference id from the Fish Audio library (recommended)
//   FISH_VOICES=id:Label,...  optional extra voices to offer in Settings
//   FISH_MODEL=s2.1-pro-free  optional (s1, s2-pro, s2.1-pro, s2.1-pro-free)

const ENDPOINT = 'https://api.fish.audio/v1/tts';

export function fishConfigured() {
  return Boolean(process.env.FISH_API_KEY);
}

export const fishModel = () => process.env.FISH_MODEL || 's2.1-pro-free';

/** Voices offered in Settings: FISH_VOICE_ID first, then any in FISH_VOICES. id → label. */
export function fishVoices() {
  const out = {};
  if (process.env.FISH_VOICE_ID) out[process.env.FISH_VOICE_ID] = 'Lumo (Fish Audio)';
  for (const pair of (process.env.FISH_VOICES ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const [id, ...label] = pair.split(':');
    if (id) out[id] = label.join(':') || id;
  }
  if (!Object.keys(out).length) out.default = 'Fish Audio default voice';
  return out;
}

export function fishDefaultVoice() {
  return Object.keys(fishVoices())[0];
}

/** Calm lines, slower words, slowest beats. */
const SPEED = { lumo: 0.95, cheer: 1, word: 0.9, slow: 0.75 };

export class FishError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** MP3 audio for one line. */
export async function fishSynthesize(text, voice, style = 'lumo') {
  const body = {
    text,
    format: 'mp3',
    mp3_bitrate: 64,
    latency: 'normal',
    normalize: true,
    prosody: { speed: SPEED[style] ?? 0.95, normalize_loudness: true },
  };
  if (voice && voice !== 'default') body.reference_id = voice;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: {
      authorization: `Bearer ${process.env.FISH_API_KEY}`,
      'content-type': 'application/json',
      model: fishModel(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    const why = res.status === 401 ? 'the key was not accepted' : res.status === 402 ? 'the free quota is used up' : res.status === 503 ? 'the service is busy' : detail;
    throw new FishError(res.status, `Fish Audio failed (${res.status}): ${why}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
