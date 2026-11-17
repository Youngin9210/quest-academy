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
