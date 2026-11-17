# Creature companion (3D) — design

Date: 2026-11-17. Status: approved in conversation, pending spec review.

## Goal

Give each player a 3D creature that grows as she masters questions and earns gear at milestones, so progress turns into something she can see, name and play with. This is the first of three pieces; family reward goals (e.g. a trip) and game-style missions are separate designs that come later.

Built on the live vanilla site (not the React rewrite), with Three.js.

## What the kids see

### Hatching
- A player without a creature sees an "An egg is waiting for you!" card on her home screen.
- Tapping it opens the hatch screen: 4 eggs, each showing the species it holds (Dragon, Fox, Axolotl, Bunny-cat). She picks one and types a name (1–16 characters, default suggested name per species).
- The egg sits in the den and wobbles until she has 10 mastered questions, then hatches (with the growth moment below). Players who already have 10 or more hatch right after naming.
- The species can't be changed after picking (a grown-up can reset it from the player's settings on the Grown-ups page, which returns it to the egg choice; gear and colors are kept).

### Growth stages
| Stage | Mastered questions |
|---|---|
| Egg | 0–9 |
| Baby | 10–74 |
| Kid | 75–199 |
| Grown | 200–399 |
| Legendary | 400+ |

- Thresholds live in one constant (`PET_STAGES`) so they are easy to tune.
- "Mastered" counts across every subject: bank questions (`q:` keys) with `box >= 2`, and math pool keys with `box >= 3` (the same rules the app already uses for mastery).
- Each stage is bigger and more detailed. Legendary adds a soft glow and one flourish per species (dragon wings, fox tail trail, axolotl gill sparkles, bunny-cat ear tufts).
- When the stage is higher than the last one she was shown, the next mission finish screen (or the home screen, if the change came from sync) plays a short growth moment: the creature in 3D with "Pip grew into a Kid!". Only the newest stage is celebrated if several were passed at once.

### Gear and colors
Items, once earned, are kept forever.

| Item | Slot | Earned by |
|---|---|---|
| Scarf | neck | 3-day streak |
| Cape | back | 7-day streak |
| Crown | head | 30-day streak |
| Glasses | head | first math mission mastered |
| Bookbag | back | first reading mission mastered |
| Feather pen | back | first writing mission mastered |
| Goggles | head | first science mission mastered |
| Explorer hat | head | first social studies mission mastered |
| Headphones | head | typing goal reached (a lesson at or above her words-per-minute target) |

- "Mission mastered" uses the existing per-mission mastery measure reaching 80%.
- Colors: every species starts with 2 color patterns; each new stage unlocks 2 more (10 total at Legendary).
- She wears at most one item per slot (head, neck, back) and picks one color pattern.
- New items show with a "New!" moment on the finish screen, the same way as growth.

### Home screen card
- At the top of the home screen: a small 3D view of the creature idling (blink, gentle bob), its name, stage, and progress text such as "12 more mastered questions to grow". At Legendary: "Fully grown!".
- Tapping the card opens the den.

### Den screen
- A bigger 3D scene. The ground matches her world: moon rocks (Space), seabed (Ocean), park grass (Pet Rescue), kitchen counter (Magic Bakery).
- Drag to turn the creature; tap it to pet (it hops and shows hearts).
- Wardrobe: earned items by slot, tap to wear or take off. Color patterns below.
- Locked items show as silhouettes with how to earn them ("Practice 7 days in a row").
- Back button returns home.

### Grown-ups page
- One line on each child's overview card: "Pip the Dragon · Kid · 3 of 9 items". Nothing more.

### Kept as is
Stars, streaks and the emoji collectibles are unchanged.

### Calm motion
No flashing. With `prefers-reduced-motion`, the creature is still (no idle bob or blink) and only moves briefly when tapped or celebrating; celebrations become a simple fade.

## How it's built

### Files
- `lib/three.module.min.js` — a pinned copy of Three.js (a specific release, noted in a comment at the top of `creature.js`), served from the site so offline play keeps working.
- `creature.js` — an ES module with only the 3D code:
  - `mountCreature(el, look, opts) -> { update(look), celebrate(kind), dispose() }`
  - `look = { species, stage, color, wear: {head, neck, back}, ground }`; `opts = { interactive, reducedMotion, onPet }`; `kind` is `'grow'` or `'item'`.
  - Builds each species from rounded primitives (spheres, capsules, cones) with per-stage proportions; gear and color patterns are swappable parts and materials. Soft toon-style shading, one light plus ambient, one contact shadow.
- `app.js` — rules and screens, no 3D:
  - `petMastered(p)`, `petProgress(p) -> { stage, mastered, toNext }`
  - `checkPetUnlocks(p) -> [new item ids]` (called after missions, quests, typing and on sync)
  - hatch screen, home card, den screen, finish-screen moment, Grown-ups line
  - loads `creature.js` with `import('./creature.js')` only when a screen shows the creature.
- `sw.js` — adds `creature.js` and `lib/three.module.min.js` to the core files; bumps the cache name.
- `style.css` — styles for the card, den, wardrobe and hatch screen.

### Saved data
Per player, synced with the rest of the profile:

```js
p.pet = {
  species: 'dragon' | 'fox' | 'axolotl' | 'bunnycat',
  name: 'Pip',
  color: 0,                       // index into the species' color patterns
  wear: { head: null, neck: null, back: null },
  items: ['scarf', 'glasses'],    // earned, never removed
  seenStage: 2,                   // highest stage already celebrated
  seenItems: ['scarf'],           // items already celebrated
  updated: 1763400000000,         // ms, last change to species/name/color/wear
}
```

- The stage is never stored; it is always computed from mastery.
- Merge (in `mergePlayer`): `items` and `seenItems` are unions, `seenStage` is the max, and `species`, `name`, `color`, `wear` come from the side with the newer `updated`. A side without `pet` takes the other side's.

### Performance (iPad Safari)
- At most one 3D view exists at a time; it is disposed (renderer, geometries, materials) when leaving the screen.
- Pixel ratio capped at 2; the home card renders at its small size.
- The animation loop stops when the page is hidden or the canvas is off screen, and resumes on return.

### Fallback
If WebGL is unavailable or the import fails, the card and den show the species emoji (🐉 🦊 🦎 🐰) with the same name, stage, progress and wardrobe list. Nothing else depends on 3D.

## Testing
- Rules, in the preview with seeded test players: stage at each threshold boundary (9/10, 74/75, 199/200, 399/400), streak items kept after the streak ends, subject items at 80% mission mastery, typing item, merge of two devices' `pet` objects, celebration shown once per stage and item.
- Visuals, in the preview: each species at each stage, every item worn, color patterns, all four grounds, at desktop and phone widths, with reduced motion on, and the emoji fallback (WebGL disabled).
- No console errors; test data removed afterwards.
- On a real iPad after deploy (by the parent): the card and den run smoothly, nothing heats up, offline still works.

## Out of scope
- Family reward goals (trip, small prizes) — next design.
- Game-style missions where answers drive the action — later design.
- Turning collectibles into den items.
