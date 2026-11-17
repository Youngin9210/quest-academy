// Run: node --test 'tests/*.test.js'
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../subject-rules.js');

test('social studies is off by default at level 2, on from level 3', () => {
  assert.equal(S.subjectOn({}, 'social', 2), false);
  assert.equal(S.subjectOn({}, 'social', 3), true);
  assert.equal(S.subjectOn({}, 'social', 5), true);
  assert.equal(S.subjectOn({ subjects: {} }, 'social', 2), false);
});

test('other subjects are on by default at every level', () => {
  for (const sid of ['reading', 'writing', 'science', 'typing']) for (const lvl of [2, 3, 4, 5]) assert.equal(S.subjectOn({}, sid, lvl), true, `${sid} ${lvl}`);
});

test('an explicit switch overrides the default', () => {
  assert.equal(S.subjectOn({ subjects: { social: true } }, 'social', 2), true);
  assert.equal(S.subjectOn({ subjects: { social: false } }, 'social', 4), false);
  assert.equal(S.subjectOn({ subjects: { reading: false } }, 'reading', 3), false);
  assert.equal(S.subjectOn({ subjects: { reading: false } }, 'writing', 3), true);
  assert.equal(S.subjectOn({ subjects: { typing: false } }, 'typing', 3), false);
});

test('a non-boolean value falls back to the default', () => {
  assert.equal(S.subjectOn({ subjects: { social: null } }, 'social', 2), false);
  assert.equal(S.subjectOn({ subjects: { social: 'yes' } }, 'social', 3), true);
});

test('math is always on', () => {
  assert.equal(S.subjectOn({}, 'math', 2), true);
  assert.equal(S.subjectOn({ subjects: { math: false } }, 'math', 2), true);
});

test('quest rotation drops off subjects, falls back to math', () => {
  const rot = ['math', 'reading', 'math', 'social', 'science'];
  assert.deepEqual(S.questRotation(rot, ['math', 'reading', 'science']), ['math', 'reading', 'math', 'science']);
  assert.deepEqual(S.questRotation(rot, rot), rot);
  assert.deepEqual(S.questRotation(['social'], ['math']), ['math']);
});
