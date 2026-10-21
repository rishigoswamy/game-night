const H = require('./helpers');
// "Start Game Night.command": opens the home page only when no Game Night tab is open, and stops the game when closed.
// The macOS `open` command is replaced by a stand-in that only records being called, so no real tabs appear.
const { chromium } = require('playwright-core');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const PORT = H.PORT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stub = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-open-'));
const openLog = path.join(stub, 'open.log');
fs.writeFileSync(path.join(stub, 'open'), `#!/bin/sh\necho "$@" >> "${openLog}"\n`, { mode: 0o755 });
const opened = () => (fs.existsSync(openLog) ? fs.readFileSync(openLog, 'utf8').trim().split('\n').filter(Boolean) : []);
const listening = () => !!spawnSync('lsof', ['-nP', '-t', `-iTCP:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim();
const starter = () => spawn('/bin/sh', [path.join(H.ROOT, 'Start Game Night.command'), String(PORT)],
  { env: { ...process.env, PATH: `${stub}:${process.env.PATH}`, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore', detached: true });
const stop = p => { try { process.kill(-p.pid, 'SIGHUP'); } catch {} };     // like closing the Terminal window
(async () => {
  const errs = [];
  // 1. no Game Night tab open → the starter opens the home page
  let s = starter();
  await sleep(5000);
  console.log('no tab open → starter opened:', JSON.stringify(opened()), '| game running:', listening());
  stop(s); await sleep(1000);
  console.log('starter window closed → game stopped:', !listening());
  // 2. a Game Night tab is open (showing "isn't running") → the starter reuses it
  fs.rmSync(openLog, { force: true });
  s = starter(); await sleep(2500);
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const ctx = await b.newContext(); await ctx.addInitScript(() => { speechSynthesis.speak = () => {}; });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/casino.html`);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  stop(s); await sleep(1000);
  fs.rmSync(openLog, { force: true });
  await page.waitForSelector('#serverDown:not([hidden])', { timeout: 9000 });
  console.log('game stopped → open tab shows:', (await page.textContent('#serverDown')).split('.')[0]);
  s = starter();
  // the tab was connected before, so it just reconnects: the bar goes away (pages opened offline reload instead)
  await page.waitForSelector('#serverDown', { state: 'hidden', timeout: 10000 });
  await sleep(4000);
  console.log('tab already open → starter opened:', JSON.stringify(opened()), '| tab reconnected, bar hidden:', await page.isHidden('#serverDown'));
  stop(s); await sleep(800);
  console.log('starter window closed → game stopped:', !listening());
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  fs.rmSync(stub, { recursive: true, force: true });
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
