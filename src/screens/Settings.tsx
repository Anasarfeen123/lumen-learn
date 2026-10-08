import { useEffect, useState, type ReactNode } from 'react';
import { useLumen } from '../state/store';
import { Close } from '../components/Icons';
import { Modal } from '../components/ui';
import { onVoices, speak, speechSupported } from '../services/speech';
import type { Settings as S } from '../state/profile';

export const PRIVACY_LINE =
  "Lumen keeps progress in this browser only. Nothing about your child is sent anywhere, except anonymous practice stats used to write Lumo's tips.";

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
  useEffect(() => onVoices(setVoices), []);

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
        {speechSupported ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="select" value={s.voiceName ?? ''} onChange={(e) => set('voiceName', e.target.value || null)} aria-label="Voice">
              <option value="">Automatic (on-device first)</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>{v.name}{v.localService ? '' : ' (online)'}</option>
              ))}
            </select>
            <button type="button" className="btn small" onClick={() => void speak('Hi! I love words.', { rate: s.voiceRate, voiceName: s.voiceName })}>Test</button>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Your browser can't speak words aloud. Try Chrome or Edge.</p>
        )}
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
