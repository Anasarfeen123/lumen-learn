// Prints a secret-free summary of the .env / AI setup when a server starts,
// including whether the natural voice actually works with this key.
import { lumoApi } from './lumo-api.mjs';

function call(path) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      end(data) { resolve(data ? JSON.parse(data) : null); },
    };
    lumoApi({ method: 'GET', url: path, on() {} }, res, () => resolve(null));
  });
}

export async function logSetup(env, log = console.log) {
  const where = env.found ? `.env loaded (${env.keys.length ? env.keys.join(', ') : 'no values set'})` : 'no .env file (copy .env.example to .env)';
  log(`  ${where}`);
  if (!process.env.GROQ_API_KEY && !process.env.FISH_API_KEY && !process.env.GOOGLE_TTS_API_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    log("  Lumo's AI: off — add GROQ_API_KEY (tips) and GOOGLE_TTS_API_KEY (natural voice) to .env");
    return;
  }
  const s = await call('/api/lumo/status');
  log(s.ai ? `  Lumo's AI: on (Groq · ${s.model})` : "  Lumo's AI tips: off — add GROQ_API_KEY to .env");
  if (s.modelNote) log(`  Note: ${s.modelNote}. Update GROQ_MODEL in .env, or remove it to use the best available.`);
  const voice = {
    ready: `on (${s.tts.voice})`,
    'needs-terms': 'waiting — accept the model terms once at https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english (device voice is used until then)',
    limited: `on, but over Groq's speech limit right now (${s.tts.message})`,
    error: `unavailable (${s.tts.message}) — the device voice is used`,
  }[s.tts.state] ?? s.tts.state;
  if (s.tts.local) log(`  Local voice: ${s.tts.local === 'piper' ? 'Piper (natural, offline)' : 'eSpeak (robotic; set PIPER_MODEL for a natural offline voice)'} — used whenever the cloud voice can't answer`);
  log(`  Natural voice: ${voice}${s.tts.provider === 'fish' ? ' · Fish Audio' : s.tts.provider === 'google' ? ' · Google Chirp 3 HD' : s.tts.provider === 'groq' ? ' · Groq Orpheus' : ''}`);
}
