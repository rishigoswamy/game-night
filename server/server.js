// Game Night server (Casino + Party Games): serves the games and relays messages between a table and the guests' phones.
// Plain Node; the one optional package is `qrcode` (npm install) for the join QR code. Run:  node server.js  [port]   (default 8080)
//
// One shared table at a time, and only this computer (the "master") can run it: requests to host a table are
// accepted only from this machine itself. Phones on the Wi-Fi just join "the table".
// Shared tables: the table device ("host") runs the game; phones ("remotes") send it actions and receive
// its state. Messages travel as Server-Sent Events (server → device) and small POSTs (device → server).
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = +process.argv[2] || +process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..', 'public');   // the web root: everything browsers load
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.wav': 'audio/wav',
};

// code → { code, game, hostKey, host: res|null, hostSeen, remotes: Map(device → { res, token }), state, created }
// Every sender proves who it is: the table with its hostKey, each phone with the token it was given when its
// stream opened. Device ids are visible to other phones (they are in the table state), so they are never trusted alone.
const tables = new Map();
const HOST_GRACE_MS = 10 * 60 * 1000;
let lastMasterPage = 0;                 // when a page on this computer last asked /api/info   // a table survives a host reload / short disconnect for 10 minutes

// Is the request coming from this computer (localhost or one of its own network addresses)?
// (DC_LOOPBACK_ONLY=1 counts only localhost, so a test browser on this computer can act like a phone.)
function fromThisComputer(req) {
  const ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1') return true;
  return process.env.DC_LOOPBACK_ONLY !== '1' && lanAddresses().includes(ip);
}
const lanAddresses = () => Object.values(os.networkInterfaces()).flat()
  .filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';            // no I or O: easy to read aloud
  let code;
  do code = [...Array(4)].map(() => letters[Math.floor(Math.random() * letters.length)]).join('');
  while (tables.has(code));
  return code;
}
const secret = () => crypto.randomBytes(16).toString('hex');
function sse(res, msg) { try { res.write(`data: ${JSON.stringify(msg)}\n\n`); } catch {} }
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}
function tableInfo(t) {
  const players = (t.state && t.state.players || []).filter(p => p.inGame).length;
  return { code: t.code, game: t.game, players, hostOnline: !!t.host, phones: t.remotes.size };
}

async function api(req, res, url) {
  const q = url.searchParams;
  // Info for share screens: the Wi-Fi addresses phones should use
  // Dealer voice rendered by this computer's own speech (macOS "say"), so the table doesn't depend on the
  // browser's speech engine. Returns a WAV clip; repeated lines are served from memory.
  if (url.pathname === '/api/tts') {
    const text = String(q.get('text') || '').slice(0, 220);
    const voice = TTS_VOICES.includes(q.get('voice')) ? q.get('voice') : 'Daniel';
    if (!TTS_OK || !text.trim()) return json(res, 404, { error: 'No speech here' });
    try {
      const wav = await speak(text, voice);
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'max-age=86400' });
      return res.end(wav);
    } catch { return json(res, 500, { error: 'Speech failed' }); }
  }
  // Changes whenever a game file changes, so open pages can tell they're out of date
  if (url.pathname === '/api/version') return json(res, 200, { version: filesVersion() });
  // QR code of the address phones open to join (the Mac's Wi-Fi address + /remote.html, which finds the running table)
  if (url.pathname === '/api/qr.svg') {
    const ip = lanAddresses()[0];
    if (!ip) return json(res, 404, { error: 'Not on a network' });
    try {
      const svg = await qrSvg(`http://${ip}:${PORT}/remote.html`);
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
      return res.end(svg);
    } catch { return json(res, 404, { error: 'No QR code generator: run  npm install  in the game folder' }); }
  }
  if (url.pathname === '/api/info') {
    const master = fromThisComputer(req);
    if (master) lastMasterPage = Date.now();                // a Game Night page is open on this computer (they check in every few seconds)
    return json(res, 200, { addresses: lanAddresses(), port: PORT, master, tts: TTS_OK });
  }
  // Is a Game Night page already open on this computer? The starter asks, so it doesn't open a second tab.
  if (url.pathname === '/api/master-open') return json(res, 200, { open: Date.now() - lastMasterPage < 4000 });

  // A table device opens a shared table (or re-opens its old code after a reload)
  if (url.pathname === '/api/host' && req.method === 'POST') {
    if (!fromThisComputer(req)) return json(res, 403, { error: 'Only the table on the host computer can run the shared table.' });
    const body = await readBody(req);
    let t = body.code && tables.get(body.code);
    if (t && t.hostKey !== body.hostKey) t = null;                 // only the table that opened a code can reopen it
    if (!t) {
      const live = [...tables.values()].find(o => o.host);
      if (live && !body.takeover) return json(res, 409, { error: 'Another screen is already sharing a table.', code: live.code });
      t = { code: newCode(), game: body.game || 'roulette', hostKey: secret(), host: null, hostSeen: Date.now(), remotes: new Map(), state: null, created: Date.now() };
      // Only one table: close every other one; its phones move straight to the new table
      for (const old of tables.values()) {
        old.remotes.forEach(r => sse(r.res, { type: 'closed', replacedBy: t.code }));
        if (old.host) sse(old.host, { type: 'replaced' });
        tables.delete(old.code);
      }
      tables.set(t.code, t);
    }
    return json(res, 200, { code: t.code, hostKey: t.hostKey, addresses: lanAddresses(), port: PORT });
  }
  if (url.pathname === '/api/close' && req.method === 'POST') {
    const body = await readBody(req), t = tables.get(body.code);
    if (!t || t.hostKey !== body.hostKey) return json(res, 403, { error: 'Not this table' });
    t.remotes.forEach(r => sse(r.res, { type: 'closed' })); tables.delete(t.code);
    return json(res, 200, { ok: true });
  }
  // Open tables, for the phone's "join" screen
  if (url.pathname === '/api/tables') return json(res, 200, { tables: [...tables.values()].filter(t => t.host).map(tableInfo) });

  // Event stream for a host or a remote
  if (url.pathname === '/api/stream') {
    const t = tables.get(q.get('t')), role = q.get('role'), device = q.get('device');
    if (!t) return json(res, 404, { error: 'No such table' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    if (role === 'host') {
      if (q.get('key') !== t.hostKey) { sse(res, { type: 'error', text: 'Not this table' }); return res.end(); }
      t.host = res; t.hostSeen = Date.now();
      t.remotes.forEach((r, d) => { sse(r.res, { type: 'host', online: true }); sse(res, { type: 'presence', device: d, online: true }); });
      req.on('close', () => {
        if (t.host !== res) return;
        t.host = null; t.hostSeen = Date.now();
        t.remotes.forEach(r => sse(r.res, { type: 'host', online: false }));
      });
    } else {
      if (!device || !/^[\w-]{6,64}$/.test(device)) return res.end();
      const old = t.remotes.get(device);
      if (old && old.res !== res) try { old.res.end(); } catch {}
      const token = secret();
      t.remotes.set(device, { res, token });
      sse(res, { type: 'session', token });                  // this phone's key for sending actions
      if (t.state) sse(res, t.state);                      // catch up straight away
      sse(res, { type: 'host', online: !!t.host });
      if (t.host) sse(t.host, { type: 'presence', device, online: true });
      req.on('close', () => {
        if (t.remotes.get(device)?.res !== res) return;
        t.remotes.delete(device);
        if (t.host) sse(t.host, { type: 'presence', device, online: false });
      });
    }
    return;
  }

  // A message from a device: remote → host, or host → one remote / all remotes
  if (url.pathname === '/api/send' && req.method === 'POST') {
    const body = await readBody(req), t = tables.get(body.t);
    if (!t) return json(res, 404, { error: 'No such table' });
    const msg = body.msg || {};
    if (body.from === 'host') {
      if (body.hostKey !== t.hostKey) return json(res, 403, { error: 'Not this table' });
      if (msg.type === 'state') t.state = msg;             // remembered for phones that connect later
      if (body.to && body.to !== 'all') { const r = t.remotes.get(body.to); if (r) sse(r.res, msg); }
      else t.remotes.forEach(r => sse(r.res, msg));
    } else {
      const me = t.remotes.get(body.from);
      if (!me || me.token !== body.token) return json(res, 403, { error: 'This phone isn\'t connected to the table. Reload the page.' });
      if (!t.host) return json(res, 503, { error: 'The table is offline' });
      sse(t.host, { ...msg, device: body.from });         // the table only ever sees the verified sender
    }
    return json(res, 200, { ok: true });
  }
  json(res, 404, { error: 'Unknown endpoint' });
}

// ---- Speech: macOS "say" → WAV, cached ----
const TTS_OK = process.platform === 'darwin';
const TTS_VOICES = ['Daniel', 'Samantha', 'Alex'];
const ttsCache = new Map();                       // "voice|text" → Promise<Buffer>, most recent last
function speak(text, voice) {
  const key = voice + '|' + text;
  if (ttsCache.has(key)) { const hit = ttsCache.get(key); ttsCache.delete(key); ttsCache.set(key, hit); return hit; }
  const file = path.join(os.tmpdir(), `gn-tts-${process.pid}-${crypto.randomBytes(6).toString('hex')}.wav`);
  const job = new Promise((resolve, reject) => {
    // arguments are passed straight to "say" (no shell), so the text can't run anything
    execFile('say', ['-v', voice, '-r', '185', '-o', file, '--data-format=LEI16@22050', '--', text], { timeout: 15000 }, err => {
      if (err) return reject(err);
      fs.readFile(file, (e, data) => { fs.unlink(file, () => {}); e ? reject(e) : resolve(data); });
    });
  });
  job.catch(() => ttsCache.delete(key));
  ttsCache.set(key, job);
  if (ttsCache.size > 300) ttsCache.delete(ttsCache.keys().next().value);
  return job;
}

// QR code as SVG: the Node `qrcode` package, or Python's `segno` (pip install segno) when that is what's installed
let QRCode = null;
try { QRCode = require('qrcode'); } catch {}
const qrCache = new Map();
function qrSvg(text) {
  if (!qrCache.has(text)) {
    const job = QRCode
      ? QRCode.toString(text, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0b1d14', light: '#ffffff' } })
      : new Promise((resolve, reject) => execFile('python3', ['-c',
          'import sys, io, segno; b = io.BytesIO(); segno.make(sys.argv[1], error="m").save(b, kind="svg", border=2, xmldecl=False); sys.stdout.write(b.getvalue().decode())', text],
          { timeout: 8000 }, (err, out) => err || !out.includes('<svg') ? reject(err || new Error('no svg')) : resolve(out)));
    job.catch(() => qrCache.delete(text));
    qrCache.set(text, job);
  }
  return qrCache.get(text);
}

function filesVersion() {
  let latest = 0;
  const walk = dir => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch {}
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|js|css|webmanifest)$/.test(e.name)) { try { latest = Math.max(latest, fs.statSync(p).mtimeMs); } catch {} }
    }
  };
  walk(ROOT);
  return String(Math.round(latest));
}

function serveFile(res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || /(^|[\\/])\./.test(path.relative(ROOT, file))) {   // only public/, never dotfiles
    res.writeHead(404); return res.end('Not found');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); }
  catch { res.writeHead(400); return res.end('Bad request'); }   // e.g. a request for "//": answer it instead of crashing the server
  if (url.pathname.startsWith('/api/')) return api(req, res, url).catch(() => json(res, 500, { error: 'Server error' }));
  serveFile(res, url);
});

// Keep event streams alive, and forget tables whose host has been gone too long
setInterval(() => {
  for (const t of tables.values()) {
    if (t.host) t.host.write(': ping\n\n');
    t.remotes.forEach(r => r.res.write(': ping\n\n'));
    if (!t.host && Date.now() - t.hostSeen > HOST_GRACE_MS) {
      t.remotes.forEach(r => sse(r.res, { type: 'closed' }));
      tables.delete(t.code);
    }
  }
}, 15000);

server.listen(PORT, '0.0.0.0', () => {
  const ips = lanAddresses();
  console.log(`Game Night running on port ${PORT}`);
  console.log(`  This computer:  http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Phones on Wi-Fi: http://${ip}:${PORT}`));
});
// Stopping (Ctrl+C, closing the Terminal, a test ending) exits normally, so Node finishes its own work (e.g. coverage data)
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => process.on(sig, () => process.exit(0)));
