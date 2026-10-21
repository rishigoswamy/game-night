// Offline cache for Game Night. Bump VERSION whenever the app files change.
const VERSION = 'gamenight-v60';
const FILES = ['./', './index.html', './casino.html', './roulette.html', './blackjack.html', './admin.html', './admin-lock.js', './storage-migrate.js', './remote.html', './bj-remote.html', './table.html', './table-remote.html', './table-games.css', './leaderboard.js', './party.html', './party-table.html', './party-remote.html', './party.css', './party/common.js', './party/werewolf.js', './party/catan.js', './party/gofish.js', './party/bluff.js', './games/baccarat.js', './games/dragontiger.js', './games/sicbo.js', './games/craps.js', './roulette-view.js', './casino-sounds.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network first so updates show up when online; fall back to the cache offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).pathname.startsWith('/api/')) return;   // live table messages: straight to the server
  e.respondWith(fetch(e.request)
    .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
