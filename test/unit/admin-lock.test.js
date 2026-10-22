// The admin lock's device unlock (Touch ID / Face ID / fingerprint, via a passkey) and the PIN lockout over time
// (public/js/lib/admin-lock.js). The PIN basics are in shared-libs.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain, fakeStorage } = require('./helpers');

// A stand-in for the browser's passkey API (WebAuthn), returning what a real browser returns: the new passkey's id
// (rawId), and on use the authenticator data whose byte 32 holds the flags (0x01 user present, 0x04 user verified)
function browser({ secure = true, platform = true, verified = true, canForget = true, ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', throws = false } = {}) {
  const log = [];
  const PublicKeyCredential = {
    isUserVerifyingPlatformAuthenticatorAvailable: async () => { if (throws) throw new Error('blocked'); return platform; },
    ...(canForget ? { signalUnknownCredential: async o => { log.push(['forget', o]); } } : {}),
  };
  const navigator = { userAgent: ua, credentials: {
    create: async ({ publicKey }) => { log.push(['create', publicKey]); return { rawId: new Uint8Array([1, 2, 3, 250, 251, 255]).buffer }; },
    get: async ({ publicKey }) => {
      log.push(['get', publicKey]);
      const data = new Uint8Array(37); data[32] = verified ? 0x05 : 0x01;
      return { response: { authenticatorData: data.buffer } };
    },
  } };
  return { log, extra: { PublicKeyCredential, navigator, isSecureContext: secure, location: { hostname: 'localhost', search: '' } } };
}
const lock = ({ storage = fakeStorage(), b = browser(), Date: D } = {}) =>
  ({ A: loadScripts(['js/lib/admin-lock.js'], { localStorage: storage, extra: { ...b.extra, ...(D ? { Date: D } : {}) } }).AdminLock, storage, log: b.log });
const saved = storage => JSON.parse(storage.getItem('gn-admin'));

test('device unlock is offered only where the browser allows it: https or localhost, with a built-in authenticator', async () => {
  assert.equal(await lock().A.bioAvailable(), true);
  assert.equal(await lock({ b: browser({ secure: false }) }).A.bioAvailable(), false, 'plain http over Wi-Fi: browsers refuse passkeys');
  assert.equal(await lock({ b: browser({ platform: false }) }).A.bioAvailable(), false, 'no Touch ID / Windows Hello');
  assert.equal(await lock({ b: browser({ throws: true }) }).A.bioAvailable(), false, 'an error means no');
  const b = browser(); delete b.extra.PublicKeyCredential;
  assert.equal(await lock({ b }).A.bioAvailable(), false, 'an older browser without passkeys');
});

test('device unlock is named for the device it runs on', () => {
  const name = ua => lock({ b: browser({ ua }) }).A.bioName();
  assert.equal(name('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'Face ID / Touch ID');
  assert.equal(name('Mozilla/5.0 (iPad; CPU OS 17_0)'), 'Face ID / Touch ID');
  assert.equal(name('Mozilla/5.0 (Linux; Android 14)'), 'fingerprint or screen lock');
  assert.equal(name('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'), 'Touch ID or your Mac password');
  assert.equal(name('Mozilla/5.0 (Windows NT 10.0)'), "this device's fingerprint, face or PIN");
});

test('turning device unlock on creates a passkey that stays on this device and needs the user to unlock it', async () => {
  const { A, storage, log } = lock();
  A.setPin('2468');
  await A.enableDeviceUnlock();
  const [op, opts] = log[0];
  assert.equal(op, 'create');
  assert.equal(opts.rp.name, 'Game Night');
  assert.equal(opts.authenticatorSelection.authenticatorAttachment, 'platform', 'this device only (not a phone or security key)');
  assert.equal(opts.authenticatorSelection.userVerification, 'required', 'Touch ID / password every time');
  assert.equal(opts.attestation, 'none');
  assert.equal(opts.challenge.length, 32);
  assert.equal(saved(storage).passkey, 'AQID-vv_', 'its id is stored (base64url: - and _ instead of + and /, no padding)');
  assert.ok(saved(storage).pin, 'the PIN is kept');
  assert.equal(A.hasDeviceUnlock(), true);
});

test('unlocking with the device works only if the device verified the user', async () => {
  let { A, log } = lock();
  await A.enableDeviceUnlock();
  assert.equal(await A.verifyPasskey(), true);
  const [, opts] = log.at(-1);
  assert.deepEqual([...opts.allowCredentials[0].id], [1, 2, 3, 250, 251, 255], 'asks for exactly the passkey created here');
  assert.equal(opts.userVerification, 'required');
  // same passkey, but the device only reported "present", not "verified": not unlocked
  const storage = fakeStorage();
  ({ A } = lock({ storage }));
  await A.enableDeviceUnlock();
  ({ A } = lock({ storage, b: browser({ verified: false }) }));
  assert.equal(await A.verifyPasskey(), false);
});

test('turning device unlock on again replaces the passkey, asking the browser to forget the old one', async () => {
  const { A, log } = lock();
  await A.enableDeviceUnlock();
  await A.enableDeviceUnlock();
  assert.deepEqual(plain(log.map(([op, o]) => op === 'forget' ? [op, o.credentialId, o.rpId] : [op])),
    [['create'], ['forget', 'AQID-vv_', 'localhost'], ['create']]);
});

test('turning device unlock off removes the passkey (and says whether the browser could forget it); the PIN stays', async () => {
  let { A, storage } = lock();
  A.setPin('2468');
  assert.equal(await A.disableDeviceUnlock(), false, 'nothing to turn off');
  await A.enableDeviceUnlock();
  assert.equal(await A.disableDeviceUnlock(), true, 'the browser was asked to forget it');
  assert.equal(saved(storage).passkey, undefined);
  assert.equal(A.hasDeviceUnlock(), false);
  assert.equal(A.hasLock(), true);
  // a browser that can't forget passkeys (only newer Chrome can): still turned off here, but the user is told
  ({ A, storage } = lock({ b: browser({ canForget: false }) }));
  await A.enableDeviceUnlock();
  assert.equal(await A.disableDeviceUnlock(), false);
  assert.equal(A.hasDeviceUnlock(), false);
});

test('removing the lock forgets the passkey too; a page that isn\'t secure doesn\'t try', async () => {
  let { A, storage, log } = lock();
  A.setPin('2468'); await A.enableDeviceUnlock();
  assert.equal(await A.removeLock(), true);
  assert.equal(storage.getItem('gn-admin'), null);
  assert.equal(log.at(-1)[0], 'forget');
  const st = fakeStorage({ 'gn-admin': JSON.stringify({ pin: { salt: 'x', hash: 'y' }, passkey: 'AQID' }) });
  ({ A, log } = lock({ storage: st, b: browser({ secure: false }) }));
  assert.equal(await A.removeLock(), false, 'not forgotten (plain http)');
  assert.equal(st.getItem('gn-admin'), null, 'but removed all the same');
  assert.equal(log.length, 0);
});

test('the old in-game PIN\'s passkey is forgotten when it is removed on load', () => {
  const storage = fakeStorage({ 'rd-admin': JSON.stringify({ pin: 'old', passkey: 'OLDKEY' }) });
  const { log } = lock({ storage });
  assert.deepEqual(plain(log), [['forget', { rpId: 'localhost', credentialId: 'OLDKEY' }]]);
  assert.equal(storage.getItem('rd-admin'), null);
  const damaged = fakeStorage({ 'rd-admin': '{not json' });
  lock({ storage: damaged });                                    // a damaged old value is just left alone, without errors
  assert.equal(damaged.getItem('rd-admin'), '{not json');
});

test('PIN lockout: "1 try left", then 30 seconds locked; afterwards the right PIN works and wrong ones count from 5 again', () => {
  let now = 1_000_000_000_000;
  class FakeDate extends Date { static now() { return now; } }
  const { A } = lock({ Date: FakeDate });
  A.setPin('2468');
  for (let k = 0; k < 3; k++) A.checkPin('0000');
  assert.equal(A.checkPin('0000').error, 'Wrong PIN. 1 try left.');
  assert.match(A.checkPin('0000').error, /Locked for 30 seconds/);
  now += 12_000;
  assert.equal(A.checkPin('2468').error, 'Too many wrong PINs. Try again in 18s.', 'the wait counts down');
  now += 18_000;
  assert.deepEqual(plain(A.checkPin('2468')), { ok: true }, 'after 30 s the right PIN works');
  assert.equal(A.checkPin('0000').error, 'Wrong PIN. 4 tries left.');
});

test('damaged saved data means no lock (not a crash); saving still works if storage refuses', () => {
  const { A } = lock({ storage: fakeStorage({ 'gn-admin': '{not json' }) });
  assert.equal(A.hasLock(), false);
  assert.equal(A.load(), null);
  const refusing = { getItem: () => null, removeItem() {}, setItem() { throw new Error('QuotaExceeded'); } };   // e.g. storage full
  const { A: B } = lock({ storage: refusing });
  assert.doesNotThrow(() => B.setPin('2468'), 'a full or blocked storage doesn\'t break the page');
  assert.equal(B.hasLock(), false);
});
