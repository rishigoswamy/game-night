const H = require('./helpers');
const { chromium } = require('playwright-core');
const PORT = 8091;   // test server (DC_LOOPBACK_ONLY=1): localhost = the Mac/master, the Wi-Fi address = a phone
(async () => {
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  const quiet = async ctx => ctx.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('rd-voice', 'off'); });
  const watch = (pg, who) => { pg.on('pageerror', e => errs.push(who + ': ' + e.message)); return pg; };
  const mc = await b.newContext({ viewport: { width: 1280, height: 900 } }); await quiet(mc);
  const mac = watch(await mc.newPage(), 'mac');
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await quiet(pc);
  const phone = watch(await pc.newPage(), 'phone');
  const PH = `http://${H.PHONE_HOST}:${PORT}`;

  // Phone: lobby and roulette both lead to joining the master table; it can't host
  await phone.goto(PH + '/casino.html'); await phone.waitForTimeout(500);
  console.log('phone lobby card:', await phone.textContent('#rouletteCard .play'), '→', await phone.getAttribute('#rouletteCard', 'href'));
  await phone.goto(PH + '/roulette.html'); await phone.waitForURL(/remote\.html/, { timeout: 5000 });
  console.log('phone opening roulette.html → redirected to', new URL(phone.url()).pathname, '|', (await phone.textContent('#joinView h2')).trim());
  const hostTry = await phone.evaluate(() => fetch('/api/host', { method: 'POST', body: '{}' }).then(r => r.status));
  console.log('phone trying to host a table →', hostTry, '(403 = refused)');

  // Mac: Turns style → not shared; phone keeps waiting
  await mac.goto(`http://localhost:${PORT}/roulette.html`);
  await mac.selectOption('#tableMode', 'turns'); await mac.selectOption('#timeLimit', '0');
  await mac.click('#setupForm button[type=submit]'); await mac.waitForTimeout(1500);
  console.log('mac in Turns style → shared:', await mac.evaluate(() => sharing()), '| phone still waiting:', await phone.isVisible('#joinView'));
  await mac.click('#quitBtn'); await mac.click('#exitYes');

  // Mac: Casino open table → shared automatically, no button needed
  await mac.selectOption('#tableMode', 'casino'); await mac.selectOption('#timeLimit', 'custom'); await mac.fill('#customTime', '10');
  await mac.click('#openTableBtn');
  await mac.waitForFunction(() => sharing(), null, { timeout: 5000 });
  console.log('mac casino table → shared automatically:', await mac.evaluate(() => sharing()), '| share window popped up:', await mac.isVisible('#shareModal'), '| toast:', await mac.textContent('#toast'));
  console.log('mac header chip:', await mac.textContent('#shareBtn'));

  // Phone joins by itself, adds a player, bets
  await phone.waitForSelector('#tableView:not([hidden])', { timeout: 8000 });
  await phone.fill('#nameIn', 'Ana'); await phone.tap('#addForm button[type=submit]'); await phone.waitForSelector('.tab[data-i]');
  await phone.tap('.chip[data-v="25"]'); await phone.tap('.cell[data-key="red"]');
  await mac.waitForTimeout(500);
  console.log('mac chip:', await mac.textContent('#shareBtn'), '| bets at master:', await mac.evaluate(() => S.bets.map(b => `${S.players[b.p].name}:${b.key}`).join(', ')));
  await mac.click('#shareBtn');
  console.log('mac 📱 window shows the address:', (await mac.textContent('#shareUrls')).trim(), '| phones:', (await mac.textContent('#sharePhones')).replace(/\s+/g, ' ').trim());
  await mac.click('#shareClose');
  await mac.waitForFunction(() => S.phase === 'spinning', null, { timeout: 15000 });
  await phone.waitForSelector('.banner', { timeout: 20000 });
  console.log('spun by the timer; phone result:', (await phone.textContent('.banner')).replace(/\s+/g, ' ').trim());
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
