/* Quest Academy offline support.
   The whole app (and the Spelling Bee recordings) is saved on the device the first time it opens with
   signal. With signal, files always come fresh from the server (and the saved copy is updated); without
   signal, or when the network is too slow, the saved copy is used. Sync (api/) is never cached. */
const CACHE = 'quest-academy-v2';
const FONT_CACHE = 'quest-academy-fonts-v1';
const NETWORK_WAIT = 4000;   // ms before a slow network gives way to the saved copy
const CORE = [
  './', 'index.html', 'style.css', 'themes.js', 'app.js', 'audio/spell-audio.js', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'subjects/reading.js', 'subjects/writing.js', 'subjects/science.js', 'subjects/social.js',
  'subjects/reading-45.js', 'subjects/writing-45.js', 'subjects/science-45.js', 'subjects/social-45.js',
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    // extras: a missing one shouldn't stop the app from working offline
    const extras = [];
    try {
      const map = await (await fetch('audio/spell-audio.js', { cache: 'reload' })).text();
      for (const m of map.matchAll(/"([a-z'-]+)":\s*true/g)) extras.push(cache.add(`audio/spell/${m[1]}.m4a`));
    } catch (e) { /* no recordings list */ }
    extras.push(cacheFonts());
    await Promise.allSettled(extras);
    self.skipWaiting();
  })());
});

async function cacheFonts() {
  const fonts = await caches.open(FONT_CACHE);
  const res = await fetch(FONT_CSS);
  if (!res.ok) return;
  await fonts.put(FONT_CSS, res.clone());
  const css = await res.text();
  const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
  await Promise.allSettled(urls.map(u => fonts.add(u)));
}

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== FONT_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(fontFirst(req));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (url.pathname.includes('/audio/spell/')) { event.respondWith(audioFirst(req)); return; }
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const key = req.mode === 'navigate' ? './' : req;
  // always ask the server (the browser's own cache may hold an old copy for a long time)
  const fromNet = fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' }).then(res => {
    if (res.ok && res.type === 'basic') cache.put(key, res.clone());
    return res;
  });
  const slow = new Promise(resolve => setTimeout(resolve, NETWORK_WAIT));
  try {
    const res = await Promise.race([fromNet, slow]);
    if (res) return res;
  } catch (e) { /* offline */ }
  const saved = await cache.match(key, { ignoreSearch: true });
  if (saved) return saved;
  return fromNet;   // nothing saved: keep waiting on the network
}

async function fontFirst(req) {
  const fonts = await caches.open(FONT_CACHE);
  const saved = await fonts.match(req);
  if (saved) return saved;
  const res = await fetch(req);
  if (res.ok) fonts.put(req, res.clone());
  return res;
}

// Recordings never change, so the saved copy is used first. Safari asks for audio in byte ranges,
// so a saved file is answered with just the part it asked for.
async function audioFirst(req) {
  const cache = await caches.open(CACHE);
  const url = new URL(req.url); url.search = '';
  let saved = await cache.match(url.href);
  if (!saved) {
    try {
      const res = await fetch(url.href);
      if (!res.ok) return res;
      await cache.put(url.href, res.clone());
      saved = res;
    } catch (e) { return Response.error(); }
  }
  const range = req.headers.get('range');
  if (!range) return saved;
  const buf = await saved.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : buf.byteLength - 1;
  if (!m[1] && m[2]) { start = Math.max(0, buf.byteLength - +m[2]); end = buf.byteLength - 1; }
  end = Math.min(end, buf.byteLength - 1);
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': saved.headers.get('Content-Type') || 'audio/mp4',
    'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
