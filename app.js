(() => {
'use strict';

/* =========================================================
   Math Quest — all progress is saved only in this browser.
   ========================================================= */

const STORE_KEY = 'mathquest.v1';
const MISSION_LEN = 10;
const $app = document.getElementById('app');

const MISSIONS = [
  { id: 'addsub',   grade: 2, desc: 'Add & subtract up to 20' },
  { id: 'place',    grade: 2, desc: 'Hundreds, tens & ones' },
  { id: 'twodigit', grade: 2, desc: 'Add & subtract up to 100' },
  { id: 'muldiv',   grade: 3, desc: 'Times & divide facts' },
  { id: 'story',    grade: 2, desc: 'Word problems' },
  { id: 'choice',   grade: 2, desc: 'Tap the right answer' },
];

/* ---------- storage ---------- */
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.profiles)) return s;
  } catch (e) { /* storage blocked or corrupt */ }
  return { profiles: [], current: null, sound: true };
}
let state = load();
function writeStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
function save() {
  if (typeof markChanged === 'function') { markChanged(); scheduleSync(); }
  writeStore();
}
const me = () => state.profiles.find(p => p.id === state.current);
const theme = (p = me()) => THEMES[(p && p.theme) || 'space'] || THEMES.space;

function newProfile(name, avatar, grade, themeId) {
  return {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, avatar, grade, theme: themeId,
    points: 0, streak: 0, lastDay: null,
    found: {},        // themeId -> number of collectibles found
    stats: {},        // questionKey -> {r, w, box}
    missions: {},     // missionId -> {plays, history:[scores]}
  };
}

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const today = () => new Date().toLocaleDateString('en-CA');
function dayDiff(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function applyTheme(id) {
  document.body.dataset.theme = id;
  const sky = document.getElementById('sky');
  const items = (THEMES[id] || THEMES.space).bgItems;
  let html = '';
  for (let i = 0; i < 45; i++) {
    const size = rand(8, 22);
    html += `<span style="left:${rand(0, 100)}%;top:${rand(0, 100)}%;font-size:${size}px;--d:${rand(3, 12)}s;--delay:-${rand(0, 12)}s">${pick(items)}</span>`;
  }
  sky.innerHTML = html;
  const cs = getComputedStyle(document.body);
  document.querySelector('meta[name=theme-color]').setAttribute('content', cs.getPropertyValue('--bg1').trim() || '#0b1033');
  // fill the area behind the iPad home bar / overscroll with the theme color
  document.documentElement.style.background = cs.getPropertyValue('--bg2').trim() || '#0b1033';
}

/* ---------- sound ---------- */
let audio;
function beep(notes) {
  if (!state.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    let t = audio.currentTime;
    notes.forEach(([f, d]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + d);
      t += d * .8;
    });
  } catch (e) { /* no audio */ }
}
const sfx = {
  good: () => beep([[660, .12], [880, .18]]),
  bad: () => beep([[300, .2]]),
  win: () => beep([[523, .15], [659, .15], [784, .15], [1047, .35]]),
};

function confetti(icon) {
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('div');
    s.className = 'confetti';
    s.textContent = i % 3 ? icon : '✨';
    s.style.left = rand(0, 100) + 'vw';
    s.style.animationDuration = (rand(18, 35) / 10) + 's';
    s.style.animationDelay = (rand(0, 8) / 10) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 5000);
  }
}

/* =========================================================
   Questions
   ========================================================= */

// Fact pools: every fact has a key so we can track which ones are tricky.
const POOLS = {
  addsub: (() => {
    const k = [];
    for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) k.push(`${a}+${b}`);
    for (let c = 0; c <= 20; c++) for (let b = 0; b <= 10; b++) if (b <= c && c - b <= 10) k.push(`${c}-${b}`);
    return k;
  })(),
  muldiv: (() => {
    const k = [];
    for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) { k.push(`${a}×${b}`); k.push(`${a * b}÷${a}`); }
    return k;
  })(),
};

function factQuestion(key) {
  const m = key.match(/^(\d+)([+\-×÷])(\d+)$/);
  const a = +m[1], op = m[2], b = +m[3];
  const answer = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
  const sym = op === '-' ? '−' : op;
  return {
    key, answer,
    prompt: `${a} ${sym} ${b} = <span class="answer-box" id="ans"></span>`,
    hint: reveal => factHint(a, op, b, reveal ? answer : '?'),
  };
}

function dots(n, cls = '') { return Array.from({ length: n }, () => `<span class="dot ${cls}"></span>`).join(''); }

function factHint(a, op, b, ans) {
  if (op === '+') {
    return `<div class="dot-groups"><div class="dots">${dots(a)}</div>+<div class="dots">${dots(b, 'b')}</div></div>
      <p class="explain">Count them all: <b>${a} + ${b} = ${ans}</b>${a + b > 10 && a < 10 ? `<br><span class="muted">Trick: make a 10 first! ${a} + ${10 - a} = 10, then + ${b - (10 - a)} more.</span>` : ''}</p>`;
  }
  if (op === '-') {
    return `<div class="dots">${dots(a - b)}${dots(b, 'x')}</div>
      <p class="explain">Start with ${a}, take away ${b}: <b>${a} − ${b} = ${ans}</b><br><span class="muted">Think addition: ${b} + ? = ${a}</span></p>`;
  }
  if (op === '×') {
    return `<div class="array" style="grid-template-columns:repeat(${b},20px)">${dots(a * b)}</div>
      <p class="explain">${a} rows of ${b}: <b>${a} × ${b} = ${ans}</b><br><span class="muted">Skip count by ${b}: ${Array.from({ length: a }, (_, i) => (i + 1) * b).slice(0, ans === '?' ? -1 : undefined).join(', ')}${ans === '?' ? ', …' : ''}</span></p>`;
  }
  return `<div class="array" style="grid-template-columns:repeat(${a / b},20px)">${dots(a)}</div>
    <p class="explain">Share ${a} into ${b} equal rows: <b>${a} ÷ ${b} = ${ans}</b><br><span class="muted">Think: ${b} × ? = ${a}</span></p>`;
}

function blocksHtml(n) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
  return `<div class="blocks">
    ${h ? `<div class="grp">${'<span class="flat"></span>'.repeat(h)}</div>` : ''}
    ${t ? `<div class="grp">${'<span class="rod"></span>'.repeat(t)}</div>` : ''}
    ${o ? `<div class="grp" style="max-width:60px">${'<span class="cube"></span>'.repeat(o)}</div>` : ''}
  </div>`;
}
function pvChart(n, hl) {
  const s = String(n).padStart(3, '0');
  const names = ['hundreds', 'tens', 'ones'];
  return `<div class="pv-chart">${names.map(x => `<div class="h">${x}</div>`).join('')}
    ${[...s].map((d, i) => `<div class="v ${names[i] === hl ? 'hl' : ''}">${d}</div>`).join('')}</div>`;
}

const GENERATORS = {
  place() {
    const type = pick(['blocks', 'digit', 'expanded', 'more']);
    const n = rand(101, 989);
    const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
    if (type === 'blocks') {
      return { key: 'pv-blocks', answer: n, wordy: true,
        prompt: `What number do these blocks show?<div style="margin:14px 0">${blocksHtml(n)}</div><span class="answer-box" id="ans"></span>`,
        hint: r => `${pvChart(n)}<p class="explain">${h} hundreds + ${t} tens + ${o} ones = <b>${r ? n : '?'}</b><br><span class="muted">Big squares = 100, sticks = 10, little cubes = 1</span></p>` };
    }
    if (type === 'digit') {
      const place = pick(['hundreds', 'tens', 'ones']);
      const ans = place === 'hundreds' ? h : place === 'tens' ? t : o;
      return { key: 'pv-digit', answer: ans, wordy: true,
        prompt: `In <b>${n}</b>, which digit is in the <b>${place}</b> place?<br><span class="answer-box" id="ans"></span>`,
        hint: r => `${pvChart(n, place)}<p class="explain">Look at the highlighted box!${r ? ` The ${place} digit is <b>${ans}</b>` : ''}</p>` };
    }
    if (type === 'expanded') {
      return { key: 'pv-expanded', answer: n, wordy: true,
        prompt: `${h * 100} + ${t * 10} + ${o} = <span class="answer-box" id="ans"></span>`,
        hint: r => `${blocksHtml(n)}<p class="explain">${h} hundreds, ${t} tens, ${o} ones makes <b>${r ? n : '?'}</b></p>` };
    }
    const step = pick([10, 100]), dir = pick([1, -1]);
    const base = step === 100 ? rand(150, 850) : rand(110, 880);
    const ans = base + step * dir;
    return { key: `pv-${step}${dir > 0 ? 'more' : 'less'}`, answer: ans, wordy: true,
      prompt: `What is <b>${step} ${dir > 0 ? 'more' : 'less'}</b> than <b>${base}</b>?<br><span class="answer-box" id="ans"></span>`,
      hint: r => `<p class="explain">Only the <b>${step === 10 ? 'tens' : 'hundreds'}</b> digit changes!<br>${base} → <b>${r ? ans : '?'}</b></p>` };
  },
  twodigit() {
    const add = Math.random() < .5;
    let a, b;
    if (add) { a = rand(11, 79); b = rand(10, Math.min(89, 100 - a)); }
    else { a = rand(25, 99); b = rand(10, a - 5); }
    const ans = add ? a + b : a - b;
    const regroup = add ? (a % 10) + (b % 10) >= 10 : (a % 10) < (b % 10);
    const sym = add ? '+' : '−';
    return {
      key: `${add ? 'add' : 'sub'}2${regroup ? '-regroup' : ''}`, answer: ans,
      prompt: `<span class="vertical"><span>${a}</span><span>${sym} ${b}</span><span class="line"></span><span class="answer-box" id="ans"></span></span>`,
      hint: r => {
        const R = v => r ? v : '?';
        const at = a - a % 10, bt = b - b % 10, ao = a % 10, bo = b % 10;
        if (add) return `<p class="explain">Tens: ${at} + ${bt} = ${at + bt}<br>Ones: ${ao} + ${bo} = ${ao + bo}<br>Together: ${at + bt} + ${ao + bo} = <b>${R(ans)}</b></p>`;
        return `<p class="explain">Start at ${a}. Take away ${bt} → ${a - bt}<br>Then take away ${bo} → <b>${R(ans)}</b>${regroup ? `<br><span class="muted">${ao} is smaller than ${bo}, so borrow a ten!</span>` : ''}</p>`;
      },
    };
  },
};

/* ---------- Word problems ---------- */

// Which story types each mission mixes in. The Story mission uses all of them for the player's grade.
const STORY_TYPES = {
  addsub:   ['join', 'separate', 'compare', 'missing'],
  twodigit: ['join', 'separate', 'compare', 'money'],
  place:    ['pvbundle'],
  muldiv:   ['groups', 'share', 'buy'],
};
function storyTypesFor(missionId, p) {
  if (missionId !== 'story') return STORY_TYPES[missionId];
  return p.grade >= 3
    ? ['join', 'separate', 'compare', 'money', 'groups', 'share', 'buy', 'twostep', 'twostep']
    : ['join', 'separate', 'compare', 'missing', 'money', 'pvbundle'];
}
function weightedPick(p, items, keyOf) {
  const w = items.map(t => { const s = p.stats[keyOf(t)]; return s ? 8 / (s.box + 1) + (s.w > s.r ? 4 : 0) : 4; });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
// Is this small enough for the dot/array pictures?
function pictureable(a, op, b) {
  if (op === '+') return a <= 10 && b <= 10;
  if (op === '-') return a <= 20 && b <= 10 && a - b <= 10;
  if (op === '×') return a <= 10 && b <= 10;
  return a <= 100 && b <= 10 && a / b <= 10;
}
function mathHint(a, op, b, ans, r) {
  if (pictureable(a, op, b)) return factHint(a, op, b, r ? ans : '?');
  const sym = op === '-' ? '−' : op;
  return `<p class="explain" style="font-size:1.6rem"><b>${a} ${sym} ${b} = ${r ? ans : '?'}</b></p>`;
}

function makeStory(type, p, big) {
  const S = theme(p).story, N = esc(p.name), B = S.buddy;
  const it = S.item, gr = S.group, buy = S.buy;
  const pl = (n, w) => `${n} ${n === 1 ? w[0] : w[1]}`;
  // a, op, b describe the number sentence; clue explains how to spot it
  let text, a, op, b, clue, money = false, hint;
  switch (type) {
    case 'join':
      if (big) { a = rand(12, 60); b = rand(10, 99 - a); } else { a = rand(2, 10); b = rand(2, 10); }
      op = '+';
      text = `${N} has ${pl(a, it)}. ${B} gives ${N} ${b} more. How many ${it[1]} does ${N} have now?`;
      clue = '“How many now” after getting more means <b>add</b>.';
      break;
    case 'separate':
      if (big) { a = rand(30, 99); b = rand(10, a - 5); } else { a = rand(8, 18); b = rand(Math.max(2, a - 10), Math.min(10, a - 1)); }
      op = '-';
      text = `${N} had ${pl(a, it)}. ${N} gave ${b} to ${B}. How many ${it[1]} does ${N} have left?`;
      clue = 'Giving some away means <b>subtract</b>.';
      break;
    case 'compare':
      if (big) { a = rand(40, 99); b = rand(10, a - 5); } else { a = rand(8, 18); b = rand(Math.max(2, a - 10), a - 1); }
      op = '-';
      text = `${N} collected ${pl(a, it)}. ${B} collected ${pl(b, it)}. How many more ${it[1]} did ${N} collect than ${B}?`;
      clue = '“How many more” means find the difference: <b>subtract</b>.';
      break;
    case 'missing': {
      const start = rand(3, 10), more = rand(2, 10), c = start + more;
      a = c; op = '-'; b = start;
      text = `${N} has ${pl(start, it)}. ${N} finds some more and now has ${c}. How many ${it[1]} did ${N} find?`;
      clue = `Think: ${start} + ? = ${c}. You can <b>subtract</b> to find the missing part.`;
      break;
    }
    case 'money':
      money = true;
      if (Math.random() < .5) {
        if (big) { a = rand(12, 50); b = rand(10, 49); } else { a = rand(3, 10); b = rand(2, 10); }
        op = '+';
        text = `At ${S.shop}, ${N} buys a ${buy[0]} for $${a} and a ${S.buy2} for $${b}. How much money does ${N} spend in all?`;
        clue = 'Spending money on two things: <b>add</b> the prices.';
      } else {
        if (big) { a = pick([50, 60, 75, 80, 100]); b = rand(12, a - 8); } else { a = pick([10, 15, 20]); b = rand(Math.max(2, a - 10), Math.min(10, a - 1)); }
        op = '-';
        text = `${N} has $${a} at ${S.shop}. ${N} buys a ${buy[0]} for $${b}. How much money does ${N} have left?`;
        clue = 'Paying for something means your money goes down: <b>subtract</b>.';
      }
      break;
    case 'pvbundle': {
      const h = rand(1, 9), t = rand(0, 9), o = rand(1, 9), n = h * 100 + t * 10 + o;
      text = `There ${h === 1 ? 'is' : 'are'} ${h} big ${h === 1 ? 'box' : 'boxes'} with 100 ${it[1]} each, ${t} ${t === 1 ? 'bag' : 'bags'} with 10 ${it[1]} each, and ${o} loose ${o === 1 ? it[0] : it[1]}. How many ${it[1]} are there in all?`;
      clue = 'Boxes of 100 are <b>hundreds</b>, bags of 10 are <b>tens</b>, loose ones are <b>ones</b>.';
      return storyQ('wp-pvbundle', text, n, false, r => `<p class="explain">${clue}</p>${pvChart(n)}<p class="explain">${h} hundreds + ${t} tens + ${o} ones = <b>${r ? n : '?'}</b></p>`);
    }
    case 'groups':
      a = rand(2, 10); b = rand(2, 10); op = '×';
      text = `${N} has ${pl(a, gr)}. Each ${gr[0]} has ${pl(b, it)}. How many ${it[1]} are there in all?`;
      clue = 'Equal groups means <b>multiply</b>: groups × how many in each.';
      break;
    case 'share': {
      const groups = rand(2, 10), each = rand(2, 10);
      a = groups * each; op = '÷'; b = groups;
      text = `${N} has ${a} ${it[1]} and puts them into ${groups} ${gr[1]}, with the same number in each ${gr[0]}. How many ${it[1]} go in each ${gr[0]}?`;
      clue = 'Sharing equally means <b>divide</b>.';
      break;
    }
    case 'buy': {
      const price = rand(2, 10), qty = rand(2, 10);
      a = price * qty; op = '÷'; b = price;
      text = `${N} goes to ${S.shop} with $${a}. Each ${buy[0]} costs $${price}. How many ${buy[1]} can ${N} buy?`;
      clue = `How many groups of $${price} fit into $${a}? That's <b>divide</b>.`;
      break;
    }
    case 'twostep': {
      if (Math.random() < .5) {
        const qty = rand(2, 5), price = rand(2, 9), cost = qty * price;
        const have = Math.ceil((cost + rand(3, 15)) / 5) * 5, ans = have - cost;
        text = `${N} has $${have}. ${N} buys ${qty} ${buy[1]} that cost $${price} each. How much money does ${N} have left?`;
        return storyQ('wp-twostep', text, ans, true, r => `<p class="explain">Two steps!<br>Step 1: ${qty} × $${price} = <b>${r ? '$' + cost : '?'}</b> spent<br>Step 2: $${have} − what you spent = <b>${r ? '$' + ans : '?'}</b></p>`);
      }
      const g = rand(2, 6), each = rand(2, 9), extra = rand(2, 9), sub = g * each, ans = sub + extra;
      text = `${N} has ${pl(g, gr)} with ${pl(each, it)} in each, plus ${extra} extra ${it[1]}. How many ${it[1]} does ${N} have in all?`;
      return storyQ('wp-twostep', text, ans, false, r => `<p class="explain">Two steps!<br>Step 1: ${g} × ${each} = <b>${r ? sub : '?'}</b><br>Step 2: add the ${extra} extra = <b>${r ? ans : '?'}</b></p>`);
    }
  }
  const ans = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
  return storyQ('wp-' + type, text, ans, money, r => `<p class="explain">🔎 ${clue}</p>${mathHint(a, op, b, ans, r)}`);
}

function storyQ(key, text, answer, money, hint) {
  return {
    key, answer, wordy: true, story: true, hint,
    prompt: `<div class="story">
      <button class="say" type="button" data-say aria-label="Read it to me">🔊</button>
      <p class="story-text">${text}</p></div>
      ${money ? '$' : ''}<span class="answer-box" id="ans"></span>`,
  };
}

// Use the most natural English voice the device has (Premium/Enhanced voices if downloaded).
let bestVoice = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang));
    const score = v => (/premium/i.test(v.name) ? 40 : 0) + (/enhanced/i.test(v.name) ? 30 : 0)
      + (/^en[-_]US/i.test(v.lang) ? 10 : 0) + (/samantha|ava|zoe|allison|susan/i.test(v.name) ? 5 : 0)
      + (/compact|eloquence|novelty|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|bahh|fred|junior|ralph|grandma|grandpa|rocko|shelley|eddy|flo|reed|sandy/i.test(v.name) ? -50 : 0);
    bestVoice = vs.sort((a, b) => score(b) - score(a))[0] || null;
  } catch (e) { /* no speech */ }
}
try { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) {}

function speak(text, rate = .9, then) {
  stopAudio();
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\$(\d+)/g, '$1 dollars'));
    if (bestVoice) u.voice = bestVoice;
    u.rate = rate;
    if (then) u.onend = then;
    speechSynthesis.speak(u);
  } catch (e) { /* no speech on this device */ }
}

// Recorded audio (spelling words). One shared element so iPads allow replays.
const player = new Audio();
let playQueue = [];
function stopAudio() { playQueue = []; try { player.pause(); } catch (e) {} }
function playClips(clips, rate = 1, then) {
  try { speechSynthesis.cancel(); } catch (e) {}
  stopAudio();
  playQueue = clips.slice();
  const next = () => {
    const src = playQueue.shift(); if (!src) { if (then) then(); return; }
    player.src = src;
    player.playbackRate = rate; player.preservesPitch = true; player.webkitPreservesPitch = true;
    player.play().catch(() => {});
  };
  player.onended = () => setTimeout(next, 450);
  next();
}

/* ---------- Multiple choice ("Pick It!") ---------- */

// Wrong choices are common mistakes. When one is picked, we explain that
// exact mistake and count it for the grown-ups page.
const MISTAKES = {
  'carry':        ['Forgot to carry', 'Looks like you forgot to carry the 10! When the ones make 10 or more, move a ten over to the tens.'],
  'column-glue':  ['Wrote both column sums', 'Careful! When the ones make 10 or more, carry the ten instead of writing the whole number down.'],
  'borrow-flip':  ['Subtracted small from big', 'Oops, you took the small ones digit from the big one. When the top ones digit is smaller, borrow a ten first!'],
  'borrow-tens':  ['Forgot to borrow from tens', 'You borrowed a ten, so remember to take 1 away from the tens!'],
  'wrong-op':     ['Picked the wrong operation', 'Read it again: are we putting together, taking away, making equal groups, or sharing?'],
  'wrong-sign':   ['Added instead of subtracted (or the other way)', 'Check the sign! Are we adding or subtracting?'],
  'sign-pick':    ['Picked the wrong sign', 'Try each sign and check: which one really makes that number?'],
  'compare-flip': ['Mixed up < and >', 'The open mouth always eats the bigger number!'],
  'round-way':    ['Rounded the wrong way', 'Which one is closer? 5 or more rounds up, 4 or less rounds down.'],
  'round-place':  ['Rounded to the wrong place', 'Check which place we’re rounding to: the nearest 10 or the nearest 100?'],
};
const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = rand(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const round10 = n => Math.round(n / 10) * 10, round100 = n => Math.round(n / 100) * 100;

function mcQ(key, promptHtml, choices, hint, story) {
  // choices: [{label, correct, tag}] — duplicates by label are removed
  const seen = new Set();
  const list = shuffle(choices.filter(c => !seen.has(String(c.label)) && seen.add(String(c.label))));
  return {
    key, choices: list, hint, wordy: true, story: !!story,
    answer: list.find(c => c.correct).label,
    prompt: story
      ? `<div class="story"><button class="say" type="button" data-say aria-label="Read it to me">🔊</button><p class="story-text">${promptHtml}</p></div>`
      : promptHtml,
  };
}

const CHOICE_TYPES = {
  matchop(p) {
    const S = theme(p).story, N = esc(p.name), B = S.buddy, it = S.item, gr = S.group;
    const pl = (n, w) => `${n} ${n === 1 ? w[0] : w[1]}`;
    const ops = p.grade >= 3 ? ['+', '−', '×', '÷'] : ['+', '−'];
    const op = pick(ops);
    let a, b, text;
    if (op === '+') { a = rand(10, 30); b = rand(2, 9); text = `${N} has ${pl(a, it)}. ${B} gives ${N} ${b} more. How many ${it[1]} does ${N} have now?`; }
    if (op === '−') { a = rand(10, 30); b = rand(2, 9); text = `${N} had ${pl(a, it)} and gave ${b} to ${B}. How many ${it[1]} are left?`; }
    if (op === '×') { a = rand(4, 9); b = rand(2, a - 1); text = `${N} has ${pl(a, gr)} with ${pl(b, it)} in each. How many ${it[1]} are there in all?`; }
    if (op === '÷') { b = rand(2, 9); a = b * rand(2, 9); text = `${N} puts ${a} ${it[1]} into ${b} ${gr[1]}, with the same number in each. How many ${it[1]} go in each ${gr[0]}?`; }
    const offered = p.grade >= 3 ? ops : ['+', '−', '×'];
    return mcQ('mc-matchop', `${text}<br><b>Which number sentence matches the story?</b>`,
      offered.map(o => ({ label: `${a} ${o} ${b}`, correct: o === op, tag: 'wrong-op' })),
      r => `<p class="explain">🔎 Getting more → <b>+</b> · Giving away → <b>−</b>${p.grade >= 3 ? ' · Equal groups → <b>×</b> · Sharing equally → <b>÷</b>' : ''}${r ? `<br>This story matches <b>${a} ${op} ${b}</b>` : ''}</p>`, true);
  },
  compare() {
    const a = rand(102, 987);
    let b;
    const roll = Math.random();
    if (roll < .15) b = a;
    else if (roll < .6) { const s = String(a); b = +(s[0] + s[2] + s[1]); if (b === a) b = a + rand(1, 9); }  // swap tens and ones
    else b = a + pick([-1, 1]) * pick([1, 10, 100]) * rand(1, 3);
    if (b < 100 || b > 999) b = a + 10;
    const right = a < b ? '<' : a > b ? '>' : '=';
    return mcQ('mc-compare', `Which sign goes in the box?<div class="big-math">${a} <span class="slot">?</span> ${b}</div>`,
      ['<', '>', '='].map(s => ({ label: s, correct: s === right, tag: s !== '=' && right !== '=' ? 'compare-flip' : null })),
      r => `<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">${pvChart(a)}${pvChart(b)}</div>
        <p class="explain">Compare the hundreds first, then the tens, then the ones.<br><span class="muted">&lt; means “is less than” · &gt; means “is greater than”</span>${r ? `<br><b>${a} ${right} ${b}</b>` : ''}</p>`);
  },
  round() {
    let n; do { n = rand(101, 989); } while (n % 10 === 0);
    const place = pick([10, 100]);
    const right = Math.round(n / place) * place;
    const lo = Math.floor(n / place) * place, hi = lo + place;
    const other = place === 10 ? round100(n) : round10(n);
    const choices = [
      { label: right, correct: true },
      { label: right === lo ? hi : lo, tag: 'round-way' },
      { label: other, tag: 'round-place' },
      { label: right + (right === lo ? -place : 2 * place), tag: 'round-way' },
    ];
    return mcQ('mc-round', `Round <b>${n}</b> to the nearest <b>${place}</b>.`, choices,
      r => `<p class="explain">${n} is between <b>${lo}</b> and <b>${hi}</b>. Which one is it closer to?<br>
        <span class="muted">Look at the ${place === 10 ? 'ones' : 'tens'} digit: 5 or more rounds up.</span>${r ? `<br>${n} rounds to <b>${right}</b>` : ''}</p>`);
  },
  sign(p) {
    const ops = p.grade >= 3 ? ['+', '−', '×', '÷'] : ['+', '−'];
    let a, b, op, c;
    for (;;) {
      op = pick(ops);
      if (op === '×' || op === '÷') { b = rand(2, 9); const k = rand(2, 9); a = op === '×' ? k : b * k; }
      else { a = rand(p.grade >= 3 ? 10 : 5, p.grade >= 3 ? 60 : 20); b = rand(2, Math.min(15, a - 1)); }
      c = OPS[op](a, b);
      if (ops.filter(o => OPS[o](a, b) === c).length === 1) break;   // only one sign works
    }
    return mcQ('mc-sign', `Which sign makes it true?<div class="big-math">${a} <span class="slot">?</span> ${b} = ${c}</div>`,
      ops.map(o => ({ label: o, correct: o === op, tag: 'sign-pick' })),
      r => `<p class="explain">Is <b>${c}</b> bigger or smaller than ${a}?<br><span class="muted">Bigger → + ${p.grade >= 3 ? 'or ×' : ''} · Smaller → − ${p.grade >= 3 ? 'or ÷' : ''}</span>
        ${r ? `<br>${ops.map(o => `${a} ${o} ${b} = ${OPS[o](a, b) % 1 || OPS[o](a, b) < 0 ? '…' : OPS[o](a, b)}`).join('<br>')}` : ''}</p>`);
  },
  oddeven() {
    const n = rand(11, 999), even = n % 2 === 0;
    return mcQ('mc-oddeven', `Is <b>${n}</b> odd or even?`,
      [{ label: 'Odd', correct: !even }, { label: 'Even', correct: even }],
      r => `<p class="explain">Only the <b>ones digit</b> matters!<br><span class="muted">Ends in 0, 2, 4, 6 or 8 → even · 1, 3, 5, 7 or 9 → odd</span>${r ? `<br>${n} ends in ${n % 10}, so it's <b>${even ? 'even' : 'odd'}</b>` : ''}</p>`);
  },
  estimate(p) {
    const big = p.grade >= 3 && Math.random() < .5;
    const R = big ? round100 : round10, step = big ? 100 : 10;
    let a, b;
    do { a = big ? rand(110, 690) : rand(11, 79); b = big ? rand(110, 290) : rand(11, 69); } while (a % step === 0 || b % step === 0);
    const est = R(a) + R(b);
    const choices = [{ label: est, correct: true }, { label: est + 2 * step }, { label: est - 2 * step > 0 ? est - 2 * step : est + 4 * step }];
    return mcQ('mc-estimate', `About how much is <b>${a} + ${b}</b>?<br><span class="muted">Round each number to the nearest ${step} first.</span>`, choices,
      r => `<p class="explain">${a} is about <b>${R(a)}</b> · ${b} is about <b>${R(b)}</b><br>${R(a)} + ${R(b)} = <b>${r ? est : '?'}</b></p>`);
  },
  regroup(p) {
    const big = p.grade >= 3;
    if (Math.random() < .5) {
      let a, b;
      do { a = rand(big ? 15 : 15, big ? 79 : 69); b = rand(11, 99 - a); } while ((a % 10) + (b % 10) < 10 || b < 11);
      const ans = a + b, tens = Math.floor(a / 10) + Math.floor(b / 10), ones = (a % 10) + (b % 10);
      return mcQ('mc-regroup', `<span class="vertical big-math"><span>${a}</span><span>+ ${b}</span><span class="line"></span><span>?</span></span>`, [
        { label: ans, correct: true }, { label: ans - 10, tag: 'carry' },
        { label: +(`${tens}${ones}`), tag: 'column-glue' }, { label: a - b > 0 ? a - b : ans + 10, tag: a - b > 0 ? 'wrong-sign' : 'carry' },
      ], r => `<p class="explain">Ones: ${a % 10} + ${b % 10} = ${ones}. That's 1 ten and ${ones - 10} ones!<br>Tens: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} + 1 carried = ${r ? tens + 1 : '?'}<br>${r ? `Answer: <b>${ans}</b>` : ''}</p>`);
    }
    let a, b;
    do { a = rand(31, 99); b = rand(12, a - 10); } while ((a % 10) >= (b % 10));
    const ans = a - b, ao = a % 10, bo = b % 10;
    const flip = (Math.floor(a / 10) - Math.floor(b / 10)) * 10 + (bo - ao);
    return mcQ('mc-regroup', `<span class="vertical big-math"><span>${a}</span><span>− ${b}</span><span class="line"></span><span>?</span></span>`, [
      { label: ans, correct: true }, { label: flip, tag: 'borrow-flip' },
      { label: ans + 10, tag: 'borrow-tens' }, { label: a + b, tag: 'wrong-sign' },
    ], r => `<p class="explain">${ao} is smaller than ${bo}, so borrow a ten:<br>${Math.floor(a / 10)} tens ${ao} ones → ${Math.floor(a / 10) - 1} tens ${ao + 10} ones<br>Ones: ${ao + 10} − ${bo} = ${r ? ao + 10 - bo : '?'} · Tens: ${Math.floor(a / 10) - 1} − ${Math.floor(b / 10)} = ${r ? Math.floor(a / 10) - 1 - Math.floor(b / 10) : '?'}${r ? `<br>Answer: <b>${ans}</b>` : ''}</p>`);
  },
};
GENERATORS.choice = p => {
  const types = p.grade >= 3
    ? ['matchop', 'matchop', 'compare', 'round', 'round', 'sign', 'estimate', 'regroup', 'oddeven']
    : ['matchop', 'matchop', 'compare', 'compare', 'sign', 'estimate', 'regroup', 'oddeven'];
  return CHOICE_TYPES[weightedPick(p, types, t => 'mc-' + t)](p);
};

/* =========================================================
   Subjects: Math is built in; the others are question banks
   loaded from subjects/*.js (window.SUBJECTS).
   ========================================================= */
const SUBJECTS = window.SUBJECTS || {};
SUBJECTS.math = { name: 'Math', icon: '🔢', builtIn: true };
SUBJECTS.typing = { name: 'Typing', icon: '⌨️', builtIn: true };
const SUBJECT_ORDER = ['math', 'reading', 'writing', 'science', 'social', 'typing'].filter(id => SUBJECTS[id]);
const BANK = {};   // mission id -> { subject, mission }
const QINDEX = {}; // question id -> { mid, q }
SUBJECT_ORDER.filter(sid => !SUBJECTS[sid].builtIn).forEach(sid => (SUBJECTS[sid].missions || []).forEach(m => {
  BANK[m.id] = { subject: sid, mission: m };
  (m.questions || []).forEach(q => { QINDEX[q.id] = { mid: m.id, q }; });
  (m.passages || []).forEach(ps => ps.questions.forEach(q => { QINDEX[q.id] = { mid: m.id, q }; }));
}));
const forGrade = (item, p) => !item.grades || item.grades.includes(p.grade);
const plainFill = (text, p) => String(text).replace(/\{name\}/g, p.name).replace(/\{buddy\}/g, theme(p).story.buddy);
const fill = (text, p) => esc(plainFill(text, p)).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

function bankItems(m, p) {
  if (m.passages) { const ps = m.passages.filter(x => forGrade(x, p)); return ps.length ? ps : m.passages; }
  const qs = m.questions.filter(q => forGrade(q, p)); return qs.length >= 5 ? qs : m.questions;
}
function bankQuestionIds(m, p) {
  return m.passages ? bankItems(m, p).flatMap(ps => ps.questions.map(q => q.id)) : bankItems(m, p).map(q => q.id);
}
// Mastered = answered right on the first try twice in a row
function bankProgress(p, mid) {
  const ids = bankQuestionIds(BANK[mid].mission, p);
  return ids.reduce((a, id) => a + Math.min(2, (p.stats['q:' + id] || {}).box || 0), 0) / (2 * ids.length);
}

function buildBankQueue(m, p) {
  if (m.passages) {
    const seen = p.passages || (p.passages = {});
    const two = shuffle(bankItems(m, p).slice()).sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0)).slice(0, 2);
    two.forEach(x => { seen[x.id] = (seen[x.id] || 0) + 1; });
    return two.flatMap(x => x.questions.map(q => ({ q, passage: x })));
  }
  const pool = bankItems(m, p).slice(), out = [];
  while (out.length < MISSION_LEN && pool.length) {
    const q = weightedPick(p, pool, x => 'q:' + x.id);
    out.push({ q }); pool.splice(pool.indexOf(q), 1);
  }
  return out;
}

const sayBtn = sel => `<button class="say" type="button" data-say="${sel}" aria-label="Read it to me">🔊</button>`;

function bankQuestion(item, p) {
  const q = item.q, key = 'q:' + q.id;
  const passage = item.passage ? `<div class="passage">
      <div class="passage-head">${sayBtn('.passage-text')}<h3>${item.passage.emoji || '📖'} ${esc(item.passage.title)}</h3></div>
      <div class="passage-text"><p>${fill(item.passage.text, p)}</p></div></div>` : '';
  const pic = q.emoji ? `<div class="q-emoji">${q.emoji}</div>` : '';
  if (q.type === 'spell') {
    const sentence = plainFill(q.sentence, p);
    const blanked = esc(sentence).replace(new RegExp('\\b' + q.word + '\\b', 'i'), '<span class="blank">______</span>');
    return {
      key, spell: q.word, wordy: true, answer: q.word,
      sayText: `${q.word}. ${sentence} ${q.word}.`,
      // a real person's recording of the word, if we have one (see audio/CREDITS.md)
      wordClip: window.SPELL_AUDIO && SPELL_AUDIO[q.word] ? `audio/spell/${q.word}.m4a` : null,
      sentence,
      prompt: `${pic}<p class="muted" style="margin:0 0 10px">Listen, then spell the word. The sentence shows how it's used.</p>
        <div class="row-actions">
          <button class="btn" type="button" data-hear="word">🔊 Hear the word</button>
          <button class="btn ghost" type="button" data-hear="slow">🐢 Say it slowly</button>
        </div>
        <p class="story-text" style="margin:16px 0">${blanked}</p>
        <input class="text spell-input" id="spell" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" aria-label="Type the word">`,
      hint: r => r ? `<p class="explain">The word is <b>${esc(q.word)}</b></p>`
        : `<p class="explain">💡 It starts with <b>${esc(q.word[0])}</b> and has <b>${q.word.length}</b> letters:<br><span class="letters">${esc(q.word[0])} ${'_ '.repeat(q.word.length - 1)}</span></p>`,
    };
  }
  if (q.type === 'order') {
    return {
      key, order: q.words, wordy: true, answer: q.words.join(' '),
      prompt: `${pic}<p class="muted" style="margin:0 0 10px">Tap the words to build a sentence.</p><div class="built" id="built"></div><div class="tiles" id="tiles"></div>`,
      hint: r => r ? `<p class="explain"><b>${esc(q.words.join(' '))}</b></p>`
        : `<p class="explain">💡 The sentence starts with <b>${esc(q.words[0])}</b>.<br><span class="muted">The word with the end mark (. ? !) goes last.</span></p>`,
    };
  }
  // multiple choice
  return {
    key, wordy: true, answer: q.choices[q.answer],
    choices: shuffle(q.choices.map((c, i) => ({ label: c, correct: i === q.answer }))),
    prompt: `${passage}${pic}<div class="story">${sayBtn('.story-text')}<p class="story-text">${fill(q.q, p)}</p></div>`,
    hint: r => `<p class="explain">💡 ${fill(q.hint, p)}</p>${r && q.explain ? `<p class="explain"><b>${fill(q.explain, p)}</b></p>` : ''}`,
  };
}

// Spaced practice: shaky facts come back often, mastered ones rarely.
function chooseFact(p, missionId, recent) {
  const pool = POOLS[missionId];
  let total = 0;
  const weights = pool.map(k => {
    if (recent.includes(k)) return 0;
    const s = p.stats[k];
    let w = s ? 8 / (s.box + 1) + (s.w > s.r ? 4 : 0) : 3;
    if (missionId === 'muldiv' && p.grade <= 2 && k.includes('÷')) w *= .4;
    total += w; return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

function record(p, key, correct) {
  const s = p.stats[key] || (p.stats[key] = { r: 0, w: 0, box: 0 });
  if (correct) { s.r++; s.box = Math.min(5, s.box + 1); } else { s.w++; s.box = 0; }
}

function mastery(p, missionId) {
  if (BANK[missionId]) return bankProgress(p, missionId);
  if (TYPE_BY_ID[missionId]) return typingProgress(p, missionId);
  if (POOLS[missionId]) {
    const pool = POOLS[missionId];
    return pool.filter(k => p.stats[k] && p.stats[k].box >= 3).length / pool.length;
  }
  const h = (p.missions[missionId] || {}).history || [];
  if (!h.length) return 0;
  const last = h.slice(-5);
  return Math.min(1, last.reduce((a, b) => a + b, 0) / (5 * MISSION_LEN));
}

// Kid-facing progress: partial credit, so every right answer moves the bar.
function progress(p, missionId) {
  const pool = POOLS[missionId];
  if (!pool) return mastery(p, missionId);
  return pool.reduce((a, k) => a + Math.min(3, (p.stats[k] || {}).box || 0), 0) / (3 * pool.length);
}
const learnedCount = (p, missionId) => POOLS[missionId].filter(k => p.stats[k] && p.stats[k].r > 0).length;
const masteredCount = (p, missionId) => POOLS[missionId].filter(k => p.stats[k] && p.stats[k].box >= 3).length;
const showPct = x => x > 0 && x < .01 ? 1 : Math.round(x * 100);

/* =========================================================
   Screens
   ========================================================= */

function render(html) { $app.innerHTML = html; window.scrollTo(0, 0); }

function bindAll(sel, fn) { $app.querySelectorAll(sel).forEach(el => el.addEventListener('click', () => fn(el))); }

/* ----- Who's playing ----- */
function showProfiles() {
  screen = 'profiles';
  state.current = null; writeStore();
  applyTheme('space');
  render(`
    <div class="hero stack">
      <div class="big">🚀🐠🐶🧁</div>
      <h1>Quest Academy</h1>
      <p class="muted" style="font-size:1.2rem">Who's playing today?</p>
    </div>
    <div class="profile-grid" style="margin-top:20px">
      ${state.profiles.map(p => `
        <button class="profile" data-id="${p.id}">
          <span class="av">${p.avatar}</span>${esc(p.name)}
          <small>${THEMES[p.theme].icon} ${THEMES[p.theme].name}</small>
        </button>`).join('')}
      <button class="profile add" id="add"><span class="av plus">+</span>New player</button>
    </div>
    <div class="row-actions" style="margin-top:28px">
      <button class="btn ghost small" id="parents">👪 Grown-ups</button>
    </div>
    ${SYNC_URL && !state.sync.code ? '<p class="muted center" style="margin-top:12px">☁️ Grown-ups: turn on family sync to share progress between devices.</p>' : ''}
  `);
  bindAll('.profile[data-id]', el => { state.current = el.dataset.id; save(); showHome(); });
  document.getElementById('add').onclick = () => showEditProfile();
  document.getElementById('parents').onclick = showParentGate;
}

/* ----- Create / edit player ----- */
function showEditProfile(existing) {
  const d = existing || { name: '', avatar: null, grade: 2, theme: 'space' };
  let sel = { name: d.name, avatar: d.avatar, grade: d.grade, theme: d.theme };
  applyTheme(sel.theme);

  const draw = () => {
    const th = THEMES[sel.theme];
    if (!th.avatars.includes(sel.avatar)) sel.avatar = th.avatars[0];
    render(`
      <div class="topbar"><button class="btn ghost small" id="back">← Back</button></div>
      <div class="card stack">
        <h2>${existing ? 'Change my settings' : 'New player'}</h2>
        <div>
          <label class="lbl" for="nm">Your name</label>
          <input class="text" id="nm" maxlength="14" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" value="${esc(sel.name)}" placeholder="Type your name">
          <p class="muted" style="margin:6px 0 0;font-size:.95rem">Saved only on this device.</p>
        </div>
        <div>
          <span class="lbl">Pick your world</span>
          <div class="theme-pick">
            ${Object.entries(THEMES).map(([id, t]) => `<button class="pick" data-theme="${id}" aria-pressed="${id === sel.theme}"><span>${t.icon}</span>${t.name}</button>`).join('')}
          </div>
        </div>
        <div>
          <span class="lbl">Pick your ${th.playerWord.toLowerCase()}</span>
          <div class="pick-row">
            ${th.avatars.map(a => `<button class="pick emoji" data-av="${a}" aria-pressed="${a === sel.avatar}">${a}</button>`).join('')}
          </div>
        </div>
        <div>
          <span class="lbl">What grade are you in?</span>
          <div class="pick-row">
            ${[2, 3].map(g => `<button class="pick" data-grade="${g}" aria-pressed="${g === sel.grade}">${g === 2 ? '2nd' : '3rd'} grade</button>`).join('')}
          </div>
        </div>
        <div class="row-actions" style="justify-content:flex-start">
          <button class="btn" id="saveP">${existing ? 'Save' : `Let's go! ${th.icon}`}</button>
          ${existing ? '<button class="btn ghost small" id="switch">Switch player</button>' : ''}
        </div>
      </div>
    `);
    const nm = document.getElementById('nm');
    nm.oninput = () => { sel.name = nm.value; };
    bindAll('[data-theme]', el => { sel.theme = el.dataset.theme; applyTheme(sel.theme); draw(); });
    bindAll('[data-av]', el => { sel.avatar = el.dataset.av; draw(); });
    bindAll('[data-grade]', el => { sel.grade = +el.dataset.grade; draw(); });
    document.getElementById('back').onclick = () => existing ? showHome() : showProfiles();
    if (existing) document.getElementById('switch').onclick = showProfiles;
    document.getElementById('saveP').onclick = () => {
      const name = sel.name.trim();
      if (!name) { toast('Type your name first!'); nm.focus(); return; }
      if (existing) Object.assign(existing, { name, avatar: sel.avatar, grade: sel.grade, theme: sel.theme });
      else { const p = newProfile(name, sel.avatar, sel.grade, sel.theme); state.profiles.push(p); state.current = p.id; }
      save(); showHome();
    };
  };
  draw();
}

/* ----- Home ----- */
function showHome() {
  const p = me(); if (!p) return showProfiles();
  screen = 'home';
  const th = theme(p);
  applyTheme(p.theme);
  const subj = SUBJECTS[p.subject] ? p.subject : 'math';
  const missions = subj === 'math'
    ? MISSIONS.map(m => ({ id: m.id, icon: th.missions[m.id].icon, name: th.missions[m.id].name, desc: m.desc, grade: m.grade }))
    : subj === 'typing'
    ? TYPING_LESSONS.map(m => ({ id: m.id, icon: m.icon, name: m.game ? (BLASTER[p.theme] || BLASTER.space).name : m.name, desc: m.desc, grade: 2 }))
    : SUBJECTS[subj].missions.map(m => ({ id: m.id, icon: m.icon, name: esc(m.name), desc: esc(m.desc), grade: 2 }));
  // suggest the least-practiced mission for this grade
  const suggested = missions.filter(m => m.grade <= p.grade).sort((a, b) => progress(p, a.id) - progress(p, b.id))[0];
  const found = p.found[p.theme] || 0;
  const streakOk = p.lastDay && dayDiff(p.lastDay, today()) <= 1;

  render(`
    <div class="topbar">
      <button class="btn ghost small" id="me">${p.avatar} ${esc(p.name)} ⚙️</button>
      <div class="chips">
        <span class="chip" title="${th.point}">${th.pointIcon} ${p.points}</span>
        <span class="chip" title="days in a row">🔥 ${streakOk ? p.streak : 0}</span>
        <button class="chip" id="snd" aria-label="Sound on or off">${state.sound ? '🔊' : '🔇'}</button>
      </div>
    </div>
    <div class="stack">
      <div>
        <h1>${th.title}</h1>
        <p class="muted" style="font-size:1.15rem;margin:6px 0 0">Pick a subject and a mission, ${th.playerWord.toLowerCase()}!</p>
      </div>
      <div class="subject-tabs" role="tablist">
        ${SUBJECT_ORDER.map(s => `<button class="subject-tab" role="tab" data-s="${s}" aria-selected="${s === subj}">${SUBJECTS[s].icon} ${SUBJECTS[s].name}</button>`).join('')}
      </div>
      <div class="mission-grid">
        ${missions.map(m => {
          const tm = m, pct = showPct(progress(p, m.id));
          const label = POOLS[m.id] ? `${learnedCount(p, m.id)} facts learned · ${pct}%` : `${pct}% mastered`;
          return `<button class="mission" data-m="${m.id}">
            ${suggested && m.id === suggested.id ? '<span class="tag">Try me!</span>' : ''}
            <span class="icon">${tm.icon}</span>
            <span class="name">${tm.name}</span>
            <span class="desc">${m.desc}</span>
            <span class="mastery-label">${label}</span>
            <span class="mastery"><i style="width:${pct}%"></i></span>
          </button>`;
        }).join('')}
        ${subj === 'writing' && SUBJECTS.writing.journalPrompts ? `<button class="mission" id="journal">
            <span class="icon">📔</span><span class="name">My Journal</span>
            <span class="desc">Write about anything you like</span>
            <span class="mastery-label">${(p.journal || []).length} entries</span></button>` : ''}
      </div>
      <button class="card" id="coll" style="width:100%;text-align:left;display:flex;align-items:center;gap:14px">
        <span style="font-size:2.6rem">${found ? th.collectibles[found - 1][0] : '❔'}</span>
        <span><b style="font-size:1.3rem">${th.collection}</b><br>
        <span class="muted">${found} of ${th.collectibles.length} found. Finish missions to find more!</span></span>
      </button>
    </div>
  `);
  bindAll('[data-m]', el => startMission(el.dataset.m));
  bindAll('[data-s]', el => { p.subject = el.dataset.s; save(); showHome(); });
  const j = document.getElementById('journal'); if (j) j.onclick = () => showJournal();
  document.getElementById('me').onclick = () => showEditProfile(p);
  document.getElementById('coll').onclick = showCollection;
  document.getElementById('snd').onclick = () => { state.sound = !state.sound; save(); showHome(); };
}

/* ----- Journal ----- */
function showJournal(promptIdx) {
  const p = me(), th = theme(p), prompts = SUBJECTS.writing.journalPrompts;
  p.journal = p.journal || [];
  const day = Math.floor(Date.now() / 86400000);
  const idx = promptIdx == null ? (day + p.id.length) % prompts.length : promptIdx % prompts.length;
  const prompt = plainFill(prompts[idx], p);
  render(`
    <div class="topbar"><button class="btn ghost small" id="back">← Back</button><span class="chip">📔 My Journal</span><span></span></div>
    <div class="card stack">
      <div class="story">${sayBtn('.story-text')}<p class="story-text" style="font-size:1.4rem;font-weight:600;margin:0">${esc(prompt)}</p></div>
      <button class="btn ghost small" id="another" style="align-self:flex-start">🎲 Give me a different idea</button>
      <textarea class="text journal-text" id="jt" rows="8" placeholder="Start writing here..." autocorrect="off" spellcheck="false"></textarea>
      <div class="row-actions" style="justify-content:flex-start"><button class="btn" id="saveJ">Save my writing ${th.pointIcon}</button></div>
    </div>
    ${p.journal.length ? `<h2 style="margin-top:26px">My writing</h2>
      <div class="stack" style="margin-top:12px">${p.journal.slice(0, 20).map(e => `<div class="card journal-entry">
        <div class="muted">${esc(e.date)} · ${esc(e.prompt)}</div><p>${esc(e.text)}</p></div>`).join('')}</div>` : ''}
  `);
  bindSay();
  document.getElementById('back').onclick = showHome;
  document.getElementById('another').onclick = () => showJournal(idx + 1);
  document.getElementById('saveJ').onclick = () => {
    const text = document.getElementById('jt').value.trim();
    if (text.split(/\s+/).filter(Boolean).length < 5) { toast('Write a little more! ✏️'); return; }
    p.journal.unshift({ date: today(), ts: Date.now(), prompt, text });
    p.journal = p.journal.slice(0, 200);
    p.points += 5;
    touchStreak(p); save();
    sfx.win(); confetti('✏️');
    toast(`Saved! +5 ${th.point}`);
    showJournal(idx);
  };
}

/* ----- Collection ----- */
function showCollection() {
  const p = me(), th = theme(p), found = p.found[p.theme] || 0;
  render(`
    <div class="topbar"><button class="btn ghost small" id="back">← Back</button></div>
    <h1>${th.collection}</h1>
    <p class="muted">${found} of ${th.collectibles.length} found</p>
    <div class="collection" style="margin-top:16px">
      ${th.collectibles.map(([e, n], i) => i < found
        ? `<div class="collect"><span class="e">${e}</span><span class="n">${esc(n)}</span></div>`
        : `<div class="collect locked"><span class="e">${e}</span><span class="n">???</span></div>`).join('')}
    </div>
  `);
  document.getElementById('back').onclick = showHome;
}

/* ----- Play ----- */
let game = null;

function startMission(missionId) {
  if (TYPE_BY_ID[missionId]) return startTyping(missionId);
  const b = BANK[missionId];
  if (b && b.mission.learn) return showLearn(missionId);
  beginMission(missionId);
}

function beginMission(missionId) {
  const b = BANK[missionId], p = me();
  game = { missionId, n: 0, firstTry: 0, recent: [], retry: [], q: null, input: '', tries: 0, locked: false,
    queue: b ? buildBankQueue(b.mission, p) : null, qi: 0, len: MISSION_LEN };
  if (b) { game.len = game.queue.length; save(); }
  nextQuestion();
}

/* ----- Learn cards (science, social studies) ----- */
function showLearn(missionId) {
  const m = BANK[missionId].mission, p = me();
  render(`
    <div class="topbar"><button class="btn ghost small" id="back">← Back</button><span class="chip">${m.icon} ${esc(m.name)}</span><span></span></div>
    <h1>Let's learn!</h1>
    <p class="muted" style="font-size:1.15rem">Read these facts, then answer the questions.</p>
    <div class="learn-grid">
      ${m.learn.map((c, i) => `<div class="card learn"><span class="e">${c.emoji}</span><p id="lc${i}">${fill(c.text, p)}</p>${sayBtn('#lc' + i)}</div>`).join('')}
    </div>
    <div class="row-actions" style="margin-top:22px"><button class="btn" id="go">I'm ready! ${theme(p).icon}</button></div>
  `);
  bindSay();
  document.getElementById('back').onclick = showHome;
  document.getElementById('go').onclick = () => { try { speechSynthesis.cancel(); } catch (e) {} beginMission(missionId); };
}

function bindSay() {
  if (!('speechSynthesis' in window)) { $app.querySelectorAll('[data-say],[data-say-text]').forEach(b => b.remove()); return; }
  bindAll('[data-say]', el => { const t = $app.querySelector(el.dataset.say || '.story-text'); if (t) speak(t.innerText); });
  bindAll('[data-say-text]', () => speak(game.q.sayText));
}

function nextQuestion() {
  const p = me();
  if (game.n >= game.len) return finishMission();
  let q;
  const due = game.retry.findIndex(r => r.at <= game.n);
  if (due >= 0) q = game.retry.splice(due, 1)[0].q;
  else if (game.queue) q = bankQuestion(game.queue[game.qi++], p);
  else if (game.missionId === 'story' || (STORY_TYPES[game.missionId] && (game.n === 3 || game.n === 7))) {
    // word problems: every question in the Story mission, and 2 of 10 elsewhere
    const types = storyTypesFor(game.missionId, p);
    const type = weightedPick(p, types, t => 'wp-' + t);
    const big = game.missionId === 'twodigit' || (game.missionId === 'story' && (p.grade >= 3 || Math.random() < .35));
    q = makeStory(type, p, big);
  }
  else if (POOLS[game.missionId]) q = factQuestion(chooseFact(p, game.missionId, game.recent));
  else q = GENERATORS[game.missionId](p);
  game.recent = [q.key, ...game.recent].slice(0, 6);
  Object.assign(game, { q, input: '', tries: 0, locked: false });
  if (q.order) {
    game.placed = [];
    const idx = q.order.map((_, i) => i);
    do { shuffle(idx); } while (idx.length > 1 && idx.every((v, i) => v === i));
    game.tileOrder = idx;
  }
  drawPlay();
}

function drawPlay() {
  const p = me(), th = theme(p), tm = BANK[game.missionId] ? BANK[game.missionId].mission : th.missions[game.missionId];
  const pct = (game.n / game.len) * 100;
  const q = game.q;
  render(`
    <div class="play">
      <div class="topbar" style="margin:0">
        <button class="btn ghost small" id="quit">✕</button>
        <span class="chip">${tm.icon} ${tm.name}</span>
        <span class="chip">${game.n + 1} / ${game.len}</span>
      </div>
      <div class="meter"><span>${th.meterIcon} ${th.meter}</span><span class="bar"><i id="bar" style="width:${pct}%"></i></span></div>
      <div class="card question ${game.q.wordy ? 'wordy' : ''}">${game.q.prompt}</div>
      <div class="feedback" id="fb" aria-live="polite"></div>
      <div class="hint" id="hint"></div>
      ${q.spell ? `<div class="row-actions"><button class="btn" id="checkText">Check ✓</button></div>`
      : q.order ? `<div class="row-actions"><button class="btn" id="checkOrder" disabled>Check ✓</button></div>`
      : game.q.choices
        ? `<div class="choices ${game.q.choices.length === 2 ? 'two' : ''}" id="pad">${game.q.choices.map((c, i) => `<button data-c="${i}">${esc(c.label)}</button>`).join('')}</div>`
        : `<div class="pad" id="pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        <button data-k="del" aria-label="Delete">⌫</button><button data-k="0">0</button><button data-k="go" class="go" aria-label="Check answer">✓</button>
      </div>`}
    </div>
  `);
  updateAnswer();
  bindAll('[data-k]', el => press(el.dataset.k));
  bindAll('[data-c]', el => choose(+el.dataset.c));
  bindSay();
  if (q.spell) {
    const input = document.getElementById('spell');
    document.getElementById('checkText').onclick = checkSpell;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const n = document.getElementById('next'); n ? n.click() : checkSpell(); } });
    const clip = q.wordClip, word = q.spell;
    const sayWord = (rate, then) => clip ? playClips([clip], rate, then) : speak(word, rate === 1 ? .8 : .5, then);
    const hear = what => {
      // only the real recording is played; the sentence is shown on screen, not read aloud
      if (what === 'all') return sayWord(1, () => setTimeout(() => sayWord(1), 700));
      if (what === 'slow') return sayWord(.7);
      return sayWord(1);
    };
    $app.querySelectorAll('[data-hear]').forEach(b => { b.onclick = () => hear(b.dataset.hear); });
    setTimeout(() => hear('all'), 350);
  }
  if (q.order) { document.getElementById('checkOrder').onclick = checkOrder; drawOrder(); }
  document.getElementById('quit').onclick = () => { game = null; stopAudio(); try { speechSynthesis.cancel(); } catch (e) {} showHome(); };
}

function updateAnswer() {
  const a = document.getElementById('ans');
  if (a) a.textContent = game.input || '?';
}

function press(k) {
  if (!game || game.locked) return;
  if (k === 'del') game.input = game.input.slice(0, -1);
  else if (k === 'go') return check();
  else if (game.input.length < 4) game.input = (game.input === '0' ? '' : game.input) + k;
  const a = document.getElementById('ans'); if (a) a.className = 'answer-box';
  updateAnswer();
}

// Shared success path for typed and tapped answers
function answeredRight(p, th) {
  game.locked = true;
  if (game.tries === 1) { record(p, game.q.key, true); game.firstTry++; }
  const fb = document.getElementById('fb');
  fb.className = 'feedback good'; fb.textContent = pick(th.cheers) + ' ' + th.pointIcon;
  sfx.good(); save();
  game.n++;
  document.getElementById('bar').style.width = (game.n / game.len * 100) + '%';
  setTimeout(nextQuestion, game.tries === 1 ? 900 : 1300);
}

function choose(i) {
  if (!game || game.locked || !game.q.choices) return;
  const p = me(), th = theme(p), c = game.q.choices[i];
  const btn = $app.querySelector(`[data-c="${i}"]`);
  if (!c || btn.disabled) return;
  const fb = document.getElementById('fb'), hint = document.getElementById('hint');
  game.tries++;
  if (c.correct) { btn.classList.add('good'); return answeredRight(p, th); }
  sfx.bad();
  btn.classList.add('bad'); btn.disabled = true;
  if (c.tag) { p.mistakes = p.mistakes || {}; p.mistakes[c.tag] = (p.mistakes[c.tag] || 0) + 1; }
  const why = c.tag && MISTAKES[c.tag] ? `<p class="explain why">💡 ${MISTAKES[c.tag][1]}</p>` : '';
  const left = $app.querySelectorAll('[data-c]:not(:disabled)').length;
  if (game.tries === 1 && left > 1) {
    record(p, game.q.key, false); save();
    game.retry.push({ q: game.q, at: game.n + 3 });
    fb.className = 'feedback bad'; fb.textContent = pick(th.oops);
    hint.innerHTML = why + game.q.hint(false);
  } else {
    if (game.tries === 1) { record(p, game.q.key, false); game.retry.push({ q: game.q, at: game.n + 3 }); }
    save();
    game.locked = true;
    $app.querySelectorAll('[data-c]').forEach((b, j) => { if (game.q.choices[j].correct) b.classList.add('good'); });
    fb.className = 'feedback'; fb.innerHTML = `The answer is <b>${esc(game.q.answer)}</b>. You'll see this one again!`;
    hint.innerHTML = why + game.q.hint(true) + `<button class="btn" id="next" style="margin-top:14px">Next →</button>`;
    document.getElementById('next').onclick = () => { game.n++; nextQuestion(); };
  }
}

// Shared right/wrong flow for spelling and sentence building
function judge(correct, ui) {
  const p = me(), th = theme(p);
  const fb = document.getElementById('fb'), hint = document.getElementById('hint');
  game.tries++;
  if (correct) { if (ui.good) ui.good(); return answeredRight(p, th); }
  sfx.bad(); if (ui.bad) ui.bad();
  if (game.tries === 1) {
    record(p, game.q.key, false); save();
    game.retry.push({ q: game.q, at: game.n + 3 });
    fb.className = 'feedback bad'; fb.textContent = pick(th.oops);
    hint.innerHTML = game.q.hint(false);
    if (ui.retry) ui.retry();
  } else {
    game.locked = true;
    fb.className = 'feedback'; fb.innerHTML = `The answer is <b>${esc(game.q.answer)}</b>. You'll see this one again!`;
    if (ui.reveal) ui.reveal();
    hint.innerHTML = game.q.hint(true) + `<button class="btn" id="next" style="margin-top:14px">Next →</button>`;
    document.getElementById('next').onclick = () => { game.n++; nextQuestion(); };
  }
}

function checkSpell() {
  if (!game || game.locked) return;
  const input = document.getElementById('spell'), v = input.value.trim().toLowerCase();
  if (!v) { input.focus(); return; }
  judge(v === game.q.spell, {
    good: () => input.classList.add('good'),
    bad: () => input.classList.add('bad'),
    retry: () => setTimeout(() => { input.value = ''; input.classList.remove('bad'); }, 500),
    reveal: () => { input.value = game.q.spell; input.disabled = true; input.classList.remove('bad'); input.classList.add('good'); },
  });
}

function drawOrder() {
  const q = game.q, built = document.getElementById('built'), tiles = document.getElementById('tiles');
  built.innerHTML = game.placed.map((i, j) => `<button class="tile" data-b="${j}">${esc(q.order[i])}</button>`).join('') || '<span class="muted">Your sentence goes here</span>';
  tiles.innerHTML = game.tileOrder.map(i => game.placed.includes(i)
    ? `<span class="tile used">${esc(q.order[i])}</span>`
    : `<button class="tile" data-t="${i}">${esc(q.order[i])}</button>`).join('');
  built.querySelectorAll('[data-b]').forEach(b => { b.onclick = () => { if (game.locked) return; game.placed.splice(+b.dataset.b, 1); drawOrder(); }; });
  tiles.querySelectorAll('[data-t]').forEach(b => { b.onclick = () => { if (game.locked) return; game.placed.push(+b.dataset.t); drawOrder(); }; });
  document.getElementById('checkOrder').disabled = game.locked || game.placed.length !== q.order.length;
}

function checkOrder() {
  if (!game || game.locked) return;
  const q = game.q, built = document.getElementById('built');
  judge(game.placed.map(i => q.order[i]).join(' ') === q.order.join(' '), {
    good: () => built.classList.add('good'),
    bad: () => built.classList.add('bad'),
    retry: () => setTimeout(() => { built.classList.remove('bad'); game.placed = []; drawOrder(); }, 600),
    reveal: () => { built.classList.remove('bad'); game.placed = q.order.map((_, i) => i); drawOrder(); built.classList.add('good'); },
  });
}

function check() {
  if (game.input === '') return;
  const p = me(), th = theme(p);
  const ans = document.getElementById('ans'), fb = document.getElementById('fb'), hint = document.getElementById('hint');
  const correct = +game.input === game.q.answer;
  game.tries++;
  if (correct) { ans.className = 'answer-box good'; return answeredRight(p, th); }
  sfx.bad();
  ans.className = 'answer-box bad';
  if (game.tries === 1) {
    record(p, game.q.key, false); save();
    // bring this one back a few questions later
    game.retry.push({ q: game.q, at: game.n + 3 });
    fb.className = 'feedback bad'; fb.textContent = pick(th.oops);
    hint.innerHTML = game.q.hint(false);
    game.input = ''; setTimeout(updateAnswer, 350);
  } else {
    game.locked = true;
    fb.className = 'feedback'; fb.innerHTML = `The answer is <b>${game.q.answer}</b>. You'll see this one again!`;
    ans.textContent = game.q.answer; ans.className = 'answer-box good';
    hint.innerHTML = game.q.hint(true) + `<button class="btn" id="next" style="margin-top:14px">Next →</button>`;
    document.getElementById('next').onclick = () => { game.n++; nextQuestion(); };
  }
}

document.addEventListener('keydown', e => {
  if (!game || !document.getElementById('pad')) return;
  if (game.q.choices) {
    if (/^[1-4]$/.test(e.key)) choose(+e.key - 1);
    else if (e.key === 'Enter') { const n = document.getElementById('next'); if (n) n.click(); }
    return;
  }
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') press('del');
  else if (e.key === 'Enter') { const n = document.getElementById('next'); n ? n.click() : press('go'); }
});

function touchStreak(p) {
  const t = today();
  if (p.lastDay !== t) { p.streak = p.lastDay && dayDiff(p.lastDay, t) === 1 ? p.streak + 1 : 1; p.lastDay = t; }
}

function finishMission() {
  const p = me(), th = theme(p);
  const m = p.missions[game.missionId] || (p.missions[game.missionId] = { plays: 0, history: [] });
  m.plays++; m.history = [...m.history, game.firstTry].slice(-20);
  const len = game.len, perfect = game.firstTry === len;
  const earned = game.firstTry + (perfect ? 5 : 0);
  p.points += earned;

  touchStreak(p);

  // new collectible each mission until the set is complete
  const found = p.found[p.theme] || 0;
  let prize = null;
  if (found < th.collectibles.length) { prize = th.collectibles[found]; p.found[p.theme] = found + 1; }
  save();
  sfx.win(); confetti(th.pointIcon);
  const missionId = game.missionId, right = game.firstTry;
  game = null;

  render(`
    <div class="result stack card" style="margin-top:20px">
      <h1>${th.finish}</h1>
      ${prize ? `<div class="prize">${prize[0]}</div>
        <h2>${th.collectVerb}</h2><p style="font-size:1.4rem;margin:0">Meet <b>${esc(prize[1])}</b>!</p>`
        : `<div class="prize">🏆</div><h2>You found everything in ${th.collection}!</h2>`}
      <p style="font-size:1.3rem">You got <b>${right} of ${len}</b> right on the first try
        ${perfect ? '<br>🎯 <b>Perfect!</b> +5 bonus' : ''}<br>+${earned} ${th.point} ${th.pointIcon}</p>
      <div class="row-actions">
        <button class="btn" id="again">Play again</button>
        <button class="btn ghost" id="home">Home</button>
      </div>
    </div>
  `);
  document.getElementById('again').onclick = () => startMission(missionId);
  document.getElementById('home').onclick = showHome;
}

/* =========================================================
   Typing: lessons with a finger-guide keyboard + a word game
   ========================================================= */
const KB_ROWS = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'];
const FINGER = {};
[['qaz', 'lp'], ['wsx', 'lr'], ['edc', 'lm'], ['rfvtgb', 'li'], ['yhnujm', 'ri'], ['ik,', 'rm'], ['ol.', 'rr'], ['p;/', 'rp']]
  .forEach(([keys, f]) => [...keys].forEach(k => { FINGER[k] = f; }));
const FINGER_NAME = { lp: 'left pinky', lr: 'left ring finger', lm: 'left middle finger', li: 'left pointer finger',
  ri: 'right pointer finger', rm: 'right middle finger', rr: 'right ring finger', rp: 'right pinky', th: 'thumb' };

const TYPE_WORDS = ('a as ad add all ask dad sad lad fad fall hall glad flash gas has had half dash shall salad flask lash ' +
  'the and you that was for are with his they one have this from had not but what all were when your can said there use ' +
  'each which she how their will other about out many then them these some her would make like him into time has look two ' +
  'more write see number way could people than first water been call who its now find long down day did get come made may ' +
  'part over new sound take only little work know place year live back give most very after thing our just name good ' +
  'sentence man think say great where help through much before line right too mean old any same tell boy follow came want ' +
  'show also around form three small set put end does another well large must big even such because turn here why ask ' +
  'went men read need land different home us move try kind hand picture again change off play spell air away animal house ' +
  'point page letter mother answer found study still learn should world high every near add food between own below country ' +
  'plant last school father keep tree never start city earth eye light thought head under story saw left few while along ' +
  'might close something seem next hard open example begin life always those both paper together got group often run ' +
  'cat dog sun fun run red top hop pig fish frog duck cake rain jump kite star moon rock ship boat bike game toy snow').split(' ');
const TYPE_SENTENCES = [
  'I like to play outside.', 'The cat sat on a red mat.', 'Can you see the moon?', 'We read a book at school.',
  'My dog likes to run fast.', 'Look at that big rainbow!', 'Do you want to play a game?', 'The frog jumped into the pond.',
  'She has a blue kite.', 'We made a cake for Dad.', 'It is fun to ride a bike.', 'Where did the ball go?',
  '{name} and {buddy} zoom past the stars.', '{buddy} says hello to {name}!', 'Fish swim in the deep sea.',
  'The sun is very hot.', 'I can type with all my fingers.', 'Snow fell on the big hill.', 'What is your favorite game?',
  'We planted seeds, beans, and corn.', 'The bus stops at the corner.', 'Wow, that was a great jump!',
];

const TYPING_LESSONS = [
  { id: 'type-home', icon: '🏠', name: 'Home Row', desc: 'A S D F G H J K L', keys: 'asdfghjkl', drills: ['ff jj ff jj', 'dd kk dd kk', 'ss ll ss ll', 'fj dk sl a;', 'gg hh fg jh'] },
  { id: 'type-top', icon: '⬆️', name: 'Top Row', desc: 'Q W E R T Y U I O P', keys: 'asdfghjklqwertyuiop', drills: ['ff rr ff rr', 'jj uu jj uu', 'dd ee kk ii', 'ft jy dr ku'] },
  { id: 'type-bottom', icon: '⬇️', name: 'Bottom Row', desc: 'Z X C V B N M', keys: 'abcdefghijklmnopqrstuvwxyz', drills: ['ff vv jj mm', 'dd cc kk nn', 'fb jn sx dc'] },
  { id: 'type-sentences', icon: '✍️', name: 'Sentences', desc: 'Capitals with Shift, . ? !', sentences: true },
  { id: 'type-game', icon: '🎮', name: 'Word Blaster', desc: 'Zap the words before they land!', game: true },
];
const TYPE_BY_ID = Object.fromEntries(TYPING_LESSONS.map(l => [l.id, l]));
const typeTarget = p => p.grade >= 3 ? 12 : 8; // words per minute goal
const BLASTER = {
  space: { thing: '☄️', name: 'Asteroid Blaster', boom: '💥' }, ocean: { thing: '🫧', name: 'Bubble Pop', boom: '✨' },
  pets: { thing: '🦴', name: 'Treat Catch', boom: '💖' }, bakery: { thing: '🧁', name: 'Sprinkle Storm', boom: '🍬' },
};

function typingProgress(p, id) {
  const runs = ((p.typing || {})[id] || []).slice(-3);
  if (!runs.length) return 0;
  if (id === 'type-game') return Math.min(1, Math.max(...runs.map(r => r.score)) / 1500);
  return runs.reduce((a, r) => a + (r.acc / 100) * Math.min(1, r.wpm / typeTarget(p)), 0) / 3;
}

function makeLines(lesson, p) {
  if (lesson.sentences) return shuffle(TYPE_SENTENCES.slice()).slice(0, 5).map(s => plainFill(s, p));
  const ok = w => [...w].every(c => lesson.keys.includes(c));
  const words = TYPE_WORDS.filter(ok).filter(w => w.length <= (p.grade >= 3 ? 7 : 5));
  const lines = shuffle(lesson.drills.slice()).slice(0, 2);
  while (lines.length < 6) lines.push(Array.from({ length: 5 }, () => pick(words)).join(' '));
  return lines;
}

function keyboardHtml(next) {
  const nk = (next || '').toLowerCase();
  return `<div class="kb" aria-hidden="true">${KB_ROWS.map((row, r) => `<div class="kb-row r${r}">${[...row].map(k =>
    `<span class="key f-${FINGER[k]} ${k === nk ? 'next' : ''} ${(k === 'f' || k === 'j') ? 'bump' : ''}">${k === ';' ? ';' : k.toUpperCase()}</span>`).join('')}</div>`).join('')}
    <div class="kb-row"><span class="key shift f-lp ${next && next !== next.toLowerCase() && /[a-z]/i.test(next) ? 'next' : ''}">Shift</span><span class="key space f-th ${next === ' ' ? 'next' : ''}">space</span><span class="key shift f-rp ${next && next !== next.toLowerCase() && /[a-z]/i.test(next) ? 'next' : ''}">Shift</span></div></div>`;
}

const typeHelpText = ch => {
  if (ch === ' ') return 'Tap the <b>space bar</b> with your <b>thumb</b>';
  const f = FINGER[ch.toLowerCase()];
  if (!f) return `Type <b>${esc(ch)}</b>`;
  const shift = ch !== ch.toLowerCase() ? `Hold <b>Shift</b> with your other pinky, then ` : '';
  return `${shift || 'Use '}${shift ? 'use' : ''} your <b class="fc-${f}">${FINGER_NAME[f]}</b>`.replace('Use  your', 'Use your');
};

// one hidden text box catches typing from real keyboards and the iPad keyboard
function typingInput(onChar) {
  const ta = document.getElementById('typein');
  const focus = () => { try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } };
  ta.addEventListener('input', () => { const v = ta.value; ta.value = ''; for (const ch of v.replace(/\n/g, ' ')) onChar(ch); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  $app.addEventListener('pointerdown', e => { if (!e.target.closest('button')) setTimeout(focus, 0); });
  focus();
  return focus;
}
const noKeyboardNote = () => matchMedia('(pointer: coarse)').matches
  ? `<p class="muted center" style="margin:6px 0 0">⌨️ Typing works best with a real keyboard. On a tablet, tap the words to open the keyboard.</p>` : '';

function startTyping(id) {
  const lesson = TYPE_BY_ID[id];
  if (lesson.game) return startBlaster();
  const p = me(), th = theme(p);
  const t = { lines: makeLines(lesson, p), li: 0, ci: 0, errors: 0, correct: 0, start: 0, missed: {} };
  const draw = () => {
    const line = t.lines[t.li], ch = line[t.ci];
    const elapsed = t.start ? (Date.now() - t.start) / 60000 : 0;
    const wpm = elapsed > 0.05 ? Math.round(t.correct / 5 / elapsed) : 0;
    const acc = t.correct + t.errors ? Math.round(t.correct / (t.correct + t.errors) * 100) : 100;
    $app.querySelector('#typeline').innerHTML = [...line].map((c, i) =>
      `<span class="tc ${i < t.ci ? 'done' : i === t.ci ? 'cur' : ''} ${c === ' ' ? 'sp' : ''}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
    $app.querySelector('#typehelp').innerHTML = typeHelpText(ch);
    $app.querySelector('#kbwrap').innerHTML = keyboardHtml(ch);
    $app.querySelector('#tstats').innerHTML = `<span class="chip">⚡ ${wpm} WPM</span><span class="chip">🎯 ${acc}%</span><span class="chip">${t.li + 1} / ${t.lines.length}</span>`;
    document.getElementById('bar').style.width = (t.li / t.lines.length * 100) + '%';
  };
  render(`
    <div class="play">
      <div class="topbar" style="margin:0">
        <button class="btn ghost small" id="quit">✕</button>
        <span class="chip">${lesson.icon} ${lesson.name}</span>
        <span class="chips" id="tstats"></span>
      </div>
      <div class="meter"><span>${th.meterIcon} ${th.meter}</span><span class="bar"><i id="bar"></i></span></div>
      <div class="card typeline" id="typeline"></div>
      <p class="center typehelp" id="typehelp"></p>
      <div id="kbwrap"></div>
      ${noKeyboardNote()}
      <textarea id="typein" class="typein" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Type here"></textarea>
    </div>`);
  document.getElementById('quit').onclick = showHome;
  typingInput(c => {
    const line = t.lines[t.li], want = line[t.ci];
    if (!t.start) t.start = Date.now();
    if (c === want) {
      t.correct++; t.ci++;
      if (t.ci >= line.length) {
        t.li++; t.ci = 0; sfx.good();
        if (t.li >= t.lines.length) return finishTyping(lesson, t);
      }
    } else {
      t.errors++; t.missed[want] = (t.missed[want] || 0) + 1;
      const cur = $app.querySelector('.tc.cur'); if (cur) { cur.classList.remove('miss'); void cur.offsetWidth; cur.classList.add('miss'); }
      beep([[220, .08]]);
      return;
    }
    draw();
  });
  draw();
}

function finishTyping(lesson, t) {
  const p = me(), th = theme(p);
  const mins = Math.max((Date.now() - t.start) / 60000, .05);
  const wpm = Math.round(t.correct / 5 / mins), acc = Math.round(t.correct / (t.correct + t.errors) * 100);
  p.typing = p.typing || {}; (p.typing[lesson.id] = p.typing[lesson.id] || []).push({ wpm, acc, date: today() });
  p.typing[lesson.id] = p.typing[lesson.id].slice(-30);
  p.typeMiss = p.typeMiss || {};
  Object.entries(t.missed).forEach(([k, n]) => { p.typeMiss[k] = (p.typeMiss[k] || 0) + n; });
  const goal = typeTarget(p), stars = (acc >= 90 ? 1 : 0) + (acc >= 97 ? 1 : 0) + (wpm >= goal ? 1 : 0);
  const earned = 3 + stars * 3;
  awardFinish(p, th, earned, `
    <div class="type-results">
      <div><b>${wpm}</b><span>words per minute</span></div>
      <div><b>${acc}%</b><span>accuracy</span></div>
      <div><b>${'⭐'.repeat(stars) || '💪'}</b><span>${stars === 3 ? 'Amazing!' : stars ? 'Great job!' : 'Keep practicing!'}</span></div>
    </div>
    <p class="muted">Goal: ${goal} words per minute with 97% accuracy. Accuracy first, speed comes next!</p>`,
    () => startTyping(lesson.id));
}

// shared end-of-mission reward screen
function awardFinish(p, th, earned, bodyHtml, again, allowPrize = true, title = th.finish) {
  p.points += earned;
  touchStreak(p);
  const found = p.found[p.theme] || 0;
  let prize = null;
  if (allowPrize && found < th.collectibles.length) { prize = th.collectibles[found]; p.found[p.theme] = found + 1; }
  save(); sfx.win(); confetti(th.pointIcon);
  render(`
    <div class="result stack card" style="margin-top:20px">
      <h1>${title}</h1>
      ${prize ? `<div class="prize">${prize[0]}</div><h2>${th.collectVerb}</h2><p style="font-size:1.4rem;margin:0">Meet <b>${esc(prize[1])}</b>!</p>` : ''}
      ${bodyHtml}
      <p style="font-size:1.3rem">+${earned} ${th.point} ${th.pointIcon}</p>
      <div class="row-actions"><button class="btn" id="again">Play again</button><button class="btn ghost" id="home">Home</button></div>
    </div>`);
  document.getElementById('again').onclick = again;
  document.getElementById('home').onclick = showHome;
}

/* ----- Word Blaster game ----- */
function startBlaster() {
  const p = me(), th = theme(p), look = BLASTER[p.theme] || BLASTER.space;
  const maxLen = p.grade >= 3 ? 7 : 5;
  const pool = TYPE_WORDS.filter(w => w.length >= 2 && w.length <= maxLen);
  const g = { words: [], target: null, score: 0, combo: 0, lives: 3, zapped: 0, level: 1, t0: performance.now(), last: performance.now(), spawnAt: 0, alive: true };
  render(`
    <div class="play">
      <div class="topbar" style="margin:0">
        <button class="btn ghost small" id="quit">✕</button>
        <span class="chip">${look.thing} ${look.name}</span>
        <span class="chips"><span class="chip" id="gscore">0</span><span class="chip" id="glives">❤️❤️❤️</span></span>
      </div>
      <div class="card blaster" id="field"><div class="combo" id="combo"></div><div class="level-up" id="lvl"></div></div>
      <p class="center typehelp" id="typehelp">Type a word to zap it!</p>
      ${noKeyboardNote()}
      <textarea id="typein" class="typein" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Type here"></textarea>
    </div>`);
  const field = document.getElementById('field');
  document.getElementById('quit').onclick = () => { g.alive = false; showHome(); };
  const wordHtml = w => `<span class="wthing">${look.thing}</span><span class="wtext"><span class="typed">${esc(w.text.slice(0, w.typed))}</span>${esc(w.text.slice(w.typed))}</span>`;
  const hud = () => {
    document.getElementById('gscore').textContent = `⭐ ${g.score}`;
    document.getElementById('glives').textContent = '❤️'.repeat(g.lives) + '🖤'.repeat(3 - g.lives);
    document.getElementById('combo').textContent = g.combo > 1 ? `Combo ×${g.combo}` : '';
  };
  const spawn = () => {
    const used = new Set(g.words.map(w => w.text[0]));
    let text = pick(pool), tries = 0;
    while (used.has(text[0]) && tries++ < 20) text = pick(pool);   // different first letters = easy targeting
    const el = document.createElement('div'); el.className = 'fword';
    const w = { text, typed: 0, y: -40, el, x: rand(5, 70) };
    el.style.left = w.x + '%'; el.innerHTML = wordHtml(w); field.appendChild(el); g.words.push(w);
  };
  const zap = w => {
    g.combo++; g.zapped++;
    g.score += w.text.length * 10 * Math.min(5, 1 + Math.floor(g.combo / 3));
    w.el.innerHTML = `<span class="boom">${look.boom}</span>`; w.el.classList.add('zapped');
    setTimeout(() => w.el.remove(), 350);
    g.words = g.words.filter(x => x !== w); g.target = null;
    beep([[880, .06], [1320, .08]]);
    if (g.zapped % 10 === 0) {
      g.level++; const l = document.getElementById('lvl'); l.textContent = `Level ${g.level}!`;
      l.classList.remove('show'); void l.offsetWidth; l.classList.add('show');
    }
    hud();
  };
  typingInput(c => {
    if (!g.alive) return;
    c = c.toLowerCase();
    if (!g.target) g.target = g.words.filter(w => w.text[0] === c).sort((a, b) => b.y - a.y)[0] || null;
    if (g.target && g.target.text[g.target.typed] === c) {
      g.target.typed++; g.target.el.classList.add('locked'); g.target.el.innerHTML = wordHtml(g.target);
      if (g.target.typed === g.target.text.length) zap(g.target);
    } else {
      g.combo = 0; hud();
      field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake');
    }
  });
  const tick = now => {
    if (!g.alive || !document.body.contains(field)) return;
    const dt = Math.min(.05, (now - g.last) / 1000); g.last = now;
    const speed = 22 + g.level * 7 + (p.grade >= 3 ? 6 : 0);           // pixels per second
    const every = Math.max(900, 2600 - g.level * 220);                  // ms between words
    if (now > g.spawnAt) { spawn(); g.spawnAt = now + every; }
    const floor = field.clientHeight - 50;
    for (const w of g.words.slice()) {
      w.y += speed * dt; w.el.style.transform = `translateY(${w.y}px)`;
      if (w.y > floor) {
        g.words = g.words.filter(x => x !== w); if (g.target === w) g.target = null;
        w.el.remove(); g.lives--; g.combo = 0; sfx.bad(); hud();
        if (g.lives <= 0) { g.alive = false; return endBlaster(g, look); }
      }
    }
    requestAnimationFrame(tick);
  };
  hud(); requestAnimationFrame(tick);
}

function endBlaster(g, look) {
  const p = me(), th = theme(p);
  p.typing = p.typing || {};
  (p.typing['type-game'] = p.typing['type-game'] || []).push({ score: g.score, zapped: g.zapped, date: today() });
  p.typing['type-game'] = p.typing['type-game'].slice(-30);
  const best = p.typeHigh || 0, newBest = g.score > best;
  if (newBest) p.typeHigh = g.score;
  const earned = Math.min(25, 2 + Math.floor(g.score / 100));
  awardFinish(p, th, earned, `
    <div class="type-results">
      <div><b>${g.score}</b><span>score</span></div>
      <div><b>${g.zapped}</b><span>words zapped</span></div>
      <div><b>${newBest ? '🏆' : (p.typeHigh || 0)}</b><span>${newBest ? 'New high score!' : 'high score'}</span></div>
    </div>
    ${g.zapped < 10 ? '<p class="muted">Zap 10 words in one game to find a new friend!</p>' : ''}`, startBlaster, g.zapped >= 10, 'Game over!');
}

/* ----- Grown-ups ----- */
function showParentGate() {
  render(`
    <div class="topbar"><button class="btn ghost small" id="back">← Back</button></div>
    <div class="card stack center">
      <h2>Grown-ups only</h2>
      <p class="muted">Press and hold the button for 3 seconds.</p>
      <button class="btn hold" id="hold"><i></i>Hold me</button>
    </div>
  `);
  document.getElementById('back').onclick = showProfiles;
  const b = document.getElementById('hold'), fill = b.querySelector('i');
  let timer;
  const start = e => { e.preventDefault(); fill.style.transition = 'width 3s linear'; fill.style.width = '100%'; timer = setTimeout(showParents, 3000); };
  const stop = () => { clearTimeout(timer); fill.style.transition = 'none'; fill.style.width = '0'; };
  b.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
}

function trickyFacts(p) {
  return Object.entries(p.stats)
    .filter(([k, s]) => s.w > 0 && s.box < 3 && (!k.startsWith('q:') || QINDEX[k.slice(2)]))
    .sort((a, b) => (b[1].w - b[1].r * .5) - (a[1].w - a[1].r * .5))
    .slice(0, 12)
    .map(([k, s]) => `<span class="fact" title="right ${s.r}, missed ${s.w}">${esc(labelKey(k))}</span>`).join('') || '<span class="muted">Nothing tricky yet. Nice!</span>';
}
function labelKey(k) {
  const names = { 'pv-blocks': 'Reading blocks', 'pv-digit': 'Digit place', 'pv-expanded': 'Expanded form',
    'pv-10more': '10 more', 'pv-10less': '10 less', 'pv-100more': '100 more', 'pv-100less': '100 less',
    'add2': '2-digit add', 'add2-regroup': '2-digit add (carrying)', 'sub2': '2-digit subtract', 'sub2-regroup': '2-digit subtract (borrowing)',
    'mc-matchop': 'Pick the matching number sentence', 'mc-compare': 'Comparing with < > =', 'mc-round': 'Rounding',
    'mc-sign': 'Missing sign', 'mc-oddeven': 'Odd or even', 'mc-estimate': 'Estimating', 'mc-regroup': 'Carrying & borrowing',
    'wp-join': 'Story: adding on', 'wp-separate': 'Story: taking away', 'wp-compare': 'Story: how many more',
    'wp-missing': 'Story: missing part', 'wp-money': 'Story: money', 'wp-pvbundle': 'Story: hundreds/tens/ones',
    'wp-groups': 'Story: equal groups', 'wp-share': 'Story: sharing equally', 'wp-buy': 'Story: how many can you buy',
    'wp-twostep': 'Story: two steps' };
  if (k.startsWith('q:')) {
    const hit = QINDEX[k.slice(2)];
    if (!hit) return k;
    const q = hit.q, m = BANK[hit.mid].mission.name;
    const text = q.type === 'spell' ? `spell "${q.word}"` : q.type === 'order' ? q.words.join(' ') : q.q.replace(/\{name\}/g, 'name').replace(/\{buddy\}/g, 'buddy');
    return `${m}: ${text.length > 60 ? text.slice(0, 57) + '…' : text}`;
  }
  return names[k] || k.replace('-', ' − ').replace('+', ' + ').replace('×', ' × ').replace('÷', ' ÷ ');
}

function showParents() {
  applyTheme('space');
  render(`
    <div class="topbar"><button class="btn ghost small" id="back">← Back</button></div>
    <h1>Progress</h1>
    <p class="muted">${SYNC_URL && state.sync.code ? 'Progress is shared across your family\'s devices.' : 'Progress is saved only in this browser on this device.'}</p>
    ${syncCardHtml()}
    ${state.profiles.length ? '' : '<p>No players yet.</p>'}
    <div class="stack">
    ${state.profiles.map(p => {
      const rows = SUBJECT_ORDER.map(sid => `<tr class="subject-row"><th colspan="4">${SUBJECTS[sid].icon} ${SUBJECTS[sid].name}</th></tr>` +
        (sid === 'typing' ? TYPING_LESSONS.map(l => {
          const runs = (p.typing || {})[l.id] || [];
          if (l.game) return `<tr><td>${esc((BLASTER[p.theme] || BLASTER.space).name)}</td><td>${runs.length}</td><td>High score: ${p.typeHigh || 0}</td><td>${Math.round(typingProgress(p, l.id) * 100)}%</td></tr>`;
          const last = runs.slice(-3), avg = k => last.length ? Math.round(last.reduce((a, r) => a + r[k], 0) / last.length) : 0;
          return `<tr><td>${esc(l.name)}</td><td>${runs.length}</td><td>${runs.length ? `${avg('wpm')} WPM · ${avg('acc')}% accurate` : '—'}</td><td>${Math.round(typingProgress(p, l.id) * 100)}%</td></tr>`;
        }).join('') :
        (sid === 'math' ? MISSIONS : SUBJECTS[sid].missions).map(m => {
        const keys = Object.keys(p.stats).filter(k => missionOf(k) === m.id);
        const r = keys.reduce((a, k) => a + p.stats[k].r, 0), w = keys.reduce((a, k) => a + p.stats[k].w, 0);
        const mm = p.missions[m.id] || { plays: 0 };
        return `<tr><td>${esc(sid === 'math' ? m.desc : m.name)}</td><td>${mm.plays}</td><td>${r + w ? Math.round(r / (r + w) * 100) + '%' : '—'}</td><td>${Math.round(mastery(p, m.id) * 100)}%${POOLS[m.id] ? ` <span class="muted">(${masteredCount(p, m.id)} of ${POOLS[m.id].length} facts)</span>` : ''}</td></tr>`;
      }).join(''))).join('');
      return `<div class="card stack">
        <h2>${p.avatar} ${esc(p.name)} <span class="muted" style="font-size:1rem">${p.grade === 2 ? '2nd' : '3rd'} grade · ${THEMES[p.theme].name}</span></h2>
        <p style="margin:0">🔥 Streak: ${p.lastDay && dayDiff(p.lastDay, today()) <= 1 ? p.streak : 0} days · Last played: ${p.lastDay || 'never'}</p>
        <div style="overflow-x:auto"><table><tr><th>Skill</th><th>Missions</th><th>First-try accuracy</th><th>Mastered</th></tr>${rows}</table></div>
        <div><b>Needs practice</b><div class="facts" style="margin-top:8px">${trickyFacts(p)}</div></div>
        <div><b>Trickiest typing keys</b><div class="facts" style="margin-top:8px">${
          Object.entries(p.typeMiss || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `<span class="fact">${k === ' ' ? 'space' : esc(k)} ×${n}</span>`).join('') || '<span class="muted">None yet</span>'}</div></div>
        <div><b>Common mistakes</b> <span class="muted">(from the multiple choice mission)</span><div class="facts" style="margin-top:8px">${
          Object.entries(p.mistakes || {}).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="fact" title="${esc(MISTAKES[t] ? MISTAKES[t][1] : '')}">${esc(MISTAKES[t] ? MISTAKES[t][0] : t)} ×${n}</span>`).join('') || '<span class="muted">None yet</span>'}</div></div>
        <div><b>Journal</b> <span class="muted">(${(p.journal || []).length} entries)</span>${(p.journal || []).slice(0, 5).map(e =>
          `<div class="journal-entry" style="margin-top:10px"><div class="muted">${esc(e.date)} · ${esc(e.prompt)}</div><p>${esc(e.text)}</p></div>`).join('') || '<div class="muted">Nothing written yet.</div>'}</div>
        <div><button class="btn ghost small" data-del="${p.id}">Delete player</button></div>
      </div>`;
    }).join('')}
    </div>
  `);
  document.getElementById('back').onclick = showProfiles;
  bindSyncCard(showParents);
  bindAll('[data-del]', el => {
    const p = state.profiles.find(x => x.id === el.dataset.del);
    if (p && confirm(`Delete ${p.name} and all their progress? This can't be undone.`)) {
      state.profiles = state.profiles.filter(x => x !== p);
      state.sync.tombs.push({ id: p.id, updated: Date.now() }); delete snapshot[p.id];
      save(); showParents();
    }
  });
}
function missionOf(k) {
  if (k.startsWith('q:')) return (QINDEX[k.slice(2)] || {}).mid;
  if (k.startsWith('wp-')) return 'story';
  if (k.startsWith('mc-')) return 'choice';
  if (k.startsWith('pv-')) return 'place';
  if (/^(add|sub)2/.test(k)) return 'twodigit';
  if (/[×÷]/.test(k)) return 'muldiv';
  return 'addsub';
}

/* =========================================================
   Family sync (only on the family's own server, e.g. learn.kmydev.com)
   Each device keeps working offline; changes are merged per player.
   ========================================================= */
const SYNC_URL = /github\.io$/.test(location.hostname) ? null : 'api/sync.php';
state.sync = state.sync || { code: '', last: 0, tombs: [], ok: 0 };
state.device = state.device || ('d' + Math.random().toString(36).slice(2, 10));
const snapshot = {};             // player id -> JSON last known to match the server/our own save
const lastPoints = {};           // player id -> points at last save, to count what THIS device earned
const pjson = p => JSON.stringify({ ...p, updated: 0 });
state.profiles.forEach(p => { snapshot[p.id] = pjson(p); lastPoints[p.id] = p.points || 0; });
const sumVals = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
let syncTimer = null, syncing = false, lastSyncError = '';
let screen = '';                 // 'profiles' | 'home' | other — so a sync can refresh safe screens

function markChanged() {
  // stamp any player whose data changed since we last saved it
  state.profiles.forEach(p => {
    // points ledger: each device only ever adds to its own counter, so merging never loses points
    if (!p.earned) { p.earned = {}; p.basePoints = p.points || 0; lastPoints[p.id] = p.points || 0; }
    const delta = (p.points || 0) - (lastPoints[p.id] ?? (p.points || 0));
    if (delta > 0) p.earned[state.device] = (p.earned[state.device] || 0) + delta;
    p.points = (p.basePoints || 0) + sumVals(p.earned); lastPoints[p.id] = p.points;
    const j = pjson(p);
    if (snapshot[p.id] !== j) { p.updated = Date.now(); p.dirty = true; snapshot[p.id] = pjson(p); }
  });
}
function scheduleSync(delay = 1500) {
  if (!SYNC_URL || !state.sync.code) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(doSync, delay);
}

async function syncCall(body) {
  const r = await fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: state.sync.code, ...body }), cache: 'no-store' });
  const j = await r.json().catch(() => ({ error: 'Server error' }));
  if (!r.ok) throw new Error(j.error || 'Sync failed');
  return j;
}

// Merge two copies of the same player without losing progress from either device.
function mergePlayer(a, b) {
  const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
  const m = JSON.parse(JSON.stringify(newer));
  const maxMap = (x = {}, y = {}) => { const o = { ...x }; for (const k in y) o[k] = Math.max(o[k] || 0, y[k] || 0); return o; };
  m.earned = maxMap(a.earned, b.earned);
  m.basePoints = Math.max(a.basePoints || 0, b.basePoints || 0);
  m.points = (a.earned || b.earned) ? m.basePoints + sumVals(m.earned) : Math.max(a.points || 0, b.points || 0);
  m.found = maxMap(a.found, b.found);
  m.mistakes = maxMap(a.mistakes, b.mistakes);
  m.typeMiss = maxMap(a.typeMiss, b.typeMiss);
  m.passages = maxMap(a.passages, b.passages);
  m.typeHigh = Math.max(a.typeHigh || 0, b.typeHigh || 0);
  const la = a.lastDay || '', lb = b.lastDay || '';
  if (la !== lb) { const w = la > lb ? a : b; m.lastDay = w.lastDay; m.streak = w.streak; }
  else m.streak = Math.max(a.streak || 0, b.streak || 0);
  m.stats = { ...(a.stats || {}) };
  for (const [k, s] of Object.entries(b.stats || {})) {
    const t = m.stats[k];
    if (!t || (s.r + s.w) > (t.r + t.w)) m.stats[k] = s;
  }
  m.missions = { ...(a.missions || {}) };
  for (const [k, s] of Object.entries(b.missions || {})) if (!m.missions[k] || s.plays > m.missions[k].plays) m.missions[k] = s;
  const uniq = (list, key) => { const seen = new Set(); return list.filter(x => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; }); };
  m.journal = uniq([...(a.journal || []), ...(b.journal || [])], e => e.date + '|' + e.text).sort((x, y) => (y.ts || 0) - (x.ts || 0) || (y.date > x.date ? 1 : -1)).slice(0, 200);
  m.typing = {};
  for (const id of new Set([...Object.keys(a.typing || {}), ...Object.keys(b.typing || {})])) {
    m.typing[id] = uniq([...((a.typing || {})[id] || []), ...((b.typing || {})[id] || [])], r => JSON.stringify(r)).slice(-30);
  }
  delete m.dirty;
  return m;
}

async function doSync() {
  if (!SYNC_URL || !state.sync.code || syncing) return;
  if (!navigator.onLine) { lastSyncError = 'offline'; return; }
  syncing = true;
  let changedView = false;
  try {
    markChanged();
    const pulled = await syncCall({ action: 'pull', since: state.sync.last || 0 });
    for (const r of pulled.players) {
      const i = state.profiles.findIndex(p => p.id === r.id), local = state.profiles[i];
      if (r.deleted) {
        if (local && (local.updated || 0) <= r.updated) { state.profiles.splice(i, 1); delete snapshot[r.id]; changedView = true; }
        continue;
      }
      const remote = { ...r.data, updated: r.updated };
      if (!local) { state.profiles.push(remote); snapshot[r.id] = pjson(remote); lastPoints[r.id] = remote.points || 0; changedView = true; continue; }
      const merged = mergePlayer(local, remote);
      if (pjson(merged) !== pjson(remote)) { merged.updated = Date.now(); merged.dirty = true; } else merged.updated = r.updated;
      if (pjson(merged) !== pjson(local)) changedView = true;
      state.profiles[i] = merged; snapshot[r.id] = pjson(merged); lastPoints[r.id] = merged.points || 0;
    }
    const dirty = state.profiles.filter(p => p.dirty || !p.updated);
    const push = [
      ...dirty.map(p => { if (!p.updated) p.updated = Date.now(); const d = { ...p }; delete d.dirty; return { id: p.id, updated: p.updated, data: d }; }),
      ...state.sync.tombs.map(t => ({ id: t.id, updated: t.updated, deleted: true })),
    ];
    for (let i = 0; i < push.length; i += 20) await syncCall({ action: 'push', players: push.slice(i, i + 20) });
    dirty.forEach(p => { delete p.dirty; snapshot[p.id] = pjson(p); });
    state.sync.tombs = [];
    state.sync.last = pulled.now - 5000;        // small overlap so nothing slips between devices
    state.sync.ok = Date.now(); lastSyncError = '';
    if (state.current && !me()) state.current = null;
    writeStore();
    if (changedView && !game && (screen === 'profiles' || screen === 'home')) (screen === 'home' && me() ? showHome : showProfiles)();
  } catch (e) {
    lastSyncError = e.message || 'Sync failed';
  } finally { syncing = false; }
}

if (SYNC_URL) {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') doSync(); });
  window.addEventListener('online', () => doSync());
  setInterval(() => { if (document.visibilityState === 'visible') doSync(); }, 60000);
}

function syncCardHtml() {
  if (!SYNC_URL) return '';
  if (state.sync.code) {
    const when = state.sync.ok ? new Date(state.sync.ok).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'not yet';
    return `<div class="card stack"><h2>☁️ Family sync is on</h2>
      <p style="margin:0">This device shares progress with your family's other devices.<br><span class="muted">Last synced: ${when}${lastSyncError ? ` · ⚠️ ${esc(lastSyncError === 'offline' ? 'offline, will sync later' : lastSyncError)}` : ''}</span></p>
      <div class="row-actions" style="justify-content:flex-start"><button class="btn small" id="syncNow">Sync now</button><button class="btn ghost small" id="syncOff">Disconnect this device</button></div></div>`;
  }
  return `<div class="card stack"><h2>☁️ Turn on family sync</h2>
    <p style="margin:0" class="muted">Enter your family code once on each device. Then players and progress are the same everywhere.</p>
    <input class="text" id="famcode" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Family code">
    <div class="row-actions" style="justify-content:flex-start"><button class="btn small" id="syncOn">Connect</button></div></div>`;
}
function bindSyncCard(rerender) {
  const on = document.getElementById('syncOn'), now = document.getElementById('syncNow'), off = document.getElementById('syncOff');
  if (on) on.onclick = async () => {
    const code = document.getElementById('famcode').value.trim(); if (!code) return;
    const prev = state.sync.code; state.sync.code = code;
    try { await syncCall({ action: 'check' }); state.sync.last = 0; writeStore(); toast('Connected! Syncing…'); await doSync(); rerender(); }
    catch (e) { state.sync.code = prev; writeStore(); toast(e.message); }
  };
  if (now) now.onclick = async () => { await doSync(); toast(lastSyncError ? '⚠️ ' + lastSyncError : 'Synced ✓'); rerender(); };
  if (off) off.onclick = () => {
    if (!confirm('Disconnect this device from family sync? Progress on this device stays here.')) return;
    state.sync = { code: '', last: 0, tombs: [], ok: 0 }; writeStore(); rerender();
  };
}

/* ---------- boot ---------- */
if (me()) showHome(); else showProfiles();
if (SYNC_URL && state.sync.code) doSync();
})();
