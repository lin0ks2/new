/* MOYAMOVA Service Worker — v2 (fix paths + CSS, safer caching)
   - относительные пути (работает из подпапки, GitHub Pages и т.п.)
   - навигация: network-first с офлайн-фолбэком на index.html
   - статика: cache-first + обновление в фоне
*/
const ROOT = new URL('./', self.location).pathname.replace(/\/$/, '');
const CACHE_NAME = 'moyamova-cache-v2';

// Минимальный app shell — остальное кэшируется во время работы
const APP_SHELL = [
  'index.html',
  'manifest.webmanifest',
  'css/theme.light.css',
  'css/theme.dark.css'
].map(p => `${ROOT}/${p}`);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Обработка переходов между страницами
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          // обновим кэш index.html, если получилось дотянуться до сети
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(`${ROOT}/index.html`, copy));
          return resp;
        })
        .catch(() => caches.match(`${ROOT}/index.html`))
    );
    return;
  }

  // Для остальной статики: cache-first, обновление в фоне
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResp) => {
          const copy = networkResp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return networkResp;
        })
        .catch(() => cached); // если сеть упала — вернем кеш, если он был
      return cached || fetchPromise;
    })
  );
});
