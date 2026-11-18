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
  assert.match(b, /--from:[\d.]+%/);
  assert.doesNotMatch(a, /--from/);
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

test('the gold sparkle keeps its position: sc-spark has no transform attribute of its own', () => {
  const h = S.sceneHtml({ type: 'collect', world: 'ocean', token: '', moves: ['plain', 'gold'], fresh: true });
  assert.equal(count(h, 'sc-spark'), 1);
  assert.doesNotMatch(h, /class="sc-spark"[^>]*transform=/);
  assert.doesNotMatch(h, /transform=[^>]*class="sc-spark"/);
});
