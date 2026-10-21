const H = require('./helpers');
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('catan', ['Ana', 'Bob', 'Cy']);
  const { mac, errs } = T;
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  const out = await mac.evaluate(() => {
    const ctx = P.ctx, st = ctx.state, G = PARTY_GAME, log = [];
    const act = (i, m) => G.act(ctx, i, m);
    // play the setup through the game's own rules: first legal spots
    while (st.step.startsWith('setup')) {
      const v = G.view(ctx, st.turn);
      if (st.step === 'setup-settle') act(st.turn, { act: 'build', kind: 'settlement', at: v.legal.settlement[0] });
      else act(st.turn, { act: 'build', kind: 'road', at: v.legal.road[0] });
    }
    const p = st.turn, R = st.res[p];
    log.push(`setup done; ${ctx.players[p].name} starts with ${JSON.stringify(R)}`);
    log.push('build before rolling → ' + act(p, { act: 'build', kind: 'road', at: 0 }));
    act(p, { act: 'roll' });
    if (st.step !== 'main') { st.discards = {}; st.step = 'main'; }
    // City: give exactly the cost, upgrade the first settlement
    Object.assign(R, { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 });
    const mySettle = G.view(ctx, p).legal.city[0];
    log.push('city → ' + (act(p, { act: 'build', kind: 'city', at: mySettle }) || 'built') + ` | is city: ${st.bld[mySettle].city} | cards left ${Object.values(R).reduce((a, b) => a + b, 0)}`);
    log.push('second city without cards → ' + act(p, { act: 'build', kind: 'city', at: G.view(ctx, p).legal.city[0] }));
    // Dev cards: bought this turn can't be played
    Object.assign(R, { sheep: 1, wheat: 1, ore: 1 });
    st.devDeck.push('plenty');
    act(p, { act: 'buydev' });
    log.push('play a card bought this turn → ' + act(p, { act: 'dev', card: 'plenty', res: 'ore,ore' }));
    st.dev[p].forEach(d => { d.fresh = false; });
    const ore0 = R.ore;
    log.push('Year of Plenty → ' + (act(p, { act: 'dev', card: 'plenty', res: 'ore,ore' }) || 'ok') + ` | ore ${ore0} → ${R.ore}`);
    st.dev[p].push({ type: 'roads', fresh: false });
    log.push('second dev card same turn → ' + act(p, { act: 'dev', card: 'roads' }));
    st.devPlayed = false;
    const roads0 = Object.values(st.roads).filter(x => x === p).length;
    act(p, { act: 'dev', card: 'roads' });
    for (let k = 0; k < 2; k++) act(p, { act: 'build', kind: 'road', at: G.view(ctx, p).legal.road[0] });
    log.push(`Road Building: roads ${roads0} → ${Object.values(st.roads).filter(x => x === p).length}, step ${st.step}`);
    // Largest Army: 3 knights
    for (let k = 0; k < 3; k++) {
      st.devPlayed = false; st.dev[p].push({ type: 'knight', fresh: false });
      act(p, { act: 'dev', card: 'knight' });
      act(p, { act: 'robber', h: G.view(ctx, p).legal.robber[0] });
      if (st.step === 'steal') act(p, { act: 'steal', p: st.victims[0] });
    }
    log.push(`Largest Army after 3 knights: ${st.largestArmy === p ? ctx.players[p].name : st.largestArmy} | VP now ${G.view(ctx, p).vp}`);
    // Bank 4:1
    Object.assign(R, { wood: 4, brick: 0 });
    log.push('bank 4 wood → 1 brick → ' + (act(p, { act: 'bank', give: 'wood', get: 'brick' }) || 'ok') + ` | wood ${R.wood} brick ${R.brick}`);
    // Win: secret VP cards push them to 10
    const need = 10 - G.view(ctx, p).vp;
    for (let k = 0; k < need; k++) st.dev[p].push({ type: 'vp', fresh: false });
    Object.assign(R, { wood: 1, brick: 1 });
    act(p, { act: 'build', kind: 'road', at: G.view(ctx, p).legal.road[0] });
    log.push(`after reaching 10 VP: game phase ${P.phase}`);
    return log;
  });
  out.forEach(l => console.log(' ', l));
  console.log('end:', await mac.textContent('#endTitle'));
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
