const CACHE_NAME = 'shalasetu-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './dashboard.html',
  './styles.css',
  './firebase-config.js',
  './manifest.webmanifest',
  './src/app.js',
  './src/app-core.js',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const requests = SHELL_FILES.map((file) => new URL(file, self.registration.scope).toString());
    await cache.addAll(requests);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('shalasetu-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const networkFirst = request.mode === 'navigate' || /\/(src\/|styles\.css$|firebase-config\.js$|manifest\.webmanifest$)/.test(url.pathname);
  if (networkFirst) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') return (await cache.match(new URL('./index.html', self.registration.scope).toString())) || Response.error();
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
