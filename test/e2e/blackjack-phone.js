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
  const st = () => mac.evaluate(() => S.players.map(p => `${p.name}${p.owner ? '📱' : ''}:$${p.bal}${p.cashedOut ? '(out)' : ''}`).join(' '));

  await mac.goto(`http://localhost:${PORT}/blackjack.html`);
  await mac.selectOption('#timeLimit', 'custom'); await mac.fill('#customTime', '10');
  await mac.click('#openTableBtn');
  await mac.waitForFunction(() => sharing(), null, P);
  await mac.click('#order .pill.add'); await mac.fill('#newName', 'Mod'); await mac.click('#addForm button[type=submit]');
  await phone.goto(`http://${H.PHONE_HOST}:${PORT}/remote.html`);
  await phone.waitForURL(/bj-remote/); await phone.waitForSelector('#tableView:not([hidden])');
  await phone.fill('#nameIn', 'Ana'); await phone.tap('#addForm button[type=submit]'); await phone.waitForSelector('.tab[data-i]');
  await phone.tap('.chip >> text=25'); await mac.click('.chip[data-v="50"]');
  // rig the shoe (test only): Mod 10,7 · Ana 8,8 · dealer 9 + 7 · then 3, 2 for Ana's split, 10 for the dealer
  await mac.evaluate(() => {
    const c = r => ({ r, s: '♠' });
    const seq = [c('10'), c('8'), c('9'), c('7'), c('8'), c('7'), c('3'), c('2'), c('10'), c('K')];
    S.shoe = [...Array(150)].map(() => c('4')).concat(seq.reverse());
  });
  console.log('bets placed:', await mac.evaluate(() => S.players.map((p, i) => `${p.name}:${betTotal(i)}`).join(', ')));

  // Mod (Mac) plays first: 17 → Double is dimmed with a reason; stand
  await mac.waitForFunction(() => S.phase === 'play' && S.turn && !S.busy, null, { ...P, timeout: 30000 });
  console.log(`Mac turn (${await mac.evaluate(() => S.players[S.turn.p].name)}): double ${await mac.isEnabled('#doubleBtn') ? 'on' : 'dimmed'}, split ${await mac.isEnabled('#splitBtn') ? 'on' : 'dimmed'} | hint: "${await mac.textContent('#actHint')}"`);
  await mac.click('#standBtn');
  // Ana (phone) has 8,8 → Split is available on the phone
  await phone.waitForSelector('#acts:not([hidden]) #splitBtn:not([disabled])', { timeout: 10000 });
  await phone.screenshot({ path: 'shots/bj-phone-turn.png', fullPage: true }); await mac.screenshot({ path: 'shots/bj-mac-shared.png' });
  console.log('phone turn: buttons', await phone.$$eval('#acts button', bs => bs.map(x => `${x.textContent}${x.disabled ? '(dimmed)' : ''}`).join(' ')), '| hint:', JSON.stringify(await phone.textContent('#actHint')));
  await phone.tap('#splitBtn');
  await mac.waitForFunction(() => S.hands[S.players.findIndex(p => p.name === 'Ana')].length === 2 && !S.busy, null, { ...P, timeout: 10000 });
  console.log('after split on phone:', await mac.evaluate(() => S.hands[S.players.findIndex(p => p.name === 'Ana')].map(h => h.cards.map(c => c.r).join('+')).join(' | ')));
  for (let n = 0; n < 200 && !(await mac.isVisible('#roundModal')); n++) {
    if (await phone.isVisible('#acts:not([hidden]) #standBtn:not([disabled])')) await phone.tap('#standBtn');
    await mac.waitForTimeout(250);
  }
  console.log('result:', (await mac.textContent('#rmRows')).replace(/\s+/g, ' ').trim());
  await mac.waitForFunction(() => S.round === 2 && S.phase === 'bet', null, { ...P, timeout: 15000 });
  await phone.waitForTimeout(600);
  console.log('round 2 started by itself | phone win/loss:', (await phone.textContent('#wlCard')).replace(/\s+/g, ' ').trim());
  await phone.tap('#cashBtn'); await phone.tap('#cashBtn'); await mac.waitForTimeout(600);
  console.log('Ana cashed out from phone →', await st());
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
