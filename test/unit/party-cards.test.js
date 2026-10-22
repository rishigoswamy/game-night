// Go Fish and Bluff rules (public/games/party/gofish.js, bluff.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain, partyCtx, flush, card } = require('./helpers');

const load = name => loadScripts(['games/party/common.js', `games/party/${name}.js`]).PARTY_GAME;
const ranks = hand => plain(hand.map(c => c.r)).sort();

/* ---------------- Go Fish ---------------- */
async function goFish(n, setup) {
  const G = load('gofish'), ctx = partyCtx(n);
  await G.start(ctx);
  if (setup) { setup(ctx.state); }
  return { G, ctx, st: ctx.state };
}

test('go fish: 7 cards each with 2–3 players, 5 with 4–6; the rest is the pond', async () => {
  for (const [n, per] of [[2, 7], [3, 7], [4, 5], [6, 5]]) {
    const { st } = await goFish(n);
    st.hands.forEach((h, i) => assert.equal(h.length + st.books[i].length * 4, per, `${n} players: player ${i}`));
    const inPlay = st.hands.reduce((a, h) => a + h.length, 0) + st.books.reduce((a, b) => a + b.length * 4, 0) + st.deck.length;
    assert.equal(inPlay, 52, 'no card lost or duplicated');
  }
});

test('go fish: asks are refused when they break the rules', async () => {
  const { G, ctx } = await goFish(3, st => {
    st.turn = 0; st.hands = [[card('7')], [card('7', '♥')], []]; st.books = [[], [], []];
  });
  assert.match(G.act(ctx, 1, { act: 'ask', target: 0, rank: '7' }), /not your turn/);
  assert.match(G.act(ctx, 0, { act: 'ask', target: 0, rank: '7' }), /another player/);
  assert.match(G.act(ctx, 0, { act: 'ask', target: 1, rank: 'K' }), /rank you hold/);
  assert.match(G.act(ctx, 0, { act: 'ask', target: 2, rank: '7' }), /no cards/);
});

test('go fish: the other player hands over every card of that rank, and you go again', async () => {
  const { G, ctx, st } = await goFish(2, s => {
    s.turn = 0; s.hands = [[card('7'), card('2')], [card('7', '♥'), card('7', '♦'), card('K')]]; s.books = [[], []];
  });
  assert.equal(G.act(ctx, 0, { act: 'ask', target: 1, rank: '7' }), undefined);
  assert.deepEqual(ranks(st.hands[0]), ['2', '7', '7', '7']);
  assert.deepEqual(ranks(st.hands[1]), ['K']);
  assert.equal(st.turn, 0, 'a successful ask keeps the turn');
});

test('go fish: no match means go fish; fishing your wish keeps the turn', async () => {
  const { G, ctx, st } = await goFish(2, s => {
    s.turn = 0; s.hands = [[card('9')], [card('3')]]; s.books = [[], []]; s.deck = [card('4'), card('9', '♥')];   // the pond deals from its end
  });
  G.act(ctx, 0, { act: 'ask', target: 1, rank: '9' });
  assert.deepEqual(ranks(st.hands[0]), ['9', '9'], 'drew the 9 it asked for');
  assert.equal(st.turn, 0, 'fished its wish: goes again');
  G.act(ctx, 0, { act: 'ask', target: 1, rank: '9' });
  assert.deepEqual(ranks(st.hands[0]), ['4', '9', '9']);
  assert.equal(st.turn, 1, 'no luck: the turn passes');
});

test('go fish: four of a kind becomes a book', async () => {
  const { G, ctx, st } = await goFish(2, s => {
    s.turn = 0; s.hands = [[card('Q'), card('Q', '♥'), card('Q', '♦'), card('5')], [card('Q', '♣'), card('8')]]; s.books = [[], []];
  });
  G.act(ctx, 0, { act: 'ask', target: 1, rank: 'Q' });
  assert.deepEqual(plain(st.books[0]), ['Q']);
  assert.deepEqual(ranks(st.hands[0]), ['5']);
});

test('go fish: when all 13 books are made, most books wins and ties share the win', async () => {
  const { G, ctx } = await goFish(3, s => {
    s.turn = 0; s.deck = [];
    s.books = [['A', '2', '3', '4'], ['5', '6', '7', '8'], ['9', '10', 'J']];
    s.hands = [[card('Q'), card('Q', '♥'), card('Q', '♦'), card('K')], [card('Q', '♣')], [card('K', '♥'), card('K', '♦'), card('K', '♣')]];
  });
  G.act(ctx, 0, { act: 'ask', target: 1, rank: 'Q' });     // player 0 completes Queens (5 books)…
  G.act(ctx, 0, { act: 'ask', target: 2, rank: 'K' });     // …and Kings (6 books): all 13 made
  assert.ok(ctx.ended, 'the game ended');
  assert.deepEqual(plain(ctx.ended.results.map(r => [r.name, r.points, r.won])), [['Ana', 6, true], ['Bob', 4, false], ['Cy', 3, false]]);
});

/* ---------------- Bluff ---------------- */
async function bluff(n = 3, setup) {
  const G = load('bluff'), ctx = partyCtx(n, { opts: { window: 5 } });
  await G.start(ctx);
  if (setup) setup(ctx.state);
  return { G, ctx, st: ctx.state };
}
const id = c => `${c.r}|${c.s}`;

test('bluff: the whole deck is dealt as evenly as possible', async () => {
  for (const n of [3, 4, 5, 8]) {
    const { st } = await bluff(n);
    const sizes = st.hands.map(h => h.length);
    assert.equal(sizes.reduce((a, b) => a + b, 0), 52);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${n} players: ${sizes}`);
  }
});

test('bluff: plays are refused unless it is your turn and you play 1–4 of your own cards', async () => {
  const { G, ctx, st } = await bluff(3, s => { s.turn = 0; s.hands[0] = [card('A'), card('2'), card('3'), card('4'), card('5')]; });
  const ids = st.hands[0].map(id);
  assert.match(G.act(ctx, 1, { act: 'play', cards: id(st.hands[1][0]) }), /not your turn/);
  assert.match(G.act(ctx, 0, { act: 'play', cards: '' }), /1 to 4/);
  assert.match(G.act(ctx, 0, { act: 'play', cards: ids.join(',') }), /1 to 4/);
  assert.match(G.act(ctx, 0, { act: 'play', cards: 'K|♥' }), /not in your hand/);
});

test('bluff: nobody calls → the next player plays the next rank', async () => {
  const { G, ctx, st } = await bluff(3, s => { s.turn = 0; s.hands[0] = [card('A'), card('9')]; });
  G.act(ctx, 0, { act: 'play', cards: 'A|♠' });
  assert.equal(st.phase, 'challenge');
  assert.equal(st.pile.length, 1);
  ctx.expire(); await flush(); await flush();
  assert.equal(st.phase, 'play'); assert.equal(st.turn, 1); assert.equal(st.rank, 1, 'Aces → 2s');
});

test('bluff: calling a lie makes the liar take the pile', async () => {
  const { G, ctx, st } = await bluff(3, s => { s.turn = 0; s.hands[0] = [card('9'), card('5')]; s.hands[1] = [card('K')]; s.pile = [{ card: card('3'), by: 2 }]; });
  G.act(ctx, 0, { act: 'play', cards: '9|♠' });                    // claims an Ace with a 9
  assert.match(G.act(ctx, 0, { act: 'bluff' }) || '', /yourself/);
  G.act(ctx, 1, { act: 'bluff' });
  await flush(); await flush(); await flush();
  assert.deepEqual(ranks(st.hands[0]), ['3', '5', '9'], 'the liar took the whole pile');
  assert.equal(st.pile.length, 0);
  assert.equal(st.turn, 1, 'play moves on after the claimant');
});

test('bluff: calling the truth makes the caller take the pile', async () => {
  const { G, ctx, st } = await bluff(3, s => { s.turn = 0; s.hands[0] = [card('A'), card('5')]; s.hands[2] = [card('Q')]; });
  G.act(ctx, 0, { act: 'play', cards: 'A|♠' });
  G.act(ctx, 2, { act: 'bluff' });
  assert.match(G.act(ctx, 1, { act: 'bluff' }) || '', /Too late/, 'only the first call counts');
  await flush(); await flush(); await flush();
  assert.deepEqual(ranks(st.hands[2]), ['A', 'Q']);
});

test('bluff: emptying your hand wins, unless you were caught lying on the last play', async () => {
  {
    const { G, ctx } = await bluff(3, s => { s.turn = 0; s.hands[0] = [card('A')]; });
    G.act(ctx, 0, { act: 'play', cards: 'A|♠' });
    ctx.expire(); await flush(); await flush();
    assert.ok(ctx.ended); assert.equal(ctx.ended.results.find(r => r.won).name, 'Ana');
  }
  {
    const { G, ctx } = await bluff(3, s => { s.turn = 0; s.hands[0] = [card('A')]; });
    G.act(ctx, 0, { act: 'play', cards: 'A|♠' });
    G.act(ctx, 1, { act: 'bluff' });                                   // called, but it was the truth
    await flush(); await flush(); await flush();
    assert.ok(ctx.ended, 'a truthful last card still wins'); assert.equal(ctx.ended.results.find(r => r.won).name, 'Ana');
  }
  {
    const { G, ctx, st } = await bluff(3, s => { s.turn = 0; s.hands[0] = [card('7')]; });
    G.act(ctx, 0, { act: 'play', cards: '7|♠' });                       // claims an Ace with a 7
    G.act(ctx, 1, { act: 'bluff' });
    await flush(); await flush(); await flush();
    assert.equal(ctx.ended, null, 'caught lying: no win');
    assert.ok(st.hands[0].length >= 1, 'and takes the pile back');
  }
});

/* ---------------- What each screen shows (privacy) ---------------- */
const H = { esc: t => String(t), color: () => '#888', me: 0, seats: [] };
const cardsIn = (json, hand) => plain(hand.filter(c => json.includes(JSON.stringify({ r: c.r, s: c.s }))));

test('go fish screens: a phone sees its own hand and only counts of the others; the Mac shows no faces', async () => {
  const { G, ctx, st } = await goFish(3);
  for (let i = 0; i < 3; i++) {
    const v = plain(G.view(ctx, i)), json = JSON.stringify(v);
    assert.deepEqual(ranks(v.hand), ranks(st.hands[i]));
    for (let k = 0; k < 3; k++) if (k !== i) {
      const others = st.hands[k].filter(c => !st.hands[i].some(x => x.r === c.r && x.s === c.s));
      assert.deepEqual(cardsIn(json, others), [], `phone ${i} must not see player ${k}'s cards`);
      assert.equal(v.others.find(o => o.i === k).count, st.hands[k].length);
    }
    const html = G.phoneHTML(v, {}, H);
    assert.equal((html.match(/class="pcard /g) || []).length, st.hands[i].length);
  }
  const host = G.hostHTML(ctx, H);
  assert.doesNotMatch(host, /class="face/, 'the Mac shows only card backs');
  assert.match(G.status(ctx), /Pond: \d+ cards · \d+ of 13 books made/);
});

test('go fish phone: picking a rank and a player, then Ask', async () => {
  const { G, ctx, st } = await goFish(2, s => { s.turn = 0; s.hands = [[card('7'), card('2')], [card('7', '♥')]]; s.books = [[], []]; });
  const local = {};
  let v = plain(G.view(ctx, 0));
  assert.match(G.phoneHTML(v, local, H), /data-act="ask"[^>]*disabled>\s*Pick a rank and a player/);
  G.phoneLocal({ local: 'rank', rank: '7' }, v, local); G.phoneLocal({ local: 'target', target: '1' }, v, local);
  assert.match(G.phoneHTML(v, local, H), /data-act="ask" data-rank="7" data-target="1" >\s*Ask Bob for 7s/);
  G.phoneLocal({ local: 'rank', rank: '7' }, v, local);
  assert.equal(local.rank, null, 'tap again to unpick');
  assert.ok(G.phoneNotify({ myTurn: false }, { myTurn: true }), 'buzz when it becomes your turn');
  void st;
});

test('bluff screens: own hand only; the Mac shows backs until a challenge reveals the cards', async () => {
  const { G, ctx, st } = await bluff(3);
  for (let i = 0; i < 3; i++) {
    const v = plain(G.view(ctx, i)), json = JSON.stringify(v);
    for (let k = 0; k < 3; k++) if (k !== i) assert.deepEqual(cardsIn(json, st.hands[k]), [], `phone ${i} must not see player ${k}'s cards`);
    assert.equal(v.others.length, 3);
    assert.ok(G.phoneHTML(v, {}, H).length > 50);
  }
  assert.doesNotMatch(G.hostHTML(ctx, H), /class="face/);
  assert.match(G.status(ctx), /Rank to play: Aces · pile 0 cards/);
});

test('cards: face cards show their letter, number cards their suit; red suits are red', () => {
  const K = loadScripts(['games/party/common.js']).get('PartyKit');
  assert.match(K.cardHTML({ r: 'K', s: '♥' }), /class="face red".*<span class="court">K<\/span>/s);
  assert.match(K.cardHTML({ r: '7', s: '♣' }), /class="face".*<span class="pip">♣<\/span>/s);
  assert.match(K.cardHTML({ r: 'A', s: '♠' }, { cls: 'sel', attrs: 'data-x="1"' }), /class="pcard sel" data-x="1"/);
  assert.equal(K.rankName('6', 2), 'sixes'); assert.equal(K.rankName('Q', 2), 'Queens'); assert.equal(K.rankName('A'), 'Ace');
});
