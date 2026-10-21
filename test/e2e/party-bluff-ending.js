const H = require('./helpers');
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('bluff', ['Ana', 'Bob', 'Cy']);
  const { mac, phones, errs } = T;
  await mac.selectOption('#opt-window', '5');
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  // test only: the player to start holds one true card; play it, then a truthful last card called as a bluff
  const who = await mac.evaluate(() => { const st = P.ctx.state; st.hands[st.turn] = [{ r: 'A', s: '♠' }, { r: '2', s: '♥' }]; P.ctx.update(); return st.turn; });
  const p = phones[who].p;
  await p.waitForSelector('#view [data-local="card"]');
  await p.click('#view [data-id="A|♠"]'); await p.click('#view [data-act="play"]');
  await mac.waitForFunction(() => P.ctx.state.phase === 'play' && P.ctx.state.rank === 1, null, { timeout: 15000 });
  console.log('no call in time → play moves on; rank is now', await mac.evaluate(() => PartyKit.RANKS[P.ctx.state.rank]));
  // everyone else passes until it's back to `who`… simpler: give the turn back for this check
  await mac.evaluate(w => { P.ctx.state.turn = w; P.ctx.update(); }, who);
  await p.waitForSelector('#view [data-id="2|♥"]');
  await p.click('#view [data-id="2|♥"]'); await p.click('#view [data-act="play"]');
  const caller = phones[(who + 1) % 3].p;
  await caller.waitForSelector('#view [data-act="bluff"]'); await caller.click('#view [data-act="bluff"]');
  await mac.waitForSelector('#endModal:not([hidden])', { timeout: 20000 });
  console.log('truthful last card survives the call →', await mac.textContent('#endTitle'), '|', (await mac.textContent('#endBody')).replace(/\s+/g, ' ').trim());
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
