import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '../router';
import { Lumo } from '../components/Lumo';
import { Picture } from '../components/Picture';
import { pictureFor } from '../data/pictures';
import { getStory, listStories, readingMinutes, TOPICS, type Story } from './content';
import { getPosition, inProgress, isFinished } from './progress';
import {
  deleteUpload, fileHash, findExtraction, getUpload, listUploads, newId, readerPages, saveUpload, uploadFile,
  type ExtractedPage, type Upload, type UploadKind,
} from './uploads';
import { extractFile, getCapabilities, type Capabilities, type ExtractFailure, type ExtractProgress } from './extractClient';
import { Reader } from './Reader';
import { useLumen } from '../state/store';
import {
  deleteLumoStory, effectiveInterests, getLumoStory, INTERESTS, listLumoStories, setFeeling, usePersonal, writeStory, type LumoStory,
} from '../personal/personal';

const LEVEL_NAME = ['', 'First steps', 'Getting going', 'Growing', 'Confident', 'Adventurous'];

function useFocusHeading() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return ref;
}

// ======================================================================= Library home

export function Library() {
  const { location, navigate } = useRouter();
  const q = location.query;
  const tab = q.get('tab') === 'uploads' ? 'uploads' : 'stories';
  const heading = useFocusHeading();
  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(q);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    const s = next.toString();
    navigate(`/library${s ? `?${s}` : ''}`, { replace: true });
  };
  useEffect(() => { document.title = 'Library · Lumen'; }, []);

  return (
    <main className="screen library" id="main">
      <div className="section-head">
        <div>
          <h1 className="title" tabIndex={-1} ref={heading}>Library</h1>
          <p className="muted">Stories to read, and your own pages. Tap any word for help.</p>
        </div>
        <button type="button" className="btn primary small" onClick={() => navigate('/library/add')}>+ Add your own reading</button>
      </div>
      <div className="subtabs" role="tablist" aria-label="Library">
        <button role="tab" type="button" aria-selected={tab === 'stories'} className={tab === 'stories' ? 'on' : ''} onClick={() => setQuery({ tab: null })}>Stories</button>
        <button role="tab" type="button" aria-selected={tab === 'uploads'} className={tab === 'uploads' ? 'on' : ''} onClick={() => setQuery({ tab: 'uploads' })}>My uploads</button>
      </div>
      {tab === 'stories' ? <Stories query={q} setQuery={setQuery} /> : <MyUploads />}
    </main>
  );
}

function Stories({ query, setQuery }: { query: URLSearchParams; setQuery: (p: Record<string, string | null>) => void }) {
  const { navigate } = useRouter();
  const search = query.get('q') ?? '';
  const level = query.get('level') ?? '';
  const topic = query.get('topic') ?? '';
  const stories = listStories();
  const shown = stories.filter((s) =>
    (!level || s.level === Number(level)) &&
    (!topic || s.topic === topic) &&
    (!search || `${s.title} ${s.summary} ${s.topic}`.toLowerCase().includes(search.toLowerCase())));
  const continuing = inProgress().filter((r) => r.kind === 'story').map((r) => ({ r, s: getStory(r.id) })).filter((x): x is { r: typeof x.r; s: Story } => Boolean(x.s)).slice(0, 3);

  return (
    <>
      <LumoShelf />
      {continuing.length > 0 && (
        <section aria-labelledby="cont-h" className="continue">
          <h2 id="cont-h" className="title">Continue reading</h2>
          <div className="cards">
            {continuing.map(({ r, s }) => (
              <button key={s.id} type="button" className="story-card sketch compact" onClick={() => navigate(`/library/read/story/${s.id}`)}>
                <StoryCover story={s} />
                <span className="story-title">{s.title}</span>
                <span className="muted">Page {r.position.page + 1} of {s.pages.length}</span>
                <span className="meter"><div className="hatch-leaf" style={{ width: `${((r.position.page + 1) / s.pages.length) * 100}%` }} /></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="filters" role="search">
        <label className="search">
          <span className="sr-only">Search stories</span>
          <input type="search" className="text-input small" placeholder="Search stories" value={search} onChange={(e) => setQuery({ q: e.target.value || null })} />
        </label>
        <label>
          <span className="sr-only">Level</span>
          <select className="select" value={level} onChange={(e) => setQuery({ level: e.target.value || null })}>
            <option value="">All levels</option>
            {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Level {l}: {LEVEL_NAME[l]}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Topic</span>
          <select className="select" value={topic} onChange={(e) => setQuery({ topic: e.target.value || null })}>
            <option value="">All topics</option>
            {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {(search || level || topic) && <button type="button" className="link" onClick={() => setQuery({ q: null, level: null, topic: null })}>Clear</button>}
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <Lumo pose="thinking" size={110} motion="none" />
          <p>No stories match that. Try another word, or clear the filters.</p>
        </div>
      ) : (
        <div className="cards" aria-live="polite">
          {shown.map((s, i) => {
            const pos = getPosition('story', s.id);
            const done = isFinished('story', s.id);
            return (
              <button key={s.id} type="button" className={`story-card sketch ${i % 2 ? 'alt' : ''}`} style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => navigate(`/library/read/story/${s.id}`)}>
                <StoryCover story={s} />
                <span className="story-title">{s.title}</span>
                <span className="story-summary">{s.summary}</span>
                <span className="story-meta">
                  <span className="pill">Level {s.level}</span>
                  <span className="pill">{readingMinutes(s)} min</span>
                  <span className="pill">{s.topic}</span>
                  {s.status === 'draft' && <span className="pill draft">Draft: not reviewed</span>}
                  {done ? <span className="pill done">Finished ✓</span> : pos ? <span className="pill">Page {pos.page + 1}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Stories Lumo wrote for this learner, about what they like, using the words they're practising. */
function LumoShelf() {
  const { profile } = useLumen();
  const { navigate } = useRouter();
  const personal = usePersonal();
  const [stories, setStories] = useState<LumoStory[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState<LumoStory | null>(null);
  const liked = effectiveInterests(personal, stories ?? []);
  const [topic, setTopic] = useState('');
  const chosen = topic || liked[0] || 'animals';
  useEffect(() => { void listLumoStories().then(setStories, () => setStories([])); }, [personal]);

  const write = async () => {
    setBusy(true);
    setError('');
    const r = await writeStory(profile, chosen);
    setBusy(false);
    if (r.story) navigate(`/library/read/lumo/${r.story.id}`);
    else setError(r.error ?? '');
  };

  return (
    <section className="lumo-shelf" aria-labelledby="lumo-shelf-h">
      <div className="lumo-shelf-head">
        <Lumo pose="reading" size={84} motion="none" />
        <div>
          <h2 id="lumo-shelf-h" className="title">Stories Lumo wrote for you</h2>
          <p className="muted">Short stories about what you like, using words you're practising.</p>
        </div>
      </div>
      <div className="lumo-write sketch">
        <label>
          <span className="hand">A story about</span>
          <select className="select" value={chosen} onChange={(e) => setTopic(e.target.value)}>
            {INTERESTS.map((i) => <option key={i.id} value={i.id}>{i.label}{liked.includes(i.id) ? ' ♥' : ''}</option>)}
          </select>
        </label>
        <button type="button" className="btn primary" onClick={() => void write()} disabled={busy} aria-busy={busy}>
          {busy ? 'Lumo is writing…' : 'Write me a story'}
        </button>
        {!personal.interests.length && <button type="button" className="link" onClick={() => navigate('/me')}>Tell Lumo what you like</button>}
      </div>
      {error && <p className="banner" role="alert">{error}</p>}
      {stories && stories.length > 0 && (
        <div className="cards">
          {stories.slice(0, 6).map((s) => (
            <div key={s.id} className="story-card sketch lumo-made">
              <button type="button" className="story-open" onClick={() => navigate(`/library/read/lumo/${s.id}`)}>
                {(() => { const pic = pictureFor(s.cover); return pic ? <Picture picture={pic} className="cover" /> : null; })()}
                <span className="story-title">{s.title}</span>
                <span className="story-meta">
                  <span className="pill">Level {s.level}</span>
                  <span className="pill">By Lumo</span>
                  {isFinished('lumo', s.id) && <span className="pill done">Finished ✓</span>}
                  {s.feeling === 'loved' && <span className="pill">Loved it</span>}
                </span>
              </button>
              <button type="button" className="link small" onClick={() => setRemove(s)} aria-label={`Remove ${s.title}`}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {remove && (
        <div className="inline-confirm sketch" role="alertdialog" aria-labelledby="rm-h">
          <p id="rm-h">Remove “{remove.title}”?</p>
          <button type="button" className="btn small" onClick={() => setRemove(null)}>Keep it</button>
          <button type="button" className="btn small amber" onClick={() => { void deleteLumoStory(remove.id).then(() => listLumoStories().then(setStories)); setRemove(null); }}>Remove</button>
        </div>
      )}
    </section>
  );
}

function StoryCover({ story }: { story: Story }) {
  const pic = pictureFor(story.cover);
  return pic ? <Picture picture={pic} className="cover" /> : <div className="picture sketch cover" aria-hidden="true"><Lumo pose="reading" size={70} motion="none" /></div>;
}

function MyUploads() {
  const { navigate } = useRouter();
  const [items, setItems] = useState<Upload[] | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Upload | null>(null);
  const load = () => listUploads().then(setItems, () => setError("Your uploads couldn't be opened in this browser (private browsing can block storage)."));
  useEffect(() => { void load(); }, []);

  if (error) return <p className="banner" role="alert">{error}</p>;
  if (!items) return <p className="muted" aria-live="polite">Loading your uploads…</p>;
  if (!items.length) {
    return (
      <div className="empty-state">
        <Lumo pose="reading" size={120} motion="none" />
        <p>Nothing here yet. Add a page from school, a letter, or anything you'd like to read with Lumo.</p>
        <button type="button" className="btn primary" onClick={() => navigate('/library/add')}>Add your own reading</button>
      </div>
    );
  }
  return (
    <>
      <ul className="uploads">
        {items.map((u) => (
          <li key={u.id} className="upload-row sketch">
            <span className="upload-kind" aria-hidden="true">{u.kind === 'pdf' ? 'PDF' : u.kind === 'image' ? 'Picture' : 'Text'}</span>
            <span className="upload-name">
              <strong>{u.name}</strong>
              <span className="muted">{u.confirmed ? 'Ready to read' : u.raw ? 'Needs checking' : 'Not read yet'} · {new Date(u.updatedAt).toLocaleDateString()}</span>
            </span>
            {u.confirmed
              ? <button type="button" className="btn small go" onClick={() => navigate(`/library/read/upload/${u.id}`)}>Read</button>
              : <button type="button" className="btn small primary" onClick={() => navigate(`/library/review/${u.id}`)}>Check text</button>}
            {u.raw && u.confirmed && <button type="button" className="link" onClick={() => navigate(`/library/review/${u.id}`)}>Edit text</button>}
            <button type="button" className="link" onClick={() => setConfirmDelete(u)} aria-label={`Delete ${u.name}`}>Delete</button>
          </li>
        ))}
      </ul>
      {confirmDelete && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Delete upload">
          <div className="modal sketch">
            <h2 className="title" style={{ fontSize: 30 }}>Delete “{confirmDelete.name}”?</h2>
            <p>The file and its text will be removed from this browser.</p>
            <div className="actions">
              <button type="button" className="btn" onClick={() => setConfirmDelete(null)}>Keep it</button>
              <button type="button" className="btn amber" onClick={async () => { await deleteUpload(confirmDelete.id); setConfirmDelete(null); void load(); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ======================================================================= Add reading

const ACCEPT = '.txt,text/plain,.pdf,application/pdf,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';

function kindOf(file: File): UploadKind | null {
  if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) return 'txt';
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (/^image\/(png|jpeg|webp)$/.test(file.type)) return 'image';
  return null;
}

const STAGE_TEXT: Record<ExtractProgress['stage'], string> = {
  uploading: 'Sending the file',
  reading: 'Reading the text',
  scanning: 'Looking at the page',
  handwriting: 'Reading the handwriting',
};

export function AddReading() {
  const { navigate, back } = useRouter();
  const heading = useFocusHeading();
  const [how, setHow] = useState<'type' | 'file'>('type');
  const [name, setName] = useState('');
  const [typed, setTyped] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'printed' | 'handwriting'>('auto');
  const [caps, setCaps] = useState<Capabilities | null | undefined>(undefined);
  const [progress, setProgress] = useState<ExtractProgress | null>(null);
  const [failure, setFailure] = useState<ExtractFailure | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => { document.title = 'Add reading · Lumen'; void getCapabilities().then(setCaps); }, []);
  useEffect(() => () => { cancelRef.current?.(); if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const kind = file ? kindOf(file) : null;
  const limitMB = kind === 'pdf' ? caps?.limits.pdfMB ?? 15 : kind === 'image' ? caps?.limits.imageMB ?? 8 : 2;

  const pick = (f: File | null) => {
    setFailure(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(f);
    if (!f) return;
    const k = kindOf(f);
    if (!k) { setFailure({ code: 'type', message: 'Please choose a .txt file, a PDF, or a PNG, JPEG or WebP picture.' }); return; }
    if (!name) setName(f.name.replace(/\.[a-z0-9]+$/i, ''));
    if (k === 'image' || k === 'pdf') setPreview(URL.createObjectURL(f));
  };

  const saveText = async (text: string, k: UploadKind, original?: Blob) => {
    const now = new Date().toISOString();
    const u = await saveUpload({
      id: newId(), name: name.trim() || 'My reading', kind: k, mime: original?.type || 'text/plain', size: original?.size ?? text.length,
      createdAt: now, updatedAt: now, file: original,
      raw: { text, pages: [{ page: 1, method: k === 'txt' ? 'text-file' : 'typed', text }], warnings: [], at: now },
    });
    navigate(`/library/review/${u.id}`);
  };

  const run = async () => {
    setFailure(null);
    if (how === 'type') {
      if (!typed.trim()) { setFailure({ code: 'empty', message: 'Type or paste some text first.' }); return; }
      await saveText(typed, 'text');
      return;
    }
    if (!file || !kind) { setFailure({ code: 'empty', message: 'Choose a file first.' }); return; }
    if (file.size > limitMB * 1048576) { setFailure({ code: 'size', message: `This file is too big. The limit is ${limitMB} MB.` }); return; }
    if (kind === 'txt') {
      const text = await file.text();
      if (!text.trim()) { setFailure({ code: 'empty', message: 'This text file is empty.' }); return; }
      await saveText(text, 'txt', file);
      return;
    }
    // Same file read before? Reuse that result instead of reading it again.
    const hash = await fileHash(file);
    const earlier = hash ? await findExtraction(hash, mode) : null;
    let raw = earlier;
    if (!raw) {
      setProgress({ stage: 'uploading', fraction: 0 });
      const job = extractFile(file, file.name, mode, setProgress);
      cancelRef.current = job.cancel;
      try {
        raw = await job.promise;
      } catch (e) {
        setProgress(null);
        cancelRef.current = null;
        const f = e as ExtractFailure;
        if (f.code !== 'cancelled') setFailure(f);
        return;
      }
      cancelRef.current = null;
    }
    const now = new Date().toISOString();
    const u = await saveUpload({
      id: newId(), name: name.trim() || file.name, kind, mime: file.type, size: file.size, createdAt: now, updatedAt: now,
      file, raw, mode: kind === 'image' ? mode : undefined,
    });
    setProgress(null);
    navigate(`/library/review/${u.id}`);
  };

  const busy = progress !== null;
  const noServer = caps === null;

  return (
    <main className="screen add-reading" id="main">
      <button type="button" className="btn small" onClick={() => back('/library?tab=uploads')}><span aria-hidden="true">←</span> Back to Library</button>
      <h1 className="title" tabIndex={-1} ref={heading}>Add your own reading</h1>
      <p className="muted">Your reading stays in this browser. Files are only sent to Lumen's server to read the text, and aren't kept there.</p>

      <label className="field-block">
        <span className="label">Name</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: My spelling list" maxLength={60} disabled={busy} />
      </label>

      <div className="seg" role="group" aria-label="How do you want to add it?">
        <button type="button" aria-pressed={how === 'type'} onClick={() => setHow('type')} disabled={busy}>Type or paste text</button>
        <button type="button" aria-pressed={how === 'file'} onClick={() => setHow('file')} disabled={busy}>Choose a file</button>
      </div>

      {how === 'type' ? (
        <label className="field-block">
          <span className="label">Your text</span>
          <textarea className="text-input area learn" rows={10} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type or paste here…" />
        </label>
      ) : (
        <div className="file-pick">
          <label className="drop sketch">
            <input type="file" accept={ACCEPT} onChange={(e) => pick(e.target.files?.[0] ?? null)} disabled={busy} />
            <strong>{file ? file.name : 'Choose a file'}</strong>
            <span className="muted">Text (.txt), PDF (up to {caps?.limits.pdfMB ?? 15} MB), or a photo of a page: PNG, JPEG or WebP (up to {caps?.limits.imageMB ?? 8} MB).</span>
          </label>
          {noServer && <p className="banner">This copy of Lumen is running without its server, so it can only open .txt files and typed text.</p>}
          {kind === 'image' && (
            <>
              <fieldset className="seg" aria-label="What kind of writing is it?">
                <legend className="label">What kind of writing is it?</legend>
                {(['auto', 'printed', 'handwriting'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} disabled={busy}>
                    {m === 'auto' ? 'Not sure' : m === 'printed' ? 'Printed' : 'Handwriting'}
                  </button>
                ))}
              </fieldset>
              {mode !== 'printed' && caps && !caps.handwriting && (
                <p className="banner">Handwriting reading isn't set up on this server (it needs a GROQ_API_KEY). Lumen will try the printed-text reader, which may miss handwritten words. You'll be able to fix the text before reading.</p>
              )}
            </>
          )}
          {preview && kind === 'image' && <img className="file-preview sketch" src={preview} alt={`Preview of ${file?.name}`} />}
          {preview && kind === 'pdf' && <object className="file-preview sketch" data={preview} type="application/pdf" aria-label={`Preview of ${file?.name}`}><p className="muted">PDF preview isn't available in this browser.</p></object>}
        </div>
      )}

      {busy && (
        <div className="processing sketch" role="status" aria-live="polite">
          <Lumo pose="reading" size={80} motion="float" />
          <div>
            <strong>{STAGE_TEXT[progress.stage]}{progress.page ? `: page ${progress.page} of ${progress.pages}` : '…'}</strong>
            <div className="meter"><div className="hatch-leaf" style={{ width: `${Math.round(100 * (progress.stage === 'uploading' ? (progress.fraction ?? 0) * 0.2 : 0.2 + 0.8 * ((progress.page ?? 1) - 0.5) / (progress.pages ?? 1)))}%` }} /></div>
          </div>
          <button type="button" className="btn small" onClick={() => cancelRef.current?.()}>Cancel</button>
        </div>
      )}

      {failure && (
        <div className="banner" role="alert">
          <p style={{ margin: 0 }}>{failure.message}</p>
          <div className="actions" style={{ marginTop: 10 }}>
            {['network', 'failed', 'rate-limited', 'provider'].includes(failure.code) && <button type="button" className="btn small" onClick={() => void run()}>Try again</button>}
            {how === 'file' && <button type="button" className="btn small" onClick={() => { setHow('type'); setFailure(null); }}>Type it instead</button>}
          </div>
        </div>
      )}

      {!busy && (
        <div className="actions">
          <button type="button" className="btn go" onClick={() => void run()} disabled={how === 'file' && (!file || !kind)}>
            {how === 'type' ? 'Next: check the text' : 'Read the text'}
          </button>
        </div>
      )}
    </main>
  );
}

// ======================================================================= Review

const METHOD_TEXT: Record<string, string> = {
  typed: 'typed or pasted',
  'text-file': 'from a text file',
  'embedded-text': 'text inside the PDF',
  'ocr-printed': 'read from the page (printed-text reader)',
  'ocr-handwriting': 'read from the handwriting (AI handwriting reader)',
  unavailable: "couldn't be read",
};

export function ReviewUpload({ id }: { id: string }) {
  const { navigate, back } = useRouter();
  const heading = useFocusHeading();
  const [upload, setUpload] = useState<Upload | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Check the text · Lumen';
    void getUpload(id).then((u) => {
      setUpload(u ?? null);
      if (u) setText(u.confirmed ?? u.raw?.text ?? '');
      if (u && u.kind !== 'txt' && u.kind !== 'text') void uploadFile(u).then((f) => { if (f) setFileUrl(URL.createObjectURL(f)); });
    }, () => setUpload(null));
  }, [id]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const flagged = useMemo(() => (upload?.raw?.pages ?? []).flatMap((p: ExtractedPage) => (p.words ?? []).filter((w) => w.flagged).map((w) => ({ ...w, page: p.page, method: p.method }))), [upload]);

  if (upload === undefined) return <main className="screen"><p className="muted">Opening…</p></main>;
  if (upload === null) {
    return (
      <main className="screen">
        <h1 className="title">This reading isn't here</h1>
        <p>It may have been deleted, or added in a different browser.</p>
        <button type="button" className="btn" onClick={() => navigate('/library?tab=uploads')}>Back to My uploads</button>
      </main>
    );
  }

  const confirm = async () => {
    // The raw transcription is kept untouched; the edited text is saved separately.
    const saved = await saveUpload({ ...upload, confirmed: text });
    void saved;
    navigate(`/library/read/upload/${upload.id}`, { replace: true });
  };

  return (
    <main className="screen review" id="main">
      <button type="button" className="btn small" onClick={() => back('/library?tab=uploads')}><span aria-hidden="true">←</span> Back to Library</button>
      <h1 className="title" tabIndex={-1} ref={heading}>Check the text: {upload.name}</h1>
      <p className="muted">Look at the original and fix anything Lumen read wrongly. Spelling is kept exactly as it was written, so you can see the writer's own spelling.</p>
      {(upload.raw?.warnings ?? []).map((w) => <p key={w} className="banner">{w}</p>)}

      <div className="review-grid">
        <section aria-label="Original">
          <h2 className="hand">Original</h2>
          {upload.kind === 'image' && fileUrl && <img className="file-preview sketch" src={fileUrl} alt={`Original picture: ${upload.name}`} />}
          {upload.kind === 'pdf' && fileUrl && <object className="file-preview sketch tall" data={fileUrl} type="application/pdf" aria-label={`Original PDF: ${upload.name}`}><p className="muted">PDF preview isn't available in this browser.</p></object>}
          {(upload.kind === 'text' || upload.kind === 'txt') && <pre className="raw-text sketch">{upload.raw?.text}</pre>}
          <ul className="methods muted">
            {(upload.raw?.pages ?? []).map((p) => (
              <li key={p.page}>Page {p.page}: {METHOD_TEXT[p.method] ?? p.method}{p.meanConfidence != null ? ` · reader confidence ${p.meanConfidence}%` : ''}</li>
            ))}
          </ul>
        </section>

        <section aria-label="Text to read">
          <h2 className="hand">Text to read</h2>
          {flagged.length > 0 && (
            <div className="flags sticky yellow">
              <strong>Please check {flagged.length === 1 ? 'this word' : 'these words'}:</strong>{' '}
              {flagged.slice(0, 30).map((w, i) => (
                <span key={i} className="flag" title={w.conf != null ? `Reader confidence ${w.conf}%` : 'The two readers disagreed'}>{w.text}</span>
              ))}
              <p className="muted" style={{ margin: '6px 0 0' }}>
                {flagged.some((w) => w.conf != null) ? 'The reader was unsure about these.' : 'The two readers saw these differently.'}
              </p>
            </div>
          )}
          <label>
            <span className="sr-only">Text to read (you can edit it)</span>
            <textarea className="text-input area learn" rows={14} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          </label>
          {text !== (upload.raw?.text ?? '') && (
            <button type="button" className="link" onClick={() => setText(upload.raw?.text ?? '')}>Undo my changes</button>
          )}
        </section>
      </div>

      <div className="actions">
        <button type="button" className="btn go" onClick={() => void confirm()} disabled={!text.trim()}>Confirm text and open reader</button>
      </div>
    </main>
  );
}

// ======================================================================= Reader routes

export function ReadStory({ id }: { id: string }) {
  const { back, navigate } = useRouter();
  const personal = usePersonal();
  const story = getStory(id);
  useEffect(() => { document.title = `${story?.title ?? 'Story'} · Lumen`; }, [story]);
  if (!story) {
    return (
      <main className="screen">
        <h1 className="title">This story isn't here</h1>
        <button type="button" className="btn" onClick={() => navigate('/library')}>Back to Library</button>
      </main>
    );
  }
  return (
    <Reader kind="story" id={story.id} title={story.title} pages={story.pages}
      subtitle={`Level ${story.level}${story.status === 'draft' ? ' · Draft: not reviewed' : ''}`}
      feeling={{ value: personal.feelings[story.id] ?? null, onChange: (f) => void setFeeling(story.id, f) }}
      onBack={() => back('/library')} backLabel="Back to Library" />
  );
}

export function ReadLumoStory({ id }: { id: string }) {
  const { back, navigate } = useRouter();
  const personal = usePersonal();
  const [story, setStory] = useState<LumoStory | null | undefined>(undefined);
  useEffect(() => { void getLumoStory(id).then((s) => setStory(s ?? null), () => setStory(null)); }, [id]);
  if (story === undefined) return <main className="screen"><p className="muted">Opening…</p></main>;
  if (!story) {
    return (
      <main className="screen">
        <h1 className="title">This story isn't here</h1>
        <button type="button" className="btn" onClick={() => navigate('/library')}>Back to Library</button>
      </main>
    );
  }
  return (
    <Reader kind="lumo" id={story.id} title={story.title} pages={story.pages}
      subtitle={`Written by Lumo for you · Level ${story.level}`}
      feeling={{ value: personal.feelings[story.id] ?? story.feeling ?? null, onChange: (f) => void setFeeling(story.id, f) }}
      onBack={() => back('/library')} backLabel="Back to Library" />
  );
}

export function ReadUpload({ id }: { id: string }) {
  const { back, navigate } = useRouter();
  const [upload, setUpload] = useState<Upload | null | undefined>(undefined);
  useEffect(() => { void getUpload(id).then((u) => setUpload(u ?? null), () => setUpload(null)); }, [id]);
  useEffect(() => {
    if (upload && !upload.confirmed) navigate(`/library/review/${upload.id}`, { replace: true });
    if (upload) document.title = `${upload.name} · Lumen`;
  }, [upload, navigate]);
  if (upload === undefined) return <main className="screen"><p className="muted">Opening…</p></main>;
  if (!upload || !upload.confirmed) {
    return (
      <main className="screen">
        <h1 className="title">This reading isn't here</h1>
        <button type="button" className="btn" onClick={() => navigate('/library?tab=uploads')}>Back to My uploads</button>
      </main>
    );
  }
  return (
    <Reader kind="upload" id={upload.id} title={upload.name} pages={readerPages(upload.confirmed)} subtitle="Your reading"
      onBack={() => back('/library?tab=uploads')} backLabel="Back to Library" />
  );
}
