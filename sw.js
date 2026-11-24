const CACHE_NAME = 'voice-shopping-list-v43';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/sync.js',
  './js/voice.js',
  './js/ocr.js',
  './js/chef.js',
  './js/parser.js',
  './js/audio.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch((err) => console.warn('SW precache failed:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Network-First strategy for same-origin GET requests: always fetch the latest
// files from the server, fall back to the cache when offline.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls, POSTs or cross-origin requests (Gemini, Yandex, etc.)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Normalize cache key without ?v=... so precached ASSETS match versioned URLs offline
  const cleanCacheUrl = url.origin + url.pathname;

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(cleanCacheUrl, responseClone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(cleanCacheUrl, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const indexPage = await caches.match('./index.html', { ignoreSearch: true });
          if (indexPage) return indexPage;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
