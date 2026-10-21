const H = require('./helpers');
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('werewolf', ['Ana', 'Bob', 'Cy', 'Dee', 'Eli']);
  const { mac, phones, errs } = T;
  await mac.check('#opts input[value="drunk"]');
  await mac.selectOption('#opt-actionTime', '10');
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  const deal = await mac.evaluate(() => ({ deck: P.ctx.state.deck, start: P.ctx.state.start }));
  console.log('deck:', deal.deck.join(', '), '\nstarting roles:', phones.map((x, i) => `${x.name}=${deal.start[i]}`).join(' '));
  // every phone sees only its own role
  const p0 = phones[0].p;
  await p0.waitForSelector('#view .ww-card'); await p0.click('#view .ww-card');
  console.log('Ana\'s phone shows:', (await p0.textContent('#view .ww-card b')), '| expected', deal.start[0]);
  await p0.screenshot({ path: 'shots/ww-phone-role.png', fullPage: true });
  await mac.screenshot({ path: 'shots/ww-mac-deal.png' });
  // night: whoever is awake acts
  const acted = [];
  await mac.waitForFunction(() => P.ctx.state.phase === 'night', null, { timeout: 60000 });
  let nightShot = false;
  while (await mac.evaluate(() => P.ctx?.state?.phase === 'night')) {
    for (const { name, p } of phones) {
      const v = await p.evaluate(() => ST?.view);
      if (!v || v.phase !== 'night' || !v.awake || v.done) continue;
      if (!nightShot && v.role !== 'minion') { await p.screenshot({ path: 'shots/ww-phone-night.png', fullPage: true }); await mac.screenshot({ path: 'shots/ww-mac-night.png' }); nightShot = true; }
      const has = s => p.$(s);
      if (v.role === 'troublemaker') { await p.locator('#view [data-local="pp"]').nth(0).click(); await p.locator('#view [data-local="pp"]').nth(1).click(); await p.click('#view [data-act="swap"]'); }
      else if (await has('#view [data-act]:not([disabled])')) await p.click('#view [data-act]:not([disabled])');
      else continue;
      acted.push(`${name}(${v.role})`);
      await p.waitForTimeout(300);
      console.log(`  ${name} as ${v.role} → ${(await p.evaluate(() => ST.view.notes.slice(-1)[0] || '')) }`);
    }
    await mac.waitForTimeout(400);
  }
  console.log('night actions by:', acted.join(', '));
  console.log('DEBUG after night:', await mac.evaluate(() => JSON.stringify({ phase: P.phase, ctx: !!P.ctx, st: P.ctx?.state?.phase, step: P.ctx?.state?.step })), errs);
  // day: everyone ready → vote
  await mac.waitForFunction(() => P.ctx.state.phase === 'day', null, { timeout: 60000 });
  for (const { p } of phones) { await p.waitForSelector('#view [data-act="ready"]'); await p.click('#view [data-act="ready"]'); }
  await mac.waitForFunction(() => P.ctx.state.phase === 'vote', null, { timeout: 30000 });
  for (const [k, { p }] of phones.entries()) { await p.waitForSelector('#view [data-act="vote"]'); await p.click(`#view [data-act="vote"][data-p="${k === 0 ? 1 : 0}"]`); }
  await mac.waitForSelector('#endModal:not([hidden])', { timeout: 30000 });
  const fin = await mac.evaluate(() => P.ctx.state.cards.slice(0, 5));
  console.log('final cards:', phones.map((x, i) => `${x.name}=${fin[i]}`).join(' '));
  // expected outcome, computed independently: Ana dies (4 votes); Hunter takes Bob with them
  const dead = new Set([0]); if (fin[0] === 'hunter') dead.add(1);
  const wolves = fin.map((r, i) => r === 'werewolf' ? i : -1).filter(i => i >= 0);
  const tanner = [...dead].some(i => fin[i] === 'tanner'), wolfDied = wolves.some(i => dead.has(i));
  const expect = wolves.length ? (wolfDied ? 'The village wins!' : tanner ? 'The Tanner got their wish!' : 'The werewolves win!')
    : ([...dead].some(i => fin[i] !== 'minion') ? (tanner ? 'The Tanner got their wish!' : fin.includes('minion') ? 'The werewolves win!' : 'Nobody wins!') : 'The village wins!');
  console.log('Mac says:', await mac.textContent('#endBody .ww-head'), '| expected:', expect);
  console.log('winners:', await mac.textContent('#endTitle'));
  await mac.screenshot({ path: 'shots/ww-mac-end.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
