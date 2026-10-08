// Saving a signed-in learner's data to the database. Saves are debounced, and
// sent with the version they were based on, so two devices can't silently
// overwrite each other (the server answers 409 and its newer copy wins).
import { api } from './auth';

export interface RemoteProfile<T> { data: T | null; version: number }

export async function loadProfile<T>(): Promise<RemoteProfile<T>> {
  const { status, data } = await api<RemoteProfile<T>>('/api/data/profile');
  if (status !== 200 || !data) throw new Error(status === 401 ? 'signed-out' : 'load-failed');
  return data;
}

export class ProfileSaver<T> {
  private timer: number | null = null;
  private pending: T | null = null;
  private saving = false;
  private version: number;
  constructor(version: number, private onConflict: (server: T, version: number) => void, private onStatus: (ok: boolean) => void) {
    this.version = version;
  }

  schedule(data: T) {
    this.pending = data;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), 700);
  }

  async flush(): Promise<void> {
    if (this.timer) { window.clearTimeout(this.timer); this.timer = null; }
    if (!this.pending || this.saving) return;
    const data = this.pending;
    this.pending = null;
    this.saving = true;
    try {
      const { status, data: res } = await api<{ version?: number; data?: T }>('/api/data/profile', { method: 'PUT', body: { data, version: this.version } });
      if (status === 200 && res?.version) {
        this.version = res.version;
        this.onStatus(true);
      } else if (status === 409 && res?.data && res.version) {
        this.version = res.version;
        this.onConflict(res.data, res.version);
      } else {
        this.pending ??= data; // keep it for the next try
        this.onStatus(false);
      }
    } catch {
      this.pending ??= data;
      this.onStatus(false);
    } finally {
      this.saving = false;
      if (this.pending) this.schedule(this.pending);
    }
  }
}

/** Debounced save of a whole JSON document (library progress). */
export function jsonSaver(path: string, delay = 800) {
  let timer: number | null = null;
  let pending: unknown = null;
  const flush = async () => {
    if (timer) { window.clearTimeout(timer); timer = null; }
    if (pending === null) return;
    const data = pending;
    pending = null;
    await api(path, { method: 'PUT', body: { data } }).catch(() => { pending ??= data; });
  };
  return {
    schedule(data: unknown) {
      pending = data;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void flush(), delay);
    },
    flush,
  };
}
