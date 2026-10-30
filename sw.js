const CACHE_NAME = 'voice-shopping-list-v28';
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
  // Pre-cache the app shell so it works offline from the very first visit
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch((err) => console.warn('SW precache failed:', err))
      .then(() => self.skipWaiting())
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

// Network-First strategy for same-origin GET requests: always fetch the latest
// files from the server, fall back to the cache when offline.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls, POSTs or cross-origin requests (Gemini, Yandex, etc.)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
