// Service worker: keeps a copy of the whole app on the device so it opens
// and runs with no internet connection.
//
// Strategy: answer every request from the saved copy straight away (fast,
// works offline), and quietly fetch a fresh copy in the background when
// online. So after you upload a new version, the app picks it up the next
// time it's opened with internet, then uses it from the launch after that.

const CACHE = 'intervals-v1';

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/audio.js',
  './js/cues.js',
  './js/engine.js',
  './js/presets.js',
  './js/store.js',
  './js/timeline.js',
  './js/ui.js',
  './js/util.js',
  './js/wakelock.js',
  './js/screens/editor.js',
  './js/screens/home.js',
  './js/screens/run.js',
  './js/screens/settings.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    const fresh = fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(fresh);   // update in the background
      return cached;
    }
    return (await fresh) || new Response('Offline', { status: 503 });
  })());
});
