/* Quest Academy subject switches (no DOM). Loaded as a plain script (window.SubjectRules) and by Node for tests.
   A grown-up can turn a subject off for one child (p.subjects[sid] = false); progress is kept. */
(function (root) {
  'use strict';

  // Subjects that are off unless a grown-up turns them on, by the player's level for that subject.
  const DEFAULT_OFF = { social: level => level <= 2 };   // 2nd graders don't study social studies yet

  // On or off when no grown-up has chosen, for a player at this level in that subject.
  function defaultOn(sid, level) {
    return sid === 'math' || !(DEFAULT_OFF[sid] && DEFAULT_OFF[sid](level));
  }

  // Is this subject on for this player? level = the player's level for that subject. Math is always on.
  function subjectOn(p, sid, level) {
    if (sid === 'math') return true;
    const set = p && p.subjects;
    if (set && typeof set[sid] === 'boolean') return set[sid];
    return defaultOn(sid, level);
  }

  // A switch is stored only when it differs from the default, so a choice that matches the default keeps
  // following it (a 2nd grader switched to "on" for Social Studies still gets it by default in 3rd grade).
  // Returns the new p.subjects object.
  function setSwitch(subjects, sid, on, level) {
    const out = { ...(subjects || {}) };
    if (on === defaultOn(sid, level)) delete out[sid]; else out[sid] = on;
    return out;
  }

  // The Daily Quest's subject rotation with off subjects taken out (math if nothing is left).
  function questRotation(rotation, visible) {
    const out = rotation.filter(s => visible.includes(s));
    return out.length ? out : ['math'];
  }

  const api = { defaultOn, subjectOn, setSwitch, questRotation };
  root.SubjectRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
