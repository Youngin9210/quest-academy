// A player's home: today's quest, the subject tabs and that subject's missions.
//
// New in lesson 2:
//  - Splitting a screen into components (QuestCard, SubjectTabs, MissionCard).
//  - DERIVED data: `missions` isn't stored anywhere. It's worked out from the player
//    and the selected subject on every draw. Store as little as you can; compute the rest.
//  - Saving a choice on the player (the selected subject) so it's remembered next time.
import type { Player } from '../types';
import { SUBJECTS, themeOf } from '../content';
import { missionsFor } from '../game/missions';
import { dayDiff, today } from '../game/dates';
import { questDoneToday } from '../game/quest';
import { updateState, useSave } from '../store';
import { QuestCard } from '../components/QuestCard';
import { SubjectTabs } from '../components/SubjectTabs';
import { MissionCard } from '../components/MissionCard';

interface Props {
  player: Player;
  onCollection: () => void;
  onSwitchPlayer: () => void;
  onNotYet: () => void;          // for buttons whose screens aren't ported yet
}

export function Home({ player, onCollection, onSwitchPlayer, onNotYet }: Props) {
  const { sound } = useSave();
  const t = themeOf(player.theme);
  const subject = player.subject && SUBJECTS[player.subject] ? player.subject : 'math';
  const missions = missionsFor(player, subject, t.missions);                 // derived
  const found = player.found[player.theme] ?? 0;
  const streak = player.lastDay && dayDiff(player.lastDay, today()) <= 1 ? player.streak : 0;

  // ✏️ YOUR EXERCISE (lesson 2): the "Try me!" tag.
  // Work out which mission she has practiced least, so its card can say "Try me!".
  // `progress(player, id)` (from ../game/progress) gives 0..1 for a mission id.
  // Replace `null` with the id of the mission in `missions` that has the LOWEST progress.
  // (Then look at how it reaches the cards below: tryMe={...}.)
  const suggestedId: string | null = null;

  // Changing saved data: update the copy, never the `player` prop itself.
  const selectSubject = (s: string) => updateState(st => {
    const me = st.profiles.find(p => p.id === player.id);
    if (me) me.subject = s;
  });
  const toggleSound = () => updateState(st => { st.sound = !st.sound; });

  return (
    <div className="stack">
      <div className="topbar">
        <button className="btn ghost small" onClick={onNotYet}>{player.avatar} {player.name} ⚙️</button>
        <div className="chips">
          <span className="chip" title={t.point}>{t.pointIcon} {player.points}</span>
          <span className="chip" title="days in a row">🔥 {streak}</span>
          <button className="chip" aria-label="Sound" aria-pressed={sound} onClick={toggleSound}>{sound ? '🔊' : '🔇'}</button>
        </div>
      </div>

      <div>
        <h1>{t.title}</h1>
        <p className="muted home-sub">
          {questDoneToday(player) ? `Nice work today, ${player.name}! Pick any mission to keep going.` : `Hi ${player.name}! Start with today's quest, or pick any mission.`}
        </p>
      </div>

      <QuestCard player={player} onStart={onNotYet} />
      <SubjectTabs selected={subject} onSelect={selectSubject} />

      <div className="mission-grid">
        {missions.map(m => (
          <MissionCard key={m.id} mission={m} player={player} tryMe={m.id === suggestedId} onStart={onNotYet} />
        ))}
      </div>

      <button className="card coll-card" onClick={onCollection}>
        <span className="coll-head"><b>{t.collection}</b><span className="muted">{found} of {t.collectibles.length} found</span></span>
        <span className="coll-row" aria-hidden="true">
          {t.collectibles.slice(Math.max(0, found - 7), found).map(([e, n]) => <span key={n}>{e}</span>)}
          {found < t.collectibles.length && <span className="next">❔</span>}
        </span>
        <span className="mastery"><i style={{ width: `${Math.round(found / t.collectibles.length * 100)}%` }} /></span>
        <span className="muted coll-hint">{found < t.collectibles.length ? 'Every finished mission finds a new one.' : 'You found them all!'}</span>
      </button>

      <div className="home-foot">
        <button className="btn ghost small" onClick={onSwitchPlayer}>🔄 Switch player</button>
        <button className="btn ghost small" onClick={onNotYet}>👪 Grown-ups</button>
      </div>
    </div>
  );
}
