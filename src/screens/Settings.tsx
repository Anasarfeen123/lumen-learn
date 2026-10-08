import { useEffect, useState, type ReactNode } from 'react';
import { useLumen } from '../state/store';
import { Close } from '../components/Icons';
import { Modal } from '../components/ui';
import { deviceSpeechSupported, loadStatus, onDeviceVoices, speak, activeEngine } from '../services/speech';
import { useLumoStatus } from '../services/useLumoStatus';
import type { Settings as S } from '../state/profile';

export const PRIVACY_LINE =
  "Lumen keeps progress in this browser only. Nothing about your child is sent anywhere, except anonymous practice stats used to write Lumo's tips. With the natural voice on, Lumo's own lines are turned into speech online; your child's name is always left out.";

const VOICE_LABEL: Record<string, string> = {
  hannah: 'Hannah', autumn: 'Autumn', diana: 'Diana', austin: 'Austin', daniel: 'Daniel', troy: 'Troy',
};
const TERMS_URL = 'https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english';

function Seg<T extends string | number | boolean>({ value, options, onChange, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export function Settings() {
  const { profile, update, go, reset, storageOk } = useLumen();
  const s = profile.settings;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [checking, setChecking] = useState(false);
  const { status } = useLumoStatus();
  useEffect(() => onDeviceVoices(setVoices), []);
  const natural = status?.tts.state === 'ready';
  const recheck = async () => {
    setChecking(true);
    await loadStatus(true);
    setChecking(false);
  };
  const test = () => void speak("Hi! I'm Lumo. Let's light up some words.", { rate: s.voiceRate, style: 'lumo' });

  const set = <K extends keyof S>(key: K, value: S[K]) =>
    update((p) => ({ ...p, settings: { ...p.settings, [key]: value } }));

  return (
    <main className="screen settings" id="main">
      <div className="topbar">
        <button type="button" className="icon-btn plain" onClick={() => go({ name: 'hub' })} aria-label="Back to the map"><Close size={30} /></button>
        <h1 className="title" style={{ fontSize: 44 }}>Settings</h1>
      </div>
      {!storageOk && <p className="banner" role="status">Progress won't be saved in this browser.</p>}

      <Field label="Text size">
        <Seg label="Text size" value={s.size} onChange={(v) => set('size', v)} options={[['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra large']]} />
      </Field>
      <Field label="Font">
        <Seg label="Font" value={s.font} onChange={(v) => set('font', v)} options={[['lexend', 'Lexend'], ['opendyslexic', 'OpenDyslexic'], ['atkinson', 'Atkinson Hyperlegible']]} />
        <p className="learn" style={{ margin: '10px 0 0', fontSize: 'calc(26px * var(--learn-scale))' }}>friend · because · butterfly</p>
      </Field>
      <Field label="Background">
        <Seg label="Background" value={s.theme} onChange={(v) => set('theme', v)} options={[['cream', 'Cream'], ['blue', 'Soft blue'], ['green', 'Soft green'], ['dark', 'Dark']]} />
      </Field>
      <Field label="Voice speed">
        <Seg label="Voice speed" value={s.voiceRate} onChange={(v) => set('voiceRate', v)} options={[[0.85, 'Slow'], [1, 'Normal']]} />
      </Field>
      <Field label="Voice">
        <Seg label="Voice" value={s.voiceEngine} onChange={(v) => set('voiceEngine', v)}
          options={[['auto', 'Best available'], ['natural', 'Natural (online)'], ['device', 'This device']]} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          {s.voiceEngine !== 'device' && (
            <select className="select" value={s.naturalVoice} onChange={(e) => set('naturalVoice', e.target.value)} aria-label="Natural voice">
              {(status?.tts.voices ?? Object.keys(VOICE_LABEL)).map((v) => <option key={v} value={v}>{VOICE_LABEL[v] ?? v}</option>)}
            </select>
          )}
          {s.voiceEngine === 'device' && deviceSpeechSupported && (
            <select className="select" value={s.voiceName ?? ''} onChange={(e) => set('voiceName', e.target.value || null)} aria-label="Device voice">
              <option value="">Best on this device</option>
              {voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          )}
          <button type="button" className="btn small" onClick={test}>Test</button>
        </div>
        <p className="privacy" style={{ margin: '8px 0 0' }} role="status">
          Speaking with: {activeEngine() === 'natural' ? `natural voice (${VOICE_LABEL[s.naturalVoice] ?? s.naturalVoice})` : activeEngine() === 'device' ? "this device's voice" : 'no voice available. Try Chrome or Edge'}.
        </p>
      </Field>
      <Field label="Lumo's AI">
        <AiStatus status={status} natural={natural} checking={checking} onRecheck={() => void recheck()} />
      </Field>
      <Field label="Sound effects">
        <Seg label="Sound effects" value={s.sfx} onChange={(v) => set('sfx', v)} options={[[true, 'On'], [false, 'Off']]} />
      </Field>
      <Field label="Motion">
        <Seg label="Motion" value={s.motion} onChange={(v) => set('motion', v)} options={[['system', 'Like my device'], ['full', 'Full'], ['reduced', 'Reduced']]} />
      </Field>
      <Field label="Progress">
        <button type="button" className="btn small" onClick={() => setConfirm(true)}>Reset progress</button>
      </Field>

      <p className="privacy" style={{ marginTop: 24 }}>{PRIVACY_LINE}</p>

      {confirm && <ResetConfirm onCancel={() => setConfirm(false)} onConfirm={reset} />}
    </main>
  );
}

function AiStatus({ status, natural, checking, onRecheck }: {
  status: ReturnType<typeof useLumoStatus>['status']; natural: boolean; checking: boolean; onRecheck: () => void;
}) {
  if (!status) {
    return <p className="privacy" style={{ margin: 0 }}>Not connected. Run Lumen with <code>npm run dev</code> or <code>npm start</code> to use AI tips and the natural voice.</p>;
  }
  return (
    <div className="privacy" style={{ display: 'grid', gap: 6 }}>
      <span>Tips and summaries: {status.ai ? `on (Groq · ${status.model})` : 'off. Add GROQ_API_KEY to the .env file, then restart.'}</span>
      <span>
        Natural voice: {natural ? 'ready' : status.tts.state === 'needs-terms'
          ? <>needs one step. A Groq admin must accept the voice model's terms <a href={TERMS_URL} target="_blank" rel="noreferrer">here</a>, then press Check again.</>
          : status.tts.state === 'off' ? 'off (needs GROQ_API_KEY).' : `unavailable${status.tts.message ? ` (${status.tts.message})` : ''}.`}
      </span>
      <span><button type="button" className="btn small" onClick={onRecheck} disabled={checking}>{checking ? 'Checking…' : 'Check again'}</button></span>
    </div>
  );
}

export function ResetConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title="Reset progress?" onClose={onCancel}>
      <h2 className="title" style={{ fontSize: 34 }}>Reset progress?</h2>
      <p>This clears Lumo's notes, XP, stars and unlocks in this browser. Settings stay. It can't be undone.</p>
      <div className="actions">
        <button type="button" className="btn" onClick={onCancel}>Keep progress</button>
        <button type="button" className="btn amber" onClick={onConfirm}>Reset</button>
      </div>
    </Modal>
  );
}
