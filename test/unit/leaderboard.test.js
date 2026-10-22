// The leaderboard on the pages (public/js/lib/leaderboard.js): a game's section, the lobbies' all-games board, and the
// admin check before a flush. Recording and ranking are in shared-libs.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, fakeStorage, fakeDom, flush } = require('./helpers');

// A page with a leaderboard and a stand-in for the admin lock (its PIN is 2468; device unlock as given)
function page({ storage = fakeStorage(), lock = true, bio = false, verify = async () => true } = {}) {
  const dom = fakeDom();
  const AdminLock = {
    hasLock: () => lock, hasDeviceUnlock: () => bio, bioAvailable: async () => bio, bioName: () => 'Touch ID or your Mac password',
    verifyPasskey: verify, checkPin: pin => (pin === '2468' ? { ok: true } : { ok: false, error: 'Wrong PIN. 4 tries left.' }),
  };
  const L = loadScripts(['js/lib/leaderboard.js'], { localStorage: storage, extra: { document: dom.document, addEventListener: dom.addEventListener, AdminLock } }).get('Leaderboard');
  const main = dom.document.createElement('main');                // the leaderboard goes before this
  dom.document.body.appendChild(main);
  const modal = () => dom.document.body.querySelector('.lb-modal');
  return { L, dom, doc: dom.document, main, storage, modal };
}
const player = (name, bal, nets) => ({ name, bal, start: 1000, results: nets.map((net, i) => ({ round: i + 1, net })) });
// the text as a person reads it on screen: each element's text, separated by spaces
const text = el => { const out = []; const walk = n => n.children.forEach(c => (typeof c === 'string' ? out.push(c.trim()) : walk(c))); walk(el); return out.filter(Boolean).join(' '); };

test('a game\'s leaderboard: placed before the given element, titled for the game, empty until someone plays', () => {
  const { L, doc, main } = page();
  L.mount('catan', main);
  const sec = doc.getElementById('leaderboard');
  assert.equal(doc.body.children.indexOf(sec), doc.body.children.indexOf(main) - 1, 'just before it');
  assert.match(text(sec), /🏆 Catan Leaderboard/);
  assert.match(text(sec), /Top 10 by wins · recorded on this computer at the end of each game/);
  assert.match(text(sec), /No one on the board yet\. Finish a game to get on it\./);
  assert.equal(sec.querySelector('.lb-flush').disabled, true, 'nothing to flush');
  const casino = page();
  casino.L.mount('roulette', casino.main);
  assert.match(text(casino.doc.getElementById('leaderboard')), /Top 10 by winnings .*Finish a game or cash out to get on it/);
  assert.equal(doc.head.querySelectorAll('style').length, 1, 'its styles are added once');
  L.mount('gofish', main, { compact: true });
  assert.equal(doc.head.querySelectorAll('style').length, 1, '…even with a second leaderboard on the page');
});

test('the leaderboard redraws by itself when a result is recorded here, or in another tab', () => {
  const { L, doc, main, dom, storage } = page();
  L.mount('catan', main);
  L.recordParty('catan', [{ name: 'Ana', won: true, points: 10 }, { name: 'Bob', won: false, points: 6 }]);
  const sec = doc.getElementById('leaderboard');
  assert.match(text(sec), /🏆 Ana 1 1 100% 10/);
  assert.equal(sec.querySelector('.lb-flush').disabled, false);
  // another tab records a game: the browser tells this page through a storage event
  const all = JSON.parse(storage.getItem('gn-leaderboard'));
  all.push({ game: 'catan', name: 'Cy', won: true, points: 12, at: Date.now() + 1000 });
  storage.setItem('gn-leaderboard', JSON.stringify(all));
  dom.fire('storage', { key: 'gn-leaderboard' });
  assert.match(text(sec), /Cy/);
  dom.fire('storage', { key: 'gn-voice' });                       // other settings don't matter to it
});

test('the compact leaderboard (setup screens): top 5, short title, no explanation line', () => {
  const { L, doc, main } = page();
  for (let k = 0; k < 8; k++) L.record('blackjack', player('P' + k, 1000 + k * 10, [k * 10]));
  L.mount('blackjack', main, { compact: true });
  const sec = doc.getElementById('leaderboardMini');
  assert.ok(sec.classList.contains('lb-mini'));
  assert.match(text(sec), /^🏆 Leaderboard/);
  assert.doesNotMatch(text(sec), /Top 10/);
  assert.equal(sec.querySelectorAll('tr').length, 1 + 5, 'header + top 5');
});

test('the lobby board: every game with entries (only those), and one Flush for all of them', async () => {
  const { L, doc, main, modal } = page();
  L.mountAll(main, ['roulette', 'blackjack', 'craps'], 'casino');
  const sec = doc.getElementById('leaderboard');
  assert.match(text(sec), /No one on the board yet\. Play a game to get on it\./);
  assert.equal(sec.querySelector('.lb-flush').disabled, true);
  L.record('roulette', player('Ana', 1200, [200]));
  L.record('craps', player('Bob', 900, [-100]));
  L.recordParty('catan', [{ name: 'Cy', won: true }]);            // a party game: not on the casino board
  assert.deepEqual(sec.querySelectorAll('h3').map(h => h.textContent), ['Roulette', 'Craps'], 'Blackjack has no entries yet');
  assert.match(text(sec), /Top players of every casino game on this computer/);
  sec.querySelector('.lb-flush').click(); await flush();
  assert.match(text(modal()), /Flush all casino leaderboards This erases the leaderboards of Roulette, Blackjack, Craps on this computer\./);
  modal().querySelector('#lbPin').value = '2468';
  modal().querySelector('form').submit(); await flush();
  assert.equal(L.count('roulette') + L.count('craps'), 0, 'the casino boards are erased');
  assert.equal(L.count('catan'), 1, 'the party board is untouched');
  assert.match(text(sec), /No one on the board yet/);
});

test('flushing asks for the admin PIN: a wrong PIN is refused, the right one erases the board', async () => {
  const { L, doc, main, modal } = page();
  L.mount('catan', main);
  L.recordParty('catan', [{ name: 'Ana', won: true }]);
  doc.getElementById('leaderboard').querySelector('.lb-flush').click(); await flush();
  const m = modal();
  assert.match(text(m), /Flush Catan leaderboard This erases every Catan entry on this computer's leaderboard\./);
  assert.equal(doc.activeElement, m.querySelector('#lbPin'), 'the cursor is in the PIN box');
  m.querySelector('#lbPin').value = '0000';
  const e = m.querySelector('form').dispatch('submit');
  await flush();
  assert.equal(e.defaultPrevented, true, 'the form doesn\'t reload the page');
  assert.equal(m.querySelector('.err').textContent, 'Wrong PIN. 4 tries left.');
  assert.equal(m.querySelector('#lbPin').value, '', 'the wrong PIN is cleared');
  assert.ok(modal(), 'the dialog stays open');
  assert.equal(L.count('catan'), 1, 'nothing erased');
  m.querySelector('#lbPin').value = '2468';
  m.querySelector('form').submit(); await flush();
  assert.equal(modal(), null, 'the dialog closes');
  assert.equal(L.count('catan'), 0, 'erased');
});

test('Cancel erases nothing; without an admin lock the dialog only explains, with a Close button', async () => {
  let { L, doc, main, modal } = page();
  L.mount('catan', main);
  L.recordParty('catan', [{ name: 'Ana', won: true }]);
  doc.getElementById('leaderboard').querySelector('.lb-flush').click(); await flush();
  assert.equal(modal().querySelector('.cancel').textContent, 'Cancel');
  modal().querySelector('.cancel').click(); await flush();
  assert.equal(modal(), null);
  assert.equal(L.count('catan'), 1, 'still there');
  ({ L, doc, main, modal } = page({ lock: false }));
  L.mount('catan', main);
  L.recordParty('catan', [{ name: 'Ana', won: true }]);
  doc.getElementById('leaderboard').querySelector('.lb-flush').click(); await flush();
  assert.match(text(modal()), /Flushing needs an admin lock, and none is set up on this device/);
  assert.equal(modal().querySelector('#lbPin'), null, 'no PIN box');
  assert.equal(modal().querySelector('.danger'), null, 'no Flush button');
  assert.equal(modal().querySelector('.cancel').textContent, 'Close');
  assert.equal(doc.activeElement, modal().querySelector('.cancel'));
  modal().querySelector('.cancel').click(); await flush();
  assert.equal(L.count('catan'), 1);
});

test('with Touch ID set up, the dialog offers it first: confirmed erases; refused or cancelled says to use the PIN', async () => {
  const run = async verify => {
    const p = page({ bio: true, verify });
    p.L.mount('catan', p.main);
    p.L.recordParty('catan', [{ name: 'Ana', won: true }]);
    p.doc.getElementById('leaderboard').querySelector('.lb-flush').click(); await flush();
    return p;
  };
  let p = await run(async () => true);
  assert.equal(p.modal().querySelector('.bio').textContent, 'Unlock with Touch ID or your Mac password');
  assert.equal(p.doc.activeElement, p.modal().querySelector('.bio'), 'Touch ID is the first choice');
  assert.match(text(p.modal()), /or enter the admin PIN/);
  p.modal().querySelector('.bio').click(); await flush();
  assert.equal(p.modal(), null); assert.equal(p.L.count('catan'), 0);
  p = await run(async () => false);
  p.modal().querySelector('.bio').click(); await flush();
  assert.equal(p.modal().querySelector('.err').textContent, 'The device did not confirm it was you. Use the PIN instead.');
  assert.equal(p.L.count('catan'), 1);
  p = await run(async () => { throw new Error('NotAllowedError'); });
  p.modal().querySelector('.bio').click(); await flush();
  assert.equal(p.modal().querySelector('.err').textContent, "Device unlock was cancelled or isn't available. Use the PIN instead.");
  assert.equal(p.L.count('catan'), 1);
});
