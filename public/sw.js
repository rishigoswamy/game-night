// Offline cache for Game Night. Bump VERSION whenever the app files change.
const VERSION = 'gamenight-v66';
const FILES = ['./',
  './admin.html',
  './bj-remote.html',
  './blackjack.html',
  './casino.html',
  './index.html',
  './manifest.webmanifest',
  './party-remote.html',
  './party-table.html',
  './party.html',
  './remote.html',
  './roulette.html',
  './table-remote.html',
  './table.html',
  './css/base-phone.css',
  './css/base-table.css',
  './css/party.css',
  './css/table-games.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './css/pages/admin.css',
  './css/pages/bj-remote.css',
  './css/pages/blackjack.css',
  './css/pages/casino.css',
  './css/pages/index.css',
  './css/pages/party-remote.css',
  './css/pages/party-table.css',
  './css/pages/party.css',
  './css/pages/table-remote.css',
  './css/pages/table.css',
  './games/casino/baccarat.js',
  './games/casino/blackjack-rules.js',
  './games/casino/craps.js',
  './games/casino/dragontiger.js',
  './games/casino/roulette-rules.js',
  './games/casino/sicbo.js',
  './games/party/bluff.js',
  './games/party/catan.js',
  './games/party/common.js',
  './games/party/gofish.js',
  './games/party/werewolf.js',
  './js/lib/admin-lock.js',
  './js/lib/casino-sounds.js',
  './js/lib/leaderboard.js',
  './js/lib/roulette-view.js',
  './js/lib/server-status.js',
  './js/lib/storage-migrate.js',
  './js/pages/admin.js',
  './js/pages/bj-remote.js',
  './js/pages/blackjack.js',
  './js/pages/casino.js',
  './js/pages/index.js',
  './js/pages/party-remote.js',
  './js/pages/party-table.js',
  './js/pages/party.js',
  './js/pages/remote.js',
  './js/pages/roulette.js',
  './js/pages/table-remote.js',
  './js/pages/table.js',
];

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
