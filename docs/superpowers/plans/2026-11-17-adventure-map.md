# Adventure Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each kid's home screen a drawn adventure map of her world, with 6 regions × (5 stops + a boss), a creature token walking the path, region intros, a boss with a hit bar, and a world-complete picker, as specified in `docs/superpowers/specs/2026-11-17-adventure-map-design.md`.

**Architecture:**
- The rules live in a new plain-script module, `adventure-rules.js` (`window.AdventureRules` plus `module.exports`, Node-tested), in the same pattern as `pet-rules.js`.
- The drawing (SVG scene, HTML stop buttons over it, the creature token, villains) lives in a new ES module, `adventure.js`, loaded with a dynamic `import()` the way `creature.js` is.
- In `app.js`:
  - stops and the boss reuse the existing question engine through its "slots" mode (the one Today's Quest uses);
  - a new `showMap` becomes the home screen;
  - the old `showHome` becomes Free practice.

**Tech Stack:** Vanilla JS (an IIFE in `app.js`, no build step), SVG and CSS, `node --test` for the rules, and the browser preview (`.claude/launch.json` config `math-quest-alt`, port 5181) for the screens.

## Global Constraints

- Worlds are the four theme ids `space`, `ocean`, `pets`, `bakery`. Each has 6 regions; each region has 5 stops and then a boss.
- A stop is 6 questions (`STOP_LEN = 6`). The boss is 8 questions (`BOSS_LEN = 8`) and is won with 6 or more first-try right answers (`BOSS_WIN = 6`).
- Stars out of 6 first-try answers: 5–6 → 3, 3–4 → 2, 0–2 → 1. A typing stop gives 3 stars if the lesson goal is reached (all 3 typing stars), otherwise 1.
- You can't fail a stop. Replays never lower stars and never move her along the path.
- Stops rotate through `subjectsFor(p)` in `SUBJECT_ORDER`, and the rotation carries across regions. The journal and Word Blaster are never stops.
- Merge rule: whoever is further along wins (laps, then region, then stop). `seenIntro` and `worldsDone` are unioned. Within the same region and lap, stars are the higher of the two per matching stop.
- No read-aloud and no new sounds (use the existing `sfx.good/bad/win` only). Kid-facing lines stay short and plain.
- `prefers-reduced-motion`: no token hop, no pulsing, no villain wobble.
- Existing players keep all their progress. The adventure starts at region 1 of their theme's world.
- Tests: `node --test 'tests/*.test.js'` (the glob form; `node --test tests/` fails on Node 22).
- Commit messages carry no attribution lines.

## Preview harness (used by Tasks 2–5)

The PHP sync API isn't available locally, and the app is one IIFE, so screens are tested by loading a patched copy of `app.js` that exposes a test hook. Run this in the preview tab (`mcp__Claude_Browser__javascript_tool`) after seeding `localStorage['mathquest.v1']`. Add any function you need to the `__t` object:

```js
const html = await (await fetch('/index.html?x=' + Date.now())).text();
const tag = html.match(/<script[^>]*src="app\.js[^"]*"[^>]*><\/script>/)[0];
let src = await (await fetch('/app.js?x=' + Date.now())).text();
const i = src.lastIndexOf('})();');
src = src.slice(0, i) + 'window.__t = { state, me, save, showMap: typeof showMap === "function" ? showMap : null, startStop: typeof startStop === "function" ? startStop : null, startBoss: typeof startBoss === "function" ? startBoss : null, ensureAdventure: typeof ensureAdventure === "function" ? ensureAdventure : null };\n' + src.slice(i);
const blob = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
document.open(); document.write(html.replace(tag, `<script src="${blob}"></script>`)); document.close();
```

A minimal seeded player (the fields `showHome` needs):

```js
localStorage.setItem('mathquest.v1', JSON.stringify({ profiles: [{ id: 'a', name: 'Mia', grade: 2, theme: 'space', avatar: '🚀',
  introSeen: true, stats: {}, missions: {}, found: {}, points: 0, streak: 0, lastDay: null,
  pet: { species: 'dragon', name: 'Ember', color: 1, wear: { head: null, neck: null, back: null }, items: [], seenStage: 1, seenItems: [], updated: Date.now() } }],
  current: 'a', sync: {} }));
```

---

### Task 1: Adventure rules module

**Files:**
- Create: `adventure-rules.js`
- Create: `tests/adventure-rules.test.js`
- Modify: `index.html` (script tag before `app.js`)
- Modify: `sw.js` (CORE list, cache name)

**Interfaces:**
- Produces `window.AdventureRules` (and `module.exports`) with:
  - constants: `STOPS = 5`, `STOP_LEN = 6`, `BOSS_LEN = 8`, `BOSS_WIN = 6`, `REGIONS = 6`;
  - `WORLDS[world] = { name, villain, villainShort, regions: [{ name, problem, win }×6] }`;
  - `WORLD_ORDER`;
  - `regionKey(adv) -> 'world:region'`;
  - `regionName(key) -> string`;
  - `newAdventure(world)`;
  - `fillStops(adv, subjects, pick) -> bool`, where `pick(subject, takenIds) -> missionId|null`;
  - `repickStops(adv, subjects, pick, valid) -> bool`, where `valid(stop) -> bool`;
  - `starsFor(firstTry) -> 1|2|3`;
  - `typingStars(goalReached) -> 1|3`;
  - `bossWon(firstTry) -> bool`;
  - `bossReady(adv) -> bool`;
  - `finishStop(adv, i, stars) -> bool` (moved forward);
  - `finishBoss(adv) -> 'region'|'world'`;
  - `nextWorlds(adv) -> worldId[]`;
  - `startWorld(adv, world)`;
  - `progressKey(adv) -> number`;
  - `mergeAdventure(a, b) -> adv|undefined`.
- The adventure object: `{ world, region, stop, stops: [{ subject, missionId, stars } | null ×≤5], seenIntro: [], worldsDone: [], laps, next, picking, updated }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/adventure-rules.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const AR = require('../adventure-rules.js');

// pick: hands out mission ids "<subject>-1", "<subject>-2", … skipping taken ones; 'none' subjects have no missions
const pick = (subject, taken) => {
  if (subject === 'none') return null;
  for (let n = 1; n < 20; n++) { const id = `${subject}-${n}`; if (!taken.includes(id)) return id; }
  return null;
};

test('every world has 6 regions with a name, a problem and a win line', () => {
  assert.deepEqual(AR.WORLD_ORDER, ['space', 'ocean', 'pets', 'bakery']);
  for (const w of AR.WORLD_ORDER) {
    assert.equal(AR.WORLDS[w].regions.length, AR.REGIONS);
    for (const r of AR.WORLDS[w].regions) assert.ok(r.name && r.problem && r.win);
    assert.ok(AR.WORLDS[w].villainShort);
  }
  assert.equal(AR.regionName('space:1'), 'Moon Base');
});

test('fillStops rotates through the subjects and carries the rotation into the next region', () => {
  const adv = AR.newAdventure('space');
  assert.equal(AR.fillStops(adv, ['math', 'reading', 'writing'], pick), true);
  assert.deepEqual(adv.stops.map(s => s.subject), ['math', 'reading', 'writing', 'math', 'reading']);
  assert.deepEqual(adv.stops.map(s => s.missionId), ['math-1', 'reading-1', 'writing-1', 'math-2', 'reading-2']);
  assert.ok(adv.stops.every(s => s.stars === 0));
  for (let i = 0; i < 5; i++) AR.finishStop(adv, i, 2);
  assert.equal(AR.finishBoss(adv), 'region');
  AR.fillStops(adv, ['math', 'reading', 'writing'], pick);
  assert.equal(adv.stops[0].subject, 'writing');
  assert.equal(AR.fillStops(adv, ['math', 'reading', 'writing'], pick), false);   // nothing left to fill
});

test('fillStops skips a subject with no missions', () => {
  const adv = AR.newAdventure('ocean');
  AR.fillStops(adv, ['math', 'none'], pick);
  assert.deepEqual(adv.stops.map(s => s.subject), ['math', 'math', 'math', 'math', 'math']);
});

test('fillStops only includes typing when it is in the subject list', () => {
  const a = AR.newAdventure('space'); AR.fillStops(a, ['math', 'typing'], pick);
  assert.ok(a.stops.some(s => s.subject === 'typing'));
  const b = AR.newAdventure('space'); AR.fillStops(b, ['math'], pick);
  assert.ok(b.stops.every(s => s.subject !== 'typing'));
});

test('repickStops replaces unplayed stops whose subject is off or mission is no longer valid, keeps played ones', () => {
  const adv = AR.newAdventure('space');
  AR.fillStops(adv, ['math', 'social'], pick);              // math, social, math, social, math
  AR.finishStop(adv, 0, 3); AR.finishStop(adv, 1, 2);      // social stop 1 was played
  const changed = AR.repickStops(adv, ['math'], pick, s => s.missionId !== 'math-2');
  assert.equal(changed, true);
  assert.equal(adv.stops[1].subject, 'social'); assert.equal(adv.stops[1].stars, 2);   // played: kept
  assert.ok(adv.stops.slice(2).every(s => s.subject === 'math' && s.missionId !== 'math-2'));
  assert.equal(AR.repickStops(adv, ['math'], pick, () => true), false);
});

test('stars and the boss rule', () => {
  assert.deepEqual([6, 5, 4, 3, 2, 0].map(AR.starsFor), [3, 3, 2, 2, 1, 1]);
  assert.equal(AR.typingStars(true), 3); assert.equal(AR.typingStars(false), 1);
  assert.equal(AR.bossWon(6), true); assert.equal(AR.bossWon(5), false); assert.equal(AR.bossWon(8), true);
});

test('finishStop moves forward only from the next stop, and replays keep the best stars', () => {
  const adv = AR.newAdventure('space'); AR.fillStops(adv, ['math'], pick);
  assert.equal(AR.finishStop(adv, 0, 1), true); assert.equal(adv.stop, 1);
  assert.equal(AR.finishStop(adv, 0, 3), false); assert.equal(adv.stop, 1); assert.equal(adv.stops[0].stars, 3);
  assert.equal(AR.finishStop(adv, 0, 2), false); assert.equal(adv.stops[0].stars, 3);
  assert.equal(AR.bossReady(adv), false);
  for (let i = 1; i < 5; i++) AR.finishStop(adv, i, 2);
  assert.equal(adv.stop, 5); assert.equal(AR.bossReady(adv), true);
  assert.equal(AR.finishStop(adv, 4, 3), false); assert.equal(adv.stop, 5);
});

test('the 6th boss finishes the world and the picker starts the next one', () => {
  const adv = AR.newAdventure('space');
  for (let r = 0; r < 6; r++) {
    AR.fillStops(adv, ['math'], pick);
    for (let i = 0; i < 5; i++) AR.finishStop(adv, i, 3);
    assert.equal(AR.finishBoss(adv), r < 5 ? 'region' : 'world');
  }
  assert.equal(adv.picking, true); assert.deepEqual(adv.worldsDone, ['space']); assert.equal(adv.laps, 1);
  assert.deepEqual(AR.nextWorlds(adv), ['ocean', 'pets', 'bakery']);
  assert.equal(AR.fillStops(adv, ['math'], pick), false);   // nothing to fill while picking
  AR.startWorld(adv, 'pets');
  assert.deepEqual([adv.world, adv.region, adv.stop, adv.picking, adv.stops.length], ['pets', 0, 0, false, 0]);
  adv.worldsDone = ['space', 'ocean', 'pets', 'bakery'];
  assert.deepEqual(AR.nextWorlds(adv), AR.WORLD_ORDER);   // all done: any world can be replayed
});

test('mergeAdventure: further along wins, unions, best stars in the same region', () => {
  const a = AR.newAdventure('space'); AR.fillStops(a, ['math'], pick);
  const b = JSON.parse(JSON.stringify(a));
  AR.finishStop(a, 0, 1); AR.finishStop(a, 1, 1);           // a: stop 2
  AR.finishStop(b, 0, 3);                                    // b: stop 1, better stars on stop 0
  b.seenIntro = ['space:0']; a.seenIntro = [];
  const m = AR.mergeAdventure(a, b);
  assert.equal(m.stop, 2);
  assert.equal(m.stops[0].stars, 3);
  assert.deepEqual(m.seenIntro, ['space:0']);
  assert.equal(AR.mergeAdventure(undefined, undefined), undefined);
  assert.deepEqual(AR.mergeAdventure(a, undefined), a);
  assert.notEqual(AR.mergeAdventure(a, undefined), a);       // a copy
});

test('mergeAdventure: a started next world beats a device still on the picker', () => {
  const a = AR.newAdventure('space'); a.worldsDone = ['space']; a.laps = 1; a.picking = true; a.updated = 5;
  const b = JSON.parse(JSON.stringify(a)); AR.startWorld(b, 'ocean'); b.updated = 1;
  assert.equal(AR.mergeAdventure(a, b).world, 'ocean');
  assert.equal(AR.mergeAdventure(b, a).picking, false);
  assert.ok(AR.progressKey(b) > AR.progressKey(a));
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test 'tests/*.test.js'`
Expected: FAIL with `Cannot find module '../adventure-rules.js'`.

- [ ] **Step 3: Write the module**

Create `adventure-rules.js`:

```js
/* Quest Academy adventure map: the rules (no DOM).
   Loaded as a plain script (window.AdventureRules) and by Node for tests.
   Spec: docs/superpowers/specs/2026-11-17-adventure-map-design.md */
(function (root) {
  'use strict';

  const STOPS = 5, STOP_LEN = 6, BOSS_LEN = 8, BOSS_WIN = 6, REGIONS = 6;
  const R = (name, problem, win) => ({ name, problem, win });
  const WORLDS = {
    space: { name: 'Space', villain: 'Glitch the space gremlin', villainShort: 'Glitch', regions: [
      R('Launch Pad', "The rocket won't start! Check 5 systems to get it ready.", '3, 2, 1… Blast off!'),
      R('Moon Base', 'The Moon Base lights are out! Fix 5 machines to turn them on.', 'The Moon Base lights are on!'),
      R('Asteroid Belt', 'Rocks everywhere! Find a safe way past 5 asteroids.', 'You made it through the asteroids!'),
      R('Ring Planet', "The planet's rings stopped spinning. Give them 5 pushes!", 'The rings are spinning again!'),
      R('Comet Trail', 'A comet zoomed off with the star map. Follow its trail!', 'You got the star map back!'),
      R('Star Gate', 'The Star Gate is locked. Find 5 keys to open it.', 'The Star Gate is open! You did it!'),
    ] },
    ocean: { name: 'Ocean', villain: 'Captain Grumbles the crab', villainShort: 'Captain Grumbles', regions: [
      R('Sunny Shallows', 'The tide pools got all mixed up. Sort 5 of them!', 'The tide pools are tidy!'),
      R('Kelp Forest', 'The otters got lost in the kelp. Help 5 find home.', 'The otters are home!'),
      R('Coral City', "Coral City's colors faded. Bring back 5 colors!", 'Coral City is bright again!'),
      R('Shipwreck Cove', 'A treasure chest is stuck in the old ship. Find 5 clues!', 'You found the treasure!'),
      R('Deep Trench', "It's dark down deep. Light 5 glowing lanterns.", 'The trench is glowing!'),
      R('Pearl Palace', "The Pearl Queen's crown is missing. Search 5 rooms!", 'The crown is back! You did it!'),
    ] },
    pets: { name: 'Pets', villain: 'Sir Sneaks the raccoon', villainShort: 'Sir Sneaks', regions: [
      R('Puppy Park', "The puppies' balls rolled away. Fetch 5 of them!", 'Every puppy has a ball!'),
      R('Kitten Corner', 'The kittens tangled the yarn. Untangle 5 balls!', 'No more tangles!'),
      R('Bunny Burrows', 'The bunnies hid their carrots and forgot where. Find 5!', 'The carrots are found!'),
      R('Pony Meadow', 'The pony fence broke. Fix 5 posts!', 'The ponies are safe!'),
      R('Parrot Peaks', 'The parrots forgot their song. Teach them 5 notes!', 'The parrots are singing!'),
      R('Royal Pet Show', 'The Pet Show is today, but the ribbons are gone. Win 5 back!', 'Best in Show! You did it!'),
    ] },
    bakery: { name: 'Bakery', villain: 'Crumbs the cookie thief', villainShort: 'Crumbs', regions: [
      R('Flour Mill', 'The mill wheel is stuck. Fill 5 sacks of flour!', 'The mill is turning!'),
      R('Cookie Kitchen', 'The cookie cutters went missing. Find 5!', 'Fresh cookies for everyone!'),
      R('Cupcake Lane', 'Every cupcake needs frosting. Frost 5 trays!', 'The cupcakes look yummy!'),
      R('Pie Parlor', 'The pie oven is cold. Light it with 5 sparks!', 'Warm pies are ready!'),
      R('Candy Castle', 'The candy bridge melted. Build it back in 5 pieces!', 'The bridge is sweet and strong!'),
      R('Grand Cake Fair', 'The giant cake fell over! Stack 5 layers back up.', 'The Grand Cake is the best ever! You did it!'),
    ] },
  };
  const WORLD_ORDER = ['space', 'ocean', 'pets', 'bakery'];

  const regionKey = adv => adv.world + ':' + adv.region;
  function regionName(key) {
    const [w, r] = String(key).split(':'), world = WORLDS[w], reg = world && world.regions[+r];
    return reg ? reg.name : String(key);
  }

  const newAdventure = world => ({ world, region: 0, stop: 0, stops: [], seenIntro: [], worldsDone: [], laps: 0, next: 0, picking: false, updated: Date.now() });

  // Fills empty stop slots in rotation order; a subject with no mission is skipped.
  function fillStops(adv, subjects, pick) {
    if (adv.picking || !subjects.length) return false;
    let changed = false;
    for (let i = 0; i < STOPS; i++) {
      if (adv.stops[i]) continue;
      const taken = adv.stops.filter(Boolean).map(s => s.missionId);
      for (let tries = 0; tries < subjects.length; tries++) {
        const subject = subjects[(adv.next || 0) % subjects.length];
        adv.next = (adv.next || 0) + 1;
        const missionId = pick(subject, taken);
        if (missionId) { adv.stops[i] = { subject, missionId, stars: 0 }; changed = true; break; }
      }
    }
    return changed;
  }

  // Unplayed stops whose subject is now off, or whose mission no longer fits her level, are picked again.
  function repickStops(adv, subjects, pick, valid) {
    if (adv.picking) return false;
    let changed = false;
    for (let i = adv.stop; i < STOPS; i++) {
      const s = adv.stops[i];
      if (s && !s.stars && (!subjects.includes(s.subject) || !valid(s))) { adv.stops[i] = null; changed = true; }
    }
    const filled = fillStops(adv, subjects, pick);
    return filled || changed;
  }

  const starsFor = firstTry => firstTry >= 5 ? 3 : firstTry >= 3 ? 2 : 1;
  const typingStars = goalReached => goalReached ? 3 : 1;
  const bossWon = firstTry => firstTry >= BOSS_WIN;
  const bossReady = adv => !adv.picking && adv.stop >= STOPS;

  function finishStop(adv, i, stars) {
    const s = adv.stops[i];
    if (!s) return false;
    s.stars = Math.max(s.stars || 0, stars);
    const moved = i === adv.stop && adv.stop < STOPS;
    if (moved) adv.stop++;
    adv.updated = Date.now();
    return moved;
  }

  function finishBoss(adv) {
    adv.updated = Date.now();
    adv.stop = 0; adv.stops = [];
    if (adv.region < REGIONS - 1) { adv.region++; return 'region'; }
    if (!adv.worldsDone.includes(adv.world)) adv.worldsDone.push(adv.world);
    adv.laps = (adv.laps || 0) + 1;
    adv.picking = true;
    return 'world';
  }

  function nextWorlds(adv) {
    const left = WORLD_ORDER.filter(w => !adv.worldsDone.includes(w));
    return left.length ? left : WORLD_ORDER.slice();
  }

  function startWorld(adv, world) {
    Object.assign(adv, { world, region: 0, stop: 0, stops: [], picking: false, updated: Date.now() });
    return adv;
  }

  // Higher is further along. A device still on the world picker is behind one that started the next world.
  const progressKey = adv => (adv.laps || 0) * 1000 + (adv.picking ? 0 : 1 + adv.region * 10 + adv.stop);

  const clone = x => JSON.parse(JSON.stringify(x));
  const union = (x = [], y = []) => [...new Set([...x, ...y])];
  function mergeAdventure(a, b) {
    if (!a && !b) return undefined;
    if (!a || !b) return clone(a || b);
    const ka = progressKey(a), kb = progressKey(b);
    const win = ka !== kb ? (ka > kb ? a : b) : ((a.updated || 0) >= (b.updated || 0) ? a : b);
    const other = win === a ? b : a;
    const m = clone(win);
    m.seenIntro = union(a.seenIntro, b.seenIntro);
    m.worldsDone = union(a.worldsDone, b.worldsDone);
    m.laps = Math.max(a.laps || 0, b.laps || 0);
    if (!m.picking && !other.picking && other.world === m.world && other.region === m.region && (other.laps || 0) === (win.laps || 0)) {
      m.stops = (m.stops || []).map((s, i) => {
        const o = (other.stops || [])[i];
        return s && o && o.subject === s.subject && o.missionId === s.missionId ? { ...s, stars: Math.max(s.stars || 0, o.stars || 0) } : s;
      });
    }
    m.updated = Math.max(a.updated || 0, b.updated || 0);
    return m;
  }

  const api = { STOPS, STOP_LEN, BOSS_LEN, BOSS_WIN, REGIONS, WORLDS, WORLD_ORDER, regionKey, regionName, newAdventure,
    fillStops, repickStops, starsFor, typingStars, bossWon, bossReady, finishStop, finishBoss, nextWorlds, startWorld,
    progressKey, mergeAdventure };
  root.AdventureRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test 'tests/*.test.js'`
Expected: every test passes (the existing 29 plus the new ones), 0 fail.

- [ ] **Step 5: Load it in the app and the offline cache**

In `index.html`, after `<script src="subject-rules.js"></script>`, add:

```html
  <script src="adventure-rules.js"></script>
```

In `sw.js`, change `const CACHE = 'quest-academy-v7';` to `const CACHE = 'quest-academy-v8';`, and in `CORE` change `'pet-rules.js', 'first-run-rules.js', 'subject-rules.js', 'creature.js',` to:

```js
  'pet-rules.js', 'first-run-rules.js', 'subject-rules.js', 'adventure-rules.js', 'adventure.js', 'creature.js',
```

(`adventure.js` is created in Task 2. The service worker isn't registered on localhost, so the missing file doesn't matter before then.)

- [ ] **Step 6: Commit**

```bash
git add adventure-rules.js tests/adventure-rules.test.js index.html sw.js
git commit -m "Adventure map: rules module with tests"
```

---

### Task 2: Map drawing module

**Files:**
- Create: `adventure.js`
- Modify: `style.css` (append an "Adventure map" section)

**Interfaces:**
- Consumes nothing from `app.js`. Colors come in as hex strings.
- Produces an ES module with these exports:
  - `drawMap(el, o) -> { hopTo(i) }`, where `o = { world, region, stops: [{ icon, name, stars } | null ×5], stop: 0..5, bonus: bool, boss: { face: svgString, name }, token: svgString, from: number|null }`. It writes into `el`:
    - one `<button class="adv-stop" data-stop="0..4">` per stop (disabled when locked; class `next` on the playable one, `done` on finished ones),
    - one `<button class="adv-stop adv-boss" data-stop="5">`,
    - and, when `o.bonus`, a `<button class="adv-stop adv-bonus" data-bonus>`.
  - `villainSvg(world, region) -> string` (an inline `<svg>`, viewBox 0 0 100 100).
  - `tokenSvg(look) -> string`, where `look` is `{ egg: true }` or `{ species, body, belly, accent }` with hex colors.
  - `POINTS` (marker centers in the 360×900 scene).

- [ ] **Step 1: Write the module**

Create `adventure.js`:

```js
/* Quest Academy adventure map: the drawn scene for one region, its stop buttons, the creature token and the villains.
   Loaded on demand by app.js. Spec: docs/superpowers/specs/2026-11-17-adventure-map-design.md */
const W = 360, H = 900;
// marker centers, stop 1 at the bottom up to the boss at the top
export const POINTS = [[105, 815], [255, 695], [105, 575], [255, 455], [105, 335], [180, 165]];
const BONUS = [312, 575];

// per world: 6 sky gradients (one per region), ground color, path color, decoration style
const STYLE = {
  space: { skies: [['#120d3a', '#2d2170'], ['#0e1a3f', '#283c7a'], ['#1d0f3a', '#4a2a6e'], ['#0b2236', '#22506b'], ['#231236', '#5b2b5e'], ['#06122b', '#1f3166']], ground: '#3b3478', path: '#ffcb47' },
  ocean: { skies: [['#5fd3f3', '#1f8fc4'], ['#2fb39a', '#11695e'], ['#3fa0e0', '#1a5a9e'], ['#2a7fa8', '#173f63'], ['#14466e', '#071b33'], ['#5a7fd6', '#22357a']], ground: '#f3d9a4', path: '#fff6d8' },
  pets: { skies: [['#bfe9ff', '#e9f8d2'], ['#ffe3ef', '#fff4e0'], ['#d8f3c8', '#fffbe6'], ['#cdeaff', '#e5f7d4'], ['#ffeccc', '#dff6ff'], ['#efe0ff', '#fff0f6']], ground: '#8fd16a', path: '#b98a5a' },
  bakery: { skies: [['#ffe8d1', '#fff6ec'], ['#ffd9e6', '#fff1f5'], ['#fbe3ff', '#fff3e6'], ['#ffe2c2', '#fff8e1'], ['#ffd6f0', '#e8f4ff'], ['#fff0b8', '#ffe1ec']], ground: '#e9b98a', path: '#ff8fab' },
};

// small seeded random so a region always draws the same
function rng(seed) { let a = seed * 9301 + 49297; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; }

function decoFor(world, region) {
  const r = rng(WORLD_SEED[world] * 10 + region + 1), out = [];
  const px = () => Math.round(r() * W), py = (top = 0, bottom = H) => Math.round(top + r() * (bottom - top));
  if (world === 'space') {
    for (let i = 0; i < 46; i++) out.push(`<circle cx="${px()}" cy="${py()}" r="${(r() * 1.8 + .6).toFixed(1)}" fill="#fff" opacity="${(r() * .6 + .3).toFixed(2)}"/>`);
    for (let i = 0; i < 2; i++) { const x = px(), y = py(80, 700), s = 18 + r() * 22;
      out.push(`<g opacity=".85"><circle cx="${x}" cy="${y}" r="${s.toFixed(0)}" fill="${['#ff9a8b', '#8bd3ff', '#c8a2ff'][(region + i) % 3]}"/><ellipse cx="${x}" cy="${y}" rx="${(s * 1.7).toFixed(0)}" ry="${(s * .35).toFixed(0)}" fill="none" stroke="#ffe08a" stroke-width="3"/></g>`); }
    for (let i = 0; i < 5; i++) out.push(`<ellipse cx="${px()}" cy="${py(860, 895)}" rx="${(10 + r() * 14).toFixed(0)}" ry="5" fill="#2a2462"/>`);
  } else if (world === 'ocean') {
    for (let i = 0; i < 26; i++) out.push(`<circle cx="${px()}" cy="${py(0, 820)}" r="${(r() * 7 + 3).toFixed(1)}" fill="none" stroke="#fff" stroke-width="2" opacity="${(r() * .4 + .25).toFixed(2)}"/>`);
    for (let i = 0; i < 7; i++) { const x = px(), h = 60 + r() * 90;
      out.push(`<path d="M${x} ${H} q -14 -${(h / 3).toFixed(0)} 0 -${(h / 1.5).toFixed(0)} q 14 -${(h / 6).toFixed(0)} 0 -${(h / 3).toFixed(0)}" fill="none" stroke="#2fae6b" stroke-width="7" stroke-linecap="round"/>`); }
  } else if (world === 'pets') {
    for (let i = 0; i < 14; i++) { const x = px(), y = py(60, 860), c = '#7b5a3a';
      out.push(`<g opacity=".22" fill="${c}"><ellipse cx="${x}" cy="${y}" rx="7" ry="6"/><circle cx="${x - 7}" cy="${y - 9}" r="3"/><circle cx="${x}" cy="${y - 12}" r="3"/><circle cx="${x + 7}" cy="${y - 9}" r="3"/></g>`); }
    for (let i = 0; i < 6; i++) { const x = px(), y = py(40, 300);
      out.push(`<g fill="#fff" opacity=".8"><circle cx="${x}" cy="${y}" r="16"/><circle cx="${x + 18}" cy="${y + 4}" r="13"/><circle cx="${x - 16}" cy="${y + 5}" r="11"/></g>`); }
  } else {
    const cols = ['#ff6fa5', '#ffd23f', '#59c3ff', '#7ee081', '#b388ff'];
    for (let i = 0; i < 60; i++) out.push(`<rect x="${px()}" y="${py()}" width="10" height="3" rx="1.5" fill="${cols[i % cols.length]}" transform="rotate(${Math.round(r() * 180)} ${px()} ${py()})" opacity=".7"/>`);
    for (let i = 0; i < 4; i++) out.push(`<circle cx="${px()}" cy="${py(100, 800)}" r="${(10 + r() * 12).toFixed(0)}" fill="#fff" opacity=".55"/>`);
  }
  return out.join('');
}
const WORLD_SEED = { space: 1, ocean: 2, pets: 3, bakery: 4 };

function pathD() {
  let d = `M${POINTS[0][0]} ${POINTS[0][1] + 60}`;
  d += ` L${POINTS[0][0]} ${POINTS[0][1]}`;
  for (let i = 1; i < POINTS.length; i++) {
    const [x0, y0] = POINTS[i - 1], [x1, y1] = POINTS[i], my = (y0 + y1) / 2;
    d += ` C${x0} ${my} ${x1} ${my} ${x1} ${y1}`;
  }
  return d;
}

function sceneSvg(world, region) {
  const st = STYLE[world] || STYLE.space, [top, bottom] = st.skies[region] || st.skies[0];
  return `<svg class="adv-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id="advSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#advSky)"/>
    <path d="M0 ${H - 70} Q ${W / 2} ${H - 110} ${W} ${H - 70} V ${H} H 0 Z" fill="${st.ground}"/>
    ${decoFor(world, region)}
    <path d="${pathD()}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="26" stroke-linecap="round"/>
    <path d="${pathD()}" fill="none" stroke="${st.path}" stroke-width="18" stroke-linecap="round"/>
    <path d="${pathD()}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round"/>
  </svg>`;
}

const pct = ([x, y]) => `left:${(x / W * 100).toFixed(2)}%;top:${(y / H * 100).toFixed(2)}%`;
const starRow = n => `<span class="adv-stars" aria-hidden="true">${[1, 2, 3].map(k => `<i class="${k <= n ? 'on' : ''}">★</i>`).join('')}</span>`;
const escAttr = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function drawMap(el, o) {
  const tokenAt = i => POINTS[Math.min(i, POINTS.length - 1)].map((v, k) => v + (k === 0 ? 40 : -34));
  const stops = o.stops.map((s, i) => {
    if (!s) return '';
    const done = i < o.stop, next = i === o.stop, locked = !done && !next;
    const label = done ? `Stop ${i + 1}: ${s.name}, ${s.stars} ${s.stars === 1 ? 'star' : 'stars'}. Play again` : next ? `Stop ${i + 1}: ${s.name}. Play now` : `Stop ${i + 1}: ${s.name}, locked`;
    return `<button class="adv-stop ${done ? 'done' : ''} ${next ? 'next' : ''}" data-stop="${i}" style="${pct(POINTS[i])}" aria-label="${escAttr(label)}" ${locked ? 'disabled' : ''}>
      <span class="adv-icon" aria-hidden="true">${s.icon}</span>${done ? starRow(s.stars) : ''}</button>`;
  }).join('');
  const bossOpen = o.stop >= 5;
  const boss = `<button class="adv-stop adv-boss ${bossOpen ? 'next' : ''}" data-stop="5" style="${pct(POINTS[5])}" aria-label="${escAttr(bossOpen ? `Boss: ${o.boss.name}. Play now` : `Boss: ${o.boss.name}, locked`)}" ${bossOpen ? '' : 'disabled'}>
      <span class="adv-face" aria-hidden="true">${o.boss.face}</span></button>`;
  const bonus = o.bonus ? `<button class="adv-stop adv-bonus" data-bonus style="${pct(BONUS)}" aria-label="Today's Quest bonus stop"><span class="adv-icon" aria-hidden="true">⭐</span></button>` : '';
  const start = tokenAt(o.from != null ? o.from : o.stop);
  el.innerHTML = `<div class="adv-map">${sceneSvg(o.world, o.region)}${stops}${boss}${bonus}
    <div class="adv-token" id="advToken" style="${pct(start)}" aria-hidden="true">${o.token}</div></div>`;
  const tok = el.querySelector('#advToken');
  return {
    hopTo(i) {
      const to = tokenAt(i);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        tok.classList.add('hop');
        tok.setAttribute('style', pct(to));
        setTimeout(() => tok.classList.remove('hop'), 800);
      }));
    },
  };
}

// one villain per world, a different hat in each region
const HATS = [
  '',
  '<path d="M26 30 Q50 6 74 30 Z" fill="#e94b5b"/><rect x="22" y="28" width="56" height="6" rx="3" fill="#b8323f"/>',
  '<rect x="32" y="4" width="36" height="26" rx="3" fill="#2b2b3a"/><rect x="24" y="27" width="52" height="6" rx="3" fill="#2b2b3a"/><rect x="32" y="20" width="36" height="5" fill="#e94b5b"/>',
  '<path d="M20 30 Q50 14 80 30 L80 34 Q50 26 20 34 Z" fill="#3a7bd5"/><circle cx="82" cy="34" r="5" fill="#3a7bd5"/>',
  '<path d="M30 32 L50 0 L70 32 Z" fill="#7c4dff"/><circle cx="50" cy="14" r="3" fill="#ffd23f"/><circle cx="44" cy="24" r="2" fill="#ffd23f"/>',
  '<path d="M28 32 L32 12 L42 24 L50 8 L58 24 L68 12 L72 32 Z" fill="#ffcb2f" stroke="#c99400" stroke-width="2"/>',
];
export function villainSvg(world, region) {
  const hat = HATS[region % HATS.length];
  const eyes = (y, c = '#fff') => `<circle cx="40" cy="${y}" r="7" fill="${c}"/><circle cx="60" cy="${y}" r="7" fill="${c}"/><circle cx="41" cy="${y + 1}" r="3" fill="#222"/><circle cx="61" cy="${y + 1}" r="3" fill="#222"/><path d="M33 ${y - 9} L46 ${y - 5} M67 ${y - 9} L54 ${y - 5}" stroke="#222" stroke-width="3" stroke-linecap="round"/>`;
  let body;
  if (world === 'ocean') body = `<ellipse cx="50" cy="66" rx="32" ry="22" fill="#ef5b4a"/><path d="M14 52 q-8 -14 6 -18 q-2 8 6 10 z M86 52 q8 -14 -6 -18 q2 8 -6 10 z" fill="#ef5b4a"/>
      <line x1="40" y1="46" x2="40" y2="34" stroke="#ef5b4a" stroke-width="4"/><line x1="60" y1="46" x2="60" y2="34" stroke="#ef5b4a" stroke-width="4"/>${eyes(32)}<path d="M38 72 Q50 66 62 72" fill="none" stroke="#7a1f16" stroke-width="3" stroke-linecap="round"/>`;
  else if (world === 'pets') body = `<path d="M22 44 L28 20 L42 36 Z M78 44 L72 20 L58 36 Z" fill="#8d8d99"/><circle cx="50" cy="60" r="30" fill="#a7a7b3"/>
      <path d="M22 56 Q50 40 78 56 Q50 66 22 56 Z" fill="#3b3b47"/>${eyes(56)}<circle cx="50" cy="72" r="4" fill="#222"/><path d="M42 80 Q50 76 58 80" fill="none" stroke="#222" stroke-width="2.5" stroke-linecap="round"/>`;
  else if (world === 'bakery') body = `<circle cx="26" cy="38" r="14" fill="#c99a75"/><circle cx="74" cy="38" r="14" fill="#c99a75"/><circle cx="26" cy="38" r="7" fill="#f2b8c6"/><circle cx="74" cy="38" r="7" fill="#f2b8c6"/>
      <circle cx="50" cy="62" r="28" fill="#d8ab86"/>${eyes(56)}<circle cx="50" cy="70" r="4" fill="#e86a8a"/><path d="M30 70 H18 M30 74 H20 M70 70 H82 M70 74 H80" stroke="#6b4a33" stroke-width="2"/><path d="M43 79 Q50 84 57 79" fill="none" stroke="#6b4a33" stroke-width="2.5" stroke-linecap="round"/>`;
  else body = `<path d="M18 48 L8 30 L30 42 Z M82 48 L92 30 L70 42 Z" fill="#5ccf7a"/><circle cx="50" cy="60" r="30" fill="#6fe08c"/><line x1="50" y1="30" x2="50" y2="18" stroke="#5ccf7a" stroke-width="3"/><circle cx="50" cy="16" r="4" fill="#ffd23f"/>
      ${eyes(56)}<path d="M36 72 Q50 82 64 72" fill="#2d6b3d"/><path d="M42 73 L44 77 L46 73 M54 73 L56 77 L58 73" fill="#fff"/>`;
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">${body}${hat}</svg>`;
}

// her creature as a small flat token (or her egg)
export function tokenSvg(look) {
  if (!look || look.egg) return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false"><ellipse cx="32" cy="58" rx="16" ry="4" fill="#000" opacity=".2"/>
    <ellipse cx="32" cy="34" rx="18" ry="23" fill="#fff6e0" stroke="#e8c98f" stroke-width="2"/><path d="M18 34 l6 -5 l6 5 l6 -5 l6 5 l4 -3" fill="none" stroke="#f4a259" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  const { species, body, belly, accent } = look;
  const ears = {
    dragon: `<path d="M20 18 L16 4 L27 14 Z M44 18 L48 4 L37 14 Z" fill="${accent}"/>`,
    fox: `<path d="M17 22 L14 4 L29 15 Z M47 22 L50 4 L35 15 Z" fill="${body}"/><path d="M18 18 L17 9 L25 15 Z M46 18 L47 9 L39 15 Z" fill="${accent}"/>`,
    axolotl: `<path d="M12 24 l-8 -6 M12 28 l-9 0 M12 32 l-8 6 M52 24 l8 -6 M52 28 l9 0 M52 32 l8 6" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`,
    bunnycat: `<ellipse cx="24" cy="8" rx="5" ry="12" fill="${body}"/><ellipse cx="40" cy="8" rx="5" ry="12" fill="${body}"/><ellipse cx="24" cy="9" rx="2.5" ry="8" fill="${accent}"/><ellipse cx="40" cy="9" rx="2.5" ry="8" fill="${accent}"/>`,
  }[species] || '';
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false"><ellipse cx="32" cy="59" rx="16" ry="4" fill="#000" opacity=".2"/>
    ${ears}<circle cx="32" cy="34" r="22" fill="${body}"/><ellipse cx="32" cy="42" rx="12" ry="10" fill="${belly}"/>
    <circle cx="24" cy="30" r="4.5" fill="#fff"/><circle cx="40" cy="30" r="4.5" fill="#fff"/><circle cx="25" cy="31" r="2.4" fill="#222"/><circle cx="41" cy="31" r="2.4" fill="#222"/>
    <path d="M28 39 Q32 42 36 39" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/></svg>`;
}
```

- [ ] **Step 2: Add the styles**

Append to `style.css`:

```css
/* ---------- Adventure map ---------- */
.adv-map { position: relative; width: 100%; max-width: 520px; margin: 0 auto; aspect-ratio: 360 / 900; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, .25); }
.adv-scene { position: absolute; inset: 0; width: 100%; height: 100%; }
.adv-stop { position: absolute; transform: translate(-50%, -50%); width: 17%; aspect-ratio: 1; border-radius: 50%; border: 4px solid #fff; background: var(--card, #2a2060); color: inherit;
  display: grid; place-items: center; padding: 0; cursor: pointer; box-shadow: 0 6px 0 rgba(0, 0, 0, .25); font: inherit; }
.adv-stop .adv-icon { font-size: clamp(1.4rem, 6vw, 2.1rem); line-height: 1; }
.adv-stop:disabled { opacity: .5; cursor: default; filter: grayscale(.4); }
.adv-stop.done { background: color-mix(in srgb, var(--accent) 30%, var(--card, #2a2060)); }
.adv-stop.next { border-color: var(--accent); animation: advPulse 1.6s ease-in-out infinite; }
.adv-stop:focus-visible { outline: 4px solid var(--accent); outline-offset: 3px; }
.adv-stars { position: absolute; bottom: -14px; left: 50%; transform: translateX(-50%); display: flex; gap: 1px; font-size: .95rem; background: rgba(0, 0, 0, .55); border-radius: 10px; padding: 0 5px; font-style: normal; }
.adv-stars i { font-style: normal; color: rgba(255, 255, 255, .35); }
.adv-stars i.on { color: #ffd23f; }
.adv-boss { width: 25%; background: #fff; }
.adv-boss .adv-face { width: 86%; height: 86%; display: block; }
.adv-bonus { width: 14%; background: #ffd23f; border-color: #fff6c9; animation: advPulse 2s ease-in-out infinite; }
.adv-token { position: absolute; transform: translate(-50%, -50%); width: 15%; aspect-ratio: 1; pointer-events: none; transition: left .7s ease-in-out, top .7s ease-in-out; z-index: 2; }
.adv-token.hop { animation: advHop .7s ease-in-out; }
@keyframes advPulse { 0%, 100% { box-shadow: 0 6px 0 rgba(0, 0, 0, .25), 0 0 0 0 color-mix(in srgb, var(--accent) 60%, transparent); } 50% { box-shadow: 0 6px 0 rgba(0, 0, 0, .25), 0 0 0 12px transparent; } }
@keyframes advHop { 0%, 100% { margin-top: 0; } 50% { margin-top: -28px; } }
@media (prefers-reduced-motion: reduce) {
  .adv-token { transition: none; }
  .adv-token.hop, .adv-stop.next, .adv-bonus { animation: none; }
}
```

- [ ] **Step 3: Check it in the preview**

Start the preview (`mcp__Claude_Browser__preview_start` with name `math-quest-alt`). Then run this in the tab (it draws each world in turn without `app.js`):

```js
const mod = await import('/adventure.js?x=' + Date.now());
document.body.innerHTML = '<div id="m" style="max-width:420px;margin:20px auto"></div>';
const stops = [{ icon: '🔢', name: 'Math', stars: 3 }, { icon: '📖', name: 'Reading', stars: 1 }, { icon: '✏️', name: 'Writing', stars: 0 }, { icon: '🔬', name: 'Science', stars: 0 }, { icon: '🔢', name: 'Math', stars: 0 }];
window.__draw = (world, region) => mod.drawMap(document.getElementById('m'), { world, region, stops, stop: 2, bonus: true,
  boss: { face: mod.villainSvg(world, region), name: 'Glitch' }, token: mod.tokenSvg({ species: 'fox', body: '#ff9a4d', belly: '#fff4e6', accent: '#5d4037' }), from: 1 });
const map = __draw('space', 1); map.hopTo(2);
[document.querySelectorAll('.adv-stop').length, document.querySelectorAll('.adv-stop:disabled').length]
```

Expected: `[7, 3]` (5 stops, the boss and the bonus; stops 4–5 and the boss are disabled). Take a screenshot to confirm:
- the path goes through every marker;
- stop 1 shows 3 stars;
- the token hops from stop 2 to stop 3.

Then run `__draw('ocean', 3)`, `__draw('pets', 0)` and `__draw('bakery', 5)` and screenshot each. Check that the villains differ per world and the hats differ per region (bakery 5 has a crown), and that `mod.tokenSvg({ egg: true })` draws an egg. Make sure there are no console errors (`mcp__Claude_Browser__read_console_messages` with `onlyErrors: true`).

- [ ] **Step 4: Commit**

```bash
git add adventure.js style.css
git commit -m "Adventure map: drawn region scene, stop markers, creature token and villains"
```

---

### Task 3: Adventure data, sync merge and Grown-ups line

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes from Task 1: `window.AdventureRules`.
- Produces (in `app.js`, used by Tasks 4–5):
  - `const AR`;
  - `ensureAdventure(p) -> adv` (creates and fills stops, re-picks; may call `save()`);
  - `advPick(p) -> (subject, taken) => missionId|null`;
  - `advLook(p) -> look` (for `tokenSvg`);
  - `loadAdventureMod() -> Promise<module|null>`, plus `let advMod` (the loaded module or `null`);
  - `let homeScreen = 'practice'`, `let pendingHop = null`, `let typingStop = null`;
  - `const goHome = () => …`;
  - `mergePlayer` now merges `p.adventure`.

- [ ] **Step 1: Add the module handle and loader**

In `app.js`, right after the `loadCreature` function (the block that starts `let creatureMod = null, creatureView = null, creatureToken = 0;`), add:

```js
/* =========================================================
   Adventure map (spec: docs/superpowers/specs/2026-11-17-adventure-map-design.md)
   Rules: adventure-rules.js. Drawing: adventure.js, loaded when a map or boss shows.
   ========================================================= */
const AR = window.AdventureRules;   // missing only in a mixed-version boot: the app then stays on Free practice
let advMod = null, advModP = null;
function loadAdventureMod() {
  if (!advModP) advModP = import('./adventure.js' + (ASSET_Q ? '?' + ASSET_Q : '')).then(m => (advMod = m)).catch(() => { advModP = null; return null; });
  return advModP;
}
let homeScreen = 'practice';   // 'map' or 'practice': where Home / Back goes
let pendingHop = null;         // stop index the token hops from on the next map draw
let typingStop = null;         // stop index while a typing stop is being played
const goHome = () => (homeScreen === 'map' && AR ? showMap : showHome)();
```

(Task 5 defines `showMap`. Until then `homeScreen` stays `'practice'`, so `goHome` keeps going to `showHome`.)

- [ ] **Step 2: Add the adventure helpers**

Right after the `buildQuest` function (so `questMissions`, `progress`, `atLevel` and `typingProgress` already exist above it or are hoisted), add:

```js
/* ----- Adventure: stop picking ----- */
// Her least-practiced mission at her level in a subject, skipping ones already on this region's path.
function advPick(p) {
  return (subject, taken) => {
    let ids;
    if (subject === 'typing') ids = TYPING_LESSONS.filter(l => !l.game).map(l => l.id).sort((a, b) => typingProgress(p, a) - typingProgress(p, b));
    else { const v = atLevel(p, subject); ids = questMissions(p, subject).sort((a, b) => progress(v, a) - progress(v, b)); }
    return ids.find(id => !taken.includes(id)) || ids[0] || null;
  };
}
const advValid = (p, s) => s.subject === 'typing' ? !!TYPE_BY_ID[s.missionId] : questMissions(p, s.subject).includes(s.missionId);
function ensureAdventure(p) {
  if (!p.adventure || !AR.WORLDS[p.adventure.world]) p.adventure = AR.newAdventure(AR.WORLDS[p.theme] ? p.theme : 'space');
  const adv = p.adventure;
  if (!adv.picking && AR.repickStops(adv, subjectsFor(p), advPick(p), s => advValid(p, s))) { adv.updated = Date.now(); save(); }
  return adv;
}
const hexColor = n => '#' + n.toString(16).padStart(6, '0');
function advLook(p) {
  if (!hasPet(p)) return { egg: true };
  const sp = PR.SPECIES[p.pet.species], c = sp.patterns[p.pet.color || 0] || sp.patterns[0];
  return { species: p.pet.species, body: hexColor(c[0]), belly: hexColor(c[1]), accent: hexColor(c[2]) };
}
```

(`repickStops` also fills empty slots, so it covers a brand-new region as well.)

- [ ] **Step 3: Merge the adventure in sync**

In `mergePlayer`, right after the line `if (pet) m.pet = pet; else delete m.pet;`, add:

```js
  if (AR) { const adv = AR.mergeAdventure(a.adventure, b.adventure); if (adv) m.adventure = adv; else delete m.adventure; }
```

- [ ] **Step 4: Grown-ups adventure line and boss activity rows**

Add this function just above `function showParentDetail(`:

```js
function adventureLine(p) {
  const adv = p.adventure;
  if (!AR || !adv || !AR.WORLDS[adv.world]) return '';
  const w = AR.WORLDS[adv.world], stops = logSince(p, 7).filter(e => e.a === 'stop').length;
  const where = adv.picking ? `finished the ${w.name} world` : `${esc(w.regions[adv.region].name)} (region ${adv.region + 1} of ${AR.REGIONS})`;
  return `<p class="muted gu-note">🗺️ Adventure: ${esc(w.name)} world · ${where} · ${plural(stops, 'stop')} this week</p>`;
}
```

In `showParentDetail`, in the "Last 2 weeks" section, the `<p class="muted gu-note">🔥 …</p>` line is followed by `</section>`. Insert `${adventureLine(p)}` right after that `</p>` and before `</section>`.

In `activityText`, replace the `icon` and `what` lines with:

```js
  const icon = e.k === 'quest' ? '⭐' : e.k === 'journal' ? '📔' : e.k === 'boss' ? '⚔️' : (SUBJECTS[e.s] || {}).icon || '🎯';
  const what = e.k === 'quest' ? "Today's Quest" : e.k === 'journal' ? 'Journal' : e.k === 'boss' ? `Boss: ${AR ? AR.regionName(e.id) : e.id}` : e.k === 'game' ? (BLASTER[p.theme] || BLASTER.space).name : missionTitle(e.id);
```

- [ ] **Step 5: Route Home and Back through `goHome`**

Replace these `showHome` references with `goHome`. Find each by its exact text:
- `document.getElementById('back').onclick = () => after ? after() : existing ? showHome() : showProfiles();` becomes `… existing ? goHome() : showProfiles();`
- `save(); after ? after() : showHome();` becomes `save(); after ? after() : goHome();`
- every `document.getElementById('back').onclick = showHome;` (hatch, den, journal, collection, learn, high scores) becomes `… = goHome;`
- in `drawPlay`: `… speechSynthesis.cancel(); } catch (e) {} showHome(); };` becomes `… goHome(); };`
- `document.getElementById('home').onclick = showHome;` (finishMission, finishQuest, awardFinish) becomes `… = goHome;`
- `if (!typingAvailable(me())) return showHome();` becomes `return goHome();`
- in `startTyping`: `document.getElementById('quit').onclick = showHome;` becomes `document.getElementById('quit').onclick = () => { typingStop = null; goHome(); };`
- in `startBlaster`: `document.getElementById('quit').onclick = () => { g.alive = false; showHome(); };` becomes `… goHome(); };`

Leave the `showHome` calls inside `showHome` itself (subject tabs, sound, Grown-ups gate back), the keyboard-detected redraw (`if (screen === 'home' && …) showHome()`), the sync redraws, `openPlayer` and `showKidTour` alone. Task 5 changes those.

At the top of `showHome`, after `const p = me(); if (!p) return showProfiles();`, add:

```js
  homeScreen = 'practice';
```

- [ ] **Step 6: Check it**

Run `node --check app.js && node --test 'tests/*.test.js'`. Expected: no syntax error, all tests pass.

In the preview (seed the player from the harness section, then load the harness):
- `__t.ensureAdventure(__t.me())` returns `world: 'space'`, `region: 0`, `stop: 0`, 5 stops, every one with a `missionId`, and subjects rotating `math, reading, writing, science, math` (2nd grader: social is off by default and there's no keyboard in the preview).
- Run `__t.me().subjects = { reading: false }; __t.ensureAdventure(__t.me())`: no unplayed stop has `subject: 'reading'`.
- The Grown-ups detail page shows the 🗺️ line. Reach it with `showParentDetail` (add it to `__t`) or through the PIN gate.
- The app still opens on the old home screen, and the den, journal and collection Back buttons return there.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "Adventure map: stop picking, sync merge, Grown-ups line, Home routing"
```

---

### Task 4: Playing stops and the boss

**Files:**
- Modify: `app.js`
- Modify: `style.css` (append the boss styles)

**Interfaces:**
- Consumes from Task 3: `AR`, `ensureAdventure`, `advMod`, `loadAdventureMod`, `pendingHop`, `typingStop`, `goHome`.
- Produces:
  - `startStop(i)`;
  - `startBoss() -> Promise`;
  - `finishBoss()`;
  - `game.adv = { kind: 'stop', i } | { kind: 'boss' }`;
  - `game.slots` mode (generalized from Today's Quest).
  - Log entries for stops get `a: 'stop'`; bosses log `k: 'boss'` with `id = regionKey`.
  - After a stop that moves her forward, `pendingHop` is set to that stop's index.

- [ ] **Step 1: Make the "slots" mode generic**

In `nextQuestion`, replace

```js
  else if (game.quest) { const slot = game.slots[game.qi++]; q = slot.make(atLevel(me(), slot.subject), game); q.slot = slot; }
```

with

```js
  else if (game.slots) { const slot = game.slots[game.qi++]; q = slot.make(atLevel(me(), slot.subject), game); q.slot = slot; }
```

In `pushRetry`, replace the function with:

```js
function pushRetry() {
  bossReact(false);
  if (game.slots && game.q.retried) return;
  game.q.retried = true;
  game.retry.push({ q: game.q, at: game.n + 3 });
}
```

In `answeredRight`, replace

```js
  if (game.tries === 1) { record(p, game.q.key, true); game.firstTry++; }
```

with

```js
  if (game.tries === 1) { record(p, game.q.key, true); game.firstTry++; bossReact(true); }
```

and replace

```js
  document.getElementById('bar').style.width = (game.n / game.len * 100) + '%';
```

with

```js
  const bar = document.getElementById('bar'); if (bar) bar.style.width = (game.n / game.len * 100) + '%';
```

In `finishMission`, replace its first line `if (game.quest) return finishQuest();` with:

```js
  if (game.adv && game.adv.kind === 'boss') return finishBoss();
  if (game.quest) return finishQuest();
```

- [ ] **Step 2: Starting a stop and the boss**

Add after the `ensureAdventure` block from Task 3:

```js
/* ----- Adventure: playing stops and the boss ----- */
function slotGame(extra) {
  return Object.assign({ used: new Set(), n: 0, firstTry: 0, recent: [], retry: [], q: null, input: '', tries: 0, locked: false,
    queue: null, qi: 0, started: Date.now() }, extra);
}
const slotMaker = (subject, mid) => subject === 'math' ? mathMaker(mid) : bankMaker(mid);
function startStop(i) {
  const p = me(), adv = ensureAdventure(p), s = adv.stops[i];
  if (!s || i > adv.stop || adv.picking) return goHome();
  if (s.subject === 'typing') { typingStop = i; return startTyping(s.missionId); }
  const make = slotMaker(s.subject, s.missionId);
  game = slotGame({ missionId: s.missionId, subject: s.subject, adv: { kind: 'stop', i }, len: AR.STOP_LEN,
    slots: Array.from({ length: AR.STOP_LEN }, () => ({ subject: s.subject, mid: s.missionId, make })) });
  nextQuestion();
}
async function startBoss() {
  const p = me(), adv = ensureAdventure(p);
  if (!AR.bossReady(adv)) return goHome();
  await loadAdventureMod();
  // the region's own missions, in path order (typing has no single questions)
  let list = adv.stops.filter(s => s && s.subject !== 'typing' && advValid(p, s)).map(s => ({ subject: s.subject, mid: s.missionId }));
  if (!list.length) { const mid = advPick(p)('math', []); list = mid ? [{ subject: 'math', mid }] : []; }
  if (!list.length) return goHome();
  const slots = Array.from({ length: AR.BOSS_LEN }, (_, k) => { const x = list[k % list.length]; return { subject: x.subject, mid: x.mid, make: slotMaker(x.subject, x.mid) }; });
  game = slotGame({ missionId: 'boss', subject: slots[0].subject, adv: { kind: 'boss' }, len: AR.BOSS_LEN, slots });
  nextQuestion();
}
function bossBarHtml() {
  const adv = me().adventure, face = advMod ? advMod.villainSvg(adv.world, adv.region) : '<span class="pet-emoji">👾</span>';
  const hits = Math.min(game.firstTry, AR.BOSS_WIN);
  return `<div class="boss-bar"><span class="boss-face" id="bossFace" aria-hidden="true">${face}</span>
    <span class="boss-hits" role="img" aria-label="${hits} of ${AR.BOSS_WIN} hits">${Array.from({ length: AR.BOSS_WIN }, (_, k) => `<i class="${k < hits ? 'hit' : ''}"></i>`).join('')}</span></div>`;
}
// a first-try right answer knocks off a mark and makes the villain wobble; a miss makes it laugh
function bossReact(ok) {
  if (!game || !game.adv || game.adv.kind !== 'boss') return;
  const face = document.getElementById('bossFace');
  if (!face) return;
  face.classList.remove('wobble', 'laugh'); void face.offsetWidth; face.classList.add(ok ? 'wobble' : 'laugh');
  const marks = document.querySelectorAll('.boss-hits i');
  if (ok && marks[game.firstTry - 1]) marks[game.firstTry - 1].classList.add('hit');
  const hb = document.querySelector('.boss-hits'); if (hb) hb.setAttribute('aria-label', `${Math.min(game.firstTry, AR.BOSS_WIN)} of ${AR.BOSS_WIN} hits`);
}
```

- [ ] **Step 3: The play screen shows the stop or the boss**

In `drawPlay`, replace the first lines

```js
  const p = me(), th = theme(p), qs = game.q.slot;
  const tm = qs ? { icon: '⭐', name: qs.review ? '🔁 Practice again' : `${SUBJECTS[qs.subject].icon} ${SUBJECTS[qs.subject].name}` }
    : BANK[game.missionId] ? BANK[game.missionId].mission : th.missions[game.missionId];
```

with

```js
  const p = me(), th = theme(p), qs = game.q.slot, adv = game.adv, boss = adv && adv.kind === 'boss';
  const tm = boss ? { icon: '⚔️', name: `Beat ${esc(AR.WORLDS[p.adventure.world].villainShort)}!` }
    : adv ? { icon: SUBJECTS[game.subject].icon, name: `Stop ${adv.i + 1} · ${SUBJECTS[game.subject].name}` }
    : qs ? { icon: '⭐', name: qs.review ? '🔁 Practice again' : `${SUBJECTS[qs.subject].icon} ${SUBJECTS[qs.subject].name}` }
    : BANK[game.missionId] ? BANK[game.missionId].mission : th.missions[game.missionId];
```

and replace the meter line

```js
      <div class="meter"><span>${th.meterIcon} ${th.meter}</span><span class="bar"><i id="bar" style="width:${pct}%"></i></span></div>
```

with

```js
      ${boss ? bossBarHtml() : `<div class="meter"><span>${th.meterIcon} ${th.meter}</span><span class="bar"><i id="bar" style="width:${pct}%"></i></span></div>`}
```

- [ ] **Step 4: Finishing a stop**

In `finishMission`, right after the `logActivity(p, 'mission', …)` line, add:

```js
  const advI = game.adv ? game.adv.i : null;
  let advStars = 0;
  if (advI != null) {
    p.log[p.log.length - 1].a = 'stop';
    advStars = AR.starsFor(game.firstTry);
    const adv = p.adventure, s = adv && adv.stops[advI];
    if (s && s.missionId === game.missionId && AR.finishStop(adv, advI, advStars)) pendingHop = advI;
  }
```

In the same function's `render`, replace the `<div class="row-actions">…</div>` block (Play again / collection / Home) with:

```js
      ${advI != null ? `<p class="adv-stars-big" aria-label="${advStars} of 3 stars">${[1, 2, 3].map(k => `<span class="${k <= advStars ? 'on' : ''}">★</span>`).join('')}</p>` : ''}
      <div class="row-actions">
        ${advI != null ? `<button class="btn" id="home">Back to map</button><button class="btn ghost" id="again">Play again</button>`
          : `<button class="btn" id="again">Play again</button>
        <button class="btn ghost" id="coll">${th.collection}</button>
        <button class="btn ghost" id="home">Home</button>`}
      </div>
```

and replace the three handler lines after the render with:

```js
  document.getElementById('again').onclick = () => advI != null ? startStop(advI) : startMission(missionId);
  const collBtn = document.getElementById('coll'); if (collBtn) collBtn.onclick = showCollection;
  document.getElementById('home').onclick = goHome;
```

- [ ] **Step 5: Finishing a typing stop**

In `finishTyping`, right after the line `const goal = typeTarget(p), stars = …;`, add:

```js
  if (typingStop != null && p.adventure) {
    const adv = p.adventure, s = adv.stops[typingStop];
    p.log[p.log.length - 1].a = 'stop';
    if (s && s.missionId === lesson.id && AR.finishStop(adv, typingStop, AR.typingStars(stars === 3))) pendingHop = typingStop;
    typingStop = null;
  }
```

In `awardFinish`, change the Home button text from `Home` to `${homeScreen === 'map' ? 'Back to map' : 'Home'}`.

- [ ] **Step 6: Finishing the boss**

Add after `bossReact`:

```js
function finishBoss() {
  const p = me(), th = theme(p), adv = p.adventure, right = game.firstTry, len = game.len;
  const won = AR.bossWon(right), world = AR.WORLDS[adv.world], reg = world.regions[adv.region];
  const face = advMod ? advMod.villainSvg(adv.world, adv.region) : '<span class="pet-emoji">👾</span>';
  logActivity(p, 'boss', AR.regionKey(adv), 'quest', right, len, game.started);
  const earned = right + (won ? 10 : 0);
  p.points += earned;
  touchStreak(p);
  updatePet(p);
  const result = won ? AR.finishBoss(adv) : null;
  save();
  game = null;
  if (won) { sfx.win(); confetti(th.pointIcon); } else sfx.bad();
  render(`
    <div class="result stack card adv-boss-end">
      <div class="adv-villain ${won ? 'run-off' : 'laugh'}" aria-hidden="true">${face}</div>
      <h1>${won ? esc(reg.win) : `${esc(world.villainShort)} got away!`}</h1>
      ${petMomentHtml(p)}
      <p class="score">You got <b>${right} of ${len}</b> right on the first try
        ${won ? '' : `<br>Get ${AR.BOSS_WIN} right to win. Try again?`}<br>+${earned} ${th.point} ${th.pointIcon}</p>
      <div class="row-actions">
        ${won ? `<button class="btn" id="next">${result === 'world' ? 'Finish the world!' : 'Next region →'}</button>`
          : `<button class="btn" id="again">Try again</button><button class="btn ghost" id="home">Back to map</button>`}
      </div>
    </div>`, 'boss-end');
  const nx = document.getElementById('next'); if (nx) nx.onclick = goHome;
  const ag = document.getElementById('again'); if (ag) ag.onclick = startBoss;
  const hm = document.getElementById('home'); if (hm) hm.onclick = goHome;
  bindPetMoment(p);
}
```

- [ ] **Step 7: Boss styles**

Append to `style.css`:

```css
/* Adventure: boss fight and stop results */
.boss-bar { display: flex; align-items: center; gap: 14px; padding: 6px 4px; }
.boss-face { width: 64px; height: 64px; flex: none; display: grid; place-items: center; }
.boss-face .pet-emoji { font-size: 2.6rem; }
.boss-hits { display: flex; gap: 6px; flex: 1; }
.boss-hits i { flex: 1; height: 16px; border-radius: 8px; background: #e94b5b; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, .2); transition: background .3s, transform .3s; }
.boss-hits i.hit { background: rgba(255, 255, 255, .18); transform: scale(.85); }
.boss-face.wobble { animation: bossWobble .5s ease-in-out; }
.boss-face.laugh, .adv-villain.laugh { animation: bossLaugh .6s ease-in-out 2; }
.adv-villain { width: 140px; height: 140px; margin: 0 auto; }
.adv-villain.run-off { animation: bossRun 1.4s ease-in .4s forwards; }
.adv-stars-big { font-size: 2.6rem; margin: 0; letter-spacing: .1em; }
.adv-stars-big span { color: rgba(255, 255, 255, .25); }
.adv-stars-big span.on { color: #ffd23f; }
@keyframes bossWobble { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-14deg) scale(.92); } 75% { transform: rotate(10deg); } }
@keyframes bossLaugh { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px) scale(1.06); } }
@keyframes bossRun { to { transform: translateX(160%) rotate(20deg); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .boss-face.wobble, .boss-face.laugh, .adv-villain.laugh, .adv-villain.run-off { animation: none; } }
```

- [ ] **Step 8: Check it**

Run `node --check app.js && node --test 'tests/*.test.js'`. Expected: no syntax error, all pass.

In the preview with the harness:
- **Today's Quest still works:** call `startQuest()` from the old home (tap the quest card). It's 10 questions, and its finish screen shows "Home".
- **A stop:**
  - `__t.ensureAdventure(__t.me()); __t.startStop(0)`. The chip reads "Stop 1 · Math" and the counter shows 6 questions.
  - Answer all 6. The finish screen shows stars and the buttons **Back to map** and **Play again**.
  - `__t.me().adventure.stop === 1`, the last log entry has `a: 'stop'`, and `p.missions[<missionId>].plays` went up.
- **A replay:** `__t.startStop(0)`, finish it, and `adventure.stop` stays 1.
- **A locked stop:** `__t.startStop(3)` goes back home and doesn't start.
- **The boss:**
  - Set `adv.stop = 5`, then run `await __t.startBoss()`. You see the villain and 6 red marks. A right first try turns one mark grey and the villain wobbles; a wrong one makes it laugh.
  - Lose: answer 3 or more wrong first. You get "… got away!" with **Try again**, and `adventure.region` stays 0.
  - Win: `adventure.region` becomes 1, `stops` is empty, and the log has `k: 'boss', id: 'space:0'`.
- **No console errors.**

- [ ] **Step 9: Commit**

```bash
git add app.js style.css
git commit -m "Adventure map: play stops and the boss through the question engine"
```

---

### Task 5: The map screen, region intro, world picker and navigation

**Files:**
- Modify: `app.js`
- Modify: `style.css` (append the map screen styles)

**Interfaces:**
- Consumes:
  - Task 2: `drawMap`, `villainSvg`, `tokenSvg`;
  - Task 3: `ensureAdventure`, `advLook`, `loadAdventureMod`, `advMod`, `homeScreen`, `pendingHop`, `goHome`;
  - Task 4: `startStop`, `startBoss`.
- Produces:
  - `showMap(opts = {}) -> Promise`, with `opts.y` restoring the scroll position;
  - `showRegionIntro() -> Promise`;
  - `showWorldPicker(celebrate = false)`;
  - `advListHtml(adv, stops)` (the fallback).

- [ ] **Step 1: The map screen**

Add after `finishBoss` from Task 4:

```js
/* ----- Adventure: the map (her home screen) ----- */
function advListHtml(adv, stops) {
  return `<ol class="adv-list">${stops.map((s, i) => s ? `<li><button class="btn ${i === adv.stop ? '' : 'ghost'}" data-stop="${i}" ${i > adv.stop ? 'disabled' : ''}>
      ${s.icon} Stop ${i + 1}: ${esc(s.name)}${i < adv.stop ? ` ${'★'.repeat(s.stars)}` : ''}</button></li>` : '').join('')}
    <li><button class="btn ${adv.stop >= AR.STOPS ? '' : 'ghost'}" data-stop="5" ${adv.stop >= AR.STOPS ? '' : 'disabled'}>⚔️ Boss: ${esc(AR.WORLDS[adv.world].villainShort)}</button></li></ol>`;
}
async function showMap(opts = {}) {
  const p = me(); if (!p) return showProfiles();
  if (!AR) return showHome();
  homeScreen = 'map'; typingStop = null;
  applyTheme(p.theme);
  const adv = ensureAdventure(p);
  if (adv.picking) return showWorldPicker();
  if (!adv.seenIntro.includes(AR.regionKey(adv))) return showRegionIntro();
  const th = theme(p), world = AR.WORLDS[adv.world], reg = world.regions[adv.region];
  const streakOk = p.lastDay && dayDiff(p.lastDay, today()) <= 1;
  const journalOn = SUBJECTS.writing && SUBJECTS.writing.journalPrompts && subjectsFor(p).includes('writing');
  render(`
    <div class="topbar">
      <button class="btn ghost small" id="me">${p.avatar} ${esc(p.name)} ⚙️</button>
      <div class="chips">
        <span class="chip" title="${th.point}">${th.pointIcon} ${p.points}</span>
        <span class="chip" title="days in a row">🔥 ${streakOk ? p.streak : 0}</span>
        <button class="chip" id="snd" aria-label="Sound" aria-pressed="${state.sound}">${state.sound ? '🔊' : '🔇'}</button>
      </div>
    </div>
    <div class="adv-head">
      <button class="adv-title" id="intro"><b>${esc(reg.name)}</b><span class="muted">${esc(world.name)} world · Region ${adv.region + 1} of ${AR.REGIONS}</span></button>
      <span class="adv-dots" aria-hidden="true">${Array.from({ length: AR.REGIONS }, (_, k) => `<i class="${k < adv.region ? 'done' : k === adv.region ? 'here' : ''}"></i>`).join('')}</span>
    </div>
    <div id="advMap" class="adv-map-wrap"></div>
    <nav class="adv-bar" aria-label="More to do">
      <button class="btn ghost small" id="practice">📚 Free practice</button>
      <button class="btn ghost small" id="petBtn">${hasPet(p) ? `🐾 ${esc(p.pet.name)}` : '🥚 My egg'}</button>
      ${journalOn ? '<button class="btn ghost small" id="journal">📔 Journal</button>' : ''}
      <button class="btn ghost small" id="coll">${esc(th.collection)}</button>
      <button class="btn ghost small" id="switchP">🔄 Switch player</button>
      <button class="btn ghost small" id="grown">👪 Grown-ups</button>
    </nav>`, 'map');
  document.getElementById('me').onclick = () => showEditProfile(p);
  document.getElementById('snd').onclick = () => { state.sound = !state.sound; save(); showMap({ y: window.scrollY }); };
  document.getElementById('intro').onclick = () => showRegionIntro();
  document.getElementById('practice').onclick = showHome;
  document.getElementById('petBtn').onclick = () => hasPet(p) ? showDen() : showHatch();
  const jb = document.getElementById('journal'); if (jb) jb.onclick = () => showJournal();
  document.getElementById('coll').onclick = showCollection;
  document.getElementById('switchP').onclick = showProfiles;
  document.getElementById('grown').onclick = () => showParentGate(showParents, showMap);
  const el = document.getElementById('advMap'), seq = renderSeq;
  const stops = adv.stops.map(s => s && { icon: (SUBJECTS[s.subject] || {}).icon || '🎯', name: (SUBJECTS[s.subject] || {}).name || s.subject, stars: s.stars });
  const hop = pendingHop; pendingHop = null;
  const mod = await loadAdventureMod();
  if (seq !== renderSeq) return;   // she left the map while the drawing loaded
  if (mod) {
    const map = mod.drawMap(el, { world: adv.world, region: adv.region, stops, stop: adv.stop, bonus: !questDoneToday(p),
      boss: { face: mod.villainSvg(adv.world, adv.region), name: world.villainShort }, token: mod.tokenSvg(advLook(p)), from: hop != null && hop !== adv.stop ? hop : null });
    if (hop != null && hop !== adv.stop) map.hopTo(adv.stop);
  } else el.innerHTML = advListHtml(adv, stops);
  el.querySelectorAll('[data-stop]').forEach(b => { b.onclick = () => +b.dataset.stop === 5 ? startBoss() : startStop(+b.dataset.stop); });
  const bonus = el.querySelector('[data-bonus]'); if (bonus) bonus.onclick = startQuest;
  if (opts.y != null) window.scrollTo(0, opts.y);
  else { const next = el.querySelector('.adv-stop.next, .adv-list .btn:not(.ghost)'); if (next) next.scrollIntoView({ block: 'center' }); }
}
```

(`renderSeq` already exists and goes up on every `render`, so it tells whether she navigated away.)

- [ ] **Step 2: The region intro and world picker**

Add after `showMap`:

```js
async function showRegionIntro() {
  const p = me(), adv = p.adventure, world = AR.WORLDS[adv.world], reg = world.regions[adv.region];
  applyTheme(p.theme);
  await loadAdventureMod();
  render(`
    <div class="kid-welcome stack adv-intro">
      <p class="setup-step center">${esc(world.name)} world · Region ${adv.region + 1} of ${AR.REGIONS}</p>
      <div class="pet-view large" id="petView">${hasPet(p) ? '' : '<span class="pet-emoji" aria-hidden="true">🥚</span>'}</div>
      <h1 id="riH">${esc(reg.name)}</h1>
      <p class="adv-problem">${esc(reg.problem)}</p>
      ${advMod ? `<div class="adv-watch"><span class="adv-watch-face" aria-hidden="true">${advMod.villainSvg(adv.world, adv.region)}</span><span>Watch out for ${esc(world.villainShort)}!</span></div>` : ''}
      <div class="setup-actions"><button class="btn big-btn" id="go">Let's go!</button></div>
    </div>`, 'intro');
  focusHeading();
  if (hasPet(p)) showCreature(document.getElementById('petView'), p, { interactive: false });
  document.getElementById('go').onclick = () => {
    const k = AR.regionKey(adv);
    if (!adv.seenIntro.includes(k)) { adv.seenIntro.push(k); adv.updated = Date.now(); save(); }
    showMap();
  };
}
function showWorldPicker(celebrate = false) {
  const p = me(), adv = p.adventure, done = AR.WORLDS[adv.world];
  applyTheme(p.theme);
  render(`
    <div class="kid-welcome stack">
      <div class="pet-view large" id="petView">${hasPet(p) ? '' : '<span class="pet-emoji" aria-hidden="true">🥚</span>'}</div>
      <h1 id="wpH">You finished the ${esc(done.name)} world!</h1>
      <p class="muted center">Pick your next world.</p>
      <div class="world-pick" role="group" aria-labelledby="wpH">${AR.nextWorlds(adv).map(id => `<button class="world-card" data-world="${id}">
        <span class="wc-icon" aria-hidden="true">${THEMES[id].icon}</span><b>${esc(AR.WORLDS[id].name)}</b><span class="muted">${WORLD_BLURB[id] || ''}</span></button>`).join('')}</div>
    </div>`, 'worlds');
  focusHeading();
  if (celebrate) { sfx.win(); confetti('🏆'); }
  if (hasPet(p)) showCreature(document.getElementById('petView'), p, { interactive: false }).then(v => { if (v && celebrate) v.celebrate('grow'); });
  bindAll('[data-world]', b => { AR.startWorld(adv, b.dataset.world); save(); showMap(); });
}
```

In `finishBoss` (Task 4), change `const nx = document.getElementById('next'); if (nx) nx.onclick = goHome;` to:

```js
  const nx = document.getElementById('next'); if (nx) nx.onclick = () => result === 'world' ? showWorldPicker(true) : showMap();
```

- [ ] **Step 3: Make the map her home**

- In `openPlayer`, replace `if (!FR.needsKidWelcome(p)) return showHome();` with:

  ```js
    if (!FR.needsKidWelcome(p)) { homeScreen = 'map'; return goHome(); }
  ```

- In `showKidTour`, replace `const done = () => { p.introSeen = true; save(); showHome(); };` with:

  ```js
    const done = () => { p.introSeen = true; save(); homeScreen = 'map'; goHome(); };
  ```

  Also replace the first tour card `{ pic: tabs, text: 'Pick a subject, then a mission.' },` with:

  ```js
    { pic: tabs, text: 'Follow the path! Each stop on your map is a mission.' },
  ```

- In `showHome`, add a map button as the first thing inside `<div class="topbar">`:

  ```js
        ${AR ? '<button class="btn ghost small" id="toMap">← Map</button>' : ''}
  ```

  and after its other handlers, add:

  ```js
    const tm = document.getElementById('toMap'); if (tm) tm.onclick = () => showMap();
  ```

- In `doSync`, replace

  ```js
      if (changedView && !game && (screen === 'profiles' || screen === 'home')) {
        const y = window.scrollY;   // a background refresh shouldn't jump her to the top
        (screen === 'home' && me() ? showHome : showProfiles)();
        window.scrollTo(0, y);
      }
  ```

  with

  ```js
      if (changedView && !game && (screen === 'profiles' || screen === 'home' || screen === 'map')) {
        const y = window.scrollY;   // a background refresh shouldn't jump her to the top
        if (screen === 'map' && me()) showMap({ y });
        else { (screen === 'home' && me() ? showHome : showProfiles)(); window.scrollTo(0, y); }
      }
  ```

- In the legacy sign-in redraw near the bottom, replace `(screen === 'home' || screen === 'profiles')) (me() ? showHome : showProfiles)();` with `(screen === 'home' || screen === 'profiles' || screen === 'map')) (me() ? goHome : showProfiles)();`.

- [ ] **Step 4: Map screen styles**

Append to `style.css`:

```css
/* Adventure: map screen */
.adv-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 4px 0 14px; }
.adv-title { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; background: none; border: 0; color: inherit; font: inherit; cursor: pointer; padding: 4px 0; text-align: left; }
.adv-title b { font-size: 1.7rem; line-height: 1.1; }
.adv-dots { display: flex; gap: 6px; }
.adv-dots i { width: 12px; height: 12px; border-radius: 50%; background: rgba(255, 255, 255, .25); }
.adv-dots i.done { background: var(--accent); }
.adv-dots i.here { background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 40%, transparent); }
.adv-map-wrap { min-height: 60vh; }
.adv-bar { position: sticky; bottom: 0; z-index: 3; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; padding: 12px 8px calc(12px + env(safe-area-inset-bottom));
  margin-top: 16px; background: color-mix(in srgb, var(--bg, #1a1036) 85%, transparent); backdrop-filter: blur(8px); border-radius: 18px 18px 0 0; }
.adv-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.adv-list .btn { width: 100%; justify-content: flex-start; }
.adv-intro .adv-problem { font-size: 1.35rem; text-align: center; margin: 0; max-width: 32ch; }
.adv-watch { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.adv-watch-face { width: 56px; height: 56px; display: block; }
```

- [ ] **Step 5: Check it**

Run `node --check app.js && node --test 'tests/*.test.js'`. Expected: no syntax error, all pass.

In the preview with the harness, check each of these. Take screenshots of the map at phone width (`resize_window` mobile) and at iPad width (768×1024), and reset to desktop afterward.

- [ ] **New player** (seed without `adventure`). Opening her goes to the **region intro**: "Launch Pad", the problem line, the 3D creature, and "Watch out for Glitch!". **Let's go!** opens the map, scrolled so stop 1 is in view. Reload: the intro doesn't show again.
- [ ] **Map:**
  - stop 1 pulses;
  - stops 2–5 and the boss are dimmed and can't be tapped;
  - the ⭐ bonus marker shows (no quest today);
  - the title bar says "Space world · Region 1 of 6", with 6 dots.
- [ ] **Play stop 1.** Back to map: the token hops from stop 1 to stop 2, and stop 1 shows stars. For reduced motion, confirm in `style.css` that the `@media (prefers-reduced-motion: reduce)` rules from Tasks 2 and 4 cover `.adv-token`, `.adv-stop.next`, `.adv-bonus` and the villain animations (the preview can't emulate the setting).
- [ ] **Bonus stop:** tapping it plays Today's Quest. After finishing, Home goes back to the map and the bonus marker is gone.
- [ ] **Free practice** opens the old home with **← Map**. A mission played there returns to Free practice on Home and doesn't move the map.
- [ ] **Bottom bar:** creature (den Back returns to the map), Journal (only when Writing is on), Collection, Switch player and Grown-ups all work.
- [ ] **Boss and world end:** set `adventure.stop = 5`, redraw, and tap the boss. A win leads to **Next region →**, then the Moon Base intro. Set `adventure.region = 5, stop = 5` and win: **Finish the world!** opens the world picker with confetti, offering Ocean, Pets and Bakery. Picking Ocean opens the Sunny Shallows intro, and the map is drawn in ocean style.
- [ ] **Each world's style:** set `adventure.world` to each of `ocean`, `pets` and `bakery`, and redraw. All are readable at phone and iPad width.
- [ ] **Existing player** with stats, missions and a pet: opening her lands on the map (after the intro). Her mastery, creature stage and gear are unchanged.
- [ ] **Fallback list:** `advModP = null; advMod = null;`, then make the import fail (rename `adventure.js` temporarily, or point the import at a missing file). The map shows the list of stops, and the stops still start. Restore the file afterward.
- [ ] **No console errors.**

- [ ] **Step 6: Commit**

```bash
git add app.js style.css
git commit -m "Adventure map: the map is her home screen, with region intros and the world picker"
```

---

## After all tasks

- Final whole-branch review (most capable model).
- Then merge to `main`, deploy with `server/deploy.sh` and push, only when the user says so.
- After deploy, check on live:
  - `sw.js` is `quest-academy-v8`;
  - `adventure.js?…` and `adventure-rules.js?v=<sha>` return 200;
  - one stop played on each girl's iPad shows on the other after a sync.
