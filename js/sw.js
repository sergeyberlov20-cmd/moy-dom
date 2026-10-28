const CACHE_NAME = 'moy-dom-v1';
const ASSETS = [
  './',
  './index.html',
  './catalog.html',
  './object.html',
  './about.html',
  './services.html',
  './contacts.html',
  './favorites.html',
  './privacy.html',
  './css/style.css',
  './js/data.js',
  './js/main.js',
  './images/logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});