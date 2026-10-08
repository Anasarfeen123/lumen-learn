// Local speech on the server, so Lumo can always talk, in any browser, with
// no keys and no limits. (Chromium-based browsers on Linux, Brave included,
// have no built-in voices unless started with --enable-speech-dispatcher.)
//
//   Piper (natural neural voice, offline): set PIPER_MODEL=/path/voice.onnx (and PIPER_BIN if `piper` isn't on PATH)
//   espeak-ng (always available on most Linux systems): used when Piper isn't set up
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { timeout: 30_000, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; reject(err); } else resolve(stdout);
    });
    if (input !== undefined) { child.stdin.end(input); }
  });
}

const found = new Map();
function has(cmd) {
  if (!found.has(cmd)) found.set(cmd, run('sh', ['-c', `command -v ${cmd}`]).then(() => true, () => false));
  return found.get(cmd);
}

export async function localEngine() {
  const piperModel = process.env.PIPER_MODEL;
  if (piperModel && existsSync(piperModel) && (await has(process.env.PIPER_BIN || 'piper'))) return 'piper';
  if (await has('espeak-ng')) return 'espeak';
  return null;
}

/** Words per minute (espeak) or length scale (Piper) per style: calm lines, slower words, slowest beats. */
const ESPEAK_WPM = { lumo: 150, cheer: 155, word: 135, slow: 115 };
const PIPER_SCALE = { lumo: 1.05, cheer: 1, word: 1.15, slow: 1.35 };

/** WAV audio for one line, made on this machine. */
export async function localSynthesize(text, style = 'lumo') {
  const engine = await localEngine();
  if (!engine) throw new Error('No local voice: install espeak-ng, or set PIPER_MODEL');
  const dir = await mkdtemp(join(tmpdir(), 'lumen-tts-'));
  const out = join(dir, 'out.wav');
  try {
    if (engine === 'piper') {
      await run(process.env.PIPER_BIN || 'piper', ['--model', process.env.PIPER_MODEL, '--output_file', out, '--length_scale', String(PIPER_SCALE[style] ?? 1.05)], text);
    } else {
      // A gentle female variant at a calm pace; pitch slightly raised to sound friendlier.
      await run('espeak-ng', ['-v', 'en-us+f3', '-s', String(ESPEAK_WPM[style] ?? 150), '-p', '55', '-w', out, text]);
    }
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
