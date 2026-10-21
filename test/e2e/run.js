#!/usr/bin/env node
// End-to-end test runner: plays real games in a muted Chrome against a test server on port 8091.
//   npm test                      run everything (about 15 minutes; the full Werewolf and Catan games are long)
//   npm test -- party-gofish ...  run only the named tests
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
  'party-gofish', 'party-bluff-ending', 'party-werewolf-rules', 'party-werewolf-robber', 'party-catan-rules', 'party-leave-rejoin',
  'party-werewolf-game', 'party-catan-game',
];
// These expect a test server already running (the others start their own)
const NEEDS_SERVER = new Set(['roulette-two-phones', 'roulette-master-only', 'roulette-phone-locks', 'roulette-phone-view', 'roulette-phone-landing', 'update-bar']);

const only = process.argv.slice(2);
const unknown = only.filter(t => !TESTS.includes(t));
if (unknown.length) { console.error(`Unknown test(s): ${unknown.join(', ')}\nAvailable: ${TESTS.join(', ')}`); process.exit(2); }
const work = path.join(os.tmpdir(), 'game-night-e2e');
fs.mkdirSync(path.join(work, 'shots'), { recursive: true });

const freePort = () => {                        // stop anything a previous run left on the test port
  const r = spawnSync('lsof', ['-nP', '-t', `-iTCP:${H.PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  (r.stdout || '').split('\n').filter(Boolean).forEach(pid => { try { process.kill(+pid); } catch {} });
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const results = [];
  for (const t of only.length ? only : TESTS) {
    freePort(); await sleep(400);
    let server = null;
    if (NEEDS_SERVER.has(t)) {
      server = spawn('node', [H.SERVER, String(H.PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
      await sleep(900);
    }
    const t0 = Date.now();
    const r = spawnSync('node', [path.join(__dirname, t + '.js')], { cwd: work, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
    if (server) server.kill();
    freePort();
    const out = (r.stdout || '') + (r.stderr || '');
    const errorsLine = out.split('\n').filter(l => /errors?:/.test(l));
    const ok = r.status === 0 && !/FAILED|^BAD/m.test(out) && errorsLine.every(l => l.includes('errors: none'));
    fs.writeFileSync(path.join(work, t + '.log'), out);
    results.push(ok);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${t}  (${Math.round((Date.now() - t0) / 1000)}s)`);
    if (!ok) console.log(out.split('\n').map(l => '      ' + l).join('\n'));
  }
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed. Logs and screenshots: ${work}`);
  process.exit(failed ? 1 : 0);
})();
