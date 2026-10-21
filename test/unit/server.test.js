// The Node server (server/server.js): static files, who may run a table, and the message relay.
// Starts a real server on a spare port; "phones" are simulated by connecting through this computer's network address
// (with DC_LOOPBACK_ONLY=1 the server treats anything but localhost as a phone).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = 8093;
const SERVER = path.resolve(__dirname, '..', '..', 'server', 'server.js');
const LAN = Object.values(os.networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal)?.address;
const MAC = `http://localhost:${PORT}`, PHONE = LAN && `http://${LAN}:${PORT}`;
const noLan = { skip: LAN ? false : 'no Wi-Fi/LAN address to act as a phone' };

let server;
test.before(async () => {
  server = spawn(process.execPath, [SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { server.stdout.once('data', res); server.once('exit', code => rej(new Error('server exited ' + code))); });
});
test.after(() => server.kill());

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
