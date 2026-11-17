# Creature Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each player a 3D creature (Dragon, Fox, Axolotl or Bunny-cat) that hatches and grows as she masters questions and earns gear at milestones, shown on the home screen, in a den, and on mission finish screens.

**Architecture:** Pure rules (stages, items, colors, merge) live in a new classic script `pet-rules.js` (`window.PetRules`), tested with Node. All Three.js code lives in an ES module `creature.js`, loaded with `import()` only on screens that show the creature; it reads colors and items from `window.PetRules`. `app.js` (one big IIFE, no build step) adds the screens, the hooks into finish screens and sync, and the emoji fallback.

**Tech Stack:** Vanilla JS, HTML, CSS; Three.js r170 (vendored ES module); Node 22 `node:test` for rule tests; Python `http.server` preview (`.claude/launch.json` name `math-quest`, port 5173).

**Spec:** `docs/superpowers/specs/2026-11-17-creature-companion-design.md`

## Global Constraints

- Stage thresholds (mastered questions): Egg 0–9, Baby 10–74, Kid 75–199, Grown 200–399, Legendary 400+, in one constant.
- "Mastered" = bank keys `q:<id>` with `box >= 2`, plus math pool keys (any key in `POOLS`) with `box >= 3`.
- Items (9, kept forever): scarf (neck, 3-day streak), cape (back, 7-day streak), crown (head, 30-day streak), glasses (head, math), bookbag (back, reading), featherpen (back, writing), goggles (head, science), explorerhat (head, social), headphones (head, typing goal). Subject items unlock when any mission of that subject at her level reaches 80% mastery. Typing goal: any typing lesson run with `wpm >= typeTarget(p)` and `acc >= 90`.
- Colors: 10 patterns per species; unlocked count = `2 + 2 * stage` (stage index 0–4).
- Names 1–16 characters after trimming.
- Saved shape: `p.pet = { species, name, color, wear: {head, neck, back}, items, seenStage, seenItems, updated }`. Stage is never stored.
- Merge: `items`/`seenItems` union, `seenStage` max, `species/name/color/wear` from newer `updated`.
- No flashing. `prefers-reduced-motion`: no idle motion; tap gives a small hop; celebrations are a fade.
- One 3D view at a time, disposed on every `render()`. Pixel ratio capped at 2. Loop pauses when hidden/off screen.
- If WebGL or the import fails: emoji fallback (🐉 🦊 🦎 🐰) with the same text and controls.
- Kid-facing copy: warm, short, no scolding. "her" is fine in code comments (two daughters); UI copy uses the creature's name.
- Do not add attribution lines to commit messages.
- The host caches `.js` for a year: anything loaded by `import()` must carry the deploy version query (see Task 3).

## File map

| File | Status | Responsibility |
|---|---|---|
| `pet-rules.js` | new | Species, stages, items, colors, unlock rules, merge, name check. No DOM. |
| `tests/pet-rules.test.js` | new | Node tests for `pet-rules.js`. |
| `lib/three-0.170.0.module.min.js` | new | Vendored Three.js r170. |
| `creature.js` | new | `mountCreature()`: builds and animates the 3D creature, gear and ground. |
| `tests/creature-gallery.html` | new | Dev-only page showing every species × stage, gear and grounds. |
| `app.js` | modify | Loader + fallback, mastery count, unlock checks, hatch/den screens, home card, finish moments, merge, Grown-ups line and reset. |
| `style.css` | modify | Card, den, wardrobe, hatch, moment styles. |
| `index.html` | modify | Load `pet-rules.js` before `app.js`. |
| `sw.js` | modify | Cache the new files; bump cache name. |
| `server/deploy.sh` | modify | Exclude `tests`. |

---

### Task 1: Pet rules module with tests

**Files:**
- Create: `pet-rules.js`
- Create: `tests/pet-rules.test.js`
- Modify: `index.html` (script list), `server/deploy.sh` (rsync excludes)

**Interfaces:**
- Produces (`window.PetRules`, also `module.exports` under Node):
  - `STAGES: [{id, name, min}]` (5 entries), `stageFor(mastered) -> 0..4`
  - `progress(mastered) -> { stage, mastered, toNext }` (`toNext` is `null` at Legendary)
  - `SPECIES: { dragon|fox|axolotl|bunnycat: { name, emoji, defaultName, patterns: [[body, belly, accent] x10] } }` (colors are numbers like `0x6fcf97`)
  - `SPECIES_ORDER: ['dragon','fox','axolotl','bunnycat']`
  - `ITEMS: [{ id, slot, name, icon, how }]` (9 entries), `ITEM_BY_ID`
  - `colorsUnlocked(stage) -> number`
  - `earnedItems(ctx) -> [ids]` where `ctx = { streak: number, subjectsMastered: string[], typingGoal: boolean }`
  - `newItems(pet, ctx) -> [ids]` (earned but not yet in `pet.items`)
  - `pendingMoment(pet, stage) -> { grew: boolean, stage, items: [ids] } | null`
  - `newPet(species, name, items = []) -> pet`
  - `mergePet(a, b) -> pet | undefined`
  - `cleanName(s) -> string | null`

- [ ] **Step 1: Write the failing tests**

Create `tests/pet-rules.test.js`:

```js
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../pet-rules.js');

test('stage boundaries', () => {
  const cases = [[0, 0], [9, 0], [10, 1], [74, 1], [75, 2], [199, 2], [200, 3], [399, 3], [400, 4], [5000, 4]];
  for (const [m, s] of cases) assert.equal(R.stageFor(m), s, `mastered ${m}`);
});

test('progress counts down to the next stage and stops at legendary', () => {
  assert.deepEqual(R.progress(3), { stage: 0, mastered: 3, toNext: 7 });
  assert.deepEqual(R.progress(75), { stage: 2, mastered: 75, toNext: 125 });
  assert.deepEqual(R.progress(420), { stage: 4, mastered: 420, toNext: null });
});

test('every species has 10 color patterns of 3 colors and a default name', () => {
  assert.deepEqual(R.SPECIES_ORDER, ['dragon', 'fox', 'axolotl', 'bunnycat']);
  for (const id of R.SPECIES_ORDER) {
    const s = R.SPECIES[id];
    assert.equal(s.patterns.length, 10, id);
    s.patterns.forEach(p => { assert.equal(p.length, 3); p.forEach(c => assert.equal(typeof c, 'number')); });
    assert.ok(s.defaultName && s.emoji && s.name);
  }
});

test('colors unlock two per stage', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(R.colorsUnlocked), [2, 4, 6, 8, 10]);
});

test('nine items, each with a slot and a how-to', () => {
  assert.equal(R.ITEMS.length, 9);
  for (const it of R.ITEMS) {
    assert.ok(['head', 'neck', 'back'].includes(it.slot), it.id);
    assert.ok(it.how && it.name && it.icon);
    assert.equal(R.ITEM_BY_ID[it.id], it);
  }
});

test('streak items', () => {
  const ctx = s => ({ streak: s, subjectsMastered: [], typingGoal: false });
  assert.deepEqual(R.earnedItems(ctx(2)), []);
  assert.deepEqual(R.earnedItems(ctx(3)), ['scarf']);
  assert.deepEqual(R.earnedItems(ctx(7)), ['scarf', 'cape']);
  assert.deepEqual(R.earnedItems(ctx(30)), ['scarf', 'cape', 'crown']);
});

test('subject and typing items', () => {
  const got = R.earnedItems({ streak: 0, subjectsMastered: ['math', 'science'], typingGoal: true });
  assert.deepEqual(got.sort(), ['glasses', 'goggles', 'headphones']);
  const all = R.earnedItems({ streak: 0, subjectsMastered: ['math', 'reading', 'writing', 'science', 'social'], typingGoal: false });
  assert.deepEqual(all.sort(), ['bookbag', 'explorerhat', 'featherpen', 'glasses', 'goggles']);
});

test('items stay after a streak ends (newItems only adds)', () => {
  const pet = R.newPet('fox', 'Maple');
  pet.items = R.newItems(pet, { streak: 7, subjectsMastered: [], typingGoal: false });
  assert.deepEqual(pet.items, ['scarf', 'cape']);
  assert.deepEqual(R.newItems(pet, { streak: 1, subjectsMastered: [], typingGoal: false }), []);
  assert.deepEqual(pet.items, ['scarf', 'cape']);
});

test('pending moment: newest stage once, unseen items', () => {
  const pet = R.newPet('dragon', 'Pip');
  assert.equal(R.pendingMoment(pet, 0), null);
  assert.deepEqual(R.pendingMoment(pet, 2), { grew: true, stage: 2, items: [] });
  pet.seenStage = 2; pet.items = ['scarf'];
  assert.deepEqual(R.pendingMoment(pet, 2), { grew: false, stage: 2, items: ['scarf'] });
  pet.seenItems = ['scarf'];
  assert.equal(R.pendingMoment(pet, 2), null);
  pet.species = null;   // reset by a grown-up: no moments until a new egg is picked
  pet.items.push('cape');
  assert.equal(R.pendingMoment(pet, 3), null);
});

test('newPet shape', () => {
  const p = R.newPet('axolotl', 'Bubbles', ['scarf']);
  assert.equal(p.species, 'axolotl'); assert.equal(p.name, 'Bubbles'); assert.equal(p.color, 0);
  assert.deepEqual(p.wear, { head: null, neck: null, back: null });
  assert.deepEqual(p.items, ['scarf']); assert.deepEqual(p.seenItems, ['scarf']);
  assert.equal(p.seenStage, 0); assert.equal(typeof p.updated, 'number');
});

test('mergePet', () => {
  assert.equal(R.mergePet(undefined, undefined), undefined);
  const a = { ...R.newPet('fox', 'Maple'), items: ['scarf'], seenItems: ['scarf'], seenStage: 1, updated: 100 };
  const b = { ...R.newPet('fox', 'Rusty'), items: ['glasses'], seenItems: [], seenStage: 2, updated: 200, color: 3,
    wear: { head: 'glasses', neck: null, back: null } };
  assert.deepEqual(R.mergePet(a, undefined), a);
  assert.deepEqual(R.mergePet(undefined, b), b);
  const m = R.mergePet(a, b);
  assert.equal(m.name, 'Rusty'); assert.equal(m.color, 3); assert.equal(m.wear.head, 'glasses'); assert.equal(m.updated, 200);
  assert.deepEqual(m.items.sort(), ['glasses', 'scarf']);
  assert.deepEqual(m.seenItems, ['scarf']);
  assert.equal(m.seenStage, 2);
  assert.notEqual(m, b);   // a copy, not the same object
});

test('cleanName', () => {
  assert.equal(R.cleanName('  Pip  '), 'Pip');
  assert.equal(R.cleanName('   '), null);
  assert.equal(R.cleanName('x'.repeat(16)), 'x'.repeat(16));
  assert.equal(R.cleanName('x'.repeat(17)), null);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test 'tests/*.test.js'`
Expected: FAIL with `Cannot find module '../pet-rules.js'`.

- [ ] **Step 3: Write `pet-rules.js`**

```js
/* Quest Academy creature companion: the rules (no DOM, no 3D).
   Loaded as a plain script (window.PetRules) and by Node for tests.
   Spec: docs/superpowers/specs/2026-11-17-creature-companion-design.md */
(function (root) {
  'use strict';

  const STAGES = [
    { id: 'egg', name: 'Egg', min: 0 },
    { id: 'baby', name: 'Baby', min: 10 },
    { id: 'kid', name: 'Kid', min: 75 },
    { id: 'grown', name: 'Grown', min: 200 },
    { id: 'legendary', name: 'Legendary', min: 400 },
  ];

  function stageFor(mastered) {
    let s = 0;
    STAGES.forEach((st, i) => { if (mastered >= st.min) s = i; });
    return s;
  }

  function progress(mastered) {
    const stage = stageFor(mastered), next = STAGES[stage + 1];
    return { stage, mastered, toNext: next ? next.min - mastered : null };
  }

  // [body, belly, accent]; the first two of each species are unlocked from the start
  const SPECIES = {
    dragon: { name: 'Dragon', emoji: '🐉', defaultName: 'Ember', patterns: [
      [0x6fcf97, 0xfff1b8, 0xf2994a], [0x7aa7ff, 0xe3eeff, 0xffd166],
      [0xb388ff, 0xf3e8ff, 0x5ce1e6], [0xff8a80, 0xffe0d6, 0x8d6e63],
      [0x4db6ac, 0xe0f7f4, 0xff7eb6], [0xffd54f, 0xfff8e1, 0xe57373],
      [0x90a4ae, 0xeceff1, 0x29b6f6], [0x81c784, 0xf1f8e9, 0x7e57c2],
      [0xf06292, 0xfce4ec, 0xffca28], [0x37474f, 0x90a4ae, 0xff6e40],
    ] },
    fox: { name: 'Fox', emoji: '🦊', defaultName: 'Maple', patterns: [
      [0xff9a4d, 0xfff4e6, 0x5d4037], [0xe0e0e0, 0xffffff, 0x546e7a],
      [0xd7a86e, 0xfff3e0, 0x6d4c41], [0x9fa8da, 0xe8eaf6, 0x3949ab],
      [0xf48fb1, 0xfff0f5, 0x8e24aa], [0x80cbc4, 0xe0f2f1, 0x00695c],
      [0xffcc80, 0xfffde7, 0xef6c00], [0xbcaaa4, 0xefebe9, 0x3e2723],
      [0xce93d8, 0xf8eafc, 0x4a148c], [0x455a64, 0xcfd8dc, 0xffab40],
    ] },
    axolotl: { name: 'Axolotl', emoji: '🦎', defaultName: 'Bubbles', patterns: [
      [0xffb3c7, 0xffe4ec, 0xff5c8a], [0xb5e3ff, 0xe8f6ff, 0x4aa3df],
      [0xfff0a8, 0xfffbe0, 0xffa726], [0xc5b3ff, 0xefe9ff, 0x7c4dff],
      [0xa8f0c6, 0xe6fff0, 0x26a65b], [0xffcfa8, 0xfff0e2, 0xff7043],
      [0xd9d9d9, 0xf7f7f7, 0xef5350], [0x9ad0f5, 0xddeefa, 0xff80ab],
      [0xffd6f5, 0xfff0fb, 0x00bcd4], [0x5c6bc0, 0xc5cae9, 0xffee58],
    ] },
    bunnycat: { name: 'Bunny-cat', emoji: '🐰', defaultName: 'Mochi', patterns: [
      [0xf5f5f5, 0xffe4ec, 0xff8fab], [0xcfa98a, 0xf6e7da, 0x7b5e57],
      [0xb0bec5, 0xeceff1, 0x78909c], [0xffe082, 0xfff8e1, 0xff8f00],
      [0xd1c4e9, 0xf3effa, 0x9575cd], [0xa5d6a7, 0xedf7ee, 0x43a047],
      [0xffab91, 0xfff1ec, 0xd84315], [0x90caf9, 0xe3f2fd, 0x1565c0],
      [0x424242, 0xbdbdbd, 0xff4081], [0xf8bbd0, 0xfff5f8, 0x6a1b9a],
    ] },
  };
  const SPECIES_ORDER = ['dragon', 'fox', 'axolotl', 'bunnycat'];

  const ITEMS = [
    { id: 'scarf', slot: 'neck', name: 'Scarf', icon: '🧣', how: 'Practice 3 days in a row', streak: 3 },
    { id: 'cape', slot: 'back', name: 'Cape', icon: '🦸', how: 'Practice 7 days in a row', streak: 7 },
    { id: 'crown', slot: 'head', name: 'Crown', icon: '👑', how: 'Practice 30 days in a row', streak: 30 },
    { id: 'glasses', slot: 'head', name: 'Smart glasses', icon: '👓', how: 'Master a Math mission', subject: 'math' },
    { id: 'bookbag', slot: 'back', name: 'Bookbag', icon: '🎒', how: 'Master a Reading mission', subject: 'reading' },
    { id: 'featherpen', slot: 'back', name: 'Feather pen', icon: '🪶', how: 'Master a Writing mission', subject: 'writing' },
    { id: 'goggles', slot: 'head', name: 'Lab goggles', icon: '🥽', how: 'Master a Science mission', subject: 'science' },
    { id: 'explorerhat', slot: 'head', name: 'Explorer hat', icon: '🤠', how: 'Master a Social Studies mission', subject: 'social' },
    { id: 'headphones', slot: 'head', name: 'Headphones', icon: '🎧', how: 'Reach your typing goal in a lesson', typing: true },
  ];
  const ITEM_BY_ID = Object.fromEntries(ITEMS.map(it => [it.id, it]));

  const colorsUnlocked = stage => 2 + 2 * stage;

  function earnedItems(ctx) {
    return ITEMS.filter(it =>
      (it.streak && ctx.streak >= it.streak) ||
      (it.subject && ctx.subjectsMastered.includes(it.subject)) ||
      (it.typing && ctx.typingGoal)).map(it => it.id);
  }

  const newItems = (pet, ctx) => earnedItems(ctx).filter(id => !pet.items.includes(id));

  function pendingMoment(pet, stage) {
    if (!pet || !pet.species) return null;
    const items = pet.items.filter(id => !pet.seenItems.includes(id));
    const grew = stage > pet.seenStage;
    return grew || items.length ? { grew, stage, items } : null;
  }

  const newPet = (species, name, items = []) => ({
    species, name, color: 0, wear: { head: null, neck: null, back: null },
    items: [...items], seenStage: 0, seenItems: [...items], updated: Date.now(),
  });

  function mergePet(a, b) {
    if (!a && !b) return undefined;
    if (!a || !b) return JSON.parse(JSON.stringify(a || b));
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
    const m = JSON.parse(JSON.stringify(newer));
    m.items = [...new Set([...(a.items || []), ...(b.items || [])])];
    m.seenItems = [...new Set([...(a.seenItems || []), ...(b.seenItems || [])])];
    m.seenStage = Math.max(a.seenStage || 0, b.seenStage || 0);
    return m;
  }

  function cleanName(s) {
    const t = String(s || '').trim();
    return t.length >= 1 && t.length <= 16 ? t : null;
  }

  const api = { STAGES, stageFor, progress, SPECIES, SPECIES_ORDER, ITEMS, ITEM_BY_ID, colorsUnlocked,
    earnedItems, newItems, pendingMoment, newPet, mergePet, cleanName };
  root.PetRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test 'tests/*.test.js'`
Expected: all 12 tests pass, `# fail 0`.

- [ ] **Step 5: Load it in the page and keep tests off the server**

In `index.html`, add before `<script src="app.js"></script>`:

```html
  <script src="pet-rules.js"></script>
```

In `server/deploy.sh`, in the rsync line, after `--exclude 'docs'` add `--exclude 'tests'`.

- [ ] **Step 6: Commit**

```bash
git add pet-rules.js tests/pet-rules.test.js index.html server/deploy.sh
git commit -m "Creature companion: rules for stages, items, colors and merge, with tests"
```

---

### Task 2: Vendored Three.js and the 3D creature module

**Files:**
- Create: `lib/three-0.170.0.module.min.js` (downloaded)
- Create: `creature.js`
- Create: `tests/creature-gallery.html`

**Interfaces:**
- Consumes: `window.PetRules.SPECIES`, `window.PetRules.ITEM_BY_ID`.
- Produces: `export function mountCreature(el, look, opts) -> { update(look), celebrate(kind), dispose() }`
  - `look = { species: string, stage: 0..4, color: number, wear: { head, neck, back }, ground: 'space'|'ocean'|'pets'|'bakery' }`
  - `opts = { interactive: boolean, reducedMotion: boolean, onPet?: () => void, preserve?: boolean }` (`preserve` keeps the drawing buffer so the gallery can snapshot it)
  - `kind`: `'grow' | 'item'`
  - Throws if WebGL can't start (the caller falls back to emoji).

- [ ] **Step 1: Download Three.js r170**

```bash
mkdir -p lib && curl -sfo lib/three-0.170.0.module.min.js https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js
```

Check it is self-contained (r170 has no `three.core` split):

```bash
wc -c lib/three-0.170.0.module.min.js; grep -c "from\"\./\|from '\./" lib/three-0.170.0.module.min.js
```
Expected: about 691648 bytes; `0` relative imports.

- [ ] **Step 2: Write `creature.js`**

```js
/* Quest Academy creature companion: the 3D view only (rules are in pet-rules.js).
   Three.js r170, vendored at lib/three-0.170.0.module.min.js.
   mountCreature(el, look, opts) -> { update(look), celebrate(kind), dispose() } */
import * as THREE from './lib/three-0.170.0.module.min.js';

const R = window.PetRules;
const SIZE = [0.85, 0.72, 0.86, 1, 1.1];        // overall scale per stage
const HEAD_R = [0, 0.4, 0.37, 0.34, 0.34];      // head radius per stage (big heads when little)
const BODY_R = 0.42, BODY_Y = 0.45;
const DARK = 0x1d1b2f;

let gradientTex = null;   // shared, never disposed
function gradient() {
  if (gradientTex) return gradientTex;
  gradientTex = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
  gradientTex.minFilter = gradientTex.magFilter = THREE.NearestFilter;
  gradientTex.needsUpdate = true;
  return gradientTex;
}
const mat = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradient(), ...extra });
function ball(r, color, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(color)); m.scale.set(sx, sy, sz); return m;
}
const cone = (r, h, color) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), mat(color));
const capsule = (r, len, color) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat(color));
const cyl = (rt, rb, h, color, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20, 1, open), mat(color, open ? { side: THREE.DoubleSide } : {}));
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

function canvasTexture(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sprite(tex, size, opacity = 1, additive = false) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  s.scale.set(size, size, 1); return s;
}
const glowTex = color => canvasTexture(g => {
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 32), c = '#' + color.toString(16).padStart(6, '0');
  r.addColorStop(0, c); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
const sparkleTex = () => canvasTexture(g => {
  g.fillStyle = '#fff8d6'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 7 : 30; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); }
  g.closePath(); g.fill();
});
const heartTex = () => canvasTexture(g => {
  g.fillStyle = '#ff6b8b'; g.beginPath(); g.moveTo(32, 54);
  g.bezierCurveTo(4, 34, 10, 8, 32, 22); g.bezierCurveTo(54, 8, 60, 34, 32, 54); g.fill();
});

/* ---------- the creature ---------- */
function buildEgg(colors) {
  const [body, belly] = colors, g = new THREE.Group();
  g.add(at(ball(0.42, belly, 1, 1.28, 1), 0, 0.55, 0));
  [[0.2, 0.75, 0.33], [-0.27, 0.5, 0.3], [0.05, 0.95, 0.28], [-0.08, 0.32, 0.38], [0.3, 0.42, 0.24]]
    .forEach(([x, y, z]) => g.add(at(ball(0.07, body, 1, 1, 0.45), x, y, z)));
  return { group: g, eyes: [], anchors: null };
}

function buildCreature(look) {
  const sp = R.SPECIES[look.species], colors = sp.patterns[look.color] || sp.patterns[0];
  if (look.stage === 0) return buildEgg(colors);
  const [body, belly, accent] = colors, st = look.stage, hr = HEAD_R[st];
  const headY = BODY_Y + BODY_R * 0.9 + hr * 0.7;
  const g = new THREE.Group(), eyes = [];
  g.add(at(ball(BODY_R, body, 1, 1.08, 1), 0, BODY_Y, 0));
  g.add(at(ball(BODY_R * 0.72, belly, 1, 1.05, 0.55), 0, BODY_Y - 0.03, BODY_R * 0.55));
  g.add(at(ball(hr, body), 0, headY, 0.05));
  for (const s of [-1, 1]) {
    const e = hr * 0.16, eye = at(ball(e, DARK), s * hr * 0.38, headY + hr * 0.1, hr * 0.88);
    eye.add(at(ball(e * 0.35, 0xffffff), e * 0.35, e * 0.4, e * 0.75));
    g.add(eye); eyes.push(eye);
    const cheek = at(ball(hr * 0.12, 0xff9aa2, 1, 0.6, 0.4), s * hr * 0.62, headY - hr * 0.22, hr * 0.74);
    cheek.material.transparent = true; cheek.material.opacity = 0.75; g.add(cheek);
    g.add(at(ball(BODY_R * 0.3, body, 1, 0.6, 1.3), s * BODY_R * 0.5, 0.08, BODY_R * 0.25));       // feet
    if (st >= 2) g.add(at(ball(BODY_R * 0.22, body, 1, 1.4, 1), s * BODY_R * 0.95, BODY_Y, BODY_R * 0.25)); // arms
  }
  const a = { headY, hr, neckY: BODY_Y + BODY_R * 0.8 };
  SPECIES_PARTS[look.species](g, a, { body, belly, accent }, st);
  if (st === 4) {
    const glow = at(sprite(glowTex(accent), 2.4, 0.5, true), 0, BODY_Y + 0.2, -0.5);
    glow.userData.glow = true; g.add(glow);
  }
  return { group: g, eyes, anchors: a };
}

function sparkleAt(g, x, y, z, size = 0.14) {
  const s = at(sprite(sparkleTex(), size, 0.9, true), x, y, z); s.userData.twinkle = Math.random() * 6; g.add(s);
}

const SPECIES_PARTS = {
  dragon(g, a, c, st) {
    const { headY, hr } = a;
    g.add(at(ball(hr * 0.45, c.belly, 1.1, 0.7, 0.8), 0, headY - hr * 0.28, hr * 0.78));             // snout
    for (const s of [-1, 1]) {
      const horn = at(cone(hr * 0.15, hr * 0.5, c.accent), s * hr * 0.45, headY + hr * 0.85, -0.02);
      horn.rotation.z = -s * 0.3; g.add(horn);
      if (st >= 2) {
        const w = at(ball(BODY_R * (st >= 4 ? 0.75 : 0.48), c.accent, 0.22, 1, 0.8), s * BODY_R * 0.6, BODY_Y + BODY_R * 0.55, -BODY_R * 0.7);
        w.rotation.z = s * 0.7; g.add(w);
      }
    }
    const tail = at(cone(BODY_R * 0.3, BODY_R * 1.4, c.body), 0, 0.22, -BODY_R * 1.1);
    tail.rotation.x = -Math.PI / 2 - 0.45; g.add(tail);
    if (st >= 3) [0.2, 0.45, 0.7].forEach(t => g.add(at(cone(0.05, 0.12, c.accent), 0, BODY_Y + BODY_R * (1 - t) * 0.9, -BODY_R * (0.75 + t * 0.2))));
    if (st === 4) [[0, 0.1, -0.95], [0.1, 0.18, -1.15], [-0.08, 0.05, -1.3]].forEach(p => sparkleAt(g, ...p));
  },
  fox(g, a, c, st) {
    const { headY, hr } = a;
    g.add(at(ball(hr * 0.4, c.belly, 1, 0.75, 1.2), 0, headY - hr * 0.3, hr * 0.78));                // snout
    g.add(at(ball(hr * 0.09, DARK), 0, headY - hr * 0.2, hr * 1.25));                                  // nose
    for (const s of [-1, 1]) {
      const ear = at(cone(hr * 0.32, hr * 0.75, c.body), s * hr * 0.55, headY + hr * 0.85, 0);
      ear.rotation.z = -s * 0.25; g.add(ear);
      const inner = at(cone(hr * 0.18, hr * 0.45, c.belly), s * hr * 0.53, headY + hr * 0.8, hr * 0.12);
      inner.rotation.z = -s * 0.25; inner.scale.z = 0.5; g.add(inner);
    }
    const big = st >= 3 ? 1.2 : 1;
    const tail = at(ball(BODY_R * 0.45 * big, c.body, 0.8, 0.8, 1.8), 0, BODY_Y, -BODY_R * 1.25); tail.rotation.x = 0.6; g.add(tail);
    g.add(at(ball(BODY_R * 0.28 * big, c.belly, 1, 1, 1.2), 0, BODY_Y + 0.25 * big, -BODY_R * 1.8));
    if (st === 4) [[0, 0.75, -0.85], [0.08, 0.6, -1.0], [-0.06, 0.9, -0.95]].forEach(p => sparkleAt(g, ...p));
  },
  axolotl(g, a, c, st) {
    const { headY, hr } = a;
    const smile = at(new THREE.Mesh(new THREE.TorusGeometry(hr * 0.25, hr * 0.03, 8, 16, Math.PI), mat(DARK)), 0, headY - hr * 0.22, hr * 0.94);
    smile.rotation.z = Math.PI; g.add(smile);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const f = at(capsule(hr * 0.07, hr * (st >= 3 ? 0.55 : 0.42), c.accent), s * hr * 0.98, headY + (i - 1) * hr * 0.3, -0.02);
      f.rotation.z = s * (1.2 - (i - 1) * 0.5); g.add(f);
      if (st === 4) sparkleAt(g, s * hr * 1.35, headY + (i - 1) * hr * 0.42, 0, 0.1);
    }
    const fin = at(ball(BODY_R * 0.6, c.body, 0.25, 0.9, 1.6), 0, BODY_Y - 0.05, -BODY_R * 1.1); g.add(fin);
  },
  bunnycat(g, a, c, st) {
    const { headY, hr } = a;
    g.add(at(ball(hr * 0.08, 0xff8fab), 0, headY - hr * 0.12, hr * 0.98));                              // nose
    const earLen = hr * (st >= 3 ? 0.95 : 0.75);
    for (const s of [-1, 1]) {
      const ear = at(capsule(hr * 0.17, earLen, c.body), s * hr * 0.4, headY + hr * 0.9 + earLen * 0.45, 0);
      ear.rotation.z = -s * 0.15; g.add(ear);
      const inner = at(capsule(hr * 0.09, earLen * 0.8, c.accent), s * hr * 0.41, headY + hr * 0.9 + earLen * 0.45, hr * 0.12);
      inner.rotation.z = -s * 0.15; inner.scale.z = 0.4; g.add(inner);
      if (st === 4) g.add(at(ball(hr * 0.12, c.belly), s * hr * 0.47, headY + hr * 0.9 + earLen * 1.05, 0));
      for (const j of [-1, 1]) {
        const w = at(cyl(0.006, 0.006, hr * 0.6, DARK), s * hr * 0.75, headY - hr * 0.2 + j * 0.035, hr * 0.7);
        w.rotation.z = Math.PI / 2 + s * j * 0.15; g.add(w);
      }
    }
    g.add(at(ball(BODY_R * 0.3, c.belly), 0, BODY_Y - 0.1, -BODY_R * 0.95));                          // tail puff
    if (st === 4) [[0.35, 1.35, 0], [-0.35, 1.4, 0]].forEach(p => sparkleAt(g, ...p, 0.12));
  },
};

/* ---------- gear ---------- */
const GEAR = {
  crown(a) {
    const g = new THREE.Group(), gold = 0xf2c94c, y = a.headY + a.hr * 0.92;
    g.add(at(cyl(a.hr * 0.42, a.hr * 0.45, a.hr * 0.22, gold, true), 0, y, 0));
    for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2; g.add(at(cone(0.035, 0.09, gold), Math.cos(t) * a.hr * 0.42, y + a.hr * 0.16, Math.sin(t) * a.hr * 0.42)); }
    return g;
  },
  glasses(a) {
    const g = new THREE.Group(), y = a.headY + a.hr * 0.1, z = a.hr * 0.97;
    for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(a.hr * 0.18, a.hr * 0.03, 8, 20), mat(DARK)), s * a.hr * 0.38, y, z));
    g.add(at(cyl(0.008, 0.008, a.hr * 0.4, DARK), 0, y, z)).rotation.z = Math.PI / 2;
    return g;
  },
  goggles(a) {
    const g = new THREE.Group(), y = a.headY + a.hr * 0.15;
    const band = at(new THREE.Mesh(new THREE.TorusGeometry(a.hr * 1.0, 0.025, 8, 32), mat(0x26a69a)), 0, y, 0.03);
    band.rotation.x = Math.PI / 2; g.add(band);
    for (const s of [-1, 1]) { const l = at(cyl(a.hr * 0.2, a.hr * 0.2, 0.08, 0x80deea), s * a.hr * 0.38, y, a.hr * 0.95); l.rotation.x = Math.PI / 2; g.add(l); }
    return g;
  },
  explorerhat(a) {
    const g = new THREE.Group(), y = a.headY + a.hr * 0.78, khaki = 0xc8a96a;
    g.add(at(cyl(a.hr * 0.95, a.hr * 0.95, 0.03, khaki), 0, y, 0));
    g.add(at(ball(a.hr * 0.58, khaki, 1, 0.7, 1), 0, y + 0.02, 0));
    g.add(at(cyl(a.hr * 0.59, a.hr * 0.59, 0.05, 0x5d4037), 0, y + 0.04, 0));
    return g;
  },
  headphones(a) {
    const g = new THREE.Group(), c = 0x5b5fc7;
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(a.hr * 1.04, 0.03, 8, 24, Math.PI), mat(c)), 0, a.headY, 0));
    for (const s of [-1, 1]) { const cup = at(cyl(a.hr * 0.25, a.hr * 0.25, 0.1, c), s * a.hr * 1.02, a.headY, 0); cup.rotation.z = Math.PI / 2; g.add(cup); }
    return g;
  },
  scarf(a) {
    const g = new THREE.Group(), c = 0xe85d75;
    const ring = at(new THREE.Mesh(new THREE.TorusGeometry(BODY_R * 0.62, BODY_R * 0.13, 10, 24), mat(c)), 0, a.neckY, 0.02);
    ring.rotation.x = Math.PI / 2; g.add(ring);
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(BODY_R * 0.25, BODY_R * 0.6, 0.06), mat(c)), BODY_R * 0.3, a.neckY - BODY_R * 0.3, BODY_R * 0.55));
    return g;
  },
  cape(a) {
    const cape = at(ball(BODY_R * 1.0, 0xc0392b, 1, 1.1, 0.2), 0, BODY_Y + 0.02, -BODY_R * 0.78);
    cape.material.side = THREE.DoubleSide; return cape;
  },
  bookbag() {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(BODY_R * 0.9, BODY_R * 0.9, BODY_R * 0.45), mat(0x4a90d9)), 0, BODY_Y + 0.05, -BODY_R * 0.95));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(BODY_R * 0.92, BODY_R * 0.35, BODY_R * 0.47), mat(0x2f6fb5)), 0, BODY_Y + 0.2, -BODY_R * 0.95));
    return g;
  },
  featherpen() {
    const g = new THREE.Group();
    const f = at(ball(BODY_R * 0.18, 0xffffff, 0.5, 2.6, 0.3), BODY_R * 0.35, BODY_Y + BODY_R * 0.9, -BODY_R * 0.8); f.rotation.z = -0.4; g.add(f);
    const nib = at(cone(0.03, 0.12, DARK), BODY_R * 0.12, BODY_Y + BODY_R * 0.35, -BODY_R * 0.8); nib.rotation.z = Math.PI - 0.4; g.add(nib);
    return g;
  },
};

/* ---------- ground per world ---------- */
const GROUNDS = {
  space: { top: 0x8a8fb8, props: (g) => [[0.7, 0.3], [-0.75, -0.2], [0.4, -0.65]].forEach(([x, z], i) => g.add(at(ball(0.09 + i * 0.03, 0x6b6f99, 1.2, 0.7, 1), x, 0.03, z))) },
  ocean: { top: 0xf3d9a4, props: (g) => [[0.75, -0.3], [-0.7, -0.4], [-0.55, 0.45]].forEach(([x, z], i) => g.add(at(cone(0.05, 0.35 + i * 0.08, 0x3fb68b), x, 0.18, z))) },
  pets: { top: 0x8fd16a, props: (g) => [[0.7, 0.35, 0xff8fb1], [-0.72, -0.1, 0xffd54f], [0.35, -0.7, 0x9fa8da]].forEach(([x, z, c]) => g.add(at(ball(0.06, c), x, 0.06, z))) },
  bakery: { top: 0xf5e6d3, props: (g) => [[0.7, 0.2, 0xff6fa5], [-0.65, -0.35, 0x64b5f6], [0.2, -0.75, 0xffd54f], [-0.4, 0.55, 0x81c784]].forEach(([x, z, c]) => { const s = at(capsule(0.015, 0.06, c), x, 0.02, z); s.rotation.z = Math.PI / 2; s.rotation.y = x * 3; g.add(s); }) },
};
function buildGround(world) {
  const cfg = GROUNDS[world] || GROUNDS.space, g = new THREE.Group();
  g.add(at(cyl(1.15, 1.2, 0.12, cfg.top), 0, -0.06, 0));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; g.add(shadow);
  cfg.props(g);
  return g;
}

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
}

/* ---------- mount ---------- */
export function mountCreature(el, look, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve });   // throws if WebGL is unavailable
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.touchAction = opts.interactive ? 'none' : 'auto';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 1.25, 4.2); camera.lookAt(0, 0.6, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);

  const stageRoot = new THREE.Group(); scene.add(stageRoot);
  const pivot = new THREE.Group(); stageRoot.add(pivot);   // turns with dragging
  const mover = new THREE.Group(); pivot.add(mover);       // hops and bobs
  let ground = null, creature = null, gear = [], current = null;
  const fx = new THREE.Group(); stageRoot.add(fx);         // hearts and sparkles

  function build(next) {
    if (ground && (!current || current.ground !== next.ground)) { stageRoot.remove(ground); disposeTree(ground); ground = null; }
    if (!ground) { ground = buildGround(next.ground); stageRoot.add(ground); }
    if (creature) { mover.remove(creature.group); disposeTree(creature.group); }
    gear.forEach(gm => { mover.remove(gm); disposeTree(gm); }); gear = [];
    creature = buildCreature(next);
    creature.group.scale.setScalar(SIZE[next.stage]);
    mover.add(creature.group);
    if (creature.anchors) for (const slot of ['head', 'neck', 'back']) {
      const id = next.wear && next.wear[slot];
      if (id && GEAR[id]) { const gm = GEAR[id](creature.anchors); gm.scale.setScalar(SIZE[next.stage]); mover.add(gm); gear.push(gm); }
    }
    current = { ...next, wear: { ...(next.wear || {}) } };
  }
  build(look);

  function resize() {
    const w = el.clientWidth || 200, h = el.clientHeight || 200;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(el);

  // animation state
  let hopT = -1, spinT = -1, last = performance.now(), t = 0, nextBlink = 2 + Math.random() * 3, raf = 0, visible = true;
  const reduced = !!opts.reducedMotion;
  const floaters = [];   // { sprite, life, vy }

  function addFloater(tex, x, y, size, vy = 0.6) {
    const s = at(sprite(tex, size), x, y, 0.3); fx.add(s); floaters.push({ s, life: 1.2, vy });
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    let y = 0;
    if (!reduced) {
      if (current.stage === 0) creature.group.rotation.z = Math.sin(t * 3) * 0.08 * (Math.sin(t * 0.7) > 0.3 ? 1 : 0.2);
      else y = Math.sin(t * 2) * 0.025;
    }
    if (hopT >= 0) { hopT += dt; const k = hopT / 0.45; y += k < 1 ? Math.sin(k * Math.PI) * (reduced ? 0.06 : 0.22) : 0; if (k >= 1) hopT = -1; }
    if (spinT >= 0) { spinT += dt; const k = Math.min(1, spinT / 0.9); mover.rotation.y = k * Math.PI * 2; if (k >= 1) { spinT = -1; mover.rotation.y = 0; } }
    mover.position.y = y;
    if (!reduced && creature.eyes.length) {
      nextBlink -= dt;
      const closed = nextBlink < 0 && nextBlink > -0.12;
      creature.eyes.forEach(e => { e.scale.y = closed ? 0.15 : 1; });
      if (nextBlink <= -0.12) nextBlink = 2.5 + Math.random() * 3;
    }
    creature.group.traverse(o => { if (o.userData.twinkle !== undefined && !reduced) o.material.opacity = 0.55 + 0.45 * Math.sin(t * 3 + o.userData.twinkle); });
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.life -= dt; f.s.position.y += f.vy * dt; f.s.material.opacity = Math.max(0, f.life);
      if (f.life <= 0) { fx.remove(f.s); disposeTree(f.s); floaters.splice(i, 1); }
    }
    renderer.render(scene, camera);
    const busy = hopT >= 0 || spinT >= 0 || floaters.length;
    if (visible && (!reduced || busy)) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && document.visibilityState === 'visible'; if (visible) kick(); });
  io.observe(el);
  const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) kick(); };
  document.addEventListener('visibilitychange', onVis);

  function pet() {
    hopT = 0;
    if (!reduced) { const h = heartTex(); addFloater(h, -0.2, 1.3, 0.22); addFloater(h, 0.25, 1.45, 0.18, 0.5); }
    if (opts.onPet) opts.onPet();
    kick();
  }

  // drag to turn, tap to pet
  let down = null;
  const onDown = e => { down = { x: e.clientX, y: e.clientY, rot: pivot.rotation.y, moved: false }; canvas.setPointerCapture(e.pointerId); };
  const onMove = e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 6) down.moved = true;
    if (down.moved) { pivot.rotation.y = down.rot + dx * 0.012; kick(); }
  };
  const onUp = () => { if (down && !down.moved) pet(); down = null; };
  if (opts.interactive) {
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', () => { down = null; });
  }

  kick();

  return {
    update(next) { build(next); kick(); },
    celebrate(kind) {
      if (reduced) {
        canvas.style.transition = 'none'; canvas.style.opacity = '0';
        requestAnimationFrame(() => { canvas.style.transition = 'opacity .6s'; canvas.style.opacity = '1'; });
        kick(); return;
      }
      hopT = 0; if (kind === 'grow') spinT = 0;
      const sp = sparkleTex();
      for (let i = 0; i < (kind === 'grow' ? 6 : 3); i++) addFloater(sp, (Math.random() - 0.5) * 1.4, 0.4 + Math.random() * 0.9, 0.16, 0.4);
      kick();
    },
    dispose() {
      cancelAnimationFrame(raf); raf = 0; visible = false;
      ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis);
      disposeTree(scene);
      renderer.dispose(); renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
```

- [ ] **Step 3: Write the gallery page**

Create `tests/creature-gallery.html` (dev-only, not deployed):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Creature gallery</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f4f1ea; margin: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
    figure { margin: 0; background: #fff; border-radius: 12px; padding: 6px; }
    .v { height: 170px; }
    figcaption { font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <p>Static gallery (one frame each, so the page doesn't create dozens of live WebGL loops). Change the query: <code>?wear=crown,scarf,cape&amp;color=3&amp;ground=ocean</code></p>
  <div class="grid" id="g"></div>
  <script src="../pet-rules.js"></script>
  <script type="module">
    import { mountCreature } from '../creature.js';
    const q = new URLSearchParams(location.search);
    const wear = { head: null, neck: null, back: null };
    (q.get('wear') || '').split(',').filter(Boolean).forEach(id => { wear[PetRules.ITEM_BY_ID[id].slot] = id; });
    const color = +(q.get('color') || 0), ground = q.get('ground') || 'space';
    const grid = document.getElementById('g');
    for (const species of PetRules.SPECIES_ORDER) for (let stage = 0; stage < 5; stage++) {
      const f = document.createElement('figure');
      f.innerHTML = `<div class="v"></div><figcaption>${species} · ${PetRules.STAGES[stage].name}</figcaption>`;
      grid.appendChild(f);
      const v = mountCreature(f.querySelector('.v'), { species, stage, color, wear, ground }, { interactive: false, reducedMotion: true, preserve: true });
      // keep one frame as an image, then free the WebGL context
      setTimeout(() => { const c = f.querySelector('canvas'), img = new Image(); img.src = c.toDataURL(); img.style.width = '100%'; v.dispose(); f.querySelector('.v').appendChild(img); }, 300);
    }
  </script>
</body>
</html>
```

- [ ] **Step 4: Look at it in the preview**

Start the preview (`preview_start` name `math-quest`), open `http://localhost:5173/tests/creature-gallery.html`, then:
- `read_console_messages` with `onlyErrors: true` → expected: none.
- Screenshot. Expected: 20 tiles (4 species × 5 stages): eggs with spots; babies with big heads; dragons with horns and (Kid+) wings; foxes with pointed ears and a big tail; axolotls with 6 gill fronds; bunny-cats with long ears and whiskers; Legendary with a soft glow and sparkles.
- Open `?wear=crown,scarf,cape&color=3&ground=ocean` and `?wear=glasses,bookbag&ground=bakery` and `?wear=goggles,featherpen&ground=pets` and `?wear=headphones&ground=space` and `?wear=explorerhat`. Expected: each item sits on the head/neck/back without floating far off or hiding the face; the ground color and props change.
- If a part is clearly misplaced, adjust its position numbers in `creature.js` and reload. Keep tweaks to numbers only.

- [ ] **Step 5: Commit**

```bash
git add lib/three-0.170.0.module.min.js creature.js tests/creature-gallery.html
git commit -m "Creature companion: 3D creatures, gear and grounds with Three.js r170"
```

---

### Task 3: Hook the creature into app.js (loader, rules, sync)

**Files:**
- Modify: `app.js` — `render()` (around line 925), new section after `showPct` (around line 917), `mergePlayer()` (around line 2434), `finishMission()` (around line 1548), `finishQuest()` (around line 1700), `awardFinish()` (around line 1904)

**Interfaces:**
- Consumes: `PetRules.*` (Task 1), `mountCreature` (Task 2), existing `POOLS`, `SUBJECT_ORDER`, `parentMissions(p, sid)`, `missionMastery(p, sid, id)`, `typeTarget(p)`, `theme(p)`, `save()`.
- Produces (inside the app.js IIFE):
  - `petMastered(p) -> number`
  - `petStage(p) -> 0..4`
  - `petLook(p) -> look` (for `mountCreature`)
  - `updatePet(p) -> [new item ids]` (adds earned items to `p.pet.items`; no-op without a pet)
  - `showCreature(el, p, opts) -> Promise<view|null>` (mounts the 3D view or the emoji fallback; tracks it so `render()` disposes it)
  - `markPetSeen(p)` (sets `seenStage` and `seenItems`)

- [ ] **Step 1: Write the browser check (fails before the change)**

With the preview open at `http://localhost:5173/`, run in `javascript_tool`:

```js
typeof window.PetRules === 'object' && !!document.querySelector('script[src="pet-rules.js"]')
```
Expected: `true` (from Task 1). Then this check, which uses the test hook added in Step 3:

```js
!!(window.__pet && window.__pet.petMastered)
```
Expected now: `false`.

- [ ] **Step 2: Add the loader, rules glue and fallback**

In `app.js`, after the line `const showPct = x => ...;`, add:

```js
/* =========================================================
   Creature companion (spec: docs/superpowers/specs/2026-11-17-creature-companion-design.md)
   Rules: pet-rules.js. 3D: creature.js, loaded only when a screen shows the creature.
   ========================================================= */
const PR = window.PetRules;
// deploy.sh adds ?v=<sha> to app.js; reuse it so the browser never keeps an old creature.js
const ASSET_Q = ((document.currentScript && document.currentScript.src) || '').split('?')[1] || '';
let creatureMod = null, creatureView = null, creatureToken = 0;
function loadCreature() {
  if (!creatureMod) creatureMod = import('./creature.js' + (ASSET_Q ? '?' + ASSET_Q : '')).catch(() => null);
  return creatureMod;
}
let POOL_KEYS = null;
function petMastered(p) {
  if (!POOL_KEYS) POOL_KEYS = new Set(Object.values(POOLS).flat());
  let n = 0;
  for (const [k, s] of Object.entries(p.stats || {})) {
    if (k.startsWith('q:') ? s.box >= 2 : POOL_KEYS.has(k) && s.box >= 3) n++;
  }
  return n;
}
const petStage = p => PR.stageFor(petMastered(p));
const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function petLook(p) {
  const pet = p.pet, stage = petStage(p);
  return { species: pet.species, stage, color: Math.min(pet.color || 0, PR.colorsUnlocked(stage) - 1),
    wear: { ...pet.wear }, ground: p.theme || 'space' };
}
function petContext(p) {
  const streakOk = p.lastDay && dayDiff(p.lastDay, today()) <= 1;
  const subjectsMastered = SUBJECT_ORDER.filter(sid => sid !== 'typing' &&
    parentMissions(p, sid).some(m => missionMastery(p, sid, m.id) >= 0.8));
  const goal = typeTarget(p);
  const typingGoal = Object.entries(p.typing || {}).some(([id, runs]) => id !== 'type-game' && runs.some(r => r.wpm >= goal && r.acc >= 90));
  return { streak: streakOk ? p.streak || 0 : 0, subjectsMastered, typingGoal };
}
function updatePet(p) {
  if (!p.pet) return [];
  const add = PR.newItems(p.pet, petContext(p));
  if (add.length) p.pet.items = [...p.pet.items, ...add];
  return add;
}
function markPetSeen(p) {
  if (!p.pet) return;
  p.pet.seenStage = Math.max(p.pet.seenStage || 0, petStage(p));
  p.pet.seenItems = [...p.pet.items];
}
function petFallbackHtml(p) {
  const sp = PR.SPECIES[p.pet.species];
  return `<span class="pet-emoji pet-stage-${petStage(p)}" aria-hidden="true">${sp.emoji}</span>`;
}
// Mounts the 3D creature (or the emoji fallback) into el. Only one 3D view lives at a time.
async function showCreature(el, p, opts = {}) {
  if (creatureView) { creatureView.dispose(); creatureView = null; }
  const token = ++creatureToken;
  const mod = await loadCreature();
  if (token !== creatureToken || !el.isConnected) return null;   // the screen changed while loading
  if (mod) {
    try {
      creatureView = mod.mountCreature(el, petLook(p), { reducedMotion: reducedMotion(), ...opts });
      el.classList.add('has-3d');
      return creatureView;
    } catch (e) { /* no WebGL */ }
  }
  el.innerHTML = petFallbackHtml(p);
  return null;
}
```

- [ ] **Step 3: Dispose the 3D view on every screen change, and add a test hook**

Replace the start of `render()`:

```js
function render(html, name = '') {
  screen = name;
```

with:

```js
function render(html, name = '') {
  screen = name;
  creatureToken++;   // cancels a view that is still loading
  if (creatureView) { creatureView.dispose(); creatureView = null; }
```

At the very end of the creature section from Step 2, add (used only by the browser checks):

```js
window.__pet = { petMastered, petStage, petContext, updatePet, markPetSeen, petLook };
```

- [ ] **Step 4: Check unlocks after every finish**

In `finishMission()`, after `touchStreak(p);` add `updatePet(p);`.
In `finishQuest()`, after `touchStreak(p);` add `updatePet(p);`.
In `awardFinish()`, after `touchStreak(p);` add `updatePet(p);`.

(These run before `save()` in each function, so new items are saved and synced.)

- [ ] **Step 5: Merge the pet in sync**

In `mergePlayer(a, b)`, before `delete m.dirty;` add:

```js
  const pet = PR.mergePet(a.pet, b.pet);
  if (pet) m.pet = pet; else delete m.pet;
```

- [ ] **Step 6: Run the browser checks**

Reload the preview (unregister the service worker first: `navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))`, then `caches.keys().then(ks => ks.forEach(k => caches.delete(k)))`, then reload). Run:

```js
(() => {
  const P = window.__pet, out = {};
  const p = { stats: { 'q:read-words-1': { r: 2, w: 0, box: 2 }, 'q:read-words-2': { r: 1, w: 0, box: 1 }, '3+4': { r: 3, w: 0, box: 3 }, '9+9': { r: 2, w: 0, box: 2 }, 'story:x': { r: 5, w: 0, box: 5 } },
    streak: 7, lastDay: new Date().toLocaleDateString('en-CA'), typing: {}, missions: {}, grade: 2, theme: 'ocean' };
  out.mastered = P.petMastered(p);                       // 2: one bank key at box 2, one pool key at box 3
  p.pet = PetRules.newPet('fox', 'Maple');
  out.added = P.updatePet(p);                            // ['scarf','cape']
  out.again = P.updatePet(p);                            // []
  out.look = P.petLook(p);                               // stage 0, ground 'ocean'
  return out;
})()
```
Expected: `{ mastered: 2, added: ['scarf','cape'], again: [], look: { species:'fox', stage:0, color:0, wear:{head:null,neck:null,back:null}, ground:'ocean' } }`.

Check `read_console_messages` with `onlyErrors: true` → none. Also run `node --test 'tests/*.test.js'` → still passing.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "Creature companion: load the 3D view on demand, count mastery, unlock items, merge in sync"
```

---

### Task 4: Hatch screen, home card and den

**Files:**
- Modify: `app.js` — `showHome()` (around line 1114), new functions `petCardHtml`, `bindPetCard`, `showHatch`, `showDen` placed right after `showHome()`
- Modify: `style.css` — append the creature styles

**Interfaces:**
- Consumes: everything from Task 3.
- Produces: `showHatch()`, `showDen()`, `petMomentText(p, moment) -> string` (used again in Task 5).

- [ ] **Step 1: Write the browser check (fails before the change)**

Seed a test player and open home (run in `javascript_tool`, then reload):

```js
(() => {
  const s = JSON.parse(localStorage.getItem('mathquest.v1') || '{"profiles":[],"sound":true}');
  s.profiles = s.profiles.filter(p => p.id !== 'ptest');
  const stats = {}; for (let i = 1; i <= 80; i++) stats['q:test-' + i] = { r: 2, w: 0, box: 2 };
  s.profiles.push({ id: 'ptest', name: 'Testy', avatar: '🚀', grade: 3, theme: 'space', points: 0, streak: 3,
    lastDay: new Date().toLocaleDateString('en-CA'), found: {}, stats, missions: {}, passages: {} });
  s.current = 'ptest'; localStorage.setItem('mathquest.v1', JSON.stringify(s)); return 'ok';
})()
```
Then `find` "An egg is waiting". Expected now: no match.

- [ ] **Step 2: Add the card, hatch and den**

After the closing `}` of `showHome()`, add:

```js
/* ----- Creature: home card, hatching, den ----- */
function petMomentText(p, mo) {
  const nm = esc(p.pet.name), parts = [];
  if (mo.grew) parts.push(mo.stage === 1 ? `${nm} hatched!` : `${nm} grew into a ${PR.STAGES[mo.stage].name}!`);
  if (mo.items.length) parts.push(`New for ${nm}: ${mo.items.map(id => `${PR.ITEM_BY_ID[id].icon} ${esc(PR.ITEM_BY_ID[id].name)}`).join(', ')}`);
  return parts.join(' ');
}
function petProgressText(p) {
  const pr = PR.progress(petMastered(p));
  if (pr.toNext === null) return 'Fully grown!';
  const verb = pr.stage === 0 ? 'to hatch' : 'to grow';
  return `${plural(pr.toNext, 'more mastered question')} ${verb}`;
}
function petCardHtml(p) {
  if (!p.pet || !p.pet.species) return `<button class="card pet-card pet-egg-card" id="petCard">
      <span class="pet-egg-icon" aria-hidden="true">🥚</span>
      <span><b>An egg is waiting for you!</b><span class="muted">Pick a creature and give it a name.</span></span></button>`;
  const sp = PR.SPECIES[p.pet.species], mo = PR.pendingMoment(p.pet, petStage(p));
  return `<button class="card pet-card" id="petCard" aria-label="Visit ${esc(p.pet.name)}">
      <span class="pet-view small" id="petView"></span>
      <span class="pet-info"><b>${esc(p.pet.name)}</b><span class="muted">${PR.STAGES[petStage(p)].name} ${sp.name}</span>
        ${mo ? `<span class="pet-new">${petMomentText(p, mo)}</span>` : `<span class="muted">${petProgressText(p)}</span>`}</span></button>`;
}
function bindPetCard(p) {
  const card = document.getElementById('petCard');
  if (!card) return;
  card.onclick = () => p.pet && p.pet.species ? showDen() : showHatch();
  const view = document.getElementById('petView');
  if (!view) return;
  const mo = PR.pendingMoment(p.pet, petStage(p));
  showCreature(view, p, { interactive: false }).then(v => {
    if (mo) { if (v) v.celebrate(mo.grew ? 'grow' : 'item'); markPetSeen(p); save(); }
  });
}

function showHatch() {
  const p = me(); if (!p) return showProfiles();
  applyTheme(p.theme);
  let pick = null, name = '';
  const draw = () => {
    render(`
      <div class="topbar"><button class="btn ghost small" id="back">← Back</button></div>
      <div class="card stack">
        <h1>Pick your egg</h1>
        <p class="muted">Each egg holds a different creature. It grows as you master questions.</p>
        <div class="egg-pick">${PR.SPECIES_ORDER.map(id => `<button class="pick egg" data-sp="${id}" aria-pressed="${id === pick}">
          <span class="egg-emoji" aria-hidden="true">🥚${PR.SPECIES[id].emoji}</span>${PR.SPECIES[id].name}</button>`).join('')}</div>
        ${pick ? `<div>
          <label class="lbl" for="petName">Name your ${PR.SPECIES[pick].name.toLowerCase()}</label>
          <input class="text" id="petName" maxlength="16" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" value="${esc(name || PR.SPECIES[pick].defaultName)}">
        </div>
        <div class="row-actions" style="justify-content:flex-start"><button class="btn" id="hatch">Keep my egg 🥚</button></div>` : ''}
      </div>`);
    document.getElementById('back').onclick = showHome;
    bindAll('[data-sp]', el => { const nmEl = document.getElementById('petName'); if (nmEl) name = nmEl.value; pick = el.dataset.sp; draw(); });
    const h = document.getElementById('hatch');
    if (h) h.onclick = () => {
      const nm = PR.cleanName(document.getElementById('petName').value);
      if (!nm) { toast('Give your creature a name!'); return; }
      const kept = p.pet ? p.pet.items : [];
      const old = p.pet;
      p.pet = PR.newPet(pick, nm, kept);
      if (old) { p.pet.seenStage = old.seenStage || 0; p.pet.color = 0; }
      updatePet(p); p.pet.seenItems = [...p.pet.items];   // gear she already earned isn't "new"
      save(); showDen();
    };
  };
  draw();
}

function showDen() {
  const p = me(); if (!p) return showProfiles();
  if (!p.pet || !p.pet.species) return showHatch();
  applyTheme(p.theme);
  const pet = p.pet, stage = petStage(p), sp = PR.SPECIES[pet.species];
  const mo = PR.pendingMoment(pet, stage), colors = PR.colorsUnlocked(stage);
  const slotName = { head: 'Head', neck: 'Neck', back: 'Back' };
  render(`
    <div class="topbar"><button class="btn ghost small" id="back">← Home</button></div>
    <div class="card stack den">
      <div class="den-head"><h1>${esc(pet.name)}</h1><span class="muted">${PR.STAGES[stage].name} ${sp.name} · ${petProgressText(p)}</span></div>
      ${mo ? `<p class="pet-new big">${petMomentText(p, mo)}</p>` : ''}
      <div class="pet-view large" id="petView" role="img" aria-label="${esc(pet.name)} the ${sp.name}"></div>
      <p class="muted center den-hint">Drag to turn ${esc(pet.name)}. Tap to pet.</p>
      ${['head', 'neck', 'back'].map(slot => {
        const items = PR.ITEMS.filter(it => it.slot === slot);
        return `<div><span class="lbl">${slotName[slot]}</span><div class="wardrobe">${items.map(it => pet.items.includes(it.id)
          ? `<button class="pick ward" data-wear="${it.id}" aria-pressed="${pet.wear[slot] === it.id}"><span aria-hidden="true">${it.icon}</span>${esc(it.name)}</button>`
          : `<span class="pick ward locked"><span aria-hidden="true">🔒</span>${esc(it.how)}</span>`).join('')}</div></div>`;
      }).join('')}
      <div><span class="lbl">Colors</span><div class="swatches">${sp.patterns.map((c, i) => i < colors
        ? `<button class="swatch" data-color="${i}" aria-pressed="${(pet.color || 0) === i}" aria-label="Color ${i + 1}" style="--a:#${c[0].toString(16).padStart(6, '0')};--b:#${c[2].toString(16).padStart(6, '0')}"></button>`
        : `<span class="swatch locked" aria-label="Locked color"></span>`).join('')}</div>
        ${colors < 10 ? `<p class="muted" style="margin:6px 0 0">${esc(pet.name)} gets 2 new colors at each new stage.</p>` : ''}</div>
    </div>`);
  document.getElementById('back').onclick = showHome;
  const el = document.getElementById('petView');
  let view = null;
  showCreature(el, p, { interactive: true, onPet: () => sfx.good() }).then(v => {
    view = v;
    if (mo) { if (v) v.celebrate(mo.grew ? 'grow' : 'item'); markPetSeen(p); save(); }
  });
  const change = fn => { fn(); pet.updated = Date.now(); save(); showDen(); };
  bindAll('[data-wear]', b => change(() => { const it = PR.ITEM_BY_ID[b.dataset.wear]; pet.wear[it.slot] = pet.wear[it.slot] === it.id ? null : it.id; }));
  bindAll('[data-color]', b => change(() => { pet.color = +b.dataset.color; }));
}
```

(`sfx.good()` is the existing right-answer chime; `beep` already respects the sound setting.)

Note: `showDen()` redraws the whole screen on a wardrobe change (same pattern as the rest of the app). That remounts the 3D view, which is fine for a tap.

- [ ] **Step 3: Show the card on the home screen**

In `showHome()`, in the template, change:

```js
      ${questCardHtml(p)}
```
to:
```js
      ${petCardHtml(p)}
      ${questCardHtml(p)}
```

At the end of `showHome()`, after the `snd` handler, add:

```js
  bindPetCard(p);
```

- [ ] **Step 4: Add the styles**

Append to `style.css`:

```css
/* ----- Creature companion ----- */
.pet-card { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; cursor: pointer; }
.pet-card .pet-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pet-card b { font-size: 1.3rem; }
.pet-egg-card .pet-egg-icon { font-size: 3rem; }
.pet-egg-card span:last-child { display: flex; flex-direction: column; gap: 2px; }
.pet-view { display: grid; place-items: center; border-radius: 18px; background: color-mix(in srgb, var(--accent2) 14%, transparent); overflow: hidden; flex: none; }
.pet-view.small { width: 120px; height: 120px; }
.pet-view.large { width: 100%; height: min(60vh, 420px); }
.pet-emoji { font-size: 4rem; line-height: 1; }
.pet-view.large .pet-emoji { font-size: 8rem; }
.pet-emoji.pet-stage-0 { filter: grayscale(.4); }
.pet-new { font-weight: 600; color: var(--accent-text); }
.pet-new.big { font-size: 1.3rem; text-align: center; margin: 0; }
.den-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.den-head h1 { margin: 0; }
.den-hint { margin: -4px 0 0; }
.egg-pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.pick.egg { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; }
.egg-emoji { font-size: 2.2rem; }
.wardrobe { display: flex; flex-wrap: wrap; gap: 8px; }
.pick.ward { display: inline-flex; align-items: center; gap: 6px; }
.pick.ward.locked { opacity: .6; font-size: .95rem; cursor: default; }
.swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.swatch { width: 44px; height: 44px; border-radius: 50%; border: 3px solid transparent; background: linear-gradient(135deg, var(--a) 60%, var(--b) 60%); cursor: pointer; padding: 0; }
.swatch[aria-pressed="true"] { border-color: var(--accent-text); }
.swatch.locked { background: repeating-linear-gradient(45deg, #ccc 0 6px, #e6e6e6 6px 12px); cursor: default; }
.result .pet-view.small { margin: 0 auto; width: 160px; height: 160px; }
@media (max-width: 560px) { .pet-view.small { width: 96px; height: 96px; } }
```

(`--accent2` and `--accent-text` are defined by every world theme in `style.css`.)

- [ ] **Step 5: Run the browser checks**

Reload (with the test player from Step 1). Then:
- `find` "An egg is waiting" → 1 match. Click it.
- Hatch screen: 4 egg buttons. Click "Fox"; the name box shows "Maple"; click "Keep my egg".
- Den: heading "Maple", text "Kid Fox · …" (80 mastered → Kid), "Maple grew into a Kid!" shows once, a canvas is inside `#petView` (`document.querySelector('#petView canvas') !== null` → `true`), Neck row has "Scarf" (streak 3) as a button, other items locked with their how-to text, 6 color swatches unlocked and 4 locked.
- Click "Scarf" → it shows pressed after the redraw; `JSON.parse(localStorage.getItem('mathquest.v1')).profiles.find(p=>p.id==='ptest').pet.wear.neck === 'scarf'` → `true`.
- Click a color → pressed; creature changes color (screenshot).
- Back to home: the card shows the 3D creature (120px) and "121 more mastered questions to grow"; no "grew" text again.
- Navigate home → den → home 5 times, then: `document.querySelectorAll('canvas').length` → `1` (old views disposed).
- `read_console_messages` with `onlyErrors: true` → none.
- `resize_window` preset `mobile` → the card and den fit without sideways scrolling (screenshot); then preset `desktop`.

- [ ] **Step 6: Commit**

```bash
git add app.js style.css
git commit -m "Creature companion: home card, egg picking and the den with gear and colors"
```

---

### Task 5: Moments on finish screens

**Files:**
- Modify: `app.js` — `finishMission()`, `finishQuest()`, `awardFinish()`; new helpers `petMomentHtml`, `bindPetMoment` next to `petCardHtml`

**Interfaces:**
- Consumes: `PR.pendingMoment`, `petMomentText`, `showCreature`, `markPetSeen`, `petStage`.
- Produces: `petMomentHtml(p) -> string` (empty when nothing to show), `bindPetMoment(p)`.

- [ ] **Step 1: Write the browser check (fails before the change)**

With the test player from Task 4 (Maple, Kid, scarf seen), set up a pending item:

```js
(() => { const s = JSON.parse(localStorage.getItem('mathquest.v1')); const p = s.profiles.find(p => p.id === 'ptest');
  p.streak = 7; p.lastDay = new Date().toLocaleDateString('en-CA'); localStorage.setItem('mathquest.v1', JSON.stringify(s)); return 'ok'; })()
```
Reload, play any short mission to the end (or run the eval harness: fetch `/app.js`, inject `window.__t = { finishMission, me, game: () => game, setGame: g => { game = g; } }` before the final `})();`, eval, then `__t.setGame({ missionId: 'addsub', subject: 'math', firstTry: 8, len: 10, started: Date.now() - 60000 }); __t.finishMission();`).
Then `find` "New for Maple". Expected now: no match.

- [ ] **Step 2: Add the helpers**

After `bindPetCard()`, add:

```js
function petMomentHtml(p) {
  const mo = p.pet && PR.pendingMoment(p.pet, petStage(p));
  if (!mo) return '';
  return `<div class="pet-moment stack"><div class="pet-view small" id="petMoment"></div><h2 style="margin:0">${petMomentText(p, mo)}</h2></div>`;
}
function bindPetMoment(p) {
  const el = document.getElementById('petMoment');
  if (!el) return;
  const mo = PR.pendingMoment(p.pet, petStage(p));
  markPetSeen(p); save();   // seen once, even if she leaves before the 3D view loads
  showCreature(el, p, { interactive: false }).then(v => { if (v && mo) v.celebrate(mo.grew ? 'grow' : 'item'); });
}
```

- [ ] **Step 3: Show it on the three finish screens**

In `finishMission()`, in the template, right after `<h1>${th.finish}</h1>`, add `${petMomentHtml(p)}`. After the last `onclick` line of the function, add `bindPetMoment(p);`.

In `finishQuest()`, right after the `<h1>${first ? '⭐ Quest complete!' : 'Extra practice done!'}</h1>` line, add `${petMomentHtml(p)}`. After `document.getElementById('home').onclick = showHome;` add `bindPetMoment(p);`.

In `awardFinish()`, right after `<h1>${title}</h1>`, add `${petMomentHtml(p)}`. After `document.getElementById('home').onclick = showHome;` add `bindPetMoment(p);`.

Note: `petMomentHtml(p)` must be evaluated before `bindPetMoment(p)` marks things seen; the order above (render first, bind after) does that.

- [ ] **Step 4: Run the browser checks**

Repeat Step 1's finish. Expected:
- `find` "New for Maple: 🦸 Cape" → 1 match, and a canvas in `#petMoment`.
- Click Home: the home card shows the progress text, not "New for Maple".
- Finish another mission: no pet moment (`document.getElementById('petMoment') === null` → `true`).
- Stage change: give the test player 200 mastered keys (`for i 1..200 stats['q:test-'+i] = {r:2,w:0,box:2}`), reload, finish a mission → "Maple grew into a Grown!" once.
- A player with no pet finishing a mission: no moment, no errors.
- `read_console_messages` `onlyErrors: true` → none.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "Creature companion: grow and new-gear moments on finish screens"
```

---

### Task 6: Grown-ups line and creature reset

**Files:**
- Modify: `app.js` — `showParents()` card template (around line 2276), `showEditProfile()` (around line 1032)

**Interfaces:**
- Consumes: `PR`, `petStage`, `grownupUnlocked()`, `save()`.
- Produces: nothing new for other tasks.

- [ ] **Step 1: Write the browser check (fails before the change)**

With the test player (Maple), open the Grown-ups page (unlock with the family password or PIN in the preview; or call the gate's success path from the eval harness: `__t.unlockGrownup(); __t.showParents();` with those added to `__t`). `find` "Maple the Fox". Expected now: no match.

- [ ] **Step 2: Add the line on each child's card**

In `showParents()`, change:

```js
        <div class="gu-head"><span class="gu-av">${p.avatar}</span><div><h2>${esc(p.name)}</h2><span class="muted">${esc(levelsText(p))}</span></div>
          <span class="chip">🔥 ${plural(streakOf(p), 'day')}</span></div>
```
to:
```js
        <div class="gu-head"><span class="gu-av">${p.avatar}</span><div><h2>${esc(p.name)}</h2><span class="muted">${esc(levelsText(p))}</span></div>
          <span class="chip">🔥 ${plural(streakOf(p), 'day')}</span></div>
        ${p.pet && p.pet.species ? `<p class="muted gu-note">${PR.SPECIES[p.pet.species].emoji} ${esc(p.pet.name)} the ${PR.SPECIES[p.pet.species].name} · ${PR.STAGES[petStage(p)].name} · ${p.pet.items.length} of ${PR.ITEMS.length} items</p>` : ''}
```

- [ ] **Step 3: Add the reset for grown-ups**

In `showEditProfile()`, in the `existing ? \`<div class="row-actions" ...delP...` block, before that delete row, add:

```js
        ${existing && existing.pet && existing.pet.species && grownupUnlocked() ? `<div class="row-actions" style="justify-content:flex-start">
          <button class="btn ghost small" id="petReset" type="button">🥚 Let ${esc(existing.name)} pick a new creature</button></div>` : ''}
```

After the `dp` handler block, add:

```js
    const pr = document.getElementById('petReset');
    if (pr) pr.onclick = () => {
      if (!confirm(`${existing.pet.name} goes back into an egg, and ${existing.name} picks a new creature. Gear and colors are kept. OK?`)) return;
      existing.pet.species = null; existing.pet.wear = { head: null, neck: null, back: null }; existing.pet.updated = Date.now();
      save(); toast('Done! A new egg is waiting.'); draw();
    };
```

(`showHatch()` from Task 4 already keeps `items` and `seenStage` when `p.pet` exists.)

- [ ] **Step 4: Run the browser checks**

- Grown-ups page: Testy's card shows "🦊 Maple the Fox · Kid · 2 of 9 items" (numbers match the test data).
- Player settings with the grown-ups page unlocked: "Let Testy pick a new creature" shows; while locked it does not show.
- Click it, accept: the home card shows "An egg is waiting for you!"; pick Dragon, name "Pip": the den shows earned items still unlocked and no "grew" moment (the stage was already seen).
- `read_console_messages` `onlyErrors: true` → none.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "Creature companion: line on the Grown-ups page and a grown-up reset"
```

---

### Task 7: Offline cache and full check

**Files:**
- Modify: `sw.js` (CACHE name and CORE list)

- [ ] **Step 1: Cache the new files**

In `sw.js`, change `const CACHE = 'quest-academy-v2';` to `const CACHE = 'quest-academy-v3';` and add to `CORE` after `'app.js',`:

```js
  'pet-rules.js', 'creature.js', 'lib/three-0.170.0.module.min.js',
```

- [ ] **Step 2: Check offline in the preview**

Reload twice (the new worker installs and takes over). Then:

```js
caches.open('quest-academy-v3').then(c => Promise.all(['pet-rules.js', 'creature.js', 'lib/three-0.170.0.module.min.js'].map(u => c.match(u).then(r => !!r))))
```
Expected: `[true, true, true]`.

- [ ] **Step 3: Full pass**

- `node --test 'tests/*.test.js'` → all pass.
- Fresh player (no pet): home shows the egg card; finishing a mission shows no moment; no errors.
- Test player: home card, den (drag turns, tap hops with hearts), gear and colors, moments, Grown-ups line, reset.
- Reduced motion: `resize_window` can't set it, so check with `javascript_tool`: temporarily run `window.matchMedia = q => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} })` before opening the den; the creature is still until tapped; a tap gives a small hop with no hearts.
- Fallback: `javascript_tool`: `HTMLCanvasElement.prototype.getContext = () => null` then open the den → the 🦊 emoji shows in place of the canvas, wardrobe still works, no uncaught errors.
- Phone width (`resize_window` preset `mobile`): home card and den fit; then preset `desktop`.
- Clear the test data: remove profile `ptest` from `mathquest.v1` and reset `current`; unregister the service worker and clear caches.

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "Creature companion: cache the creature files for offline play"
```

- [ ] **Step 5: Hand off for deploy**

Do not deploy without the user's go-ahead. When approved: `server/deploy.sh`, then check `https://learn.kmydev.com/creature.js` and `https://learn.kmydev.com/lib/three-0.170.0.module.min.js` return 200, then `git push origin main`. Ask the user to try it on an iPad (smooth, not hot, works offline after one online visit).
