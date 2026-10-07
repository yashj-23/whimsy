// Whimsy service worker: keeps the app working offline and installs updates when you choose.
const CACHE = 'whimsy-a42a17bcbbde';
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./css/wash-small.jpg",
  "./css/wash.jpg",
  "./js/actions.js",
  "./js/app.js",
  "./js/backup-button.js",
  "./js/constants.js",
  "./js/deck.js",
  "./js/dice.js",
  "./js/engine.js",
  "./js/feel.js",
  "./js/icons.js",
  "./js/native.js",
  "./js/screens/card.js",
  "./js/screens/home.js",
  "./js/screens/journal.js",
  "./js/screens/reflect.js",
  "./js/screens/session.js",
  "./js/screens/settings.js",
  "./js/state.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/vendor/preact-htm.js",
  "./fonts/alegreya-sans-latin-400-italic.woff2",
  "./fonts/alegreya-sans-latin-400-normal.woff2",
  "./fonts/alegreya-sans-latin-500-normal.woff2",
  "./fonts/alegreya-sans-latin-700-normal.woff2",
  "./fonts/im-fell-english-latin-400-italic.woff2",
  "./fonts/im-fell-english-latin-400-normal.woff2",
  "./icons/apple-touch-icon.png",
  "./icons/emblem-192.png",
  "./icons/favicon-32.png",
  "./icons/favicon-64.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('whimsy-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req)).catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
