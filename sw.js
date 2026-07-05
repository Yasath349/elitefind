const CACHE = 'elitefind-v1';
const SHELL = ['./', './index.html', './style.css', './app.js', './firebase-config.js', './manifest.json', './assets/icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for map tiles/APIs, cache-first for the app shell.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isShell = url.origin === self.location.origin;
  if (isShell) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => cached))
    );
  }
  // External requests (tiles, OSRM, Firebase, fonts) simply pass through to the network.
});
