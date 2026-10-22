const H = require('./helpers');
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  const quiet = async ctx => ctx.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('rd-voice', 'off'); });
  const watch = (pg, who) => { pg.on('pageerror', e => errs.push(who + ': ' + e.message)); return pg; };
  const hostCtx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await quiet(hostCtx);
  const host = watch(await hostCtx.newPage(), 'table');
  const phoneA = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await quiet(phoneA);
  const phoneB = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await quiet(phoneB);
  const A = watch(await phoneA.newPage(), 'phone A'), B = watch(await phoneB.newPage(), 'phone B');
  const st = () => host.evaluate(() => S.players.map((p, i) => `${i}:${p.name}${p.owner ? '📱' : ''}$${p.bal}${p.cashedOut ? '(out)' : ''}`).join(' '));

  // Table: open table, 20 s betting window, share
  await host.goto(`http://localhost:${H.PORT}/roulette.html`);
  await host.selectOption('#timeLimit', 'custom'); await host.fill('#customTime', '20');
  await host.click('#openTableBtn');
  await host.waitForFunction(() => sharing(), null, { timeout: 5000 });
  console.log('master shared automatically | phones open:', await host.evaluate(() => phoneAddress()));

  // Phone A: picks the table from the list, adds two players
  await A.goto(`http://${H.PHONE_HOST}:${H.PORT}/remote.html`);      // joins the one shared table by itself
  await A.waitForSelector('#addForm:not([hidden])');
  await A.fill('#nameIn', 'Ana'); await A.tap('#addForm button[type=submit]');
  await A.waitForSelector('.tab[data-i]');
  await A.tap('#addTab'); await A.fill('#nameIn', 'Bob'); await A.tap('#addForm button[type=submit]');
  await A.waitForFunction(() => document.querySelectorAll('.tab[data-i]').length === 2);
  // Phone B: types the code, adds one player
  await B.goto(`http://${H.PHONE_HOST}:${H.PORT}/remote.html`);
  await B.waitForSelector('#addForm:not([hidden])');
  await B.fill('#nameIn', 'Cy'); await B.tap('#addForm button[type=submit]');
  await B.waitForSelector('.tab[data-i]');
  // The table adds its own player too (moderator)
  await host.click('#order .pill.add'); await host.fill('#newName', 'Host'); await host.click('#addForm button[type=submit]');
  await host.waitForTimeout(400);
  console.log('table players:', await st());
  console.log('table strip:', (await host.textContent('#order')).replace(/\s+/g, ' ').trim());

  // Bets from phones
  await A.tap('.tab[data-i="0"]'); await A.tap('.chip[data-v="25"]'); await A.tap('.cell[data-key="red"]');
  await A.tap('.tab[data-i="1"]'); await A.tap('.chip[data-v="10"]'); await A.tap('.cell[data-key="n17"]');
  await B.tap('.chip[data-v="50"]'); await B.tap('.cell[data-key="black"]');
  await host.waitForTimeout(500);
  console.log('bets at the table:', await host.evaluate(() => S.bets.map(b => `${S.players[b.p].name}:${b.key}:$${b.amt}`).join(', ')));
  console.log('phone B sees everyone\'s chips on Red/Black/17:', await B.$$eval('.cell[data-key="red"] .chip-mini, .cell[data-key="black"] .chip-mini, .cell[data-key="n17"] .chip-mini', e => e.length));
  // Phone B tries to bet for phone A's player → refused
  await B.evaluate(() => post({ type: 'bet', player: 0, key: 'odd', amt: 5 }));
  await B.waitForTimeout(400);
  console.log('phone B betting for Ana →', await B.textContent('#toast'));
  // Undo on phone A (Bob)
  await A.tap('#undoBtn'); await A.waitForTimeout(300);
  console.log('after Bob undo:', await host.evaluate(() => S.bets.map(b => `${S.players[b.p].name}:${b.key}`).join(', ')));
  await A.tap('.cell[data-key="n17"]');
  await host.waitForTimeout(300);
  await A.screenshot({ path: 'shots/phone-a.png' });
  await host.screenshot({ path: 'shots/table-shared.png' });

  // The table spins (forced 17 for the test); phones get results
  await host.evaluate(() => { randInt = () => 17; });
  console.log('spin button on shared table:', await host.isVisible('#mainBtn') ? 'VISIBLE' : 'hidden');
  await host.waitForFunction(() => S.phase === 'spinning', null, { timeout: 30000 });   // only the window timer spins
  await A.waitForSelector('.banner', { timeout: 20000 });
  console.log('phone A result banner:', (await A.textContent('.banner')).replace(/\s+/g, ' ').trim());
  // Phone B joins a 2nd player during the payout → queued, seated when bets reopen
  await B.tap('#addTab'); await B.fill('#nameIn', 'Dee'); await B.tap('#addForm button[type=submit]');
  await B.waitForTimeout(300);
  console.log('phone B joining mid-round →', await B.textContent('#toast'));
  await host.waitForSelector('#roundModal:not([hidden])', { timeout: 40000 });
  console.log('round result at table:', (await host.textContent('#rmRows')).replace(/\s+/g, ' ').trim());
  await host.click('#rmBtn');
  await B.waitForFunction(() => document.querySelectorAll('.tab[data-i]').length === 2, null, { timeout: 8000 });
  console.log('Dee seated on phone B:', (await B.textContent('#tabs')).replace(/\s+/g, ' ').trim());

  // Phone B cashes out Cy (two taps)
  await B.tap('.tab[data-i="2"]'); await B.tap('#cashBtn'); await B.tap('#cashBtn');
  await host.waitForTimeout(500);
  console.log('after Cy cashed out:', await st());

  // Phone A drops off and comes back → keeps its players
  await A.close(); await host.waitForTimeout(800);
  console.log('table strip with phone A away:', (await host.textContent('#order')).replace(/\s+/g, ' ').trim(), '| away pills:', await host.$$eval('#order .pill.away', e => e.length));
  const A2 = watch(await phoneA.newPage(), 'phone A again');
  await A2.goto(`http://${H.PHONE_HOST}:${H.PORT}/remote.html`);            // back to the one table
  await A2.waitForFunction(() => document.querySelectorAll('.tab[data-i]').length === 2, null, { timeout: 8000 });
  console.log('phone A back → its players:', (await A2.textContent('#tabs')).replace(/\s+/g, ' ').trim());

  // Moderator: the table can still bet for a phone's player
  console.log('Ana selectable on the table screen:', !!(await host.$('#order button.pill:has-text("Ana")')), '| table tries to bet for Ana →', await host.evaluate(() => place('odd', 5, S.players.findIndex(p => p.name === 'Ana'))));

  // Stop sharing → phones told the table closed
  await host.click('#quitBtn'); await host.click('#exitYes');                  // leaving the game ends the shared table
  await A2.waitForSelector('#joinView:not([hidden])', { timeout: 8000 });
  console.log('master left the game → phone back to waiting:', await A2.isVisible('#joinView'));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
