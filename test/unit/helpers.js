// Shared helpers for the unit tests (run with: npm test)
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC = path.resolve(__dirname, '..', '..', 'public');

// A stand-in for the browser's localStorage / sessionStorage. Like the real one, stored keys are the object's own
// enumerable properties (Object.keys(localStorage) lists them) and the methods are not.
function fakeStorage(initial = {}) {
  const s = {};
  const method = (name, fn) => Object.defineProperty(s, name, { value: fn, enumerable: false });
  method('getItem', k => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null));
  method('setItem', (k, v) => { s[k] = String(v); });
  method('removeItem', k => { delete s[k]; });
  method('clear', () => Object.keys(s).forEach(k => delete s[k]));
  for (const [k, v] of Object.entries(initial)) s[k] = String(v);
  return s;
}

// Runs browser scripts from public/ in a sandbox that looks enough like a page: window, storage, crypto, timers.
// Returns the sandbox; sandbox.get('Name') reads a top-level `const` (e.g. Leaderboard, PartyKit).
function loadScripts(files, { localStorage = fakeStorage(), sessionStorage = fakeStorage(), extra = {} } = {}) {
  const sandbox = {
    localStorage, sessionStorage, console, crypto: globalThis.crypto, TextEncoder, URLSearchParams,
    setTimeout, clearTimeout, setInterval, clearInterval, btoa, atob,
    navigator: { userAgent: 'node' }, location: { hostname: 'localhost', search: '' },
    ...extra,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(PUBLIC, f), 'utf8'), sandbox, { filename: f });
  sandbox.get = name => vm.runInContext(name, sandbox);
  return sandbox;
}

// Values created inside the sandbox have the sandbox's own Array/Object prototypes; compare plain copies.
const plain = x => JSON.parse(JSON.stringify(x));

// Reproducible "random": rand(n) → 0..n-1 from a seeded generator (mulberry32)
function seededRand(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return n => Math.floor(next() * n);
}
const seededShuffle = rand => arr => { for (let i = arr.length - 1; i > 0; i--) { const j = rand(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

// The context a party game gets from party-table.html, without a screen: records what it says, logs and how it ends.
// Timers don't run on their own: a test resolves the current countdown with ctx.expire() (time ran out) or ctx.skip().
const NAMES = ['Ana', 'Bob', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];
function partyCtx(n, { opts = {}, rand = seededRand(1), shuffle } = {}) {
  let countdown = null;
  const ctx = {
    alive: true, opts, state: null, rand, shuffle: shuffle || seededShuffle(rand),
    players: NAMES.slice(0, n).map((name, i) => ({ i, name, color: '#888' })),
    logLines: [], said: [], ended: null,
    log(t) { ctx.logLines.unshift(t); },
    say(t) { ctx.said.push(t); return Promise.resolve(); },
    async wait() {},
    update() {},
    countdown() { return new Promise(res => { countdown = res; }); },
    expire() { const r = countdown; countdown = null; r && r(false); },
    skip() { const r = countdown; countdown = null; r && r(true); },
    end(results, html) { ctx.ended = { results, html }; ctx.alive = false; },
  };
  return ctx;
}
const flush = () => new Promise(r => setImmediate(r));   // let pending promise chains run

const card = (r, s = '♠') => ({ r, s });

module.exports = { PUBLIC, fakeStorage, loadScripts, plain, seededRand, seededShuffle, partyCtx, flush, card, NAMES };
