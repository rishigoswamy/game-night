const H = require('./helpers');
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('werewolf', ['Ana', 'Bob', 'Cy']);
  const { mac, phones, errs } = T;
  const ana = phones[0].p;
  await mac.click('#startBtn'); await mac.waitForFunction(() => P.ctx?.state);
  // drive the Robber's step by hand: Ana is the Robber, Bob a Werewolf, Cy the Seer
  const fresh = () => mac.evaluate(() => {
    if (P.ctx) { P.ctx.alive = false; P.ctx.clear?.(); }
    const live = makeCtx(); live.players = P.seats.map((s, i) => ({ i, name: s.name, color: s.color, device: s.device })); P.ctx = live; P.phase = 'game';
    const cards = ['robber', 'werewolf', 'seer', 'villager', 'werewolf', 'troublemaker'];
    live.state = { deck: cards.slice(), cards, start: cards.slice(0, 3), phase: 'night', step: 'robber', done: new Set(), notes: [[], [], []], nightLog: [], ready: new Set(), votes: {}, talk: 300, actionTime: 15, voteTime: 60 };
    render();
  });
  const notes = () => ana.evaluate(() => ST.view.notes.join(' | '));
  const buttons = () => ana.$$eval('#view [data-act]', b => b.map(x => x.textContent.trim()).join(' / '));
  const cardsNow = () => mac.evaluate(() => P.ctx.state.cards.slice(0, 3).join(','));

  await fresh(); await ana.waitForTimeout(600);
  console.log('Robber sees:', await buttons());
  await ana.click('#view [data-act="rob"][data-p="none"]'); await ana.waitForTimeout(600);
  console.log('A) Don\'t swap →', await notes(), '| cards', await cardsNow(), '| done:', await mac.evaluate(() => P.ctx.state.done.has(0)), '| night log:', await mac.evaluate(() => P.ctx.state.nightLog.join(' ')));

  await fresh(); await ana.waitForTimeout(600);
  await ana.click('#view [data-act="rob"][data-p="1"]'); await ana.waitForTimeout(600);
  console.log('B) Swap with Bob → note:', await notes(), '| cards', await cardsNow(), '| buttons now:', await buttons());
  console.log('   second swap →', await mac.evaluate(() => PARTY_GAME.act(P.ctx, 0, { act: 'rob', p: 2 })));
  await ana.click('#view [data-act="roblook"]:not([data-skip])'); await ana.waitForTimeout(600);
  console.log('   Look →', await notes(), '| done:', await mac.evaluate(() => P.ctx.state.done.has(0)));

  await fresh(); await ana.waitForTimeout(600);
  await ana.click('#view [data-act="rob"][data-p="2"]'); await ana.waitForTimeout(600);
  await ana.click('#view [data-act="roblook"][data-skip="1"]'); await ana.waitForTimeout(600);
  console.log('C) Swap with Cy, don\'t look →', await notes(), '| cards', await cardsNow(), '| new card shown anywhere?', /Seer/.test(await notes()));
  await fresh(); await mac.waitForTimeout(300);
  console.log('   look before swapping (fresh) →', await mac.evaluate(() => PARTY_GAME.act(P.ctx, 0, { act: 'roblook' })));
  await ana.screenshot({ path: 'shots/robber.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
