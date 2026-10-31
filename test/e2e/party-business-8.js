// Business at its biggest: 8 phones on the Tokyo board; 8 different tokens and colours, everyone rolls for order, one turn
const { setup } = require('./party-setup');
const NAMES = ['Ana', 'Bob', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'];
(async () => {
  const T = await setup('business', NAMES, { macSize: { width: 1440, height: 1000 } });
  const { mac, phones, errs } = T;
  const bad = (ok, what) => { if (!ok) console.log('BAD', what); };
  await mac.selectOption('#opt-board', 'tokyo');
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state?.step === 'order');
  await mac.evaluate(() => { while (P.ctx.state.step === 'order') PARTY_GAME.act(P.ctx, P.ctx.state.turn, { act: 'orderRoll' }); P.ctx.update(); });
  await mac.waitForTimeout(400);
  const tokens = await mac.$$eval('.bz-main .bz-token text', t => t.map(x => x.textContent));
  const colors = await mac.evaluate(() => P.seats.map(s => s.color));
  console.log('tokens on GO:', tokens.join(' '), '| colours:', new Set(colors).size);
  bad(tokens.length === 8 && new Set(tokens).size === 8, '8 different tokens');
  bad(new Set(colors).size === 8, '8 different colours');
  const t = await mac.evaluate(() => P.ctx.state.turn);
  await phones[t].p.waitForSelector('#view [data-act="roll"]');
  await phones[t].p.tap('#view [data-act="roll"]');
  await mac.waitForFunction(() => P.ctx.state.dice);
  console.log('first roll:', await mac.evaluate(() => P.ctx.state.dice.join(' + ')), '→', await mac.evaluate(() => PARTY_GAME._test.spaceName(PARTY_GAME._test.BOARDS.tokyo, P.ctx.state.pos[P.ctx.state.turn])));
  await mac.screenshot({ path: 'shots/business-tokyo-8.png' });
  await phones[7].p.screenshot({ path: 'shots/business-phone-8.png', fullPage: true });
  await mac.click('#endBtn'); await mac.click('#confirmYes');
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
