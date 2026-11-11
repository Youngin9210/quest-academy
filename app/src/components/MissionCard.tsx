// One mission tile. A small component that only knows what it's given: this is
// how you split a big screen into pieces you can read (and reuse) one at a time.
import type { Player } from '../types';
import type { MissionCardInfo } from '../game/missions';
import { POOLS, bestLessonRun, learnedCount, progress, showPct } from '../game/progress';

interface Props {
  mission: MissionCardInfo;
  player: Player;
  tryMe?: boolean;            // optional prop (note the ?): shows the "Try me!" tag
  onStart: (missionId: string) => void;
}

export function MissionCard({ mission, player, tryMe = false, onStart }: Props) {
  const pct = showPct(progress(player, mission.id));
  return (
    <button className="mission" onClick={() => onStart(mission.id)}>
      {/* `cond && <x/>` draws <x/> only when cond is true */}
      {tryMe && <span className="tag">Try me!</span>}
      <span className="icon">{mission.icon}</span>
      <span className="name">{mission.name}</span>
      <span className="desc">{mission.desc}</span>
      <span className="mastery-label">{label(player, mission.id, pct)}</span>
      <span className="mastery"><i style={{ width: `${pct}%` }} /></span>
    </button>
  );
}

// Plain helper function: not a component, just returns a string.
function label(p: Player, id: string, pct: number): string {
  if (id === 'type-game') return p.typeHigh ? `🏆 Your best: ${p.typeHigh.toLocaleString()}` : 'No high score yet';
  if (id.startsWith('type-')) { const b = bestLessonRun(p, id); return b ? `⚡ Best: ${b.wpm} WPM` : 'Not played yet'; }
  if (POOLS[id]) return `${learnedCount(p, id)} facts learned · ${pct}%`;
  return `${pct}% mastered`;
}
