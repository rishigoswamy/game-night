// Admin lock shared by the Game Night pages (the Admin page sets it up; games only unlock with it).
// An admin PIN works everywhere; the device's own unlock (Touch ID / fingerprint / Face ID / device
// password, via a passkey) works where browsers allow it: https pages and localhost.
// Everything is stored on this device, per address. It keeps players from admin actions; it isn't bank-grade security.
(function () {
  const KEY = 'gn-admin';
  const OLD_KEY = 'rd-admin';   // the earlier in-game PIN; flushed on load (see bottom)

  // SHA-256 in plain JS: browsers only provide crypto.subtle on https/localhost, and the PIN must work over plain Wi-Fi too.
  const SHA_K = new Uint32Array(64), SHA_H0 = new Uint32Array(8);
  {
    const primes = [];
    for (let n = 2; primes.length < 64; n++) if (primes.every(p => n % p)) primes.push(n);
    const frac = x => ((x - Math.floor(x)) * 2 ** 32) >>> 0;
    primes.forEach((p, i) => { SHA_K[i] = frac(Math.cbrt(p)); if (i < 8) SHA_H0[i] = frac(Math.sqrt(p)); });
  }
  function sha256Hex(msg) {
    const bytes = new TextEncoder().encode(msg), len = bytes.length;
    const size = ((len + 9 + 63) >> 6) << 6, m = new Uint8Array(size);
    m.set(bytes); m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(size - 4, len * 8);
    const H = new Uint32Array(SHA_H0), W = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < size; off += 64) {
      for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = W[t - 16] + s0 + W[t - 7] + s1;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[t] + W[t]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return [...H].map(x => x.toString(16).padStart(8, '0')).join('');
  }
  // Salted and stretched so the stored value doesn't reveal the PIN
  function pinHash(pin, salt) {
    let h = '';
    for (let k = 0; k < 4000; k++) h = sha256Hex(`${salt}:${h}:${pin}`);
    return h;
  }
  const randHex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = l => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {} };

  async function bioAvailable() {
    try { return !!(window.isSecureContext && window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
    catch { return false; }
  }
  function bioName() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return 'Face ID / Touch ID';
    if (/Android/.test(ua)) return 'fingerprint or screen lock';
    if (/Mac/.test(ua)) return 'Touch ID or your Mac password';
    return "this device's fingerprint, face or PIN";
  }
  // A passkey that lives only on this device; using it makes the OS ask for biometrics / the device password
  async function registerPasskey() {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Game Night' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'table-admin', displayName: 'Game Night table admin' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      attestation: 'none', timeout: 60000,
    } });
    return b64u(cred.rawId);
  }
  async function verifyPasskey(id) {
    const a = await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: unb64u(id), transports: ['internal'] }],
      userVerification: 'required', timeout: 60000,
    } });
    return (new Uint8Array(a.response.authenticatorData)[32] & 0x04) !== 0;   // "user verified" flag
  }
  // Ask the browser's password manager to delete a passkey we no longer use (Chrome 132+; others ignore it)
  async function forgetPasskey(id) {
    try {
      if (window.isSecureContext && window.PublicKeyCredential?.signalUnknownCredential) {
        await PublicKeyCredential.signalUnknownCredential({ rpId: location.hostname, credentialId: id });
        return true;
      }
    } catch {}
    return false;
  }

  let fails = 0, lockedUntil = 0;
  // { ok } or { ok: false, error }
  function checkPin(pin) {
    const l = load();
    if (!l?.pin) return { ok: false, error: 'No admin PIN is set.' };
    const wait = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (wait > 0) return { ok: false, error: `Too many wrong PINs. Try again in ${wait}s.` };
    if (pinHash(pin, l.pin.salt) === l.pin.hash) { fails = 0; return { ok: true }; }
    if (++fails >= 5) { fails = 0; lockedUntil = Date.now() + 30000; return { ok: false, error: 'Too many wrong PINs. Locked for 30 seconds.' }; }
    const left = 5 - fails;
    return { ok: false, error: `Wrong PIN. ${left} tr${left === 1 ? 'y' : 'ies'} left.` };
  }
  function setPin(pin) {
    const salt = randHex(16), l = load() || {};
    l.pin = { salt, hash: pinHash(pin, salt) };
    save(l);
  }
  async function enableDeviceUnlock() {
    const l = load() || {};
    if (l.passkey) await forgetPasskey(l.passkey);
    l.passkey = await registerPasskey();
    save(l);
  }
  async function disableDeviceUnlock() {
    const l = load();
    if (!l?.passkey) return false;
    const forgotten = await forgetPasskey(l.passkey);
    delete l.passkey;
    save(l);
    return forgotten;
  }
  async function removeLock() {
    const l = load();
    const forgotten = l?.passkey ? await forgetPasskey(l.passkey) : false;
    try { localStorage.removeItem(KEY); } catch {}
    return forgotten;
  }

  // Flush the earlier in-game PIN: from now on the lock is only set up on the Admin page
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old) {
      if (old.passkey) forgetPasskey(old.passkey);
      localStorage.removeItem(OLD_KEY);
    }
  } catch {}

  window.AdminLock = {
    load, hasLock: () => !!load()?.pin, hasDeviceUnlock: () => !!load()?.passkey,
    validPin: p => /^\d{4,8}$/.test(p), checkPin, setPin,
    bioAvailable, bioName, verifyPasskey: () => verifyPasskey(load().passkey),
    enableDeviceUnlock, disableDeviceUnlock, removeLock,
    _sha256Hex: sha256Hex,
  };
})();
