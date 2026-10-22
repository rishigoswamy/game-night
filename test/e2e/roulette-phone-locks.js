const H = require('./helpers');
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  const quiet = async ctx => ctx.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('rd-voice', 'off'); });
  const watch = (pg, who) => { pg.on('pageerror', e => errs.push(who + ': ' + e.message)); return pg; };
  const hc = await b.newContext({ viewport: { width: 1280, height: 900 } }); await quiet(hc);
  const host = watch(await hc.newPage(), 'table');
  const pa = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await quiet(pa);
  const pb = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await quiet(pb);
  const A = watch(await pa.newPage(), 'phone A'), B = watch(await pb.newPage(), 'phone B');

  // Table with NO time limit, then share → a timer must be switched on
  await host.goto(`http://localhost:${H.PORT}/roulette.html`);
  await host.selectOption('#timeLimit', '0');
  await host.click('#openTableBtn');
  await host.waitForFunction(() => sharing(), null, { timeout: 5000 });
  const code = await host.evaluate(() => NET.code);
  console.log('master shared automatically; timer running:', await host.isVisible('#timer'));
  console.log('spin button while shared:', await host.isVisible('#mainBtn') ? 'VISIBLE (bad)' : 'hidden');

  // Phones join
  for (const [P, name] of [[A, 'Ana'], [B, 'Ben']]) {
    await P.goto(`http://${H.PHONE_HOST}:${H.PORT}/remote.html`);
    await P.waitForSelector('#addForm:not([hidden])');
    await P.fill('#nameIn', name); await P.tap('#addForm button[type=submit]');
    await P.waitForSelector('.tab[data-i]');
  }
  await host.click('#order .pill.add'); await host.fill('#newName', 'Mod'); await host.click('#addForm button[type=submit]');
  await host.waitForTimeout(400);

  // 1. The table screen can't pick or bet for phone players
  console.log('strip: selectable pills =', await host.$$eval('#order button.pill:not(.add)', e => e.map(x => x.textContent.trim()).join(', ')), '| phone pills not selectable =', await host.$$eval('#order span.pill', e => e.map(x => x.textContent.trim()).join(', ')));
  console.log('table betting as:', await host.textContent('#curCard .nm'));
  const r1 = await host.evaluate(() => place('red', 25, 0));          // table tries Ana's player directly
  console.log('table placing a bet for Ana →', r1);
  const r2 = await host.evaluate(() => { const i = S.players.findIndex(p => p.name === 'Ana'); return lockedToPhone(i); });
  console.log('Ana locked to her phone:', r2);

  // 2. Phone B can't act for phone A's player: via its own key, or by pretending to be phone A
  await B.evaluate(() => post({ type: 'bet', player: 0, key: 'odd', amt: 5 }));
  await B.waitForTimeout(400); console.log('phone B bets for Ana →', await B.textContent('#toast'));
  const devA = await A.evaluate(() => DEVICE);
  const spoof = await B.evaluate(async devA => {
    const withMyKey = await fetch('/api/send', { method: 'POST', body: JSON.stringify({ t: code, from: devA, token, msg: { type: 'bet', player: 0, key: 'odd', amt: 5 } }) });
    const noKey = await fetch('/api/send', { method: 'POST', body: JSON.stringify({ t: code, from: devA, msg: { type: 'bet', player: 0, key: 'odd', amt: 5 } }) });
    const fakeTable = await fetch('/api/send', { method: 'POST', body: JSON.stringify({ t: code, from: 'host', msg: { type: 'closed' } }) });
    const closeIt = await fetch('/api/close', { method: 'POST', body: JSON.stringify({ code }) });
    return [withMyKey.status, noKey.status, fakeTable.status, closeIt.status];
  }, devA);
  console.log('phone B pretending to be phone A (its key / no key), posing as the table, closing the table →', spoof.join(' / '), '(403 = refused)');
  console.log('bets at table:', await host.evaluate(() => S.bets.map(b => `${S.players[b.p].name}:${b.key}`).join(', ') || '(none)'));

  // Legit bets
  await A.tap('.chip[data-v="25"]'); await A.tap('.cell[data-key="red"]');
  await B.tap('.chip[data-v="10"]'); await B.tap('.cell[data-key="black"]');
  await host.click('.chip[data-v="5"]'); await host.click('.cell[data-key="odd"]');
  await host.waitForTimeout(400);
  console.log('legit bets:', await host.evaluate(() => S.bets.map(b => `${S.players[b.p].name}:${b.key}`).join(', ')));

  // 3. No early spin: Space and mainAction do nothing; the timer spins at 30 s
  await host.keyboard.press(' '); await host.evaluate(() => mainAction()); await host.waitForTimeout(300);
  console.log('after Space / mainAction → phase:', await host.evaluate(() => S.phase));
  const t0 = Date.now();
  await host.waitForFunction(() => S.phase === 'spinning', null, { timeout: 40000 });
  console.log(`spun by the timer after ${((Date.now() - t0) / 1000).toFixed(0)}s more`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
