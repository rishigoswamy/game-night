// Shared browser modules (public/js/lib): leaderboard, admin lock, storage migration
const test = require('node:test');
const { describe } = test;
const assert = require('node:assert/strict');
const { loadScripts, plain, fakeStorage } = require('./helpers');

/* ---------------- Leaderboard ---------------- */
const board = (storage = fakeStorage()) => ({ L: loadScripts(['js/lib/leaderboard.js'], { localStorage: storage }).get('Leaderboard'), storage });
const player = (name, bal, nets, start = 1000) => ({ name, bal, start, results: nets.map((net, i) => ({ round: i + 1, net })) });
describe('Leaderboard', () => {
  test('a casino player is recorded with winnings, final chips, rounds and best round', () => {
    const { L } = board();
    L.record('roulette', player('Ana', 1200, [50, -30, 180]));
    assert.deepEqual(plain(L.top('roulette')).map(({ at, ...e }) => e),
      [{ game: 'roulette', name: 'Ana', net: 200, final: 1200, rounds: 3, best: 180 }]);
  });

  test('chips still on the table count; nobody is recorded twice or without playing', () => {
    const { L } = board();
    const p = player('Bob', 900, [-100]);
    L.record('blackjack', p, 50);
    L.record('blackjack', p, 50);                                      // e.g. cash out, then the game ends
    L.record('blackjack', player('Cy', 1000, []));                     // joined but never played a round
    const list = plain(L.top('blackjack'));
    assert.equal(list.length, 1);
    assert.equal(list[0].final, 950); assert.equal(list[0].net, -50); assert.equal(list[0].best, 0);
  });

  test('casino boards rank by winnings; each game keeps its own best 100', () => {
    const { L } = board();
    for (let k = 0; k < 120; k++) L.record('sicbo', player('P' + k, 1000 + k, [k]));
    L.record('craps', player('Dee', 5000, [4000]));
    assert.equal(L.count('sicbo'), 100, 'only the best 100 are kept');
    assert.deepEqual(plain(L.top('sicbo', 3).map(e => e.net)), [119, 118, 117]);
    assert.equal(L.top('craps')[0].name, 'Dee', 'other games are separate');
  });

  test('party boards rank players by wins (names case-insensitive), then win rate', () => {
    const { L } = board();
    L.recordParty('gofish', [{ name: 'Ana', won: true, points: 6 }, { name: 'Bob', won: false, points: 4 }]);
    L.recordParty('gofish', [{ name: 'ana', won: true, points: 5 }, { name: 'Bob', won: false, points: 3 }, { name: 'Cy', won: true, points: 5 }]);
    L.recordParty('gofish', [{ name: 'Cy', won: false, points: 1 }]);
    const top = plain(L.topParty('gofish')).map(({ at, ...r }) => ({ ...r, name: r.name.toLowerCase() }));   // shows the latest spelling
    assert.deepEqual(top, [
      { name: 'ana', wins: 2, games: 2, points: 11 },
      { name: 'cy', wins: 1, games: 2, points: 6 },
      { name: 'bob', wins: 0, games: 2, points: 7 },
    ]);
  });

  test('flush one game, a list of games, or everything', () => {
    const { L } = board();
    L.record('roulette', player('A', 1100, [100])); L.record('sicbo', player('B', 1100, [100]));
    L.recordParty('catan', [{ name: 'C', won: true }]); L.recordParty('bluff', [{ name: 'D', won: true }]);
    assert.equal(L.flush('roulette'), 1);
    assert.equal(L.count('roulette'), 0); assert.equal(L.count(), 3);
    assert.equal(L.flush(['catan', 'bluff']), 2);
    assert.equal(L.count(), 1);
    assert.equal(L.flush(), 1);
    assert.equal(L.count(), 0);
  });

  test('survives corrupted storage', () => {
    const { L } = board(fakeStorage({ 'gn-leaderboard': '{not json' }));
    assert.deepEqual(plain(L.top('roulette')), []);
    L.record('roulette', player('A', 1100, [100]));
    assert.equal(L.count(), 1);
  });
});

/* ---------------- Admin lock ---------------- */
const lock = (storage = fakeStorage(), extra = {}) => ({ A: loadScripts(['js/lib/admin-lock.js'], { localStorage: storage, extra }).AdminLock, storage });
describe('Admin lock', () => {
  test('its SHA-256 matches the standard test vectors', () => {
    const { A } = lock();
    assert.equal(A._sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(A._sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(A._sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    assert.equal(A._sha256Hex('é🎲'), require('node:crypto').createHash('sha256').update('é🎲').digest('hex'), 'non-ASCII text');
  });

  test('PINs are 4–8 digits; stored salted and hashed, never in plain text', () => {
    const { A, storage } = lock();
    for (const ok of ['1234', '12345678']) assert.ok(A.validPin(ok));
    for (const bad of ['123', '123456789', '12a4', '']) assert.ok(!A.validPin(bad));
    assert.ok(!A.hasLock());
    A.setPin('2468');
    assert.ok(A.hasLock());
    const saved = storage.getItem('gn-admin');
    assert.ok(!saved.includes('2468'), 'the PIN itself is not stored');
    assert.match(JSON.parse(saved).pin.salt, /^[0-9a-f]{32}$/);
    assert.deepEqual(plain(A.checkPin('2468')), { ok: true });
  });

  test('wrong PINs count down, then lock for 30 seconds', () => {
    const { A } = lock();
    A.setPin('2468');
    assert.match(A.checkPin('0000').error, /4 tries left/);
    assert.match(A.checkPin('0000').error, /3 tries left/);
    A.checkPin('0000'); A.checkPin('0000');
    assert.match(A.checkPin('0000').error, /Locked for 30 seconds/);
    assert.match(A.checkPin('2468').error, /Try again in \d+s/, 'even the right PIN waits out the lock');
  });

  test('the right PIN resets the count; removing the lock forgets the PIN', async () => {
    const { A, storage } = lock();
    A.setPin('2468');
    A.checkPin('0000'); A.checkPin('0000');
    assert.equal(A.checkPin('2468').ok, true);
    assert.match(A.checkPin('0000').error, /4 tries left/, 'count started again');
    await A.removeLock();
    assert.ok(!A.hasLock()); assert.equal(storage.getItem('gn-admin'), null);
    assert.match(A.checkPin('2468').error, /No admin PIN/);
  });

  test('the very first in-game PIN (rd-admin) is removed on load', () => {
    const storage = fakeStorage({ 'rd-admin': JSON.stringify({ pin: 'old' }) });
    lock(storage);
    assert.equal(storage.getItem('rd-admin'), null);
  });
});

/* ---------------- Storage migration ---------------- */
describe('Storage migration', () => {
  test('rd-… and dc-… keys move to gn-…, in both local and session storage', () => {
    const local = fakeStorage({ 'dc-leaderboard': '[1]', 'rd-spins': '[17]', 'dc-device': 'd123456', 'unrelated': 'x' });
    const session = fakeStorage({ 'rd-spins': '[3]' });
    loadScripts(['js/lib/storage-migrate.js'], { localStorage: local, sessionStorage: session });
    assert.deepEqual(plain(local), { 'gn-leaderboard': '[1]', 'gn-spins': '[17]', 'gn-device': 'd123456', unrelated: 'x' });
    assert.deepEqual(plain(session), { 'gn-spins': '[3]' });
  });

  test('never overwrites newer data, and leaves rd-admin for the admin lock to remove', () => {
    const local = fakeStorage({ 'dc-leaderboard': '[old]', 'gn-leaderboard': '[new]', 'rd-admin': '{"pin":1}' });
    loadScripts(['js/lib/storage-migrate.js'], { localStorage: local });
    assert.equal(local.getItem('gn-leaderboard'), '[new]');
    assert.equal(local.getItem('dc-leaderboard'), null, 'the old copy is removed');
    assert.equal(local.getItem('rd-admin'), '{"pin":1}');
    assert.equal(local.getItem('gn-admin'), null);
  });

  test('running it again changes nothing', () => {
    const local = fakeStorage({ 'dc-device': 'd123456' });
    loadScripts(['js/lib/storage-migrate.js'], { localStorage: local });
    const once = plain(local);
    loadScripts(['js/lib/storage-migrate.js'], { localStorage: local });
    assert.deepEqual(plain(local), once);
  });

  test('leaderboard tables: party boards show a points column only where points mean something (Catan, Go Fish, Tambola)', () => {
    const { L } = board();
    for (const g of ['tambola', 'gofish', 'catan', 'werewolf', 'bluff']) L.recordParty(g, [{ name: 'Ana', won: true, points: 4 }, { name: 'Bob', won: false, points: 1 }]);
    const full = g => L._test.table(g, 10, true);
    assert.match(full('tambola'), /<th class="num">Prizes<\/th>/);
    assert.match(full('gofish'), /<th class="num">Books<\/th>/);
    assert.match(full('catan'), /<th class="num">Victory points<\/th>/);
    for (const g of ['werewolf', 'bluff']) assert.doesNotMatch(full(g), /Prizes|Books|Victory points/, g);
    assert.match(full('tambola'), /🏆<\/td><td class="nm">Ana<\/td>\s*<td class="num">1<\/td><td class="num">1<\/td><td class="num">100%<\/td><td class="num">4<\/td>/);
    assert.doesNotMatch(L._test.table('tambola', 5, false), /Prizes|Win rate/, 'the short lobby board shows wins only');
    assert.equal(L._test.table('craps', 10, true), '', 'nobody on the board: nothing to draw');
  });

  test('leaderboard tables: casino boards show winnings with a sign, and names escaped', () => {
    const { L } = board();
    L.record('roulette', player('<b>Eve</b>', 1250, [250]));
    L.record('roulette', player('Bob', 900, [-100]));
    const html = L._test.table('roulette', 10, true);
    assert.match(html, /&lt;b&gt;Eve&lt;\/b&gt;/);
    assert.doesNotMatch(html, /<b>Eve/);
    assert.match(html, /class="num pos">\+\$250</);
    assert.match(html, /class="num neg">-\$100</);
    assert.ok(html.indexOf('Eve') < html.indexOf('Bob'), 'best first');
  });
});
