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
