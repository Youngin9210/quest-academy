# Adventure map: design

Date: 2026-11-17. Status: approved in conversation, waiting for the user to review the written spec.

## Goal

Quest Academy still feels like a quiz: pick a subject, pick a mission, answer questions, get rewards afterward. This project gives each kid a journey to play through. Her home screen becomes a drawn map of her world, where missions are stops on a path, regions end in a boss, and her creature travels with her.

This is part 1 of 2. Part 2 (a separate spec, later) makes the action happen inside regular stops, where a right answer is the move in a small game, the way Word Blaster already works for typing. In part 1 the boss's hit bar is the only action layer.

## Shape of the adventure

- **Worlds:** the four existing themes (`space`, `ocean`, `pets`, `bakery`). She starts in her own theme's world.
- **Regions:** each world has 6 regions. Each region has a name and a one- or two-line problem:

| World | Regions, in order |
|---|---|
| space | Launch Pad, Moon Base, Asteroid Belt, Ring Planet, Comet Trail, Star Gate |
| ocean | Sunny Shallows, Kelp Forest, Coral City, Shipwreck Cove, Deep Trench, Pearl Palace |
| pets | Puppy Park, Kitten Corner, Bunny Burrows, Pony Meadow, Parrot Peaks, Royal Pet Show |
| bakery | Flour Mill, Cookie Kitchen, Cupcake Lane, Pie Parlor, Candy Castle, Grand Cake Fair |

  Example problems: Moon Base, "The Moon Base lights are out! Fix 5 machines to turn them on." Each region gets one problem line and one win line ("The Moon Base lights are on!"), written as part of the build, short and plain, for 2nd–5th graders reading on their own.
- **Stops:** each region has 5 stops, then a boss.
- **Bonus:** a Today's Quest stop beside the path, once a day.
- **Pace:** about 36 stops per world, or 2–3 weeks at two stops a day.
- **World complete:** after the 6th boss, a celebration, then "Pick your next world" from the worlds not finished yet. Her theme (home colors, avatar) does not change. Once all four worlds are done, she can replay any world from region 1, with stars reset for that run.

## Stops

- A stop is one short mission in one subject: 6 questions, using the existing question engine (the same screens, hints, retries and mastery boxes).
- **Subject rotation:** the stops in a region cycle through her enabled subjects in `SUBJECT_ORDER`, using `subjectsFor(p)`, so the grown-up subject switches and keyboard-only Typing apply. The cycle carries across regions, so with 3 subjects region 1 gets math, reading, writing, math, reading and region 2 starts at writing.
- **Mission choice:** when a stop becomes the next stop, it picks the least-practiced mission at her level in that subject (the same rule as the current "suggested" mission) and saves it on the stop, so the map doesn't change between visits. The journal and Word Blaster are never stops.
- **Typing stops** play one typing lesson (not 6 questions). Reaching the lesson goal gives 3 stars; otherwise 1.
- **No failing a stop.** Finishing moves her on. Stars come from her first-try right answers out of 6: 5–6 gives 3 stars, 3–4 gives 2, and 0–2 gives 1.
- **Replay:** tapping a finished stop offers to play it again. A replay can raise its stars but never lowers them. Replays don't move her along the path.
- **Changes mid-region:** if a grown-up turns a subject off or changes a level, the region's unplayed stops are re-picked from her current subjects and levels when the map opens. Played stops keep their subject and stars.

## Boss

- Each region's boss is a silly villain drawn in SVG, with one villain per world, dressed differently in each region (for example, a grumpy space gremlin with a new hat each time).
- The fight is 8 questions mixed from the subjects of that region's stops, at her levels. The top of the question screen shows the villain and a hit bar with 6 marks.
- Each first-try right answer knocks off one mark (with a wobble or poof). A miss makes the villain laugh (a short animation, no sound beyond the existing sfx).
- **Win:** 6 or more first-try right answers out of 8. A short win scene (the villain runs off or turns friendly), then the region's win line, then the next region's intro.
- **Not yet:** with fewer than 6, "The gremlin got away! Try again?". A rematch starts at once with new questions. There's no limit and no penalty.
- Missed questions go into the existing repeat pool, as everywhere else.

## Screens

### Map (her home screen)
- A tall scrolling scene for the current region, drawn in SVG and CSS in her world's style, using the theme's colors and sky. It opens scrolled to her next stop.
- A winding path with 5 round stop markers. Each marker shows its subject icon and, once played, 0–3 stars. After them comes a bigger boss marker with the villain's face.
- Stops ahead are dimmed, and only the next stop and finished stops can be tapped. The boss can be tapped once all 5 stops are done.
- **Creature token:** a small drawn version of her creature in its current color (or her egg, before hatching), standing at the next stop. After a stop it hops along the path to the next marker. The hop is skipped with `prefers-reduced-motion`.
- **Title bar:** the region name, "Region 2 of 6", and a row of 6 dots for the world's regions. Tapping the region name shows the intro again.
- **Today's Quest:** a glowing bonus marker beside the path, shown while today's quest isn't done. It plays the existing Today's Quest.
- **Bottom bar:** Free practice (today's subject tabs and mission list), My creature (the den), Journal, Collection, and switch player. Everything on today's home screen stays one tap away.

### Region intro
- The 3D creature (using the existing `showCreature`, one WebGL view at a time), the region name, the problem line, and a small drawn picture. One big **Let's go!** button.
- It shows the first time she enters a region, then only on request.

### Finish screens
- After a stop, the existing finish screen with a **Back to map** button (the main action) that returns to the map and plays the hop.
- After a boss, the win or not-yet scene.
- After the 6th boss, the world-complete celebration (the 3D creature `celebrate`, confetti) and then the world picker.

### Free practice
- Today's home screen, unchanged apart from a **← Map** button in its top bar. Missions played here count for mastery, the creature and gear as now, but don't move her along the map.

### Grown-ups page
- One line per child: "Adventure: Space world · Moon Base (region 2 of 6) · 4 stops this week".

## Data and sync

- `p.adventure = { world, region, stop, stops: [{ subject, missionId, stars }], seenIntro: [regionKey], worldsDone: [worldId], next: subjectIndex, updated }`
  - `world`: the world being played; `region`: 0–5; `stop`: 0–5 (5 means the boss is next).
  - `stops`: the 5 stops of the current region. `regionKey` = `world:region`.
  - `next`: where the subject rotation continues.
- Created on first map open as region 0 of her theme's world. Existing players start there too, and nothing else of theirs changes.
- **Merge (two devices):**
  - keep the side that is further along, comparing `worldsDone.length`, then `region`, then `stop`;
  - union `seenIntro` and `worldsDone`;
  - when both sides are in the same region, the merged stops take the higher stars per stop;
  - `updated` is the later of the two.
  - It runs inside `mergePlayer`, like `PR.mergePet`.
- Adventure questions count toward mastery, the creature's stages, gear and the activity log the same way as any mission. A log entry gets `k: 'stop'` or `k: 'boss'` so the Grown-ups page can count stops.

## Code

- **`adventure-rules.js`** (new; same pattern as `pet-rules.js`: `window.AdventureRules` plus `module.exports`, with no DOM). It holds:
  - the region lists,
  - `newAdventure(world)`,
  - `fillStops(adv, subjects, pickMission)`,
  - `repickStops(adv, subjects, pickMission)`,
  - `starsFor(firstTry, n)`,
  - `typingStars(goalReached)`,
  - `bossWon(firstTry)`,
  - `finishStop(adv, i, stars)`,
  - `finishBoss(adv)` (moves to the next region or ends the world),
  - `startWorld(adv, world)`,
  - `mergeAdventure(a, b)`.
- **`tests/adventure-rules.test.js`** (new): tests for every rule above.
- **`adventure.js`** (new): draws the map scene for a region and world (SVG background, path, markers, token, hop animation) and the villains. It is loaded with a dynamic `import()` when the map opens, the same way `creature.js` is, with `ASSET_Q` cache busting. If it fails to load, the map falls back to a plain vertical list of the stops.
- **`app.js`:**
  - `showMap` becomes the home screen, and the old `showHome` becomes Free practice;
  - region intro, boss and world-complete screens;
  - stop and boss modes in the existing question flow (`game.stop`, `game.boss`, with the length set to 6 or 8);
  - the Back to map wiring and the merge call.
- **`index.html`, `sw.js`:** load `adventure-rules.js` before `app.js`, add both new files to CORE, and bump the cache name.

## Out of scope
- Action inside regular stops (part 2).
- New question content. Stops use the existing missions.
- Sound and read-aloud. The family dislikes synthetic voices, so text stays short and the pictures carry the meaning.
- Family rewards (the trip goal), which are still parked.

## Testing
- **Node:**
  - rotation over the enabled subjects, including across regions;
  - typing only when it's in `subjects`;
  - re-picking after a switch or level change keeps the played stops;
  - stars at the boundaries (6, 5, 4, 3, 2, 0 right);
  - boss win at 6 and loss at 5;
  - finishing stop 5 → boss, boss → next region, 6th boss → world complete and `worldsDone`;
  - the merge cases (further along wins, stars max per stop, unions).
- **Preview:**
  - a new player sees the map at region 1 and the intro once;
  - an existing player with progress keeps their creature and mastery;
  - play a stop and see the hop and stars;
  - a boss loss, then a win;
  - jump to region 6 and finish the world;
  - all 4 world styles at phone and iPad widths;
  - Today's Quest, Free practice, den, journal and collection reachable;
  - reduced motion;
  - no console errors.
- **Live after deploy:** one stop on each girl's iPad, then check that the other device shows the same progress after a sync.
