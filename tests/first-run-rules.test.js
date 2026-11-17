// Run: node --test 'tests/*.test.js'
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../first-run-rules.js');

test('firstScreen', () => {
  assert.equal(F.firstScreen({ locked: false, players: 0 }), 'welcome');
  assert.equal(F.firstScreen({ locked: true, players: 0 }), 'add-kids');
  assert.equal(F.firstScreen({ locked: false, players: 2 }), 'profiles');
  assert.equal(F.firstScreen({ locked: true, players: 1 }), 'profiles');
});

test('setupSteps per path, home screen only when needed', () => {
  assert.deepEqual(F.setupSteps('account', true), ['family', 'recovery', 'kids', 'homescreen']);
  assert.deepEqual(F.setupSteps('account', false), ['family', 'recovery', 'kids']);
  assert.deepEqual(F.setupSteps('local', true), ['homescreen', 'pin', 'kids']);
  assert.deepEqual(F.setupSteps('local', false), ['pin', 'kids']);
  assert.deepEqual(F.setupSteps('signin', true), ['kids', 'homescreen']);
  assert.deepEqual(F.setupSteps('signin', false), ['kids']);
});

test('stepOf', () => {
  assert.deepEqual(F.stepOf('kids', 'account', true), { step: 3, total: 4 });
  assert.deepEqual(F.stepOf('homescreen', 'local', true), { step: 1, total: 3 });
  assert.deepEqual(F.stepOf('pin', 'local', true), { step: 2, total: 3 });
  assert.deepEqual(F.stepOf('kids', 'local', true), { step: 3, total: 3 });
  assert.deepEqual(F.stepOf('pin', 'local', false), { step: 1, total: 2 });
  assert.deepEqual(F.stepOf('homescreen', 'account', true), { step: 4, total: 4 });
  assert.deepEqual(F.stepOf('homescreen', 'local', false), {});
  assert.deepEqual(F.stepOf('family', 'signin', false), {});
  assert.deepEqual(F.stepOf('kids', 'signin', false), {});   // a single step shows no "Step 1 of 1"
});

test('needsKidWelcome', () => {
  assert.equal(F.needsKidWelcome({ pickLook: true, introSeen: true, stats: { a: 1 } }), true);
  assert.equal(F.needsKidWelcome({ stats: {}, missions: {}, log: [] }), true);
  assert.equal(F.needsKidWelcome({}), true);
  assert.equal(F.needsKidWelcome({ introSeen: true, stats: {} }), false);
  assert.equal(F.needsKidWelcome({ stats: { 'q:a': { r: 1, w: 0, box: 1 } } }), false);
  assert.equal(F.needsKidWelcome({ log: [{ t: 1 }] }), false);
  assert.equal(F.needsKidWelcome({ missions: { addsub: { plays: 1 } } }), false);
  assert.equal(F.needsKidWelcome({ lastDay: '2026-11-10' }), false);
  assert.equal(F.needsKidWelcome({ points: 5 }), false);
  assert.equal(F.needsKidWelcome({ points: 0 }), true);
  assert.equal(F.needsKidWelcome({ typing: { home: [{ wpm: 10 }] } }), false);
  assert.equal(F.needsKidWelcome({ typing: {} }), true);
  assert.equal(F.needsKidWelcome({ journal: [{ text: 'hi' }] }), false);
  assert.equal(F.needsKidWelcome({ questLog: ['2026-11-10'] }), false);
  assert.equal(F.needsKidWelcome({ pet: { species: 'dog' } }), false);
  assert.equal(F.needsKidWelcome({ pickLook: true, lastDay: '2026-11-10' }), true);
});

test('joinNames', () => {
  assert.equal(F.joinNames([]), '');
  assert.equal(F.joinNames(['Mia']), 'Mia');
  assert.equal(F.joinNames(['Mia', 'Ava']), 'Mia and Ava');
  assert.equal(F.joinNames(['Mia', 'Ava', 'Leo']), 'Mia, Ava and Leo');
});
