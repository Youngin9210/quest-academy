/* Quest Academy creature companion: the 3D view only (rules are in pet-rules.js).
   Three.js r170, vendored at lib/three-0.170.0.module.min.js.
   mountCreature(el, look, opts) -> { update(look), celebrate(kind), dispose() } */
import * as THREE from './lib/three-0.170.0.module.min.js';

const R = window.PetRules;
const SIZE = [0.85, 0.72, 0.86, 1, 1.1];        // overall scale per stage
const HEAD_R = [0, 0.46, 0.43, 0.4, 0.4];      // head radius per stage (big heads when little)
const BODY_R = 0.42, BODY_Y = 0.45;
const DARK = 0x1d1b2f;

// Toon shading steps. Each mount makes its own and disposes it (a texture keeps the renderers it was
// uploaded to reachable, so one shared module-level texture would leak every old renderer).
function makeGradient() {
  const t = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
let gradientTex = null;   // the building mount's gradient; set only while build() runs (builds are synchronous)
const mat = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradientTex, ...extra });
function ball(r, color, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(color)); m.scale.set(sx, sy, sz); return m;
}
const cone = (r, h, color) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), mat(color));
const capsule = (r, len, color) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat(color));
const cyl = (rt, rb, h, color, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20, 1, open), mat(color, open ? { side: THREE.DoubleSide } : {}));
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

function canvasTexture(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sprite(tex, size, opacity = 1, additive = false) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  s.scale.set(size, size, 1); return s;
}
const shared = t => { t.userData.shared = true; return t; };   // survives disposeTree, freed with the mount
const glowTex = color => canvasTexture(g => {
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 32), c = '#' + color.toString(16).padStart(6, '0');
  r.addColorStop(0, c); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
const sparkleTex = () => canvasTexture(g => {
  g.fillStyle = '#fff8d6'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 7 : 30; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); }
  g.closePath(); g.fill();
});
const heartTex = () => canvasTexture(g => {
  g.fillStyle = '#ff6b8b'; g.beginPath(); g.moveTo(32, 54);
  g.bezierCurveTo(4, 34, 10, 8, 32, 22); g.bezierCurveTo(54, 8, 60, 34, 32, 54); g.fill();
});

/* ---------- the creature ---------- */
function buildEgg(colors) {
  const [body, belly] = colors, g = new THREE.Group();
  g.add(at(ball(0.42, belly, 1, 1.28, 1), 0, 0.55, 0));
  [[0.2, 0.75, 0.33], [-0.27, 0.5, 0.3], [0.05, 0.95, 0.28], [-0.08, 0.32, 0.38], [0.3, 0.42, 0.24]]
    .forEach(([x, y, z]) => g.add(at(ball(0.07, body, 1, 1, 0.45), x, y, z)));
  return { group: g, eyes: [], anchors: null };
}

function buildCreature(look, tex) {
  const sp = R.SPECIES[look.species], colors = sp.patterns[look.color] || sp.patterns[0];
  if (look.stage === 0) return buildEgg(colors);
  const [body, belly, accent] = colors, st = look.stage, hr = HEAD_R[st];
  const headY = BODY_Y + BODY_R * 0.9 + hr * 0.7;
  const g = new THREE.Group(), eyes = [];
  g.add(at(ball(BODY_R, body, 1, 1.08, 1), 0, BODY_Y, 0));
  g.add(at(ball(BODY_R * 0.68, belly, 1, 1.05, 0.45), 0, BODY_Y - 0.03, BODY_R * 0.8));
  g.add(at(ball(hr, body), 0, headY, 0.05));
  for (const s of [-1, 1]) {
    const e = hr * 0.17, eye = at(ball(e, DARK, 1, 1, 0.6), s * hr * 0.36, headY + hr * 0.08, 0.05 + hr * 0.93 - e * 0.2);   // sits on the head's surface
    eye.add(at(ball(e * 0.35, 0xffffff), e * 0.35, e * 0.4, e * 0.75));
    g.add(eye); eyes.push(eye);
    const cheek = at(ball(hr * 0.12, 0xff9aa2, 1, 0.6, 0.35), s * hr * 0.6, headY - hr * 0.22, 0.05 + hr * 0.76);
    cheek.material.transparent = true; cheek.material.opacity = 0.75; g.add(cheek);
    g.add(at(ball(BODY_R * 0.3, body, 1, 0.6, 1.3), s * BODY_R * 0.5, 0.08, BODY_R * 0.25));       // feet
    if (st >= 2) g.add(at(ball(BODY_R * 0.22, body, 1, 1.4, 1), s * BODY_R * 0.95, BODY_Y, BODY_R * 0.25)); // arms
  }
  const a = { headY, hr, neckY: BODY_Y + BODY_R * 0.8 };
  SPECIES_PARTS[look.species](g, a, { body, belly, accent }, st, tex);
  if (st === 4) {
    g.add(at(sprite(glowTex(accent), 2.4, 0.5, true), 0, BODY_Y + 0.2, -0.5));
  }
  return { group: g, eyes, anchors: a };
}

function sparkleAt(g, tex, x, y, z, size = 0.14) {
  const s = at(sprite(tex.sparkle, size, 0.9, true), x, y, z); s.userData.twinkle = Math.random() * 6; g.add(s);
}

const SPECIES_PARTS = {
  dragon(g, a, c, st, tex) {
    const { headY, hr } = a;
    g.add(at(ball(hr * 0.45, c.belly, 1.1, 0.7, 0.8), 0, headY - hr * 0.28, hr * 0.78));             // snout
    for (const s of [-1, 1]) {
      const horn = at(cone(hr * 0.15, hr * 0.5, c.accent), s * hr * 0.45, headY + hr * 0.85, -0.02);
      horn.rotation.z = -s * 0.3; g.add(horn);
      if (st >= 2) {
        const w = at(ball(BODY_R * (st >= 4 ? 0.75 : 0.48), c.accent, 0.22, 1, 0.8), s * BODY_R * 0.6, BODY_Y + BODY_R * 0.55, -BODY_R * 0.7);
        w.rotation.z = s * 0.7; g.add(w);
      }
    }
    const tail = at(cone(BODY_R * 0.3, BODY_R * 1.4, c.body), 0, 0.22, -BODY_R * 1.1);
    tail.rotation.x = -Math.PI / 2 - 0.45; g.add(tail);
    if (st >= 3) [0.2, 0.45, 0.7].forEach(t => g.add(at(cone(0.05, 0.12, c.accent), 0, BODY_Y + BODY_R * (1 - t) * 0.9, -BODY_R * (0.75 + t * 0.2))));
    if (st === 4) [[0, 0.1, -0.95], [0.1, 0.18, -1.15], [-0.08, 0.05, -1.3]].forEach(p => sparkleAt(g, tex, ...p));
  },
  fox(g, a, c, st, tex) {
    const { headY, hr } = a;
    g.add(at(ball(hr * 0.4, c.belly, 1, 0.75, 1.2), 0, headY - hr * 0.3, hr * 0.78));                // snout
    g.add(at(ball(hr * 0.09, DARK), 0, headY - hr * 0.2, hr * 1.25));                                  // nose
    for (const s of [-1, 1]) {
      const ear = at(cone(hr * 0.32, hr * 0.75, c.body), s * hr * 0.55, headY + hr * 0.85, 0);
      ear.rotation.z = -s * 0.25; g.add(ear);
      const inner = at(cone(hr * 0.18, hr * 0.45, c.belly), s * hr * 0.53, headY + hr * 0.8, hr * 0.12);
      inner.rotation.z = -s * 0.25; inner.scale.z = 0.5; g.add(inner);
    }
    const big = st >= 3 ? 1.2 : 1;
    const tail = at(ball(BODY_R * 0.45 * big, c.body, 0.8, 0.8, 1.8), 0, BODY_Y, -BODY_R * 1.25); tail.rotation.x = 0.6; g.add(tail);
    g.add(at(ball(BODY_R * 0.28 * big, c.belly, 1, 1, 1.2), 0, BODY_Y + 0.25 * big, -BODY_R * 1.8));
    if (st === 4) [[0, 0.75, -0.85], [0.08, 0.6, -1.0], [-0.06, 0.9, -0.95]].forEach(p => sparkleAt(g, tex, ...p));
  },
  axolotl(g, a, c, st, tex) {
    const { headY, hr } = a;
    const smile = at(new THREE.Mesh(new THREE.TorusGeometry(hr * 0.25, hr * 0.03, 8, 16, Math.PI), mat(DARK)), 0, headY - hr * 0.22, 0.05 + hr * 0.95);
    smile.rotation.z = Math.PI; g.add(smile);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const f = at(capsule(hr * 0.07, hr * (st >= 3 ? 0.55 : 0.42), c.accent), s * hr * 0.98, headY + (i - 1) * hr * 0.3, -0.02);
      f.rotation.z = s * (1.2 - (i - 1) * 0.5); g.add(f);
      if (st === 4) sparkleAt(g, tex, s * hr * 1.35, headY + (i - 1) * hr * 0.42, 0, 0.1);
    }
    const fin = at(ball(BODY_R * 0.6, c.body, 0.25, 0.9, 1.6), 0, BODY_Y - 0.05, -BODY_R * 1.1); g.add(fin);
  },
  bunnycat(g, a, c, st, tex) {
    const { headY, hr } = a;
    g.add(at(ball(hr * 0.08, 0xff8fab), 0, headY - hr * 0.12, 0.05 + hr * 0.97));                              // nose
    const earLen = hr * (st >= 3 ? 0.95 : 0.75);
    for (const s of [-1, 1]) {
      const ear = at(capsule(hr * 0.17, earLen, c.body), s * hr * 0.4, headY + hr * 0.9 + earLen * 0.45, 0);
      ear.rotation.z = -s * 0.15; g.add(ear);
      const inner = at(capsule(hr * 0.09, earLen * 0.8, c.accent), s * hr * 0.41, headY + hr * 0.9 + earLen * 0.45, hr * 0.12);
      inner.rotation.z = -s * 0.15; inner.scale.z = 0.4; g.add(inner);
      if (st === 4) g.add(at(ball(hr * 0.12, c.belly), s * hr * 0.47, headY + hr * 0.9 + earLen * 1.05, 0));
      for (const j of [-1, 1]) {
        const w = at(cyl(0.006, 0.006, hr * 0.6, DARK), s * hr * 0.75, headY - hr * 0.2 + j * 0.035, 0.05 + hr * 0.7);
        w.rotation.z = Math.PI / 2 + s * j * 0.15; g.add(w);
      }
    }
    g.add(at(ball(BODY_R * 0.3, c.belly), 0, BODY_Y - 0.1, -BODY_R * 0.95));                          // tail puff
    if (st === 4) [[0.35, 1.35, 0], [-0.35, 1.4, 0]].forEach(p => sparkleAt(g, tex, ...p, 0.12));
  },
};

/* ---------- gear ---------- */
const GEAR = {
  crown(a) {
    const g = new THREE.Group(), gold = 0xf2c94c, y = a.headY + a.hr * 0.92;
    g.add(at(cyl(a.hr * 0.42, a.hr * 0.45, a.hr * 0.22, gold, true), 0, y, 0));
    for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2; g.add(at(cone(0.035, 0.09, gold), Math.cos(t) * a.hr * 0.42, y + a.hr * 0.16, Math.sin(t) * a.hr * 0.42)); }
    return g;
  },
  glasses(a) {
    const g = new THREE.Group(), y = a.headY + a.hr * 0.08, z = 0.05 + a.hr * 0.96, frame = 0xd94b6a;   // in front of the eyes
    for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(a.hr * 0.23, a.hr * 0.05, 8, 24), mat(frame)), s * a.hr * 0.36, y, z));
    const bridge = at(cyl(0.015, 0.015, a.hr * 0.3, frame), 0, y, z);
    bridge.rotation.z = Math.PI / 2; g.add(bridge);
    return g;
  },
  goggles(a) {
    const g = new THREE.Group(), y = a.headY + a.hr * 0.15;
    const band = at(new THREE.Mesh(new THREE.TorusGeometry(a.hr * 1.0, 0.025, 8, 32), mat(0x26a69a)), 0, y, 0.03);
    band.rotation.x = Math.PI / 2; g.add(band);
    for (const s of [-1, 1]) { const l = at(cyl(a.hr * 0.2, a.hr * 0.2, 0.08, 0x80deea), s * a.hr * 0.36, y, 0.05 + a.hr * 0.93); l.rotation.x = Math.PI / 2; g.add(l); }
    return g;
  },
  explorerhat(a) {
    const g = new THREE.Group(), y = a.headY + a.hr * 0.78, khaki = 0xc8a96a;
    g.add(at(cyl(a.hr * 0.95, a.hr * 0.95, 0.03, khaki), 0, y, 0));
    g.add(at(ball(a.hr * 0.58, khaki, 1, 0.7, 1), 0, y + 0.02, 0));
    g.add(at(cyl(a.hr * 0.59, a.hr * 0.59, 0.05, 0x5d4037), 0, y + 0.04, 0));
    return g;
  },
  headphones(a) {
    const g = new THREE.Group(), c = 0x5b5fc7;
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(a.hr * 1.04, 0.03, 8, 24, Math.PI), mat(c)), 0, a.headY, 0));
    for (const s of [-1, 1]) { const cup = at(cyl(a.hr * 0.25, a.hr * 0.25, 0.1, c), s * a.hr * 1.02, a.headY, 0); cup.rotation.z = Math.PI / 2; g.add(cup); }
    return g;
  },
  scarf(a) {
    const g = new THREE.Group(), c = 0xe85d75;
    const ring = at(new THREE.Mesh(new THREE.TorusGeometry(BODY_R * 0.62, BODY_R * 0.13, 10, 24), mat(c)), 0, a.neckY, 0.02);
    ring.rotation.x = Math.PI / 2; g.add(ring);
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(BODY_R * 0.25, BODY_R * 0.6, 0.06), mat(c)), BODY_R * 0.3, a.neckY - BODY_R * 0.3, BODY_R * 0.55));
    return g;
  },
  cape(a) {
    const cape = at(ball(BODY_R * 1.0, 0xc0392b, 1, 1.1, 0.2), 0, BODY_Y + 0.02, -BODY_R * 0.78);
    cape.material.side = THREE.DoubleSide; return cape;
  },
  bookbag() {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(BODY_R * 0.9, BODY_R * 0.9, BODY_R * 0.45), mat(0x4a90d9)), 0, BODY_Y + 0.05, -BODY_R * 0.95));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(BODY_R * 0.92, BODY_R * 0.35, BODY_R * 0.47), mat(0x2f6fb5)), 0, BODY_Y + 0.2, -BODY_R * 0.95));
    return g;
  },
  featherpen() {
    const g = new THREE.Group();
    const f = at(ball(BODY_R * 0.18, 0xffffff, 0.5, 2.6, 0.3), BODY_R * 0.35, BODY_Y + BODY_R * 0.9, -BODY_R * 0.8); f.rotation.z = -0.4; g.add(f);
    const nib = at(cone(0.03, 0.12, DARK), BODY_R * 0.12, BODY_Y + BODY_R * 0.35, -BODY_R * 0.8); nib.rotation.z = Math.PI - 0.4; g.add(nib);
    return g;
  },
};

/* ---------- ground per world ---------- */
const GROUNDS = {
  space: { top: 0x8a8fb8, props: (g) => [[0.7, 0.3], [-0.75, -0.2], [0.4, -0.65]].forEach(([x, z], i) => g.add(at(ball(0.09 + i * 0.03, 0x6b6f99, 1.2, 0.7, 1), x, 0.03, z))) },
  ocean: { top: 0xf3d9a4, props: (g) => [[0.75, -0.3], [-0.7, -0.4], [-0.55, 0.45]].forEach(([x, z], i) => g.add(at(cone(0.05, 0.35 + i * 0.08, 0x3fb68b), x, 0.18, z))) },
  pets: { top: 0x8fd16a, props: (g) => [[0.7, 0.35, 0xff8fb1], [-0.72, -0.1, 0xffd54f], [0.35, -0.7, 0x9fa8da]].forEach(([x, z, c]) => g.add(at(ball(0.06, c), x, 0.06, z))) },
  bakery: { top: 0xf5e6d3, props: (g) => [[0.7, 0.2, 0xff6fa5], [-0.65, -0.35, 0x64b5f6], [0.2, -0.75, 0xffd54f], [-0.4, 0.55, 0x81c784]].forEach(([x, z, c]) => { const s = at(capsule(0.015, 0.06, c), x, 0.02, z); s.rotation.z = Math.PI / 2; s.rotation.y = x * 3; g.add(s); }) },
};
function buildGround(world) {
  const cfg = GROUNDS[world] || GROUNDS.space, g = new THREE.Group();
  g.add(at(cyl(1.15, 1.2, 0.12, cfg.top), 0, -0.06, 0));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; g.add(shadow);
  cfg.props(g);
  return g;
}

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry && !o.isSprite) o.geometry.dispose();   // sprite geometry is shared in r170
    if (o.material) { const m = o.material.map; if (m && !m.userData.shared) m.dispose(); o.material.dispose(); }
  });
}

/* ---------- mount ---------- */
export function mountCreature(el, look, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve });   // throws if WebGL is unavailable
  const cleanup = [];   // undo steps, added as setup attaches things (observers, listeners, textures)
  const undo = () => { while (cleanup.length) { try { cleanup.pop()(); } catch (e) { /* keep undoing */ } } };
  try { return setup(renderer, el, look, opts, cleanup, undo); }
  catch (err) {   // anything after the renderer exists must not leak a canvas, a GL context, an observer or a listener
    undo();
    renderer.domElement.remove(); renderer.dispose(); renderer.forceContextLoss();
    throw err;
  }
}

function setup(renderer, el, look, opts, cleanup, undo) {
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.touchAction = opts.interactive ? 'pan-y' : 'auto';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 1.45, 4.3); camera.lookAt(0, 0.8, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);

  const stageRoot = new THREE.Group(); scene.add(stageRoot);
  const pivot = new THREE.Group(); pivot.rotation.y = -0.45; stageRoot.add(pivot);   // turns with dragging
  const mover = new THREE.Group(); pivot.add(mover);       // hops and bobs
  const tex = { sparkle: shared(sparkleTex()), heart: shared(heartTex()) };   // one of each per mount
  cleanup.push(() => { tex.sparkle.dispose(); tex.heart.dispose(); });
  const gradient = makeGradient();
  cleanup.push(() => gradient.dispose());
  let ground = null, creature = null, gear = [], current = null;
  const fx = new THREE.Group(); stageRoot.add(fx);         // hearts and sparkles

  function build(next) {
    gradientTex = gradient;
    try {
      if (ground && (!current || current.ground !== next.ground)) { stageRoot.remove(ground); disposeTree(ground); ground = null; }
      if (!ground) { ground = buildGround(next.ground); stageRoot.add(ground); }
      if (creature) { mover.remove(creature.group); disposeTree(creature.group); }
      gear.forEach(gm => { mover.remove(gm); disposeTree(gm); }); gear = [];
      creature = buildCreature(next, tex);
      creature.group.scale.setScalar(SIZE[next.stage]);
      mover.add(creature.group);
      if (creature.anchors) for (const slot of ['head', 'neck', 'back']) {
        const id = next.wear && next.wear[slot];
        if (id && GEAR[id]) { const gm = GEAR[id](creature.anchors); gm.scale.setScalar(SIZE[next.stage]); mover.add(gm); gear.push(gm); }
      }
    } finally { gradientTex = null; }
    current = { ...next, wear: { ...(next.wear || {}) } };
  }
  build(look);

  let sizeW = 0, sizeH = 0;
  function resize() {
    const w = el.clientWidth || 200, h = el.clientHeight || 200;
    if (w === sizeW && h === sizeH) return;
    sizeW = w; sizeH = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.render(scene, camera);   // setSize clears the canvas; redraw so it is never left blank
  }
  resize();
  let ro = null, io = null;

  // animation state
  let hopT = -1, spinT = -1, last = performance.now(), t = 0, nextBlink = 2 + Math.random() * 3, raf = 0;
  const reduced = !!opts.reducedMotion;
  const floaters = [];   // { sprite, life, vy }

  function addFloater(tex, x, y, size, vy = 0.6) {
    const s = at(sprite(tex, size), x, y, 0.3); fx.add(s); floaters.push({ s, life: 1.2, vy });
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; t += dt;
    let y = 0;
    if (!reduced) {
      if (current.stage === 0) creature.group.rotation.z = Math.sin(t * 3) * 0.08 * (Math.sin(t * 0.7) > 0.3 ? 1 : 0.2);
      else y = Math.sin(t * 2) * 0.025;
    }
    if (hopT >= 0) { hopT += dt; const k = hopT / 0.45; y += k < 1 ? Math.sin(k * Math.PI) * (reduced ? 0.06 : 0.22) : 0; if (k >= 1) hopT = -1; }
    if (spinT >= 0) { spinT += dt; const k = Math.min(1, spinT / 0.9); mover.rotation.y = k * Math.PI * 2; if (k >= 1) { spinT = -1; mover.rotation.y = 0; } }
    mover.position.y = y;
    if (!reduced && creature.eyes.length) {
      nextBlink -= dt;
      const closed = nextBlink < 0 && nextBlink > -0.12;
      creature.eyes.forEach(e => { e.scale.y = closed ? 0.15 : 1; });
      if (nextBlink <= -0.12) nextBlink = 2.5 + Math.random() * 3;
    }
    creature.group.traverse(o => { if (o.userData.twinkle !== undefined && !reduced) o.material.opacity = 0.55 + 0.45 * Math.sin(t * 3 + o.userData.twinkle); });
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.life -= dt; f.s.position.y += f.vy * dt; f.s.material.opacity = Math.max(0, f.life);
      if (f.life <= 0) { fx.remove(f.s); disposeTree(f.s); floaters.splice(i, 1); }
    }
    renderer.render(scene, camera);
    const busy = hopT >= 0 || spinT >= 0 || floaters.length;
    if (visible && (!reduced || busy)) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  let intersecting = true, docVisible = document.visibilityState === 'visible', visible = intersecting && docVisible;
  const syncVisible = () => { visible = intersecting && docVisible; if (visible) kick(); };
  ro = new ResizeObserver(resize); cleanup.push(() => ro.disconnect()); ro.observe(el);
  io = new IntersectionObserver(entries => { intersecting = entries[entries.length - 1].isIntersecting; syncVisible(); });
  cleanup.push(() => io.disconnect()); io.observe(el);
  const onVis = () => { docVisible = document.visibilityState === 'visible'; syncVisible(); };
  document.addEventListener('visibilitychange', onVis);
  cleanup.push(() => document.removeEventListener('visibilitychange', onVis));
  cleanup.push(() => { cancelAnimationFrame(raf); raf = 0; visible = false; });

  function pet() {
    hopT = 0;
    if (!reduced) { addFloater(tex.heart, -0.2, 1.3, 0.22); addFloater(tex.heart, 0.25, 1.45, 0.18, 0.5); }
    if (opts.onPet) opts.onPet();
    kick();
  }

  // drag to turn, tap to pet
  let down = null;
  const onDown = e => { down = { x: e.clientX, y: e.clientY, rot: pivot.rotation.y, moved: false }; canvas.setPointerCapture(e.pointerId); };
  const onMove = e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) down.moved = true;
    if (down.moved) { pivot.rotation.y = down.rot + dx * 0.012; kick(); }
  };
  const onUp = () => { if (down && !down.moved) pet(); down = null; };
  const onCancel = () => { down = null; };
  if (opts.interactive) {
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onCancel);
    cleanup.push(() => { canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onCancel); });
  }

  kick();

  return {
    update(next) { build(next); kick(); },
    celebrate(kind) {
      if (reduced) {
        canvas.style.transition = 'none'; canvas.style.opacity = '0';
        void canvas.offsetWidth;   // force a style recalc so the fade-in actually transitions
        canvas.style.transition = 'opacity .6s'; canvas.style.opacity = '1';
        kick(); return;
      }
      hopT = 0; if (kind === 'grow') spinT = 0;
      for (let i = 0; i < (kind === 'grow' ? 6 : 3); i++) addFloater(tex.sparkle, (Math.random() - 0.5) * 1.4, 0.4 + Math.random() * 0.9, 0.16, 0.4);
      kick();
    },
    dispose() {
      undo();   // stops the loop, observers, listeners; frees the shared textures and the gradient
      disposeTree(scene);
      renderer.dispose(); renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
