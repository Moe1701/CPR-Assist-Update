// Version v36 - Caching Fehler (Icons) behoben
const CACHE_NAME = 'cpr-assist-v61';

// Exakte Pfade mit Beachtung von Unterordnern und Dateiendungen!
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/utils.js',
  './js/audio.js',
  './js/export.js',
  './js/settings.js',
  './js/checklists.js',
  './js/ui.js',
  './js/app.js',
  './js/airway-timer.js',
  './js/cpr-timer.js',
  './js/help-overlay.js',
  './js/debriefing.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell v33');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Caching Fehler:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Lösche alten Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// NETWORK FIRST STRATEGY (Lädt immer die neueste Version, wenn Internet da ist)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
