// The player's home. For now only the pieces lesson 1 needs; the subject tabs,
// missions and Daily Quest arrive in the next lessons.
import type { Player } from '../types';
import { themeOf } from '../content';

interface Props { player: Player; onCollection: () => void; onSwitchPlayer: () => void }

export function Home({ player, onCollection, onSwitchPlayer }: Props) {
  const t = themeOf(player.theme);
  const found = player.found[player.theme] ?? 0;
  return (
    <div className="stack">
      <div className="topbar">
        <span className="chip">{player.avatar} {player.name}</span>
        <span className="chip">{t.pointIcon} {player.points}</span>
      </div>
      <div>
        <h1>{t.title}</h1>
        <p className="muted home-sub">Hi {player.name}! The missions are coming in the next lessons.</p>
      </div>
      <button className="card coll-card" onClick={onCollection}>
        <span className="coll-head"><b>{t.collection}</b><span className="muted">{found} of {t.collectibles.length} found</span></span>
        <span className="mastery"><i style={{ width: `${Math.round(found / t.collectibles.length * 100)}%` }} /></span>
      </button>
      <div className="home-foot">
        <button className="btn ghost small" onClick={onSwitchPlayer}>🔄 Switch player</button>
      </div>
    </div>
  );
}
