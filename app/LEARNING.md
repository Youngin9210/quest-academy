# Learning React with Quest Academy

We're moving the app to React + TypeScript one screen at a time. The old app (`../app.js`) keeps working the whole time, and the new one reads the same saved progress, so you can compare them side by side.

## Running it

```bash
cd app
npm run dev
```

Open http://localhost:5174 (the old app runs on 5173). Edits show up instantly without a reload; that's Vite's hot reloading.

Progress is saved per address, so 5174 starts empty. Add players in the old app on 5173, or paste test data into the browser console.

`npm run build` type-checks everything and builds `dist/`, the files that will go on the server.

---

## Lesson 1: from HTML strings to components

### What changes

The old app builds each screen as one big HTML string, puts it on the page with `innerHTML`, then finds the buttons and attaches clicks:

```js
render(`<button class="profile" data-id="${p.id}">${esc(p.name)}</button>`);
bindAll('.profile[data-id]', el => { state.current = el.dataset.id; save(); showHome(); });
```

React flips that around. You describe **what the screen should look like for the current data**, and React works out the page changes:

```tsx
<button className="profile" onClick={() => onPick(p.id)}>{p.name}</button>
```

- **No more ids for wiring up clicks.** The click handler sits right on the element.
- **No more `esc()`.** Text in `{...}` is always escaped.
- **No more manual re-rendering.** Change the data, and React re-draws whatever uses it.

### The four ideas in this lesson

| Idea | Where to look | In one line |
|---|---|---|
| **Component** | `screens/Profiles.tsx` | A function that takes props and returns JSX. |
| **Props** | `interface Props` in each screen | A component's inputs. Callbacks like `onPick` are how a child asks its parent to do something. |
| **State** | `useState` in `App.tsx`, `useSave` in `store.ts` | Data that, when it changes, re-draws the components that use it. |
| **Effect** | `useEffect` in `Sky.tsx` | Code that syncs React with things outside React (here `<body data-theme>` and the browser's theme color). |

### How the files fit together

```
main.tsx            starts React, loads ../../style.css (same CSS as the old app)
App.tsx             picks the screen: { name: 'profiles' } | { name: 'home' } | ...
store.ts            the saved state (same localStorage key and shape as the old app)
content.ts          themes and question banks (reuses the old files for now), with types
types.ts            the shapes: Player, Theme, SaveState...
Sky.tsx             world background and particles
screens/*.tsx       one file per screen
```

### Things that trip up people new to React

- **Don't mutate state in place.** `player.points += 5` does nothing visible, because React compares object identity. Always change data through `updateState(s => { ... })`, which works on a copy and hands React a new object (see `store.ts`).
- **A component runs on every re-draw.** Keep it cheap, and wrap random or expensive values in `useMemo` (see the particles in `Sky.tsx`).
- **Hooks (`useState`, `useEffect`, `useSave`...) go at the top of the component,** never inside an `if` or a loop. React tracks them by call order.
- **`<StrictMode>` runs effects twice in development** on purpose, to flush out bugs. It doesn't do that in the built app.

### ✏️ Your exercise

Build the collection screen in `src/screens/Collection.tsx`. The notes at the top of the file list everything you need. To check it, open http://localhost:5174, pick a player and tap the collection card.

**Bonus:** show the number found in the title, like "My Aquarium (6/25)".

When you're done, tell me and I'll review it. Then we move on.

---

## Coming next

1. **Lesson 2: the home screen.** Subject tabs (state inside a component), the mission list, and "derived data": values computed from state, not stored.
2. **Lesson 3: playing a mission.** The game logic moves into plain TypeScript modules with no React in them, and the screen uses `useReducer` for the question flow.
3. **Lesson 4: forms.** New player and settings: controlled inputs and validation.
4. **Lesson 5: the grown-ups lock and sync.** Async code (`fetch`) in effects, loading and error states.
5. **Lesson 6: typing and Word Blaster.** Keyboard events and animation with `requestAnimationFrame` and refs.
6. **Lesson 7: shipping it.** The build step, the offline service worker, deploy, and the switch-over.
