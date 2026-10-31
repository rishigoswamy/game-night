// Bluff on the phones: the leader names a rank, the others pass (the pile is set aside), a lie is caught (the liar's
// picked-up cards glow, the caller leads), and a truthful last card survives a call and wins
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('bluff', ['Ana', 'Bob', 'Cy']);
  const { mac, phones, errs } = T;
  const bad = (ok, what) => { if (!ok) console.log('BAD', what); };
  await mac.selectOption('#opt-window', '5');
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  // test only: the leader holds three known cards
  const a = await mac.evaluate(() => { const st = P.ctx.state; st.hands[st.turn] = [{ r: 'A', s: '♠' }, { r: '7', s: '♥' }, { r: '2', s: '♥' }]; P.ctx.update(); return st.turn; });
  const [b, c] = [(a + 1) % 3, (a + 2) % 3], A = phones[a].p, B = phones[b].p, C = phones[c].p;
  // 1. Ana leads: picks Aces, plays her Ace
  await A.waitForSelector('#view [data-local="rank"]');
  await A.tap('#view [data-local="rank"][data-rank="A"]'); await A.tap('#view [data-id="A|♠"]');
  bad(/as one Ace/.test(await A.textContent('#view [data-act="play"]')), 'the play button says "one Ace"');
  await A.screenshot({ path: 'shots/bluff-phone-lead.png', fullPage: true });
  await A.tap('#view [data-act="play"]');
  await mac.waitForFunction(() => P.ctx.state.phase === 'challenge');
  const claim = (await mac.textContent('#stage .big-line')).replace(/\s+/g, ' ').trim();
  console.log('Mac shows:', claim);
  await mac.screenshot({ path: 'shots/bluff-mac-claim.png' });
  await B.screenshot({ path: 'shots/bluff-phone-claim.png', fullPage: true });
  bad(/says 1×A ?one Ace/.test(claim), 'the claim reads as 1 × A, "one Ace"');
  // 2. nobody calls; the other two pass → the pile is set aside and Ana leads again
  await B.waitForSelector('#view [data-act="pass"]', { timeout: 15000 });
  await B.tap('#view [data-act="pass"]');
  await C.waitForSelector('#view [data-act="pass"]');
  await C.tap('#view [data-act="pass"]');
  await mac.waitForFunction(() => P.ctx.state.cleared === 1 && P.ctx.state.round.rank === null);
  bad(await mac.evaluate(() => P.ctx.state.turn) === a, 'everyone passed: Ana leads a new round');
  console.log('everyone passed: pile set aside →', await mac.evaluate(() => PARTY_GAME.status(P.ctx)));
  // 3. Ana lies (a 7 as a King); Bob calls it; Ana takes the pile, her new cards glow, Bob leads
  await A.waitForSelector('#view [data-local="rank"]');
  await A.tap('#view [data-local="rank"][data-rank="K"]'); await A.tap('#view [data-id="7|♥"]'); await A.tap('#view [data-act="play"]');
  await B.waitForSelector('#view [data-act="bluff"]'); await B.tap('#view [data-act="bluff"]');
  await A.waitForSelector('#view .pcard.fresh', { timeout: 10000 });
  console.log('Ana picked up', await A.$$eval('#view .pcard.fresh', x => x.length), 'card(s), glowing');
  await mac.waitForFunction(() => P.ctx.state.phase === 'play', null, { timeout: 10000 });
  bad(await mac.evaluate(() => P.ctx.state.turn) === b, 'the caller was right: Bob leads');
  await A.waitForTimeout(3200);
  bad(await A.evaluate(() => [...document.querySelectorAll('#view .pcard.fresh')].every(e => e.getAnimations().every(x => x.playState === 'finished'))), 'the glow is over after 3 seconds');
  // 4. Bob's last card, truthful, called by Cy: Bob still wins
  await mac.evaluate(b => { P.ctx.state.hands[b] = [{ r: 'Q', s: '♣' }]; P.ctx.update(); }, b);
  await B.waitForSelector('#view [data-id="Q|♣"]');
  await B.tap('#view [data-local="rank"][data-rank="Q"]'); await B.tap('#view [data-id="Q|♣"]'); await B.tap('#view [data-act="play"]');
  await C.waitForSelector('#view [data-act="bluff"]'); await C.tap('#view [data-act="bluff"]');
  await mac.waitForSelector('#endModal:not([hidden])', { timeout: 20000 });
  console.log('truthful last card survives the call →', (await mac.textContent('#endTitle')).trim());
  bad((await mac.textContent('#endTitle')).includes(phones[b].name), 'Bob wins');
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
