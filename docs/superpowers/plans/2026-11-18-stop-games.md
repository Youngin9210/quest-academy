# Stop Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a small untimed game scene (Build, Journey or Collect) above the questions at each adventure-map stop. Each answer is one move in the game, and each finished stop leaves a small trophy beside its marker on the map.

**Architecture:**
- Pure rules (`sceneFor`, `trophyGold`) go in `adventure-rules.js`, with Node tests.
- All drawing goes in a new lazy-loaded ES module, `scenes.js`. It holds string-returning SVG builders plus one small DOM helper for animations.
- `app.js` draws the scene from state on every question, the way the boss bar works, and animates only the newest move.

**Tech Stack:**
- Vanilla JS, no build step.
- ES modules loaded with dynamic `import()` plus the `ASSET_Q` cache query.
- SVG and CSS animations.
- `node --test 'tests/*.test.js'` (Node 22).

**Spec:** `docs/superpowers/specs/2026-11-18-stop-games-design.md`

## Global Constraints

- Untimed: the scene never moves on its own, and there is no clock.
- Only map stops get a scene. Free practice, Today's Quest, the boss (which keeps its hit bar) and typing stops are unchanged.
- Each stop has 6 moves (`AR.STOP_LEN`):
  - a first-try right answer is a `'gold'` move;
  - a right answer after a miss, or the "Next →" after the answer is shown, is a `'plain'` move;
  - a first miss plays a `'miss'` reaction that changes nothing.
- Game type by stop position: `i % 3` → 0 `'build'`, 1 `'journey'`, 2 `'collect'`.
- Gold color: `#ffcf3f`. A map trophy is gold when the stop has 3 stars.
- Nothing new is saved in the player data. Moves live only on `game.moves`.
- If `scenes.js` or `adventure.js` fails to load, the stop plays with the plain progress meter.
- Respect `prefers-reduced-motion`: pieces just appear, with no bounces, wobbles, hops or sparkles.
- Accessibility:
  - the scene is `role="img"` with an aria-label such as "Rocket: 3 of 6 pieces";
  - map trophies are `aria-hidden`.
- Commits:
  - never add attribution lines to commit messages;
  - work on the branch `stop-games`;
  - the user approves every deploy, so no task deploys.
- `sw.js`: CACHE becomes `quest-academy-v9`, and `scenes.js` is added to CORE.

---

### Task 1: Scene rules in adventure-rules.js

**Files:**
- Modify: `adventure-rules.js` (constants near line 7; the `api` object near line 158)
- Test: `tests/adventure-rules.test.js` (append)

**Interfaces:**
- Produces:
  - `AR.SCENES` = `['build', 'journey', 'collect']`;
  - `AR.sceneFor(i: number) -> 'build'|'journey'|'collect'`;
  - `AR.trophyGold(stars: number) -> boolean` (true only at 3 or more).

- [ ] **Step 1: Write the failing tests.** Append to `tests/adventure-rules.test.js`:

```js
test('stops rotate Build, Journey, Collect by position', () => {
  assert.deepEqual(AR.SCENES, ['build', 'journey', 'collect']);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(AR.sceneFor), ['build', 'journey', 'collect', 'build', 'journey', 'collect']);
});

test('a map trophy is gold only at 3 stars', () => {
  assert.deepEqual([0, 1, 2, 3].map(AR.trophyGold), [false, false, false, true]);
  assert.equal(AR.trophyGold(undefined), false);
});
```

- [ ] **Step 2: Run the tests and check that they fail.**

Run: `node --test 'tests/*.test.js'`
Expected: the 2 new tests FAIL (`AR.sceneFor is not a function`, or a deepEqual on undefined).

- [ ] **Step 3: Implement.** In `adventure-rules.js`, after the line `const STOPS = 5, STOP_LEN = 6, BOSS_LEN = 8, BOSS_WIN = 6, REGIONS = 6;` add:

```js
  // stop games (part 2): the game at a stop comes from its position, and a stop's map trophy is gold at 3 stars
  const SCENES = ['build', 'journey', 'collect'];
  const sceneFor = i => SCENES[((i % 3) + 3) % 3];
  const trophyGold = stars => (stars || 0) >= 3;
```

Then add `SCENES, sceneFor, trophyGold` to the `api` object, for example right after `REGIONS,` on its first line:

```js
  const api = { STOPS, STOP_LEN, BOSS_LEN, BOSS_WIN, REGIONS, SCENES, sceneFor, trophyGold, WORLDS, WORLD_ORDER, regionKey, regionName, newAdventure,
```

- [ ] **Step 4: Run the tests and check that they pass.**

Run: `node --test 'tests/*.test.js'`
Expected: all tests pass (49).

- [ ] **Step 5: Commit**

```bash
git add adventure-rules.js tests/adventure-rules.test.js
git commit -m "Stop games: scene rotation and gold trophy rules"
```

---

### Task 2: scenes.js drawing module and its styles

**Files:**
- Create: `scenes.js`
- Create: `tests/scenes.test.js`
- Modify: `style.css` (append a block at the end)

**Interfaces:**
- Consumes: nothing from app.js. The creature token's SVG markup comes in as the `token` string.
- Produces (ES module exports):
  - `sceneHtml(o: { type, world, token, moves, fresh? }) -> string`: a `<div class="scene" role="img" aria-label=…>` holding the drawing. `moves` is an array of `'gold'|'plain'`, and `fresh: true` marks the newest move to animate.
  - `sceneMove(el: HTMLElement, o, kind: 'gold'|'plain'|'miss') -> void`:
    - for gold or plain, it redraws `el.innerHTML` with `fresh: true` and starts the Journey hop;
    - for miss, it replays the `sc-miss` class on `.scene`.
  - `trophySvg(type, world, gold: boolean) -> string`: a small `<svg>` for the map.
  - `sceneLabel(type, world, count) -> string`.
  - Unknown worlds fall back to `'space'`, and unknown types fall back to `'build'`.

- [ ] **Step 1: Write the failing tests.** Create `tests/scenes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const count = (s, needle) => s.split(needle).length - 1;
let S;
test.before(async () => { S = await import('../scenes.js'); });

test('build draws placed pieces, gold ones glowing, and ghosts for the rest', () => {
  const h = S.sceneHtml({ type: 'build', world: 'space', token: '<svg></svg>', moves: ['gold', 'plain'] });
  assert.equal(count(h, 'class="sc-piece'), 2);
  assert.equal(count(h, 'class="sc-ghost'), 4);
  assert.equal(count(h, 'sc-gold'), 1);
  assert.equal(count(h, 'sc-next'), 1);
  assert.match(h, /role="img"/);
  assert.match(h, /aria-label="Rocket: 2 of 6 pieces"/);
  assert.doesNotMatch(h, /sc-new|sc-spark/);
});

test('a fresh gold move is animated with a sparkle; a fresh plain move has no sparkle', () => {
  const g = S.sceneHtml({ type: 'collect', world: 'ocean', token: '', moves: ['plain', 'gold'], fresh: true });
  assert.equal(count(g, 'sc-new'), 1);
  assert.equal(count(g, 'sc-spark'), 1);
  const p = S.sceneHtml({ type: 'collect', world: 'ocean', token: '', moves: ['gold', 'plain'], fresh: true });
  assert.equal(count(p, 'sc-new'), 1);
  assert.equal(count(p, 'sc-spark'), 0);
});

test('journey moves the token one spot per move and hops when fresh', () => {
  const a = S.sceneHtml({ type: 'journey', world: 'pets', token: '', moves: ['gold', 'gold', 'plain'] });
  assert.doesNotMatch(a, /sc-token hop/);
  const b = S.sceneHtml({ type: 'journey', world: 'pets', token: '', moves: ['gold', 'gold', 'plain'], fresh: true });
  assert.match(b, /class="sc-token hop"/);
  assert.match(b, /data-to="[\d.]+%"/);
  assert.match(a, /aria-label="Journey to the picnic: 3 of 6 steps"/);
});

test('labels for every world and type', () => {
  assert.equal(S.sceneLabel('build', 'bakery', 0), 'Cake: 0 of 6 pieces');
  assert.equal(S.sceneLabel('journey', 'ocean', 6), 'Journey to the treasure chest: 6 of 6 steps');
  assert.equal(S.sceneLabel('collect', 'pets', 1), 'Bones: 1 of 6 collected');
  assert.equal(S.sceneLabel('collect', 'space', 2), 'Star crystals: 2 of 6 collected');
});

test('unknown world and type fall back to a space build', () => {
  const h = S.sceneHtml({ type: 'nope', world: 'mars', token: '', moves: [] });
  assert.match(h, /aria-label="Rocket: 0 of 6 pieces"/);
});

test('trophies are gold only when asked', () => {
  for (const type of ['build', 'journey', 'collect']) for (const world of ['space', 'ocean', 'pets', 'bakery']) {
    const gold = S.trophySvg(type, world, true), plain = S.trophySvg(type, world, false);
    assert.match(gold, /^<svg[^>]*aria-hidden="true"/);
    assert.match(gold, /#ffcf3f/);
    assert.doesNotMatch(plain, /#ffcf3f/);
  }
});
```

- [ ] **Step 2: Run the tests and check that they fail.**

Run: `node --test 'tests/*.test.js'`
Expected: `tests/scenes.test.js` FAILS (`Cannot find module '../scenes.js'`).

- [ ] **Step 3: Create `scenes.js`:**

```js
/* Quest Academy stop games: the small untimed scene above the questions at a map stop (Build, Journey, Collect)
   and the trophy a finished stop leaves on the map. Loaded on demand by app.js.
   Spec: docs/superpowers/specs/2026-11-18-stop-games-design.md */
const W = 360, H = 140, GROUND = 112, GOLD = '#ffcf3f', MOVES = 6;
const TYPES = ['build', 'journey', 'collect'];

const LOOK = {
  space: { sky: ['#120d3a', '#2d2170'], ground: '#3b3478', bag: '#5b4bb0' },
  ocean: { sky: ['#5fd3f3', '#1f8fc4'], ground: '#f3d9a4', bag: '#2a7fa8' },
  pets: { sky: ['#bfe9ff', '#e9f8d2'], ground: '#8fd16a', bag: '#c0703f' },
  bakery: { sky: ['#ffe8d1', '#fff6ec'], ground: '#e9b98a', bag: '#ff8fab' },
};

// Build: 6 pieces from the bottom up. {F} is the piece's fill: the plain color, the gold color, or 'none' for a ghost.
const BUILD = {
  space: { name: 'Rocket', plain: ['#9aa4c7', '#e9edf7', '#e9edf7', '#e9edf7', '#ff6b6b', '#ffd23f'], pieces: [
    '<path d="M222 122 L232 98 L268 98 L278 122 Z" fill="{F}"/>',
    '<rect x="234" y="80" width="32" height="20" rx="3" fill="{F}"/>',
    '<rect x="234" y="60" width="32" height="20" rx="3" fill="{F}"/><circle cx="250" cy="70" r="6" fill="#bfe6ff"/>',
    '<rect x="234" y="42" width="32" height="18" rx="3" fill="{F}"/>',
    '<path d="M234 42 Q250 6 266 42 Z" fill="{F}"/>',
    '<path d="M250 14 V2 L262 6 L250 10" stroke="{F}" stroke-width="3" fill="{F}"/>'] },
  ocean: { name: 'Sandcastle', plain: ['#e8c88a', '#f0d49b', '#e8c88a', '#e8c88a', '#f0d49b', '#ff6b6b'], pieces: [
    '<rect x="214" y="104" width="72" height="18" fill="{F}"/>',
    '<rect x="222" y="86" width="56" height="18" fill="{F}"/>',
    '<rect x="222" y="62" width="14" height="24" fill="{F}"/><path d="M220 62 h18 l-9 -10 z" fill="{F}"/>',
    '<rect x="264" y="62" width="14" height="24" fill="{F}"/><path d="M262 62 h18 l-9 -10 z" fill="{F}"/>',
    '<rect x="241" y="46" width="18" height="40" fill="{F}"/><path d="M239 46 h22 l-11 -12 z" fill="{F}"/>',
    '<path d="M250 34 V12 L264 17 L250 22" stroke="{F}" stroke-width="3" fill="{F}"/>'] },
  pets: { name: 'Doghouse', plain: ['#8a5a3a', '#d9824b', '#d9824b', '#b34a3c', '#5a3a2a', '#f5efe0'], pieces: [
    '<rect x="212" y="114" width="76" height="8" rx="2" fill="{F}"/>',
    '<rect x="218" y="74" width="32" height="40" fill="{F}"/>',
    '<rect x="250" y="74" width="32" height="40" fill="{F}"/>',
    '<path d="M208 76 L250 38 L292 76 Z" fill="{F}"/>',
    '<path d="M238 114 V100 a12 12 0 0 1 24 0 V114 Z" fill="{F}"/>',
    '<g fill="{F}"><rect x="238" y="22" width="24" height="8" rx="4"/><circle cx="238" cy="22" r="5"/><circle cx="238" cy="30" r="5"/><circle cx="262" cy="22" r="5"/><circle cx="262" cy="30" r="5"/></g>'] },
  bakery: { name: 'Cake', plain: ['#e8eef7', '#f7c1d4', '#fbe2a8', '#c9a6f5', '#ffffff', '#e2343f'], pieces: [
    '<ellipse cx="250" cy="120" rx="44" ry="6" fill="{F}"/>',
    '<rect x="214" y="92" width="72" height="26" rx="4" fill="{F}"/>',
    '<rect x="222" y="68" width="56" height="24" rx="4" fill="{F}"/>',
    '<rect x="230" y="46" width="40" height="22" rx="4" fill="{F}"/>',
    '<path d="M228 48 Q250 36 272 48 V54 q-5 6 -10 0 q-6 6 -12 0 q-6 6 -12 0 q-5 6 -10 0 Z" fill="{F}"/>',
    '<circle cx="250" cy="32" r="7" fill="{F}"/><path d="M250 25 q4 -10 10 -12" stroke="#3a7d2c" stroke-width="2" fill="none"/>'] },
};

// Journey: 7 spots (start + 6 steps), an obstacle between each pair of spots, and a goal at the end
const spotX = k => 34 + k * 46;
const JOURNEY = {
  space: { goalName: 'flag', color: '#8bd3ff',
    obstacle: x => `<ellipse cx="${x}" cy="${GROUND + 5}" rx="11" ry="4" fill="#241f55"/>`,
    goal: `<path d="M338 112 V72" stroke="#ddd" stroke-width="3"/><path d="M338 72 L356 79 L338 86 Z" fill="#ff6b6b"/>` },
  ocean: { goalName: 'treasure chest', color: '#ffffff',
    obstacle: x => `<path d="M${x} ${GROUND} q-6 -10 0 -20 q6 -10 0 -18" stroke="#2fae6b" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    goal: `<rect x="324" y="94" width="30" height="18" rx="2" fill="#a0642c"/><path d="M324 96 Q339 80 354 96 Z" fill="#c07a38"/><rect x="336" y="96" width="6" height="7" fill="#ffd23f"/>` },
  pets: { goalName: 'picnic', color: '#8a5a3a',
    obstacle: x => `<g fill="#5bb04a"><circle cx="${x - 6}" cy="${GROUND - 4}" r="7"/><circle cx="${x + 6}" cy="${GROUND - 4}" r="7"/><circle cx="${x}" cy="${GROUND - 10}" r="8"/></g>`,
    goal: `<path d="M318 112 L330 100 H358 L350 112 Z" fill="#ff6b6b"/><path d="M322 108 h30 M326 104 h28" stroke="#fff" stroke-width="2"/><rect x="332" y="86" width="16" height="12" rx="2" fill="#c0703f"/><path d="M332 88 Q340 76 348 88" stroke="#8a4f2a" stroke-width="2" fill="none"/>` },
  bakery: { goalName: 'gingerbread house', color: '#ff6fa5',
    obstacle: x => `<circle cx="${x}" cy="${GROUND - 6}" r="6" fill="#ff6fa5"/><path d="M${x - 10} ${GROUND - 6} l4 -4 v8 z M${x + 10} ${GROUND - 6} l-4 -4 v8 z" fill="#ff6fa5"/>`,
    goal: `<rect x="322" y="88" width="32" height="24" fill="#b5713d"/><path d="M318 90 L338 70 L358 90 Z" fill="#fff"/><path d="M320 90 L338 72 L356 90" stroke="#ff8fab" stroke-width="3" fill="none"/><rect x="334" y="98" width="8" height="14" rx="3" fill="#6b3a1e"/>` },
};

// Collect: a bag with 6 slots; each world's treasure is drawn around (0, 0)
const SLOTS = [[252, 74], [280, 74], [308, 74], [252, 100], [280, 100], [308, 100]];
const COLLECT = {
  space: { name: 'Star crystals', plain: '#bfe6ff', shape: f => `<path d="M0 -9 L2.6 -2.8 9 -2.8 3.9 1.2 5.6 8 0 4 -5.6 8 -3.9 1.2 -9 -2.8 -2.6 -2.8Z" fill="${f}"/>` },
  ocean: { name: 'Pearls', plain: '#f4f1ff', shape: f => `<circle r="8" fill="${f}"/><circle cx="-3" cy="-3" r="2.5" fill="#fff" opacity=".8"/>` },
  pets: { name: 'Bones', plain: '#f5efe0', shape: f => `<g fill="${f}"><rect x="-8" y="-3" width="16" height="6" rx="3"/><circle cx="-8" cy="-3" r="3.5"/><circle cx="-8" cy="3" r="3.5"/><circle cx="8" cy="-3" r="3.5"/><circle cx="8" cy="3" r="3.5"/></g>` },
  bakery: { name: 'Cherries', plain: '#e2343f', shape: f => `<circle cy="2" r="7" fill="${f}"/><path d="M0 -5 q3 -7 8 -8" stroke="#3a7d2c" stroke-width="2" fill="none"/>` },
};

const worldOf = w => (LOOK[w] ? w : 'space');
const typeOf = t => (TYPES.includes(t) ? t : 'build');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// one placed move, or a ghost for a move still to come
function cls(moves, k, fresh) {
  const m = moves[k];
  if (!m) return `sc-ghost${k === moves.length ? ' sc-next' : ''}`;
  return `sc-piece${m === 'gold' ? ' sc-gold' : ''}${fresh && k === moves.length - 1 ? ' sc-new' : ''}`;
}

function buildSvg(w, moves, fresh) {
  const b = BUILD[w];
  return b.pieces.map((pc, k) => {
    const fill = !moves[k] ? 'none' : moves[k] === 'gold' ? GOLD : b.plain[k];
    return `<g class="${cls(moves, k, fresh)}">${pc.replace(/\{F\}/g, fill)}</g>`;
  }).join('');
}

function journeySvg(w, moves, fresh) {
  const j = JOURNEY[w];
  let out = '';
  for (let k = 0; k < MOVES; k++) out += j.obstacle(spotX(k) + 23);
  out += j.goal;
  for (let k = 0; k < MOVES; k++) {
    const m = moves[k], fill = !m ? 'none' : m === 'gold' ? GOLD : j.color;
    out += `<circle class="${cls(moves, k, fresh)}" cx="${spotX(k + 1)}" cy="${GROUND + 8}" r="5" fill="${fill}"/>`;
  }
  return out;
}

function bagSvg(w, moves, fresh) {
  const c = COLLECT[w], bag = LOOK[w].bag;
  let out = `<path d="M262 46 Q280 30 298 46" stroke="${bag}" stroke-width="4" fill="none"/>
    <path d="M232 56 Q230 46 242 46 H318 Q330 46 328 56 L334 120 H226 Z" fill="${bag}"/>`;
  SLOTS.forEach(([x, y], k) => {
    const m = moves[k];
    out += `<g transform="translate(${x} ${y})"><circle r="10" class="sc-slot"/>${m ? `<g class="${cls(moves, k, fresh)}">${c.shape(m === 'gold' ? GOLD : c.plain)}</g>` : `<g class="${cls(moves, k, fresh)}"><circle r="8" fill="none"/></g>`}</g>`;
  });
  return out;
}

function decoSvg(w) {
  if (w !== 'space') return '';
  return [[20, 18], [70, 40], [130, 14], [180, 52], [320, 20], [350, 60], [100, 80], [200, 28]]
    .map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 3 ? 1.2 : 1.8}" fill="#fff" opacity=".7"/>`).join('');
}

const sparkSvg = (x, y) => `<g class="sc-spark" transform="translate(${x} ${y})" fill="${GOLD}">${[[0, -16], [15, 0], [0, 16], [-15, 0]]
  .map(([dx, dy]) => `<path transform="translate(${dx} ${dy})" d="M0 -5 L1.5 -1.5 5 0 1.5 1.5 0 5 -1.5 1.5 -5 0 -1.5 -1.5Z"/>`).join('')}</g>`;

export function sceneLabel(type, world, count) {
  const w = worldOf(world), t = typeOf(type);
  if (t === 'journey') return `Journey to the ${JOURNEY[w].goalName}: ${count} of ${MOVES} steps`;
  if (t === 'collect') return `${COLLECT[w].name}: ${count} of ${MOVES} collected`;
  return `${BUILD[w].name}: ${count} of ${MOVES} pieces`;
}

export function sceneHtml(o) {
  const w = worldOf(o.world), t = typeOf(o.type), L = LOOK[w], moves = (o.moves || []).slice(0, MOVES), n = moves.length, fresh = !!o.fresh && n > 0;
  let art, tokX = 120, from = null, spark = null;
  if (t === 'journey') {
    art = journeySvg(w, moves, fresh); tokX = spotX(n);
    if (fresh) { from = spotX(n - 1); spark = [spotX(n), GROUND + 8]; }
  } else if (t === 'collect') {
    art = bagSvg(w, moves, fresh); if (fresh) spark = SLOTS[n - 1];
  } else {
    art = buildSvg(w, moves, fresh); if (fresh) spark = [250, 118 - (n - 1) * 20];
  }
  const shine = fresh && moves[n - 1] === 'gold' ? sparkSvg(spark[0], spark[1]) : '';
  const pct = x => (x / W * 100).toFixed(2) + '%';
  return `<div class="scene" role="img" aria-label="${esc(sceneLabel(t, w, n))}" style="background:linear-gradient(${L.sky[0]}, ${L.sky[1]})">
    <div class="scene-box"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${decoSvg(w)}
      <rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="${L.ground}"/>${art}${shine}</svg>
      <div class="sc-token${from != null ? ' hop' : ''}" style="left:${pct(from != null ? from : tokX)};top:${(GROUND / H * 100).toFixed(2)}%" data-to="${pct(tokX)}" aria-hidden="true">${o.token || ''}</div>
    </div></div>`;
}

export function sceneMove(el, o, kind) {
  if (!el) return;
  if (kind === 'miss') {
    const s = el.querySelector('.scene');
    if (!s) return;
    s.classList.remove('sc-miss'); void s.offsetWidth; s.classList.add('sc-miss');
    return;
  }
  el.innerHTML = sceneHtml(Object.assign({}, o, { fresh: true }));
  const tok = el.querySelector('.sc-token.hop');
  if (tok) requestAnimationFrame(() => requestAnimationFrame(() => { tok.style.left = tok.dataset.to; }));
}

export function trophySvg(type, world, gold) {
  const w = worldOf(world), t = typeOf(type);
  let vb, body;
  if (t === 'journey') {
    vb = '0 0 40 50';
    body = `<ellipse cx="8" cy="46" rx="7" ry="2" fill="#000" opacity=".25"/><path d="M8 46 V6" stroke="#5a4a3a" stroke-width="3" stroke-linecap="round"/><path d="M8 6 L36 14 L8 22 Z" fill="${gold ? GOLD : JOURNEY[w].color}" stroke="#00000033"/>`;
  } else if (t === 'collect') {
    vb = '222 28 116 96';
    body = bagSvg(w, Array(MOVES).fill(gold ? 'gold' : 'plain'), false);
  } else {
    vb = '204 0 92 126';
    const b = BUILD[w];
    body = b.pieces.map((pc, k) => pc.replace(/\{F\}/g, gold ? GOLD : b.plain[k])).join('');
  }
  return `<svg aria-hidden="true" focusable="false" viewBox="${vb}" width="100%" height="100%"${gold ? ' class="sc-gold"' : ''}>${body}</svg>`;
}
```

- [ ] **Step 4: Run the tests and check that they pass.**

Run: `node --test 'tests/*.test.js'`
Expected: all pass. If a count assertion is off, fix `scenes.js` (not the test), since the counts follow the rules in the spec.

- [ ] **Step 5: Append the styles to the end of `style.css`:**

```css
/* stop games (scenes.js): the scene strip above a map stop's questions, and the trophies on the map */
.scene { border-radius: 18px; overflow: hidden; }
.scene-box { position: relative; width: min(100%, 360px); aspect-ratio: 360 / 140; margin: 0 auto; }
.scene-box svg { display: block; width: 100%; height: 100%; }
.sc-token { position: absolute; width: 11%; aspect-ratio: 1; transform: translate(-50%, -100%); transition: left .6s ease-in-out; pointer-events: none; }
.sc-token.hop { animation: scHop .6s ease-in-out; }
.sc-ghost, .sc-ghost * { fill: none; stroke: rgba(255, 255, 255, .65); stroke-width: 1.5; stroke-dasharray: 4 3; }
.sc-slot { fill: rgba(0, 0, 0, .2); }
.sc-gold { filter: drop-shadow(0 0 4px rgba(255, 207, 63, .9)); }
.sc-piece, .sc-ghost, .sc-spark { transform-box: fill-box; transform-origin: center; }
.sc-new { animation: scDrop .45s ease-out; }
.sc-spark { animation: scSpark .8s ease-out forwards; }
.sc-miss .sc-next { animation: scBounce .5s ease-in-out; }
.sc-miss .sc-token { animation: scWobble .5s ease-in-out; }
@keyframes scDrop { from { transform: translateY(-28px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes scSpark { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
@keyframes scBounce { 0%, 100% { transform: none; } 30% { transform: translateY(-10px); } 60% { transform: translateY(2px); } }
@keyframes scWobble { 0%, 100% { transform: translate(-50%, -100%) rotate(0); } 25% { transform: translate(-50%, -100%) rotate(-10deg); } 75% { transform: translate(-50%, -100%) rotate(10deg); } }
@keyframes scHop { 0%, 100% { transform: translate(-50%, -100%); } 50% { transform: translate(-50%, calc(-100% - 18px)); } }
.adv-trophy { position: absolute; transform: translate(-50%, -50%); width: 12%; aspect-ratio: 1; pointer-events: none; z-index: 1; }
@supports not (aspect-ratio: 1) {
  .scene-box { height: 140px; }
  .sc-token { height: 40px; }
  .adv-trophy { height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .sc-new, .sc-miss .sc-next, .sc-miss .sc-token, .sc-token.hop { animation: none; }
  .sc-token { transition: none; }
  .sc-spark { display: none; }
}
```

- [ ] **Step 6: Run the tests again, then commit.**

Run: `node --test 'tests/*.test.js'` → all pass.

```bash
git add scenes.js tests/scenes.test.js style.css
git commit -m "Stop games: scenes.js drawing module (build, journey, collect, trophies) and styles"
```

---

### Task 3: Wire the scenes into stops and the map

**Files:**
- Modify `app.js`:
  - module loaders (~line 991);
  - `drawPlay` (~1896);
  - `pushRetry` (~1968), `answeredRight` (~1977);
  - the three "Next →" handlers (~2013, ~2043, ~2103);
  - `startStop` (~2288), `showMap` (~2408).
- Modify `adventure.js`: `drawMap`.
- Modify `sw.js`: CACHE and CORE.

**Interfaces:**
- Consumes:
  - from Task 1: `AR.sceneFor(i)`, `AR.trophyGold(stars)`, `AR.STOP_LEN`;
  - from Task 2: `sceneHtml`, `sceneMove` and `trophySvg` from `scenes.js`;
  - existing: `advMod.tokenSvg(look)` and `advLook(p)`.
- Produces:
  - `game.scene` (`'build'|'journey'|'collect'|null`) and `game.moves` (an array of `'gold'|'plain'`);
  - `drawMap` stop objects accept an optional `trophy` (an SVG string).

- [ ] **Step 1: Add the scenes module loader.** Right after the `loadAdventureMod` function (around line 995), add:

```js
// stop games (part 2): the scene drawn above the questions at a map stop
let scenesMod = null, scenesModP = null;
function loadScenesMod() {
  if (!scenesModP) scenesModP = import('./scenes.js' + (ASSET_Q ? '?' + ASSET_Q : '')).then(m => (scenesMod = m)).catch(() => { scenesModP = null; return null; });
  return scenesModP;
}
```

- [ ] **Step 2: Make `startStop` load the scenes and set up the game.** Replace the whole `startStop` function with:

```js
async function startStop(i) {
  const p = me(), adv = ensureAdventure(p), s = adv.stops[i];
  if (!s || i > adv.stop || adv.picking) return goHome();
  typingStop = null; pendingHop = null;
  if (s.subject === 'typing') { typingStop = i; return startTyping(s.missionId); }
  const rs = renderSeq;
  await Promise.all([loadScenesMod(), loadAdventureMod()]);
  if (rs !== renderSeq || me() !== p) return;   // she went somewhere else while the games loaded
  const make = slotMaker(s.subject, s.missionId);
  game = slotGame({ missionId: s.missionId, subject: s.subject, adv: { kind: 'stop', i }, len: AR.STOP_LEN,
    slots: Array.from({ length: AR.STOP_LEN }, () => ({ subject: s.subject, mid: s.missionId, make })),
    scene: scenesMod && advMod ? AR.sceneFor(i) : null, moves: [] });
  nextQuestion();
}
```

Check every caller of `startStop` with `grep -n "startStop(" app.js`. None of them use its return value, so it's safe for it to be async. If one does, report it.

- [ ] **Step 3: Draw the scene in `drawPlay`, and add the step hook.** Just above `function drawPlay()`, add:

```js
const sceneOpts = () => ({ type: game.scene, world: me().adventure.world, token: advMod.tokenSvg(advLook(me())), moves: game.moves });
// one move in the stop's game: 'gold' (first try), 'plain' (after a miss or the shown answer) or 'miss' (a wobble, nothing lost)
function sceneStep(kind) {
  if (!game || !game.scene || !scenesMod || !advMod) return;
  if (kind !== 'miss') { if (game.moves.length >= AR.STOP_LEN) return; game.moves.push(kind); }
  scenesMod.sceneMove(document.getElementById('scene'), sceneOpts(), kind);
}
// "Next →" after the answer was shown: a plain move, with a moment to see it at a stop
function afterReveal(e) {
  if (!game) return;
  if (e && e.currentTarget) e.currentTarget.disabled = true;
  game.n++;
  if (!game.scene) return nextQuestion();
  const g = game;
  sceneStep('plain');
  setTimeout(() => { if (game === g) nextQuestion(); }, 700);
}
```

In `drawPlay`, replace this line:

```js
      ${boss ? bossBarHtml() : `<div class="meter"><span>${th.meterIcon} ${th.meter}</span><span class="bar"><i id="bar" style="width:${pct}%"></i></span></div>`}
```

with:

```js
      ${boss ? bossBarHtml() : game.scene && scenesMod && advMod ? `<div id="scene">${scenesMod.sceneHtml(sceneOpts())}</div>`
        : `<div class="meter"><span>${th.meterIcon} ${th.meter}</span><span class="bar"><i id="bar" style="width:${pct}%"></i></span></div>`}
```

- [ ] **Step 4: Hook the moves into the answer paths.**
- In `pushRetry`, change the first line `bossReact(false);` to `bossReact(false); sceneStep('miss');`.
- In `answeredRight`, right after the line `if (game.tries === 1) { record(p, game.q.key, true); game.firstTry++; bossReact(true); }`, add:

```js
  sceneStep(game.tries === 1 ? 'gold' : 'plain');
```

- Replace all three occurrences of:

```js
    document.getElementById('next').onclick = () => { game.n++; nextQuestion(); };
```

with:

```js
    document.getElementById('next').onclick = afterReveal;
```

  Confirm with `grep -n "game.n++" app.js`: the only matches should be in `answeredRight` and `afterReveal`.

- [ ] **Step 5: Add trophies to the map.**
  - In `showMap`, replace:

```js
  const stops = adv.stops.map(s => s && { icon: (SUBJECTS[s.subject] || {}).icon || '🎯', name: (SUBJECTS[s.subject] || {}).name || s.subject, stars: s.stars });
  const mod = await loadAdventureMod();
```

    with:

```js
  const [mod, scn] = await Promise.all([loadAdventureMod(), loadScenesMod()]);
  // a finished stop leaves a trophy of its game (typing stops have no game)
  const stops = adv.stops.map((s, i) => s && { icon: (SUBJECTS[s.subject] || {}).icon || '🎯', name: (SUBJECTS[s.subject] || {}).name || s.subject, stars: s.stars,
    trophy: scn && s.subject !== 'typing' && i < adv.stop ? scn.trophySvg(AR.sceneFor(i), adv.world, AR.trophyGold(s.stars)) : '' });
```

    Keep the `if (seq !== renderSeq) return;` line that follows. `stops` must still be defined before both `mod.drawMap(...)` and `advListHtml(adv, stops)`. Check that nothing between the old `stops` line and the `await` used `stops`.

  - In `adventure.js` `drawMap`:
    - add a helper next to `tokenAt`:

```js
  // trophies sit on the outer side of each marker
  const trophyAt = i => [POINTS[i][0] < W / 2 ? POINTS[i][0] - 64 : POINTS[i][0] + 64, POINTS[i][1] + 8];
```

    - change the stop button template's end from `…${done ? starRow(s.stars) : ''}</button>`;` to:

```js
      <span class="adv-icon" aria-hidden="true">${s.icon}</span>${done ? starRow(s.stars) : ''}</button>${done && s.trophy ? `<span class="adv-trophy" style="${pct(trophyAt(i))}" aria-hidden="true">${s.trophy}</span>` : ''}`;
```

- [ ] **Step 6: Update the service worker.** In `sw.js`:
  - change `const CACHE = 'quest-academy-v8';` to `const CACHE = 'quest-academy-v9';`;
  - in CORE, add `'scenes.js',` right after `'adventure.js',`.

- [ ] **Step 7: Run the tests and a syntax check.**

Run: `node --test 'tests/*.test.js' && node --check app.js && node --check sw.js && node --input-type=module -e "await import('./adventure.js'); await import('./scenes.js'); console.log('ok')"`
Expected: all tests pass, then `ok`.

- [ ] **Step 8: Commit**

```bash
git add app.js adventure.js sw.js
git commit -m "Stop games: scenes at map stops, moves from answers, trophies on the map, cache v9"
```

---

### Task 4: Browser check (controller)

The controller runs this check, because it needs the preview browser.
- **Setup:**
  - Start the preview with `preview_start {name: "math-quest-alt"}` (port 5181).
  - Seed localStorage `mathquest.v1` with a player that has `found:{}`, `points`, `streak`, `lastDay`, `stats`, `missions` and an `adventure` in the wanted world. Reload `/`.
- **Check:**
  - all 3 games in all 4 worlds, at 375px and iPad widths;
  - a first-try answer gives gold with a sparkle;
  - a miss gives a bounce or wobble, then a right answer places a plain piece;
  - a second miss, then Next →, places a plain piece;
  - typing stops, the boss, Free practice and Today's Quest are unchanged;
  - map trophies, and a 3-star stop's trophy is gold;
  - reduced motion (`resize_window colorScheme` can't emulate it, so check with `matchMedia` and a CSS check);
  - blocking `scenes.js` (rename it temporarily, or stub `import`): the stop shows the meter;
  - no console errors.
- **Fix:** anything found goes into a fix commit on the branch.
