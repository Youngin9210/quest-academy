# Stop games (adventure part 2): design

Date: 2026-11-18. Status: approved in conversation; the user still needs to review this written spec.

## Goal

The adventure map (part 1) turned missions into stops on a path, but each stop is still a plain list of questions. Part 2 puts a small game scene above the questions at each map stop. Each answer is one move in that game: a right answer adds a piece, takes a step or grabs a treasure. The questions themselves don't change.

## Decisions

- **Untimed.** The scene never moves on its own and there is no clock. Reading passages and slow thinking are fine.
- **Three game types, drawn in each world's style.** Stops rotate through them.
- **A miss gets a gentle stumble.** Nothing is lost or taken back.
- **Map stops only.** Free practice, Today's Quest and the boss stay as they are. The boss keeps its hit bar.
- **The result shows on the map.** Each finished stop gets a small drawing of what she built or collected.

## The games

Each stop has 6 questions, so each game has 6 moves.

| Game | What a move does | space | ocean | pets | bakery |
|---|---|---|---|---|---|
| **Build** | adds 1 of 6 pieces, bottom to top | rocket | sandcastle | doghouse | layer cake |
| **Journey** | the creature token hops 1 of 6 steps toward a goal | over craters to a flag | past kelp to a treasure chest | along a park path to a picnic blanket | across stepping stones to a gingerbread house |
| **Collect** | a treasure drops into a bag with 6 slots | star crystals | pearls | bones | cherries |

- **Which game:** it comes from the stop's position, `i % 3`: 0 Build, 1 Journey, 2 Collect. So stops 1 and 4 are Build, 2 and 5 Journey, and 3 Collect. A replay of a stop plays the same game.
- **Typing stops** keep their typing lesson, with no scene.
- **The creature token** (the same drawing as on the map, `tokenSvg(look)`) stands in every scene. In Build and Collect it stands beside the build or the bag and does a small cheer on each move. In Journey it is the thing that moves.

## Moves

A move happens each time the question count (`game.n`) goes up, so a stop always ends with all 6 moves made:

- **First-try right answer:** the move plays with a short sparkle, and the new piece, step or treasure is **gold**.
- **Right after a miss, or after the answer is shown** (Next →): the move plays without the sparkle, and the piece is **plain**, in the world's normal colors.
- **A miss** (before the question is over): the scene reacts without changing. In Build the next piece bounces off; in Journey the token wobbles at the edge; in Collect the treasure bounces off the bag. Nothing is lost.
- **Questions that come back** (the retry pool) count like any other question.
- **Reduced motion:** pieces just appear, and wobbles and bounces are skipped.
- **Screen readers:** the scene has `role="img"` and an aria-label that updates, such as "Rocket: 3 of 6 pieces" or "Journey: 4 of 6 steps."

## Where it goes on the question screen

- At a map stop, the scene strip (about 140px tall, the full card width) takes the place of the progress meter. The `n / 6` chip in the top bar stays.
- It is drawn with SVG in the world's colors, using the same sky and palette as that world's map.
- `drawPlay` draws each question from scratch, so the scene is drawn from its state (the moves so far) every time. Only the newest move is animated, in place, before the next question is drawn. The boss bar already works this way (`bossBarHtml` and `bossReact`).
- **Phones:** the strip shrinks to about 110px so the question and pad still fit.

## On the map

- Each finished stop gets a small drawing beside its marker (about 36px):
  - **Build:** the finished build;
  - **Journey:** a planted flag in the world's colors;
  - **Collect:** a full bag.
- The drawing is **gold when the stop has 3 stars**. A replay that raises the stars to 3 turns it gold.
- The marker's aria-label doesn't change. The drawing is decorative (`aria-hidden`).

## Data

Nothing new is saved:
- the game type comes from the stop's position;
- gold on the map comes from the stars already saved;
- moves during a stop live only on `game` (`game.moves = ['gold' | 'plain', …]`).

Sync, merging and older saved data are not affected.

## Code

- **`scenes.js` (new ES module).** It is loaded with a dynamic `import()` when a stop starts, like `adventure.js`, with `ASSET_Q` cache busting. It exports:
  - `sceneHtml({ type, world, token, moves, fresh })`: the scene's markup for the moves so far (`token` is the creature token's SVG from `adventure.js`; `fresh` marks the newest move to animate).
  - `sceneMove(el, opts, kind)`: redraws the scene inside `el` with the newest move animated (`kind` is `'gold'` or `'plain'`), or plays the miss reaction (`kind` is `'miss'`).
  - `trophySvg(type, world, gold)`: the small drawing for the map.
  - `sceneLabel(type, world, count)`: the aria-label text.
- **`adventure-rules.js`.** Adds `SCENES = ['build', 'journey', 'collect']`, `sceneFor(i)` (returns `SCENES[i % 3]`) and `trophyGold(stars)` (true at 3). These have Node tests.
- **`app.js`:**
  - `startStop` loads `scenes.js` and sets `game.scene = sceneFor(i)` and `game.moves = []`. If the module fails to load, the stop plays with the plain progress meter.
  - `drawPlay` draws the scene strip in place of the meter when `game.scene` is set.
  - A `sceneStep(kind)` hook runs:
    - next to `bossReact`, from `answeredRight` (gold or plain);
    - from the "Next →" handlers (plain);
    - from the miss paths (miss).
  - `drawMap` gets each finished stop's trophy.
- **`adventure.js`:** `drawMap` places the trophy beside a finished marker when one is given.
- **`style.css`:** the scene strip, the sparkle, the bounce, the wobble, the trophy position, and the reduced-motion overrides.
- **`sw.js`:** add `scenes.js` to CORE and bump the cache to `quest-academy-v9`.

## Out of scope

- Time pressure, and tapping answers inside the scene.
- Scenes in Free practice, Today's Quest or the boss.
- New questions or question types.
- Sound beyond the existing sfx, and any read-aloud.
- Family rewards (still parked).

## Testing

- **Node:**
  - `sceneFor` for positions 0–5;
  - `trophyGold` at 0–3 stars.
- **Preview:**
  - all 3 games in all 4 worlds, at phone (375px) and iPad widths;
  - a first-try answer (gold), a miss then a right answer (plain), and a second miss that shows the answer, then Next (plain);
  - a typing stop has no scene;
  - the boss, Free practice and Today's Quest are unchanged;
  - trophies on the map, and a replay that raises a stop to 3 stars turns its trophy gold;
  - reduced motion;
  - `scenes.js` blocked: the stop still plays with the meter;
  - no console errors.
- **Live after deploy:** one stop of each game on a girl's iPad.
