// ✏️ YOUR EXERCISE (lesson 1): the collection screen ("Alien Logbook", "My Aquarium", ...).
//
// The old app's version is showCollection() in ../../app.js (search for "/* ----- Collection").
// Rebuild it here in React. Everything you need:
//   - `player` and `onBack` arrive as props (see Props below).
//   - themeOf(player.theme) gives the world: .collection is the title,
//     .collectibles is a list of [emoji, name] pairs.
//   - player.found[player.theme] is how many she has found (may be undefined, so treat that as 0).
//   - The CSS already exists: a "topbar" with a "btn ghost small" Back button, an <h1>,
//     a <p className="muted"> "N of 25 found", then a div "collection" holding one
//     div "collect" per item (add "locked" when not found yet) with
//     <span className="e">{emoji}</span><span className="n">{name or ???}</span>.
//
// Hints: `className` instead of `class`; `{cond ? a : b}` inside JSX; `.map()` for the list
// with a `key`. In JSX, text is escaped for you, so no esc() needed.
// When you're done, open the app, pick a player and tap the collection card at the bottom.
import type { Player } from '../types';
import { themeOf } from '../content';

interface Props { player: Player; onBack: () => void }

export function Collection({ player, onBack }: Props) {
  const theme = themeOf(player.theme);
  // TODO: replace this placeholder with the real screen
  return (
    <>
      <div className="topbar"><button className="btn ghost small" onClick={onBack}>← Back</button></div>
      <h1>{theme.collection}</h1>
      <p className="muted">TODO: build me (see the notes at the top of Collection.tsx)</p>
    </>
  );
}
