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

  // Mastery is each question's current box, so a miss can lower the count. The creature never shrinks:
  // it shows the highest stage she has already seen.
  const displayStage = (mastered, seenStage) => Math.max(stageFor(mastered), seenStage || 0);

  // Counts toward the stage after the one shown (never negative).
  function progress(mastered, seenStage) {
    const stage = displayStage(mastered, seenStage), next = STAGES[stage + 1];
    return { stage, mastered, toNext: next ? Math.max(0, next.min - mastered) : null };
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
  // A hatched creature of a species this version knows. An egg, a grown-up reset (species null) or a
  // species from a newer version (arriving by sync) counts as no creature yet.
  const hasPet = pet => !!(pet && Object.prototype.hasOwnProperty.call(SPECIES, pet.species));

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
    if (!hasPet(pet)) return null;
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

  const api = { STAGES, stageFor, displayStage, progress, SPECIES, SPECIES_ORDER, hasPet, ITEMS, ITEM_BY_ID, colorsUnlocked,
    earnedItems, newItems, pendingMoment, newPet, mergePet, cleanName };
  root.PetRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
