const CACHE_NAME = 'daily-routine-cache-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './css/styles.css',
  './js/storage.js',
  './js/theme.js',
  './js/routine.js',
  './js/habits.js',
  './js/tools.js',
  './js/prayer.js',
  './js/ai.js',
  './js/analytics.js',
  './js/calendar.js',
  './js/main.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function(){ /* ignore individual failures */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_NAME; })
            .map(function(key){ return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        return response;
      }).catch(function() {
        return cached;
      });
    })
  );
});
