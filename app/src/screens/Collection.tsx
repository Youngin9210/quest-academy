// The collection screen ("Alien Logbook", "My Aquarium", ...): every collectible in the
// player's world, with the ones she hasn't found yet shown dark as "???".
// (Lesson 1 exercise, written by Kyle.)
import type { Player } from '../types';
import { themeOf } from '../content';

interface Props { player: Player; onBack: () => void }

export function Collection({ player, onBack }: Props) {
  const theme = themeOf(player.theme);
  const found = player.found[player.theme] ?? 0;
  return (
    <>
      <div className="topbar"><button className="btn ghost small" onClick={onBack}>← Back</button></div>
      <h1>{theme.collection}</h1>
      <p className="muted">{found} of {theme.collectibles.length} found</p>
      <div className="collection">
        {theme.collectibles.map(([emoji, name], i) => {
          const isFound = i < found;
          return (
            <div className={isFound ? 'collect' : 'collect locked'} key={name}>
              <span className="e">{emoji}</span>
              <span className="n">{isFound ? name : '???'}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
