import { useEffect, useState } from 'react';
import { useRouter } from '../router';
import { Modal } from './ui';

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Anywhere',
    keys: [
      ['?', 'Show or hide these shortcuts'],
      ['Alt + 1', 'Playground'],
      ['Alt + 2', 'Library'],
      ['Alt + 3', 'Classroom'],
      ['Alt + 0', 'Start page'],
      ['Alt + S', 'Settings'],
    ],
  },
  {
    title: 'Word games',
    keys: [
      ['1 – 4', 'Choose an answer card'],
      ['Enter', 'Check, try again, or continue'],
      ['Space', 'Hear the word again'],
      ['Letters', 'Type into Word Builder and Syllable Speller'],
      ['Backspace', 'Take back the last letter'],
      ['← →', 'Move between syllable boxes'],
      ['Esc', 'Leave the round'],
    ],
  },
  {
    title: 'Reading',
    keys: [
      ['Tab', 'Go to the story text'],
      ['← → ↑ ↓', 'Move word by word'],
      ['Enter', 'Help with the chosen word'],
      ['Esc', 'Close word help'],
    ],
  },
  {
    title: 'On the map',
    keys: [['Shift + D', 'Load the demo learner (for showing Lumen)']],
  },
];

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
}

/** Global shortcuts, and the "?" help panel that lists every shortcut. */
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const { navigate, openSection } = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const go: Record<string, () => void> = {
        Digit1: () => openSection('playground'),
        Digit2: () => openSection('library'),
        Digit3: () => openSection('classroom'),
        Digit0: () => navigate('/'),
        KeyS: () => navigate('/settings'),
      };
      const action = go[e.code];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, openSection]);

  if (!open) return null;
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setOpen(false)}>
      <h2 className="title" style={{ fontSize: 32 }}>Keyboard shortcuts</h2>
      <div className="shortcut-groups">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="hand">{g.title}</h3>
            <dl>
              {g.keys.map(([k, what]) => (
                <div key={k} className="shortcut"><dt><kbd>{k}</kbd></dt><dd>{what}</dd></div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="actions"><button type="button" className="btn" onClick={() => setOpen(false)}>Close</button></div>
    </Modal>
  );
}
