const CACHE_NAME = 'moydom-v1';
const urlsToCache = [
  '/moy-dom/',
  '/moy-dom/index.html',
  '/moy-dom/catalog.html',
  '/moy-dom/services.html',
  '/moy-dom/about.html',
  '/moy-dom/contacts.html',
  '/moy-dom/css/style.css',
  '/moy-dom/js/main.js',
  '/moy-dom/js/data.js',
  '/moy-dom/js/data.json',
  '/moy-dom/images/logo.png',
  '/moy-dom/images/icon-192.png',
  '/moy-dom/images/icon-512.png'
];

// Установка кэша
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
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
