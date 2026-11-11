// The app shell: decides WHICH screen to show.
//
// `screen` is component state (useState). Calling setScreen(...) makes React
// re-draw App with the new value. The type below lists every screen, so
// TypeScript makes sure we handle each one.
import { useState } from 'react';
import { currentPlayer, updateState, useSave } from './store';
import { Sky } from './Sky';
import { Profiles } from './screens/Profiles';
import { Home } from './screens/Home';
import { Collection } from './screens/Collection';

type Screen = { name: 'profiles' } | { name: 'home' } | { name: 'collection' };

export function App() {
  const save = useSave();
  const player = currentPlayer(save);
  const [screen, setScreen] = useState<Screen>(player ? { name: 'home' } : { name: 'profiles' });

  const pick = (id: string) => { updateState(s => { s.current = id; }); setScreen({ name: 'home' }); };
  const switchPlayer = () => { updateState(s => { s.current = null; }); setScreen({ name: 'profiles' }); };
  const notYet = () => alert('Not built in the React version yet: coming in a later lesson.');

  // Screens that need a player fall back to the profiles screen when there isn't one.
  const view = (() => {
    if (screen.name === 'profiles' || !player) return <Profiles onPick={pick} onNewPlayer={notYet} onGrownUps={notYet} />;
    switch (screen.name) {
      case 'home': return <Home player={player} onCollection={() => setScreen({ name: 'collection' })} onSwitchPlayer={switchPlayer} onNotYet={notYet} />;
      case 'collection': return <Collection player={player} onBack={() => setScreen({ name: 'home' })} />;
    }
  })();

  return (
    <>
      <Sky themeId={screen.name !== 'profiles' && player ? player.theme : 'space'} />
      <main id="app">{view}</main>
    </>
  );
}
