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
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
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
  document.querySelector('meta[name=theme-color]').setAttribute('content', getComputedStyle(document.body).getPropertyValue('--bg1').trim() || '#0b1033');
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

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\$(\d+)/g, '$1 dollars'));
    u.rate = .9;
    speechSynthesis.speak(u);
  } catch (e) { /* no speech on this device */ }
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
  state.current = null; save();
  applyTheme('space');
  render(`
    <div class="hero stack">
      <div class="big">🚀🐠🐾🧁</div>
      <h1>Math Quest</h1>
      <p class="muted" style="font-size:1.2rem">Who's playing today?</p>
    </div>
    <div class="profile-grid" style="margin-top:20px">
      ${state.profiles.map(p => `
        <button class="profile" data-id="${p.id}">
          <span class="av">${p.avatar}</span>${esc(p.name)}
          <small>${THEMES[p.theme].icon} ${THEMES[p.theme].name}</small>
        </button>`).join('')}
      <button class="profile add" id="add"><span class="av">➕</span>New player</button>
    </div>
    <div class="row-actions" style="margin-top:28px">
      <button class="btn ghost small" id="parents">👪 Grown-ups</button>
    </div>
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
          <input class="text" id="nm" maxlength="14" autocomplete="off" value="${esc(sel.name)}" placeholder="Type your name">
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
  const th = theme(p);
  applyTheme(p.theme);
  // suggest the least-mastered mission for this grade
  const forGrade = MISSIONS.filter(m => m.grade <= p.grade || p.grade >= 3);
  const suggested = forGrade.slice().sort((a, b) => progress(p, a.id) - progress(p, b.id))[0];
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
        <p class="muted" style="font-size:1.15rem;margin:6px 0 0">Pick a mission, ${th.playerWord.toLowerCase()}!</p>
      </div>
      <div class="mission-grid">
        ${MISSIONS.map(m => {
          const tm = th.missions[m.id], pct = showPct(progress(p, m.id));
          const label = POOLS[m.id] ? `${learnedCount(p, m.id)} facts learned · ${pct}%` : `${pct}% mastered`;
          return `<button class="mission" data-m="${m.id}">
            ${m.id === suggested.id ? '<span class="tag">Try me!</span>' : ''}
            <span class="icon">${tm.icon}</span>
            <span class="name">${tm.name}</span>
            <span class="desc">${m.desc}</span>
            <span class="mastery-label">${label}</span>
            <span class="mastery"><i style="width:${pct}%"></i></span>
          </button>`;
        }).join('')}
      </div>
      <button class="card" id="coll" style="width:100%;text-align:left;display:flex;align-items:center;gap:14px">
        <span style="font-size:2.6rem">${found ? th.collectibles[found - 1][0] : '❔'}</span>
        <span><b style="font-size:1.3rem">${th.collection}</b><br>
        <span class="muted">${found} of ${th.collectibles.length} found. Finish missions to find more!</span></span>
      </button>
    </div>
  `);
  bindAll('[data-m]', el => startMission(el.dataset.m));
  document.getElementById('me').onclick = () => showEditProfile(p);
  document.getElementById('coll').onclick = showCollection;
  document.getElementById('snd').onclick = () => { state.sound = !state.sound; save(); showHome(); };
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
  game = { missionId, n: 0, firstTry: 0, recent: [], retry: [], q: null, input: '', tries: 0, locked: false };
  nextQuestion();
}

function nextQuestion() {
  const p = me();
  if (game.n >= MISSION_LEN) return finishMission();
  let q;
  const due = game.retry.findIndex(r => r.at <= game.n);
  if (due >= 0) q = game.retry.splice(due, 1)[0].q;
  else if (game.missionId === 'story' || game.n === 3 || game.n === 7) {
    // word problems: every question in the Story mission, and 2 of 10 elsewhere
    const types = storyTypesFor(game.missionId, p);
    const type = weightedPick(p, types, t => 'wp-' + t);
    const big = game.missionId === 'twodigit' || (game.missionId === 'story' && (p.grade >= 3 || Math.random() < .35));
    q = makeStory(type, p, big);
  }
  else if (POOLS[game.missionId]) q = factQuestion(chooseFact(p, game.missionId, game.recent));
  else q = GENERATORS[game.missionId]();
  game.recent = [q.key, ...game.recent].slice(0, 6);
  Object.assign(game, { q, input: '', tries: 0, locked: false });
  drawPlay();
}

function drawPlay() {
  const p = me(), th = theme(p), tm = th.missions[game.missionId];
  const pct = (game.n / MISSION_LEN) * 100;
  render(`
    <div class="play">
      <div class="topbar" style="margin:0">
        <button class="btn ghost small" id="quit">✕</button>
        <span class="chip">${tm.icon} ${tm.name}</span>
        <span class="chip">${game.n + 1} / ${MISSION_LEN}</span>
      </div>
      <div class="meter"><span>${th.meterIcon} ${th.meter}</span><span class="bar"><i id="bar" style="width:${pct}%"></i></span></div>
      <div class="card question ${game.q.wordy ? 'wordy' : ''}">${game.q.prompt}</div>
      <div class="feedback" id="fb" aria-live="polite"></div>
      <div class="hint" id="hint"></div>
      <div class="pad" id="pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        <button data-k="del" aria-label="Delete">⌫</button><button data-k="0">0</button><button data-k="go" class="go" aria-label="Check answer">✓</button>
      </div>
    </div>
  `);
  updateAnswer();
  bindAll('[data-k]', el => press(el.dataset.k));
  const say = $app.querySelector('[data-say]');
  if (say) {
    if (!('speechSynthesis' in window)) say.remove();
    else say.onclick = () => speak($app.querySelector('.story-text').innerText);
  }
  document.getElementById('quit').onclick = () => { game = null; try { speechSynthesis.cancel(); } catch (e) {} showHome(); };
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

function check() {
  if (game.input === '') return;
  const p = me(), th = theme(p);
  const ans = document.getElementById('ans'), fb = document.getElementById('fb'), hint = document.getElementById('hint');
  const correct = +game.input === game.q.answer;
  game.tries++;
  if (correct) {
    game.locked = true;
    if (game.tries === 1) { record(p, game.q.key, true); game.firstTry++; }
    ans.className = 'answer-box good'; fb.className = 'feedback good';
    fb.textContent = pick(th.cheers) + ' ' + th.pointIcon;
    sfx.good(); save();
    game.n++;
    document.getElementById('bar').style.width = (game.n / MISSION_LEN * 100) + '%';
    setTimeout(nextQuestion, game.tries === 1 ? 900 : 1300);
    return;
  }
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
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') press('del');
  else if (e.key === 'Enter') { const n = document.getElementById('next'); n ? n.click() : press('go'); }
});

function finishMission() {
  const p = me(), th = theme(p);
  const m = p.missions[game.missionId] || (p.missions[game.missionId] = { plays: 0, history: [] });
  m.plays++; m.history = [...m.history, game.firstTry].slice(-20);
  const perfect = game.firstTry === MISSION_LEN;
  const earned = game.firstTry + (perfect ? 5 : 0);
  p.points += earned;

  // streak
  const t = today();
  if (p.lastDay !== t) { p.streak = p.lastDay && dayDiff(p.lastDay, t) === 1 ? p.streak + 1 : 1; p.lastDay = t; }

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
      <p style="font-size:1.3rem">You got <b>${right} of ${MISSION_LEN}</b> right on the first try
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
    .filter(([k, s]) => s.w > 0 && s.box < 3)
    .sort((a, b) => (b[1].w - b[1].r * .5) - (a[1].w - a[1].r * .5))
    .slice(0, 12)
    .map(([k, s]) => `<span class="fact" title="right ${s.r}, missed ${s.w}">${esc(labelKey(k))}</span>`).join('') || '<span class="muted">Nothing tricky yet. Nice!</span>';
}
function labelKey(k) {
  const names = { 'pv-blocks': 'Reading blocks', 'pv-digit': 'Digit place', 'pv-expanded': 'Expanded form',
    'pv-10more': '10 more', 'pv-10less': '10 less', 'pv-100more': '100 more', 'pv-100less': '100 less',
    'add2': '2-digit add', 'add2-regroup': '2-digit add (carrying)', 'sub2': '2-digit subtract', 'sub2-regroup': '2-digit subtract (borrowing)',
    'wp-join': 'Story: adding on', 'wp-separate': 'Story: taking away', 'wp-compare': 'Story: how many more',
    'wp-missing': 'Story: missing part', 'wp-money': 'Story: money', 'wp-pvbundle': 'Story: hundreds/tens/ones',
    'wp-groups': 'Story: equal groups', 'wp-share': 'Story: sharing equally', 'wp-buy': 'Story: how many can you buy',
    'wp-twostep': 'Story: two steps' };
  return names[k] || k.replace('-', ' − ').replace('+', ' + ').replace('×', ' × ').replace('÷', ' ÷ ');
}

function showParents() {
  applyTheme('space');
  render(`
    <div class="topbar"><button class="btn ghost small" id="back">← Back</button></div>
    <h1>Progress</h1>
    <p class="muted">Progress is saved only in this browser on this device.</p>
    ${state.profiles.length ? '' : '<p>No players yet.</p>'}
    <div class="stack">
    ${state.profiles.map(p => {
      const rows = MISSIONS.map(m => {
        const keys = Object.keys(p.stats).filter(k => missionOf(k) === m.id);
        const r = keys.reduce((a, k) => a + p.stats[k].r, 0), w = keys.reduce((a, k) => a + p.stats[k].w, 0);
        const mm = p.missions[m.id] || { plays: 0 };
        return `<tr><td>${m.desc}</td><td>${mm.plays}</td><td>${r + w ? Math.round(r / (r + w) * 100) + '%' : '—'}</td><td>${Math.round(mastery(p, m.id) * 100)}%${POOLS[m.id] ? ` <span class="muted">(${masteredCount(p, m.id)} of ${POOLS[m.id].length} facts)</span>` : ''}</td></tr>`;
      }).join('');
      return `<div class="card stack">
        <h2>${p.avatar} ${esc(p.name)} <span class="muted" style="font-size:1rem">${p.grade === 2 ? '2nd' : '3rd'} grade · ${THEMES[p.theme].name}</span></h2>
        <p style="margin:0">🔥 Streak: ${p.lastDay && dayDiff(p.lastDay, today()) <= 1 ? p.streak : 0} days · Last played: ${p.lastDay || 'never'}</p>
        <div style="overflow-x:auto"><table><tr><th>Skill</th><th>Missions</th><th>First-try accuracy</th><th>Mastered</th></tr>${rows}</table></div>
        <div><b>Needs practice</b><div class="facts" style="margin-top:8px">${trickyFacts(p)}</div></div>
        <div><button class="btn ghost small" data-del="${p.id}">Delete player</button></div>
      </div>`;
    }).join('')}
    </div>
  `);
  document.getElementById('back').onclick = showProfiles;
  bindAll('[data-del]', el => {
    const p = state.profiles.find(x => x.id === el.dataset.del);
    if (p && confirm(`Delete ${p.name} and all their progress? This can't be undone.`)) {
      state.profiles = state.profiles.filter(x => x !== p); save(); showParents();
    }
  });
}
function missionOf(k) {
  if (k.startsWith('wp-')) return 'story';
  if (k.startsWith('pv-')) return 'place';
  if (/^(add|sub)2/.test(k)) return 'twodigit';
  if (/[×÷]/.test(k)) return 'muldiv';
  return 'addsub';
}

/* ---------- boot ---------- */
if (me()) showHome(); else showProfiles();
})();
