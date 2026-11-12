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
const GRADES = [2, 3, 4, 5];
const gradeName = g => ({ 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }[g] || g + 'th');
const levelOf = (p, subject) => (p.levels && p.levels[subject]) || p.grade;
// a view of the player at their level for one subject (reads/writes still go to the real player)
const atLevel = (p, subject) => { const v = Object.create(p); Object.defineProperty(v, 'grade', { value: levelOf(p, subject) }); return v; };
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
  place(p) {
    const type = pick(['blocks', 'digit', 'expanded', 'more']);
    const small = p.grade <= 2 && Math.random() < .6;   // 2nd grade: mostly tens & ones
    const n = small ? rand(11, 99) : rand(101, p.grade <= 2 ? 499 : 989);
    const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
    if (type === 'blocks') {
      return { key: 'pv-blocks', answer: n, wordy: true,
        prompt: `What number do these blocks show?<div style="margin:14px 0">${blocksHtml(n)}</div><span class="answer-box" id="ans"></span>`,
        hint: r => `${pvChart(n)}<p class="explain">${h ? h + ' hundreds + ' : ''}${t} tens + ${o} ones = <b>${r ? n : '?'}</b><br><span class="muted">Big squares = 100, sticks = 10, little cubes = 1</span></p>` };
    }
    if (type === 'digit') {
      const place = pick(small ? ['tens', 'ones'] : ['hundreds', 'tens', 'ones']);
      const ans = place === 'hundreds' ? h : place === 'tens' ? t : o;
      return { key: 'pv-digit', answer: ans, wordy: true,
        prompt: `In <b>${n}</b>, which digit is in the <b>${place}</b> place?<br><span class="answer-box" id="ans"></span>`,
        hint: r => `${pvChart(n, place)}<p class="explain">Look at the highlighted box!${r ? ` The ${place} digit is <b>${ans}</b>` : ''}</p>` };
    }
    if (type === 'expanded') {
      return { key: 'pv-expanded', answer: n, wordy: true,
        prompt: `${h ? h * 100 + ' + ' : ''}${t * 10} + ${o} = <span class="answer-box" id="ans"></span>`,
        hint: r => `${blocksHtml(n)}<p class="explain">${h ? h + ' hundreds, ' : ''}${t} tens, ${o} ones makes <b>${r ? n : '?'}</b></p>` };
    }
    const step = small ? 10 : pick([10, 100]), dir = pick([1, -1]);
    const base = small ? rand(20, 89) : step === 100 ? rand(150, p.grade <= 2 ? 399 : 850) : rand(110, p.grade <= 2 ? 480 : 880);
    const ans = base + step * dir;
    return { key: `pv-${step}${dir > 0 ? 'more' : 'less'}`, answer: ans, wordy: true,
      prompt: `What is <b>${step} ${dir > 0 ? 'more' : 'less'}</b> than <b>${base}</b>?<br><span class="answer-box" id="ans"></span>`,
      hint: r => `<p class="explain">Only the <b>${step === 10 ? 'tens' : 'hundreds'}</b> digit changes!<br>${base} → <b>${r ? ans : '?'}</b></p>` };
  },
  twodigit(p) {
    const add = Math.random() < .5;
    const easy = p.grade <= 2 && Math.random() < .75;   // 2nd grade: mostly no carrying or borrowing
    let a, b;
    for (;;) {
      if (add) { a = rand(11, 79); b = rand(10, Math.min(89, 100 - a)); }
      else { a = rand(25, 99); b = rand(10, a - 5); }
      if (!easy || (add ? (a % 10) + (b % 10) < 10 : (a % 10) >= (b % 10))) break;
    }
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
  if (p.grade >= 4) return ['groups', 'share', 'buy', 'twostep', 'twostep', 'times', 'times', 'money'];
  return p.grade >= 3
    ? ['join', 'separate', 'compare', 'money', 'groups', 'share', 'buy', 'twostep', 'twostep']
    : ['join', 'separate', 'compare', 'missing', 'money'];
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
      const h = rand(1, p.grade <= 2 ? 4 : 9), t = rand(0, 9), o = rand(1, 9), n = h * 100 + t * 10 + o;
      text = `There ${h === 1 ? 'is' : 'are'} ${h} big ${h === 1 ? 'box' : 'boxes'} with 100 ${it[1]} each, ${t} ${t === 1 ? 'bag' : 'bags'} with 10 ${it[1]} each, and ${o} loose ${o === 1 ? it[0] : it[1]}. How many ${it[1]} are there in all?`;
      clue = 'Boxes of 100 are <b>hundreds</b>, bags of 10 are <b>tens</b>, loose ones are <b>ones</b>.';
      return storyQ('wp-pvbundle', text, n, false, r => `<p class="explain">${clue}</p>${pvChart(n)}<p class="explain">${h} hundreds + ${t} tens + ${o} ones = <b>${r ? n : '?'}</b></p>`);
    }
    case 'times': {
      const base = rand(3, p.grade >= 5 ? 25 : 12), k = rand(2, p.grade >= 5 ? 12 : 9);
      a = base; b = k; op = '×';
      text = `${B} found ${pl(base, it)}. ${N} found ${k} times as many. How many ${it[1]} did ${N} find?`;
      clue = '“Times as many” means <b>multiply</b>.';
      break;
    }
    case 'groups':
      if (p.grade >= 4) { a = rand(3, 9); b = rand(12, p.grade >= 5 ? 250 : 99); } else { a = rand(2, 10); b = rand(2, 10); }
      op = '×';
      text = `${N} has ${pl(a, gr)}. Each ${gr[0]} has ${pl(b, it)}. How many ${it[1]} are there in all?`;
      clue = 'Equal groups means <b>multiply</b>: groups × how many in each.';
      break;
    case 'share': {
      const groups = rand(2, 10), each = p.grade >= 4 ? rand(11, 60) : rand(2, 10);
      a = groups * each; op = '÷'; b = groups;
      text = `${N} has ${a} ${it[1]} and puts them into ${groups} ${gr[1]}, with the same number in each ${gr[0]}. How many ${it[1]} go in each ${gr[0]}?`;
      clue = 'Sharing equally means <b>divide</b>.';
      break;
    }
    case 'buy': {
      const price = p.grade >= 4 ? rand(4, 25) : rand(2, 10), qty = rand(2, p.grade >= 4 ? 15 : 10);
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
  compare(p) {
    if (p.grade <= 2 && Math.random() < .6) {   // 2nd grade: mostly 2-digit numbers
      const a = rand(12, 98), b = Math.random() < .15 ? a : pick([+(String(a)[1] + String(a)[0]), a + pick([-1, 1]) * rand(1, 9)]);
      const bb = b < 10 || b > 99 || (b === a && Math.random() < .5) ? a + 10 * (a < 90 ? 1 : -1) : b;
      const right = a < bb ? '<' : a > bb ? '>' : '=';
      return mcQ('mc-compare', `Which sign goes in the box?<div class="big-math">${a} <span class="slot">?</span> ${bb}</div>`,
        ['<', '>', '='].map(s => ({ label: s, correct: s === right, tag: s !== '=' && right !== '=' ? 'compare-flip' : null })),
        r => `<p class="explain">Compare the tens first, then the ones.<br><span class="muted">&lt; means “is less than” · &gt; means “is greater than”</span>${r ? `<br><b>${a} ${right} ${bb}</b>` : ''}</p>`);
    }
    const a = rand(102, p.grade <= 2 ? 499 : 987);
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
  oddeven(p) {
    const n = rand(p.grade <= 2 ? 2 : 11, p.grade <= 2 ? 30 : 999), even = n % 2 === 0;
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
    : ['matchop', 'matchop', 'compare', 'compare', 'sign', 'sign', 'oddeven'];
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
  // spelling words are only used when we have a real person's recording of them
  const usable = m.questions.filter(q => q.type !== 'spell' || (window.SPELL_AUDIO && SPELL_AUDIO[q.word]));
  const qs = usable.filter(q => forGrade(q, p)); return qs.length >= 5 ? qs : usable;
}
function bankQuestionIds(m, p) {
  return m.passages ? bankItems(m, p).flatMap(ps => ps.questions.map(q => q.id)) : bankItems(m, p).map(q => q.id);
}
// Mastered = answered right on the first try twice in a row
function bankProgress(p, mid) {
  p = atLevel(p, BANK[mid].subject);
  const ids = bankQuestionIds(BANK[mid].mission, p);
  return ids.reduce((a, id) => a + Math.min(2, (p.stats['q:' + id] || {}).box || 0), 0) / (2 * ids.length);
}

function buildBankQueue(m, p) {
  if (m.passages) {
    const seen = p.passages;
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

/* =========================================================
   Math for 4th and 5th grade (generated, like the 2nd-3rd missions)
   ========================================================= */
const MISSIONS45 = [
  { id: 'muldiv',    grade: 4, desc: 'Times & divide facts review' },
  { id: 'multi',     grade: 4, desc: 'Multi-digit multiplication' },
  { id: 'longdiv',   grade: 4, desc: 'Long division' },
  { id: 'fractions', grade: 4, desc: 'Fractions' },
  { id: 'decimals',  grade: 4, desc: 'Decimals' },
  { id: 'measure',   grade: 4, desc: 'Area, perimeter & volume' },
  { id: 'story',     grade: 4, desc: 'Word problems' },
];
const fracHtml = (n, d) => `<span class="frac"><span>${n}</span><span>${d}</span></span>`;
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const simp = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const fracLabel = (n, d) => d === 1 ? String(n) : `${n}/${d}`;
const vert = (top, op, bottom) => `<span class="vertical big-math"><span>${top}</span><span>${op} ${bottom}</span><span class="line"></span><span class="answer-box" id="ans"></span></span>`;
Object.assign(MISTAKES, {
  'frac-add-both':   ['Added the bottom numbers', 'Only the top numbers get added when the bottoms match. The bottom number tells the size of the pieces!'],
  'frac-big-bottom': ['Thought a bigger bottom number is bigger', 'A bigger bottom number means MORE pieces, so each piece is SMALLER.'],
  'frac-no-common':  ['Added without a common denominator', 'Make the bottom numbers the same first, then add the tops.'],
  'dec-longer':      ['Thought more digits means bigger', 'Compare tenths first, then hundredths. 0.5 is the same as 0.50, which is more than 0.45!'],
  'dec-place':       ['Moved the decimal the wrong way', 'Multiplying by 10 makes a number BIGGER: every digit moves one place to the left.'],
  'area-perim':      ['Mixed up area and perimeter', 'Perimeter goes AROUND the edge (add the sides). Area fills the INSIDE (length × width).'],
});

Object.assign(GENERATORS, {
  multi(p) {
    const g = p.grade, kind = pick(g >= 5 ? ['3x2', '3x2', '4x1', '2x2'] : ['2x1', '3x1', '3x1', '4x1', '2x2']);
    const [da, db] = kind.split('x').map(Number);
    // no numbers ending in 0, so the step-by-step hint always has more than one step
    const noZero = (lo, hi) => { let x; do { x = rand(lo, hi); } while (x % 10 === 0); return x; };
    const a = noZero(10 ** (da - 1) + 1, 10 ** da - 1), b = db === 1 ? rand(3, 9) : noZero(11, db === 2 ? 49 : 99);
    const ans = a * b;
    return {
      key: 'mul-' + kind, answer: ans, wordy: false,
      prompt: vert(a, '×', b),
      hint: r => {
        if (db === 1) {   // break the big number into place values
          const parts = String(a).split('').map((d, i, s) => +d * 10 ** (s.length - 1 - i)).filter(Boolean);
          return `<p class="explain">Break ${a} into ${parts.join(' + ')}<br>${parts.map(x => `${x} × ${b} = ${x * b}`).join('<br>')}<br>Add them up: <b>${r ? ans : '?'}</b></p>`;
        }
        const bt = b - b % 10, bo = b % 10;
        return `<p class="explain">Split ${b} into ${bt} + ${bo}<br>${a} × ${bt} = ${a * bt}<br>${a} × ${bo} = ${a * bo}<br>${a * bt} + ${a * bo} = <b>${r ? ans : '?'}</b></p>`;
      },
    };
  },
  longdiv(p) {
    const g = p.grade, kind = pick(g >= 5 ? ['2digit', '2digit', 'exact', 'rem'] : ['exact', 'exact', 'rem']);
    let b, q, rem = 0;
    if (kind === '2digit') { b = rand(12, 25); q = rand(12, 60); }
    else { b = rand(3, 9); q = rand(g >= 5 ? 105 : 21, g >= 5 ? 999 : 299); if (kind === 'rem') rem = rand(1, b - 1); }
    const a = b * q + rem;
    const askRem = kind === 'rem' && Math.random() < .5;
    const ans = askRem ? rem : q;
    const est = Math.floor(q / 10) * 10;
    return {
      key: 'div-' + kind, answer: ans, wordy: true,
      prompt: `${askRem ? `What is the <b>remainder</b>?` : kind === 'rem' ? 'What is the quotient? <span class="muted">(ignore the remainder)</span>' : ''}
        <div class="big-math">${a} ÷ ${b} = <span class="answer-box" id="ans"></span></div>`,
      hint: r => `<p class="explain">Think: how many groups of ${b} fit in ${a}?<br>${b} × ${est} = ${b * est}, and ${a} − ${b * est} = ${a - b * est} is left.<br>How many more ${b}s fit in ${a - b * est}?
        ${r ? `<br>${a} ÷ ${b} = <b>${q}</b>${rem ? ` remainder <b>${rem}</b>` : ''}` : ''}</p>`,
    };
  },
  fractions(p) {
    const g = p.grade;
    const kinds = g >= 5 ? ['addUnlike', 'addUnlike', 'mulWhole', 'mulFrac', 'compare', 'simplify'] : ['equiv', 'compare', 'compare', 'addSame', 'subSame', 'mixed'];
    const kind = weightedPick(p, kinds, k => 'frac-' + k);
    const den = pick([3, 4, 5, 6, 8, 10, 12]);
    const C = (label, correct, tag) => ({ label, correct, tag, html: label.includes('/') ? fracHtml(...label.split('/')) : null });
    if (kind === 'equiv') {
      const [n, d] = simp(rand(1, den - 1), den), k = rand(2, 4);
      return mcQ('frac-equiv', `Which fraction is equal to ${fracHtml(n, d)}?`, [
        C(`${n * k}/${d * k}`, true), C(`${n + k}/${d + k}`), C(`${n * k}/${d}`), C(`${n}/${d * k}`)],
        r => `<p class="explain">Multiply the top AND bottom by the same number.${r ? `<br>${fracHtml(n, d)} × ${fracHtml(k, k)} = ${fracHtml(n * k, d * k)}` : ''}</p>`);
    }
    if (kind === 'compare') {
      const sameTop = Math.random() < .5;
      let a1, b1, a2, b2;
      if (sameTop) { a1 = a2 = rand(1, 3); b1 = rand(a1 + 1, 6); do { b2 = rand(a2 + 1, 12); } while (b2 === b1); }
      else { b1 = pick([4, 6, 8]); b2 = pick([3, 5, 10]); a1 = rand(1, b1 - 1); a2 = rand(1, b2 - 1); if (a1 / b1 === a2 / b2) a1 = Math.max(1, a1 - 1); }
      const bigger = a1 / b1 > a2 / b2 ? `${a1}/${b1}` : `${a2}/${b2}`, smaller = bigger === `${a1}/${b1}` ? `${a2}/${b2}` : `${a1}/${b1}`;
      return mcQ('frac-compare', `Which fraction is <b>greater</b>?`, [C(bigger, true), C(smaller, false, sameTop ? 'frac-big-bottom' : null)],
        r => `<p class="explain">${sameTop ? 'Same top number? Then the one with SMALLER pieces (bigger bottom) is less.' : 'Compare each to ½, or make the bottoms the same.'}${r ? `<br><b>${bigger.replace('/', '⁄')}</b> is greater` : ''}</p>`);
    }
    if (kind === 'addSame' || kind === 'subSame') {
      const add = kind === 'addSame';
      let x = rand(1, den - 1), y = rand(1, den - 1);
      if (add && x + y > den) y = den - x; if (!add && y > x) [x, y] = [y, x]; if (!add && x === y) x = Math.min(den - 1, x + 1);
      const n = add ? x + y : x - y;
      return mcQ('frac-' + kind, `${fracHtml(x, den)} ${add ? '+' : '−'} ${fracHtml(y, den)} = ?`, [
        C(`${n}/${den}`, true), add ? C(`${n}/${den * 2}`, false, 'frac-add-both') : C(`${n}/${den * 2}`), C(`${add ? x * y : x + y}/${den}`), C(`${n + 1}/${den}`)],
        r => `<p class="explain">The pieces are the same size (${den}ths), so just ${add ? 'add' : 'subtract'} the top numbers.${r ? `<br>${x} ${add ? '+' : '−'} ${y} = ${n}, so <b>${n}/${den}</b>` : ''}</p>`);
    }
    if (kind === 'mixed') {
      const whole = rand(1, 3), d = pick([2, 3, 4, 5]), n = rand(1, d - 1), imp = whole * d + n;
      return mcQ('frac-mixed', `Which is the same as ${whole}${fracHtml(n, d)}?`, [C(`${imp}/${d}`, true), C(`${whole + n}/${d}`), C(`${whole * n}/${d}`), C(`${imp}/${d + whole}`)],
        r => `<p class="explain">Each whole is ${d} pieces: ${whole} × ${d} = ${whole * d} pieces, plus ${n} more.${r ? `<br>${whole * d} + ${n} = ${imp}, so <b>${imp}/${d}</b>` : ''}</p>`);
    }
    if (kind === 'addUnlike') {
      const d1 = pick([2, 3, 4, 5]), d2 = pick([3, 4, 6, 8, 10].filter(x => x !== d1)), n1 = rand(1, d1 - 1), n2 = rand(1, d2 - 1);
      const L = d1 * d2 / gcd(d1, d2), N = n1 * L / d1 + n2 * L / d2, [sn, sd] = simp(N, L);
      return mcQ('frac-addUnlike', `${fracHtml(n1, d1)} + ${fracHtml(n2, d2)} = ?`, [
        C(fracLabel(sn, sd), true), C(`${n1 + n2}/${d1 + d2}`, false, 'frac-no-common'), C(`${n1 + n2}/${L}`), C(fracLabel(...simp(N + 1, L)))],
        r => `<p class="explain">Make the bottoms match: both can become <b>${L}ths</b>.<br>${fracHtml(n1, d1)} = ${fracHtml(n1 * L / d1, L)} and ${fracHtml(n2, d2)} = ${fracHtml(n2 * L / d2, L)}${r ? `<br>Add the tops: ${fracHtml(N, L)}${sd !== L ? ` = ${fracHtml(sn, sd)}` : ''}` : ''}</p>`);
    }
    if (kind === 'mulWhole') {
      const w = rand(2, 6), d = pick([3, 4, 5, 6, 8]), n = rand(1, d - 1), [sn, sd] = simp(w * n, d);
      return mcQ('frac-mulWhole', `${w} × ${fracHtml(n, d)} = ?`, [C(fracLabel(sn, sd), true), C(`${w * n}/${w * d}`), C(`${n}/${w * d}`), C(fracLabel(...simp(w + n, d)))],
        r => `<p class="explain">${w} groups of ${fracHtml(n, d)}: multiply the top by ${w}.${r ? `<br>${w} × ${n} = ${w * n}, so ${fracHtml(w * n, d)}${sd !== d ? ` = ${fracHtml(sn, sd)}` : ''}` : ''}</p>`);
    }
    if (kind === 'mulFrac') {
      const d1 = pick([2, 3, 4, 5]), d2 = pick([2, 3, 4, 5, 6]), n1 = rand(1, d1 - 1), n2 = rand(1, d2 - 1), [sn, sd] = simp(n1 * n2, d1 * d2);
      return mcQ('frac-mulFrac', `${fracHtml(n1, d1)} × ${fracHtml(n2, d2)} = ?`, [C(fracLabel(sn, sd), true), C(`${n1 + n2}/${d1 + d2}`), C(fracLabel(...simp(n1 * d2, d1 * n2))), C(`${n1 * n2}/${d1 + d2}`)],
        r => `<p class="explain">Multiply top × top and bottom × bottom.${r ? `<br>${n1}×${n2} = ${n1 * n2}, ${d1}×${d2} = ${d1 * d2} → ${fracHtml(n1 * n2, d1 * d2)}${sd !== d1 * d2 ? ` = ${fracHtml(sn, sd)}` : ''}` : ''}</p>`);
    }
    // simplify
    const bd0 = rand(3, 9), [bn, bd] = simp(rand(1, bd0 - 1), bd0), k = rand(2, 5), n = bn * k, d = bd * k;
    const ok = l => { const [x, y] = l.split('/').map(Number); return x > 0 && y > 1 && x < y; };
    return mcQ('frac-simplify', `Write ${fracHtml(n, d)} in <b>simplest form</b>.`, [C(`${bn}/${bd}`, true), ...[`${n}/${d}`, `${n - 1}/${d - k}`, `${bn}/${d}`, `${bn + 1}/${bd + 1}`].filter(ok).slice(0, 3).map(l => C(l))],
      r => `<p class="explain">Find the biggest number that divides both ${n} and ${d}.${r ? `<br>Divide both by ${gcd(n, d)}: <b>${fracLabel(bn, bd)}</b>` : ''}</p>`);
  },
  decimals(p) {
    const g = p.grade;
    const kinds = g >= 5 ? ['addDec', 'subDec', 'times10', 'roundDec', 'compareDec'] : ['toDec', 'compareDec', 'compareDec', 'fracToDec', 'addDec'];
    const kind = weightedPick(p, kinds, k => 'dec-' + k);
    const num = (q) => ({ ...q, decimal: true, wordy: false });
    if (kind === 'toDec') {
      const h = rand(1, 99), d = h % 10 === 0 ? 10 : 100, n = d === 10 ? h / 10 : h, val = n / d;
      return num({ key: 'dec-toDec', answer: val, prompt: `<div class="big-math">${fracHtml(n, d)} = <span class="answer-box" id="ans"></span></div>`,
        hint: r => `<p class="explain">${d === 10 ? 'Tenths' : 'Hundredths'} go ${d === 10 ? 'one place' : 'two places'} after the decimal point.${r ? `<br><b>${val}</b>` : `<br>${d === 100 && n < 10 ? 'Remember a 0 in the tenths place!' : ''}`}</p>` });
    }
    if (kind === 'fracToDec') {
      const pairs = [[1, 2, .5], [1, 4, .25], [3, 4, .75], [1, 5, .2], [2, 5, .4], [3, 5, .6], [4, 5, .8], [1, 10, .1]], [n, d, v] = pick(pairs);
      return num({ key: 'dec-fracToDec', answer: v, prompt: `<div class="big-math">${fracHtml(n, d)} = <span class="answer-box" id="ans"></span></div><p class="muted">Write it as a decimal.</p>`,
        hint: r => `<p class="explain">Make the bottom 10 or 100: ${fracHtml(n, d)} = ${fracHtml(n * (100 / d), 100)}${r ? ` = <b>${v}</b>` : ''}</p>` });
    }
    if (kind === 'compareDec') {
      const a = rand(1, 9) / 10, b = Math.round((a - rand(1, 9) / 100) * 100) / 100;
      const [x, y] = Math.random() < .5 ? [a, b] : [b, a];
      return mcQ('dec-compareDec', `Which decimal is <b>greater</b>?`, [{ label: String(Math.max(x, y)), correct: true }, { label: String(Math.min(x, y)), tag: 'dec-longer' }],
        r => `<p class="explain">Line up the decimal points and compare the tenths first.<br>${a.toFixed(2)} vs ${b.toFixed(2)}${r ? `<br><b>${Math.max(a, b)}</b> is greater` : ''}</p>`);
    }
    if (kind === 'addDec' || kind === 'subDec') {
      const add = kind === 'addDec', big = g >= 5;
      let a = rand(big ? 110 : 11, big ? 999 : 99) / (big ? 100 : 10), b = rand(big ? 11 : 1, big ? 499 : 49) / (big ? 100 : 10);
      if (!add && b > a) [a, b] = [b, a];
      const ans = Math.round((add ? a + b : a - b) * 100) / 100, places = big ? 2 : 1;
      return num({ key: 'dec-' + kind, answer: ans, prompt: vert(a.toFixed(places), add ? '+' : '−', b.toFixed(places)),
        hint: r => `<p class="explain">Line up the decimal points, then ${add ? 'add' : 'subtract'} like whole numbers.${r ? `<br><b>${ans}</b>` : ''}</p>` });
    }
    if (kind === 'times10') {
      const m = pick([10, 100, 1000]), a = rand(11, 999) / 100, ans = Math.round(a * m * 1000) / 1000;
      return num({ key: 'dec-times10', answer: ans, prompt: `<div class="big-math">${a} × ${m} = <span class="answer-box" id="ans"></span></div>`,
        hint: r => `<p class="explain">× ${m} moves every digit <b>${String(m).length - 1} place${m > 10 ? 's' : ''} to the left</b> (the number gets bigger).${r ? `<br><b>${ans}</b>` : ''}</p>` });
    }
    // roundDec
    const a = rand(101, 999) / 100, toWhole = Math.random() < .4, ans = toWhole ? Math.round(a) : Math.round(a * 10) / 10;
    return num({ key: 'dec-roundDec', answer: ans, prompt: `<div class="big-math">Round <b>${a}</b> to the nearest ${toWhole ? 'whole number' : 'tenth'}: <span class="answer-box" id="ans"></span></div>`,
      hint: r => `<p class="explain">Look at the digit just to the right: 5 or more rounds up.${r ? `<br><b>${ans}</b>` : ''}</p>` });
  },
  measure(p) {
    const g = p.grade, kind = weightedPick(p, g >= 5 ? ['volume', 'volume', 'area', 'perimeter'] : ['area', 'perimeter', 'side'], k => 'meas-' + k);
    const L = rand(3, 12), W = rand(2, 9), unit = pick(['cm', 'm', 'in', 'ft']);
    const rect = (l, w, label = true) => `<div class="rect" style="--l:${l};--w:${w}"><span class="rl">${label ? l + ' ' + unit : '?'}</span><span class="rw">${w} ${unit}</span></div>`;
    if (kind === 'volume') {
      const H = rand(2, 6), ans = L * W * H;
      return { key: 'meas-volume', answer: ans, wordy: true,
        prompt: `<div class="prism">📦</div>A box is <b>${L} ${unit}</b> long, <b>${W} ${unit}</b> wide and <b>${H} ${unit}</b> tall. What is its <b>volume</b>?<br><span class="answer-box" id="ans"></span> cubic ${unit}`,
        hint: r => `<p class="explain">Volume = length × width × height<br>${L} × ${W} = ${L * W} (one layer), × ${H} layers = <b>${r ? ans : '?'}</b></p>` };
    }
    if (kind === 'side') {
      const area = L * W;
      return { key: 'meas-side', answer: L, wordy: true,
        prompt: `${rect(L, W, false)}This rectangle has an area of <b>${area} square ${unit}</b>. How long is the missing side?<br><span class="answer-box" id="ans"></span> ${unit}`,
        hint: r => `<p class="explain">Area = length × width, so ${W} × ? = ${area}${r ? `<br>${area} ÷ ${W} = <b>${L}</b>` : ''}</p>` };
    }
    const area = kind === 'area', ans = area ? L * W : 2 * (L + W);
    return { key: 'meas-' + kind, answer: ans, wordy: true,
      prompt: `${rect(L, W)}What is the <b>${area ? 'area' : 'perimeter'}</b> of this rectangle?<br><span class="answer-box" id="ans"></span> ${area ? 'square ' : ''}${unit}`,
      hint: r => `<p class="explain">${area ? `Area fills the inside: length × width<br>${L} × ${W} = <b>${r ? ans : '?'}</b>` : `Perimeter goes all the way around: add all 4 sides<br>${L} + ${W} + ${L} + ${W} = <b>${r ? ans : '?'}</b>`}</p>` };
  },
});

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

function render(html) {
  const hadFocus = $app.contains(document.activeElement) || document.activeElement === document.body;
  $app.innerHTML = html; window.scrollTo(0, 0);
  // keep keyboard players on the new screen instead of losing focus to <body>
  if (hadFocus) { $app.tabIndex = -1; $app.focus({ preventScroll: true }); }
}

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
    ${state.profiles.length ? '' : setupCardHtml()}
    <div class="profile-grid" style="margin-top:20px">
      ${state.profiles.map(p => `
        <button class="profile" data-id="${p.id}">
          <span class="av">${p.avatar}</span>${esc(p.name)}
          <small>${THEMES[p.theme].icon} ${THEMES[p.theme].name}</small>
        </button>`).join('')}
      <button class="profile add" id="add"><span class="av plus">+</span>New player</button>
    </div>
    ${state.profiles.length ? setupCardHtml() : ''}
    <div class="row-actions" style="margin-top:28px">
      <button class="btn ghost small" id="parents">👪 Grown-ups</button>
    </div>
    ${SYNC_URL && !state.sync.token ? '<p class="muted center" style="margin-top:12px">☁️ Grown-ups: sign in to your family to share progress between devices.</p>' : ''}
  `);
  bindAll('.profile[data-id]', el => { state.current = el.dataset.id; save(); showHome(); });
  document.getElementById('add').onclick = () => showEditProfile();
  document.getElementById('parents').onclick = () => showParentGate();
  bindSetupCard();
}

/* ----- Grown-ups: getting started ----- */
const isTouchDevice = () => navigator.maxTouchPoints > 1;
const isHomeScreenApp = () => navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
function setupSteps() {
  const locked = !!(state.grownPin || state.sync.token);
  const steps = [
    { id: 'lock', done: locked, title: 'Lock the grown-ups page',
      text: SYNC_URL ? 'Sign in to your family account, or make a PIN for this device. Kids then can\'t change grades or see the grown-ups page.'
        : 'Make a PIN for this device. Kids then can\'t change grades or see the grown-ups page.',
      action: locked ? '' : 'Set up the lock' },
    { id: 'players', done: state.profiles.length > 0, title: 'Add a player for each child',
      text: 'Tap "New player": each child picks a name, a world and her grade.', action: state.profiles.length ? '' : 'Add a player' },
    { id: 'levels', done: !!state.setupSeen, title: 'Check grades and levels (optional)',
      text: 'On the Grown-ups page, open a player\'s settings to set a different level for one subject, like 3rd grade but 4th grade math. Progress for each child shows there too.',
      action: state.setupSeen ? '' : 'Open Grown-ups' },
  ];
  if (isTouchDevice()) steps.push({ id: 'home', done: isHomeScreenApp(), title: 'On an iPad: add it to the Home Screen',
    text: 'In Safari tap Share, then "Add to Home Screen", and always play from that icon. It runs full screen, works offline, and keeps progress safe.', action: '' });
  if (SYNC_URL) steps.push({ id: 'sync', done: !!state.sync.token, title: 'Using more than one device? (optional)',
    text: 'Sign in to the same family account on each device and progress follows the kids everywhere.', action: state.sync.token ? '' : 'Sign in' });
  return steps;
}
function setupCardHtml() {
  if (state.setupHidden) return '';
  const steps = setupSteps();
  // the main setup is done: the kids' screen goes back to being theirs (the guide stays on the Grown-ups page)
  if (['lock', 'players', 'levels'].every(id => steps.find(st => st.id === id).done)) return '';
  const next = steps.find(st => !st.done && st.action);
  return `<section class="card setup" aria-labelledby="setupTitle">
    <div class="setup-head"><h2 id="setupTitle">👋 Grown-ups: getting started</h2>
      <button class="btn ghost small" id="setupHide">Hide</button></div>
    <p class="muted">A few minutes of setup, then the kids can play on their own.</p>
    <ol class="setup-steps">${steps.map((st, i) => `<li class="${st.done ? 'done' : ''}">
      <span class="setup-mark" aria-hidden="true">${st.done ? '✓' : i + 1}</span>
      <div><b>${st.title}</b>${st.done ? ' <span class="sr-only">(done)</span>' : ''}<p>${st.text}</p>
      ${st.action ? `<button class="btn small ${st === next ? '' : 'ghost'}" data-setup="${st.id}">${st.action}</button>` : ''}</div></li>`).join('')}</ol>
    <p class="muted setup-foot">You can find this again under 👪 Grown-ups → How it works.</p>
  </section>`;
}
function bindSetupCard() {
  const hide = document.getElementById('setupHide');
  if (hide) hide.onclick = () => { state.setupHidden = true; writeStore(); showProfiles(); };
  bindAll('[data-setup]', el => ({
    lock: () => showParentGate(showProfiles, showProfiles),
    players: () => showEditProfile(),
    levels: () => showParentGate(showParents, showProfiles),
    sync: () => showGateSignIn(showProfiles, showProfiles),
  })[el.dataset.setup]());
}
function howItWorksHtml() {
  return `<details class="card how" ${state.setupSeen ? '' : 'open'}><summary><b>📖 How it works</b></summary>
    <ul>
      <li><b>One player per child.</b> Each picks a world (just the look) and her grade. Change a grade or set a different level per subject from a player's settings (⚙️) while this page is unlocked.</li>
      <li><b>Start each day with Today's Quest.</b> 10 questions from every subject, mixing in things she missed. It keeps a daily streak.</li>
      <li><b>Or pick a subject and a mission</b> that matches this week's homework. "Try me!" marks the one she's practiced least.</li>
      <li><b>Missed questions come back</b> a few questions later and keep showing up until they stick. Hints help first; the answer shows after a second miss.</li>
      <li><b>Below, for each child:</b> accuracy and mastery per mission, "Needs practice" items, common math mistakes, typing keys, and her journal.</li>
      <li><b>Typing</b> works best with a real keyboard. <b>Spelling</b> plays real people saying each word.</li>
      ${SYNC_URL ? '<li><b>More than one device?</b> Sign in to your family account on each one (below). Progress syncs, and each device keeps working offline.</li>' : ''}
      <li><b>On an iPad,</b> add the app to the Home Screen (Share → Add to Home Screen) and always play from that icon.</li>
    </ul>
    ${state.setupHidden ? '<button class="btn ghost small" id="showSetup">Show the getting-started list again</button>' : ''}
  </details>`;
}


/* ----- Create / edit player ----- */
function showEditProfile(existing, after) {
  const d = existing || { name: '', avatar: null, grade: 2, theme: 'space' };
  let sel = { name: d.name, avatar: d.avatar, grade: d.grade, theme: d.theme, levels: { ...(d.levels || {}) } };
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
        ${existing && !grownupUnlocked() ? `<div>
          <span class="lbl">Grade</span>
          <p style="margin:0">${gradeName(sel.grade)} grade${Object.keys(sel.levels).length ? ' <span class="muted">(some subjects at a different level)</span>' : ''}
            <button class="btn ghost small" id="unlockGrade" type="button">🔒 Change (grown-ups)</button></p>
        </div>` : `<div>
          <span class="lbl">What grade are you in?</span>
          <div class="pick-row">
            ${GRADES.map(g => `<button class="pick" data-grade="${g}" aria-pressed="${g === sel.grade}">${gradeName(g)} grade</button>`).join('')}
          </div>
        </div>`}
        ${grownupUnlocked() ? `<details class="levels" ${Object.keys(sel.levels).length ? 'open' : ''}>
          <summary>Different level for some subjects?</summary>
          <div class="level-grid">${SUBJECT_ORDER.map(sid => `<label>${SUBJECTS[sid].icon} ${SUBJECTS[sid].name}
            <select data-level="${sid}"><option value="">Same as grade</option>${GRADES.map(g => `<option value="${g}" ${sel.levels[sid] === g ? 'selected' : ''}>${gradeName(g)} grade</option>`).join('')}</select></label>`).join('')}</div>
        </details>` : ''}
        <div class="row-actions" style="justify-content:flex-start">
          <button class="btn" id="saveP">${existing ? 'Save' : `Let's go! ${th.icon}`}</button>
          ${existing ? '<button class="btn ghost small" id="switch">Switch player</button>' : ''}
        </div>
        ${existing ? `<div class="row-actions" style="justify-content:flex-start">
          <button class="btn ghost small danger" id="delP" type="button">${grownupUnlocked() ? '🗑️ Delete this player' : '🔒 Delete this player (grown-ups)'}</button></div>` : ''}
      </div>
    `);
    const nm = document.getElementById('nm');
    nm.oninput = () => { sel.name = nm.value; };
    bindAll('[data-theme]', el => { sel.theme = el.dataset.theme; applyTheme(sel.theme); draw(); });
    bindAll('[data-av]', el => { sel.avatar = el.dataset.av; draw(); });
    bindAll('[data-grade]', el => { sel.grade = +el.dataset.grade; draw(); });
    const ug = document.getElementById('unlockGrade');
    if (ug) ug.onclick = () => { sel.name = nm.value; showParentGate(() => { applyTheme(sel.theme); draw(); }, () => { applyTheme(sel.theme); draw(); }); };
    $app.querySelectorAll('[data-level]').forEach(el => { el.onchange = () => { if (el.value) sel.levels[el.dataset.level] = +el.value; else delete sel.levels[el.dataset.level]; }; });
    document.getElementById('back').onclick = () => after ? after() : existing ? showHome() : showProfiles();
    if (existing) document.getElementById('switch').onclick = showProfiles;
    const dp = document.getElementById('delP');
    if (dp) dp.onclick = () => {
      const del = () => { if (deletePlayer(existing)) showProfiles(); else { applyTheme(sel.theme); draw(); } };
      if (grownupUnlocked()) return del();
      sel.name = nm.value;
      showParentGate(del, () => { applyTheme(sel.theme); draw(); });
    };
    document.getElementById('saveP').onclick = () => {
      const name = sel.name.trim();
      if (!name) { toast('Type your name first!'); nm.focus(); return; }
      const levels = Object.fromEntries(Object.entries(sel.levels).filter(([, g]) => g !== sel.grade));
      if (existing) Object.assign(existing, { name, avatar: sel.avatar, grade: sel.grade, theme: sel.theme, levels });
      else { const p = newProfile(name, sel.avatar, sel.grade, sel.theme); p.levels = levels; state.profiles.push(p); state.current = p.id; }
      save(); after ? after() : showHome();
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
  const lvl = levelOf(p, subj);
  const missions = subj === 'math'
    ? (lvl >= 4 ? MISSIONS45 : MISSIONS).filter(m => m.grade <= lvl).map(m => ({ id: m.id, icon: th.missions[m.id].icon, name: th.missions[m.id].name, desc: m.desc, grade: Math.min(m.grade, lvl) }))
    : subj === 'typing'
    ? TYPING_LESSONS.map(m => ({ id: m.id, icon: m.icon, name: m.game ? (BLASTER[p.theme] || BLASTER.space).name : m.name, desc: m.desc, grade: 2 }))
    : SUBJECTS[subj].missions.filter(m => (!m.grades || m.grades.includes(lvl)) && (!m.questions || m.questions.some(q => q.type !== 'spell' || (window.SPELL_AUDIO && SPELL_AUDIO[q.word])))).map(m => ({ id: m.id, icon: m.icon, name: esc(m.name), desc: esc(m.desc), grade: lvl }));
  // suggest the least-practiced mission for this grade
  const suggested = missions.filter(m => m.grade <= lvl).sort((a, b) => progress(p, a.id) - progress(p, b.id))[0];
  const found = p.found[p.theme] || 0;
  const streakOk = p.lastDay && dayDiff(p.lastDay, today()) <= 1;

  render(`
    <div class="topbar">
      <button class="btn ghost small" id="me">${p.avatar} ${esc(p.name)} ⚙️</button>
      <div class="chips">
        <span class="chip" title="${th.point}">${th.pointIcon} ${p.points}</span>
        <span class="chip" title="days in a row">🔥 ${streakOk ? p.streak : 0}</span>
        <button class="chip" id="snd" aria-label="Sound" aria-pressed="${state.sound}">${state.sound ? '🔊' : '🔇'}</button>
      </div>
    </div>
    <div class="stack">
      <div>
        <h1>${th.title}</h1>
        <p class="muted home-sub">${questDoneToday(p) ? `Nice work today, ${esc(p.name)}! Pick any mission to keep going.` : `Hi ${esc(p.name)}! Start with today's quest, or pick any mission.`}</p>
      </div>
      ${questCardHtml(p)}
      <div class="subject-tabs" role="tablist" aria-label="Subjects">
        ${SUBJECT_ORDER.map(s => `<button class="subject-tab" role="tab" data-s="${s}" aria-selected="${s === subj}"><span class="ti" aria-hidden="true">${SUBJECTS[s].icon}</span><span>${SUBJECTS[s].name}</span></button>`).join('')}
      </div>
      <div class="mission-grid">
        ${missions.map(m => {
          const tm = m, pct = showPct(progress(p, m.id));
          let label = POOLS[m.id] ? `${learnedCount(p, m.id)} facts learned · ${pct}%` : `${pct}% mastered`;
          if (subj === 'typing') { const b = m.id === 'type-game' ? null : bestLessonRun(p, m.id);
            label = m.id === 'type-game' ? (p.typeHigh ? `🏆 Your best: ${p.typeHigh.toLocaleString()}` : 'No high score yet') : b ? `⚡ Best: ${b.wpm} WPM` : 'Not played yet'; }
          return `<button class="mission" data-m="${m.id}">
            ${suggested && m.id === suggested.id ? '<span class="tag">Try me!</span>' : ''}
            <span class="icon">${tm.icon}</span>
            <span class="name">${tm.name}</span>
            <span class="desc">${m.desc}</span>
            <span class="mastery-label">${label}</span>
            <span class="mastery"><i style="width:${pct}%"></i></span>
          </button>`;
        }).join('')}
        ${subj === 'typing' ? `<button class="mission" id="scores">
            <span class="icon">🏆</span><span class="name">High Scores</span>
            <span class="desc">Family leaderboard & personal bests</span>
            <span class="mastery-label">${(() => { const t = familyBlasterScores()[0]; return t ? `Record: ${t.score.toLocaleString()} by ${esc(t.name)}` : 'No scores yet'; })()}</span></button>` : ''}
        ${subj === 'writing' && SUBJECTS.writing.journalPrompts ? `<button class="mission" id="journal">
            <span class="icon">📔</span><span class="name">My Journal</span>
            <span class="desc">Write about anything you like</span>
            <span class="mastery-label">${(p.journal || []).length} entries</span></button>` : ''}
      </div>
      <button class="card coll-card" id="coll">
        <span class="coll-head"><b>${th.collection}</b><span class="muted">${found} of ${th.collectibles.length} found</span></span>
        <span class="coll-row" aria-hidden="true">${th.collectibles.slice(Math.max(0, found - 7), found).map(c => `<span>${c[0]}</span>`).join('')}${found < th.collectibles.length ? '<span class="next">❔</span>' : ''}</span>
        <span class="mastery"><i style="width:${Math.round(found / th.collectibles.length * 100)}%"></i></span>
        <span class="muted coll-hint">${found < th.collectibles.length ? 'Every finished mission finds a new one.' : 'You found them all!'}</span>
      </button>
      <div class="home-foot">
        <button class="btn ghost small" id="switchP">🔄 Switch player</button>
        <button class="btn ghost small" id="grown">👪 Grown-ups</button>
      </div>
    </div>
  `);
  bindAll('[data-m]', el => startMission(el.dataset.m));
  document.getElementById('quest').onclick = startQuest;
  bindAll('[data-s]', el => { p.subject = el.dataset.s; save(); showHome(); });
  const j = document.getElementById('journal'); if (j) j.onclick = () => showJournal();
  const hs = document.getElementById('scores'); if (hs) hs.onclick = showHighScores;
  document.getElementById('me').onclick = () => showEditProfile(p);
  document.getElementById('coll').onclick = showCollection;
  document.getElementById('switchP').onclick = showProfiles;
  document.getElementById('grown').onclick = () => showParentGate(showParents, showHome);
  document.getElementById('snd').onclick = () => { state.sound = !state.sound; save(); showHome(); };
}

/* ----- Journal ----- */
function showJournal(promptIdx) {
  const p = me(), th = theme(p);
  const prompts = levelOf(p, 'writing') >= 4 && SUBJECTS.writing.journalPrompts45 ? SUBJECTS.writing.journalPrompts45 : SUBJECTS.writing.journalPrompts;
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

function subjectOf(missionId) { return BANK[missionId] ? BANK[missionId].subject : TYPE_BY_ID[missionId] ? 'typing' : 'math'; }
function beginMission(missionId) {
  const b = BANK[missionId], real = me();
  real.passages = real.passages || {};
  const p = atLevel(real, subjectOf(missionId));
  game = { missionId, subject: subjectOf(missionId), n: 0, firstTry: 0, recent: [], retry: [], q: null, input: '', tries: 0, locked: false,
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
  const p = atLevel(me(), game.subject);
  if (game.n >= game.len) return finishMission();
  let q;
  const due = game.retry.findIndex(r => r.at <= game.n);
  if (due >= 0) q = game.retry.splice(due, 1)[0].q;
  else if (game.quest) { const slot = game.slots[game.qi++]; q = slot.make(atLevel(me(), slot.subject), game); q.slot = slot; }
  else if (game.queue) q = bankQuestion(game.queue[game.qi++], p);
  else if (game.missionId === 'story' || (STORY_TYPES[game.missionId] && (game.n === 3 || game.n === 7))) {
    // word problems: every question in the Story mission, and 2 of 10 elsewhere
    const types = storyTypesFor(game.missionId, p);
    const type = weightedPick(p, types, t => 'wp-' + t);
    const big = game.missionId === 'twodigit' || (game.missionId === 'story' && (p.grade >= 3 || Math.random() < .15));
    // 4th-5th grade missions mix in their own kind of word problem (the Story mission uses all of them)
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
  const p = me(), th = theme(p), qs = game.q.slot;
  const tm = qs ? { icon: '⭐', name: qs.review ? '🔁 Practice again' : `${SUBJECTS[qs.subject].icon} ${SUBJECTS[qs.subject].name}` }
    : BANK[game.missionId] ? BANK[game.missionId].mission : th.missions[game.missionId];
  const pct = (game.n / game.len) * 100;
  const q = game.q;
  render(`
    <div class="play">
      <div class="topbar" style="margin:0">
        <button class="btn ghost small" id="quit" aria-label="Quit">✕</button>
        <span class="chip">${tm.icon} ${tm.name}</span>
        <span class="chip">${game.n + 1} / ${game.len}</span>
      </div>
      <div class="meter"><span>${th.meterIcon} ${th.meter}</span><span class="bar"><i id="bar" style="width:${pct}%"></i></span></div>
      <div class="card question ${game.q.wordy ? 'wordy' : ''}">${game.q.prompt}</div>
      ${q.spell ? `<div class="row-actions"><button class="btn" id="checkText">Check ✓</button></div>`
      : q.order ? `<div class="row-actions"><button class="btn" id="checkOrder" disabled>Check ✓</button></div>`
      : game.q.choices
        ? `<div class="choices ${game.q.choices.length === 2 ? 'two' : ''} ${game.q.choices.some(c => !c.html && String(c.label).length > 16) ? 'long' : ''}" id="pad">${game.q.choices.map((c, i) => `<button data-c="${i}">${c.html || esc(c.label)}</button>`).join('')}</div>`
        : `<div class="pad" id="pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        ${q.decimal ? `<button data-k=".">.</button><button data-k="0">0</button><button data-k="del" aria-label="Delete">⌫</button><button data-k="go" class="go wide" aria-label="Check answer">✓</button>`
          : `<button data-k="del" aria-label="Delete">⌫</button><button data-k="0">0</button><button data-k="go" class="go" aria-label="Check answer">✓</button>`}
      </div>`}
      <div class="feedback" id="fb" aria-live="polite"></div>
      <div class="hint" id="hint"></div>
    </div>
  `);
  updateAnswer();
  // passages show in full; on a follow-up question about the same story, start at the question
  const passageTitle = ($app.querySelector('.passage h3') || {}).textContent || null;
  if (passageTitle && passageTitle === drawPlay.lastPassage) $app.querySelector('.story').scrollIntoView({ block: 'center' });
  drawPlay.lastPassage = passageTitle;
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
  else if (k === '.') { if (game.q.decimal && !game.input.includes('.')) game.input = (game.input || '0') + '.'; }
  else if (game.input.length < (game.q.decimal ? 7 : 6)) game.input = (game.input === '0' ? '' : game.input) + k;
  const a = document.getElementById('ans'); if (a) a.className = 'answer-box';
  updateAnswer();
}

// bring a missed question back a few questions later (in the Daily Quest only once, so the mix stays mixed)
function pushRetry() {
  if (game.quest && game.q.retried) return;
  game.q.retried = true;
  game.retry.push({ q: game.q, at: game.n + 3 });
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
    pushRetry();
    fb.className = 'feedback bad'; fb.textContent = pick(th.oops);
    hint.innerHTML = why + game.q.hint(false);
  } else {
    if (game.tries === 1) { record(p, game.q.key, false); pushRetry(); }
    save();
    game.locked = true;
    $app.querySelectorAll('[data-c]').forEach((b, j) => { if (game.q.choices[j].correct) b.classList.add('good'); });
    fb.className = 'feedback'; fb.innerHTML = `The answer is <b>${esc(String(game.q.answer).replace(/[.!?]$/, ''))}</b>. You'll see this one again!`;
    hint.innerHTML = why + game.q.hint(true) + `<button class="btn" id="next" style="margin-top:14px">Next →</button>`;
    document.getElementById('next').onclick = () => { game.n++; nextQuestion(); };
  }
  revealHint();
}

// feedback sits below the pad/choices so nothing moves under a finger. Once the answer is shown
// the pad is done, so bring Next into view if it's below the fold (no scrolling while the pad is live).
function revealHint() {
  const next = document.getElementById('next');
  if (next) next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
    pushRetry();
    fb.className = 'feedback bad'; fb.textContent = pick(th.oops);
    hint.innerHTML = game.q.hint(false);
    if (ui.retry) ui.retry();
  } else {
    game.locked = true;
    fb.className = 'feedback'; fb.innerHTML = `The answer is <b>${esc(String(game.q.answer).replace(/[.!?]$/, ''))}</b>. You'll see this one again!`;
    if (ui.reveal) ui.reveal();
    hint.innerHTML = game.q.hint(true) + `<button class="btn" id="next" style="margin-top:14px">Next →</button>`;
    document.getElementById('next').onclick = () => { game.n++; nextQuestion(); };
  }
  revealHint();
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
  const correct = Math.abs(parseFloat(game.input) - game.q.answer) < 1e-9;
  game.tries++;
  if (correct) { ans.className = 'answer-box good'; return answeredRight(p, th); }
  sfx.bad();
  ans.className = 'answer-box bad';
  if (game.tries === 1) {
    record(p, game.q.key, false); save();
    // bring this one back a few questions later
    pushRetry();
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
  revealHint();
}

document.addEventListener('keydown', e => {
  if (!game || !document.getElementById('pad')) return;
  if (game.q.choices) {
    if (/^[1-4]$/.test(e.key)) choose(+e.key - 1);
    else if (e.key === 'Enter') { const n = document.getElementById('next'); if (n) n.click(); }
    return;
  }
  if (/^[0-9.]$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') press('del');
  else if (e.key === 'Enter') { const n = document.getElementById('next'); n ? n.click() : press('go'); }
});

function touchStreak(p) {
  const t = today();
  if (p.lastDay !== t) { p.streak = p.lastDay && dayDiff(p.lastDay, t) === 1 ? p.streak + 1 : 1; p.lastDay = t; }
}

function finishMission() {
  if (game.quest) return finishQuest();
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
    <div class="result stack card">
      <h1>${th.finish}</h1>
      ${prize ? `<div class="prize">${prize[0]}</div>
        <h2>${th.collectVerb}</h2><p style="font-size:1.4rem;margin:0">Meet <b>${esc(prize[1])}</b>! ${found + 1} of ${th.collectibles.length} in ${th.collection}.</p>`
        : `<div class="prize">🏆</div><h2>You found everything in ${th.collection}!</h2>`}
      <p class="score">You got <b>${right} of ${len}</b> right on the first try
        ${perfect ? '<br>🎯 <b>Perfect!</b> +5 bonus' : ''}<br>+${earned} ${th.point} ${th.pointIcon}</p>
      <div class="row-actions">
        <button class="btn" id="again">Play again</button>
        <button class="btn ghost" id="coll">${th.collection}</button>
        <button class="btn ghost" id="home">Home</button>
      </div>
    </div>
  `);
  document.getElementById('again').onclick = () => startMission(missionId);
  document.getElementById('coll').onclick = showCollection;
  document.getElementById('home').onclick = showHome;
}

/* =========================================================
   Daily Quest: one short mix a day. Questions she missed come
   back, the rest come from her least-practiced missions.
   ========================================================= */
const QUEST_LEN = 10, QUEST_BONUS = 10;
const QUEST_SUBJECTS = ['math', 'reading', 'math', 'writing', 'science', 'math', 'social', 'reading', 'writing', 'science'];

// missions that can lend single questions (story passages are too long for a mix)
function questMissions(p, subj) {
  const lvl = levelOf(p, subj);
  if (subj === 'math') return (lvl >= 4 ? MISSIONS45 : MISSIONS).filter(m => m.grade <= lvl).map(m => m.id);
  const v = atLevel(p, subj);
  return (SUBJECTS[subj].missions || []).filter(m => m.questions && (!m.grades || m.grades.includes(lvl)) && bankItems(m, v).length).map(m => m.id);
}

function mathMaker(mid) {
  return (p, g) => {
    if (mid === 'story') return makeStory(weightedPick(p, storyTypesFor('story', p), t => 'wp-' + t), p, p.grade >= 3);
    if (POOLS[mid]) return factQuestion(chooseFact(p, mid, g.recent));
    return GENERATORS[mid](p);
  };
}
function bankMaker(mid) {
  return (p, g) => {
    const items = bankItems(BANK[mid].mission, p).filter(q => !g.used.has(q.id));
    const q = weightedPick(p, items.length ? items : bankItems(BANK[mid].mission, p), x => 'q:' + x.id);
    g.used.add(q.id);
    return bankQuestion({ q }, p);
  };
}

// a question that brings back one thing she missed
function reviewSlot(k, subject) {
  const mid = missionOf(k), slot = make => ({ subject, mid, review: true, make });
  if (k.startsWith('q:')) {
    const hit = QINDEX[k.slice(2)];
    if (!hit || (hit.q.type === 'spell' && !(window.SPELL_AUDIO && SPELL_AUDIO[hit.q.word]))) return null;
    return slot((p, g) => { g.used.add(hit.q.id); return bankQuestion({ q: hit.q }, p); });
  }
  if (POOLS[mid] && POOLS[mid].includes(k)) return slot(() => factQuestion(k));
  if (k.startsWith('wp-')) return slot(p => makeStory(k.slice(3), p, p.grade >= 3));
  if (k.startsWith('mc-') && CHOICE_TYPES[k.slice(3)]) return slot(p => CHOICE_TYPES[k.slice(3)](p));
  if (GENERATORS[mid]) return slot(p => GENERATORS[mid](p));
  return null;
}

// skip missed questions that are no longer asked at her level (e.g. moved up to 3rd grade)
const CHOICE_ABOVE_2 = ['round', 'estimate', 'regroup'];
function reviewAtLevel(k, v) {
  if (k.startsWith('q:')) { const hit = QINDEX[k.slice(2)]; return !!hit && forGrade(hit.q, v); }
  if (v.grade <= 2 && k.startsWith('mc-')) return !CHOICE_ABOVE_2.includes(k.slice(3));
  return true;
}
function buildQuest(p) {
  const subjects = ['math', 'reading', 'writing', 'science', 'social'].filter(s => SUBJECTS[s]);
  const owner = {};   // mission id -> subject, only missions at her level
  subjects.forEach(s => questMissions(p, s).forEach(id => { owner[id] = s; }));
  // up to 4 things she missed and hasn't mastered yet, no more than 2 from one mission
  const perMission = {};
  const review = Object.entries(p.stats)
    .filter(([k, s]) => s.w > 0 && s.box < 3 && owner[missionOf(k)] && reviewAtLevel(k, atLevel(p, owner[missionOf(k)])))
    .sort((a, b) => (b[1].w - b[1].r * .5) - (a[1].w - a[1].r * .5))
    .filter(([k]) => { const m = missionOf(k); perMission[m] = (perMission[m] || 0) + 1; return perMission[m] <= 2; })
    .map(([k]) => reviewSlot(k, owner[missionOf(k)])).filter(Boolean).slice(0, 4);
  // the rest: her least-practiced missions, rotating through subjects
  const fresh = [], usedM = {};
  for (let i = 0; fresh.length < QUEST_LEN - review.length && i < 40; i++) {
    const subj = QUEST_SUBJECTS[i % QUEST_SUBJECTS.length];
    const ids = questMissions(p, subj).filter(id => (usedM[id] || 0) < 2);
    if (!ids.length) continue;
    const v = atLevel(p, subj);
    const low = ids.map(id => [id, progress(v, id) + Math.random() * .15]).sort((a, b) => a[1] - b[1]);
    const mid = low[0][0];
    usedM[mid] = (usedM[mid] || 0) + 1;
    fresh.push({ subject: subj, mid, make: subj === 'math' ? mathMaker(mid) : bankMaker(mid) });
  }
  // spread the review questions through the quest
  const out = fresh.slice();
  review.forEach((r, i) => out.splice(Math.min(out.length, 1 + i * 3), 0, r));
  return out.slice(0, QUEST_LEN);
}

const questDoneToday = p => (p.questLog || []).includes(today());
function questStreak(p) {
  const log = new Set(p.questLog || []);
  let n = 0, d = new Date();
  if (!log.has(today())) d.setDate(d.getDate() - 1);   // today isn't over yet
  while (log.has(d.toLocaleDateString('en-CA'))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const questsThisWeek = p => (p.questLog || []).filter(d => dayDiff(d, today()) < 7).length;

function questCardHtml(p) {
  const done = questDoneToday(p), streak = questStreak(p);
  return `<button class="card quest-card ${done ? 'done' : ''}" id="quest">
    <span class="quest-icon" aria-hidden="true">${done ? '✅' : '⭐'}</span>
    <span class="quest-text"><b>${done ? "Today's Quest is done!" : "Today's Quest"}</b>
      <span class="muted">${done ? 'Come back tomorrow for a new one. Tap to practice more.' : `${QUEST_LEN} questions from every subject · +${QUEST_BONUS} bonus`}</span></span>
    ${streak ? `<span class="chip quest-streak" title="quests in a row">⭐ ${streak} day${streak === 1 ? '' : 's'}</span>` : ''}
    ${done ? '' : '<span class="quest-go" aria-hidden="true">Go →</span>'}
  </button>`;
}

function startQuest() {
  const p = me(), slots = buildQuest(p);
  if (!slots.length) { toast('No quest questions for this grade yet.'); return; }
  game = { missionId: 'quest', quest: true, slots, used: new Set(), subject: slots[0].subject, n: 0, firstTry: 0, recent: [], retry: [],
    q: null, input: '', tries: 0, locked: false, queue: null, qi: 0, len: slots.length };
  nextQuestion();
}

function finishQuest() {
  const p = me(), th = theme(p), t = today();
  const first = !questDoneToday(p), right = game.firstTry, len = game.len, perfect = right === len;
  const earned = right + (perfect ? 5 : 0) + (first ? QUEST_BONUS : 0);
  p.points += earned;
  if (first) p.questLog = [...(p.questLog || []), t].slice(-120);
  touchStreak(p);
  const found = p.found[p.theme] || 0;
  let prize = null;
  if (first && found < th.collectibles.length) { prize = th.collectibles[found]; p.found[p.theme] = found + 1; }
  save();
  sfx.win(); confetti('⭐');
  game = null;
  const streak = questStreak(p);
  // typing needs a real keyboard, so it's an extra, not part of the quest
  const lessons = TYPING_LESSONS.filter(l => !l.game);
  const typeNext = lessons.slice().sort((a, b) => typingProgress(p, a.id) - typingProgress(p, b.id))[0];
  const keyboard = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  render(`
    <div class="result stack card">
      <h1>${first ? '⭐ Quest complete!' : 'Extra practice done!'}</h1>
      ${prize ? `<div class="prize">${prize[0]}</div>
        <h2>${th.collectVerb}</h2><p style="font-size:1.4rem;margin:0">Meet <b>${esc(prize[1])}</b>! ${found + 1} of ${th.collectibles.length} in ${th.collection}.</p>` : ''}
      ${first && streak > 1 ? `<p class="quest-streak-big">⭐ ${streak} quests in a row!</p>` : ''}
      <p class="score">You got <b>${right} of ${len}</b> right on the first try
        ${perfect ? '<br>🎯 <b>Perfect!</b> +5 bonus' : ''}${first ? `<br>⭐ Quest bonus +${QUEST_BONUS}` : ''}<br>+${earned} ${th.point} ${th.pointIcon}</p>
      ${first ? '<p class="muted" style="margin:0">A new quest is ready tomorrow.</p>' : ''}
      <div class="row-actions">
        ${keyboard && typeNext && SUBJECTS.typing ? `<button class="btn" id="typeBonus">⌨️ Typing warm-up: ${esc(typeNext.name)}</button>` : ''}
        <button class="btn ${keyboard ? 'ghost' : ''}" id="home">Home</button>
      </div>
    </div>
  `);
  const tb = document.getElementById('typeBonus'); if (tb) tb.onclick = () => startTyping(typeNext.id);
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
const typeTarget = p => ({ 2: 8, 3: 12, 4: 15, 5: 20 })[levelOf(p, 'typing')] || 12; // words per minute goal
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
  const words = TYPE_WORDS.filter(ok).filter(w => w.length <= ({ 2: 5, 3: 7 })[levelOf(p, 'typing')] || 9);
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
        <button class="btn ghost small" id="quit" aria-label="Quit">✕</button>
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
  const prevBest = bestLessonRun(p, lesson.id), newPB = acc >= 90 && (!prevBest || wpm > prevBest.wpm) && !!prevBest;
  p.typing = p.typing || {}; (p.typing[lesson.id] = p.typing[lesson.id] || []).push({ wpm, acc, date: today() });
  p.typing[lesson.id] = p.typing[lesson.id].slice(-30);
  p.typeMiss = p.typeMiss || {};
  Object.entries(t.missed).forEach(([k, n]) => { p.typeMiss[k] = (p.typeMiss[k] || 0) + n; });
  const goal = typeTarget(p), stars = (acc >= 90 ? 1 : 0) + (acc >= 97 ? 1 : 0) + (wpm >= goal ? 1 : 0);
  const earned = 3 + stars * 3;
  if (newPB) setTimeout(() => confetti('⚡'), 400);
  awardFinish(p, th, earned + (newPB ? 2 : 0), `
    ${newPB ? `<div class="record-banner pb">⚡ New personal best! ${prevBest.wpm} → ${wpm} WPM</div>` : ''}
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
    <div class="result stack card">
      <h1>${title}</h1>
      ${prize ? `<div class="prize">${prize[0]}</div><h2>${th.collectVerb}</h2><p style="font-size:1.4rem;margin:0">Meet <b>${esc(prize[1])}</b>! ${found + 1} of ${th.collectibles.length} in ${th.collection}.</p>` : ''}
      ${bodyHtml}
      <p class="score">+${earned} ${th.point} ${th.pointIcon}</p>
      <div class="row-actions"><button class="btn" id="again">Play again</button>${prize ? `<button class="btn ghost" id="coll">${th.collection}</button>` : ''}<button class="btn ghost" id="home">Home</button></div>
    </div>`);
  document.getElementById('again').onclick = again;
  const coll = document.getElementById('coll'); if (coll) coll.onclick = showCollection;
  document.getElementById('home').onclick = showHome;
}

/* ----- Word Blaster game ----- */
function startBlaster() {
  const p = me(), th = theme(p), look = BLASTER[p.theme] || BLASTER.space;
  const tl = levelOf(p, 'typing'), maxLen = ({ 2: 5, 3: 7 })[tl] || 9;
  const pool = TYPE_WORDS.filter(w => w.length >= 2 && w.length <= maxLen);
  const g = { words: [], target: null, score: 0, combo: 0, lives: 3, zapped: 0, level: 1, t0: performance.now(), last: performance.now(), spawnAt: 0, alive: true };
  render(`
    <div class="play">
      <div class="topbar" style="margin:0">
        <button class="btn ghost small" id="quit" aria-label="Quit">✕</button>
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
    const speed = 22 + g.level * 7 + (tl - 2) * 6;                       // pixels per second
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
  const familyTop = (familyBlasterScores()[0] || {}).score || 0;
  const ts = Date.now();
  (p.typing['type-game'] = p.typing['type-game'] || []).push({ score: g.score, zapped: g.zapped, date: today(), ts });
  // keep each player's 10 best games plus the 20 most recent
  const runs = p.typing['type-game'], keep = new Set([...runs.slice().sort((a, b) => b.score - a.score).slice(0, 10), ...runs.slice(-20)]);
  p.typing['type-game'] = runs.filter(r => keep.has(r));
  const best = p.typeHigh || 0, newBest = g.score > best && g.score > 0;
  const familyRecord = g.score > familyTop && familyTop > 0;
  if (newBest) p.typeHigh = g.score;
  const earned = Math.min(25, 2 + Math.floor(g.score / 100)) + (familyRecord ? 5 : newBest ? 2 : 0);
  if (familyRecord || newBest) setTimeout(() => confetti('🏆'), 400);
  awardFinish(p, th, earned, `
    ${familyRecord ? '<div class="record-banner">🏆 New family record! 🏆</div>' : newBest ? '<div class="record-banner pb">⭐ New personal best! ⭐</div>' : ''}
    <div class="type-results">
      <div><b>${g.score.toLocaleString()}</b><span>score</span></div>
      <div><b>${g.zapped}</b><span>words zapped</span></div>
      <div><b>${(p.typeHigh || 0).toLocaleString()}</b><span>your best</span></div>
    </div>
    ${g.zapped < 10 ? '<p class="muted">Zap 10 words in one game to find a new friend!</p>' : ''}
    <h2 style="margin-top:6px">🏆 High Scores</h2>${highScoreBoard(ts)}`, startBlaster, g.zapped >= 10, 'Game over!');
}

/* ----- High scores (only players in this family / on this device) ----- */
const MEDALS = ['🥇', '🥈', '🥉'];
function familyBlasterScores() {
  return state.profiles.flatMap(pl => ((pl.typing || {})['type-game'] || [])
    .filter(r => r.score > 0).map(r => ({ ...r, name: pl.name, avatar: pl.avatar, pid: pl.id })))
    .sort((a, b) => b.score - a.score || (a.ts || 0) - (b.ts || 0));
}
const bestLessonRun = (pl, id) => ((pl.typing || {})[id] || []).filter(r => r.acc >= 90).sort((a, b) => b.wpm - a.wpm)[0] || null;
function highScoreBoard(highlightTs) {
  const top = familyBlasterScores().slice(0, 10);
  if (!top.length) return '<p class="muted center">No scores yet. Play a game to get on the board!</p>';
  return `<ol class="scoreboard">${top.map((r, i) => `<li class="${highlightTs && r.ts === highlightTs ? 'mine' : ''}">
      <span class="rank">${MEDALS[i] || i + 1}</span><span class="who">${r.avatar} ${esc(r.name)}</span>
      <span class="pts">${r.score.toLocaleString()}</span><span class="when muted">${esc(r.date || '')}</span></li>`).join('')}</ol>`;
}
function showHighScores() {
  const p = me(), th = theme(p), look = BLASTER[p.theme] || BLASTER.space;
  screen = 'scores';
  render(`
    <div class="topbar"><button class="btn ghost small" id="back">← Back</button><span class="chip">🏆 High Scores</span><span></span></div>
    <div class="card stack"><h2>${look.thing} ${look.name}</h2>${highScoreBoard()}
      <div class="row-actions"><button class="btn" id="play">Play ${look.name}</button></div></div>
    <div class="card stack" style="margin-top:16px"><h2>⚡ ${esc(p.name)}'s personal bests</h2>
      <table class="bests">${TYPING_LESSONS.filter(l => !l.game).map(l => { const b = bestLessonRun(p, l.id);
        return `<tr><td>${l.icon} ${l.name}</td><td>${b ? `<b>${b.wpm} WPM</b> <span class="muted">${b.acc}% accurate</span>` : '<span class="muted">not played yet</span>'}</td></tr>`; }).join('')}</table>
      <p class="muted" style="margin:0">Personal bests count when accuracy is 90% or higher.</p></div>`);
  document.getElementById('back').onclick = showHome;
  document.getElementById('play').onclick = () => startTyping('type-game');
}

/* ----- Grown-ups ----- */
/* ----- Grown-ups lock: family password (signed in) or a PIN for this device ----- */
let grownupUntil = 0, pinFails = 0, pinLockedUntil = 0;
const grownupUnlocked = () => Date.now() < grownupUntil;
const unlockGrownup = () => { grownupUntil = Date.now() + 15 * 60 * 1000; };
async function sha256(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function showParentGate(then = showParents, back = showProfiles) {
  if (grownupUnlocked()) return then();
  screen = 'gate';
  const signedIn = SYNC_URL && state.sync.token, pin = state.grownPin;
  const card = inner => render(`
    <div class="topbar"><button class="btn ghost small" id="back">← Back</button></div>
    <div class="card stack gate" style="max-width:480px;margin:0 auto">${inner}</div>`);
  const pass = () => { unlockGrownup(); then(); };
  const wire = () => { document.getElementById('back').onclick = back; };

  if (signedIn) {
    card(`<div class="gate-icon">🔒</div><h2>Grown-ups only</h2>
      <p class="muted" style="margin:0">Enter the password for <b>${esc(state.sync.family)}</b>.</p>
      <form id="gf" class="stack" autocomplete="on">
        <input type="text" name="username" autocomplete="username" value="${esc(state.sync.family)}" hidden>
        <input class="text" id="gpw" type="password" autocomplete="current-password" placeholder="Family password">
        <div class="row-actions"><button class="btn" type="submit">Unlock</button></div>
      </form>`);
    wire();
    document.getElementById('gpw').focus();
    document.getElementById('gf').onsubmit = async e => {
      e.preventDefault();
      try { await syncCall({ action: 'verify', password: document.getElementById('gpw').value }); pass(); }
      catch (err) { toast(/fetch|network/i.test(err.message) ? "You're offline. Connect to the internet to unlock." : err.message); }
    };
    return;
  }

  if (pin) {
    card(`<div class="gate-icon">🔒</div><h2>Grown-ups only</h2>
      <p class="muted" style="margin:0">Enter this device's grown-up PIN.</p>
      <form id="gf" class="stack"><input class="text pin" id="gpin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN">
      <div class="row-actions"><button class="btn" type="submit">Unlock</button></div></form>
      <details class="acct-more"><summary>Forgot the PIN?</summary>
        ${SYNC_URL ? '<p class="muted">If you have a family account, sign in on this device instead: the family password unlocks this page.</p><button class="btn small" id="toSignIn">Sign in to my family</button>' : ''}
        <p class="muted">Or reset it. This removes all players and progress on this device.</p>
        <button class="btn ghost small" id="resetPin">Reset PIN and remove players</button></details>`);
    wire();
    document.getElementById('gpin').focus();
    document.getElementById('gf').onsubmit = async e => {
      e.preventDefault();
      if (Date.now() < pinLockedUntil) return toast('Too many tries. Wait a minute.');
      if (await sha256(pin.salt + document.getElementById('gpin').value) === pin.hash) { pinFails = 0; return pass(); }
      if (++pinFails >= 5) { pinLockedUntil = Date.now() + 60000; pinFails = 0; }
      toast('That PIN is not right');
    };
    const ts = document.getElementById('toSignIn'); if (ts) ts.onclick = () => showGateSignIn(then, back);
    document.getElementById('resetPin').onclick = () => {
      if (!confirm('Remove all players and progress on this device and reset the PIN? This cannot be undone.')) return;
      state.profiles = []; state.current = null; delete state.grownPin; writeStore(); showProfiles();
    };
    return;
  }

  // first time on this device: a grown-up picks how to lock it
  card(`<div class="gate-icon">🔒</div><h2>Set up grown-up access</h2>
    <p class="muted" style="margin:0">The grown-ups page shows progress and settings, so it needs a lock kids can't guess.</p>
    ${SYNC_URL ? `<button class="btn" id="toSignIn">Sign in to my family account</button>
      <div class="divider">or</div>` : ''}
    <form id="gf" class="stack"><label class="lbl">Make a PIN for this device</label>
      <input class="text pin" id="p1" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="4 to 8 digits">
      <input class="text pin" id="p2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="Type it again">
      <div class="row-actions"><button class="btn ghost" type="submit">Save PIN</button></div></form>`);
  wire();
  const ts = document.getElementById('toSignIn'); if (ts) ts.onclick = () => showGateSignIn(then, back);
  document.getElementById('gf').onsubmit = async e => {
    e.preventDefault();
    const a = document.getElementById('p1').value, b = document.getElementById('p2').value;
    if (!/^\d{4,8}$/.test(a)) return toast('Use 4 to 8 digits');
    if (a !== b) return toast("The PINs don't match");
    const salt = Math.random().toString(36).slice(2);
    state.grownPin = { salt, hash: await sha256(salt + a) }; writeStore(); toast('PIN saved'); pass();
  };
}

function showGateSignIn(then, back) {
  render(`<div class="topbar"><button class="btn ghost small" id="back">← Back</button></div>
    <div class="card stack gate" style="max-width:480px;margin:0 auto"><div class="gate-icon">☁️</div><h2>Sign in to your family</h2>
    <form id="sf" class="stack" autocomplete="on">
      <input class="text" id="sfName" autocomplete="username" placeholder="Family name" autocapitalize="words">
      <input class="text" id="sfPw" type="password" autocomplete="current-password" placeholder="Password">
      <div class="row-actions"><button class="btn" type="submit">Sign in</button></div></form>
    <p class="muted" style="margin:0">New family? You'll need an invite link from the person who shared Quest Academy.</p></div>`);
  document.getElementById('back').onclick = () => showParentGate(then, back);
  document.getElementById('sf').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await syncCall({ action: 'login', family: document.getElementById('sfName').value, password: document.getElementById('sfPw').value });
      await signedIn(r, () => {}); unlockGrownup(); toast('Signed in! ☁️'); then();
    } catch (err) { toast(err.message); }
  };
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
    'wp-twostep': 'Story: two steps', 'wp-times': 'Story: times as many',
    'mul-2x1': '2-digit × 1-digit', 'mul-3x1': '3-digit × 1-digit', 'mul-4x1': '4-digit × 1-digit', 'mul-2x2': '2-digit × 2-digit', 'mul-3x2': '3-digit × 2-digit',
    'div-exact': 'Long division', 'div-rem': 'Division with remainders', 'div-2digit': 'Dividing by 2-digit numbers',
    'frac-equiv': 'Equivalent fractions', 'frac-compare': 'Comparing fractions', 'frac-addSame': 'Adding fractions', 'frac-subSame': 'Subtracting fractions',
    'frac-mixed': 'Mixed numbers', 'frac-addUnlike': 'Adding unlike fractions', 'frac-mulWhole': 'Whole × fraction', 'frac-mulFrac': 'Fraction × fraction', 'frac-simplify': 'Simplifying fractions',
    'dec-toDec': 'Fractions as decimals', 'dec-fracToDec': 'Fractions as decimals', 'dec-compareDec': 'Comparing decimals', 'dec-addDec': 'Adding decimals',
    'dec-subDec': 'Subtracting decimals', 'dec-times10': '× 10, 100, 1000', 'dec-roundDec': 'Rounding decimals',
    'meas-area': 'Area', 'meas-perimeter': 'Perimeter', 'meas-side': 'Missing side', 'meas-volume': 'Volume' };
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
    <h1>Grown-ups</h1>
    <p class="muted">${SYNC_URL && state.sync.token ? 'Progress is shared across your family\'s devices.' : 'Progress is saved only in this browser on this device.'}</p>
    ${howItWorksHtml()}
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
        (sid === 'math' ? (levelOf(p, 'math') >= 4 ? MISSIONS45 : MISSIONS).filter(m => m.grade <= levelOf(p, 'math')) : SUBJECTS[sid].missions.filter(m => !m.grades || m.grades.includes(levelOf(p, sid)))).map(m => {
        const keys = Object.keys(p.stats).filter(k => missionOf(k) === m.id);
        const r = keys.reduce((a, k) => a + p.stats[k].r, 0), w = keys.reduce((a, k) => a + p.stats[k].w, 0);
        const mm = p.missions[m.id] || { plays: 0 };
        return `<tr><td>${esc(sid === 'math' ? m.desc : m.name)}</td><td>${mm.plays}</td><td>${r + w ? Math.round(r / (r + w) * 100) + '%' : '—'}</td><td>${Math.round(mastery(p, m.id) * 100)}%${POOLS[m.id] ? ` <span class="muted">(${masteredCount(p, m.id)} of ${POOLS[m.id].length} facts)</span>` : ''}</td></tr>`;
      }).join(''))).join('');
      return `<div class="card stack">
        <h2>${p.avatar} ${esc(p.name)} <span class="muted" style="font-size:1rem">${gradeName(p.grade)} grade${Object.keys(p.levels || {}).length ? ' (' + Object.entries(p.levels).map(([s, g]) => `${SUBJECTS[s] ? SUBJECTS[s].name : s} ${gradeName(g)}`).join(', ') + ')' : ''} · ${THEMES[p.theme].name}</span></h2>
        <p style="margin:0">🔥 Streak: ${p.lastDay && dayDiff(p.lastDay, today()) <= 1 ? p.streak : 0} days · Last played: ${p.lastDay || 'never'} · ⭐ Daily quests: ${questsThisWeek(p)} of the last 7 days</p>
        <div style="overflow-x:auto"><table><tr><th>Skill</th><th>Missions</th><th>First-try accuracy</th><th>Mastered</th></tr>${rows}</table></div>
        <div><b>Needs practice</b><div class="facts" style="margin-top:8px">${trickyFacts(p)}</div></div>
        <div><b>Trickiest typing keys</b><div class="facts" style="margin-top:8px">${
          Object.entries(p.typeMiss || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `<span class="fact">${k === ' ' ? 'space' : esc(k)} ×${n}</span>`).join('') || '<span class="muted">None yet</span>'}</div></div>
        <div><b>Common mistakes</b> <span class="muted">(from the multiple choice mission)</span><div class="facts" style="margin-top:8px">${
          Object.entries(p.mistakes || {}).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="fact" title="${esc(MISTAKES[t] ? MISTAKES[t][1] : '')}">${esc(MISTAKES[t] ? MISTAKES[t][0] : t)} ×${n}</span>`).join('') || '<span class="muted">None yet</span>'}</div></div>
        <div><b>Journal</b> <span class="muted">(${(p.journal || []).length} entries)</span>${(p.journal || []).slice(0, 5).map(e =>
          `<div class="journal-entry" style="margin-top:10px"><div class="muted">${esc(e.date)} · ${esc(e.prompt)}</div><p>${esc(e.text)}</p></div>`).join('') || '<div class="muted">Nothing written yet.</div>'}</div>
        <div class="row-actions" style="justify-content:flex-start"><button class="btn ghost small" data-edit="${p.id}">⚙️ Grade, levels & settings</button><button class="btn ghost small danger" data-del="${p.id}">Delete player</button></div>
      </div>`;
    }).join('')}
    </div>
  `);
  document.getElementById('back').onclick = showProfiles;
  bindSyncCard(showParents);
  const ss = document.getElementById('showSetup');
  if (ss) ss.onclick = () => { state.setupHidden = false; writeStore(); showProfiles(); };
  bindAll('[data-edit]', el => { state.current = el.dataset.edit; writeStore(); showEditProfile(me(), showParents); });
  if (!state.setupSeen) { state.setupSeen = true; writeStore(); }
  bindAll('[data-del]', el => {
    const p = state.profiles.find(x => x.id === el.dataset.del);
    if (p && deletePlayer(p)) showParents();
  });
}
// asks first; removes the player here and (through sync) on every family device
function deletePlayer(p) {
  if (!confirm(`Delete ${p.name} and all their progress? This can't be undone.`)) return false;
  state.profiles = state.profiles.filter(x => x.id !== p.id);
  state.sync.tombs = state.sync.tombs.filter(t => t.id !== p.id);
  state.sync.tombs.push({ id: p.id, updated: Math.max(Date.now(), (p.updated || 0) + 1) });
  delete snapshot[p.id];
  if (state.current === p.id) state.current = null;
  save(); toast(`${p.name} was deleted`);
  return true;
}

function missionOf(k) {
  if (k.startsWith('q:')) return (QINDEX[k.slice(2)] || {}).mid;
  if (k.startsWith('mul-')) return 'multi';
  if (k.startsWith('div-')) return 'longdiv';
  if (k.startsWith('frac-')) return 'fractions';
  if (k.startsWith('dec-')) return 'decimals';
  if (k.startsWith('meas-')) return 'measure';
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
// save the app on the device so it opens without signal (see sw.js)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
state.sync = state.sync || { token: '', family: '', admin: false, last: 0, tombs: [], ok: 0 };
state.sync.tombs = state.sync.tombs || [];
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
  if (!SYNC_URL || !state.sync.token) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(doSync, delay);
}

async function syncCall(body) {
  const r = await fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: state.sync.token, ...body }), cache: 'no-store' });
  const j = await r.json().catch(() => ({ error: 'Server error' }));
  if (r.status === 401 && state.sync.token) { state.sync.token = ''; writeStore(); }   // this device was signed out
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
  m.questLog = [...new Set([...(a.questLog || []), ...(b.questLog || [])])].sort().slice(-120);
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
  if (!SYNC_URL || !state.sync.token || syncing) return;
  if (!navigator.onLine) { lastSyncError = 'offline'; return; }
  syncing = true;
  let changedView = false;
  try {
    markChanged();
    const pulled = await syncCall({ action: 'pull', since: state.sync.last || 0 });
    state.sync.family = pulled.family; state.sync.admin = !!pulled.admin;
    const deletedHere = new Set(state.sync.tombs.map(t => t.id));
    for (const r of pulled.players) {
      if (deletedHere.has(r.id)) continue;   // deleted on this device; the delete goes up below
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
  const s = state.sync;
  const rec = s.pendingRecovery ? `<div class="recovery-box"><b>📝 Write down your recovery code</b>
      <div class="code">${esc(s.pendingRecovery)}</div>
      <span class="muted">If you ever forget your password, this code lets you set a new one. It won't be shown again.</span>
      <div><button class="btn small" id="recDone">I wrote it down</button></div></div>` : '';
  if (s.token) {
    const when = s.ok ? new Date(s.ok).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'not yet';
    return `<div class="card stack" id="acct"><h2>☁️ ${esc(s.family || 'Your family')}</h2>
      ${rec}
      <p style="margin:0">This device is signed in. Progress is shared with your family's other devices.<br>
        <span class="muted">Last synced: ${when}${lastSyncError ? ` · ⚠️ ${esc(lastSyncError === 'offline' ? 'offline, will sync later' : lastSyncError)}` : ''}</span></p>
      <div class="row-actions" style="justify-content:flex-start">
        <button class="btn small" id="syncNow">Sync now</button>
        <button class="btn ghost small" id="signOut">Sign out of this device</button>
      </div>
      ${s.admin ? `<details class="acct-more"><summary>👋 Invite a family</summary>
        <p class="muted">Makes a one-time link for another family to create their own account. They'll only ever see their own kids, and they can't see that other families exist. Links expire after 14 days.</p>
        <button class="btn small" id="mkInvite">Make an invite link</button><div id="inviteOut"></div></details>
        <details class="acct-more"><summary>🔑 Help a family that's locked out</summary>
        <p class="muted">Gives them a new temporary password. Their kids' progress isn't shown or changed.</p>
        <input class="text" id="resetName" placeholder="Their family name" autocomplete="off">
        <button class="btn small" id="doReset">Reset their password</button><div id="resetOut"></div></details>` : ''}
      <details class="acct-more"><summary>⚙️ Account settings</summary>
        <label class="lbl">Family name</label>
        <input class="text" id="newName" value="${esc(s.family || '')}" autocomplete="off"> <button class="btn small" id="doRename">Rename</button>
        <label class="lbl" style="margin-top:14px">Change password</label>
        <input class="text" id="oldPw" type="password" placeholder="Current password" autocomplete="current-password">
        <input class="text" id="newPw" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" style="margin-top:8px">
        <button class="btn small" id="doPw">Change password</button>
        <label class="lbl" style="margin-top:14px">New recovery code</label>
        <input class="text" id="recPw" type="password" placeholder="Your password" autocomplete="current-password">
        <button class="btn small" id="doRec">Show a new recovery code</button>
      </details></div>`;
  }
  return `<div class="card stack" id="acct"><h2>☁️ Sign in to your family</h2>
    <p style="margin:0" class="muted">Sign in once on each device and your kids' progress follows them everywhere.</p>
    <input class="text" id="famName" placeholder="Family name" autocomplete="username" autocapitalize="words">
    <input class="text" id="famPw" type="password" placeholder="Password" autocomplete="current-password">
    <div class="row-actions" style="justify-content:flex-start"><button class="btn small" id="signIn">Sign in</button></div>
    <details class="acct-more"><summary>Forgot your password?</summary>
      <input class="text" id="rcName" placeholder="Family name" autocomplete="username">
      <input class="text" id="rcCode" placeholder="Recovery code (xxxx-xxxx-xxxx-xxxx)" autocomplete="off" autocapitalize="none" style="margin-top:8px">
      <input class="text" id="rcPw" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" style="margin-top:8px">
      <button class="btn small" id="doRecover">Set new password</button>
      <p class="muted">No recovery code? Ask the person who invited you to reset your password.</p></details>
    <p class="muted" style="margin:0">New family? You'll need an invite link from the person who shared Quest Academy with you.</p></div>`;
}

async function signedIn(res, rerender) {
  Object.assign(state.sync, { token: res.token, family: res.family, admin: !!res.admin, last: 0, ok: 0 });
  if (res.recovery) state.sync.pendingRecovery = res.recovery;
  delete state.sync.code;
  writeStore(); await doSync(); rerender();
}

function bindSyncCard(rerender) {
  const $ = id => document.getElementById(id);
  const val = id => ($(id) || {}).value || '';
  const act = async (fn) => { try { await fn(); } catch (e) { toast(e.message); } };
  if ($('recDone')) $('recDone').onclick = () => { delete state.sync.pendingRecovery; writeStore(); rerender(); };
  if ($('signIn')) $('signIn').onclick = () => act(async () => {
    if (!val('famName').trim() || !val('famPw')) return toast('Enter your family name and password');
    await signedIn(await syncCall({ action: 'login', family: val('famName'), password: val('famPw') }), rerender);
    toast('Signed in! ☁️');
  });
  if ($('doRecover')) $('doRecover').onclick = () => act(async () => {
    await signedIn(await syncCall({ action: 'recover', family: val('rcName'), recovery: val('rcCode'), password: val('rcPw') }), rerender);
    toast('New password set. Signed in!');
  });
  if ($('syncNow')) $('syncNow').onclick = async () => { await doSync(); toast(lastSyncError ? '⚠️ ' + lastSyncError : 'Synced ✓'); rerender(); };
  if ($('signOut')) $('signOut').onclick = () => act(async () => {
    if (!confirm(`Sign this device out of ${state.sync.family}? The kids' players will be removed from this device but stay safe in your account.`)) return;
    await doSync();
    if (state.profiles.some(p => p.dirty)) { if (!confirm('Some progress has not synced yet (are you offline?). Sign out anyway and lose it on this device?')) return; }
    try { await syncCall({ action: 'logout' }); } catch (e) { /* already signed out */ }
    state.profiles = []; state.current = null;
    state.sync = { token: '', family: '', admin: false, last: 0, tombs: [], ok: 0 };
    Object.keys(snapshot).forEach(k => delete snapshot[k]);
    writeStore(); toast('Signed out'); rerender();
  });
  if ($('mkInvite')) $('mkInvite').onclick = () => act(async () => {
    const r = await syncCall({ action: 'invite' });
    const link = `${location.origin}${location.pathname}#invite=${r.invite}`;
    $('inviteOut').innerHTML = `<div class="invite-link"><input class="text" readonly value="${esc(link)}" id="invLink"></div>
      <div class="row-actions" style="justify-content:flex-start">
        <button class="btn small" id="copyInv">Copy link</button>${navigator.share ? '<button class="btn ghost small" id="shareInv">Share…</button>' : ''}</div>
      <p class="muted">Works once, for one family, for ${r.expires_days} days.</p>`;
    $('copyInv').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch (e) { $('invLink').select(); } };
    if ($('shareInv')) $('shareInv').onclick = () => navigator.share({ title: 'Quest Academy', text: 'Here is your invite to Quest Academy, a learning game for kids:', url: link }).catch(() => {});
  });
  if ($('doReset')) $('doReset').onclick = () => act(async () => {
    const r = await syncCall({ action: 'admin_reset', family: val('resetName') });
    $('resetOut').innerHTML = `<p>New temporary password for <b>${esc(r.family)}</b>:</p><div class="code">${esc(r.temp_password)}</div>
      <p class="muted">Send it to them. They sign in with it, then change it under Account settings.</p>`;
  });
  if ($('doRename')) $('doRename').onclick = () => act(async () => {
    const r = await syncCall({ action: 'rename', family: val('newName') }); state.sync.family = r.family; writeStore(); toast('Renamed'); rerender();
  });
  if ($('doPw')) $('doPw').onclick = () => act(async () => {
    await syncCall({ action: 'change_password', old: val('oldPw'), password: val('newPw') }); toast('Password changed'); rerender();
  });
  if ($('doRec')) $('doRec').onclick = () => act(async () => {
    const r = await syncCall({ action: 'new_recovery', password: val('recPw') }); state.sync.pendingRecovery = r.recovery; writeStore(); rerender();
  });
}

/* ----- Invite link: create a family account ----- */
async function showInvite(code) {
  history.replaceState(null, '', location.pathname);
  screen = 'invite'; applyTheme('space');
  if (state.sync.token) {
    render(`<div class="card stack center" style="margin-top:30px"><h2>You're already signed in</h2>
      <p>This device is signed in to <b>${esc(state.sync.family)}</b>. To create a different family, sign out first on the Grown-ups page.</p>
      <div class="row-actions"><button class="btn" id="ok">OK</button></div></div>`);
    document.getElementById('ok').onclick = showProfiles; return;
  }
  try { await syncCall({ action: 'invite_check', invite: code }); }
  catch (e) {
    render(`<div class="card stack center" style="margin-top:30px"><h2>Invite link not working</h2><p>${esc(e.message)}</p>
      <div class="row-actions"><button class="btn" id="ok">OK</button></div></div>`);
    document.getElementById('ok').onclick = showProfiles; return;
  }
  render(`
    <div class="hero stack"><div class="big">🚀🐠🐶🧁</div><h1>Welcome to Quest Academy!</h1>
      <p class="muted" style="font-size:1.15rem">You've been invited. Create your family's account so your kids' progress syncs across your devices.</p></div>
    <div class="card stack" style="max-width:520px;margin:20px auto 0">
      <label class="lbl" for="suName">Family name</label>
      <input class="text" id="suName" placeholder="e.g. The Garcias" autocomplete="username" autocapitalize="words" maxlength="40">
      <span class="muted" style="display:block;margin-top:-6px">You'll type this to sign in on other devices.</span>
      <label class="lbl" for="suPw">Password</label>
      <input class="text" id="suPw" type="password" placeholder="8+ characters" autocomplete="new-password">
      <input class="text" id="suPw2" type="password" placeholder="Type it again" autocomplete="new-password">
      <p class="muted" style="margin:0">🔒 Your family is private: nobody else can see your kids or their progress. Only first names, game progress and journal writing are stored. No emails.</p>
      <div class="row-actions" style="justify-content:flex-start"><button class="btn" id="suGo">Create our family</button></div>
    </div>`);
  document.getElementById('suGo').onclick = async () => {
    const name = document.getElementById('suName').value.trim(), pw = document.getElementById('suPw').value;
    if (pw !== document.getElementById('suPw2').value) return toast("Passwords don't match");
    try {
      const r = await syncCall({ action: 'signup', invite: code, family: name, password: pw });
      await signedIn(r, () => {});
      render(`<div class="card stack center" style="margin-top:30px;max-width:560px;margin-left:auto;margin-right:auto">
        <h1>🎉 Welcome, ${esc(r.family)}!</h1>
        <div class="recovery-box"><b>📝 Write down your recovery code</b><div class="code">${esc(r.recovery)}</div>
          <span class="muted">If you ever forget your password, this code lets you set a new one. It won't be shown again.</span></div>
        <p>Next: add your kids as players. On your other devices, open this site, tap <b>Grown-ups</b>, and sign in with your family name and password.</p>
        <div class="row-actions"><button class="btn" id="go">I wrote it down. Let's go!</button></div></div>`);
      document.getElementById('go').onclick = () => { delete state.sync.pendingRecovery; writeStore(); showProfiles(); };
    } catch (e) { toast(e.message); }
  };
}

/* ---------- boot ---------- */
const inviteCode = SYNC_URL && (location.hash.match(/^#invite=([a-f0-9]{32})$/) || [])[1];
if (inviteCode) showInvite(inviteCode);
else if (me()) showHome(); else showProfiles();
if (SYNC_URL && state.sync.code && !state.sync.token) {
  // devices set up with the first version's single family code move into the owner's family account
  syncCall({ action: 'legacy', passcode: state.sync.code })
    .then(r => signedIn(r, () => { if (!game && (screen === 'home' || screen === 'profiles')) (me() ? showHome : showProfiles)(); }))
    .catch(() => { delete state.sync.code; writeStore(); });
} else if (SYNC_URL && state.sync.token) doSync();
})();
