import { useEffect, useState } from 'react';
import { useLumen } from '../state/store';
import { useRouter } from '../router';
import { Lumo } from '../components/Lumo';
import { getPlan, stepPath, usePersonal, type Candidate, type Plan } from './personal';

/** "Lumo's plan for you": two or three next steps chosen for this learner, each with a reason. */
export function PlanCard() {
  const { profile } = useLumen();
  const personal = usePersonal();
  const { navigate } = useRouter();
  const [state, setState] = useState<{ plan: Plan; candidates: Candidate[] } | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void getPlan(profile, personal).then((r) => { if (alive) setState(r); });
    return () => { alive = false; };
    // Re-plan when skills, mistakes or interests change, not on every XP tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personal, JSON.stringify(profile.mastery), Object.keys(profile.mistakes).length]);

  if (state === null) return null; // no server: the rest of the Classroom still guides
  return (
    <section className="side-card soft plan-card" aria-labelledby="plan-h" aria-busy={state === undefined}>
      <h2 id="plan-h" className="side-title">Lumo's plan for you</h2>
      {state === undefined ? (
        <div className="plan-loading">
          <p className="muted"><Lumo pose="loading" size={44} motion="none" /> Lumo is thinking…</p>
          {[0, 1, 2].map((i) => <span key={i} className="shimmer" style={{ width: `${92 - i * 14}%` }} aria-hidden="true" />)}
        </div>
      ) : (
        <>
          <p className="plan-greeting">{state.plan.greeting}</p>
          <ol className="plan-steps">
            {state.plan.steps.map((s, i) => {
              const c = state.candidates.find((x) => x.id === s.id);
              if (!c) return null;
              return (
                <li key={s.id}>
                  <button type="button" className="plan-step" onClick={() => navigate(stepPath(s.id))}>
                    <span className="plan-num" aria-hidden="true">{i + 1}</span>
                    <span><b>{c.label}</b><span className="muted">{s.why}</span></span>
                  </button>
                </li>
              );
            })}
          </ol>
          {!personal.interests.length && (
            <button type="button" className="link small-link" onClick={() => navigate('/me')}>Tell Lumo what you like →</button>
          )}
        </>
      )}
    </section>
  );
}
