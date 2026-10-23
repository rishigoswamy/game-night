// Catan on real phone touches (the other tests click elements directly): taps a little off target still land on
// corners and roads, an update that arrives mid-tap waits until the tap is done, everyone sees both dice, and a trade
// (steppers, a chosen player, a counter-offer) goes through
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('catan', ['Ana', 'Bob', 'Cy']);
  const { mac, phones, errs } = T;
  const bad = (ok, what) => { if (!ok) console.log('BAD', what); };
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  await mac.click('#stage [data-host="useBoard"]');
  for (let k = 0; k < 3; k++) {                                         // the roll for turn order, tapped on each phone
    const t = await mac.evaluate(() => P.ctx.state.turn);
    await phones[t].p.waitForSelector('#view [data-act="orderRoll"]');
    await phones[t].p.tap('#view [data-act="orderRoll"]');
    await mac.waitForFunction(n => P.ctx.state.order.rolls.length > n, k);
  }
  const touch = async (p, x, y, holdMs = 70, during) => {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    if (during) await during();
    await p.waitForTimeout(holdMs);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(500);
  };
  const pieces = () => mac.evaluate(() => Object.keys(P.ctx.state.bld).length + Object.keys(P.ctx.state.roads).length);
  // setup: every settlement and road placed by a finger 10 px off the target
  let placed = 0, held = null;
  while (await mac.evaluate(() => P.ctx.state.step.startsWith('setup'))) {
    const [t, step] = await mac.evaluate(() => [P.ctx.state.turn, P.ctx.state.step]), p = phones[t].p, sel = step === 'setup-settle' ? '#view .pick-vert' : '#view .pick-edge';
    await p.waitForSelector(sel, { state: 'attached' });
    const L = p.locator(sel), b = await L.nth(Math.min(5, (await L.count()) - 1)).boundingBox(), n0 = await pieces();
    if (held === null) {
      // the first tap is held while someone else's move updates every phone: the view must not change under the finger
      await p.evaluate(() => { window.__m = 0; window.__mo = new MutationObserver(m => { window.__m += m.length; }); window.__mo.observe(document.querySelector('#view'), { childList: true, subtree: true }); });
      await touch(p, b.x + b.width / 2 + 9, b.y + b.height / 2 + 5, 400, async () => {
        await mac.evaluate(t => { const q = (t + 1) % 3, st = P.ctx.state; st.res[q].wood++; st.bank.wood--; P.ctx.update(); }, t);   // another player's card count changes
        await p.waitForTimeout(250);
        held = await p.evaluate(() => window.__m);
      });
      bad(held === 0, `the phone redrew ${held} times under the finger`);
      const q = (t + 1) % 3, pill = await p.textContent('#view .pills');
      bad(pill.includes(`${phones[q].name} 0⭐ · 1`), `after the tap the update shows (${pill.trim()})`);
      await mac.evaluate(q => { const st = P.ctx.state; st.res[q].wood--; st.bank.wood++; P.ctx.update(); }, q);
    } else await touch(p, b.x + b.width / 2 + 9, b.y + b.height / 2 + 5);
    if (await pieces() > n0) placed++; else { console.log('BAD a tap 10 px off a', step === 'setup-settle' ? 'corner' : 'road', 'missed'); break; }
  }
  console.log('setup by touch, 10 px off target:', placed, 'of 12 placed; redraws under a held finger:', held);
  bad(placed === 12, 'all 12 setup pieces placed by touch');
  // a turn roll: both dice on the Mac and on every phone
  const t = await mac.evaluate(() => P.ctx.state.turn);
  await phones[t].p.tap('#view [data-act="roll"]');
  await mac.waitForFunction(() => P.ctx.state.dice);
  await mac.waitForTimeout(400);
  const dice = await mac.evaluate(() => P.ctx.state.dice);
  bad(await mac.$$eval('.cat-turn .cat-die', d => d.length) === 2, 'the Mac shows two dice');
  for (const { name, p } of phones) {
    const shown = await p.$$eval('#view .cat-me .cat-die', d => d.map(x => x.querySelectorAll('i.on').length));
    bad(JSON.stringify(shown) === JSON.stringify(dice), `${name}'s phone shows ${shown} (rolled ${dice})`);
  }
  console.log('rolled', dice.join(' + '), '; every phone shows both dice');
  // trading by touch: + / − steppers, an offer to one chosen player, a counter-offer, the offerer accepts it
  const [b1, c1] = [(t + 1) % 3, (t + 2) % 3], A = phones[t].p, B = phones[b1].p;
  await mac.evaluate(([a, b, c]) => { const st = P.ctx.state, set = (p, h) => { for (const r of ['wood', 'brick', 'sheep', 'wheat', 'ore']) { st.bank[r] += st.res[p][r] - (h[r] || 0); st.res[p][r] = h[r] || 0; } };
    set(a, { wood: 3, sheep: 1 }); set(b, { ore: 2 }); set(c, {}); st.discards = {}; st.step = 'main'; P.ctx.update(); }, [t, b1, c1]);
  await A.waitForSelector('#view [data-local="tab"][data-tab="trade"]');
  await A.tap('#view [data-local="tab"][data-tab="trade"]');
  for (const sel of ['[data-list="give"][data-r="wood"][data-local="pick"]', '[data-list="give"][data-r="wood"][data-local="pick"]', '[data-list="give"][data-r="wood"][data-local="unpick"]',
    '[data-list="give"][data-r="sheep"][data-local="pick"]', '[data-list="want"][data-r="ore"][data-local="pick"]', `[data-local="to"][data-q="${c1}"]`]) await A.tap('#view ' + sel);
  const offer = await A.getAttribute('#view [data-act="offer"]', 'data-to');
  bad(offer === String(b1), `the offer goes to ${phones[b1].name} only (data-to ${offer})`);
  await A.tap('#view [data-act="offer"]');
  await B.waitForSelector('#view [data-local="counter"]');
  await B.tap('#view [data-local="counter"]');
  await B.tap('#view [data-list="cg"][data-r="ore"][data-local="pick"]');      // Bob counters: 2 ore for 1 wood + 1 sheep
  await B.tap('#view [data-act="reply"][data-r="counter"]');
  await A.waitForSelector('#view [data-act="confirm"]');
  await A.tap('#view [data-act="confirm"]');
  await mac.waitForFunction(b => P.ctx.state.res[b].wood === 1, b1, { timeout: 5000 }).catch(() => {});
  const hands = await mac.evaluate(([a, b]) => [P.ctx.state.res[a], P.ctx.state.res[b]], [t, b1]);
  console.log('after the counter-offer:', JSON.stringify(hands));
  bad(hands[0].ore === 2 && hands[0].wood === 2 && hands[0].sheep === 0 && hands[1].wood === 1 && hands[1].sheep === 1 && hands[1].ore === 0, 'the counter-offer was traded');
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
