// Mafia, a whole game: 6 phones, the Mac narrating; nights on the phones, then nominations, defense and verdict
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('mafia', ['Ana', 'Bob', 'Cy', 'Dee', 'Eli', 'Fay']);
  const { mac, phones, errs } = T;
  const bad = (ok, what) => { if (!ok) console.log('BAD', what); };
  // the setup: the Doctor's options appear only with the Doctor ticked
  bad(await mac.isVisible('[data-field="docSelf"]'), 'the Doctor\'s options show (the Doctor is ticked by default)');
  bad(!(await mac.isVisible('[data-field="vigShots"]')), 'the Vigilante\'s options are hidden (no Vigilante)');
  await mac.check('#opts input[value="vigilante"]');
  bad(await mac.isVisible('[data-field="vigShots"]'), 'ticking the Vigilante shows its options');
  console.log('lobby:', (await mac.textContent('#lobbyInfo')).replace(/\s+/g, ' ').trim());
  await mac.screenshot({ path: 'shots/mafia-mac-lobby.png', fullPage: true });
  await mac.selectOption('#opt-night', '20');
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state);
  const roles = await mac.evaluate(() => P.ctx.state.roles);
  console.log('roles:', phones.map((x, k) => `${x.name}=${roles[k]}`).join(' '));
  // each phone shows its own role, and only the family sees the family
  for (const [k, { p }] of phones.entries()) {
    await p.waitForSelector('#view .mf-card'); await p.click('#view .mf-card');
    const shown = await p.textContent('#view .mf-card b');
    const known = await p.evaluate(() => ST.view.players.filter(x => x.role && !x.me).map(x => x.name));
    const fam = roles.map((r, j) => ['mafioso', 'godfather'].includes(r) && j !== k ? phones[j].name : null).filter(Boolean);
    bad(shown.toLowerCase().includes(roles[k].slice(0, 4)), `${phones[k].name}'s phone shows ${shown}`);
    bad(JSON.stringify(known) === JSON.stringify(roles[k] === 'mafioso' ? fam : []), `${phones[k].name} sees the roles of ${known} (should be ${roles[k] === 'mafioso' ? fam : 'nobody'})`);
  }
  await phones[0].p.screenshot({ path: 'shots/mafia-phone-role.png', fullPage: true });
  await mac.evaluate(() => P.ctx.skip());                             // (the 20-second look at your role)
  const phase = () => mac.evaluate(() => P.ctx?.state?.phase);
  const st = () => mac.evaluate(() => ({ alive: P.ctx.state.alive, roles: P.ctx.state.roles, accused: P.ctx.state.accused, day: P.ctx.state.day }));
  const tap = (p, sel) => p.locator(sel).first().click({ timeout: 3000 }).then(() => true, () => false);
  let shots = 0, rounds = 0, ghostSeen = false;
  while (!(await mac.isVisible('#endModal'))) {
    const ph = await phase(), s = await st();
    const live = phones.filter((_, k) => s.alive[k]);
    if (ph === 'night') {
      for (const { p, name } of live) {
        const v = await p.evaluate(() => ST?.view);
        if (!v || v.phase !== 'night' || v.done) continue;
        if (v.family && !v.meet) await tap(p, '#view [data-act="kill"]');
        if (v.kind === 'target') await tap(p, '#view [data-act="act"]:not([data-p="none"]):not([disabled])');
        if (v.kind === 'hunch') await tap(p, '#view [data-act="hunch"]');
        await tap(p, '#view [data-act="done"]:not(.red)');
        if (!shots++) { await p.screenshot({ path: 'shots/mafia-phone-night.png', fullPage: true }); await mac.screenshot({ path: 'shots/mafia-mac-night.png' }); console.log(`  ${name} (${v.roleName}) acted at night`); }
      }
      const ghost = phones.find((_, k) => !s.alive[k]);
      if (ghost && !ghostSeen) {
        const g = await ghost.p.evaluate(() => ST.view);
        ghostSeen = true;
        bad(g.players.every(x => x.role), `${ghost.name}, out of the game, sees every role`);
        console.log(`  spectator ${ghost.name} sees: ${g.players.map(x => `${x.name} ${x.role}`).join(', ')}`);
        await ghost.p.screenshot({ path: 'shots/mafia-phone-spectator.png', fullPage: true });
      }
    } else if (ph === 'day') {
      if (s.day !== rounds) {                                          // a new day
        rounds = s.day;
        console.log(`day ${rounds}: alive ${phones.filter((_, k) => s.alive[k]).map(x => x.name).join(', ')}`);
        if (rounds === 1) await mac.screenshot({ path: 'shots/mafia-mac-day.png' });
      }
      for (const { p } of live) await tap(p, '#view [data-act="ready"]:not(.red)');
    } else if (ph === 'nominate') {
      // everyone else nominates a living member of the family
      const t = s.roles.findIndex((r, k) => s.alive[k] && ['mafioso', 'godfather'].includes(r));
      for (const [k, { p }] of phones.entries()) if (s.alive[k] && k !== t) await tap(p, `#view [data-act="nominate"][data-p="${t}"]:not(.on)`);
    } else if (ph === 'defense') {
      await mac.click('#stage [data-host="verdict"]').catch(() => {});
    } else if (ph === 'verdict') {
      if (rounds === 1) await mac.screenshot({ path: 'shots/mafia-mac-verdict.png' });
      for (const [k, { p }] of phones.entries()) if (s.alive[k] && k !== s.accused) await tap(p, '#view [data-act="verdict"][data-v="g"]:not(.on)');
    }
    await mac.waitForTimeout(400);
    if (rounds > 6) { console.log('BAD the game should have ended by now'); break; }
  }
  await mac.waitForSelector('#endModal:not([hidden])', { timeout: 60000 });
  const head = await mac.textContent('#endBody .mf-head');
  console.log('end:', head, '|', (await mac.textContent('#endTitle')).trim());
  bad(/town wins/i.test(head), 'the town voted out the whole family');
  await mac.screenshot({ path: 'shots/mafia-mac-end.png' });
  const lb = (await mac.textContent('#leaderboard')).replace(/\s+/g, ' ');
  bad(/Survived/.test(lb), 'the leaderboard has a Survived column');
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
