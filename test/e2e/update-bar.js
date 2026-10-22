const H = require('./helpers');
const { chromium } = require('playwright-core');
const { spawn, execSync } = require('child_process');
const PORT = H.PORT;
const startServer = () => spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
(async () => {
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  const mc = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await mc.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('gn-voice', 'off'); });
  const mac = await mc.newPage(); mac.on('pageerror', e => errs.push('mac: ' + e.message));
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await pc.addInitScript(() => { speechSynthesis.speak = () => {}; });
  const phone = await pc.newPage(); phone.on('pageerror', e => errs.push('phone: ' + e.message));
  await mac.goto(`http://localhost:${PORT}/roulette.html`); await mac.selectOption('#timeLimit', 'custom'); await mac.fill('#customTime', '60'); await mac.click('#openTableBtn');
  await mac.waitForFunction(() => sharing());
  await phone.goto(`http://${H.PHONE_HOST}:${PORT}/remote.html`); await phone.waitForSelector('#tableView:not([hidden])');
  await phone.fill('#nameIn', 'Ana'); await phone.tap('#addForm button[type=submit]'); await phone.waitForSelector('.tab[data-i]');
  await phone.waitForTimeout(800);
  console.log('current table → phone warning shown:', await phone.isVisible('#staleTable'));
  // an out-of-date table (no Recent Numbers in its state) → phone warns
  await phone.evaluate(() => { ST = { ...ST }; delete ST.recent; checkTableVersion(); });
  console.log('out-of-date table → phone warning:', await phone.isVisible('#staleTable'), '|', (await phone.textContent('#staleTable')).slice(0, 60) + '…');

  // game files change → phone reloads itself, Mac offers a reload
  await phone.evaluate(() => { window.__marker = 1; });
  execSync(`touch "${H.ROOT}/public/remote.html"`);
  await phone.waitForFunction(() => !window.__marker, null, { timeout: 25000 }).catch(() => {});
  await phone.waitForSelector('.tab[data-i]', { timeout: 10000 });
  console.log('after an update → phone reloaded itself:', await phone.evaluate(() => !window.__marker), '| still has its player:', (await phone.textContent('#tabs')).replace(/\s+/g, ' ').trim());
  await mac.waitForSelector('#updateBar:not([hidden])', { timeout: 20000 });
  console.log('Mac shows:', (await mac.textContent('#updateBar')).trim(), '| Mac game kept (no auto reload):', await mac.evaluate(() => S.players.length));

  // server restarts mid-game → Mac re-shares (as a new table: the old one died with the server), phone follows with its player
  const oldCode = await mac.evaluate(() => NET.code);
  execSync(`kill $(lsof -nP -t -iTCP:${PORT} -sTCP:LISTEN)`);
  await mac.waitForTimeout(1500);
  const srv = startServer();
  // if a wait times out, say what the Mac and the phone were doing
  const stateNow = async () => `Mac: sharing=${await mac.evaluate(() => sharing()).catch(e => e.message)} code=${await mac.evaluate(() => NET.code).catch(() => '?')}`
    + ` es=${await mac.evaluate(() => NET.es && NET.es.readyState).catch(() => '?')} | phone: "${(await phone.textContent('#where').catch(() => '?')).trim()}"`
    + ` | server tables: ${await mac.evaluate(() => fetch('/api/tables').then(r => r.json()).then(j => j.tables.map(t => t.code).join(',')).catch(e => 'down')).catch(() => '?')}`;
  const t0 = Date.now();
  await mac.waitForFunction(old => sharing() && NET.code && NET.code !== old, oldCode, { timeout: 20000 })
    .catch(async e => { throw new Error(`Mac didn't re-share (old table ${oldCode}): ${await stateNow()}`); });
  console.log(`   (Mac re-shared after ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  await mac.waitForTimeout(500);
  const newCode = await mac.evaluate(() => NET.code);
  // connected to the new table (not "reconnecting…" to the old one)
  await phone.waitForFunction(c => { const w = document.querySelector('#where').textContent; return w.includes(c) && !/reconnecting/.test(w); }, newCode, { timeout: 20000 })
    .catch(async e => { throw new Error(`phone didn't follow to ${newCode}: ${await stateNow()}`); });
  await phone.waitForSelector('.tab[data-i]', { timeout: 10000 });
  console.log(`server restarted → Mac re-shared as ${newCode} (was ${oldCode}), phone followed with:`, (await phone.textContent('#tabs')).replace(/\s+/g, ' ').trim());
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
