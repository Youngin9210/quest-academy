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
