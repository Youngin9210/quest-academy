/* Quest Academy adventure map: the drawn scene for one region, its stop buttons, the creature token and the villains.
   Loaded on demand by app.js. Spec: docs/superpowers/specs/2026-11-17-adventure-map-design.md */
const W = 360, H = 900;
// marker centers, stop 1 at the bottom up to the boss at the top
export const POINTS = [[105, 815], [255, 695], [105, 575], [255, 455], [105, 335], [180, 165]];
const BONUS = [312, 575];

// per world: 6 sky gradients (one per region), ground color, path color, decoration style
const STYLE = {
  space: { skies: [['#120d3a', '#2d2170'], ['#0e1a3f', '#283c7a'], ['#1d0f3a', '#4a2a6e'], ['#0b2236', '#22506b'], ['#231236', '#5b2b5e'], ['#06122b', '#1f3166']], ground: '#3b3478', path: '#ffcb47' },
  ocean: { skies: [['#5fd3f3', '#1f8fc4'], ['#2fb39a', '#11695e'], ['#3fa0e0', '#1a5a9e'], ['#2a7fa8', '#173f63'], ['#14466e', '#071b33'], ['#5a7fd6', '#22357a']], ground: '#f3d9a4', path: '#fff6d8' },
  pets: { skies: [['#bfe9ff', '#e9f8d2'], ['#ffe3ef', '#fff4e0'], ['#d8f3c8', '#fffbe6'], ['#cdeaff', '#e5f7d4'], ['#ffeccc', '#dff6ff'], ['#efe0ff', '#fff0f6']], ground: '#8fd16a', path: '#b98a5a' },
  bakery: { skies: [['#ffe8d1', '#fff6ec'], ['#ffd9e6', '#fff1f5'], ['#fbe3ff', '#fff3e6'], ['#ffe2c2', '#fff8e1'], ['#ffd6f0', '#e8f4ff'], ['#fff0b8', '#ffe1ec']], ground: '#e9b98a', path: '#ff8fab' },
};

// small seeded random so a region always draws the same
function rng(seed) { let a = seed * 9301 + 49297; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; }

const WORLD_SEED = { space: 1, ocean: 2, pets: 3, bakery: 4 };

function decoFor(world, region) {
  const r = rng((WORLD_SEED[world] || 1) * 10 + region + 1), out = [];
  const px = () => Math.round(r() * W), py = (top = 0, bottom = H) => Math.round(top + r() * (bottom - top));
  if (world === 'space') {
    for (let i = 0; i < 46; i++) out.push(`<circle cx="${px()}" cy="${py()}" r="${(r() * 1.8 + .6).toFixed(1)}" fill="#fff" opacity="${(r() * .6 + .3).toFixed(2)}"/>`);
    for (let i = 0; i < 2; i++) { const x = px(), y = py(80, 700), s = 18 + r() * 22;
      out.push(`<g opacity=".85"><circle cx="${x}" cy="${y}" r="${s.toFixed(0)}" fill="${['#ff9a8b', '#8bd3ff', '#c8a2ff'][(region + i) % 3]}"/><ellipse cx="${x}" cy="${y}" rx="${(s * 1.7).toFixed(0)}" ry="${(s * .35).toFixed(0)}" fill="none" stroke="#ffe08a" stroke-width="3"/></g>`); }
    for (let i = 0; i < 5; i++) out.push(`<ellipse cx="${px()}" cy="${py(860, 895)}" rx="${(10 + r() * 14).toFixed(0)}" ry="5" fill="#2a2462"/>`);
  } else if (world === 'ocean') {
    for (let i = 0; i < 26; i++) out.push(`<circle cx="${px()}" cy="${py(0, 820)}" r="${(r() * 7 + 3).toFixed(1)}" fill="none" stroke="#fff" stroke-width="2" opacity="${(r() * .4 + .25).toFixed(2)}"/>`);
    for (let i = 0; i < 7; i++) { const x = px(), h = 60 + r() * 90;
      out.push(`<path d="M${x} ${H} q -14 -${(h / 3).toFixed(0)} 0 -${(h / 1.5).toFixed(0)} q 14 -${(h / 6).toFixed(0)} 0 -${(h / 3).toFixed(0)}" fill="none" stroke="#2fae6b" stroke-width="7" stroke-linecap="round"/>`); }
  } else if (world === 'pets') {
    for (let i = 0; i < 14; i++) { const x = px(), y = py(60, 860), c = '#7b5a3a';
      out.push(`<g opacity=".22" fill="${c}"><ellipse cx="${x}" cy="${y}" rx="7" ry="6"/><circle cx="${x - 7}" cy="${y - 9}" r="3"/><circle cx="${x}" cy="${y - 12}" r="3"/><circle cx="${x + 7}" cy="${y - 9}" r="3"/></g>`); }
    for (let i = 0; i < 6; i++) { const x = px(), y = py(40, 300);
      out.push(`<g fill="#fff" opacity=".8"><circle cx="${x}" cy="${y}" r="16"/><circle cx="${x + 18}" cy="${y + 4}" r="13"/><circle cx="${x - 16}" cy="${y + 5}" r="11"/></g>`); }
  } else {
    const cols = ['#ff6fa5', '#ffd23f', '#59c3ff', '#7ee081', '#b388ff'];
    for (let i = 0; i < 60; i++) { const x = px(), y = py(); out.push(`<rect x="${x}" y="${y}" width="10" height="3" rx="1.5" fill="${cols[i % cols.length]}" transform="rotate(${Math.round(r() * 180)} ${x} ${y})" opacity=".7"/>`); }
    for (let i = 0; i < 4; i++) out.push(`<circle cx="${px()}" cy="${py(100, 800)}" r="${(10 + r() * 12).toFixed(0)}" fill="#fff" opacity=".55"/>`);
  }
  return out.join('');
}

function pathD() {
  let d = `M${POINTS[0][0]} ${POINTS[0][1] + 60}`;
  d += ` L${POINTS[0][0]} ${POINTS[0][1]}`;
  for (let i = 1; i < POINTS.length; i++) {
    const [x0, y0] = POINTS[i - 1], [x1, y1] = POINTS[i], my = (y0 + y1) / 2;
    d += ` C${x0} ${my} ${x1} ${my} ${x1} ${y1}`;
  }
  return d;
}

function sceneSvg(world, region) {
  const st = STYLE[world] || STYLE.space, [top, bottom] = st.skies[region] || st.skies[0];
  return `<svg class="adv-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id="advSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#advSky)"/>
    <path d="M0 ${H - 70} Q ${W / 2} ${H - 110} ${W} ${H - 70} V ${H} H 0 Z" fill="${st.ground}"/>
    ${decoFor(world, region)}
    <path d="${pathD()}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="26" stroke-linecap="round"/>
    <path d="${pathD()}" fill="none" stroke="${st.path}" stroke-width="18" stroke-linecap="round"/>
    <path d="${pathD()}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round"/>
  </svg>`;
}

const pct = ([x, y]) => `left:${(x / W * 100).toFixed(2)}%;top:${(y / H * 100).toFixed(2)}%`;
const starRow = n => `<span class="adv-stars" aria-hidden="true">${[1, 2, 3].map(k => `<i class="${k <= n ? 'on' : ''}">★</i>`).join('')}</span>`;
const escAttr = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function drawMap(el, o) {
  const tokenAt = i => { const j = Math.min(i, POINTS.length - 1), [dx, dy] = j === 5 ? [78, 12] : [40, -34]; return [POINTS[j][0] + dx, POINTS[j][1] + dy]; };
  const stops = o.stops.map((s, i) => {
    if (!s) return '';
    const done = i < o.stop, next = i === o.stop, locked = !done && !next, stars = s.stars || 0;
    const label = done ? `Stop ${i + 1}: ${s.name}, ${stars} ${stars === 1 ? 'star' : 'stars'}. Play again` : next ? `Stop ${i + 1}: ${s.name}. Play now` : `Stop ${i + 1}: ${s.name}, locked`;
    return `<button type="button" class="adv-stop ${done ? 'done' : ''} ${next ? 'next' : ''}" data-stop="${i}" style="${pct(POINTS[i])}" aria-label="${escAttr(label)}" ${locked ? 'disabled' : ''}>
      <span class="adv-icon" aria-hidden="true">${s.icon}</span>${done ? starRow(s.stars) : ''}</button>`;
  }).join('');
  const bossOpen = o.stop >= 5;
  const boss = `<button type="button" class="adv-stop adv-boss ${bossOpen ? 'next' : ''}" data-stop="5" style="${pct(POINTS[5])}" aria-label="${escAttr(bossOpen ? `Boss: ${o.boss.name}. Play now` : `Boss: ${o.boss.name}, locked`)}" ${bossOpen ? '' : 'disabled'}>
      <span class="adv-face" aria-hidden="true">${o.boss.face}</span></button>`;
  const bonus = o.bonus ? `<button type="button" class="adv-stop adv-bonus" data-bonus style="${pct(BONUS)}" aria-label="Today's Quest bonus stop"><span class="adv-icon" aria-hidden="true">⭐</span></button>` : '';
  const start = tokenAt(o.from != null ? o.from : o.stop);
  el.innerHTML = `<div class="adv-map">${sceneSvg(o.world, o.region)}${stops}${boss}${bonus}
    <div class="adv-token" id="advToken" style="${pct(start)}" aria-hidden="true">${o.token}</div></div>`;
  const tok = el.querySelector('#advToken');
  return {
    hopTo(i) {
      const to = tokenAt(i);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        tok.classList.add('hop');
        tok.setAttribute('style', pct(to));
        setTimeout(() => tok.classList.remove('hop'), 800);
      }));
    },
  };
}

// one villain per world, a different hat in each region
const HATS = [
  '',
  '<path d="M26 30 Q50 6 74 30 Z" fill="#e94b5b"/><rect x="22" y="28" width="56" height="6" rx="3" fill="#b8323f"/>',
  '<rect x="32" y="4" width="36" height="26" rx="3" fill="#2b2b3a"/><rect x="24" y="27" width="52" height="6" rx="3" fill="#2b2b3a"/><rect x="32" y="20" width="36" height="5" fill="#e94b5b"/>',
  '<path d="M20 30 Q50 14 80 30 L80 34 Q50 26 20 34 Z" fill="#3a7bd5"/><circle cx="82" cy="34" r="5" fill="#3a7bd5"/>',
  '<path d="M30 32 L50 0 L70 32 Z" fill="#7c4dff"/><circle cx="50" cy="14" r="3" fill="#ffd23f"/><circle cx="44" cy="24" r="2" fill="#ffd23f"/>',
  '<path d="M28 32 L32 12 L42 24 L50 8 L58 24 L68 12 L72 32 Z" fill="#ffcb2f" stroke="#c99400" stroke-width="2"/>',
];
export function villainSvg(world, region) {
  const hat = HATS[region % HATS.length];
  const eyes = (y, c = '#fff') => `<circle cx="40" cy="${y}" r="7" fill="${c}"/><circle cx="60" cy="${y}" r="7" fill="${c}"/><circle cx="41" cy="${y + 1}" r="3" fill="#222"/><circle cx="61" cy="${y + 1}" r="3" fill="#222"/><path d="M33 ${y - 9} L46 ${y - 5} M67 ${y - 9} L54 ${y - 5}" stroke="#222" stroke-width="3" stroke-linecap="round"/>`;
  let body;
  if (world === 'ocean') body = `<ellipse cx="50" cy="66" rx="32" ry="22" fill="#ef5b4a"/><path d="M14 52 q-8 -14 6 -18 q-2 8 6 10 z M86 52 q8 -14 -6 -18 q2 8 -6 10 z" fill="#ef5b4a"/>
      <line x1="40" y1="46" x2="40" y2="34" stroke="#ef5b4a" stroke-width="4"/><line x1="60" y1="46" x2="60" y2="34" stroke="#ef5b4a" stroke-width="4"/>${eyes(32)}<path d="M38 72 Q50 66 62 72" fill="none" stroke="#7a1f16" stroke-width="3" stroke-linecap="round"/>`;
  else if (world === 'pets') body = `<path d="M22 44 L28 20 L42 36 Z M78 44 L72 20 L58 36 Z" fill="#8d8d99"/><circle cx="50" cy="60" r="30" fill="#a7a7b3"/>
      <path d="M22 56 Q50 40 78 56 Q50 66 22 56 Z" fill="#3b3b47"/>${eyes(56)}<circle cx="50" cy="72" r="4" fill="#222"/><path d="M42 80 Q50 76 58 80" fill="none" stroke="#222" stroke-width="2.5" stroke-linecap="round"/>`;
  else if (world === 'bakery') body = `<circle cx="26" cy="38" r="14" fill="#c99a75"/><circle cx="74" cy="38" r="14" fill="#c99a75"/><circle cx="26" cy="38" r="7" fill="#f2b8c6"/><circle cx="74" cy="38" r="7" fill="#f2b8c6"/>
      <circle cx="50" cy="62" r="28" fill="#d8ab86"/>${eyes(56)}<circle cx="50" cy="70" r="4" fill="#e86a8a"/><path d="M30 70 H18 M30 74 H20 M70 70 H82 M70 74 H80" stroke="#6b4a33" stroke-width="2"/><path d="M43 79 Q50 84 57 79" fill="none" stroke="#6b4a33" stroke-width="2.5" stroke-linecap="round"/>`;
  else body = `<path d="M18 48 L8 30 L30 42 Z M82 48 L92 30 L70 42 Z" fill="#5ccf7a"/><circle cx="50" cy="60" r="30" fill="#6fe08c"/><line x1="50" y1="30" x2="50" y2="18" stroke="#5ccf7a" stroke-width="3"/><circle cx="50" cy="16" r="4" fill="#ffd23f"/>
      ${eyes(56)}<path d="M36 72 Q50 82 64 72" fill="#2d6b3d"/><path d="M42 73 L44 77 L46 73 M54 73 L56 77 L58 73" fill="#fff"/>`;
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">${body}${world === 'ocean' ? `<g transform="translate(50 21) scale(.5) translate(-50 -34)">${hat}</g>` : hat}</svg>`;
}

// her creature as a small flat token (or her egg)
export function tokenSvg(look) {
  if (!look || look.egg) return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false"><ellipse cx="32" cy="58" rx="16" ry="4" fill="#000" opacity=".2"/>
    <ellipse cx="32" cy="34" rx="18" ry="23" fill="#fff6e0" stroke="#e8c98f" stroke-width="2"/><path d="M18 34 l6 -5 l6 5 l6 -5 l6 5 l4 -3" fill="none" stroke="#f4a259" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  const { species, body, belly, accent } = look;
  const ears = {
    dragon: `<path d="M20 18 L16 4 L27 14 Z M44 18 L48 4 L37 14 Z" fill="${accent}"/>`,
    fox: `<path d="M17 22 L14 4 L29 15 Z M47 22 L50 4 L35 15 Z" fill="${body}"/><path d="M18 18 L17 9 L25 15 Z M46 18 L47 9 L39 15 Z" fill="${accent}"/>`,
    axolotl: `<path d="M12 24 l-8 -6 M12 28 l-9 0 M12 32 l-8 6 M52 24 l8 -6 M52 28 l9 0 M52 32 l8 6" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`,
    bunnycat: `<ellipse cx="24" cy="8" rx="5" ry="12" fill="${body}"/><ellipse cx="40" cy="8" rx="5" ry="12" fill="${body}"/><ellipse cx="24" cy="9" rx="2.5" ry="8" fill="${accent}"/><ellipse cx="40" cy="9" rx="2.5" ry="8" fill="${accent}"/>`,
  }[species] || '';
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false"><ellipse cx="32" cy="59" rx="16" ry="4" fill="#000" opacity=".2"/>
    ${ears}<circle cx="32" cy="34" r="22" fill="${body}"/><ellipse cx="32" cy="42" rx="12" ry="10" fill="${belly}"/>
    <circle cx="24" cy="30" r="4.5" fill="#fff"/><circle cx="40" cy="30" r="4.5" fill="#fff"/><circle cx="25" cy="31" r="2.4" fill="#222"/><circle cx="41" cy="31" r="2.4" fill="#222"/>
    <path d="M28 39 Q32 42 36 39" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/></svg>`;
}
