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
const B = require('../../scripts/banner');

// The tests: every script in this folder, found fresh each run (so a new test runs, and counts, without being listed
// anywhere). Not tests: this runner, and shared modules, which are the files that export something (helpers.js, party-setup.js).
const TESTS = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.js') && f !== 'run.js' && !/\b(module\.)?exports\b/.test(fs.readFileSync(path.join(__dirname, f), 'utf8')))
  .map(f => f.slice(0, -3)).sort();
// These expect a test server already running (the others start their own)
const NEEDS_SERVER = new Set(['roulette-two-phones', 'roulette-master-only', 'roulette-phone-locks', 'roulette-phone-view', 'roulette-phone-landing', 'update-bar']);

const only = process.argv.slice(2);
const unknown = only.filter(t => !TESTS.includes(t));
if (unknown.length) { console.error(`Unknown test(s): ${unknown.join(', ')}\nAvailable: ${TESTS.join(', ')}`); process.exit(2); }
// Tests that change something every test server shares run alone, after the others:
// update-bar touches a game file, so every running server would report an update
const SOLO = new Set(['update-bar']);
// Tests that lean on something the whole machine shares never run at the same time as each other (the others still run
// alongside): the voice tests make the dealer's lines with macOS speech (`say`), which slows down a lot when busy
const LOCKS = { 'dealer-voice': 'speech', 'phone-voice': 'speech' };
const held = new Set();
const PORTS = [8091, 8092, 8093].slice(0, Math.max(1, Math.min(3, +process.env.E2E_WORKERS || 3)));
const work = process.env.E2E_OUT || path.join(os.tmpdir(), 'game-night-e2e');   // logs and screenshots (CI sets E2E_OUT to keep them)
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

async function runOne(t, port, retry = 0, progress = () => '') {
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
  fs.writeFileSync(path.join(work, t + (retry ? `.retry${retry}` : '') + '.log'), out);   // every attempt's log is kept
  if (!retry) times[t] = secs;
  const line = `${t}  ${B.dim(`(${secs}s${PORTS.length > 1 ? `, port ${port}` : ''}${retry ? `, retry ${retry}` : ''})`)}`;
  const n = B.dim(progress());                                   // [ 3/28]: how far through this round
  console.log(`${n} ${ok ? (retry ? B.yellow(`⚠ ${line} passed on retry ${retry}: flaky`) : B.green(`✓ ${line}`)) : B.red(`✗ ${line}`)}`);
  if (!ok) console.log(out.split('\n').map(l => '      ' + l).join('\n'));
  return ok;
}

// Run a list of tests: each worker has its own port (its own test server and phones) and takes the next test it may run;
// tests in SOLO run after the others, alone
async function runAll(list, results, retry = 0) {
  let done = 0;
  const width = String(list.length).length, progress = () => `[${String(++done).padStart(width)}/${list.length}]`;
  const queue = list.filter(t => !SOLO.has(t)).sort((a, b) => (times[b] ?? 60) - (times[a] ?? 60));
  await Promise.all(PORTS.map(async port => {
    while (queue.length) {
      const k = queue.findIndex(t => !held.has(LOCKS[t]));              // the next test whose shared resource is free
      if (k < 0) { await sleep(250); continue; }
      const t = queue.splice(k, 1)[0], lock = LOCKS[t];
      if (lock) held.add(lock);
      results[t] = await runOne(t, port, retry, progress);
      if (lock) held.delete(lock);
    }
  }));
  for (const t of list.filter(t => SOLO.has(t))) results[t] = await runOne(t, PORTS[0], retry, progress);
}

(async () => {
  const t0 = Date.now();
  const chosen = only.length ? only : TESTS;
  B.banner('E2E', 'End-to-end tests', `${chosen.length} test${chosen.length === 1 ? '' : 's'}: real games in Chrome with simulated phones, ${PORTS.length} at a time`);
  const results = {};
  await runAll(chosen, results);
  try { fs.writeFileSync(timesFile, JSON.stringify(times)); } catch {}
  // Retries at the end: only the tests that failed, after a pause, up to TEST_RETRIES times
  const flaky = [];
  let failed = chosen.filter(t => !results[t]);
  for (let r = 1; r <= B.retries.test && failed.length; r++) {
    console.log('');
    B.warn(`⟳ Retrying ${failed.length} failed test${failed.length === 1 ? '' : 's'} in ${B.retries.delay} s (retry ${r} of ${B.retries.test}): ${failed.join(', ')}`);
    await sleep(B.retries.delay * 1000);
    await runAll(failed, results, r);
    flaky.push(...failed.filter(t => results[t]).map(t => `${t} (retry ${r})`));
    failed = failed.filter(t => !results[t]);
  }
  const mins = (Date.now() - t0) / 60000;
  const took = `${mins.toFixed(1)} min, ${PORTS.length} at a time`;
  const flakyNote = flaky.length ? ` · ${flaky.length} flaky` : '';
  B.record('e2e', !failed.length, `${chosen.length - failed.length} of ${chosen.length}${flakyNote}`, Date.now() - t0, flaky);
  console.log('');
  if (failed.length) { B.fail(`End-to-end tests failed: ${chosen.length - failed.length} of ${chosen.length} passed${B.retries.test ? ` after ${B.retries.test} ${B.retries.test === 1 ? 'retry' : 'retries'}` : ''}  (${took})`); console.error(B.red(`   failed: ${failed.join(', ')}`)); }
  else B.ok(`End-to-end tests passed: ${chosen.length} of ${chosen.length}${flakyNote}  (${took})`);
  flaky.forEach(f => B.warn(`   ⚠ flaky: ${f} passed only on a retry`));
  console.log(B.dim(`   logs and screenshots: ${work}`));
  // a reminder of how releases work, for whoever runs the tests on their own machine (not in GitHub's logs)
  if (!failed.length && !process.env.GITHUB_ACTIONS) {
    try { console.log('\n' + require('../../scripts/release-hint').lines().map(l => B.dim(`   ${l}`)).join('\n')); } catch {}
  }
  process.exit(failed.length ? 1 : 0);
})();
