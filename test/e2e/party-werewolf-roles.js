const H = require('./helpers');
const { setup } = require('./party-setup');
// The role picker's levels, and the newer roles played from real phones: the Troublemaker not swapping, the Sentinel's
// shield, the Doppelgänger copying the Seer, the Revealer's face-up card. Prints BAD on anything unexpected.
(async () => {
  const T = await setup('werewolf', ['Ana', 'Bob', 'Cy', 'Dee']);
  const { mac, phones, errs } = T;
  const [ana, bob, cy] = phones.map(x => x.p);
  const bad = (cond, what) => { if (!cond) console.log('BAD', what); };

  // the role picker: levels, descriptions, and ticking a role changes the options
  const groups = await mac.$$eval('#opts .opt-group-title', e => e.map(x => x.textContent));
  console.log('role groups:', groups.join(', '));
  bad(groups.join() === 'Beginner,Intermediate,Advanced', 'three role groups');
  bad(await mac.$$eval('#opts .opt-fixed', e => e.length) === 5, 'the 5 always-in Beginner roles are shown');
  // hovering (or tabbing to) a role shows its full rules in a card that stays on screen
  const tipFor = async (sel, how = 'hover') => {
    if (how === 'hover') await mac.hover(sel); else await mac.focus(sel);
    await mac.waitForTimeout(150);
    return mac.evaluate(() => { const t = document.getElementById('optTip'), r = t.getBoundingClientRect();
      return { shown: !t.hidden, text: t.textContent.replace(/\s+/g, ' ').trim(), inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
  };
  for (const [sel, expect] of [['#opts label:has(input[value="doppelganger"])', /Doppelgänger.*Advanced.*Night: At the very start.*exact order.*copied/],
    ['#opts label:has(input[value="pi"])', /Paranormal Investigator.*up to two/], ['#opts label:has(input[value="dreamwolf"])', /Dream Wolf.*Doesn't wake/],
    ['#opts .opt-fixed[data-tip-v="troublemaker"]', /Troublemaker.*Beginner.*Don't swap/]]) {
    const t = await tipFor(sel);
    console.log('hover', sel.match(/"(\w+)"/)[1], '→', t.shown, t.inView, t.text.slice(0, 70) + '…');
    bad(t.shown && t.inView && expect.test(t.text), 'hover card for ' + sel);
  }
  await mac.mouse.move(5, 5); await mac.waitForTimeout(150);
  bad(await mac.evaluate(() => document.getElementById('optTip').hidden), 'hover card hides when the mouse leaves');
  const kb = await tipFor('#opts input[value="witch"]', 'focus');
  console.log('keyboard focus witch →', kb.shown, kb.text.slice(0, 50) + '…');
  bad(kb.shown && /Witch/.test(kb.text), 'hover card on keyboard focus');
  await mac.screenshot({ path: 'shots/ww-role-tip.png' });
  await mac.evaluate(() => document.activeElement.blur());
  await mac.check('#opts input[value="doppelganger"]'); await mac.check('#opts input[value="drunk"]');
  // the lobby's night order follows the roles ticked
  const order = await mac.$$eval('#lobbyInfo .ww-order .p', e => e.map(x => x.textContent.trim()));
  console.log('night order in the lobby:', order.join(' → '));
  // 4 players = 7 cards: room for 2 extras, so the two hardest ticked (Doppelgänger, Insomniac) are left out, and it says so
  bad(order.join() === '🐺 Werewolves,🦹 Minion,🔮 Seer,🦝 Robber,😈 Troublemaker,🍺 Drunk', 'lobby night order');
  const leftOut = await mac.textContent('#lobbyInfo .ww-left');
  console.log('lobby note:', leftOut.trim());
  bad(/4 players, left out: .*Insomniac.*Doppelgänger/.test(leftOut), 'roles that don\'t fit are named');
  await mac.uncheck('#opts input[value="drunk"]'); await mac.waitForTimeout(100);
  bad(!(await mac.textContent('#lobbyInfo')).includes('Drunk'), 'unticking a role removes it from the order');
  await mac.check('#opts input[value="drunk"]');
  const extras = await mac.evaluate(() => P.opts.extras.join(','));
  console.log('extras after ticking:', extras);
  bad(/doppelganger/.test(extras) && /drunk/.test(extras), 'ticked roles reach the options');

  await mac.click('#startBtn'); await mac.waitForFunction(() => P.ctx?.state);
  // drive single night steps by hand with a known deal
  const fresh = (cards, step, extra = {}) => mac.evaluate(([cards, step, extra]) => {
    if (P.ctx) { P.ctx.alive = false; P.ctx.clear?.(); }
    const live = makeCtx(); live.players = P.seats.map((s, i) => ({ i, name: s.name, color: s.color, device: s.device })); P.ctx = live; P.phase = 'game';
    live.state = Object.assign({ deck: cards.slice(), cards: cards.slice(), start: cards.slice(0, 4), phase: 'night', step, done: new Set(), notes: [[], [], [], []], nightLog: [],
      ready: new Set(), votes: {}, talk: 300, actionTime: 15, voteTime: 60, shields: [], dop: null, becomes: {}, revealed: {}, witch: {}, pi: {}, alphaCard: null }, extra);
    render();
  }, [cards, step, extra]);
  const notes = p => p.evaluate(() => ST.view.notes.join(' | '));
  const state = f => mac.evaluate(f);

  // Troublemaker: Don't swap
  await fresh(['troublemaker', 'seer', 'werewolf', 'villager', 'robber', 'werewolf', 'drunk'], 'troublemaker'); await ana.waitForTimeout(600);
  await ana.click('#view [data-act="swap"][data-ps="none"]'); await ana.waitForTimeout(500);
  const tm = await state(() => [P.ctx.state.cards.slice(0, 4).join(','), P.ctx.state.done.has(0), P.ctx.state.nightLog.join(' ')]);
  console.log("Troublemaker, Don't swap →", await notes(ana), '| cards', tm[0], '| log:', tm[2]);
  bad(tm[0] === 'troublemaker,seer,werewolf,villager' && tm[1] && /chose not to swap/.test(tm[2]), 'troublemaker did not swap');
  // and a real swap still works
  await fresh(['troublemaker', 'seer', 'werewolf', 'villager', 'robber', 'werewolf', 'drunk'], 'troublemaker'); await ana.waitForTimeout(600);
  await ana.click('#view [data-local="pp"][data-p="1"]'); await ana.click('#view [data-local="pp"][data-p="2"]');
  await ana.click('#view [data-act="swap"]:not([data-ps="none"])'); await ana.waitForTimeout(500);
  const sw = await state(() => P.ctx.state.cards.slice(0, 4).join(','));
  console.log('Troublemaker swaps Bob and Cy →', sw); bad(sw === 'troublemaker,werewolf,seer,villager', 'troublemaker swap');

  // Sentinel shields Cy; then the Robber can't pick Cy
  await fresh(['sentinel', 'robber', 'seer', 'villager', 'werewolf', 'werewolf', 'drunk'], 'sentinel'); await ana.waitForTimeout(600);
  await ana.click('#view [data-act="shield"][data-p="2"]'); await ana.waitForTimeout(400);
  await mac.evaluate(() => { P.ctx.state.step = 'robber'; P.ctx.state.done = new Set(); render(); }); await bob.waitForTimeout(700);
  const cyBtn = await bob.$eval('#view [data-act="rob"][data-p="2"]', b => [b.disabled, b.textContent]);
  console.log('Robber sees the shielded Cy as:', cyBtn);
  bad(cyBtn[0] && /🗿/.test(cyBtn[1]), 'shielded card greyed out for the Robber');

  // Doppelgänger copies the Seer and looks right away
  await fresh(['doppelganger', 'seer', 'werewolf', 'villager', 'robber', 'werewolf', 'drunk'], 'doppelganger'); await ana.waitForTimeout(600);
  await ana.click('#view [data-act="dopple"][data-p="1"]'); await ana.waitForTimeout(600);
  const head = await ana.textContent('#view .ww-awake');
  console.log('Doppelgänger after copying:', head.trim());
  bad(/Doppelgänger \(as Seer\)/.test(head), 'doppelgänger heading');
  await ana.click('#view [data-act="seer"][data-p="2"]'); await ana.waitForTimeout(500);
  console.log('   then →', await notes(ana));
  bad(/You are now the Seer/.test(await notes(ana)) && /Cy's card is 🐺 Werewolf/.test(await notes(ana)), 'doppel-seer looked');

  // Revealer: the card shows face up on the Mac and the phones in the day
  await fresh(['revealer', 'seer', 'werewolf', 'villager', 'robber', 'werewolf', 'drunk'], 'revealer'); await ana.waitForTimeout(600);
  await ana.click('#view [data-act="reveal"][data-p="1"]'); await ana.waitForTimeout(400);
  await mac.evaluate(() => { P.ctx.state.phase = 'day'; P.ctx.state.step = null; render(); }); await cy.waitForTimeout(800);
  const macUp = await mac.textContent('body'), cyUp = await cy.textContent('#view');
  console.log('face up in the day: Mac', /Bob: 🔮 Seer/.test(macUp), '| Cy\'s phone', /Bob: 🔮 Seer/.test(cyUp));
  bad(/Bob: 🔮 Seer/.test(macUp) && /Bob: 🔮 Seer/.test(cyUp), 'revealed card shown');

  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
