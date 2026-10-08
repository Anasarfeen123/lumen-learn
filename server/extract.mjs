// Text extraction for the Library's uploads. Picks the right path per file:
//   PDF with embedded text  -> pdftotext (Poppler), page by page
//   scanned PDF pages       -> pdftoppm to images, then Tesseract OCR
//   printed images          -> Tesseract (real per-word confidence)
//   handwriting             -> a vision model (Groq qwen/qwen3.8-27b) when configured,
//                              cross-checked against Tesseract; disagreements are flagged
// Nothing is invented: failures are reported, never replaced with made-up text,
// and spelling is never corrected. Files live only in a temp folder for the
// duration of the request and are deleted afterwards.
//
//   POST /api/extract   body: the file; headers: content-type, x-file-name, x-mode (auto|printed|handwriting)
//   -> NDJSON stream: {type:"progress",...} lines, then {type:"result",...} or {type:"error",...}
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const LIMITS = { pdf: 15 * 1024 * 1024, image: 8 * 1024 * 1024, ocrPages: 20 };
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const VISION_MODEL = () => process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
const LOW_CONFIDENCE = 70;

// One thread per OCR job. Hosting containers report many cores but allow only a small share
// of one; Tesseract's default of a thread per core makes the threads fight and runs ~10x slower.
const TOOL_ENV = { ...process.env, OMP_THREAD_LIMIT: '1' };

function run(cmd, args, { signal, timeout = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { signal, timeout, maxBuffer: 64 * 1024 * 1024, env: TOOL_ENV }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = String(stderr);
        reject(err);
      } else resolve(String(stdout));
    });
  });
}

const which = new Map();
async function has(cmd) {
  if (!which.has(cmd)) which.set(cmd, run('sh', ['-c', `command -v ${cmd}`]).then(() => true, () => false));
  return which.get(cmd);
}

/** What this server can do, for the upload screen and the startup log. */
export async function capabilities() {
  const [pdftotext, pdftoppm, pdfinfo, tesseract, ffmpeg] = await Promise.all(['pdftotext', 'pdftoppm', 'pdfinfo', 'tesseract', 'ffmpeg'].map(has));
  return {
    pdfText: pdftotext && pdfinfo,
    pdfOcr: pdftoppm && tesseract && pdfinfo,
    printedOcr: tesseract,
    handwriting: Boolean(process.env.GROQ_API_KEY),
    resize: ffmpeg,
    limits: { pdfMB: LIMITS.pdf / 1048576, imageMB: LIMITS.image / 1048576, ocrPages: LIMITS.ocrPages },
  };
}

class ExtractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------- Tesseract

/** Runs Tesseract and rebuilds lines and paragraphs from its TSV, keeping each word's confidence. */
async function tesseract(image, signal) {
  let tsv;
  try {
    tsv = await run('tesseract', [image, '-', '-l', 'eng', '--psm', '3', 'tsv'], { signal, timeout: 120_000 });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ExtractError('unreadable', "This picture couldn't be opened. It may be damaged, or not really a picture.");
  }
  const rows = tsv.split('\n').slice(1).map((l) => l.split('\t')).filter((r) => r[0] === '5' && r[11]?.trim());
  const lines = [];
  let key = '';
  let lastBlock = '';
  for (const r of rows) {
    const [, , block, par, line] = r;
    const k = `${block}.${par}.${line}`;
    if (k !== key) {
      if (lastBlock && `${block}.${par}` !== lastBlock) lines.push(null); // paragraph break
      lines.push([]);
      key = k;
      lastBlock = `${block}.${par}`;
    }
    lines.at(-1).push({ text: r[11], conf: Math.round(Number(r[10])) });
  }
  const words = [];
  const textParts = [];
  for (const l of lines) {
    if (l === null) { textParts.push(''); continue; }
    textParts.push(l.map((w) => w.text).join(' '));
    for (const w of l) words.push({ text: w.text, conf: w.conf, flagged: w.conf < LOW_CONFIDENCE });
  }
  const text = textParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const confs = words.map((w) => w.conf).filter((c) => c >= 0);
  return { text, words, meanConfidence: confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null };
}

// ---------------------------------------------------------------- handwriting (vision model)

async function visionTranscribe(imagePath, mime, signal) {
  let buf = await readFile(imagePath);
  // Vision requests accept images up to about 4 MB as base64; shrink large photos first.
  if (buf.length > 3_000_000 && (await has('ffmpeg'))) {
    const small = `${imagePath}.small.jpg`;
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', imagePath, '-vf', 'scale=1600:-2', '-q:v', '4', small], { signal });
    buf = await readFile(small);
    mime = 'image/jpeg';
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: VISION_MODEL(),
      temperature: 0,
      max_tokens: 2000,
      ...(VISION_MODEL().startsWith('qwen/') ? { reasoning_effort: 'none' } : {}),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe all the writing in this image exactly as written. Keep the writer\'s own spelling, capital letters and punctuation, even if they are unusual. Do not correct anything. Keep line breaks. If a word cannot be read, write [?] in its place. Output only the transcription.' },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } },
        ],
      }],
    }),
  });
  if (res.status === 429) throw new ExtractError('rate-limited', 'The handwriting reader is busy. Please try again in a minute.');
  if (!res.ok) throw new ExtractError('provider', `The handwriting reader failed (${res.status}).`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? '').replace(/^```[a-z]*\n?|```$/g, '').trim();
}

const normWord = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');

/**
 * Words the vision model read that Tesseract didn't (or [?]) are flagged for review.
 * That's a real disagreement signal, not a confidence score; the model gives none.
 */
function crossCheck(visionText, tess) {
  const seen = new Set(tess.words.map((w) => normWord(w.text)));
  const words = (visionText.match(/\S+/g) ?? []).map((w) => ({ text: w, flagged: w.includes('[?]') || (normWord(w).length > 0 && !seen.has(normWord(w))) }));
  return words;
}

// ---------------------------------------------------------------- PDFs

async function pdfInfo(file, signal) {
  try {
    const out = await run('pdfinfo', [file], { signal });
    return { pages: Number(out.match(/Pages:\s+(\d+)/)?.[1] ?? 0) };
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    if (/password|Incorrect/i.test(e.stderr ?? '')) throw new ExtractError('password', 'This PDF is password-protected. Please remove the password and try again.');
    throw new ExtractError('unreadable', "This PDF couldn't be opened. It may be damaged.");
  }
}

async function extractPdf(file, dir, signal, progress) {
  const { pages } = await pdfInfo(file, signal);
  if (!pages) throw new ExtractError('unreadable', 'This PDF has no pages.');
  const out = [];
  let ocrUsed = 0;
  const warnings = [];
  for (let p = 1; p <= pages; p++) {
    progress({ stage: 'reading', page: p, pages });
    const text = (await run('pdftotext', ['-f', String(p), '-l', String(p), '-enc', 'UTF-8', file, '-'], { signal })).replace(/\f/g, '').trim();
    if (text.replace(/\s/g, '').length >= 20) {
      out.push({ page: p, method: 'embedded-text', text });
      continue;
    }
    // Little or no embedded text: this page is probably a scan. OCR it.
    if (ocrUsed >= LIMITS.ocrPages) {
      warnings.push(`Pages after ${p - 1} weren't scanned (the limit is ${LIMITS.ocrPages} scanned pages per file).`);
      break;
    }
    if (!(await has('pdftoppm')) || !(await has('tesseract'))) {
      out.push({ page: p, method: 'unavailable', text: '' });
      warnings.push(`Page ${p} looks scanned, but this server can't scan pages (Tesseract or Poppler is missing).`);
      continue;
    }
    progress({ stage: 'scanning', page: p, pages });
    const prefix = join(dir, `page-${p}`);
    // Grayscale at 150 DPI: the same words as colour at 200 DPI, with far fewer pixels to read.
    await run('pdftoppm', ['-f', String(p), '-l', String(p), '-r', '150', '-gray', '-png', file, prefix], { signal, timeout: 120_000 });
    const img = (await readdir(dir)).find((f) => f.startsWith(`page-${p}`) && f.endsWith('.png'));
    if (!img) { out.push({ page: p, method: 'unavailable', text: '' }); continue; }
    const t = await tesseract(join(dir, img), signal);
    ocrUsed++;
    out.push({ page: p, method: 'ocr-printed', text: t.text, words: t.words, meanConfidence: t.meanConfidence });
  }
  return { pages: out, warnings };
}

// ---------------------------------------------------------------- entry point

const cache = new Map(); // sha256+mode -> result, in memory only, for repeat uploads of the same file
function remember(key, value) {
  cache.set(key, value);
  if (cache.size > 50) cache.delete(cache.keys().next().value);
}

export async function extract(buf, { mime, name, mode = 'auto' }, signal, progress = () => {}) {
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name ?? '');
  const ext = IMAGE_TYPES[mime];
  if (!isPdf && !ext) throw new ExtractError('type', 'Please choose a PDF, or a PNG, JPEG or WebP picture.');
  if (isPdf && buf.subarray(0, 5).toString() !== '%PDF-') throw new ExtractError('unreadable', "This file doesn't look like a PDF.");
  if (buf.length > (isPdf ? LIMITS.pdf : LIMITS.image)) {
    throw new ExtractError('size', `This file is too big. The limit is ${(isPdf ? LIMITS.pdf : LIMITS.image) / 1048576} MB.`);
  }
  const hash = createHash('sha256').update(buf).digest('hex');
  const cacheKey = `${hash}:${mode}`;
  if (cache.has(cacheKey)) return { ...cache.get(cacheKey), cached: true };

  const caps = await capabilities();
  const dir = await mkdtemp(join(tmpdir(), 'lumen-extract-'));
  try {
    const file = join(dir, isPdf ? 'input.pdf' : `input.${ext}`);
    await writeFile(file, buf);
    let result;
    if (isPdf) {
      if (!caps.pdfText) throw new ExtractError('config', "This server can't read PDFs yet: Poppler (pdftotext, pdfinfo) isn't installed.");
      const { pages, warnings } = await extractPdf(file, dir, signal, progress);
      result = { kind: 'pdf', pages, warnings };
    } else {
      if (!caps.printedOcr && !(mode !== 'printed' && caps.handwriting)) {
        throw new ExtractError('config', "This server can't read pictures yet: Tesseract isn't installed and handwriting reading isn't set up.");
      }
      progress({ stage: 'scanning', page: 1, pages: 1 });
      const tess = caps.printedOcr ? await tesseract(file, signal) : null;
      const looksHandwritten = tess ? (tess.meanConfidence ?? 0) < 75 : true;
      const useVision = mode === 'handwriting' || (mode === 'auto' && looksHandwritten);
      const warnings = [];
      if (useVision && caps.handwriting) {
        progress({ stage: 'handwriting', page: 1, pages: 1 });
        const text = await visionTranscribe(file, mime, signal);
        if (!text) throw new ExtractError('empty', "Lumo couldn't find any writing in this picture.");
        result = { kind: 'image', pages: [{ page: 1, method: 'ocr-handwriting', text, words: tess ? crossCheck(text, tess) : undefined }], warnings };
      } else {
        if (useVision) warnings.push("Handwriting reading isn't set up on this server, so the printed-text reader was used. It may miss handwritten words.");
        result = { kind: 'image', pages: [{ page: 1, method: 'ocr-printed', text: tess.text, words: tess.words, meanConfidence: tess.meanConfidence }], warnings };
      }
    }
    const text = result.pages.map((p) => p.text).filter(Boolean).join('\n\n');
    if (!text.trim()) throw new ExtractError('empty', "Lumo couldn't find any text in this file. You can type it in instead.");
    result = { ...result, text, hash };
    remember(cacheKey, result);
    return result;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Connect-style middleware for POST /api/extract (streams NDJSON progress, then the result). */
export async function extractApi(req, res, next) {
  const url = (req.url || '').split('?')[0];
  if (url === '/api/extract/capabilities' && req.method === 'GET') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(await capabilities()));
  }
  if (url !== '/api/extract') return next ? next() : undefined;
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }

  const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim();
  const name = decodeURIComponent(String(req.headers['x-file-name'] ?? ''));
  const mode = ['auto', 'printed', 'handwriting'].includes(req.headers['x-mode']) ? req.headers['x-mode'] : 'auto';
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > LIMITS.pdf) { res.statusCode = 413; return res.end(JSON.stringify({ type: 'error', code: 'size', message: 'This file is too big.' })); }

  // Cancelling on the client closes the request; stop work straight away.
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });

  const chunks = [];
  let size = 0;
  try {
    for await (const c of req) {
      size += c.length;
      if (size > LIMITS.pdf) throw new ExtractError('size', 'This file is too big.');
      chunks.push(c);
    }
  } catch (e) {
    res.statusCode = 413;
    return res.end(JSON.stringify({ type: 'error', code: 'size', message: e.message }));
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'application/x-ndjson');
  // Progress must reach the page as it happens: ask every proxy on the way not to buffer it.
  res.setHeader('cache-control', 'no-store, no-transform');
  res.setHeader('x-accel-buffering', 'no');
  res.flushHeaders?.();
  const write = (obj) => { if (!res.writableEnded) res.write(`${JSON.stringify(obj)}\n`); };
  // Some proxies hold back the first few KB; a blank padding line (ignored by the client) pushes it through.
  res.write(`${' '.repeat(2048)}\n`);
  // A heartbeat while a long page is being read, so nothing on the way closes the connection.
  const beat = setInterval(() => { if (!res.writableEnded) res.write('\n'); }, 10_000);
  try {
    const result = await extract(Buffer.concat(chunks), { mime, name, mode }, controller.signal, (p) => write({ type: 'progress', ...p }));
    write({ type: 'result', ...result });
  } catch (e) {
    if (controller.signal.aborted) return res.end();
    const known = e instanceof ExtractError;
    write({ type: 'error', code: known ? e.code : 'failed', message: known ? e.message : 'Something went wrong while reading this file. Please try again.' });
    if (!known) console.error('[extract]', e);
  } finally {
    clearInterval(beat);
  }
  res.end();
}
