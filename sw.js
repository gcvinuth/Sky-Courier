// Bump VERSION whenever you change any game file so players get the update.
const VERSION = 'sky-courier-v1';
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const CORE = ['./', './index.html', './game.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    // Cache three.js up front (CORS request, so module imports can reuse it offline).
    try { await cache.put(THREE_URL, await fetch(THREE_URL, { mode: 'cors' })); } catch (_) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const hit = await caches.match(e.request);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    } catch (_) {
      return (await caches.match('./index.html')) || Response.error();
    }
  })());
});
