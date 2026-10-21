const H = require('./helpers');
const { chromium } = require('playwright-core');
const PORT = 8091;   // separate test server
(async () => {
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  // speech is stubbed everywhere: nothing reaches the Mac's speakers
  const quiet = async (ctx, voice) => ctx.addInitScript(v => { speechSynthesis.speak = () => {}; localStorage.setItem('rd-voice', 'off'); localStorage.setItem('dc-phone-voice', v); }, voice);
  const watch = (pg, who) => { pg.on('pageerror', e => errs.push(who + ': ' + e.message)); return pg; };
  const mc = await b.newContext({ viewport: { width: 1280, height: 900 } }); await quiet(mc, 'off');
  const mac = watch(await mc.newPage(), 'mac');
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await quiet(pc, 'off');
  const phone = watch(await pc.newPage(), 'phone');

  await mac.goto(`http://localhost:${PORT}/roulette.html`);
  await mac.selectOption('#timeLimit', 'custom'); await mac.fill('#customTime', '8');
  await mac.click('#openTableBtn');
  await mac.waitForFunction(() => sharing());
  await phone.goto(`http://${H.PHONE_HOST}:${PORT}/casino.html`);
  await phone.tap('#rouletteCard');
  await phone.waitForSelector('#tableView:not([hidden])', { timeout: 8000 });
  await phone.fill('#nameIn', 'Ana'); await phone.tap('#addForm button[type=submit]'); await phone.waitForSelector('.tab[data-i]');

  // what the phone shows
  console.log('phone has: wheel', await phone.isVisible('#wheel'), '| dealer', await phone.isVisible('#dealer'), '| voice button:', await phone.textContent('#voiceBtn'),
    '| rules button', await phone.isVisible('#rulesBtn'), '| payout rows', await phone.$$eval('#payoutRows tr', e => e.length), '| recent', await phone.isVisible('#spinChart'), '| win/loss', await phone.isVisible('#wlCard'));
  console.log('dealer bubble — mac:', JSON.stringify(await mac.textContent('#bubble')), '| phone:', JSON.stringify(await phone.textContent('#bubble')));
  await phone.tap('#rulesBtn'); console.log('rules window opens on phone:', await phone.isVisible('#rules')); await phone.tap('#rulesClose');
  await phone.tap('#exToggle').catch(() => {}); await phone.click('.switch'); console.log('example-bet columns shown:', await phone.isVisible('#payoutRows .ex'));

  // phone voice on (speech stubbed + muted): crowd sounds should play with the table
  await phone.tap('#voiceBtn'); console.log('voice toggled →', await phone.textContent('#voiceBtn'));
  await phone.tap('.chip[data-v="25"]'); await phone.tap('.cell[data-key="n0"]');
  await mac.evaluate(() => { randInt = () => 0; });           // test only: land on 0 → groan on both
  await mac.waitForFunction(() => S.phase === 'spinning', null, { timeout: 15000 });
  await phone.waitForTimeout(400);
  console.log('mac spinning → phone wheel spinning:', await phone.evaluate(() => wheel.spinning), '| phone caption:', await phone.textContent('#wheelCap'));
  await phone.waitForFunction(() => !wheel.spinning, null, { timeout: 12000 });
  console.log('phone wheel landed; caption:', (await phone.textContent('#wheelCap')).trim(), '| dealer says:', await phone.textContent('#bubble'));
  await phone.waitForTimeout(4000);
  await phone.screenshot({ path: 'shots/phone-view.png', fullPage: true });
  await mac.waitForSelector('#roundModal:not([hidden])', { timeout: 40000 });
  await phone.waitForTimeout(800);
  console.log('phone recent numbers:', (await phone.textContent('#spinStats')).replace(/\s+/g, ' ').trim(), '| dots:', await phone.$$eval('#spinChart [data-tip]', e => e.length));
  console.log('phone win/loss:', (await phone.textContent('#wlCard')).replace(/\s+/g, ' ').trim(), '| bars:', await phone.$$eval('#wlCard [data-tip]', e => e.length));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
