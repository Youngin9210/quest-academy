/* Quest Academy stop games: the small untimed scene above the questions at a map stop (Build, Journey, Collect)
   and the trophy a finished stop leaves on the map. Loaded on demand by app.js.
   Spec: docs/superpowers/specs/2026-11-18-stop-games-design.md */
const W = 360, H = 140, GROUND = 112, GOLD = '#ffcf3f', MOVES = 6;
const TYPES = ['build', 'journey', 'collect'];

const LOOK = {
  space: { sky: ['#120d3a', '#2d2170'], ground: '#3b3478', bag: '#5b4bb0' },
  ocean: { sky: ['#5fd3f3', '#1f8fc4'], ground: '#f3d9a4', bag: '#2a7fa8' },
  pets: { sky: ['#bfe9ff', '#e9f8d2'], ground: '#8fd16a', bag: '#c0703f' },
  bakery: { sky: ['#ffe8d1', '#fff6ec'], ground: '#e9b98a', bag: '#ff8fab' },
};

// Build: 6 pieces from the bottom up. {F} is the piece's fill: the plain color, the gold color, or 'none' for a ghost.
const BUILD = {
  space: { name: 'Rocket', plain: ['#9aa4c7', '#e9edf7', '#e9edf7', '#e9edf7', '#ff6b6b', '#ffd23f'], pieces: [
    '<path d="M222 122 L232 98 L268 98 L278 122 Z" fill="{F}"/>',
    '<rect x="234" y="80" width="32" height="20" rx="3" fill="{F}"/>',
    '<rect x="234" y="60" width="32" height="20" rx="3" fill="{F}"/><circle cx="250" cy="70" r="6" fill="#bfe6ff"/>',
    '<rect x="234" y="42" width="32" height="18" rx="3" fill="{F}"/>',
    '<path d="M234 42 Q250 6 266 42 Z" fill="{F}"/>',
    '<path d="M250 14 V2 L262 6 L250 10" stroke="{F}" stroke-width="3" fill="{F}"/>'] },
  ocean: { name: 'Sandcastle', plain: ['#e8c88a', '#f0d49b', '#e8c88a', '#e8c88a', '#f0d49b', '#ff6b6b'], pieces: [
    '<rect x="214" y="104" width="72" height="18" fill="{F}"/>',
    '<rect x="222" y="86" width="56" height="18" fill="{F}"/>',
    '<rect x="222" y="62" width="14" height="24" fill="{F}"/><path d="M220 62 h18 l-9 -10 z" fill="{F}"/>',
    '<rect x="264" y="62" width="14" height="24" fill="{F}"/><path d="M262 62 h18 l-9 -10 z" fill="{F}"/>',
    '<rect x="241" y="46" width="18" height="40" fill="{F}"/><path d="M239 46 h22 l-11 -12 z" fill="{F}"/>',
    '<path d="M250 34 V12 L264 17 L250 22" stroke="{F}" stroke-width="3" fill="{F}"/>'] },
  pets: { name: 'Doghouse', plain: ['#8a5a3a', '#d9824b', '#d9824b', '#b34a3c', '#5a3a2a', '#f5efe0'], pieces: [
    '<rect x="212" y="114" width="76" height="8" rx="2" fill="{F}"/>',
    '<rect x="218" y="74" width="32" height="40" fill="{F}"/>',
    '<rect x="250" y="74" width="32" height="40" fill="{F}"/>',
    '<path d="M208 76 L250 38 L292 76 Z" fill="{F}"/>',
    '<path d="M238 114 V100 a12 12 0 0 1 24 0 V114 Z" fill="{F}"/>',
    '<g fill="{F}"><rect x="238" y="22" width="24" height="8" rx="4"/><circle cx="238" cy="22" r="5"/><circle cx="238" cy="30" r="5"/><circle cx="262" cy="22" r="5"/><circle cx="262" cy="30" r="5"/></g>'] },
  bakery: { name: 'Cake', plain: ['#e8eef7', '#f7c1d4', '#fbe2a8', '#c9a6f5', '#ffffff', '#e2343f'], pieces: [
    '<ellipse cx="250" cy="120" rx="44" ry="6" fill="{F}"/>',
    '<rect x="214" y="92" width="72" height="26" rx="4" fill="{F}"/>',
    '<rect x="222" y="68" width="56" height="24" rx="4" fill="{F}"/>',
    '<rect x="230" y="46" width="40" height="22" rx="4" fill="{F}"/>',
    '<path d="M228 48 Q250 36 272 48 V54 q-5 6 -10 0 q-6 6 -12 0 q-6 6 -12 0 q-5 6 -10 0 Z" fill="{F}"/>',
    '<circle cx="250" cy="32" r="7" fill="{F}"/><path d="M250 25 q4 -10 10 -12" stroke="#3a7d2c" stroke-width="2" fill="none"/>'] },
};

// Journey: 7 spots (start + 6 steps), an obstacle between each pair of spots, and a goal at the end
const spotX = k => 34 + k * 46;
const JOURNEY = {
  space: { goalName: 'flag', color: '#8bd3ff',
    obstacle: x => `<ellipse cx="${x}" cy="${GROUND + 5}" rx="11" ry="4" fill="#241f55"/>`,
    goal: `<path d="M338 112 V72" stroke="#ddd" stroke-width="3"/><path d="M338 72 L356 79 L338 86 Z" fill="#ff6b6b"/>` },
  ocean: { goalName: 'treasure chest', color: '#ffffff',
    obstacle: x => `<path d="M${x} ${GROUND} q-6 -10 0 -20 q6 -10 0 -18" stroke="#2fae6b" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    goal: `<rect x="324" y="94" width="30" height="18" rx="2" fill="#a0642c"/><path d="M324 96 Q339 80 354 96 Z" fill="#c07a38"/><rect x="336" y="96" width="6" height="7" fill="#ffd23f"/>` },
  pets: { goalName: 'picnic', color: '#8a5a3a',
    obstacle: x => `<g fill="#5bb04a"><circle cx="${x - 6}" cy="${GROUND - 4}" r="7"/><circle cx="${x + 6}" cy="${GROUND - 4}" r="7"/><circle cx="${x}" cy="${GROUND - 10}" r="8"/></g>`,
    goal: `<path d="M318 112 L330 100 H358 L350 112 Z" fill="#ff6b6b"/><path d="M322 108 h30 M326 104 h28" stroke="#fff" stroke-width="2"/><rect x="332" y="86" width="16" height="12" rx="2" fill="#c0703f"/><path d="M332 88 Q340 76 348 88" stroke="#8a4f2a" stroke-width="2" fill="none"/>` },
  bakery: { goalName: 'gingerbread house', color: '#ff6fa5',
    obstacle: x => `<circle cx="${x}" cy="${GROUND - 6}" r="6" fill="#ff6fa5"/><path d="M${x - 10} ${GROUND - 6} l4 -4 v8 z M${x + 10} ${GROUND - 6} l-4 -4 v8 z" fill="#ff6fa5"/>`,
    goal: `<rect x="322" y="88" width="32" height="24" fill="#b5713d"/><path d="M318 90 L338 70 L358 90 Z" fill="#fff"/><path d="M320 90 L338 72 L356 90" stroke="#ff8fab" stroke-width="3" fill="none"/><rect x="334" y="98" width="8" height="14" rx="3" fill="#6b3a1e"/>` },
};

// Collect: a bag with 6 slots; each world's treasure is drawn around (0, 0)
const SLOTS = [[252, 74], [280, 74], [308, 74], [252, 100], [280, 100], [308, 100]];
const COLLECT = {
  space: { name: 'Star crystals', plain: '#bfe6ff', shape: f => `<path d="M0 -9 L2.6 -2.8 9 -2.8 3.9 1.2 5.6 8 0 4 -5.6 8 -3.9 1.2 -9 -2.8 -2.6 -2.8Z" fill="${f}"/>` },
  ocean: { name: 'Pearls', plain: '#f4f1ff', shape: f => `<circle r="8" fill="${f}"/><circle cx="-3" cy="-3" r="2.5" fill="#fff" opacity=".8"/>` },
  pets: { name: 'Bones', plain: '#f5efe0', shape: f => `<g fill="${f}"><rect x="-8" y="-3" width="16" height="6" rx="3"/><circle cx="-8" cy="-3" r="3.5"/><circle cx="-8" cy="3" r="3.5"/><circle cx="8" cy="-3" r="3.5"/><circle cx="8" cy="3" r="3.5"/></g>` },
  bakery: { name: 'Cherries', plain: '#e2343f', shape: f => `<circle cy="2" r="7" fill="${f}"/><path d="M0 -5 q3 -7 8 -8" stroke="#3a7d2c" stroke-width="2" fill="none"/>` },
};

const worldOf = w => (LOOK[w] ? w : 'space');
const typeOf = t => (TYPES.includes(t) ? t : 'build');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// one placed move, or a ghost for a move still to come
function cls(moves, k, fresh) {
  const m = moves[k];
  if (!m) return `sc-ghost${k === moves.length ? ' sc-next' : ''}`;
  return `sc-piece${m === 'gold' ? ' sc-gold' : ''}${fresh && k === moves.length - 1 ? ' sc-new' : ''}`;
}

function buildSvg(w, moves, fresh) {
  const b = BUILD[w];
  return b.pieces.map((pc, k) => {
    const fill = !moves[k] ? 'none' : moves[k] === 'gold' ? GOLD : b.plain[k];
    return `<g class="${cls(moves, k, fresh)}">${pc.replace(/\{F\}/g, fill)}</g>`;
  }).join('');
}

function journeySvg(w, moves, fresh) {
  const j = JOURNEY[w];
  let out = '';
  for (let k = 0; k < MOVES; k++) out += j.obstacle(spotX(k) + 23);
  out += j.goal;
  for (let k = 0; k < MOVES; k++) {
    const m = moves[k], fill = !m ? 'none' : m === 'gold' ? GOLD : j.color;
    out += `<circle class="${cls(moves, k, fresh)}" cx="${spotX(k + 1)}" cy="${GROUND + 8}" r="5" fill="${fill}"/>`;
  }
  return out;
}

function bagSvg(w, moves, fresh) {
  const c = COLLECT[w], bag = LOOK[w].bag;
  let out = `<path d="M262 46 Q280 30 298 46" stroke="${bag}" stroke-width="4" fill="none"/>
    <path d="M232 56 Q230 46 242 46 H318 Q330 46 328 56 L334 120 H226 Z" fill="${bag}"/>`;
  SLOTS.forEach(([x, y], k) => {
    const m = moves[k];
    out += `<g transform="translate(${x} ${y})"><circle r="10" class="sc-slot"/>${m ? `<g class="${cls(moves, k, fresh)}">${c.shape(m === 'gold' ? GOLD : c.plain)}</g>` : `<g class="${cls(moves, k, fresh)}"><circle r="8" fill="none"/></g>`}</g>`;
  });
  return out;
}

function decoSvg(w) {
  if (w !== 'space') return '';
  return [[20, 18], [70, 40], [130, 14], [180, 52], [320, 20], [350, 60], [100, 80], [200, 28]]
    .map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 3 ? 1.2 : 1.8}" fill="#fff" opacity=".7"/>`).join('');
}

const sparkSvg = (x, y) => `<g class="sc-spark" transform="translate(${x} ${y})" fill="${GOLD}">${[[0, -16], [15, 0], [0, 16], [-15, 0]]
  .map(([dx, dy]) => `<path transform="translate(${dx} ${dy})" d="M0 -5 L1.5 -1.5 5 0 1.5 1.5 0 5 -1.5 1.5 -5 0 -1.5 -1.5Z"/>`).join('')}</g>`;

export function sceneLabel(type, world, count) {
  const w = worldOf(world), t = typeOf(type);
  if (t === 'journey') return `Journey to the ${JOURNEY[w].goalName}: ${count} of ${MOVES} steps`;
  if (t === 'collect') return `${COLLECT[w].name}: ${count} of ${MOVES} collected`;
  return `${BUILD[w].name}: ${count} of ${MOVES} pieces`;
}

export function sceneHtml(o) {
  const w = worldOf(o.world), t = typeOf(o.type), L = LOOK[w], moves = (o.moves || []).slice(0, MOVES), n = moves.length, fresh = !!o.fresh && n > 0;
  let art, tokX = 120, from = null, spark = null;
  if (t === 'journey') {
    art = journeySvg(w, moves, fresh); tokX = spotX(n);
    if (fresh) { from = spotX(n - 1); spark = [spotX(n), GROUND + 8]; }
  } else if (t === 'collect') {
    art = bagSvg(w, moves, fresh); if (fresh) spark = SLOTS[n - 1];
  } else {
    art = buildSvg(w, moves, fresh); if (fresh) spark = [250, 118 - (n - 1) * 20];
  }
  const shine = fresh && moves[n - 1] === 'gold' ? sparkSvg(spark[0], spark[1]) : '';
  const pct = x => (x / W * 100).toFixed(2) + '%', groundPct = (GROUND / H * 100).toFixed(2) + '%';
  // the ground runs the full width of the strip, past the drawing's own box
  return `<div class="scene" role="img" aria-label="${esc(sceneLabel(t, w, n))}" style="background:linear-gradient(${L.sky[0]}, ${L.sky[1]} ${groundPct}, ${L.ground} ${groundPct})">
    <div class="scene-box"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${decoSvg(w)}
      <rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="${L.ground}"/>${art}${shine}</svg>
      <div class="sc-token${from != null ? ' hop' : ''}" style="left:${pct(tokX)};top:${(GROUND / H * 100).toFixed(2)}%${from != null ? `;--from:${pct(from)}` : ''}" aria-hidden="true">${o.token || ''}</div>
    </div></div>`;
}

export function sceneMove(el, o, kind) {
  if (!el) return;
  if (kind === 'miss') {
    const s = el.querySelector('.scene');
    if (!s) return;
    s.classList.remove('sc-miss'); void s.offsetWidth; s.classList.add('sc-miss');
    return;
  }
  // the Journey hop is pure CSS: the token is drawn at its new spot and slides in from --from
  el.innerHTML = sceneHtml(Object.assign({}, o, { fresh: true }));
}

export function trophySvg(type, world, gold) {
  const w = worldOf(world), t = typeOf(type);
  let vb, body;
  if (t === 'journey') {
    vb = '0 0 40 50';
    body = `<ellipse cx="8" cy="46" rx="7" ry="2" fill="#000" opacity=".25"/><path d="M8 46 V6" stroke="#5a4a3a" stroke-width="3" stroke-linecap="round"/><path d="M8 6 L36 14 L8 22 Z" fill="${gold ? GOLD : JOURNEY[w].color}" stroke="#00000033"/>`;
  } else if (t === 'collect') {
    vb = '222 28 116 96';
    body = bagSvg(w, Array(MOVES).fill(gold ? 'gold' : 'plain'), false);
  } else {
    vb = '204 0 92 126';
    const b = BUILD[w];
    body = b.pieces.map((pc, k) => pc.replace(/\{F\}/g, gold ? GOLD : b.plain[k])).join('');
  }
  return `<svg aria-hidden="true" focusable="false" viewBox="${vb}" width="100%" height="100%"${gold ? ' class="sc-gold"' : ''}>${body}</svg>`;
}
