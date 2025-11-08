
// MOYAMOVA — basic app-shell service worker
const CACHE_NAME = 'moyamova-cache-v1';
const APP_SHELL = [
  '/index.html',
  '/css/tokens.css',
  '/js/i18n.js',
  '/js/app.core.js',
  '/js/app.decks.js',
  '/js/app.trainer.js',
  '/js/dicts.js',
  '/js/deck.de.js',
  '/js/deck.en.js',
  '/js/app.favorites.js',
  '/js/app.mistakes.js',
  '/img/logo_64.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k)))))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // For navigation requests: network-first then cache fallback
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy));
        return resp;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }
  // For static assets: cache-first
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, copy));
      return resp;
    }))
  );
});
