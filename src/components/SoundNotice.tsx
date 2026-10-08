import { useEffect, useState } from 'react';
import { onSoundProblem, type SoundProblem } from '../services/speech';
import { useRouter } from '../router';
import { Speaker } from './Icons';

/** A small, honest notice when Lumo can't make sound, with what to do about it. */
export function SoundNotice() {
  const [problem, setProblem] = useState<SoundProblem>(null);
  const [hidden, setHidden] = useState(false);
  const { navigate } = useRouter();
  useEffect(() => onSoundProblem((p) => { setProblem(p); setHidden(false); }), []);
  if (!problem || hidden) return null;
  return (
    <div className="sound-notice sketch" role="status">
      <Speaker size={22} />
      {problem === 'blocked'
        ? <span>Tap anywhere to let Lumo speak. Browsers wait for a tap before playing sound.</span>
        : <span>This browser couldn't make Lumo's voice. Try Chrome or Edge, or set up a natural voice in <button type="button" className="link inline" onClick={() => navigate('/settings')}>Settings</button>.</span>}
      <button type="button" className="link inline" onClick={() => setHidden(true)}>OK</button>
    </div>
  );
}
