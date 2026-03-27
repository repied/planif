const CACHE_NAME = 'tables-cache-vd176c08';
const urlsToCache = [
  './',
  './index.html',
  './src/style.css',
  './src/lock.css',
  './src/script.js',
  './src/dataManager.js',
  './src/planning.js',
  './src/translations.js',
  './src/marked.min.js',
  './assets/help_fr.md',
  './assets/help_en.md',
  './assets/checklist_fr.md',
  './assets/checklist_en.md',
  './src/qrcode.min.js',
  './src/jsQR.min.js',
  './data/mn90_stops.csv',
  './data/mn90-n2.csv',
  './data/mn90-majoration.csv',
  './manifest.json',
  './assets/favicon.png',
  './assets/background.png',
  './assets/background-table.png',
  './assets/background-table-grey.png',
  './assets/fr-flag-800.png',
  './assets/uk-flag-800.png',
  './src/dropdown.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache.map((url) => new Request(url, { cache: 'reload' })));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip cache for local development to allow live reload to work
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim(),
    ])
  );
});
