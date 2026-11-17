/* Quest Academy first-run decisions (no DOM). Loaded as a plain script (window.FirstRun) and by Node for tests.
   Spec: docs/superpowers/specs/2026-11-17-first-run-design.md */
(function (root) {
  'use strict';

  // Which screen a device without a current player starts on.
  function firstScreen({ locked, players }) {
    if (players > 0) return 'profiles';
    return locked ? 'add-kids' : 'welcome';
  }

  const PATHS = { invite: ['family', 'recovery', 'kids'], local: ['pin', 'kids'], signin: ['kids'] };
  function setupSteps(path, needsHomeScreen) {
    return [...(PATHS[path] || PATHS.signin), ...(needsHomeScreen ? ['homescreen'] : [])];
  }
  function stepOf(id, path, needsHomeScreen) {
    const steps = setupSteps(path, needsHomeScreen), i = steps.indexOf(id);
    return i < 0 || steps.length < 2 ? {} : { step: i + 1, total: steps.length };
  }

  const isEmpty = o => !o || (Array.isArray(o) ? o.length === 0 : Object.keys(o).length === 0);
  function needsKidWelcome(p) {
    if (p.pickLook) return true;
    if (p.introSeen) return false;
    return isEmpty(p.stats) && isEmpty(p.log) && isEmpty(p.missions);
  }

  function joinNames(names) {
    if (names.length <= 1) return names[0] || '';
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  const api = { firstScreen, setupSteps, stepOf, needsKidWelcome, joinNames };
  root.FirstRun = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
