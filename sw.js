/* MOYAMOVA Service Worker — v4 (без offline.html) */
const ROOT = new URL('./', self.location).pathname.replace(/\/$/, '');
const CACHE_NAME = 'moyamova-cache-v4';

// Минимальный app shell: только то, что нужно для запуска
const APP_SHELL = [
  'index.html',
  'manifest.webmanifest',
  'css/theme.light.css',
  'css/theme.dark.css'
].map(p => `${ROOT}/${p}`);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k)))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Навигация: network-first, фолбэк — закешированный index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((resp) => {
        // Обновим index.html в кэше
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(`${ROOT}/index.html`, copy));
        return resp;
      }).catch(() => caches.match(`${ROOT}/index.html`))
    );
    return;
  }

  // Остальная статика: cache-first с обновлением в фоне (stale-while-revalidate)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((networkResp) => {
        const copy = networkResp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        return networkResp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
