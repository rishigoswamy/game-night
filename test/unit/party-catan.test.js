// Catan rules (public/games/party/catan.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain, partyCtx, seededRand, seededShuffle } = require('./helpers');

const RES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
const load = () => loadScripts(['games/party/common.js', 'games/party/catan.js']).PARTY_GAME;
const T = () => load()._test;
const empty = () => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
// A bare state on a fresh board, for testing the rule helpers directly
function bareState(seed = 1, players = 3) {
  const t = T(), rand = seededRand(seed);
  return { t, st: { board: t.newBoard(rand, seededShuffle(rand)), bld: {}, roads: {}, res: [...Array(players)].map(empty), dev: [...Array(players)].map(() => []),
    bank: { wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 }, knights: Array(players).fill(0), longestRoad: null, largestArmy: null } };
}
// A simple path of `len` connected edges starting at vertex v (no vertex visited twice)
function path(board, v, len) {
  const edges = [], seen = new Set([v]);
  const go = (at, left) => {
    if (!left) return true;
    for (const e of board.verts[at].edges) {
      const ed = board.edges[e], w = ed.a === at ? ed.b : ed.a;
      if (seen.has(w)) continue;
      seen.add(w); edges.push(e);
      if (go(w, left - 1)) return true;
      seen.delete(w); edges.pop();
    }
    return false;
  };
  assert.ok(go(v, len), 'found a path');
  const verts = [v];
  edges.forEach(e => { const ed = board.edges[e], last = verts.at(-1); verts.push(ed.a === last ? ed.b : ed.a); });
  return { edges, verts };
}

/* ---------------- The board ---------------- */
test('board geometry: 19 hexes, 54 corners, 72 edges, 30 on the coast', () => {
  const g = T().geometry();
  assert.equal(g.hexes.length, 19); assert.equal(g.verts.length, 54); assert.equal(g.edges.length, 72);
  for (const h of g.hexes) assert.equal(new Set(h.v).size, 6, 'each hex has 6 distinct corners');
  for (const v of g.verts) { assert.ok(v.hexes.length >= 1 && v.hexes.length <= 3); assert.ok(v.adj.length === 2 || v.adj.length === 3); }
  assert.equal(g.edges.filter(e => e.hexes.length === 1).length, 30);
});

test('new boards (50 of them) are fair: right tiles and numbers, no 6/8 neighbours, robber in the desert, 9 harbours', () => {
  const { newBoard } = T();
  for (let seed = 1; seed <= 50; seed++) {
    const rand = seededRand(seed), b = newBoard(rand, seededShuffle(rand));
    const tiles = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, desert: 0 };
    b.hexes.forEach(h => { tiles[h.res]++; });
    assert.deepEqual(tiles, { wood: 4, brick: 3, sheep: 4, wheat: 4, ore: 3, desert: 1 });
    assert.deepEqual(plain(b.hexes.map(h => h.num).filter(Boolean)).sort((x, y) => x - y), [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
    const desert = b.hexes.findIndex(h => h.res === 'desert');
    assert.equal(b.hexes[desert].num, null); assert.equal(b.robber, desert);
    const hot = b.hexes.filter(h => h.num === 6 || h.num === 8);
    for (const a of hot) for (const c of hot) if (a !== c) assert.ok(!a.v.some(v => c.v.includes(v)), `seed ${seed}: 6/8 next to each other`);
    assert.equal(b.ports.length, 9);
    assert.deepEqual(plain(b.ports.map(p => p.type)).sort(), ['any', 'any', 'any', 'any', 'brick', 'ore', 'sheep', 'wheat', 'wood']);
    for (const p of b.ports) assert.ok(b.edges.some(e => e.hexes.length === 1 && ((e.a === p.a && e.b === p.b) || (e.a === p.b && e.b === p.a))), 'harbours sit on the coast');
  }
});

/* ---------------- Placement ---------------- */
test('settlements: two corners apart from any other, and (after setup) on your own road', () => {
  const { t, st } = bareState();
  const v = 10, near = st.board.verts[v].adj[0];
  assert.ok(t.canSettle(st, 0, v, true), 'setup: any free corner');
  st.bld[v] = { p: 0, city: false };
  assert.ok(!t.canSettle(st, 1, v, true), 'occupied');
  assert.ok(!t.canSettle(st, 1, near, true), 'next to a settlement (distance rule)');
  const far = path(st.board, v, 2).verts[2];
  assert.ok(!t.canSettle(st, 0, far, false), 'after setup it needs your road');
  path(st.board, v, 2).edges.forEach(e => { st.roads[e] = 0; });
  assert.ok(t.canSettle(st, 0, far, false), 'two corners away, on your road');
  assert.ok(!t.canSettle(st, 1, far, false), "someone else's road doesn't count");
});

test('roads: connect to your road or building, but not through an opponent\'s settlement', () => {
  const { t, st } = bareState();
  const { edges, verts } = path(st.board, 20, 3);
  st.bld[verts[0]] = { p: 0, city: false };
  assert.ok(t.canRoad(st, 0, edges[0]), 'next to your settlement');
  assert.ok(!t.canRoad(st, 0, edges[1]), 'not connected yet');
  st.roads[edges[0]] = 0;
  assert.ok(t.canRoad(st, 0, edges[1]), 'extends your road');
  st.bld[verts[1]] = { p: 1, city: false };                     // an opponent builds where the two roads meet
  assert.ok(!t.canRoad(st, 0, edges[1]), "can't build through an opponent's settlement");
  assert.ok(!t.canRoad(st, 0, edges[0]), 'already taken');
  assert.ok(!t.canRoad(st, 1, edges[2], verts[0]), 'during setup a road must touch the new settlement');
});

/* ---------------- Longest Road ---------------- */
test('longest road: straight runs, branches, loops, and roads broken by an opponent', () => {
  const { t, st } = bareState();
  const run = path(st.board, 0, 6);
  run.edges.forEach(e => { st.roads[e] = 0; });
  assert.equal(t.longest(st, 0), 6, 'six in a row');
  // a short branch off the middle doesn't add to the longest single path
  const mid = run.verts[3], branch = st.board.verts[mid].edges.find(e => st.roads[e] == null);
  if (branch != null) { st.roads[branch] = 0; assert.equal(t.longest(st, 0), 6); delete st.roads[branch]; }
  // an opponent settles in the middle: the road is split into 3 + 3
  st.bld[run.verts[3]] = { p: 1, city: false };
  assert.equal(t.longest(st, 0), 3);
  // your own settlement doesn't break it
  st.bld[run.verts[3]] = { p: 0, city: false };
  assert.equal(t.longest(st, 0), 6);
  // a loop around one hex counts all six sides
  const { t: t2, st: st2 } = bareState();
  st2.board.hexes[9].v.forEach((v, k, vs) => {
    const w = vs[(k + 1) % 6], e = st2.board.verts[v].edges.find(x => [st2.board.edges[x].a, st2.board.edges[x].b].includes(w));
    st2.roads[e] = 2;
  });
  assert.equal(t2.longest(st2, 2), 6);
});

test('awards: needs the minimum, the holder keeps it on a tie, a strictly longer/larger one takes it', () => {
  const { award } = T();
  assert.equal(award(null, [4, 3, 2], 5), null, 'Longest Road needs 5');
  assert.equal(award(null, [5, 3, 2], 5), 0);
  assert.equal(award(0, [5, 5, 2], 5), 0, 'a tie keeps the holder');
  assert.equal(award(0, [5, 6, 2], 5), 1, 'strictly longer takes it');
  assert.equal(award(null, [6, 6, 2], 5), null, 'tied with no holder: nobody');
  assert.equal(award(0, [3, 6, 6], 5), null, 'holder fell behind, two tied above: nobody');
  assert.equal(award(null, [3, 2, 1], 3), 0, 'Largest Army needs 3 knights');
});

/* ---------------- Harbours and production ---------------- */
test('trade rates: 4:1, 3:1 with a generic harbour, 2:1 with that resource\'s harbour', () => {
  const { t, st } = bareState();
  assert.equal(t.ratio(st, 0, 'ore'), 4);
  const any = st.board.ports.find(p => p.type === 'any'), wood = st.board.ports.find(p => p.type === 'wood');
  st.bld[any.a] = { p: 0, city: false };
  assert.equal(t.ratio(st, 0, 'ore'), 3);
  st.bld[wood.b] = { p: 0, city: false };
  assert.equal(t.ratio(st, 0, 'wood'), 2); assert.equal(t.ratio(st, 0, 'ore'), 3);
  assert.equal(t.ratio(st, 1, 'wood'), 4, "another player's harbour doesn't help");
});

function productionCtx(seed = 3) {
  const { t, st } = bareState(seed);
  const ctx = partyCtx(3); ctx.state = st;
  return { t, st, ctx };
}
test('production: settlements 1, cities 2, nothing under the robber', () => {
  const { t, st, ctx } = productionCtx();
  const hi = st.board.hexes.findIndex((h, i) => h.num && i !== st.board.robber), h = st.board.hexes[hi];
  st.bld[h.v[0]] = { p: 0, city: false }; st.bld[h.v[3]] = { p: 1, city: true };
  t.produce(ctx, h.num);
  const twin = st.board.hexes.filter((x, i) => x.num === h.num && i !== hi);     // the other hex with this number may add more
  assert.ok(st.res[0][h.res] >= 1); assert.ok(st.res[1][h.res] >= 2);
  if (!twin.length) { assert.equal(st.res[0][h.res], 1); assert.equal(st.res[1][h.res], 2); }
  const before = plain(st.res);
  st.board.robber = hi;
  t.produce(ctx, h.num);
  assert.equal(st.res[0][h.res] - before[0][h.res], twin.some(x => x.v.includes(h.v[0])) ? 1 : 0, 'the robber blocks the hex');
});

test('production: when the bank runs short, nobody gets that resource, unless only one player is owed it', () => {
  const { t, st, ctx } = productionCtx();
  const hi = st.board.hexes.findIndex((h, i) => h.num && i !== st.board.robber), h = st.board.hexes[hi];
  st.board.hexes.forEach((x, i) => { if (i !== hi && x.num === h.num) x.num = null; });   // only this hex produces
  st.bld[h.v[0]] = { p: 0, city: true }; st.bld[h.v[3]] = { p: 1, city: true };         // owed 2 + 2
  st.bank[h.res] = 3;
  t.produce(ctx, h.num);
  assert.equal(st.res[0][h.res] + st.res[1][h.res], 0, 'two players owed 4, bank has 3: nobody gets any');
  assert.equal(st.bank[h.res], 3);
  delete st.bld[h.v[3]];
  t.produce(ctx, h.num);
  assert.equal(st.res[0][h.res], 2, 'one player owed 2, bank has 3: gets 2');
  st.bank[h.res] = 1;
  t.produce(ctx, h.num);
  assert.equal(st.res[0][h.res], 3, 'one player owed 2, bank has 1: gets the last 1');
  assert.equal(st.bank[h.res], 0);
});

/* ---------------- Playing through act() ---------------- */
async function game(n = 3, opts = {}) {
  const G = load(), ctx = partyCtx(n, { opts, rand: seededRand(11) });
  await G.start(ctx);
  return { G, ctx, st: ctx.state };
}
function playSetup(G, ctx, st) {
  const order = [];
  while (st.step.startsWith('setup')) {
    const p = st.turn, L = G.view(ctx, p).legal;
    if (st.step === 'setup-settle') { order.push(p); assert.equal(G.act(ctx, p, { act: 'build', kind: 'settlement', at: L.settlement[0] }), undefined); }
    else assert.equal(G.act(ctx, p, { act: 'build', kind: 'road', at: L.road[0] }), undefined);
  }
  return order;
}
const hand = st => st.res.map(r => RES.reduce((a, k) => a + r[k], 0));
// Give player p exactly these cards, moving the difference to / from the bank (so the totals stay right)
function setHand(st, p, cards) {
  RES.forEach(k => { const want = cards[k] || 0; st.bank[k] += st.res[p][k] - want; st.res[p][k] = want; });
}
const conserved = st => RES.every(k => st.bank[k] + st.res.reduce((a, r) => a + r[k], 0) === 19);

test('setup goes in snake order, and the second settlement collects its neighbours', async () => {
  const { G, ctx, st } = await game(3);
  const f = st.first;
  const order = playSetup(G, ctx, st);
  assert.deepEqual(order, [f, (f + 1) % 3, (f + 2) % 3, (f + 2) % 3, (f + 1) % 3, f]);
  st.res.forEach((r, p) => {
    const second = Object.keys(st.bld).map(Number).filter(v => st.bld[v].p === p).at(-1);
    const expected = empty();
    st.board.verts[second].hexes.forEach(h => { const res = st.board.hexes[h].res; if (res !== 'desert') expected[res]++; });
    // the second settlement is whichever of the two got resources; check at least the totals match one of them
    const firstVs = Object.keys(st.bld).map(Number).filter(v => st.bld[v].p === p);
    const options = firstVs.map(v => { const e = empty(); st.board.verts[v].hexes.forEach(h => { const x = st.board.hexes[h].res; if (x !== 'desert') e[x]++; }); return JSON.stringify(e); });
    assert.ok(options.includes(JSON.stringify(plain(r))), `player ${p} got the resources around one settlement`);
  });
  assert.ok(conserved(st));
  assert.equal(st.step, 'roll'); assert.equal(st.turn, f, 'the first player starts');
});

test('turns: roll first; a 7 makes big hands discard half, then the robber moves and steals', async () => {
  const { G, ctx, st } = await game(3);
  playSetup(G, ctx, st);
  const p = st.turn, q = (p + 1) % 3;
  assert.match(G.act(ctx, p, { act: 'build', kind: 'road', at: 0 }), /Roll the dice first/);
  assert.match(G.act(ctx, p, { act: 'end' }), /Roll the dice first/);
  assert.match(G.act(ctx, q, { act: 'roll' }), /not your turn/);
  // force a 7: give q nine cards
  setHand(st, q, { wood: 3, brick: 2, sheep: 2, wheat: 1, ore: 1 });
  ctx.rand = (() => { const seq = [2, 3]; let i = 0; return () => seq[i++ % 2]; })();   // dice 3 + 4
  G.act(ctx, p, { act: 'roll' });
  assert.equal(st.step, 'discard'); assert.equal(st.discards[q], 4, '9 cards → discard 4');
  assert.match(G.act(ctx, q, { act: 'discard', res: 'wood,wood,wood' }), /exactly 4/);
  assert.equal(G.act(ctx, q, { act: 'discard', res: 'wood,wood,wood,brick' }), undefined);
  assert.equal(hand(st)[q], 5);
  assert.equal(st.step, 'robber');
  assert.match(G.act(ctx, p, { act: 'robber', h: st.board.robber }), /another hex/);
  // move the robber next to q's settlement and steal
  const qv = Object.keys(st.bld).map(Number).find(v => st.bld[v].p === q);
  const target = st.board.verts[qv].hexes.find(h => h !== st.board.robber);
  const before = hand(st);
  G.act(ctx, p, { act: 'robber', h: target });
  if (st.step === 'steal') G.act(ctx, p, { act: 'steal', p: q });
  assert.equal(st.step, 'main');
  const after = hand(st);
  assert.equal(after[p] - before[p] + (after[(p + 2) % 3] - before[(p + 2) % 3]) + (after[q] - before[q]), 0, 'a steal moves a card, never creates one');
  assert.ok(conserved(st));
});

test('development cards: not on the turn bought, one per turn; knights earn Largest Army', async () => {
  const { G, ctx, st } = await game(3);
  playSetup(G, ctx, st);
  const p = st.turn;
  st.step = 'main';
  const give = (cost) => RES.forEach(r => { st.res[p][r] += cost[r] || 0; st.bank[r] -= cost[r] || 0; });
  give({ sheep: 1, wheat: 1, ore: 1 });
  st.devDeck.push('knight');
  assert.equal(G.act(ctx, p, { act: 'buydev' }), undefined);
  assert.match(G.act(ctx, p, { act: 'dev', card: 'knight' }), /bought this turn/);
  for (let k = 0; k < 3; k++) {
    st.devPlayed = false; st.step = 'main';
    st.dev[p].push({ type: 'knight', fresh: false });
    assert.equal(G.act(ctx, p, { act: 'dev', card: 'knight' }), undefined);
    if (k === 0) { st.dev[p].push({ type: 'knight', fresh: false }); assert.match(G.act(ctx, p, { act: 'dev', card: 'knight' }), /one development card per turn/); st.dev[p].pop(); }
    G.act(ctx, p, { act: 'robber', h: G.view(ctx, p).legal.robber[0] });
    if (st.step === 'steal') G.act(ctx, p, { act: 'steal', p: st.victims[0] });
  }
  assert.equal(st.knights[p], 3); assert.equal(st.largestArmy, p);
  assert.ok(conserved(st));
});

test('development cards: Monopoly, Year of Plenty and Road Building', async () => {
  const { G, ctx, st } = await game(3);
  playSetup(G, ctx, st);
  const p = st.turn, others = [0, 1, 2].filter(x => x !== p);
  st.step = 'main';
  // Monopoly on ore: everyone hands over all their ore
  others.forEach(o => setHand(st, o, { ...st.res[o], ore: 2 }));
  const oreBefore = st.res[p].ore;
  st.dev[p].push({ type: 'monopoly', fresh: false });
  G.act(ctx, p, { act: 'dev', card: 'monopoly', res: 'ore' });
  assert.equal(st.res[p].ore, oreBefore + 4); others.forEach(o => assert.equal(st.res[o].ore, 0));
  // Year of Plenty: two from the bank
  st.devPlayed = false; st.dev[p].push({ type: 'plenty', fresh: false });
  assert.match(G.act(ctx, p, { act: 'dev', card: 'plenty', res: 'wood' }), /Pick 2/);
  const wheat = st.res[p].wheat;
  G.act(ctx, p, { act: 'dev', card: 'plenty', res: 'wheat,wheat' });
  assert.equal(st.res[p].wheat, wheat + 2);
  // Road Building: two free roads
  st.devPlayed = false; st.dev[p].push({ type: 'roads', fresh: false });
  const roads = Object.values(st.roads).filter(x => x === p).length, cards = hand(st)[p];
  G.act(ctx, p, { act: 'dev', card: 'roads' });
  for (let k = 0; k < 2; k++) G.act(ctx, p, { act: 'build', kind: 'road', at: G.view(ctx, p).legal.road[0] });
  assert.equal(Object.values(st.roads).filter(x => x === p).length, roads + 2);
  assert.equal(hand(st)[p], cards, 'the roads were free');
  assert.equal(st.step, 'main');
  assert.ok(conserved(st));
});

test('trading: bank rates are enforced; a player trade happens only if both still have the cards', async () => {
  const { G, ctx, st } = await game(3);
  playSetup(G, ctx, st);
  const p = st.turn, q = (p + 1) % 3;
  st.step = 'main';
  setHand(st, p, { wood: 3 }); setHand(st, q, { ore: 1 });
  const rate = G._test.ratio(st, p, 'wood');
  if (rate === 4) assert.match(G.act(ctx, p, { act: 'bank', give: 'wood', get: 'ore' }), /need 4/);
  assert.equal(G.act(ctx, p, { act: 'offer', give: 'wood', want: 'ore' }), undefined);
  assert.match(G.act(ctx, (p + 2) % 3, { act: 'accept' }), /don't have/);
  assert.equal(G.act(ctx, q, { act: 'accept' }), undefined);
  assert.equal(st.res[p].ore, 1); assert.equal(st.res[q].wood, 1); assert.equal(st.offer, null);
  assert.ok(conserved(st));
});

test('winning: reaching the target on your turn ends the game (secret ⭐ cards count)', async () => {
  const { G, ctx, st } = await game(3, { target: 8 });
  playSetup(G, ctx, st);
  const p = st.turn;
  st.step = 'main';
  for (let k = 0; k < 6; k++) st.dev[p].push({ type: 'vp', fresh: false });   // 2 settlements + 6 = 8
  st.res[p].wood += 1; st.res[p].brick += 1; st.bank.wood -= 1; st.bank.brick -= 1;
  G.act(ctx, p, { act: 'build', kind: 'road', at: G.view(ctx, p).legal.road[0] });
  assert.ok(ctx.ended, 'the game ended');
  assert.equal(ctx.ended.results.find(r => r.won).name, ctx.players[p].name);
  assert.equal(ctx.ended.results.find(r => r.won).points, 8);
});

test('300 turns of random legal play never create or lose a resource', async () => {
  const { G, ctx, st } = await game(4);
  playSetup(G, ctx, st);
  const rand = seededRand(99), pick = a => a[rand(a.length)];
  for (let turn = 0; turn < 300 && !ctx.ended; turn++) {
    for (let guard = 0; guard < 40 && !ctx.ended; guard++) {
      const p = st.turn;
      Object.keys(st.discards || {}).forEach(q => {
        const cards = RES.flatMap(r => Array(st.res[q][r]).fill(r)).slice(0, st.discards[q]);
        G.act(ctx, +q, { act: 'discard', res: cards.join(',') });
      });
      const L = G.view(ctx, p).legal;
      if (st.step === 'roll') G.act(ctx, p, { act: 'roll' });
      else if (st.step === 'robber') G.act(ctx, p, { act: 'robber', h: pick(L.robber) });
      else if (st.step === 'steal') G.act(ctx, p, { act: 'steal', p: st.victims[0] });
      else if (st.step === 'roads') { if (L.road.length) G.act(ctx, p, { act: 'build', kind: 'road', at: pick(L.road) }); else st.step = 'main'; }
      else if (st.step === 'main') {
        const tries = [['city', L.city], ['settlement', L.settlement], ['road', L.road]].filter(([, l]) => l && l.length);
        for (const [kind, l] of tries) G.act(ctx, p, { act: 'build', kind, at: pick(l) });
        G.act(ctx, p, { act: 'buydev' });
        const playable = st.dev[p].find(d => !d.fresh && d.type !== 'vp');
        if (playable && !st.devPlayed) G.act(ctx, p, { act: 'dev', card: playable.type, res: playable.type === 'plenty' ? 'ore,wheat' : 'wood' });
        const give = RES.find(r => st.res[p][r] >= 4), get = RES.find(r => !st.res[p][r] && st.bank[r]);
        if (give && get && give !== get) G.act(ctx, p, { act: 'bank', give, get });
        if (st.step === 'main') { G.act(ctx, p, { act: 'end' }); break; }
      }
      assert.ok(conserved(st), `turn ${turn}: resources add up to 19 each`);
      assert.ok(Object.values(st.bank).every(x => x >= 0) && st.res.every(r => RES.every(k => r[k] >= 0)), 'no negative counts');
    }
  }
  [0, 1, 2, 3].forEach(p => {
    assert.ok(G._test.count(st, p, 'road') <= 15); assert.ok(G._test.count(st, p, 'settlement') <= 5); assert.ok(G._test.count(st, p, 'city') <= 4);
  });
});

/* ---------------- What each screen shows (privacy) ---------------- */
test('catan screens: a phone sees its own cards; of the others only counts; the Mac draws the board and every player', async () => {
  const { G, ctx, st } = await game(3);
  playSetup(G, ctx, st);
  st.res = [{ wood: 3, brick: 0, sheep: 1, wheat: 0, ore: 0 }, { wood: 0, brick: 4, sheep: 0, wheat: 2, ore: 0 }, { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 5 }];
  st.dev = [[{ type: 'knight' }], [{ type: 'vp' }, { type: 'monopoly' }], []];
  for (let i = 0; i < 3; i++) {
    const v = plain(G.view(ctx, i));
    assert.deepEqual(v.res, plain(st.res[i]));
    assert.deepEqual(v.dev.map(d => d.type), plain(st.dev[i].map(d => d.type)));
    v.players.forEach((p, q) => {
      assert.deepEqual(Object.keys(p).filter(k => ['res', 'dev'].includes(k)), [], 'no hidden cards of other players');
      assert.equal(p.cards, Object.values(st.res[q]).reduce((a, b) => a + b, 0));
      assert.equal(p.devs, st.dev[q].length);
    });
    if (i !== 1) assert.ok(!JSON.stringify(v).includes('monopoly'), 'Bob\'s development cards stay secret');
    if (i !== 1) assert.equal(v.players[1].vp, G.view(ctx, 1).players[1].vp, 'others see public points only (a hidden VP card is not counted)');
  }
  const host = G.hostHTML(ctx, { esc: t => t, color: () => '#888' });
  assert.match(host, /<svg/);
  ctx.players.forEach(p => assert.ok(host.includes(p.name)));
  assert.ok(G.phoneHTML(plain(G.view(ctx, st.turn)), {}, { esc: t => t, me: st.turn, seats: [] }).length > 200);
});
