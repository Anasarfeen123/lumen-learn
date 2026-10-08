import { useLumen } from '../state/store';
import { Lumo, Hat } from '../components/Lumo';
import { Close } from '../components/Icons';
import { GLOWS, HATS, UNLOCK_LABEL, stageUnlocking, type GlowColor, type HatId } from '../engine/progression';

/** Lumo's closet: equip unlocked hats and glows, with a live preview. */
export function Closet() {
  const { profile, update, go } = useLumen();
  const has = (id: string) => (profile.unlocked as string[]).includes(id);

  const wearHat = (hat: HatId | null) => update((p) => ({ ...p, equipped: { hat } }));
  const wearGlow = (glowColor: GlowColor) => update((p) => ({ ...p, glowColor }));

  return (
    <main className="screen" id="main" style={{ maxWidth: 900 }}>
      <div className="topbar">
        <button type="button" className="icon-btn plain" onClick={() => go({ name: 'hub' })} aria-label="Back to the map"><Close size={30} /></button>
        <h1 className="title" style={{ fontSize: 44 }}>Lumo's closet</h1>
      </div>
      <div style={{ display: 'grid', placeItems: 'center', margin: '20px 0' }}>
        <Lumo pose="float" size={200} label="Lumo wearing the current outfit" />
      </div>

      <h2 className="title" style={{ fontSize: 30 }}>Hats</h2>
      <div className="closet-grid">
        <button type="button" className="closet-item sketch" aria-pressed={profile.equipped.hat === null} onClick={() => wearHat(null)}>
          <span style={{ height: 50, display: 'grid', placeItems: 'center', fontSize: 30 }} aria-hidden="true">—</span>
          <span className="name">No hat</span>
        </button>
        {HATS.map((h) => {
          const open = has(h);
          return (
            <button key={h} type="button" className={`closet-item sketch ${open ? '' : 'locked'}`} disabled={!open}
              aria-pressed={profile.equipped.hat === h} onClick={() => wearHat(h)}>
              <span style={{ width: 70 }}><Hat id={h} standalone /></span>
              <span className="name">{UNLOCK_LABEL[h]}</span>
              {!open && <span className="need">Unlocks at {stageUnlocking(h).name}</span>}
            </button>
          );
        })}
      </div>

      <h2 className="title" style={{ fontSize: 30, marginTop: 30 }}>Glow colors</h2>
      <div className="closet-grid">
        {GLOWS.map((g) => {
          const open = has(g);
          return (
            <button key={g} type="button" className={`closet-item sketch ${open ? '' : 'locked'}`} disabled={!open}
              aria-pressed={profile.glowColor === g} onClick={() => wearGlow(g)}>
              <span className={`swatch ${g}`} style={{ display: 'inline-block' }} aria-hidden="true" />
              <span className="name">{UNLOCK_LABEL[g]}</span>
              {!open && <span className="need">Unlocks at {stageUnlocking(g).name}</span>}
            </button>
          );
        })}
      </div>
    </main>
  );
}
