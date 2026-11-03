const CACHE_NAME = 'moydom-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/catalog.html',
  '/css/style.css',
  '/js/main.js',
  '/js/data.js',
  '/js/data.json',
  '/images/logo.png',
  '/images/icon-192.png'
];

// Установка кэша
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Перехват запросов (сначала ищем в кэше, потом в сети)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
