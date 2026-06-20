/* Project SELENA — Service Worker
   Caches the app shell (HTML/manifest/icons) so the app can open with
   zero connectivity. Question-bank fetches (Google Sheets) are left
   untouched — the app already falls back to its IndexedDB cache for
   those via its own online/offline logic. */

const CACHE_NAME = 'selena-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests for the app shell.
  // Everything else (Google Sheets API, fonts, etc.) passes straight
  // to the network — untouched, exactly as the app already expects.
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    // Network-first: pick up new versions when online, fall back to
    // the cached shell the instant the network is unavailable.
    fetch(req)
      .then(function (res) {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
