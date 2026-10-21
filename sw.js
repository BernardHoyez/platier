const CACHE_NAME = 'platier-cache-v1';
const PRECACHE_ASSETS = [
  './', './index.html', './style.css', './app.js', './manifest.json',
  './icon-192.png', './icon-512.png',
  './vendor/leaflet.js', './vendor/leaflet.css', './vendor/geotiff.js',
  './vendor/sql-wasm.js', './vendor/sql-wasm.wasm'
];
const scopePath = (p) => new URL(p, self.registration.scope).pathname;
// Fichiers de l'app : réseau d'abord (jamais de version obsolète si on est en ligne)
const NETWORK_FIRST = ['./', './index.html', './style.css', './app.js', './manifest.json'].map(scopePath);

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    clients.claim(),
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  ]));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Tuiles IGN/OSM, WMS : laissées au réseau (pas d'interception)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || NETWORK_FIRST.includes(url.pathname)) {
    event.respondWith(
      fetch(request.mode === 'navigate' ? request.url : request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request.mode === 'navigate' ? './index.html' : request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  // Bibliothèques vendorisées, icônes : cache d'abord
  event.respondWith(caches.match(request).then((c) => c || fetch(request)));
});
