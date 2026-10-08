import { useMemo } from 'react';
import { useRouter } from '../router';
import { useLumen } from '../state/store';
import { Lumo } from '../components/Lumo';
import { Lock, Flame, Star } from '../components/Icons';
import { BADGES, earnedBadges, milestones } from '../engine/badges';
import { storiesFinished } from '../library/progress';
import { activePath } from '../state/profile';
import { courseOf } from '../engine/courses';
import { UNIT_SIZE } from '../engine/practice';
import { SkillChips, ProgressRing } from './Hub';

const B = import.meta.env.BASE_URL;

/** Overview of progress, and achievements (badges and milestones). */
export function ProgressPage() {
  const { profile } = useLumen();
  const { location, navigate, back } = useRouter();
  const tab = location.query.get('tab') === 'achievements' ? 'achievements' : 'overview';
  const ctx = useMemo(() => ({ storiesFinished: storiesFinished() }), []);
  const earned = useMemo(() => earnedBadges(profile, ctx), [profile, ctx]);
  const path = activePath(profile);
  const course = courseOf(profile.activeCourse);
  const lessonsDone = path.filter((n) => n.kind !== 'chest').length;
  const unitDone = path.length % UNIT_SIZE;
  const stars = Object.values(profile.courses).flat().reduce((s, n) => s + (n && 'stars' in n ? n.stars : 0), 0);

  return (
    <main className="screen progress-page" id="main">
      <div className="section-head">
        <div>
          <button type="button" className="btn small" onClick={() => back('/classroom')}><span aria-hidden="true">←</span> Back to Classroom</button>
          <h1 className="title" tabIndex={-1}>Your progress</h1>
        </div>
        <Lumo pose="love" size={100} motion="float" />
      </div>
      <div className="subtabs" role="tablist" aria-label="Progress">
        <button role="tab" type="button" aria-selected={tab === 'overview'} className={tab === 'overview' ? 'on' : ''} onClick={() => navigate('/classroom/progress', { replace: true })}>Overview</button>
        <button role="tab" type="button" aria-selected={tab === 'achievements'} className={tab === 'achievements' ? 'on' : ''} onClick={() => navigate('/classroom/progress?tab=achievements', { replace: true })}>Achievements</button>
      </div>

      {tab === 'overview' ? (
        <div className="progress-grid">
          <section className="side-card soft">
            <div className="ring-row">
              <ProgressRing value={unitDone / UNIT_SIZE} />
              <div><span className="big-num">{unitDone} / {UNIT_SIZE}</span><span className="muted">lessons in this unit of {course.title}</span></div>
            </div>
          </section>
          <section className="stat-pair">
            <div className="side-card soft stat"><Star size={30} /><span className="big-num">{stars}</span><span className="muted">stars earned</span></div>
            <div className="side-card soft stat"><Flame size={30} /><span className="big-num">{profile.streak.days}</span><span className="muted">day streak</span></div>
            <div className="side-card soft stat"><span className="big-num">{lessonsDone}</span><span className="muted">lessons done</span></div>
            <div className="side-card soft stat"><span className="big-num">{profile.wordsLearned}</span><span className="muted">words right first time</span></div>
          </section>
          <section className="side-card soft">
            <h2 className="side-title">Skills you're building</h2>
            <SkillChips />
          </section>
          <section className="keep-going">
            <div>
              <h2 className="title">Keep going!</h2>
              <p>Every step you take helps you grow.</p>
              <button type="button" className="btn primary small" onClick={() => navigate('/classroom')}>Back to my lessons</button>
            </div>
            <Lumo pose="goodbye" size={110} motion="float" />
          </section>
        </div>
      ) : (
        <>
          <h2 className="side-title">Your badges <span className="muted">{earned.length} / {BADGES.length}</span></h2>
          <ul className="badges">
            {BADGES.map((b) => {
              const has = earned.includes(b.id);
              return (
                <li key={b.id} className={`badge ${has ? 'earned' : 'locked'}`}>
                  <span className="badge-art">
                    <img src={`${B}pictures/icons/badge-${b.id}.png`} alt="" />
                    {!has && <span className="badge-lock" aria-hidden="true"><Lock size={18} /></span>}
                  </span>
                  <strong>{b.title}</strong>
                  <span className="muted small-note">{has ? 'Earned!' : b.how}</span>
                </li>
              );
            })}
          </ul>
          <h2 className="side-title" style={{ marginTop: 26 }}>Milestones</h2>
          <ul className="milestones">
            {milestones(profile, ctx).map((m) => (
              <li key={m.title} className="side-card soft milestone">
                <span>{m.title}</span>
                <span className="progress mini wide"><div className="hatch-leaf" style={{ width: `${(m.value / m.target) * 100}%` }} /></span>
                <span className="muted">{m.value} / {m.target}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
