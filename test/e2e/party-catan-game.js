const H = require('./helpers');
const { setup } = require('./party-setup');
const RES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
(async () => {
  const T = await setup('catan', ['Ana', 'Bob', 'Cy'], { macSize: { width: 1440, height: 1000 } });
  const { mac, phones, errs } = T;
  await mac.selectOption('#opt-target', '8');
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  // the board check: a new island, then keep it; harbour tokens stay inside the board
  const layout = () => mac.evaluate(() => P.ctx.state.board.hexes.map(h => h.res + h.num).join());
  const first = await layout();
  await mac.click('#stage [data-host="newBoard"]');
  if (await layout() === first) console.log('BAD New board did not change the island');
  const cut = await mac.evaluate(() => { const b = document.querySelector('.cat-main .cat-board').getBoundingClientRect();
    return [...document.querySelectorAll('.cat-main .cat-board circle[fill="#f6ecd2"]')].filter(c => { const r = c.getBoundingClientRect(); return r.left < b.left || r.right > b.right || r.top < b.top || r.bottom > b.bottom; }).length; });
  if (cut) console.log('BAD', cut, 'harbour tokens cut off at the board edge');
  await mac.screenshot({ path: 'shots/catan-mac-board.png' });
  await mac.click('#stage [data-host="useBoard"]');
  // everyone rolls for turn order from their phone, when called
  for (let k = 0; k < phones.length; k++) {
    const who = await mac.evaluate(() => P.ctx.state.turn);
    const p = phones[who].p;
    await p.waitForSelector('#view [data-act="orderRoll"]');
    if (k === 0) await p.screenshot({ path: 'shots/catan-phone-order.png', fullPage: true });
    await p.locator('#view [data-act="orderRoll"]').dispatchEvent('click');
    await mac.waitForFunction(n => P.ctx.state.order.rolls.length > n, k);
  }
  const ord = await mac.evaluate(() => ({ first: P.ctx.state.first, rolls: P.ctx.state.order.rolls, rows: [...document.querySelectorAll('.cat-score tr')].map(r => +r.dataset.p) }));
  const best = Math.max(...ord.rolls.map(r => r.t));
  console.log('order rolls:', ord.rolls.map(r => `${phones[r.p].name} ${r.t}`).join(', '), '→ first', phones[ord.first].name);
  if (ord.first !== ord.rolls.find(r => r.t === best).p) console.log('BAD the highest (earliest on a tie) should start');
  if (ord.rows.join() !== [0, 1, 2].map(k => (ord.first + k) % 3).join()) console.log('BAD the scoreboard should list turn order', ord.rows);
  await mac.screenshot({ path: 'shots/catan-mac-order.png' });
  // cards flying on the Mac and glowing on the phones (watched for the whole game)
  await mac.evaluate(() => { window.__fly = 0; new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => { if (n.classList?.contains('cat-fly')) window.__fly++; }))).observe(document.body, { childList: true }); });
  for (const x of phones) await x.p.evaluate(() => { window.__glow = 0; new MutationObserver(() => { if (document.querySelector('#view .cat-up, #view .cat-down')) window.__glow++; }).observe(document.querySelector('#view'), { childList: true, subtree: true }); });
  for (const x of phones) await x.p.evaluate(() => { window.__c = {}; const o = es.onmessage; es.onmessage = e => { const m = JSON.parse(e.data); window.__c[m.type] = (window.__c[m.type] || 0) + 1; o(e); }; });
  const actP = (p, msg) => p.evaluate(m => post({ type: 'act', ...m }), msg);
  const view = p => p.evaluate(() => ST?.view);
  // Clicks on the phone's board pick from what is on screen at that moment (the state read a moment earlier may already be
  // out of date: the previous move can land in between), and give up quickly if the board has moved on
  const clickOne = async (p, sel, random) => {
    const els = p.locator(sel), n = await els.count();
    if (!n) return false;
    return els.nth(random ? Math.floor(Math.random() * n) : 0).dispatchEvent('click', {}, { timeout: 3000 }).then(() => true, () => false);
  };
  const check = async () => {
    const r = await mac.evaluate(() => { const st = P.ctx?.state; if (!st) return null; return ['wood', 'brick', 'sheep', 'wheat', 'ore'].map(k => st.bank[k] + st.res.reduce((a, h) => a + h[k], 0)); });
    if (r && r.some(x => x !== 19)) throw new Error('resource count broken: ' + r);
  };
  let turns = 0, uiBuild = false, shots = 0, steps = 0, stats = { roads: 0, settlements: 0, cities: 0, devs: 0, dev: {}, bank: 0, trades: 0, offers: 0, counters: 0, requests: 0, confirmed: 0, sevens: 0 }, waits = {};
  while (!(await mac.isVisible('#endModal')) && steps < 6000) {
    steps++;
    let did = false;
    for (const { name, p } of phones) {
      const v = await view(p);
      if (!v) continue;
      const before = await p.evaluate(() => JSON.stringify(ST?.view));     // to wait until a move has been processed
      if (v.discard) {
        const cards = RES.flatMap(r => Array(v.res[r]).fill(r)).slice(0, v.discard);
        await actP(p, { act: 'discard', res: cards.join(',') }); did = true; continue;
      }
      // trades: answer what was sent to you (yes, sometimes a counter, or no); now and then ask the active player
      const incoming = (v.trades || []).find(t => !t.sent && !t.myReply);
      if (incoming) {
        const r = incoming.canAccept ? (Math.random() < .2 ? 'counter' : 'accept') : 'decline';
        const m = { act: 'reply', id: incoming.id, r };
        if (r === 'counter') { m.give = RES.filter(k => incoming.give[k]).join(','); m.want = RES.filter(k => incoming.want[k]).join(','); stats.counters++; }
        await actP(p, m); if (r === 'accept') stats.trades++; did = true; continue;
      }
      if (v.canRequest && !(v.trades || []).some(t => t.sent) && Math.random() < .03) {
        const g = RES.find(r => v.res[r] >= 1), w = RES.find(r => r !== g && !v.res[r]);
        if (g && w) { await actP(p, { act: 'offer', give: g, want: w }); stats.requests++; did = true; continue; }
      }
      if (!v.mine) continue;
      const L = v.legal;
      const pick = a => a[Math.floor(Math.random() * a.length)];
      if (v.step === 'setup-settle') did = await clickOne(p, '#view .pick-vert', true);
      else if (v.step === 'setup-road') did = await clickOne(p, '#view .pick-edge', false);
      else if (v.step === 'roll') {
        if (shots === 0) { await p.screenshot({ path: 'shots/catan-phone.png', fullPage: true }); await mac.screenshot({ path: 'shots/catan-mac.png' }); shots++; }
        await p.evaluate(() => { window.__mut = 0; window.__mo?.disconnect(); window.__mo = new MutationObserver(m => { window.__mut += m.length; }); window.__mo.observe(document.querySelector('#view'), { childList: true, subtree: true }); });
        try { await p.locator('#view [data-act="roll"]').dispatchEvent('click', {}, { timeout: 6000 }); await p.waitForFunction(() => ST.view.step !== 'roll' || !ST.view.mine, null, { timeout: 6000 }); }
        catch (e) {
          console.log('DEBUG roll click failed for', name, '| #view mutations:', await p.evaluate(() => __mut), '| msgs', await p.evaluate(() => JSON.stringify(window.__c)), '| view step', (await view(p)).step);
          await p.screenshot({ path: 'shots/catan-fail.png', fullPage: true }); throw e;
        }
        did = true; turns++;
        const d = await mac.evaluate(() => P.ctx.state.dice); if (d && d[0] + d[1] === 7) stats.sevens++;
      }
      else if (v.step === 'robber') { await actP(p, { act: 'robber', h: pick(L.robber) }); did = true; }
      else if (v.step === 'steal') { await actP(p, { act: 'steal', p: v.victims[0].i }); did = true; }
      else if (v.step === 'roads') { await actP(p, { act: 'build', kind: 'road', at: pick(L.road) }); did = true; }
      else if (v.step === 'main') {
        const can = c => RES.every(r => v.res[r] >= ({ road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, dev: { sheep: 1, wheat: 1, ore: 1 } }[c][r] || 0));
        // first build of the game goes through the phone's own buttons and board
        if (!uiBuild && can('road') && L.road.length) {
          await p.locator('#view [data-local="tab"][data-tab="build"]').dispatchEvent('click').catch(() => {});
          await p.locator('#view [data-local="mode"][data-mode="road"]').dispatchEvent('click');
          if (await clickOne(p, '#view .pick-edge', false)) { uiBuild = true; stats.roads++; console.log(`${name} built a road using the phone's board`); }
          did = true; continue;
        }
        const playable = v.dev.find(d => !d.fresh && d.type !== 'vp' && !v.devPlayed);
        if (playable && Math.random() < .5) {
          const msg = { act: 'dev', card: playable.type };
          if (playable.type === 'plenty') msg.res = 'ore,wheat';
          if (playable.type === 'monopoly') msg.res = 'wood';
          await actP(p, msg); stats.dev[playable.type] = (stats.dev[playable.type] || 0) + 1; did = true; continue;
        }
        if (can('city') && L.city.length) { await actP(p, { act: 'build', kind: 'city', at: pick(L.city) }); stats.cities++; did = true; continue; }
        if (can('settlement') && L.settlement.length) { await actP(p, { act: 'build', kind: 'settlement', at: pick(L.settlement) }); stats.settlements++; did = true; continue; }
        if (can('dev') && v.deck) { await actP(p, { act: 'buydev' }); stats.devs++; did = true; continue; }
        if (can('road') && L.road.length && Math.random() < .7) { await actP(p, { act: 'build', kind: 'road', at: pick(L.road) }); stats.roads++; did = true; continue; }
        const rich = RES.find(r => v.res[r] >= v.ratios[r] + 1), poor = RES.find(r => !v.res[r] && v.bank[r]);
        if (rich && poor && rich !== poor) { await actP(p, { act: 'bank', give: rich, get: poor }); stats.bank++; did = true; continue; }
        const mineT = (v.trades || []).find(t => t.sent);
        if (mineT) {                                   // take an answer, give the others a moment, or withdraw
          const yes = mineT.to.find(x => x.reply && x.reply.r !== 'decline');
          if (yes) { await actP(p, { act: 'confirm', id: mineT.id, p: yes.i }); stats.confirmed++; did = true; continue; }
          if (mineT.to.some(x => !x.reply) && (waits[mineT.id] = (waits[mineT.id] || 0) + 1) < 4) continue;
          await actP(p, { act: 'withdraw' }); did = true; continue;
        }
        if (RES.some(r => v.res[r] >= 2) && Math.random() < .15) {
          const g = RES.find(r => v.res[r] >= 2), w = RES.find(r => r !== g && !v.res[r]) || RES.find(r => r !== g);
          await actP(p, { act: 'offer', give: g, want: w }); stats.offers++; did = true; continue;
        }
        await actP(p, { act: 'end' }); did = true;
      }
      if (did) { await p.waitForFunction(b => JSON.stringify(ST?.view) !== b, before, { timeout: 3000 }).catch(() => {}); await check(); break; }
    }
    if (!did) await mac.waitForTimeout(120);
  }
  await check();
  const st = await mac.evaluate(() => { const s = P.ctx.state; return { lr: s.longestRoad, la: s.largestArmy, len: s.roadLen, kn: s.knights, deck: s.devDeck.length }; });
  console.log('turns:', turns, '| built:', JSON.stringify(stats), '\nawards:', JSON.stringify(st));
  const fly = await mac.evaluate(() => window.__fly), glow = await Promise.all(phones.map(x => x.p.evaluate(() => window.__glow)));
  console.log('cards flown on the Mac:', fly, '| phone glows:', glow.join(', '));
  if (!fly) console.log('BAD no cards flew on the Mac'); if (glow.some(g => !g)) console.log('BAD a phone never glowed');
  console.log('end:', await mac.textContent('#endTitle'), '|', (await mac.textContent('#endBody')).replace(/\s+/g, ' ').trim());
  await mac.screenshot({ path: 'shots/catan-mac-end.png' });
  console.log('log tail:', (await mac.$$eval('#log div', d => d.slice(0, 8).map(x => x.textContent))).join(' / '));
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(async e => { console.error('FAILED', e.message); process.exit(1); });
