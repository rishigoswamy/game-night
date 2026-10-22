// One Night Werewolf rules (public/games/party/werewolf.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain, partyCtx } = require('./helpers');

const load = () => loadScripts(['games/party/common.js', 'games/party/werewolf.js']).PARTY_GAME;
// A game in a given moment: roles[i] = player i's starting card, then the three center cards
function ww(roles, { phase = 'night', step = null, cards } = {}) {
  const G = load(), n = roles.length - 3, ctx = partyCtx(n);
  ctx.state = { deck: roles.slice(), cards: (cards || roles).slice(), start: roles.slice(0, n), phase, step, done: new Set(),
    notes: [...Array(n)].map(() => []), nightLog: [], ready: new Set(), votes: {}, talk: 300, actionTime: 15, voteTime: 60 };
  return { G, ctx, st: ctx.state };
}
const notes = (st, i) => st.notes[i].join(' ');

test('deck: always players + 3 cards with 2 werewolves, Seer, Robber, Troublemaker', () => {
  const { buildDeck } = load()._test;
  const all = ['minion', 'mason', 'drunk', 'insomniac', 'hunter', 'tanner'];
  for (let n = 3; n <= 10; n++) for (const extras of [[], ['minion'], all]) {
    const deck = plain(buildDeck(n, extras));
    assert.equal(deck.length, n + 3, `${n} players, extras ${extras}`);
    assert.equal(deck.filter(r => r === 'werewolf').length, 2);
    for (const r of ['seer', 'robber', 'troublemaker']) assert.ok(deck.includes(r));
    assert.ok([0, 2].includes(deck.filter(r => r === 'mason').length), 'masons come in pairs');
  }
});

test('deck: extras that don\'t fit are dropped from the end of the list; villagers fill the rest', () => {
  const { buildDeck } = load()._test;
  assert.deepEqual(plain(buildDeck(3, ['minion', 'mason', 'drunk', 'insomniac', 'hunter', 'tanner'])).sort(),
    ['minion', 'robber', 'seer', 'troublemaker', 'werewolf', 'werewolf']);
  assert.deepEqual(plain(buildDeck(5, ['minion'])).sort(), ['minion', 'robber', 'seer', 'troublemaker', 'villager', 'villager', 'werewolf', 'werewolf']);
});

test('night: only your starting role acts, only during its step, only once', () => {
  const { G, ctx, st } = ww(['seer', 'robber', 'werewolf', 'villager', 'werewolf', 'troublemaker'], { step: 'seer' });
  assert.equal(G.act(ctx, 1, { act: 'rob', p: 0 }), 'Not now.', 'the Robber must wait for its step');
  assert.equal(G.act(ctx, 0, { act: 'seer', p: 1 }), undefined);
  assert.match(notes(st, 0), /Bob's card is 🦝 Robber/);
  assert.equal(G.act(ctx, 0, { act: 'seer', p: 2 }), 'Not now.', 'one action per night');
  st.phase = 'day';
  assert.equal(G.act(ctx, 0, { act: 'seer', p: 2 }), 'Not now.', 'no night actions in the day');
});

test('seer: one other player, or two different center cards', () => {
  const { G, ctx, st } = ww(['seer', 'villager', 'villager', 'werewolf', 'tanner', 'werewolf'], { step: 'seer' });
  assert.match(G.act(ctx, 0, { act: 'seer', p: 0 }), /another player/);
  assert.match(G.act(ctx, 0, { act: 'seer', c: '1,1' }), /two center cards/);
  assert.equal(G.act(ctx, 0, { act: 'seer', c: '0,2' }), undefined);
  assert.match(notes(st, 0), /left center card is 🐺 Werewolf.*right center card is 🐺 Werewolf/);
});

test('robber: may not swap; or swaps, then may look or not; never twice', () => {
  // don't swap
  let { G, ctx, st } = ww(['robber', 'werewolf', 'seer', 'villager', 'villager', 'troublemaker'], { step: 'robber' });
  G.act(ctx, 0, { act: 'rob', p: 'none' });
  assert.deepEqual(plain(st.cards.slice(0, 3)), ['robber', 'werewolf', 'seer']);
  assert.ok(st.done.has(0));
  // swap, then look
  ({ G, ctx, st } = ww(['robber', 'werewolf', 'seer', 'villager', 'villager', 'troublemaker'], { step: 'robber' }));
  assert.equal(G.act(ctx, 0, { act: 'roblook' }), 'Swap first.');
  G.act(ctx, 0, { act: 'rob', p: 1 });
  assert.deepEqual(plain(st.cards.slice(0, 2)), ['werewolf', 'robber']);
  assert.doesNotMatch(notes(st, 0), /Werewolf/, 'the new card stays hidden until the Robber looks');
  assert.match(G.act(ctx, 0, { act: 'rob', p: 2 }), /already swapped/);
  G.act(ctx, 0, { act: 'roblook' });
  assert.match(notes(st, 0), /Your new card is 🐺 Werewolf/);
  assert.ok(st.done.has(0));
  // swap, don't look
  ({ G, ctx, st } = ww(['robber', 'werewolf', 'seer', 'villager', 'villager', 'troublemaker'], { step: 'robber' }));
  G.act(ctx, 0, { act: 'rob', p: 2 });
  G.act(ctx, 0, { act: 'roblook', skip: '1' });
  assert.doesNotMatch(notes(st, 0), /Seer/);
  assert.equal(st.cards[0], 'seer');
});

test('troublemaker swaps two other players; drunk swaps blind with the center', () => {
  let { G, ctx, st } = ww(['troublemaker', 'werewolf', 'seer', 'villager', 'robber', 'werewolf'], { step: 'troublemaker' });
  assert.match(G.act(ctx, 0, { act: 'swap', ps: '0,1' }), /two other players/);
  assert.match(G.act(ctx, 0, { act: 'swap', ps: '1,1' }), /two other players/);
  G.act(ctx, 0, { act: 'swap', ps: '1,2' });
  assert.deepEqual(plain(st.cards.slice(0, 3)), ['troublemaker', 'seer', 'werewolf']);
  ({ G, ctx, st } = ww(['drunk', 'werewolf', 'seer', 'villager', 'robber', 'werewolf'], { step: 'drunk' }));
  G.act(ctx, 0, { act: 'drunk', c: 1 });
  assert.equal(st.cards[0], 'robber'); assert.equal(st.cards[4], 'drunk');
  assert.doesNotMatch(notes(st, 0), /Robber/, 'the Drunk does not see the new card');
});

test('a lone werewolf may peek at one center card; two werewolves may not', () => {
  let { G, ctx, st } = ww(['werewolf', 'seer', 'villager', 'werewolf', 'robber', 'troublemaker'], { step: 'werewolf' });
  G.act(ctx, 0, { act: 'peek', c: 1 });
  assert.match(notes(st, 0), /middle center card is 🦝 Robber/);
  ({ G, ctx, st } = ww(['werewolf', 'werewolf', 'villager', 'seer', 'robber', 'troublemaker'], { step: 'werewolf' }));
  assert.match(G.act(ctx, 0, { act: 'peek', c: 1 }), /Only a lone werewolf/);
});

test('voting: only while voting is open, never for yourself', () => {
  const { G, ctx, st } = ww(['villager', 'werewolf', 'seer', 'robber', 'werewolf', 'troublemaker'], { phase: 'day' });
  assert.match(G.act(ctx, 0, { act: 'vote', p: 1 }), /not open/);
  st.phase = 'vote';
  assert.match(G.act(ctx, 0, { act: 'vote', p: 0 }), /another player/);
  assert.equal(G.act(ctx, 0, { act: 'vote', p: 1 }), undefined);
  assert.equal(G.act(ctx, 0, { act: 'vote', p: 2 }), undefined, 'a vote can be changed');
  assert.deepEqual(plain(st.votes), { 0: 2 });
});

// reveal(): votes are { voter: target }. The list is the players' final cards then the 3 center cards,
// so 6 cards = 3 players, 7 cards = 4 players.
function verdict(final, votes) {
  const { G, ctx, st } = ww(final, { phase: 'vote' });
  st.votes = votes;
  G._test.reveal(ctx);
  const html = ctx.ended.html;
  return { headline: /<div class="ww-head">(.*?)<\/div>/.exec(html)[1], winners: plain(ctx.ended.results.filter(r => r.won).map(r => r.name)),
    dead: plain(ctx.ended.results.filter(r => /died/.test(r.note)).map(r => r.name)) };
}
test('endings: a werewolf dies → the village wins', () => {
  const v = verdict(['villager', 'werewolf', 'seer', 'robber', 'troublemaker', 'werewolf'], { 0: 1, 1: 0, 2: 1 });
  assert.deepEqual(v.dead, ['Bob']);
  assert.equal(v.headline, 'The village wins!');
  assert.deepEqual(v.winners, ['Ana', 'Cy']);
});
test('endings: no werewolf dies → werewolves (and the minion) win', () => {
  const v = verdict(['villager', 'werewolf', 'minion', 'seer', 'robber', 'troublemaker', 'werewolf'], { 1: 0, 2: 0, 3: 1, 0: 3 });
  assert.deepEqual(v.dead, ['Ana']);
  assert.equal(v.headline, 'The werewolves win!');
  assert.deepEqual(v.winners, ['Bob', 'Cy']);
});
test('endings: nobody gets more than one vote → nobody dies', () => {
  const v = verdict(['villager', 'werewolf', 'seer', 'robber', 'troublemaker', 'werewolf'], { 0: 1, 1: 2, 2: 0 });
  assert.deepEqual(v.dead, []);
  assert.equal(v.headline, 'The werewolves win!', 'a werewolf is among the players and survived');
});
test('endings: a tie for most votes kills everyone tied', () => {
  const v = verdict(['villager', 'villager', 'werewolf', 'seer', 'robber', 'troublemaker', 'werewolf'], { 0: 2, 1: 2, 2: 0, 3: 0 });
  assert.deepEqual(v.dead, ['Ana', 'Cy']);
  assert.equal(v.headline, 'The village wins!');
});
test('endings: the Hunter takes the player they voted for', () => {
  const v = verdict(['hunter', 'werewolf', 'seer', 'robber', 'troublemaker', 'werewolf'], { 0: 1, 1: 0, 2: 0 });
  assert.deepEqual(v.dead, ['Ana', 'Bob']);
  assert.equal(v.headline, 'The village wins!');
});
test('endings: the Tanner wins by dying, and then the werewolves cannot win', () => {
  const v = verdict(['tanner', 'werewolf', 'seer', 'robber', 'troublemaker', 'werewolf'], { 1: 0, 2: 0, 0: 1 });
  assert.deepEqual(v.dead, ['Ana']);
  assert.equal(v.headline, 'The Tanner got their wish!');
  assert.deepEqual(v.winners, ['Ana']);
});
test('endings: no werewolf among the players and nobody dies → the village wins', () => {
  const v = verdict(['seer', 'robber', 'villager', 'troublemaker', 'werewolf', 'werewolf', 'villager'], { 0: 1, 1: 2, 2: 3, 3: 0 });
  assert.equal(v.headline, 'The village wins!');
  assert.deepEqual(v.winners, ['Ana', 'Bob', 'Cy', 'Dee']);
});
test('endings: no werewolf among the players, a villager dies → the minion wins', () => {
  const v = verdict(['minion', 'robber', 'villager', 'seer', 'werewolf', 'werewolf', 'troublemaker'], { 0: 2, 1: 2, 2: 3, 3: 2 });
  assert.deepEqual(v.dead, ['Cy']);
  assert.equal(v.headline, 'The werewolves win!');
  assert.deepEqual(v.winners, ['Ana']);
});
test('endings: you are on the team of your final card, not your first one', () => {
  // Ana started as the Robber and stole Bob's werewolf card; Bob is now the Robber. Ana is voted out.
  const { G, ctx, st } = ww(['robber', 'werewolf', 'seer', 'villager', 'troublemaker', 'werewolf'], { phase: 'vote', cards: ['werewolf', 'robber', 'seer', 'villager', 'troublemaker', 'werewolf'] });
  st.votes = { 1: 0, 2: 0, 0: 1 };
  G._test.reveal(ctx);
  assert.deepEqual(plain(ctx.ended.results.filter(r => r.won).map(r => r.name)), ['Bob', 'Cy']);
  assert.match(ctx.ended.results[0].note, /Robber → Werewolf · died/);
});

/* ---------------- Advanced roles (Doppelgänger and the Daybreak roles) ---------------- */
test('roles: every role has a difficulty (beginner, intermediate, advanced) and a description', () => {
  const { ROLES, OPTIONAL } = load()._test;
  for (const [id, r] of Object.entries(ROLES)) { assert.ok([1, 2, 3].includes(r.tier), id); assert.ok(r.text.length > 20, id); }
  assert.deepEqual(plain(Object.keys(ROLES).filter(r => ROLES[r].tier === 1)).sort(), ['robber', 'seer', 'troublemaker', 'villager', 'werewolf'], 'beginner = the official first game');
  assert.equal(ROLES.doppelganger.tier, 3, 'the Doppelgänger is for experienced players');
  for (const r of OPTIONAL) assert.ok(ROLES[r].tier >= 2, `${r} is optional, so not a beginner role`);
});

test('deck: special werewolves replace the plain ones; the hardest extras are dropped first', () => {
  const { buildDeck } = load()._test;
  const deck = plain(buildDeck(6, ['mystic', 'dreamwolf']));
  assert.equal(deck.filter(r => r === 'werewolf').length, 0); assert.ok(deck.includes('mystic') && deck.includes('dreamwolf'));
  const small = plain(buildDeck(3, ['minion', 'doppelganger', 'witch']));
  assert.ok(small.includes('minion') && !small.includes('witch') && !small.includes('doppelganger'), `kept the easier one: ${small}`);
});

test('troublemaker may choose not to swap', () => {
  const { G, ctx, st } = ww(['troublemaker', 'werewolf', 'seer', 'villager', 'robber', 'werewolf'], { step: 'troublemaker' });
  assert.equal(G.act(ctx, 0, { act: 'swap', ps: 'none' }), undefined);
  assert.deepEqual(plain(st.cards.slice(0, 3)), ['troublemaker', 'werewolf', 'seer']);
  assert.match(notes(st, 0), /chose not to swap/); assert.ok(st.done.has(0));
});

test('sentinel: a shielded card cannot be looked at or moved', () => {
  const { G, ctx, st } = ww(['sentinel', 'robber', 'seer', 'troublemaker', 'werewolf', 'werewolf', 'villager'], { step: 'sentinel' });
  G.act(ctx, 0, { act: 'shield', p: 2 });
  assert.deepEqual(plain(st.shields), [2]);
  st.step = 'robber';
  assert.match(G.act(ctx, 1, { act: 'rob', p: 2 }), /shielded/);
  st.step = 'troublemaker';
  assert.match(G.act(ctx, 3, { act: 'swap', ps: '1,2' }), /shielded/);
});

test('doppelgänger: copies a role and does its action now, or wakes again with it later', () => {
  // copies the Seer → looks at a card right away
  let { G, ctx, st } = ww(['doppelganger', 'seer', 'werewolf', 'villager', 'robber', 'werewolf'], { step: 'doppelganger' });
  G.act(ctx, 0, { act: 'dopple', p: 1 });
  assert.equal(G.view(ctx, 0).acting, 'seer');
  G.act(ctx, 0, { act: 'seer', p: 2 });
  assert.match(notes(st, 0), /You are now the Seer.*Cy's card is 🐺 Werewolf/s);
  // copies a Werewolf → wakes with the werewolves and is on their team
  ({ G, ctx, st } = ww(['doppelganger', 'werewolf', 'seer', 'villager', 'robber', 'troublemaker'], { step: 'doppelganger' }));
  G.act(ctx, 0, { act: 'dopple', p: 1 });
  assert.ok(st.done.has(0), 'nothing more to do now');
  st.step = 'werewolf';
  assert.equal(G.view(ctx, 0).acting, 'werewolf');
  st.votes = { 1: 2, 2: 1 }; st.phase = 'vote';
  G._test.reveal(ctx);
  assert.deepEqual(plain(ctx.ended.results.filter(r => r.won).map(r => r.name)), ['Ana', 'Bob'], 'the Doppel-Werewolf wins with the werewolves');
});

test('alpha wolf gives the extra center werewolf card to a non-werewolf', () => {
  const { G, ctx, st } = ww(['alpha', 'seer', 'villager', 'robber', 'troublemaker', 'werewolf'], { step: 'alpha' });
  st.cards.push('werewolf'); st.alphaCard = 6;
  assert.match(G.act(ctx, 0, { act: 'alpha', p: 0 }), /another player/);
  G.act(ctx, 0, { act: 'alpha', p: 2 });
  assert.equal(st.cards[2], 'werewolf'); assert.equal(st.cards[6], 'villager'); assert.equal(st.alphaCard, null);
});

test('mystic wolf and apprentice seer peek; the paranormal investigator stops on a werewolf and joins them', () => {
  let { G, ctx, st } = ww(['mystic', 'seer', 'villager', 'robber', 'tanner', 'werewolf'], { step: 'mystic' });
  G.act(ctx, 0, { act: 'mystic', p: 1 });
  assert.match(notes(st, 0), /Bob's card is 🔮 Seer/);
  ({ G, ctx, st } = ww(['apprentice', 'seer', 'villager', 'robber', 'tanner', 'werewolf'], { step: 'apprentice' }));
  G.act(ctx, 0, { act: 'apprentice', c: 2 });
  assert.match(notes(st, 0), /right center card is 🐺 Werewolf/);
  ({ G, ctx, st } = ww(['pi', 'villager', 'werewolf', 'seer', 'robber', 'tanner', 'troublemaker'], { step: 'pi' }));
  assert.equal(G.act(ctx, 0, { act: 'pi', p: 1 }), undefined);
  assert.ok(!st.done.has(0), 'saw a villager: may look again');
  G.act(ctx, 0, { act: 'pi', p: 2 });
  assert.equal(st.becomes.pi, 'werewolf'); assert.ok(st.done.has(0));
});

test('witch: if she looks, she must swap that center card with someone', () => {
  const { G, ctx, st } = ww(['witch', 'villager', 'werewolf', 'tanner', 'seer', 'werewolf'], { step: 'witch' });
  G.act(ctx, 0, { act: 'witchlook', c: 0 });
  assert.match(G.act(ctx, 0, { act: 'pass' }), /must swap/);
  G.act(ctx, 0, { act: 'witchswap', p: 1 });
  assert.equal(st.cards[1], 'tanner'); assert.equal(st.cards[3], 'villager');
});

test('village idiot moves everyone else\'s card one seat (not their own, not a shielded one)', () => {
  const { G, ctx, st } = ww(['idiot', 'seer', 'robber', 'tanner', 'villager', 'werewolf', 'werewolf', 'troublemaker'], { step: 'idiot' });
  st.shields = [2];
  G.act(ctx, 0, { act: 'idiot', dir: 'right' });
  assert.deepEqual(plain(st.cards.slice(0, 5)), ['idiot', 'villager', 'robber', 'seer', 'tanner']);
});

test('revealer: turns a card face up, but a werewolf or tanner stays hidden', () => {
  let { G, ctx, st } = ww(['revealer', 'seer', 'werewolf', 'villager', 'robber', 'troublemaker'], { step: 'revealer' });
  G.act(ctx, 0, { act: 'reveal', p: 1 });
  assert.deepEqual(plain(st.revealed), { 1: 'seer' });
  ({ G, ctx, st } = ww(['revealer', 'seer', 'werewolf', 'villager', 'robber', 'troublemaker'], { step: 'revealer' }));
  G.act(ctx, 0, { act: 'reveal', p: 2 });
  assert.deepEqual(plain(st.revealed), {});
  assert.match(notes(st, 0), /turned it face down again/);
});

test('bodyguard: whoever they vote for cannot die; the next most votes dies instead', () => {
  const v = verdict(['bodyguard', 'werewolf', 'seer', 'villager', 'robber', 'troublemaker', 'tanner'], { 0: 1, 2: 1, 3: 1, 1: 2 });
  assert.deepEqual(v.dead, [], 'Bob is protected; nobody else has 2 votes');
  const w = verdict(['bodyguard', 'werewolf', 'seer', 'villager', 'robber', 'troublemaker', 'tanner'], { 0: 2, 1: 2, 2: 1, 3: 1 });
  assert.deepEqual(w.dead, ['Bob'], 'Cy (protected) had the most votes, so Bob (next most) dies');
});

test('dream wolf: the other werewolves see it, so a werewolf with a dream wolf is not alone', () => {
  const { G, ctx, st } = ww(['werewolf', 'dreamwolf', 'seer', 'villager', 'robber', 'troublemaker'], { step: 'werewolf' });
  assert.match(G.act(ctx, 0, { act: 'peek', c: 0 }), /Only a lone werewolf/);
  assert.equal(G.view(ctx, 1).awake, false, 'the dream wolf sleeps through the night');
  void st;
});

/* ---------------- Whole nights, timeouts, phones and the reveal ---------------- */
const { flush } = require('./helpers');
const H = { esc: t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) };
// Start a real game with the cards dealt in this order (players first, then the center)
async function game(cards, extras = []) {
  const G = load(), n = cards.length - 3;
  const ctx = partyCtx(n, { opts: { extras, talk: 180, actionTime: 10 }, shuffle: () => cards.slice() });
  G.start(ctx); await flush();
  const st = () => ctx.state;
  // end turns (by letting time run out) until the given night step is on
  const until = async step => { for (let k = 0; k < 40 && st().step !== step; k++) { ctx.expire(); await flush(); await flush(); } assert.equal(st().step, step); };
  const next = async () => { ctx.expire(); await flush(); await flush(); };
  return { G, ctx, st, until, next, n };
}

test('night order follows the official wake order', () => {
  assert.deepEqual(plain(load()._test.NIGHT.map(s => s[0])), ['sentinel', 'doppelganger', 'werewolf', 'alpha', 'mystic', 'minion', 'mason', 'seer',
    'apprentice', 'pi', 'robber', 'witch', 'troublemaker', 'idiot', 'drunk', 'insomniac', 'revealer']);
});

test('a whole night calls only the roles in the game (center cards included), then day, vote and the end', async () => {
  const g = await game(['seer', 'werewolf', 'robber', 'troublemaker', 'villager', 'werewolf'], []);
  const steps = [];
  for (let k = 0; k < 30 && g.st().phase !== 'day'; k++) { if (g.st().step && steps.at(-1) !== g.st().step) steps.push(g.st().step); await g.next(); }
  assert.deepEqual(steps, ['werewolf', 'seer', 'robber', 'troublemaker']);
  assert.equal(g.st().phase, 'day');
  await g.next();                                         // discussion over
  assert.equal(g.st().phase, 'vote');
  g.G.act(g.ctx, 0, { act: 'vote', p: 1 }); g.G.act(g.ctx, 2, { act: 'vote', p: 1 }); g.G.act(g.ctx, 1, { act: 'vote', p: 0 });
  await flush(); await flush();
  assert.ok(g.ctx.ended, 'everyone voted: the game ends');
  assert.match(g.ctx.ended.html, /The village wins!/);
});

test('timeouts: the Doppelgänger copies someone at random, the Drunk and the Alpha Wolf act, a Witch who looked takes the card', async () => {
  let g = await game(['doppelganger', 'seer', 'villager', 'troublemaker', 'werewolf', 'werewolf', 'robber'], ['doppelganger']);
  await g.until('doppelganger'); await g.next();
  assert.ok(g.st().dop && g.st().dop.i === 0 && ['seer', 'villager', 'troublemaker', 'werewolf'].includes(g.st().dop.copied));
  g = await game(['drunk', 'seer', 'villager', 'werewolf', 'robber', 'troublemaker', 'werewolf'], ['drunk']);
  await g.until('drunk'); await g.next();
  assert.notEqual(g.st().cards[0], 'drunk', 'the Drunk swapped with a center card');
  g = await game(['alpha', 'seer', 'villager', 'werewolf', 'robber', 'troublemaker', 'villager'], ['alpha']);
  assert.equal(g.st().cards.length, 8, 'the Alpha Wolf brings a 4th center card');
  await g.until('alpha'); await g.next();
  assert.equal(g.st().alphaCard, null);
  assert.equal(g.st().cards.filter((c, k) => k < 4 && c === 'werewolf').length, 2, 'one more werewolf among the players');
  g = await game(['witch', 'seer', 'villager', 'werewolf', 'robber', 'troublemaker', 'tanner'], ['witch']);
  await g.until('witch');
  g.G.act(g.ctx, 0, { act: 'witchlook', c: 1 });
  await g.next();
  assert.equal(g.st().cards[0], 'troublemaker', 'she took the middle card herself');
});

test('optional actions: Seer, Robber, Troublemaker, Mystic Wolf, Sentinel… may do nothing; Drunk, Doppelgänger, Alpha must act', () => {
  for (const [role, cards] of [['seer'], ['robber'], ['troublemaker'], ['mystic'], ['sentinel'], ['apprentice'], ['pi'], ['witch'], ['idiot'], ['revealer']]
    .map(([r]) => [r, [r, 'villager', 'seer', 'werewolf', 'robber', 'werewolf']])) {
    const { G, ctx, st } = ww(cards, { step: role });
    assert.equal(G.act(ctx, 0, { act: 'pass' }), undefined, role);
    assert.ok(st.done.has(0), role); assert.match(notes(st, 0), /did nothing/, role);
  }
  for (const role of ['drunk', 'doppelganger', 'alpha']) {
    const { G, ctx } = ww([role, 'villager', 'seer', 'werewolf', 'robber', 'werewolf'], { step: role });
    assert.match(G.act(ctx, 0, { act: 'pass' }), /must/, role);
  }
});

test('paranormal investigator: may stop after one look, never looks at the same card twice', () => {
  const { G, ctx, st } = ww(['pi', 'villager', 'seer', 'werewolf', 'robber', 'werewolf'], { step: 'pi' });
  G.act(ctx, 0, { act: 'pi', p: 1 });
  assert.match(G.act(ctx, 0, { act: 'pi', p: 1 }), /another player/);
  G.act(ctx, 0, { act: 'pass' });
  assert.match(notes(st, 0), /You stopped looking/);
  assert.equal(st.becomes?.pi, undefined, 'saw only a villager: still on the village team');
});

test('paranormal investigator who sees the Tanner becomes a Tanner (wins only by dying)', () => {
  const { G, ctx, st } = ww(['pi', 'tanner', 'werewolf', 'villager', 'seer', 'robber', 'werewolf'], { step: 'pi' });
  G.act(ctx, 0, { act: 'pi', p: 1 });
  assert.equal(st.becomes.pi, 'tanner');
  st.phase = 'vote'; st.votes = { 1: 0, 2: 0, 3: 2, 0: 2 };      // tie: Ana and Cy die
  G._test.reveal(ctx);
  const won = plain(ctx.ended.results.filter(r => r.won).map(r => r.name));
  assert.ok(won.includes('Ana'), 'the PI-Tanner died: wins');
  assert.ok(!won.includes('Bob'), 'the real Tanner lived: loses');
});

test('sentinel and doppel-sentinel can each place a shield; the same card can\'t get two', () => {
  const { G, ctx, st } = ww(['sentinel', 'doppelganger', 'seer', 'villager', 'robber', 'werewolf', 'werewolf'], { step: 'sentinel' });
  G.act(ctx, 0, { act: 'shield', p: 2 });
  st.step = 'doppelganger'; st.done = new Set();
  G.act(ctx, 1, { act: 'dopple', p: 0 });
  assert.match(G.act(ctx, 1, { act: 'shield', p: 2 }), /already has a shield/);
  G.act(ctx, 1, { act: 'shield', p: 3 });
  assert.deepEqual(plain(st.shields), [2, 3]);
  assert.match(G.act(ctx, 1, { act: 'dopple', p: 2 }), /Not now/, 'the Doppelgänger copies once');
});

test('doppelgänger can\'t copy a shielded card; copying the Drunk must swap; copying the Tanner joins the Tanner\'s side', () => {
  let { G, ctx, st } = ww(['doppelganger', 'drunk', 'tanner', 'werewolf', 'seer', 'robber', 'werewolf'], { step: 'doppelganger' });
  st.shields = [1];
  assert.match(G.act(ctx, 0, { act: 'dopple', p: 1 }), /shielded/);
  st.shields = [];
  G.act(ctx, 0, { act: 'dopple', p: 1 });
  assert.match(G.act(ctx, 0, { act: 'pass' }), /must/);
  G.act(ctx, 0, { act: 'drunk', c: 0 });
  assert.equal(st.cards[0], 'seer');
  ({ G, ctx, st } = ww(['doppelganger', 'tanner', 'villager', 'werewolf', 'seer', 'robber', 'werewolf'], { step: 'doppelganger' }));
  G.act(ctx, 0, { act: 'dopple', p: 1 });
  st.phase = 'vote'; st.votes = { 1: 0, 2: 0, 3: 2, 0: 1 };
  G._test.reveal(ctx);
  assert.match(ctx.ended.html, /Tanner got their wish/);
  assert.deepEqual(plain(ctx.ended.results.filter(r => r.won).map(r => r.name)), ['Ana']);
});

test('doppelgänger copying the Dream Wolf sleeps, but the werewolves see it', () => {
  const { G, ctx, st } = ww(['doppelganger', 'dreamwolf', 'werewolf', 'villager', 'seer', 'robber', 'troublemaker'], { step: 'doppelganger' });
  G.act(ctx, 0, { act: 'dopple', p: 1 });
  assert.ok(st.done.has(0));
  st.step = 'werewolf'; st.done = new Set();
  assert.equal(G.view(ctx, 0).awake, false);
  assert.equal(G.view(ctx, 1).awake, false, 'the Dream Wolf sleeps');
  assert.equal(G.view(ctx, 2).awake, true);
  assert.equal(G.view(ctx, 2).loneWolf, false);
});

test('lone mystic or alpha wolf may look at the center in the werewolves\' turn', () => {
  const { G, ctx, st } = ww(['mystic', 'seer', 'villager', 'werewolf', 'robber', 'troublemaker'], { step: 'werewolf' });
  assert.equal(G.act(ctx, 0, { act: 'peek', c: 0 }), undefined);
  assert.match(notes(st, 0), /left center card is 🐺 Werewolf/);
});

test('the reveal lists the Alpha Wolf\'s 4th center card and face-up cards', () => {
  const { G, ctx, st } = ww(['alpha', 'seer', 'villager', 'werewolf', 'robber', 'troublemaker'], { phase: 'vote' });
  st.cards.push('tanner');
  st.votes = { 0: 1, 1: 0, 2: 0 };
  G._test.reveal(ctx);
  assert.match(ctx.ended.html, /Alpha Wolf's center card: 🪢 Tanner/);
});

test('every deck: players + 3 cards, at least 2 werewolves, masons in pairs (any choice of extras)', () => {
  const { buildDeck, OPTIONAL } = load()._test;
  const rand = require('./helpers').seededRand(7);
  for (let k = 0; k < 2000; k++) {
    const n = 3 + rand(8), extras = OPTIONAL.filter(() => rand(10) < 4);
    const deck = plain(buildDeck(n, extras));
    const tag = `${n} players, ${extras}`;
    assert.equal(deck.length, n + 3, tag);
    assert.ok(deck.filter(r => ['werewolf', 'mystic', 'dreamwolf', 'alpha'].includes(r)).length >= 2, tag);
    for (const r of ['seer', 'robber', 'troublemaker']) assert.ok(deck.includes(r), tag);
    assert.ok([0, 2].includes(deck.filter(r => r === 'mason').length), tag);
    assert.ok(deck.every(r => r === 'villager' || r === 'werewolf' || ['seer', 'robber', 'troublemaker'].includes(r) || extras.includes(r)), tag);
  }
});

test('the phones: tier shown, Don\'t-swap buttons, shielded players greyed out, Doppelgänger heading, Alpha with nothing left', () => {
  let { G, ctx, st } = ww(['troublemaker', 'seer', 'villager', 'werewolf', 'robber', 'werewolf'], { step: 'troublemaker' });
  st.shields = [1];
  let v = G.view(ctx, 0), html = G.phoneHTML(v, {}, H);
  assert.equal(v.tier, 'Beginner');
  assert.match(html, /data-act="swap" data-ps="none"/);
  assert.match(html, /data-p="1" class="" disabled>Bob 🗿/);
  st.phase = 'deal';
  assert.match(G.phoneHTML(G.view(ctx, 0), { shown: true }, H), /ww-tier">Beginner/);
  ({ G, ctx, st } = ww(['doppelganger', 'seer', 'villager', 'werewolf', 'robber', 'werewolf'], { step: 'doppelganger' }));
  G.act(ctx, 0, { act: 'dopple', p: 1 });
  assert.match(G.phoneHTML(G.view(ctx, 0), {}, H), /Your turn, Doppelgänger \(as Seer\)/);
  assert.equal(G.view(ctx, 0).tier, 'Advanced');
  ({ G, ctx, st } = ww(['alpha', 'seer', 'villager', 'werewolf', 'robber', 'werewolf'], { step: 'alpha' }));
  st.alphaCard = null;
  assert.match(G.phoneHTML(G.view(ctx, 0), {}, H), /already given out/);
  ({ G, ctx, st } = ww(['revealer', 'seer', 'villager', 'werewolf', 'robber', 'werewolf'], { step: 'revealer' }));
  G.act(ctx, 0, { act: 'reveal', p: 1 });
  st.phase = 'day';
  assert.match(G.phoneHTML(G.view(ctx, 2), {}, H), /Face-up cards.*Bob: 🔮 Seer/s);
  assert.match(G.hostHTML(ctx, H), /Face-up cards.*Bob: 🔮 Seer/s);
});

test('options: roles grouped Intermediate / Advanced with descriptions; values unchanged (drunk, minion, …)', () => {
  const G = load(), o = G.options.find(x => x.key === 'extras');
  assert.deepEqual(plain(o.groups.map(g => g.title)), ['Beginner', 'Intermediate', 'Advanced']);
  assert.deepEqual(plain(o.groups.filter(g => g.fixed).map(g => g.title)), ['Beginner'], 'the beginner roles are always in (no checkbox)');
  const all = o.groups.filter(g => !g.fixed).flatMap(g => g.choices.map(c => c[0]));
  assert.deepEqual(plain(all).sort(), plain(G._test.OPTIONAL).sort());
  assert.ok(all.includes('drunk') && all.includes('doppelganger'));
  assert.ok(o.groups.every(g => g.choices.every(c => c[2] && c[2].length > 20)), 'each role has a description');
  assert.ok(o.def.every(r => all.includes(r)));
});

test('full rules for every role: shown on hover in the picker, and the wake order they state matches the night', () => {
  const G = load(), { ROLES, DETAIL, NIGHT } = G._test;
  const order = plain(NIGHT.map(x => x[0]));
  // role names as written in the rules ("Werewolves", "Masons" too), longest first so "Apprentice Seer" isn't read as "Seer"
  const names = Object.keys(ROLES).flatMap(r => [[ROLES[r].name, r]]).concat([['Werewolves', 'werewolf'], ['Masons', 'mason']])
    .sort((a, b) => b[0].length - a[0].length);
  const mentioned = text => { const found = []; let t = text;
    for (const [nm, r] of names) if (t.includes(nm)) { found.push(r); t = t.split(nm).join('#'); } return found; };
  for (const r of Object.keys(ROLES)) {
    const d = DETAIL[r];
    assert.ok(d && d.night && d.does && (d.does + (d.win || '') + (d.notes || '')).length > 80, `${r} has full rules`);
    assert.doesNotMatch(d.night, /\d/, `${r}: no absolute position numbers (the real order depends on the roles picked)`);
    const k = order.indexOf(r);
    if (k < 0) { assert.match(d.night, /Doesn't wake/, `${r} doesn't wake`); continue; }
    // "after the X" / "before the Y" must be true in the real order (X earlier, Y later)
    const [, afterPart = '', beforePart = ''] = d.night.match(/^(?:.*?(?:after|After)(.*?))?(?:(?:before)(.*))?$/s) || [];
    const after = mentioned(afterPart), before = mentioned(beforePart);
    for (const x of after) assert.ok(order.indexOf(x) < k, `${r}: "${d.night}" says after the ${x}`);
    for (const x of before) assert.ok(order.indexOf(x) > k, `${r}: "${d.night}" says before the ${x}`);
    if (/^First/.test(d.night)) assert.equal(k, 0, `${r} says first`);
    if (/^Last/.test(d.night)) assert.equal(k, order.length - 1, `${r} says last`);
    // every waking role is placed against something (first, last, or another role)
    assert.ok(after.length + before.length > 0 || /^(First|Last)/.test(d.night), `${r}: "${d.night}" places the role in the night`);
  }
  // every role in the picker (the Beginner ones too) carries its hover card
  const o = G.options.find(x => x.key === 'extras');
  const choices = o.groups.flatMap(g => g.choices);
  assert.deepEqual(plain(choices.map(c => c[0])).sort(), Object.keys(ROLES).sort());
  for (const c of choices) {
    assert.match(c[3], new RegExp(`<b>${ROLES[c[0]].name}</b>`), c[0]);
    assert.match(c[3], /Night:.*What you do:/s, c[0]);
    assert.match(c[3], /(Beginner|Intermediate|Advanced)<\/span><span>(Village team|Werewolf team|On their own)/, c[0]);
  }
});

test('night order: only the roles picked are called, in order; the lobby shows it and what was left out', () => {
  const G = load(), { nightSteps, buildDeck } = G._test;
  const steps = deck => plain(nightSteps(deck).map(x => x[0]));
  assert.deepEqual(steps(buildDeck(5, [])), ['werewolf', 'seer', 'robber', 'troublemaker']);
  assert.deepEqual(steps(buildDeck(8, ['insomniac', 'witch', 'sentinel', 'hunter'])), ['sentinel', 'werewolf', 'seer', 'robber', 'witch', 'troublemaker', 'insomniac']);
  assert.deepEqual(steps(['mystic', 'dreamwolf', 'seer', 'robber', 'troublemaker', 'villager']), ['werewolf', 'mystic', 'seer', 'robber', 'troublemaker'],
    'special wolves still get the werewolves\' turn');
  let html = G.lobbyHTML(6, { extras: ['minion', 'hunter', 'witch'] });
  assert.match(html, /Night order for 6 players/);
  assert.match(html, /🐺 Werewolves.*🦹 Minion.*🔮 Seer.*🦝 Robber.*🧹 Witch.*😈 Troublemaker/s);
  assert.match(html, /Don't wake: .*Hunter/);
  assert.doesNotMatch(html, /left out/);
  html = G.lobbyHTML(3, { extras: ['minion', 'witch', 'idiot'] });
  assert.match(html, /left out: .*Witch.*Village Idiot/s, 'with 3 players only one extra fits; the hardest are left out');
  assert.doesNotMatch(html.split('Too many')[0], /Witch/, 'and they are not in the order');
  assert.match(G.lobbyHTML(1, { extras: [] }), /Night order \(for 3 players\)/);
});

test('the Mac shows the night order during the game, with the role now awake highlighted', () => {
  const { G, ctx } = ww(['seer', 'werewolf', 'robber', 'troublemaker', 'villager', 'werewolf'], { step: 'robber' });
  const html = G.hostHTML(ctx, H);
  assert.match(html, /Night order/);
  assert.match(html, /class="p on">🦝 Robber/);
  assert.doesNotMatch(html, /class="p on">🔮 Seer/);
});

/* ---------------- The remaining screens and messages ---------------- */
test('wake-up information: the Minion sees the werewolves (or none), a Mason sees the other (or is alone)', async () => {
  let g = await game(['minion', 'werewolf', 'dreamwolf', 'seer', 'robber', 'troublemaker', 'villager'], ['minion', 'dreamwolf']);
  await g.until('minion');
  assert.match(g.st().notes[0].join(' '), /The werewolves are: Bob, Cy\./);
  g = await game(['minion', 'seer', 'robber', 'werewolf', 'troublemaker', 'werewolf'], ['minion']);
  await g.until('minion');
  assert.match(g.st().notes[0].join(' '), /no werewolves among the players/);
  g = await game(['mason', 'mason', 'seer', 'werewolf', 'robber', 'troublemaker', 'werewolf'], ['mason']);
  await g.until('mason');
  assert.match(g.st().notes[0].join(' '), /The other mason: Bob\./);
  g = await game(['mason', 'seer', 'robber', 'werewolf', 'troublemaker', 'mason', 'werewolf'], ['mason']);
  await g.until('mason');
  assert.match(g.st().notes[0].join(' '), /only mason/);
});

test('day: "ready to vote" toggles; when everyone is ready (or the Mac says so) the vote starts', () => {
  const { G, ctx, st } = ww(['seer', 'werewolf', 'robber', 'troublemaker', 'villager', 'werewolf'], { phase: 'day' });
  let skipped = 0; ctx.skip = () => { skipped++; };
  G.act(ctx, 0, { act: 'ready' }); G.act(ctx, 0, { act: 'ready' });
  assert.equal(st.ready.size, 0, 'tap again: not ready');
  G.act(ctx, 0, { act: 'ready' }); G.act(ctx, 1, { act: 'ready' });
  assert.equal(skipped, 0);
  G.act(ctx, 2, { act: 'ready' });
  assert.equal(skipped, 1, 'all three ready');
  G.hostAct(ctx, { host: 'vote' });
  assert.equal(skipped, 2, '"Start the vote now" on the Mac');
  assert.match(G.status(ctx), /Day: discussion/);
  st.phase = 'vote';
  assert.match(G.act(ctx, 0, { act: 'vote', p: 0 }), /another player/);
  assert.match(G.status(ctx), /Vote/);
});

test('phone screens: robber after a swap, witch giving the card, drunk, village idiot, day and vote', () => {
  const view = (roles, step, i = 0, extra = {}) => { const g = ww(roles, { step }); Object.assign(g.st, extra); return { ...g, html: () => g.G.phoneHTML(plain(g.G.view(g.ctx, i)), {}, H) }; };
  let g = view(['robber', 'werewolf', 'seer', 'villager', 'troublemaker', 'werewolf'], 'robber');
  g.G.act(g.ctx, 0, { act: 'rob', p: 1 });
  assert.match(g.html(), /You took Bob's card\. Do you want to look at it\?.*Look at my new card.*Don't look/s);
  g = view(['witch', 'werewolf', 'seer', 'villager', 'troublemaker', 'tanner'], 'witch');
  assert.match(g.html(), /data-act="witchlook"/);
  g.G.act(g.ctx, 0, { act: 'witchlook', c: 0 });
  assert.match(g.html(), /Give that center card to a player \(or yourself\).*data-act="witchswap" data-p="0"/s);
  assert.match(view(['drunk', 'werewolf', 'seer', 'villager', 'troublemaker', 'werewolf'], 'drunk').html(), /won't see it.*data-act="drunk" data-c="2"/s);
  assert.match(view(['idiot', 'werewolf', 'seer', 'villager', 'troublemaker', 'werewolf'], 'idiot').html(), /data-dir="left".*data-dir="right"/s);
  g = ww(['seer', 'werewolf', 'robber', 'troublemaker', 'villager', 'werewolf'], { phase: 'day' });
  assert.match(g.G.phoneHTML(plain(g.G.view(g.ctx, 0)), {}, H), /Ready to vote.*0 of 3 ready/s);
  g.st.phase = 'vote'; g.st.votes = { 0: 1 };
  assert.match(g.G.phoneHTML(plain(g.G.view(g.ctx, 0)), {}, H), /data-act="vote" data-p="1" class="on".*Vote saved/s);
  assert.match(g.G.phoneHTML(plain(g.G.view(g.ctx, 1)), {}, H), /Tap a name to vote/);
  assert.match(g.G.hostHTML(g.ctx, H), /1 of 3 votes in/);
});

test('phone choices: the Seer picks up to two center cards, the Troublemaker two players; buzz when the phase changes', () => {
  const G = load(), local = {};
  G.phoneLocal({ local: 'cc', c: '0' }, {}, local); G.phoneLocal({ local: 'cc', c: '2' }, {}, local); G.phoneLocal({ local: 'cc', c: '1' }, {}, local);
  assert.deepEqual(plain(local.cc), [2, 1], 'at most two: the oldest drops');
  G.phoneLocal({ local: 'cc', c: '2' }, {}, local);
  assert.deepEqual(plain(local.cc), [1], 'tap again to unpick');
  G.phoneLocal({ local: 'pp', p: '3' }, {}, local); G.phoneLocal({ local: 'pp', p: '4' }, {}, local);
  assert.deepEqual(plain(local.pp), [3, 4]);
  G.phoneLocal({ local: 'flip' }, {}, local);
  assert.equal(local.shown, true);
  G.phoneAct({}, {}, local);
  assert.deepEqual(plain([local.cc, local.pp]), [[], []], 'choices clear once sent');
  assert.ok(G.phoneNotify({ phase: 'night' }, { phase: 'day' }));
  assert.ok(!G.phoneNotify({ phase: 'deal' }, { phase: 'night' }), 'no buzz at night (it would give roles away)');
});
