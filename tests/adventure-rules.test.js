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
  // math-2 no longer fits her level: the real picker would not offer it either
  const pickNo2 = (subject, taken) => pick(subject, [...taken, 'math-2']);
  const changed = AR.repickStops(adv, ['math'], pickNo2, s => s.missionId !== 'math-2');
  assert.equal(changed, true);
  assert.equal(adv.stops[1].subject, 'social'); assert.equal(adv.stops[1].stars, 2);   // played: kept
  assert.ok(adv.stops.slice(2).every(s => s.subject === 'math' && s.missionId !== 'math-2'));
  assert.equal(adv.stops[4].missionId, 'math-3');                                   // still valid: kept
  assert.equal(AR.repickStops(adv, ['math'], pickNo2, () => true), false);
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
