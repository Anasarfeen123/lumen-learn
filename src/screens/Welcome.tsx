import { useState } from 'react';
import { useLumen } from '../state/store';
import { Lumo } from '../components/Lumo';
import { Bubble } from '../components/ui';
import { Squiggle, Sparkle } from '../components/Doodles';
import { Arrow } from '../components/Icons';
import { GLOWS, type GlowColor } from '../engine/progression';

const B = import.meta.env.BASE_URL;
const GLOW_NAME: Record<GlowColor, string> = { gold: 'Gold', mint: 'Mint', sky: 'Sky', rose: 'Rose' };

export function Welcome() {
  const { profile, update, go } = useLumen();
  const [name, setName] = useState(profile.name);
  const [glow, setGlow] = useState<GlowColor>(profile.glowColor);
  const intro = "Hi! I'm Lumo. I love words. Want to play?";

  const start = (skipName = false) => {
    const clean = skipName ? '' : name.trim().slice(0, 24);
    update((p) => ({
      ...p,
      name: clean,
      glowColor: glow,
      onboarded: true,
      unlocked: p.unlocked.includes(glow) ? p.unlocked : [...p.unlocked, glow],
    }));
    // This tap is the user gesture that unlocks speech; the Hub greets on arrival.
    go({ name: 'hub' });
  };

  return (
    <main className="screen" id="main">
      <div className="topbar">
        <img className="logo" src={`${B}lumo/wordmark.png`} alt="Lumen" />
      </div>
      <div className="welcome">
        <div className="welcome-art">
          <Bubble text={intro} />
          <span className="letter-tile hatch-lav" style={{ left: '6%', top: '34%', transform: 'rotate(-8deg)' }} aria-hidden="true">b</span>
          <span className="letter-tile hatch-yellow" style={{ right: '4%', top: '44%', transform: 'rotate(6deg)', animationDelay: '0.6s' }} aria-hidden="true">d</span>
          <span className="letter-tile hatch-sky" style={{ left: '10%', bottom: '8%', transform: 'rotate(4deg)', animationDelay: '1.2s' }} aria-hidden="true">a</span>
          <span className="letter-tile hatch-blush" style={{ right: '12%', bottom: '4%', transform: 'rotate(-10deg)', animationDelay: '1.8s' }} aria-hidden="true">q</span>
          <Sparkle size={34} style={{ left: '22%', top: '58%' }} />
          <Lumo pose="hero" size={300} glow={glow} label="Lumo the firefly, waving hello" />
        </div>

        <div className="welcome-copy">
          <h1 className="title">Learn<br />differently.</h1>
          <Squiggle />
          <p>Little word games that grow with you. Lumo helps every step of the way, and mistakes are part of learning.</p>
          <div className="notes" aria-label="Promises">
            <span className="sticky yellow tilt-l">no timers, ever</span>
            <span className="sticky lav tilt-r">every word read aloud</span>
            <span className="sticky blush tilt-l">mistakes are okay</span>
          </div>

          <form className="form-card sketch" onSubmit={(e) => { e.preventDefault(); start(); }}>
            <label htmlFor="name">What should Lumo call you?</label>
            <input
              id="name"
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={24}
              placeholder="Your name (you can skip this)"
            />
            <div className="swatches" role="group" aria-label="Lumo's glow">
              <span className="hand" style={{ fontSize: 24, marginRight: 4 }}>Lumo's glow</span>
              {GLOWS.map((g) => (
                <button key={g} type="button" className={`swatch ${g}`} aria-pressed={glow === g} aria-label={GLOW_NAME[g]} onClick={() => setGlow(g)} />
              ))}
            </div>
            <button type="submit" className="btn primary" style={{ width: '100%' }}>
              Let's go! <Arrow size={28} />
            </button>
            <button type="button" className="link" onClick={() => start(true)}>Skip the name</button>
          </form>
          <p className="hand muted" style={{ fontSize: 19, marginTop: 18 }}>
            Designed for dyslexic learners. Enjoyable for everyone. No sign-up.
          </p>
        </div>
      </div>
    </main>
  );
}
