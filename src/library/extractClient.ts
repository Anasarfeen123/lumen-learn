// Sends a file to the server's extractor and reports real progress: upload
// bytes, then each page as it's read. Cancellable at any time.
import type { Extraction } from './uploads';

export interface ExtractProgress {
  stage: 'uploading' | 'reading' | 'scanning' | 'handwriting';
  /** 0..1 for uploading; page numbers for the rest. */
  fraction?: number;
  page?: number;
  pages?: number;
}

export interface ExtractFailure { code: string; message: string }

export interface Capabilities {
  pdfText: boolean;
  pdfOcr: boolean;
  printedOcr: boolean;
  handwriting: boolean;
  limits: { pdfMB: number; imageMB: number; ocrPages: number };
}

export async function getCapabilities(): Promise<Capabilities | null> {
  if ((import.meta.env.VITE_LUMO_API ?? '') === 'off') return null;
  try {
    const res = await fetch('/api/extract/capabilities', { signal: AbortSignal.timeout(5000) });
    return res.ok ? ((await res.json()) as Capabilities) : null;
  } catch {
    return null;
  }
}

export function extractFile(
  file: Blob,
  name: string,
  mode: 'auto' | 'printed' | 'handwriting',
  onProgress: (p: ExtractProgress) => void,
): { promise: Promise<Extraction>; cancel: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<Extraction>((resolve, reject) => {
    let seen = 0;
    let result: Extraction | null = null;
    let failure: ExtractFailure | null = null;
    const readLines = () => {
      const text = xhr.responseText;
      const lines = text.slice(seen).split('\n');
      const complete = lines.slice(0, -1);
      seen += complete.reduce((n, l) => n + l.length + 1, 0);
      for (const line of complete) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'progress') onProgress({ stage: msg.stage, page: msg.page, pages: msg.pages });
          else if (msg.type === 'result') result = { text: msg.text, pages: msg.pages, warnings: msg.warnings ?? [], hash: msg.hash, at: new Date().toISOString() };
          else if (msg.type === 'error') failure = { code: msg.code, message: msg.message };
        } catch { /* partial line */ }
      }
    };
    xhr.open('POST', '/api/extract');
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-file-name', encodeURIComponent(name));
    xhr.setRequestHeader('x-mode', mode);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress({ stage: 'uploading', fraction: e.loaded / e.total }); };
    xhr.onprogress = readLines;
    xhr.onload = () => {
      readLines();
      if (xhr.status === 413) reject({ code: 'size', message: 'This file is too big.' } satisfies ExtractFailure);
      else if (xhr.status === 404) reject({ code: 'config', message: "This version of Lumen can't read files (it's running without its server)." } satisfies ExtractFailure);
      else if (result) resolve(result);
      else reject(failure ?? ({ code: 'failed', message: 'Something went wrong while reading this file. Please try again.' } satisfies ExtractFailure));
    };
    xhr.onerror = () => reject({ code: 'network', message: "Lumen couldn't reach its server. Check the connection and try again." } satisfies ExtractFailure);
    xhr.onabort = () => reject({ code: 'cancelled', message: 'Cancelled.' } satisfies ExtractFailure);
    xhr.send(file);
  });
  return { promise, cancel: () => xhr.abort() };
}
