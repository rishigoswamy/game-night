// The Node server (server/server.js): static files, who may run a table, and the message relay.
// Starts a real server on a spare port; "phones" are simulated by connecting through this computer's network address
// (with DC_LOOPBACK_ONLY=1 the server treats anything but localhost as a phone).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

// A free port, asked of the computer in this process when the tests start (never the game's 8080 or the end-to-end
// tests' 8091–8093), so these tests can run while the end-to-end tests do, e.g. during a git push's checks.
// (Not in a helper process: under `node --test` a child's output can arrive in the test runner's own format.)
const net = require('node:net');
function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }).on('error', rej);
  });
}
let PORT, MAC, PHONE;
const SERVER = path.resolve(__dirname, '..', '..', 'server', 'server.js');
const LAN = Object.values(os.networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal)?.address;

const noLan = { skip: LAN ? false : 'no Wi-Fi/LAN address to act as a phone' };

// A stand-in for macOS's "say" (server.js runs GN_SAY_COMMAND instead), so the dealer's voice can be tested on any
// computer: it takes say's arguments, writes a small WAV file to the -o path, logs each call, and fails on "FAIL"
const fs = require('node:fs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-say-'));
const SAY = path.join(TMP, 'say'), SAY_LOG = path.join(TMP, 'calls.log');
fs.writeFileSync(SAY, `#!${process.execPath}
const a = process.argv.slice(2), arg = f => a[a.indexOf(f) + 1], text = a[a.indexOf('--') + 1];
require('fs').appendFileSync(${JSON.stringify(SAY_LOG)}, JSON.stringify(a) + '\\n');
if (text.includes('FAIL')) process.exit(1);
require('fs').writeFileSync(arg('-o'), 'RIFF' + JSON.stringify({ voice: arg('-v'), text }));
`, { mode: 0o755 });
const sayCalls = () => (fs.existsSync(SAY_LOG) ? fs.readFileSync(SAY_LOG, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);

let server;
test.before(async () => {
  for (let tries = 0; !PORT && tries < 20; tries++) { const p = await freePort(); if (p !== 8080 && (p < 8091 || p > 8093)) PORT = p; }
  if (!PORT) throw new Error('no free port for the test server');
  MAC = `http://localhost:${PORT}`; PHONE = LAN && `http://${LAN}:${PORT}`;
  server = spawn(process.execPath, [SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1', GN_SAY_COMMAND: SAY }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { server.stdout.once('data', res); server.once('exit', code => rej(new Error('server exited ' + code))); });
});
test.after(() => { server.kill(); fs.rmSync(TMP, { recursive: true, force: true }); });

// A raw GET that sends the path exactly as written (fetch would clean up "//" and "../")
const raw = p => new Promise((res, rej) => {
  http.get({ host: 'localhost', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', rej);
});
const post = (base, p, body) => fetch(base + p, { method: 'POST', body: JSON.stringify(body) });
// An event stream: collects events; next(type) waits for the next one of that type
function stream(base, query) {
  const events = [], waiters = [];
  const req = http.get(`${base}/api/stream?${query}`, res => {
    let buf = '';
    res.on('data', chunk => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = block.split('\n').find(l => l.startsWith('data: '));
        if (!line) continue;
        const ev = JSON.parse(line.slice(6));
        events.push(ev);
        waiters.filter(w => w.type === ev.type).forEach(w => { waiters.splice(waiters.indexOf(w), 1); w.res(ev); });
      }
    });
  });
  req.on('error', () => {});
  return {
    events,
    next(type, ms = 3000) {
      const seen = events.find(e => e.type === type && !e.taken);
      if (seen) { seen.taken = true; return Promise.resolve(seen); }
      return new Promise((res, rej) => { waiters.push({ type, res: ev => { ev.taken = true; res(ev); } }); setTimeout(() => rej(new Error('no ' + type + ' event')), ms); });
    },
    close() { req.destroy(); },
  };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function openTable(game = 'roulette', takeover = true) {
  const r = await post(MAC, '/api/host', { game, takeover });
  assert.equal(r.status, 200);
  const t = await r.json();
  const host = stream(MAC, `t=${t.code}&role=host&key=${t.hostKey}`);
  await sleep(150);
  return { ...t, host };
}

/* ---------------- Is a Game Night page open on this computer? (the starter asks, to avoid a second tab) ---------------- */
test('/api/master-open: only a page on this computer counts, not a phone', noLan, async () => {
  const open = async () => (await (await fetch(MAC + '/api/master-open')).json()).open;
  assert.equal(await open(), false, 'nothing has checked in yet');
  await fetch(PHONE + '/api/info');
  assert.equal(await open(), false, "a phone doesn't count");
  await fetch(MAC + '/api/info');
  assert.equal(await open(), true, 'a page on this computer checked in');
});

/* ---------------- Static files ---------------- */
test('serves the pages and their files from public/', async () => {
  for (const [p, type] of [['/', 'text/html'], ['/casino.html', 'text/html'], ['/js/lib/leaderboard.js', 'text/javascript'],
    ['/css/base-table.css', 'text/css'], ['/games/party/catan.js', 'text/javascript'], ['/icons/icon-192.png', 'image/png']]) {
    const r = await fetch(MAC + p);
    assert.equal(r.status, 200, p);
    assert.ok(r.headers.get('content-type').startsWith(type), `${p}: ${r.headers.get('content-type')}`);
  }
});

test('never serves anything outside public/ or hidden files', async () => {
  for (const p of ['/server/server.js', '/../server/server.js', '/%2e%2e/server/server.js', '/..%2fserver%2fserver.js',
    '/package.json', '/.gitignore', '/node_modules/qrcode/package.json', '/no-such-page.html']) {
    assert.equal(await raw(p), 404, p);
  }
});

test('a malformed address gets "400 Bad request" and the server keeps running', async () => {
  assert.equal(await raw('//'), 400);
  assert.equal((await fetch(MAC + '/')).status, 200);
});

/* ---------------- Who may run a table ---------------- */
test('/api/info tells the host computer from a phone', noLan, async () => {
  assert.equal((await (await fetch(MAC + '/api/info')).json()).master, true);
  assert.equal((await (await fetch(PHONE + '/api/info')).json()).master, false);
});

test('only the host computer can open a table', noLan, async () => {
  const r = await post(PHONE, '/api/host', { game: 'roulette', takeover: true });
  assert.equal(r.status, 403);
});

test('one table at a time: a second screen must take over, and the old table\'s phones are moved', noLan, async () => {
  const a = await openTable('roulette');
  const phone = stream(PHONE, `t=${a.code}&role=remote&device=dphone01`);
  await phone.next('session');
  const refused = await post(MAC, '/api/host', { game: 'blackjack' });
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).code, a.code);
  const b = await (await post(MAC, '/api/host', { game: 'blackjack', takeover: true })).json();
  assert.notEqual(b.code, a.code);
  assert.equal((await phone.next('closed')).replacedBy, b.code, 'the phone is told where the table went');
  assert.equal((await a.host.next('replaced')).type, 'replaced', 'the old screen is told it was replaced');
  phone.close(); a.host.close();
});

test('/api/tables lists the table (with its game) only while its screen is connected', async () => {
  const t = await openTable('sicbo');
  let { tables } = await (await fetch(MAC + '/api/tables')).json();
  assert.deepEqual(tables.map(x => [x.code, x.game]), [[t.code, 'sicbo']]);
  t.host.close(); await sleep(200);
  ({ tables } = await (await fetch(MAC + '/api/tables')).json());
  assert.equal(tables.length, 0);
});

/* ---------------- The relay ---------------- */
test('phones get a session token; the table sees their messages from the verified device only', noLan, async () => {
  const t = await openTable('roulette');
  const phone = stream(PHONE, `t=${t.code}&role=remote&device=dphone02`);
  const { token } = await phone.next('session');
  assert.match(token, /^[0-9a-f]{32}$/);
  assert.equal((await t.host.next('presence')).device, 'dphone02');
  const ok = await post(PHONE, '/api/send', { t: t.code, from: 'dphone02', token, msg: { type: 'bet', key: 'red', device: 'someone-else' } });
  assert.equal(ok.status, 200);
  const got = await t.host.next('bet');
  assert.equal(got.device, 'dphone02', 'the table sees the real sender, not what the message claims');
  assert.equal(got.key, 'red');
  phone.close(); t.host.close();
});

test('a phone cannot send without its token, or as another phone', noLan, async () => {
  const t = await openTable('roulette');
  const a = stream(PHONE, `t=${t.code}&role=remote&device=dphoneA1`), b = stream(PHONE, `t=${t.code}&role=remote&device=dphoneB1`);
  const ta = (await a.next('session')).token; await b.next('session');
  assert.equal((await post(PHONE, '/api/send', { t: t.code, from: 'dphoneA1', token: 'wrong', msg: { type: 'bet' } })).status, 403);
  assert.equal((await post(PHONE, '/api/send', { t: t.code, from: 'dphoneB1', token: ta, msg: { type: 'bet' } })).status, 403, "A's token doesn't work for B");
  assert.equal((await post(PHONE, '/api/send', { t: 'NOPE', from: 'dphoneA1', token: ta, msg: {} })).status, 404);
  a.close(); b.close(); t.host.close();
});

test('only the table (with its host key) can talk to phones; private messages reach one phone', noLan, async () => {
  const t = await openTable('party-test');
  const a = stream(PHONE, `t=${t.code}&role=remote&device=dphoneA2`), b = stream(PHONE, `t=${t.code}&role=remote&device=dphoneB2`);
  await a.next('session'); await b.next('session');
  assert.equal((await post(MAC, '/api/send', { t: t.code, from: 'host', hostKey: 'wrong', msg: { type: 'say', text: 'x' } })).status, 403);
  await post(MAC, '/api/send', { t: t.code, from: 'host', hostKey: t.hostKey, to: 'dphoneA2', msg: { type: 'secret', role: 'werewolf' } });
  assert.equal((await a.next('secret')).role, 'werewolf');
  await sleep(200);
  assert.ok(!b.events.some(e => e.type === 'secret'), 'the other phone never sees it');
  await post(MAC, '/api/send', { t: t.code, from: 'host', hostKey: t.hostKey, msg: { type: 'say', text: 'Hello all' } });
  assert.equal((await a.next('say')).text, 'Hello all'); assert.equal((await b.next('say')).text, 'Hello all');
  a.close(); b.close(); t.host.close();
});

test('a phone that connects later gets the latest table state straight away', noLan, async () => {
  const t = await openTable('roulette');
  await post(MAC, '/api/send', { t: t.code, from: 'host', hostKey: t.hostKey, msg: { type: 'state', round: 7 } });
  const late = stream(PHONE, `t=${t.code}&role=remote&device=dphoneL1`);
  await late.next('session');
  assert.equal((await late.next('state')).round, 7);
  late.close(); t.host.close();
});

test('unknown API calls get a JSON 404', async () => {
  const r = await fetch(MAC + '/api/nope');
  assert.equal(r.status, 404);
  assert.ok((await r.json()).error);
});

/* ---------------- The dealer's voice (/api/tts) ---------------- */
test('the dealer\'s voice: the line is spoken by the computer and sent as a WAV clip; a repeated line comes from memory', async () => {
  const before = sayCalls().length;
  const get = (text, voice) => fetch(`${MAC}/api/tts?text=${encodeURIComponent(text)}${voice ? `&voice=${voice}` : ''}`);
  let r = await get('Place your bets, please.', 'Samantha');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/wav');
  assert.match(r.headers.get('cache-control'), /max-age=86400/, 'the phone keeps it for a day');
  assert.deepEqual(JSON.parse((await r.text()).slice(4)), { voice: 'Samantha', text: 'Place your bets, please.' });
  const call = sayCalls().at(-1);
  assert.deepEqual([call[0], call[1], call[2], call[3], call[4], call[6]], ['-v', 'Samantha', '-r', '185', '-o', '--data-format=LEI16@22050']);
  assert.match(call[5], /gn-tts-.*\.wav$/, 'written to a temporary WAV file…');
  assert.equal(fs.existsSync(call[5]), false, '…which is deleted once sent');
  r = await get('Place your bets, please.', 'Samantha');
  assert.equal(r.status, 200);
  assert.equal(sayCalls().length, before + 1, 'the second request didn\'t speak again');
  await get('Place your bets, please.', 'Daniel');
  assert.equal(sayCalls().length, before + 2, 'another voice is another clip');
});

test('the dealer\'s voice: only the known voices; text is passed as text (never run) and capped; empty text or a failure is an error', async () => {
  const get = (q) => fetch(`${MAC}/api/tts?${q}`);
  await (await get('text=Hello&voice=Evil')).arrayBuffer();
  assert.equal(sayCalls().at(-1)[1], 'Daniel', 'an unknown voice falls back to the dealer\'s default');
  const trick = '"; rm -rf ~; echo "$(whoami)` --help';
  const r = await get('text=' + encodeURIComponent(trick));
  assert.equal(r.status, 200);
  const call = sayCalls().at(-1);
  assert.equal(call.at(-1), trick, 'handed over word for word as one argument, after "--": nothing in it is run');
  assert.equal(call.at(-2), '--');
  await (await get('text=' + 'x'.repeat(500) + '&voice=Alex')).arrayBuffer();
  assert.equal(sayCalls().at(-1).at(-1).length, 220, 'long text is cut to 220 characters');
  for (const q of ['text=', 'text=%20%20', '']) assert.equal((await get(q)).status, 404, `"${q}": nothing to say`);
  const before = sayCalls().length;
  const failed = await get('text=FAIL%20once');
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).error, 'Speech failed');
  await get('text=FAIL%20once');
  assert.equal(sayCalls().length, before + 2, 'a failure isn\'t remembered: the next request tries again');
});

/* ---------------- The join QR code, closing a table, the files' version ---------------- */
test('/api/qr.svg: a QR code of the address phones open (this computer\'s Wi-Fi address and port)', noLan, async () => {
  const r = await fetch(MAC + '/api/qr.svg');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/svg+xml');
  const svg = await r.text();
  assert.match(svg, /^<svg[^>]+viewBox/);
  const again = await (await fetch(MAC + '/api/qr.svg')).text();
  assert.equal(again, svg, 'the same code each time');
  // it encodes http://<the Wi-Fi address>:<port>/remote.html: the same as the qrcode package makes for that address
  const expected = await require('qrcode').toString(`http://${LAN}:${PORT}/remote.html`, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0b1d14', light: '#ffffff' } });
  assert.equal(svg, expected);
});

test('the table\'s screen can close the table: its phones are told, and it\'s gone; nobody else can close it', noLan, async () => {
  const t = await openTable('craps');
  const phone = stream(PHONE, `t=${t.code}&role=remote&device=dphoneC1`);
  await phone.next('session');
  assert.equal((await post(MAC, '/api/close', { code: t.code, hostKey: 'wrong' })).status, 403);
  assert.equal((await post(PHONE, '/api/close', { code: t.code })).status, 403, 'a phone can\'t close it');
  assert.equal((await post(MAC, '/api/close', { code: 'NOPE', hostKey: t.hostKey })).status, 403);
  const r = await post(MAC, '/api/close', { code: t.code, hostKey: t.hostKey });
  assert.deepEqual(await r.json(), { ok: true });
  const closed = await phone.next('closed');
  assert.equal(closed.replacedBy, undefined, 'closed, not moved to another table');
  assert.equal((await fetch(`${MAC}/api/stream?t=${t.code}&role=remote&device=dphoneC2`)).status, 404, 'the table is gone');
  phone.close(); t.host.close();
});

test('/api/version: the time of the newest game file, so open pages can tell when they are out of date', async () => {
  const v = (await (await fetch(MAC + '/api/version')).json()).version;
  // computed independently: the newest .html / .js / .css / .webmanifest under public/
  let newest = 0;
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (/\.(html|js|css|webmanifest)$/.test(e.name)) newest = Math.max(newest, fs.statSync(p).mtimeMs);
  });
  walk(path.resolve(__dirname, '..', '..', 'public'));
  assert.equal(v, String(Math.round(newest)));
  assert.equal((await (await fetch(MAC + '/api/version')).json()).version, v, 'the same until a file changes');
});

test('an API request that breaks gets a JSON 500, and the server keeps running', async () => {
  // a body of "null" parses to nothing usable, so the handler fails part-way: the request is answered, not left hanging
  for (const p of ['/api/host', '/api/close']) {
    const r = await fetch(MAC + p, { method: 'POST', body: 'null' });
    assert.equal(r.status, 500, p);
    assert.deepEqual(await r.json(), { error: 'Server error' });
  }
  assert.equal((await fetch(MAC + '/')).status, 200, 'still serving');
});
