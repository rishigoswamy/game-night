const H = require('./helpers');
const { setup } = require('./party-setup');
// Tambola's other modes, on real phones: automatic claims with 3 tickets each and a Second Full House; a phone that
// reloads mid-game keeps its tickets and marks; automatic marking; "End game" stops early without recording anything.
// Prints BAD on anything unexpected.
(async () => {
  const T = await setup('tambola', ['Ana', 'Bob', 'Cy']);
  const { mac, phones, errs } = T;
  const bad = (cond, what) => { if (!cond) console.log('BAD', what); };
  // the caller's voice is tested elsewhere (dealer-voice); here each call takes 0.1 s so the game is quick
  const fastVoice = () => mac.evaluate(() => { window.say = t => { document.querySelector('#bubble').textContent = t; send({ type: 'say', text: t }); return new Promise(r => setTimeout(r, 100)); }; });
  await fastVoice();

  // the prize options carry their rules on hover
  await mac.hover('#opts label:has(input[value="corners"])'); await mac.waitForTimeout(150);
  const tip = await mac.evaluate(() => !document.getElementById('optTip').hidden && document.getElementById('optTip').textContent);
  console.log('hover Four Corners →', tip);
  bad(/first and last numbers of the top and bottom lines/.test(tip || ''), 'prize rules on hover');

  // 1. automatic claims, players mark by hand, 3 tickets each, every prize including the Second Full House
  await mac.check('#opts input[value="full2"]');
  await mac.selectOption('#opt-tickets', '3'); await mac.selectOption('#opt-gap', '3'); await mac.selectOption('#opt-claims', 'auto');
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state?.called.length > 0, null, { timeout: 15000 });
  const ana = phones[0].p;
  await ana.waitForSelector('#view .tb-grid');
  const tickets = await ana.$$eval('#view .tb-grid', g => g.length);
  const claimButtons = await ana.$$eval('#view [data-act="claim"]', b => b.length);
  console.log('Ana has', tickets, 'tickets | claim buttons:', claimButtons, '|', (await ana.textContent('#view')).includes('claimed automatically'));
  bad(tickets === 3 && claimButtons === 0, 'three tickets and no claim buttons in automatic mode');
  for (let k = 0; k < 12; k++) { await mac.click('#stage [data-host="next"]').catch(() => {}); await mac.waitForTimeout(200); }
  // Ana marks the numbers called that are on her tickets
  const v = await ana.evaluate(() => ST.view);
  const toMark = v.tickets.flat(2).filter(n => n && v.called.includes(n));
  for (const n of toMark) await ana.click(`#view [data-act="mark"][data-n="${n}"]`);
  await ana.waitForTimeout(400);
  const before = { nums: JSON.stringify(v.tickets), marks: await ana.$$eval('#view .tb-grid .mk', m => m.map(x => x.textContent).sort().join(',')) };
  // her phone reloads (e.g. the screen locked): same tickets, same marks
  await ana.reload(); await ana.waitForSelector('#view .tb-grid', { timeout: 15000 });
  await ana.waitForTimeout(500);
  const after = { nums: JSON.stringify(await ana.evaluate(() => ST.view.tickets)), marks: await ana.$$eval('#view .tb-grid .mk', m => m.map(x => x.textContent).sort().join(',')) };
  console.log(`Ana marked ${toMark.length} numbers, reloaded → same tickets: ${before.nums === after.nums} | same marks: ${before.marks === after.marks} (${after.marks})`);
  bad(toMark.length > 0 && before.nums === after.nums && before.marks === after.marks, 'a reloaded phone keeps its tickets and marks');
  // play on until the end: the Mac finds every winner by itself
  for (let k = 0; k < 120 && !(await mac.isVisible('#endModal')); k++) { await mac.click('#stage [data-host="next"]').catch(() => {}); await mac.waitForTimeout(150); }
  await mac.waitForSelector('#endModal:not([hidden])', { timeout: 30000 });
  const st = await mac.evaluate(() => ({ called: P.ctx.state.called.slice(), prizes: P.ctx.state.prizes, tickets: P.ctx.state.tickets }));
  const won = Object.fromEntries(Object.entries(st.prizes).map(([k, p]) => [k, p.wins.length]));
  console.log('numbers called:', st.called.length, '| prizes won:', JSON.stringify(won));
  bad(Object.values(won).every(n => n >= 1), 'every prize found automatically, Second Full House included');
  // independent check: each automatic win completed exactly on the number it was awarded
  const full = (t, upto) => t.flat().filter(Boolean).every(n => st.called.slice(0, upto).includes(n));
  for (const key of ['full', 'full2']) for (const w of st.prizes[key].wins) {
    const t = st.tickets[w.i][w.t];
    bad(full(t, st.prizes[key].at) && !full(t, st.prizes[key].at - 1), `${key} awarded on the number that completed it`);
  }
  bad(st.prizes.full2.at > st.prizes.full.at, 'the Second Full House came after the Full House');
  const games = async () => mac.evaluate(() => JSON.parse(localStorage.getItem('gn-leaderboard') || '[]').filter(e => e.game === 'tambola').length);
  const recorded = await games();
  console.log('Mac end:', (await mac.textContent('#endTitle')).trim(), '| leaderboard entries:', recorded);
  bad(recorded === 3, 'the finished game is recorded for the 3 players');

  // 2. automatic marking: phones mark the numbers themselves; then "End game" stops early and records nothing
  await mac.click('#toLobbyBtn');
  await mac.selectOption('#opt-marking', 'auto'); await mac.selectOption('#opt-claims', 'manual'); await mac.selectOption('#opt-tickets', '1');
  await fastVoice();
  await mac.click('#startBtn');
  await mac.waitForFunction(() => P.ctx?.state?.called.length > 0, null, { timeout: 15000 });
  for (let k = 0; k < 15; k++) { await mac.click('#stage [data-host="next"]').catch(() => {}); await mac.waitForTimeout(200); }
  await ana.waitForTimeout(500);
  const m = await ana.evaluate(() => ({ called: ST.view.called, nums: ST.view.tickets.flat(2).filter(Boolean) }));
  const shown = await ana.$$eval('#view .tb-grid .mk', e => e.map(x => +x.textContent).sort((a, b) => a - b));
  const expected = m.nums.filter(n => m.called.includes(n)).sort((a, b) => a - b);
  const markButtons = await ana.$$eval('#view [data-act="mark"]', b => b.length);
  console.log('auto-marked on Ana\'s phone:', shown.join(','), '| expected:', expected.join(','), '| tap-to-mark buttons:', markButtons);
  bad(JSON.stringify(shown) === JSON.stringify(expected) && markButtons === 0, 'numbers marked automatically');
  await mac.click('#endBtn'); await mac.click('#confirmYes');
  await mac.waitForSelector('#lobbyView:not([hidden])');
  console.log('End game → back in the lobby | leaderboard entries:', await games());
  bad((await games()) === recorded, 'a game ended early is not recorded');
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
