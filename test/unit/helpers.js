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

// A small stand-in for a web page, enough for code that builds HTML and reacts to clicks (e.g. the leaderboard
// sections and their dialogs): elements parsed from innerHTML, querySelector('#id' / '.class' / 'tag' / 'tag.class'),
// listeners, click() (ignored when disabled, like a real button), submit(), focus(), remove(), textContent.
// Not a full DOM: no CSS, layout or innerHTML read-back of children added later (innerHTML returns what was set).
const VOID = new Set(['input', 'br', 'img', 'meta', 'link', 'hr']);
class FakeEl {
  constructor(tag, attrs = {}, doc) {
    this.tagName = tag.toUpperCase(); this.attrs = attrs; this.doc = doc;
    this.id = attrs.id || ''; this.className = attrs.class || '';
    this.value = attrs.value || ''; this.disabled = 'disabled' in attrs; this.hidden = 'hidden' in attrs;
    this.children = []; this.parentNode = null; this.listeners = {}; this._text = ''; this._html = '';
  }
  get classList() { const el = this; return { contains: c => el.className.split(/\s+/).includes(c), add: c => { el.className = `${el.className} ${c}`.trim(); } }; }
  set innerHTML(html) { this._html = html; this._text = ''; this.children = []; parseInto(this, String(html)); }
  get innerHTML() { return this._html; }
  set textContent(t) { this._text = String(t); this.children = []; this._html = this._text; }
  get textContent() { return this._text + this.children.map(c => (typeof c === 'string' ? c : c.textContent)).join(''); }
  appendChild(el) { el.parentNode = this; this.children.push(el); return el; }
  insertBefore(el, ref) { el.parentNode = this; const k = this.children.indexOf(ref); this.children.splice(k < 0 ? this.children.length : k, 0, el); return el; }
  insertAdjacentHTML(_, html) { this._html += html; parseInto(this, String(html)); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, ev = {}) { const e = { preventDefault() { e.defaultPrevented = true; }, target: this, ...ev }; (this.listeners[type] || []).forEach(fn => fn(e)); return e; }
  click() { if (!this.disabled) this.dispatch('click'); }
  submit() { this.dispatch('submit'); }
  focus() { if (this.doc) this.doc.activeElement = this; }
  matches(sel) {
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    const [tag, cls] = sel.split('.');
    return (!tag || this.tagName === tag.toUpperCase()) && (!cls || this.classList.contains(cls));
  }
  querySelectorAll(sel) { const out = []; const walk = el => el.children.forEach(c => { if (typeof c !== 'string') { if (c.matches(sel)) out.push(c); walk(c); } }); walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function parseInto(root, html) {
  const stack = [root];
  const attrsOf = s => Object.fromEntries([...s.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(m => [m[1], m[2] ?? '']));
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    const top = stack[stack.length - 1];
    if (m[5] != null) { if (m[5].trim()) top.children.push(m[5].replace(/\s+/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')); continue; }
    const tag = m[2].toLowerCase();
    if (m[1]) { for (let k = stack.length - 1; k > 0; k--) if (stack[k].tagName === tag.toUpperCase()) { stack.length = k; break; } continue; }
    const el = new FakeEl(tag, attrsOf(m[3]), root.doc);
    top.appendChild(el);
    if (!VOID.has(tag) && !m[4]) stack.push(el);
  }
}
function fakeDom() {
  const doc = { activeElement: null };
  Object.assign(doc, {
    head: new FakeEl('head', {}, doc), body: new FakeEl('body', {}, doc),
    createElement: tag => new FakeEl(tag, {}, doc),
    getElementById: id => [doc.head, doc.body].map(r => (r.id === id ? r : r.querySelector('#' + id))).find(Boolean) || null,
  });
  const winListeners = {};
  return { document: doc, addEventListener: (t, fn) => (winListeners[t] ||= []).push(fn), fire: (t, ev) => (winListeners[t] || []).forEach(fn => fn(ev)) };
}

module.exports = { PUBLIC, fakeStorage, loadScripts, plain, seededRand, seededShuffle, partyCtx, flush, card, NAMES, fakeDom, FakeEl };
