// Catan, leaving mid-game: a player taps "Leave now" twice on their phone, then the host removes another from the Mac.
// Their pieces come off the board, the game goes on, the last player wins, and leavers aren't on the leaderboard.
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('catan', ['Ana', 'Bob', 'Cy'], { macSize: { width: 1440, height: 1000 } });
  const { mac, phones, errs } = T;
  const bad = (ok, what) => { if (!ok) console.log('BAD', what); };
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  await mac.click('#stage [data-host="useBoard"]');
  const go = (k, m) => mac.evaluate(([k, m]) => { PARTY_GAME.act(P.ctx, k, m); P.ctx.update(); }, [k, m]);
  while (await mac.evaluate(() => P.ctx.state.step === 'order')) await go(await mac.evaluate(() => P.ctx.state.turn), { act: 'orderRoll' });
  while (await mac.evaluate(() => P.ctx.state.step.startsWith('setup'))) {
    const [t, L, s] = await mac.evaluate(() => [P.ctx.state.turn, PARTY_GAME.view(P.ctx, P.ctx.state.turn).legal, P.ctx.state.step]);
    await go(t, s === 'setup-settle' ? { act: 'build', kind: 'settlement', at: L.settlement[0] } : { act: 'build', kind: 'road', at: L.road[0] });
  }
  const pieces = k => mac.evaluate(k => Object.values(P.ctx.state.bld).filter(b => b.p === k).length + Object.values(P.ctx.state.roads).filter(x => x === k).length, k);
  const turn = await mac.evaluate(() => P.ctx.state.turn), leaver = (turn + 1) % 3, removed = (turn + 2) % 3;
  console.log(`${phones[leaver].name} has ${await pieces(leaver)} pieces on the board`);
  // 1. Leave now, from the phone (one tap only arms it)
  const L = phones[leaver].p;
  await L.tap('#leaveNowBtn');
  bad(/Tap again/.test(await L.textContent('#leaveNowBtn')), 'the first tap asks for a second');
  bad(await pieces(leaver) === 4, 'one tap does not leave');
  await L.tap('#leaveNowBtn');
  await mac.waitForFunction(k => P.ctx.state.out?.[k], leaver);
  await mac.waitForTimeout(500);
  bad(await pieces(leaver) === 0, 'their roads and buildings are off the board');
  bad(await mac.evaluate(() => P.seats.length) === 2, 'their seat is gone');
  bad(await L.isHidden('#viewPanel'), 'the phone that left no longer shows the game');
  bad(/left the game/.test(await mac.textContent(`.cat-score tr[data-p="${leaver}"]`)), 'the Mac lists them as left');
  await mac.screenshot({ path: 'shots/catan-leave-mac.png' });
  // 2. The host removes a player: × then Remove
  await mac.click(`#stage .cat-x[data-p="${removed}"]`);
  bad(/Remove/.test(await mac.textContent('#stage .cat-confirm')), 'the Mac asks before removing');
  await mac.screenshot({ path: 'shots/catan-remove-confirm.png' });
  await mac.click('#stage [data-host="removeYes"]');
  await mac.waitForSelector('#endModal:not([hidden])');
  const end = (await mac.textContent('#endBody')).replace(/\s+/g, ' ');
  console.log('end:', (await mac.textContent('#endTitle')).trim(), '|', end.trim());
  bad((await mac.textContent('#endTitle')).includes(phones[turn].name), 'the last player at the table wins');
  bad((end.match(/left the game/g) || []).length === 2, 'both leavers are listed as left');
  await phones[removed].p.waitForFunction(() => ST && ST.me == null && ST.phase === 'end', null, { timeout: 5000 }).catch(() => {});
  bad(await phones[removed].p.isHidden('#viewPanel'), 'the removed phone no longer shows the game');
  const lb = await mac.evaluate(() => Leaderboard.topParty('catan').map(r => r.name));
  bad(JSON.stringify(lb) === JSON.stringify([phones[turn].name]), `only the winner is on the leaderboard (${lb})`);
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
