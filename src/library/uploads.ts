// The learner's own reading material, stored privately in this browser
// (IndexedDB). Three things are kept separately, as required:
//   the original file, the raw transcription, and the confirmed (edited) text.

export type UploadKind = 'text' | 'txt' | 'pdf' | 'image';
export type ExtractMethod = 'typed' | 'text-file' | 'embedded-text' | 'ocr-printed' | 'ocr-handwriting' | 'unavailable';

export interface ExtractedWord { text: string; conf?: number; flagged?: boolean }

export interface ExtractedPage {
  page: number;
  method: ExtractMethod;
  text: string;
  /** Word-level detail when the reader provides it: real confidence (Tesseract) or a disagreement flag. */
  words?: ExtractedWord[];
  meanConfidence?: number | null;
}

export interface Extraction {
  text: string;
  pages: ExtractedPage[];
  warnings: string[];
  hash?: string;
  at: string;
}

export interface Upload {
  id: string;
  name: string;
  kind: UploadKind;
  mime: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  /** The original file (PDF or picture), kept as uploaded. */
  file?: Blob;
  /** Raw transcription, exactly as extracted or typed. */
  raw?: Extraction;
  /** The text the learner (or grown-up) confirmed after review. */
  confirmed?: string;
  /** Mode chosen for pictures. */
  mode?: 'auto' | 'printed' | 'handwriting';
}

const DB = 'lumen';
const STORE = 'uploads';

/** Signed-in learners keep uploads in Lumen's database; guests keep them in this browser. */
let serverMode = false;
export function setUploadsBackend(server: boolean) {
  serverMode = server;
}

async function req<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { ...(method !== 'GET' ? { 'x-lumen': '1' } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error('Please log in again.');
  if (!res.ok && res.status !== 204) throw new Error(`Upload request failed (${res.status})`);
  return (res.status === 204 ? null : await res.json()) as T;
}

interface ServerUpload extends Omit<Upload, 'file'> { hasFile?: boolean }

/** The original file of a server upload, fetched only when it's needed (for the review screen). */
export async function uploadFile(u: Upload): Promise<Blob | undefined> {
  if (u.file) return u.file;
  if (!serverMode || !(u as ServerUpload).hasFile) return undefined;
  const res = await fetch(`/api/data/uploads/${u.id}/file`, { credentials: 'same-origin' });
  return res.ok ? res.blob() : undefined;
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listUploads(): Promise<Upload[]> {
  if (serverMode) return (await req<{ uploads: ServerUpload[] }>('/api/data/uploads')).uploads as Upload[];
  const all = await tx<Upload[]>('readonly', (s) => s.getAll() as IDBRequest<Upload[]>);
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getUpload(id: string): Promise<Upload | undefined> {
  if (serverMode) {
    try { return (await req<{ upload: ServerUpload }>(`/api/data/uploads/${encodeURIComponent(id)}`)).upload as Upload; } catch { return undefined; }
  }
  return tx<Upload | undefined>('readonly', (s) => s.get(id) as IDBRequest<Upload | undefined>);
}

export async function saveUpload(u: Upload): Promise<Upload> {
  if (serverMode) {
    const existing = await getUpload(u.id).catch(() => undefined);
    if (existing) {
      return (await req<{ upload: ServerUpload }>(`/api/data/uploads/${u.id}`, 'PUT', { name: u.name, confirmed: u.confirmed, raw: u.raw })).upload as Upload;
    }
    const body = { name: u.name, kind: u.kind, mime: u.mime, size: u.size, raw: u.raw, confirmed: u.confirmed, mode: u.mode, fileBase64: u.file ? await toBase64(u.file) : undefined };
    return (await req<{ upload: ServerUpload }>('/api/data/uploads', 'POST', body)).upload as Upload;
  }
  const next = { ...u, updatedAt: new Date().toISOString() };
  await tx('readwrite', (s) => s.put(next));
  return next;
}

export async function deleteUpload(id: string): Promise<void> {
  if (serverMode) { await req(`/api/data/uploads/${encodeURIComponent(id)}`, 'DELETE'); return; }
  await tx('readwrite', (s) => s.delete(id));
}

export async function clearUploads(): Promise<void> {
  if (serverMode) {
    for (const u of await listUploads().catch(() => [])) await deleteUpload(u.id).catch(() => {});
    return;
  }
  try { await tx('readwrite', (s) => s.clear()); } catch { /* nothing stored */ }
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** SHA-256 of a file, used to reuse an earlier extraction of the same file. */
export async function fileHash(blob: Blob): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null; // not a secure context
  }
}

/** An earlier extraction of exactly this file, if the learner uploaded it before. */
export async function findExtraction(hash: string, mode: string): Promise<Extraction | null> {
  const all = await listUploads();
  return all.find((u) => u.raw?.hash === hash && (u.kind !== 'image' || u.mode === mode))?.raw ?? null;
}

/** Pages for the reader: confirmed text split at form feeds or page markers, else one page per ~120 words. */
export function readerPages(text: string): string[] {
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim());
  const pages: string[] = [];
  let cur: string[] = [];
  let words = 0;
  for (const p of paras) {
    const n = (p.match(/\S+/g) ?? []).length;
    if (cur.length && words + n > 120) {
      pages.push(cur.join('\n\n'));
      cur = [];
      words = 0;
    }
    cur.push(p);
    words += n;
  }
  if (cur.length) pages.push(cur.join('\n\n'));
  return pages.length ? pages : [''];
}
