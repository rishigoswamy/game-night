const H = require('./helpers');
const { setup } = require('./party-setup');
const cases = [
  ['Hunter dies and takes the werewolf', ['hunter', 'werewolf', 'seer', 'villager', 'robber'], [1, 0, 0, 0, 0], 'The village wins!'],
  ['Tanner is voted out, wolf survives', ['tanner', 'werewolf', 'seer', 'villager', 'robber'], [1, 0, 0, 0, 0], 'The Tanner got their wish!'],
  ['No werewolf among players, nobody dies', ['seer', 'robber', 'villager', 'villager', 'troublemaker'], [1, 2, 3, 4, 0], 'The village wins!'],
  ['No werewolf, minion makes them kill a villager', ['minion', 'robber', 'villager', 'seer', 'troublemaker'], [2, 2, 3, 2, 2], 'The werewolves win!'],
  ['Wolves survive, villager dies', ['villager', 'werewolf', 'seer', 'minion', 'robber'], [1, 0, 0, 0, 0], 'The werewolves win!'],
];
(async () => {
  const T = await setup('werewolf', ['Ana', 'Bob', 'Cy', 'Dee', 'Eli']);
  const { mac, errs } = T;
  for (const [title, cards, votes, expect] of cases) {
    await mac.evaluate(() => { if (P.phase !== 'lobby') stopGame(); });
    await mac.click('#startBtn');
    await mac.waitForFunction(() => P.ctx?.state);
    const r = await mac.evaluate(({ cards, votes }) => {
      const ctx = P.ctx, st = ctx.state;
      ctx.alive = false; ctx.clear?.();                        // stop the timed flow; drive the vote by hand
      const live = makeCtx(); Object.assign(live, { players: ctx.players, logLines: [] }); P.ctx = live;
      live.state = { ...st, cards: [...cards, 'werewolf', 'villager', 'villager'], start: cards.slice(), phase: 'vote', votes: {}, nightLog: [], ready: new Set(), done: new Set(), notes: ctx.players.map(() => []) };
      votes.forEach((t, i) => PARTY_GAME.act(live, i, { act: 'vote', p: t })); live.skipNext = false; PARTY_GAME._reveal(live);
      return { head: document.querySelector('#endBody .ww-head')?.textContent, winners: document.querySelector('#endTitle').textContent };
    }, { cards, votes });
    // the votes ended the countdown early once everyone voted; wait for the reveal
    await mac.waitForSelector('#endModal:not([hidden])', { timeout: 5000 }).catch(() => {});
    const head = await mac.textContent('#endBody .ww-head').catch(() => '(no reveal)');
    console.log(`${head === expect ? 'OK ' : 'BAD'} ${title}: ${head} | ${await mac.textContent('#endTitle')}`);
    void r;
  }
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
