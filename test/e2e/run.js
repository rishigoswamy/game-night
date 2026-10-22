#!/usr/bin/env node
// End-to-end test runner: plays real games in a muted Chrome against test servers.
//   npm run test:e2e                      run everything, 3 tests at a time (each on its own test port, 8091–8093)
//   npm run test:e2e -- party-gofish ...  run only the named tests
//   E2E_WORKERS=1 npm run test:e2e        one at a time (on 8091), e.g. to debug
// (The fast unit tests are separate: npm test)
// Each test is a script that prints what it checked; it fails on a non-zero exit, a "FAILED"/"BAD" line,
// or browser errors ("errors: [...]"). Screenshots go to a temporary folder, never into the repo.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('./helpers');

const TESTS = [
  'casino-tables-round', 'casino-phone-sicbo', 'blackjack-phone', 'roulette-two-phones', 'roulette-master-only', 'roulette-phone-locks',
  'roulette-phone-view', 'roulette-phone-landing', 'update-bar', 'dealer-voice', 'phone-voice', 'storage-migration', 'flushes',
  'party-gofish', 'party-bluff-ending', 'party-werewolf-rules', 'party-werewolf-robber', 'party-werewolf-roles', 'party-icons', 'party-catan-rules', 'party-leave-rejoin',
  'join-qr', 'server-down', 'starter', 'party-werewolf-game', 'party-catan-game', 'party-tambola-game', 'party-tambola-modes',
];
// These expect a test server already running (the others start their own)
const NEEDS_SERVER = new Set(['roulette-two-phones', 'roulette-master-only', 'roulette-phone-locks', 'roulette-phone-view', 'roulette-phone-landing', 'update-bar']);

const only = process.argv.slice(2);
const unknown = only.filter(t => !TESTS.includes(t));
if (unknown.length) { console.error(`Unknown test(s): ${unknown.join(', ')}\nAvailable: ${TESTS.join(', ')}`); process.exit(2); }
// Tests that change something every test server shares run alone, after the others:
// update-bar touches a game file, so every running server would report an update
const SOLO = new Set(['update-bar']);
const PORTS = [8091, 8092, 8093].slice(0, Math.max(1, Math.min(3, +process.env.E2E_WORKERS || 3)));
const work = path.join(os.tmpdir(), 'game-night-e2e');
fs.mkdirSync(path.join(work, 'shots'), { recursive: true });
// How long each test took last time, so the longest start first (the run then ends sooner)
const timesFile = path.join(work, 'times.json');
let times = {};
try { times = JSON.parse(fs.readFileSync(timesFile, 'utf8')); } catch {}

const freePort = port => {                       // stop anything a previous run left on a test port
  const r = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  (r.stdout || '').split('\n').filter(Boolean).forEach(pid => { try { process.kill(+pid); } catch {} });
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const run = (t, port) => new Promise(res => {
  const c = spawn('node', [path.join(__dirname, t + '.js')], { cwd: work, env: { ...process.env, E2E_PORT: String(port) } });
  let out = '';
  c.stdout.on('data', d => { out += d; }); c.stderr.on('data', d => { out += d; });
  c.on('close', status => res({ status, out }));
});

async function runOne(t, port) {
  freePort(port); await sleep(400);
  let server = null;
  if (NEEDS_SERVER.has(t)) {
    server = spawn('node', [H.SERVER, String(port)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
    await sleep(900);
  }
  const t0 = Date.now();
  const r = await run(t, port);
  if (server) server.kill();
  freePort(port);
  const out = r.out;
  const errorsLine = out.split('\n').filter(l => /errors?:/.test(l));
  const ok = r.status === 0 && !/FAILED|^BAD/m.test(out) && errorsLine.every(l => l.includes('errors: none'));
  const secs = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(work, t + '.log'), out);
  times[t] = secs;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t}  (${secs}s${PORTS.length > 1 ? `, port ${port}` : ''})`);
  if (!ok) console.log(out.split('\n').map(l => '      ' + l).join('\n'));
  return ok;
}

(async () => {
  const t0 = Date.now();
  const chosen = only.length ? only : TESTS;
  const queue = chosen.filter(t => !SOLO.has(t)).sort((a, b) => (times[b] ?? 60) - (times[a] ?? 60));
  const results = {};
  // each worker has its own port (its own test server and phones) and takes the next test from the queue
  await Promise.all(PORTS.map(async port => { for (let t; (t = queue.shift());) results[t] = await runOne(t, port); }));
  for (const t of chosen.filter(t => SOLO.has(t))) results[t] = await runOne(t, PORTS[0]);
  try { fs.writeFileSync(timesFile, JSON.stringify(times)); } catch {}
  const failed = chosen.filter(t => !results[t]);
  const mins = (Date.now() - t0) / 60000;
  console.log(`\n${chosen.length - failed.length} passed, ${failed.length} failed${failed.length ? ` (${failed.join(', ')})` : ''} in ${mins.toFixed(1)} min, ${PORTS.length} at a time. Logs and screenshots: ${work}`);
  process.exit(failed.length ? 1 : 0);
})();
