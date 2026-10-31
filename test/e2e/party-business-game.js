// Business (Beta), a short game on 3 phones with real taps: roll for order, roll, decline into an auction that two
// phones bid on, a trade with a property and money, then a bankruptcy that ends the short game (the richest wins)
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('business', ['Ana', 'Bob', 'Cy'], { macSize: { width: 1440, height: 1000 } });
  const { mac, phones, errs } = T;
  const bad = (ok, what) => { if (!ok) console.log('BAD', what); };
  // the open table: the host shows the boards, phones vote (once per board), the host flips to Mumbai and starts from there
  await mac.click('#lobbyInfo [data-lobby="open"]');
  await phones[0].p.waitForSelector('#lobbyGame [data-lobby="vote"]');
  await phones[0].p.tap('#lobbyGame [data-board="mumbai"]'); await phones[1].p.tap('#lobbyGame [data-board="mumbai"]');
  await phones[2].p.tap('#lobbyGame [data-board="tokyo"]'); await phones[2].p.tap('#lobbyGame [data-board="tokyo"]');   // and back
  await mac.click('#lobbyInfo [data-lobby="next"]');
  await mac.waitForFunction(() => (P.lobbyState.votes?.mumbai || []).length === 2);
  bad(await mac.evaluate(() => P.opts.board) === 'mumbai' && await mac.inputValue('#opt-board') === 'mumbai', 'the host moved to the next board');
  bad(await mac.evaluate(() => (P.lobbyState.votes.tokyo || []).length) === 0, 'a second tap takes the vote back');
  bad(/👍 2/.test(await mac.textContent('#lobbyInfo .bz-strip-b.on')), 'the Mac shows the votes');
  await mac.screenshot({ path: 'shots/business-showcase.png' });
  await mac.selectOption('#opt-length', 'short');
  await mac.click('#lobbyInfo [data-lobby-start]');
  await mac.waitForFunction(() => P.ctx?.state?.step === 'order');
  const S = () => mac.evaluate(() => ({ step: P.ctx.state.step, turn: P.ctx.state.turn, cash: P.ctx.state.cash, own: P.ctx.state.own, pos: P.ctx.state.pos }));
  // 1. everyone rolls for turn order from their phone
  for (let k = 0; k < 3; k++) {
    const t = (await S()).turn;
    await phones[t].p.waitForSelector('#view [data-act="orderRoll"]');
    await phones[t].p.tap('#view [data-act="orderRoll"]');
    await mac.waitForFunction(n => P.ctx.state.order.rolls.length > n, k);
  }
  await mac.waitForFunction(() => P.ctx.state.step === 'roll');
  const a = (await S()).turn, b = (a + 1) % 3, c = (a + 2) % 3, A = phones[a].p, B = phones[b].p, C = phones[c].p;
  console.log('first player:', phones[a].name);
  // 2. the first player rolls onto a free property (test only: the place and the dice are set), and auctions it
  await mac.evaluate(() => { const st = P.ctx.state; delete st.own[39]; st.pos[st.turn] = 35; const rest = P.ctx.rand, q = [0, 2]; P.ctx.rand = n => (q.length ? q.shift() : rest(n)); P.ctx.update(); });
  await A.waitForSelector('#view [data-act="roll"]');
  await A.tap('#view [data-act="roll"]');
  await A.waitForSelector('#view [data-act="buy"]');
  bad(/Buy for ₹16 Cr/.test(await A.textContent('#view [data-act="buy"]')), 'the buy button shows Mumbai money (₹16 Cr)');
  await A.screenshot({ path: 'shots/business-phone-buy.png', fullPage: true });
  await A.tap('#view [data-act="decline"]');
  await mac.waitForSelector('.bz-gavel-fx.auction');
  await mac.waitForTimeout(900);
  await mac.screenshot({ path: 'shots/business-gavel.png' });
  await B.waitForSelector('#view [data-act="bid"][data-add="100"]');
  await B.tap('#view [data-act="bid"][data-add="100"]');
  await C.waitForSelector('#view [data-act="bid"][data-add="50"]:not([disabled])');
  await C.tap('#view [data-act="bid"][data-add="50"]');
  await mac.screenshot({ path: 'shots/business-mac-auction.png' });
  await C.screenshot({ path: 'shots/business-phone-auction.png', fullPage: true });
  await mac.waitForFunction(() => !P.ctx.state.auction, null, { timeout: 20000 });
  let st = await S();
  bad(st.own[39] && st.own[39].p === c, `the top bidder (${phones[c].name}) gets the property`);
  bad(st.cash[c] === 1500 - 150, 'and pays the bid');
  console.log('auction:', phones[c].name, 'won Altamount Road for 150 (₹6 Cr)');
  // 3. a trade: the first player offers money for one of Bob's properties; Bob accepts
  await mac.evaluate(b => { const st = P.ctx.state; st.own[1] = { p: b, h: 0, mort: false }; if (st.step !== 'main') st.step = 'main'; P.ctx.update(); }, b);
  await A.waitForSelector('#view [data-local="tab"][data-tab="trade"]');
  await A.tap('#view [data-local="tab"][data-tab="trade"]');
  await A.tap(`#view [data-local="tp"][data-p="${b}"]`);
  await A.tap('#view [data-local="cash"][data-list="gc"][data-n="100"]');
  await A.tap('#view [data-local="prop"][data-list="wp"][data-at="1"]');
  await A.screenshot({ path: 'shots/business-phone-trade.png', fullPage: true });
  await A.tap('#view [data-act="offer"]');
  await B.waitForSelector('#view [data-act="treply"][data-r="accept"]');
  await B.tap('#view [data-act="treply"][data-r="accept"]');
  await mac.waitForFunction(a => P.ctx.state.own[1].p === a, a, { timeout: 5000 }).catch(() => {});
  st = await S();
  bad(st.own[1].p === a, 'the trade moved the property');
  // 4. Cy owes more than he has and declares bankruptcy: the short game ends, the richest wins
  await mac.evaluate(c => { const st = P.ctx.state; st.cash[c] = 5; st.debts.push({ p: c, to: 'bank', n: 400, why: 'a test' }); st.debtBack = st.step; st.after = { k: 'turn' }; st.step = 'debt'; P.ctx.update(); }, c);
  await C.waitForSelector('#view [data-local="bk"]');
  await C.screenshot({ path: 'shots/business-phone-debt.png', fullPage: true });
  await C.tap('#view [data-local="bk"]');
  await C.tap('#view [data-act="bankrupt"]');
  await mac.waitForSelector('#endModal:not([hidden])', { timeout: 10000 });
  const end = (await mac.textContent('#endBody')).replace(/\s+/g, ' ');
  console.log('end:', (await mac.textContent('#endTitle')).trim(), '|', end.trim());
  bad(/bankrupt/.test(end), 'the bankrupt player is marked');
  bad(/Net worth:/.test(end) && /₹/.test(end), 'net worth in Mumbai money');
  await mac.screenshot({ path: 'shots/business-mac-end.png' });
  const lb = await mac.evaluate(() => Leaderboard.topParty('business').length);
  bad(lb === 3, `the leaderboard recorded the game (${lb} players)`);
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
