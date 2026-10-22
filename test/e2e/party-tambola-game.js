const H = require('./helpers');
const { setup } = require('./party-setup');
// A whole Tambola game with three phones: options on the Mac, marking numbers and claiming prizes by tapping on the
// phones (one wrong claim on purpose), the caller's Pause / Next buttons, the end and the leaderboard.
// Prints BAD on anything unexpected.
(async () => {
  const T = await setup('tambola', ['Ana', 'Bob', 'Cy']);
  const { mac, phones, errs } = T;
  const bad = (cond, what) => { if (!cond) console.log('BAD', what); };
  // the caller's voice is tested elsewhere (dealer-voice); here each call takes 0.1 s so the game is quick
  await mac.evaluate(() => { window.say = t => { document.querySelector('#bubble').textContent = t; send({ type: 'say', text: t }); return new Promise(r => setTimeout(r, 100)); }; });

  // options: 2 tickets each, every prize but the Second Full House, wrong claims put you out of that prize
  await mac.selectOption('#opt-tickets', '2'); await mac.selectOption('#opt-gap', '3'); await mac.selectOption('#opt-bogus', 'bar');
  console.log('prize choices:', (await mac.$$eval('#opts input[data-opt="prizes"]', i => i.map(x => x.value + (x.checked ? '✓' : '')))).join(' '));
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state?.called.length > 0, null, { timeout: 15000 });
  const ana = phones[0].p;
  await ana.waitForSelector('#view .tb-grid');
  const grids = await Promise.all(phones.map(x => x.p.$$eval('#view .tb-grid', g => g.map(e => [...e.children].filter(c => c.textContent).length))));
  console.log('numbers on each phone\'s tickets:', JSON.stringify(grids));
  bad(grids.every(g => g.length === 2 && g.every(n => n === 15)), 'two tickets of 15 numbers on every phone');
  const mine = await Promise.all(phones.map(x => x.p.evaluate(() => ST.view.tickets.flat(2).filter(Boolean))));
  bad(mine.every(m => new Set(m).size === 30), 'a player\'s two tickets share no number');

  // a wrong claim on purpose: Cy claims Full House straight away
  await phones[2].p.click('#view [data-act="claim"][data-prize="full"]');
  await mac.waitForTimeout(500);
  const wrong = await mac.textContent('#stage .tb-bad').catch(() => '');
  const cyFull = await phones[2].p.$('#view [data-act="claim"][data-prize="full"]');
  console.log('wrong claim → Mac shows:', wrong.trim(), '| Cy can still claim Full House:', !!cyFull);
  bad(/Cy: wrong claim for Full House/.test(wrong) && !cyFull, 'wrong claim announced and Cy is out of the Full House');

  // the caller pauses and resumes
  await mac.click('#stage [data-host="pause"]'); await mac.waitForTimeout(300);
  const paused = await mac.evaluate(() => [P.ctx.state.paused, document.querySelector('#stage [data-host="next"]').disabled]);
  await mac.click('#stage [data-host="pause"]'); await mac.waitForTimeout(300);
  console.log('pause → paused, Next disabled:', paused, '| resumed:', !(await mac.evaluate(() => P.ctx.state.paused)));
  bad(paused[0] && paused[1] && !(await mac.evaluate(() => P.ctx.state.paused)), 'pause and resume');

  // play: each phone marks the numbers called that are on its tickets and claims every prize it completes
  const PRIZES = ['early5', 'top', 'middle', 'bottom', 'corners', 'full'];
  const done = (key, t, has) => {
    const nums = t.flat().filter(Boolean), row = r => t[r].filter(Boolean);
    const c = [row(0)[0], row(0)[4], row(2)[0], row(2)[4]];
    return key === 'early5' ? nums.filter(has).length >= 5 : key === 'top' ? row(0).every(has) : key === 'middle' ? row(1).every(has)
      : key === 'bottom' ? row(2).every(has) : key === 'corners' ? c.every(has) : nums.every(has);
  };
  let marks = 0, claims = 0;
  for (let round = 0; round < 120 && !(await mac.isVisible('#endModal')); round++) {
    for (const { p, name } of phones) {
      const v = await p.evaluate(() => ST?.view).catch(() => null);
      if (!v || !v.tickets) continue;
      const has = n => v.called.includes(n);
      for (const n of v.tickets.flat(2).filter(x => x && has(x) && !v.marks.includes(x)).slice(0, 3)) {
        const b = p.locator(`#view [data-act="mark"][data-n="${n}"]`);
        if (await b.count()) { await b.first().click(); marks++; }
      }
      for (const key of PRIZES) {
        const pz = v.prizes.find(x => x.key === key);
        if (!pz || pz.winners.length || pz.barred || !v.tickets.some(t => done(key, t, has))) continue;
        const b = p.locator(`#view [data-act="claim"][data-prize="${key}"]`);
        if (await b.count()) { await b.click(); claims++; console.log(`   ${name} claims ${key} on number ${v.count}`); }
      }
    }
    if (!(await mac.isVisible('#endModal'))) await mac.click('#stage [data-host="next"]').catch(() => {});
    await mac.waitForTimeout(250);
  }
  await mac.waitForSelector('#endModal:not([hidden])', { timeout: 30000 });
  const st = await mac.evaluate(() => ({ called: P.ctx.state.called.length, prizes: Object.fromEntries(Object.entries(P.ctx.state.prizes).map(([k, p]) => [k, p.wins.length])),
    marks: P.ctx.state.marks.map(m => m.length) }));
  console.log('numbers called:', st.called, '| prizes won:', JSON.stringify(st.prizes), '| marks on the Mac:', st.marks.join(','), '| taps:', marks, 'claims:', claims);
  bad(Object.values(st.prizes).every(n => n >= 1), 'every prize was won');
  const wins = Object.values(st.prizes).reduce((x, y) => x + y, 0);
  bad(wins === claims, `every good claim counted, shares included (${claims} claims, ${wins} wins)`);
  bad(st.marks.reduce((a, b) => a + b, 0) === marks, 'every mark tapped on a phone reached the Mac');
  const end = (await mac.textContent('#endBody')).replace(/\s+/g, ' ').trim();
  console.log('Mac end:', (await mac.textContent('#endTitle')).trim(), '|', end.slice(0, 160) + '…');
  bad(/Full House/.test(end) && /prizes/.test(end), 'end screen lists the prizes');
  await phones[1].p.waitForSelector('#endPanel:not([hidden])');
  console.log('phone end:', (await phones[1].p.textContent('#endTitle')).trim());
  await mac.click('#toLobbyBtn');
  const lb = (await mac.textContent('#leaderboard')).replace(/\s+/g, ' ').trim();
  console.log('Mac leaderboard:', lb.slice(0, 160));
  bad(/Prizes/.test(lb), 'leaderboard shows a Prizes column');
  await mac.goto(`http://localhost:${H.PORT}/party.html`);
  const cards = await mac.$$eval('a.game h2', h => h.map(x => x.textContent));
  console.log('party lobby cards:', cards.join(', '));
  bad(cards.includes('Tambola'), 'Tambola card in the party lobby');
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
