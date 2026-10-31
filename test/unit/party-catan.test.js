// Catan rules (public/games/party/catan.js)
const test = require('node:test');
const { describe } = test;
const assert = require('node:assert/strict');
const { loadScripts, plain, partyCtx, seededRand, seededShuffle, flush } = require('./helpers');

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
describe('The board', () => {
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

  test('harbours: 9 fixed spots on the sea frame, evenly spread with no shared corners; only their types are shuffled', () => {
    const { newBoard, seaRing } = T();
    assert.equal(seaRing().length, 18);
    const spots = new Set(), types = new Set();
    for (let seed = 1; seed <= 20; seed++) {
      const rand = seededRand(seed), b = newBoard(rand, seededShuffle(rand));
      spots.add(JSON.stringify(plain(b.ports.map(p => [p.a, p.b]))));
      types.add(b.ports.map(p => p.type).join());
      // along the 30 coast edges (in order around the island) the harbours are 3 or 4 edges apart
      const coast = b.edges.map((e, i) => ({ e, i })).filter(o => o.e.hexes.length === 1)
        .sort((x, y) => { const ang = o => { const a = b.verts[o.e.a], c = b.verts[o.e.b]; return Math.atan2(a.y + c.y, a.x + c.x); }; return ang(x) - ang(y); });
      const at = b.ports.map(p => coast.findIndex(o => [o.e.a, o.e.b].sort().join() === [p.a, p.b].sort().join())).sort((x, y) => x - y);
      assert.ok(at.every(k => k >= 0), 'every harbour is on a coast edge');
      const gaps = at.map((k, j) => (at[(j + 1) % 9] - k + 30) % 30);
      assert.ok(gaps.every(g => g === 3 || g === 4), `gaps ${gaps}`);
      assert.equal(new Set(b.ports.flatMap(p => [p.a, p.b])).size, 18, 'no two harbours share a corner');
      for (const p of b.ports) assert.ok(Math.abs(p.x) + .34 <= 5.55 && Math.abs(p.y) + .34 <= 4.95, 'the token fits on the board (not cut off)');
    }
    assert.equal(spots.size, 1, 'the spots are fixed, like the printed frame');
    assert.ok(types.size > 1, 'the harbour types are shuffled');
  });

  test('the robber starts in the middle of the desert (no number token there)', () => {
    const { t, st } = bareState(4);
    const svg = t.boardSVG(t.boardData(st), ['#f00', '#0f0', '#00f']), d = st.board.hexes[st.board.robber];
    const [, cx] = svg.match(/<g pointer-events="none"><circle cx="([-\d.]+)"/);     // the robber is drawn first (with its hex)
    assert.equal(cx, (d.x * 46).toFixed(1));
    assert.ok(svg.includes('🦹'));
  });
});

/* ---------------- Placement ---------------- */
describe('Placement', () => {
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
});

/* ---------------- Longest Road ---------------- */
describe('Longest Road', () => {
  test('straight runs, branches, loops, and roads broken by an opponent', () => {
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
});

/* ---------------- Harbours and production ---------------- */

function productionCtx(seed = 3) {
  const { t, st } = bareState(seed);
  const ctx = partyCtx(3); ctx.state = st;
  return { t, st, ctx };
}
describe('Harbours and production', () => {
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
});

/* ---------------- Playing through act() ---------------- */
async function game(n = 3, opts = {}) {
  const G = load(), ctx = partyCtx(n, { opts, rand: seededRand(11) });
  await G.start(ctx);
  G.hostAct(ctx, { host: 'useBoard' });                                // keep the first island
  while (ctx.state.step === 'order') G.act(ctx, ctx.state.turn, { act: 'orderRoll' });
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
describe('Playing through act()', () => {
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

  test('trading with players: offers to everyone or to chosen players, requests to the active player; accept, decline, counter', async () => {
    const { G, ctx, st } = await game(3);
    playSetup(G, ctx, st);
    const p = st.turn, q = (p + 1) % 3, o = (p + 2) % 3, both = () => ({ p: plain(st.res[p]), q: plain(st.res[q]), o: plain(st.res[o]) });
    setHand(st, p, { wood: 3 }); setHand(st, q, { ore: 1 }); setHand(st, o, { sheep: 1 });
    assert.match(G.act(ctx, o, { act: 'offer', give: 'sheep', want: 'wood' }), /once .* has rolled/, 'no trading before the roll');
    st.step = 'main';
    // to everyone: several answers, so the offerer picks one
    assert.equal(G.act(ctx, p, { act: 'offer', give: 'wood', want: 'ore' }), undefined);
    assert.deepEqual(plain(st.trades[0].to), [q, o].sort((x, y) => x - y));
    assert.match(G.act(ctx, o, { act: 'reply', id: st.trades[0].id, r: 'accept' }), /don't have/);
    G.act(ctx, o, { act: 'reply', id: st.trades[0].id, r: 'decline' });
    const before = both();
    G.act(ctx, q, { act: 'reply', id: st.trades[0].id, r: 'accept' });
    assert.deepEqual(both(), before, 'nothing moves until the offerer confirms');
    assert.match(G.act(ctx, p, { act: 'confirm', id: st.trades[0].id, p: o }), /haven't agreed/);
    assert.equal(G.act(ctx, p, { act: 'confirm', id: st.trades[0].id, p: q }), undefined);
    assert.equal(st.res[p].ore, 1); assert.equal(st.res[q].wood, 1); assert.equal(st.trades.length, 0);
    // to one chosen player: their yes is the trade
    setHand(st, q, { ore: 1 });
    G.act(ctx, p, { act: 'offer', give: 'wood', want: 'ore', to: String(q) });
    assert.deepEqual(plain(st.trades[0].to), [q]);
    assert.match(G.act(ctx, o, { act: 'reply', id: st.trades[0].id, r: 'accept' }), /no longer open/, 'not sent to them');
    G.act(ctx, q, { act: 'reply', id: st.trades[0].id, r: 'accept' });
    assert.equal(st.res[q].wood, 1); assert.equal(st.trades.length, 0);
    // a counter-offer (several resources on each side) goes back to the offerer
    setHand(st, p, { wood: 3, brick: 1 }); setHand(st, q, { ore: 2, wheat: 1 });
    G.act(ctx, p, { act: 'offer', give: 'wood', want: 'ore', to: String(q) });
    assert.match(G.act(ctx, q, { act: 'reply', id: st.trades[0].id, r: 'counter', give: 'wood,wood,brick', want: 'ore,ore,ore' }), /don't have the cards you would give/);
    G.act(ctx, q, { act: 'reply', id: st.trades[0].id, r: 'counter', give: 'wood,wood,brick', want: 'ore,wheat' });
    assert.equal(st.res[q].ore, 2, 'a counter waits for the offerer');
    G.act(ctx, p, { act: 'confirm', id: st.trades[0].id, p: q });
    assert.deepEqual(plain(st.res[p]), { wood: 1, brick: 0, sheep: 0, wheat: 1, ore: 1 });
    assert.deepEqual(plain(st.res[q]), { wood: 2, brick: 1, sheep: 0, wheat: 0, ore: 1 });
    // a request from another player to the active player; a new one replaces the old
    setHand(st, o, { sheep: 2 });
    G.act(ctx, o, { act: 'offer', give: 'sheep', want: 'wood' });
    G.act(ctx, o, { act: 'offer', give: 'sheep,sheep', want: 'wood' });
    assert.equal(st.trades.length, 1); assert.deepEqual(plain(st.trades[0].to), [p], 'a request always goes to the active player');
    assert.equal(st.trades[0].give.sheep, 2);
    assert.ok(!JSON.stringify(G.view(ctx, q).trades).includes('sheep'), 'others don\'t see it');
    G.act(ctx, p, { act: 'reply', id: st.trades[0].id, r: 'accept' });
    assert.equal(st.res[p].sheep, 2); assert.equal(st.res[o].wood, 1);
    // offline players can't be sent a trade; "everyone" means everyone online
    ctx.online = k => k !== o;
    setHand(st, p, { ...st.res[p], wood: 2 });
    assert.match(G.act(ctx, p, { act: 'offer', give: 'wood', want: 'ore', to: String(o) }), /offline/);
    G.act(ctx, p, { act: 'offer', give: 'wood', want: 'ore' });
    assert.deepEqual(plain(st.trades[0].to), [q]);
    assert.equal(G.view(ctx, p).players.find(x => x.i === o).online, false);
    G.act(ctx, p, { act: 'withdraw' });
    assert.equal(st.trades.length, 0);
    G.act(ctx, p, { act: 'offer', give: 'wood', want: 'ore' });
    G.act(ctx, p, { act: 'end' });
    assert.equal(st.trades.length, 0, 'open trades end with the turn');
    assert.ok(conserved(st));
  });

  test('trading with the bank: mix resources and rates in one trade, in whole lots at your rates', async () => {
    const { G, ctx, st } = await game(3);
    playSetup(G, ctx, st);
    const p = st.turn, rate = r => G._test.ratio(st, p, r);
    st.step = 'main';
    setHand(st, p, { wood: 3 });
    if (rate('wood') === 4) assert.match(G.act(ctx, p, { act: 'bank', give: 'wood', get: 'ore' }), /need 4/, 'a single resource means one lot at your rate');
    const [a, b] = ['wood', 'sheep'], la = rate(a), lb = rate(b);
    setHand(st, p, { [a]: la + 1, [b]: lb });
    const cards = (r, n) => Array(n).fill(r);
    assert.match(G.act(ctx, p, { act: 'bank', give: [...cards(a, la + 1), ...cards(b, lb)].join(','), get: 'brick,wheat' }), /at a time/);
    assert.match(G.act(ctx, p, { act: 'bank', give: [...cards(a, la), ...cards(b, lb)].join(','), get: 'brick' }), /buys 2 cards/);
    assert.match(G.act(ctx, p, { act: 'bank', give: [...cards(a, la), ...cards(b, lb)].join(','), get: 'wood,wheat' }), /take back/);
    assert.equal(G.act(ctx, p, { act: 'bank', give: [...cards(a, la), ...cards(b, lb)].join(','), get: 'brick,wheat' }), undefined);
    assert.deepEqual(plain(st.res[p]), { ...empty(), [a]: 1, brick: 1, wheat: 1 });
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

  test('before setup: the host keeps the island or shuffles a new one; then everyone rolls for turn order', async () => {
    const { firstPlayer, seatOrder } = T();
    assert.equal(firstPlayer([{ p: 2, t: 9 }, { p: 0, t: 11 }, { p: 1, t: 11 }]), 0, 'a tie on 11: whoever rolled it first starts');
    assert.equal(firstPlayer([{ p: 1, t: 4 }, { p: 2, t: 12 }, { p: 0, t: 7 }]), 2);
    assert.deepEqual(plain(seatOrder({ first: 2 }, 4)), [2, 3, 0, 1], 'then seat order from the starter');
    const G = load(), ctx = partyCtx(4, { rand: seededRand(3) });
    await G.start(ctx);
    const st = ctx.state;
    assert.equal(st.step, 'board'); assert.deepEqual(plain(G.view(ctx, 0).legal), {});
    assert.equal(G.act(ctx, 0, { act: 'orderRoll' }), undefined); assert.equal(st.order, null, 'no rolling before the island is chosen');
    const layout = () => JSON.stringify(st.board.hexes.map(h => h.res + h.num));
    const first = layout();
    G.hostAct(ctx, { host: 'newBoard' });
    assert.notEqual(layout(), first, 'a new island'); assert.equal(st.boards, 2);
    G.hostAct(ctx, { host: 'useBoard' });
    assert.equal(st.step, 'order');
    assert.deepEqual(plain(st.order.queue).sort(), [0, 1, 2, 3]);
    assert.match(G.act(ctx, st.order.queue[1], { act: 'orderRoll' }), /not your turn/, 'players roll when called');
    const kept = layout();
    G.hostAct(ctx, { host: 'newBoard' });
    assert.equal(layout(), kept, 'the island is fixed once chosen');
    while (st.step === 'order') G.act(ctx, st.turn, { act: 'orderRoll' });
    assert.deepEqual(plain(st.order.rolls.map(r => r.p)), plain(st.order.queue), 'each player rolled once, in the called order');
    assert.equal(st.first, firstPlayer(st.order.rolls));
    assert.ok(ctx.logLines.some(l => l.includes('Turn order:')));
    const f = st.first, v = plain(G.view(ctx, 0));
    assert.ok(v.ordered); assert.deepEqual(v.players.map(p => p.i), [0, 1, 2, 3].map(k => (f + k) % 4), 'phones list players in turn order');
    assert.deepEqual(playSetup(G, ctx, st), [0, 1, 2, 3, 3, 2, 1, 0].map(k => (f + k) % 4).map((x, j) => (j < 4 ? x : (f + 7 - j) % 4)));
    assert.equal(st.turn, f);
  });

  test('turn timer: when time runs out the game plays on for you (order roll, setup, roll, discards, robber, end of turn)', async () => {
    const G = load(), ctx = partyCtx(3, { opts: { turnTime: 60 }, rand: seededRand(5) });
    await G.start(ctx);
    const st = ctx.state;
    assert.equal(st.turnTime, 60);
    G.hostAct(ctx, { host: 'useBoard' });
    while (st.step === 'order') { ctx.expire(); await flush(); }
    assert.equal(st.order.rolls.length, 3, 'nobody tapped: everyone was rolled for');
    for (let k = 0; k < 10 && st.step.startsWith('setup'); k++) { ctx.expire(); await flush(); }
    assert.equal(st.step, 'roll'); assert.equal(Object.keys(st.bld).length, 6); assert.equal(Object.keys(st.roads).length, 6);
    // a 7 while another player holds 8 cards: the discard clock runs out, then the turn clock
    const p = st.turn, q = (p + 1) % 3;
    setHand(st, q, { wood: 4, brick: 4 });
    const keep = ctx.rand;
    ctx.rand = (() => { const seq = [2, 3]; let i = 0; return () => seq[i++ % 2]; })();   // dice 3 + 4
    G.act(ctx, p, { act: 'roll' });
    ctx.rand = keep;
    assert.equal(st.step, 'discard');
    ctx.expire(); await flush();
    assert.equal(hand(st)[q], 4, 'random discard of half');
    assert.equal(st.step, 'robber');
    ctx.expire(); await flush();
    assert.equal(st.turn, (p + 1) % 3, 'the robber was moved for them and the turn passed on');
    assert.equal(st.step, 'roll');
    assert.ok(ctx.logLines.some(l => l.includes("Time's up")));
    assert.ok(conserved(st));
    // the next player sits it out entirely: rolled for, then the turn ends
    const r = st.turn;
    st.trades = [{ id: 99, from: r, to: [(r + 1) % 3], give: { ...empty(), wood: 1 }, want: { ...empty(), ore: 1 }, replies: {} }];
    ctx.expire(); await flush();
    assert.notEqual(st.turn, r); assert.ok(st.turnNo > 1); assert.equal(st.trades.length, 0, 'an open offer is withdrawn');
  });

  test('cards changing hands: production from the hex, a steal face down for all but the two players, development cards never named', async () => {
    const { G, ctx, st } = await game(3);
    playSetup(G, ctx, st);
    assert.ok(st.flows.some(f => /^h\d+$/.test(f.from) && typeof f.to === 'number'), 'the second settlements collected from their hexes');
    const p = st.turn, q = (p + 1) % 3, o = (p + 2) % 3, H = { esc: x => x, color: () => '#888' }, HP = { esc: x => x, me: q, seats: [] };
    const localQ = {};
    G.hostHTML(ctx, H); G.phoneHTML(plain(G.view(ctx, q)), localQ, HP);         // what's on screen before
    setHand(st, q, { ore: 2 });
    st.step = 'robber'; st.afterRobber = 'main';
    const qv = Object.keys(st.bld).map(Number).find(v => st.bld[v].p === q);
    G.act(ctx, p, { act: 'robber', h: st.board.verts[qv].hexes.find(h => h !== st.board.robber) });
    if (st.step === 'steal') G.act(ctx, p, { act: 'steal', p: q });
    const last = st.flows.at(-1);
    assert.deepEqual([last.from, last.to, last.r, last.secret], [q, p, 'ore', true]);
    assert.equal(G.view(ctx, p).flows.at(-1).r, 'ore'); assert.equal(G.view(ctx, q).flows.at(-1).r, 'ore');
    assert.equal(G.view(ctx, o).flows.at(-1).r, 'hidden', 'the third player only sees a card back');
    assert.equal(G._test.flowsFor(st, -1).at(-1).r, 'hidden', 'so does the Mac');
    const host = G.hostHTML(ctx, H);
    assert.match(host, /cat-glow/); assert.match(host, /−1 🂠/); assert.ok(!host.includes('−1 ⛰️'), 'the Mac doesn\'t name the stolen card');
    assert.match(G.phoneHTML(plain(G.view(ctx, q)), localQ, HP), /r-ore cat-down" data-d="-1"/, 'the victim\'s ore glows red');
    // buying a development card: a purple back, never the card
    st.step = 'main';
    setHand(st, p, { sheep: 1, wheat: 1, ore: 1 });
    st.devDeck.push('monopoly');
    G.act(ctx, p, { act: 'buydev' });
    assert.equal(st.flows.at(-1).r, 'dev');
    for (const i of [0, 1, 2]) assert.ok(!JSON.stringify(G.view(ctx, i).flows).includes('monopoly'));
    // a bank trade: the cards go to the bank, one comes back
    setHand(st, p, { wood: 4 });
    G.act(ctx, p, { act: 'bank', give: 'wood', get: 'brick' });
    const [give, get] = st.flows.slice(-2);
    assert.equal(give.to, 'bank'); assert.equal(give.r, 'wood'); assert.ok(give.n >= 2);
    assert.deepEqual([get.from, get.to, get.r, get.n], ['bank', p, 'brick', 1]);
  });

  test('dice: everyone sees both dice of every roll (and the last roll until the next one)', async () => {
    const { G, ctx, st } = await game(3);
    const HP = { esc: x => x, me: 0, seats: [] }, dieCount = html => (html.match(/class="cat-die"/g) || []).length;
    assert.ok(st.order.rolls.every(r => r.d.length === 2 && r.t === r.d[0] + r.d[1]));
    assert.ok(ctx.logLines.some(l => /for turn order/.test(l) && /\(\d \+ \d\)/.test(l)), 'the log shows both dice');
    playSetup(G, ctx, st);
    const p = st.turn;
    G.act(ctx, p, { act: 'roll' });
    for (const i of [0, 1, 2]) {
      const v = plain(G.view(ctx, i));
      assert.deepEqual(v.dice, plain(st.dice), 'every phone gets both dice');
      assert.equal(dieCount(G.phoneHTML(v, {}, { ...HP, me: i })), 2);
    }
    assert.equal(dieCount(G.hostHTML(ctx, { esc: x => x, color: () => '#888' })), 2);
    assert.ok(ctx.said.some(t => new RegExp(`rolls ${st.dice[0]} and ${st.dice[1]}`).test(t)));
    // the next turn: no new roll yet, so everyone still sees who rolled what last
    if (st.step === 'discard') Object.keys(st.discards).forEach(q => G.act(ctx, +q, { act: 'discard', res: RES.flatMap(r => Array(st.res[q][r]).fill(r)).slice(0, st.discards[q]).join(',') }));
    if (st.step === 'robber') G.act(ctx, p, { act: 'robber', h: G.view(ctx, p).legal.robber[0] });
    if (st.step === 'steal') G.act(ctx, p, { act: 'steal', p: st.victims[0] });
    const last = plain(st.dice);
    G.act(ctx, p, { act: 'end' });
    const v = plain(G.view(ctx, (p + 2) % 3));
    assert.equal(v.dice, null); assert.deepEqual(v.lastRoll, { name: ctx.players[p].name, d: last });
    assert.equal(dieCount(G.phoneHTML(v, {}, HP)), 2);
  });

  test('phone board: big invisible tap areas around corners and roads, not overlapping their neighbours', async () => {
    const { G, ctx, st } = await game(3);
    const t = G._test, b = t.boardData(st);
    const corners = G.view(ctx, st.turn).legal.settlement;
    const svg = t.boardSVG(b, ['#f00', '#0f0', '#00f'], { hl: { settlement: corners } });
    assert.equal((svg.match(/r="21" fill="transparent" class="pick-hit"/g) || []).length, corners.length);
    const d = Math.min(...st.board.edges.map(e => Math.hypot(st.board.verts[e.a].x - st.board.verts[e.b].x, st.board.verts[e.a].y - st.board.verts[e.b].y))) * 46;
    assert.ok(2 * 21 < d, 'neighbouring corner targets (one edge apart) don\'t overlap');
    const roads = t.boardSVG(b, ['#f00', '#0f0', '#00f'], { hl: { road: [0, 1, 2] } });
    assert.equal((roads.match(/stroke-width="30" class="pick-hit"/g) || []).length, 3);
  });
});

/* ---------------- Leaving mid-game ---------------- */
// Roads of exactly `len` edges, on corners nobody else uses (so the lengths are exact)
function giveRoad(st, p, len) {
  const used = new Set(Object.keys(st.roads).flatMap(e => [st.board.edges[e].a, st.board.edges[e].b]));
  for (let v = 0; v < st.board.verts.length; v++) {
    if (used.has(v)) continue;
    const seen = new Set([v]), edges = [];
    const go = (at, left) => {
      if (!left) return true;
      for (const e of st.board.verts[at].edges) {
        const ed = st.board.edges[e], w = ed.a === at ? ed.b : ed.a;
        if (seen.has(w) || used.has(w) || st.board.verts[w].adj.some(x => used.has(x) && !seen.has(x))) continue;
        seen.add(w); edges.push(e);
        if (go(w, left - 1)) return true;
        seen.delete(w); edges.pop();
      }
      return false;
    };
    if (go(v, len)) { edges.forEach(e => { st.roads[e] = p; }); return; }
  }
  throw new Error('no room for a road of ' + len);
}
async function leaveGame(n = 3) {
  const g = await game(n);
  playSetup(g.G, g.ctx, g.st);
  g.st.bld = {}; g.st.roads = {}; g.st.longestRoad = null; g.st.largestArmy = null;
  return g;
}
describe('Leaving mid-game', () => {
  test('a player leaves: their pieces come off, their cards go back, their turn passes, trades with them end', async () => {
    const { G, ctx, st } = await leaveGame(3);
    const p = st.turn, q = (p + 1) % 3, o = (p + 2) % 3;
    giveRoad(st, q, 3); st.bld[st.board.edges[Object.keys(st.roads)[0]].a] = { p: q, city: true };
    setHand(st, q, { wood: 2, ore: 3 });
    st.dev[q] = [{ type: 'knight' }, { type: 'vp' }];
    const deck = st.devDeck.length;
    st.step = 'main';
    setHand(st, p, { sheep: 1 });
    G.act(ctx, p, { act: 'offer', give: 'sheep', want: 'ore' });
    G.act(ctx, o, { act: 'offer', give: 'brick', want: 'wood' });     // o has no brick: refused, fine
    G.playerLeft(ctx, q);
    assert.ok(!Object.values(st.roads).includes(q) && !Object.values(st.bld).some(b => b.p === q), 'roads and buildings are gone');
    assert.equal(hand(st)[q], 0); assert.ok(conserved(st), 'their cards are back in the bank');
    assert.equal(st.devDeck.length, deck + 2, 'their development cards are back in the deck');
    assert.deepEqual(plain(st.trades[0].to), [o], 'an offer to everyone now goes to the others only');
    assert.match(G.act(ctx, p, { act: 'offer', give: 'sheep', want: 'ore', to: String(q) }), /offline/);
    assert.equal(G.view(ctx, p).players.find(x => x.i === q).left, true);
    // the player on turn leaves: the next one plays, and the leaver is skipped from now on
    G.playerLeft(ctx, p);
    assert.ok(ctx.ended, 'two of three left: the last one wins');
    assert.equal(ctx.ended.results.find(r => r.won).name, ctx.players[o].name);
    assert.deepEqual(ctx.ended.results.filter(r => r.left).map(r => r.name).sort(), [ctx.players[p].name, ctx.players[q].name].sort());
  });

  test('a player leaves on their turn: the turn passes on, and seat order skips them', async () => {
    const { G, ctx, st } = await leaveGame(4);
    const p = st.turn, nx = (p + 1) % 4;
    st.step = 'main';
    G.playerLeft(ctx, nx);                              // the next player leaves first
    G.playerLeft(ctx, p);                               // then the player on turn
    assert.equal(st.turn, (p + 2) % 4); assert.equal(st.step, 'roll');
    G.act(ctx, st.turn, { act: 'roll' });
    if (st.step === 'main') { G.act(ctx, st.turn, { act: 'end' }); assert.equal(st.turn, (p + 3) % 4); }
  });

  test('leaving during setup and during the roll for turn order', async () => {
    const G = load(), ctx = partyCtx(4, { rand: seededRand(8) });
    await G.start(ctx);
    const st = ctx.state;
    G.hostAct(ctx, { host: 'useBoard' });
    const first = st.turn;
    G.act(ctx, first, { act: 'orderRoll' });
    G.playerLeft(ctx, first);                           // rolled, then left: their roll doesn't count
    assert.ok(!st.order.rolls.some(r => r.p === first) && !st.order.queue.includes(first));
    while (st.step === 'order') G.act(ctx, st.turn, { act: 'orderRoll' });
    assert.notEqual(st.first, first);
    // setup: someone leaves while placing; the snake order goes on without them
    const placer = st.turn;
    G.act(ctx, placer, { act: 'build', kind: 'settlement', at: G.view(ctx, placer).legal.settlement[0] });
    G.playerLeft(ctx, placer);
    const order = playSetup(G, ctx, st);
    assert.ok(!order.includes(placer) && !order.includes(first));
    assert.equal(order.length, 4, 'two players, two settlements each');
    assert.equal(Object.keys(st.bld).length, 4);
  });

  test('Longest Road and Largest Army when the holder leaves: the single runner-up, or on a tie whoever got there first', async () => {
    const { G, ctx, st } = await leaveGame(4);
    const [a, b, c, d] = [0, 1, 2, 3], up = () => G._test.updateAwards(ctx);
    giveRoad(st, a, 7); up();
    assert.equal(st.longestRoad, a);
    giveRoad(st, b, 6); up();                           // b reaches 6 first
    giveRoad(st, c, 6); up();                           // then c
    assert.equal(st.longestRoad, a, 'a still holds it');
    st.knights = [4, 0, 0, 0]; up();
    assert.equal(st.largestArmy, a);
    st.knights[c] = 3; up();                            // c reaches 3 knights first, then d, then b
    st.knights[d] = 3; up();
    st.knights[b] = 3; up();
    G.playerLeft(ctx, a);
    assert.equal(st.longestRoad, b, 'tie at 6: b got there first');
    assert.equal(st.largestArmy, c, 'tie at 3 knights: c got there first (not seat order)');
    // the single runner-up: c's road is longer than d's when b leaves
    giveRoad(st, d, 5); up();
    G.playerLeft(ctx, b);
    assert.equal(st.longestRoad, c, 'the single longest of the rest');
    assert.equal(st.largestArmy, c, 'c keeps it');
  });

  test('Longest Road: a road cut in normal play still follows the official rule (a tie at the top: nobody)', () => {
    const { successor, award } = T();
    assert.equal(award(0, [3, 6, 6], 5), null, 'cut road, two tied above: nobody');
    assert.equal(successor([0, 6, 6], [0, 9, 4], 5, { out: [true, false, false] }), 2, 'holder left, tie: who got there first');
    assert.equal(successor([0, 4, 3], [0, 1, 1], 5, { out: [true] }), null, 'nobody long enough');
    assert.equal(successor([9, 5, 7], [0, 1, 1], 5, { out: [true] }), 2, 'the leaver\'s own road never counts');
  });
});

/* ---------------- What each screen shows (privacy) ---------------- */
describe('What each screen shows (privacy)', () => {
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
});
