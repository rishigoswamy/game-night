// Mafia at its biggest: 16 phones join, every seat gets its own colour, the roles fit, and a whole night runs
const { setup } = require('./party-setup');
const NAMES = ['Ana', 'Bob', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lu', 'Mo', 'Ned', 'Oz', 'Pia'];
(async () => {
  const T = await setup('mafia', NAMES);
  const { mac, phones, errs } = T;
  const bad = (ok, what) => { if (!ok) console.log('BAD', what); };
  const colors = await mac.evaluate(() => P.seats.map(s => s.color));
  console.log('seats:', colors.length, '| distinct colours:', new Set(colors).size);
  bad(new Set(colors).size === 16, '16 players, 16 colours');
  for (const r of ['escort', 'bodyguard', 'mason', 'mayor', 'godfather', 'consort', 'jester', 'serialkiller', 'veteran']) await mac.check(`#opts input[value="${r}"]`);
  console.log('lobby:', (await mac.textContent('#lobbyInfo')).replace(/\s+/g, ' ').trim());
  await mac.screenshot({ path: 'shots/mafia16-mac-lobby.png', fullPage: true });
  await mac.selectOption('#opt-night', '20');
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  const roles = await mac.evaluate(() => P.ctx.state.roles);
  const count = r => roles.filter(x => x === r).length;
  console.log('roles:', roles.join(', '));
  bad(roles.length === 16, 'a role for everyone');
  bad(count('mafioso') + count('godfather') + count('consort') === 4, '4 mafia for 16 players');
  bad(count('mason') === 2, 'two Masons');
  bad(roles.filter(r => ['jester', 'serialkiller'].includes(r)).length === 2, 'neutrals: 16 / 5 → 3 allowed, 2 ticked');
  await mac.evaluate(() => P.ctx.skip());
  await mac.waitForFunction(() => P.ctx.state.phase === 'night', null, { timeout: 30000 });
  for (const { p } of phones) {
    await p.waitForSelector('#view [data-act="done"]');
    const v = await p.evaluate(() => ST.view);
    const tap = sel => p.locator(sel).first().click({ timeout: 3000 }).catch(() => {});
    if (v.family) await tap('#view [data-act="kill"]');
    if (v.kind === 'target') await tap('#view [data-act="act"]:not([data-p="none"]):not([disabled])');
    if (v.kind === 'hunch') await tap('#view [data-act="hunch"]');
    await tap('#view [data-act="done"]');
  }
  await mac.screenshot({ path: 'shots/mafia16-mac-night.png' });
  await mac.waitForFunction(() => P.ctx.state.phase === 'day', null, { timeout: 60000 });
  const tiles = await mac.$$eval('.mf-tile', t => t.length);
  console.log('night over; Mac tiles:', tiles, '| died:', await mac.evaluate(() => P.ctx.state.deaths.map(d => P.ctx.players[d.k].name).join(', ') || 'nobody'));
  bad(tiles === 16, 'a tile for every player');
  await mac.screenshot({ path: 'shots/mafia16-mac-day.png' });
  await phones[15].p.screenshot({ path: 'shots/mafia16-phone-day.png', fullPage: true });
  await mac.click('#endBtn'); await mac.click('#confirmYes');
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
