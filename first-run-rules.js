/* Quest Academy first-run decisions (no DOM). Loaded as a plain script (window.FirstRun) and by Node for tests.
   Spec: docs/superpowers/specs/2026-11-17-first-run-design.md */
(function (root) {
  'use strict';

  // Which screen a device without a current player starts on.
  function firstScreen({ locked, players }) {
    if (players > 0) return 'profiles';
    return locked ? 'add-kids' : 'welcome';
  }

  // A Home Screen app on iPadOS gets its own storage, separate from Safari: on the local-only path the
  // Home Screen step comes first (everything is set up inside the app). Other paths keep it last (the
  // family account carries the kids over). 'account' creates a new family account, with or without an invite.
  const PATHS = { account: ['family', 'recovery', 'kids'], local: ['pin', 'kids'], signin: ['kids'] };
  function setupSteps(path, needsHomeScreen) {
    if (path === 'local') return needsHomeScreen ? ['homescreen', ...PATHS.local] : PATHS.local.slice();
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
    if (p.lastDay || p.points > 0 || p.pet) return false;
    return isEmpty(p.stats) && isEmpty(p.log) && isEmpty(p.missions) && isEmpty(p.typing) && isEmpty(p.journal) && isEmpty(p.questLog);
  }

  function joinNames(names) {
    if (names.length <= 1) return names[0] || '';
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  const api = { firstScreen, setupSteps, stepOf, needsKidWelcome, joinNames };
  root.FirstRun = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
