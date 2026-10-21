const H = require('./helpers');
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const PORT = 8091, P = { polling: 250 };
(async () => {
  const srv = spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  const mc = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await mc.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('gn-voice', 'off'); });
  const mac = await mc.newPage(); mac.on('pageerror', e => errs.push('mac: ' + e.message));
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await pc.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('gn-phone-voice', 'off'); });
  const phone = await pc.newPage(); phone.on('pageerror', e => errs.push('phone: ' + e.message));

  // Mac lobby shows the new games and the leaderboard
  await mac.goto(`http://localhost:${PORT}/casino.html`);
  console.log('Mac lobby cards:', (await mac.$$eval('a.game h2', h => h.map(x => x.textContent))).join(', '), '| leaderboard:', await mac.isVisible('#leaderboard'));
  await mac.click('a.game[href="table.html?g=sicbo"]');
  await mac.selectOption('#timeLimit', 'custom'); await mac.fill('#customTime', '10');
  await mac.click('#openTableBtn');
  await mac.waitForFunction(() => sharing(), null, P);
  // Phone: lobby card → join page → routed to the Sic Bo phone page
  await phone.goto(`http://${H.PHONE_HOST}:${PORT}/casino.html`);
  console.log('phone lobby Sic Bo card →', await phone.getAttribute('a.game:has(h2:text("Sic Bo"))', 'href'));
  await phone.click('a.game:has(h2:text("Sic Bo"))');
  await phone.waitForURL(/table-remote\.html\?g=sicbo/, { timeout: 8000 });
  await phone.waitForSelector('#tableView:not([hidden])');
  await phone.waitForFunction(() => /Welcome/.test(document.querySelector('#bubble').textContent), null, { timeout: 5000 });
  console.log('phone routed to', new URL(phone.url()).pathname + new URL(phone.url()).search, '| greeting:', await phone.textContent('#bubble'));
  await phone.fill('#nameIn', 'Ana'); await phone.tap('#addForm button[type=submit]'); await phone.waitForSelector('.tab[data-i]');
  await phone.tap('.chip[data-v="100"]'); await phone.tap('.b-cell[data-key="big"]'); await phone.tap('.b-cell[data-key="small"]');
  await mac.waitForTimeout(500);
  console.log('Ana bets seen on Mac:', await mac.evaluate(() => S.bets.map(b => `${S.players[b.p].name}:${b.key}:${b.amt}`).join(' ')),
    '| Mac can select Ana:', !!(await mac.$('#order button.pill:has-text("Ana")')), '| Mac placing for Ana →', await mac.evaluate(() => place('odd', 5, 0)));
  await phone.screenshot({ path: 'shots/tg-phone-bet.png', fullPage: true });
  // the round plays out; phone sees the dice and the result
  await mac.waitForFunction(() => S.phase === 'result', null, { ...P, timeout: 30000 });
  await phone.waitForSelector('.banner', { timeout: 10000 });
  console.log('phone result banner:', (await phone.textContent('.banner')).replace(/\s+/g, ' ').trim(), '| phone stage:', (await phone.textContent('#stage')).replace(/\s+/g, ' ').trim());
  await mac.waitForFunction(() => S.round === 2 && S.phase === 'bet', null, { ...P, timeout: 30000 });
  await phone.waitForTimeout(600);
  console.log('round 2 | phone win/loss:', (await phone.textContent('#wlCard')).replace(/\s+/g, ' ').trim(), '| phone recent:', (await phone.textContent('#beads')).trim());
  await phone.tap('#cashBtn'); await phone.tap('#cashBtn'); await mac.waitForTimeout(800);
  console.log('Ana cashed out →', await mac.evaluate(() => S.players.map(p => `${p.name}:$${p.bal}${p.cashedOut ? '(out)' : ''}`).join(' ')));
  console.log('Mac leaderboard:', (await mac.textContent('#leaderboard tbody').catch(() => '(empty)')).replace(/\s+/g, ' ').trim());
  // routing between games: Mac switches to roulette → phone follows
  await mac.goto(`http://localhost:${PORT}/roulette.html`);
  await mac.click('#openTableBtn');
  await phone.waitForURL(/\/remote\.html/, { timeout: 15000 });
  console.log('Mac switched to Roulette → phone moved to', new URL(phone.url()).pathname);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
