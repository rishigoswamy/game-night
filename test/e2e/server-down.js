const H = require('./helpers');
// When the server isn't running, Mac pages say so (even when the offline cache still opens them), and recover when it's back
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const PORT = H.PORT;
const start = () => spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let srv = start();
  await sleep(800);
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('gn-voice', 'off'); });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  // visit the pages once so the offline cache has them
  await page.goto(`http://localhost:${PORT}/casino.html`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.goto(`http://localhost:${PORT}/roulette.html`);
  await sleep(1200);
  console.log('server running → bar hidden:', await page.isHidden('#serverDown'));
  await page.click('#openTableBtn');                         // a game in progress
  // the server stops mid-game
  srv.kill(); await sleep(300);
  await page.waitForSelector('#serverDown:not([hidden])', { timeout: 9000 });
  console.log('server stopped → bar:', (await page.textContent('#serverDown')).replace(/\s+/g, ' ').trim());
  await page.screenshot({ path: 'shots/server-down.png' });
  // …and comes back: the bar goes away by itself and the game is still there
  srv = start();
  await page.waitForSelector('#serverDown', { state: 'hidden', timeout: 9000 });
  console.log('server back → bar hidden again:', await page.isHidden('#serverDown'), '| game still running:', await page.evaluate(() => !!S));
  // opened from the offline copy while the server is off
  srv.kill(); await sleep(300);
  const lobby = await ctx.newPage(); lobby.on('pageerror', e => errs.push(e.message));
  await lobby.goto(`http://localhost:${PORT}/casino.html`);
  console.log('server off, lobby opened from the offline copy → title:', await lobby.title(), '| bar shown:', await lobby.waitForSelector('#serverDown:not([hidden])', { timeout: 9000 }).then(() => true));
  const game = await ctx.newPage(); game.on('pageerror', e => errs.push(e.message));
  await game.goto(`http://localhost:${PORT}/roulette.html`);
  await game.waitForSelector('#serverDown:not([hidden])', { timeout: 9000 });
  srv = start();
  const reloaded = lobby.waitForEvent('load', { timeout: 12000 }).then(() => true);
  await game.waitForSelector('#serverDown.back', { timeout: 12000 });
  console.log('server started → lobby reloaded by itself:', await reloaded, '| game page offers:', (await game.textContent('#serverDown')).replace(/\s+/g, ' ').trim());
  await game.screenshot({ path: 'shots/server-back.png' });
  await sleep(1500);
  console.log('after the reload the lobby works again: bar hidden:', await lobby.isHidden('#serverDown'), '| QR shown:', await lobby.isVisible('#qrImg'));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
