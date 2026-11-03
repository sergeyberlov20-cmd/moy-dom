const CACHE_NAME = 'moydom-v2';
const urlsToCache = [
  './',
  './index.html',
  './catalog.html',
  './css/style.css',
  './js/main.js',
  './js/data.js',
  './js/data.json',
  './images/logo.png',
  './images/icon-192.png'
];

// Установка кэша
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // Заставляет воркер обновиться сразу
});

// Активация (удаляем старый кэш)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // Применяем изменения сразу
});

// Перехват запросов
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
