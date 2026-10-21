const H = require('./helpers');
const { setup } = require('./party-setup');
const RES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
(async () => {
  const T = await setup('catan', ['Ana', 'Bob', 'Cy'], { macSize: { width: 1440, height: 1000 } });
  const { mac, phones, errs } = T;
  await mac.selectOption('#opt-target', '8');
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  for (const x of phones) await x.p.evaluate(() => { window.__c = {}; const o = es.onmessage; es.onmessage = e => { const m = JSON.parse(e.data); window.__c[m.type] = (window.__c[m.type] || 0) + 1; o(e); }; });
  const actP = (p, msg) => p.evaluate(m => post({ type: 'act', ...m }), msg);
  const view = p => p.evaluate(() => ST?.view);
  const check = async () => {
    const r = await mac.evaluate(() => { const st = P.ctx?.state; if (!st) return null; return ['wood', 'brick', 'sheep', 'wheat', 'ore'].map(k => st.bank[k] + st.res.reduce((a, h) => a + h[k], 0)); });
    if (r && r.some(x => x !== 19)) throw new Error('resource count broken: ' + r);
  };
  let turns = 0, uiBuild = false, shots = 0, steps = 0, stats = { roads: 0, settlements: 0, cities: 0, devs: 0, dev: {}, bank: 0, trades: 0, sevens: 0 };
  while (!(await mac.isVisible('#endModal')) && steps < 6000) {
    steps++;
    let did = false;
    for (const { name, p } of phones) {
      const v = await view(p);
      if (!v) continue;
      if (v.discard) {
        const cards = RES.flatMap(r => Array(v.res[r]).fill(r)).slice(0, v.discard);
        await actP(p, { act: 'discard', res: cards.join(',') }); did = true; continue;
      }
      if (v.offer && v.offer.from !== v.me && v.offer.canAccept && !v.offer.declined) { await actP(p, { act: 'accept' }); stats.trades++; did = true; continue; }
      if (!v.mine) continue;
      const L = v.legal;
      const pick = a => a[Math.floor(Math.random() * a.length)];
      if (v.step === 'setup-settle') { await p.locator('#view .pick-vert').nth(Math.floor(Math.random() * L.settlement.length)).dispatchEvent('click'); did = true; }
      else if (v.step === 'setup-road') { await p.locator('#view .pick-edge').first().dispatchEvent('click'); did = true; }
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
          await p.locator('#view .pick-edge').first().dispatchEvent('click');
          uiBuild = true; stats.roads++; console.log(`${name} built a road using the phone's board`); did = true; continue;
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
        if (!v.offer && RES.some(r => v.res[r] >= 2) && Math.random() < .15) {
          const g = RES.find(r => v.res[r] >= 2), w = RES.find(r => r !== g && !v.res[r]) || RES.find(r => r !== g);
          await actP(p, { act: 'offer', give: g, want: w }); did = true; continue;
        }
        await actP(p, { act: 'end' }); did = true;
      }
      if (did) { await p.waitForTimeout(60); await check(); break; }
    }
    if (!did) await mac.waitForTimeout(120);
  }
  await check();
  const st = await mac.evaluate(() => { const s = P.ctx.state; return { lr: s.longestRoad, la: s.largestArmy, len: s.roadLen, kn: s.knights, deck: s.devDeck.length }; });
  console.log('turns:', turns, '| built:', JSON.stringify(stats), '\nawards:', JSON.stringify(st));
  console.log('end:', await mac.textContent('#endTitle'), '|', (await mac.textContent('#endBody')).replace(/\s+/g, ' ').trim());
  await mac.screenshot({ path: 'shots/catan-mac-end.png' });
  console.log('log tail:', (await mac.$$eval('#log div', d => d.slice(0, 8).map(x => x.textContent))).join(' / '));
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(async e => { console.error('FAILED', e.message); process.exit(1); });
