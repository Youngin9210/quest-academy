// "Who's playing today?" — the first screen.
//
// A component is a function that takes PROPS (its inputs) and returns JSX
// (what to draw). It never touches the page itself: to change something it
// calls a function it was given (onPick) or updates the shared state.
import { useSave } from '../store';
import { themeOf } from '../content';

interface Props {
  onPick: (playerId: string) => void;
  onNewPlayer: () => void;
  onGrownUps: () => void;
}

export function Profiles({ onPick, onNewPlayer, onGrownUps }: Props) {
  const save = useSave();   // re-draws this screen whenever the saved state changes

  return (
    <>
      <div className="hero stack">
        <div className="big">🚀🐠🐶🧁</div>
        <h1>Quest Academy</h1>
        <p className="muted" style={{ fontSize: '1.2rem' }}>Who's playing today?</p>
      </div>

      <div className="profile-grid" style={{ marginTop: 20 }}>
        {/* A list: map each player to a button. `key` lets React tell items apart between draws. */}
        {save.profiles.map(p => {
          const t = themeOf(p.theme);
          return (
            <button key={p.id} className="profile" onClick={() => onPick(p.id)}>
              <span className="av">{p.avatar}</span>{p.name}
              <small>{t.icon} {t.name}</small>
            </button>
          );
        })}
        <button className="profile add" onClick={onNewPlayer}><span className="av plus">+</span>New player</button>
      </div>

      <div className="row-actions" style={{ marginTop: 28 }}>
        <button className="btn ghost small" onClick={onGrownUps}>👪 Grown-ups</button>
      </div>
    </>
  );
}
