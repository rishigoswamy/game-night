// Catan for Casino: the board and scoreboard are on the Mac; every player builds, trades and plays from their phone.
window.PARTY_GAME = (() => {
  const RES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
  const ICON = { wood: '🌲', brick: '🧱', sheep: '🐑', wheat: '🌾', ore: '⛰️', desert: '🏜️', any: '❓' };
  const RNAME = { wood: 'Wood', brick: 'Brick', sheep: 'Sheep', wheat: 'Wheat', ore: 'Ore' };
  const FILL = { wood: '#2f7a3a', brick: '#b5542d', sheep: '#8cc152', wheat: '#e6b93a', ore: '#8a8f98', desert: '#d9c38f' };
  const COST = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, dev: { sheep: 1, wheat: 1, ore: 1 } };
  const LIMIT = { road: 15, settlement: 5, city: 4 };
  const DEV = { knight: ['Knight', '⚔️', 'Move the robber and steal a card from a player next to it.'], vp: ['Victory Point', '⭐', 'Worth 1 victory point. Keep it secret!'],
    roads: ['Road Building', '🛣️', 'Build 2 roads for free.'], plenty: ['Year of Plenty', '🎁', 'Take any 2 resources from the bank.'], monopoly: ['Monopoly', '💰', 'Name a resource: every other player gives you all of theirs.'] };
  const fmtRes = obj => RES.filter(r => obj[r]).map(r => `${obj[r]} ${ICON[r]}`).join(' ');
  const total = obj => RES.reduce((a, r) => a + (obj[r] || 0), 0);
  const has = (obj, cost) => RES.every(r => (obj[r] || 0) >= (cost[r] || 0));
  const pay = (from, to, cost) => RES.forEach(r => { from[r] -= cost[r] || 0; to[r] += cost[r] || 0; });

  /* ---------- Board geometry: 19 pointy-top hexes, 54 corners, 72 edges ---------- */
  function geometry() {
    const hexes = [], verts = [], edges = [], vkey = new Map(), ekey = new Map();
    const S3 = Math.sqrt(3);
    for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
      if (Math.abs(q + r) > 2) continue;
      hexes.push({ q, r, x: S3 * (q + r / 2), y: 1.5 * r, v: [] });
    }
    hexes.forEach((h, hi) => {
      const corners = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 180 * (60 * k - 30), x = h.x + Math.cos(a), y = h.y + Math.sin(a);
        const key = `${Math.round(x * 100)},${Math.round(y * 100)}`;
        if (!vkey.has(key)) { vkey.set(key, verts.length); verts.push({ x, y, hexes: [], adj: [], edges: [] }); }
        const vi = vkey.get(key);
        verts[vi].hexes.push(hi); corners.push(vi);
      }
      h.v = corners;
      for (let k = 0; k < 6; k++) {
        const a = corners[k], b = corners[(k + 1) % 6], key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!ekey.has(key)) {
          ekey.set(key, edges.length);
          edges.push({ a, b, hexes: [] });
          verts[a].adj.push(b); verts[b].adj.push(a);
          verts[a].edges.push(edges.length - 1); verts[b].edges.push(edges.length - 1);
        }
        edges[ekey.get(key)].hexes.push(hi);
      }
    });
    return { hexes, verts, edges };
  }
  function newBoard(rand, shuffle) {
    const g = geometry();
    const tiles = shuffle(['wood', 'wood', 'wood', 'wood', 'brick', 'brick', 'brick', 'sheep', 'sheep', 'sheep', 'sheep', 'wheat', 'wheat', 'wheat', 'wheat', 'ore', 'ore', 'ore', 'desert']);
    g.hexes.forEach((h, k) => { h.res = tiles[k]; });
    // number tokens: no 6 or 8 next to another 6 or 8
    const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1.9;
    for (let tries = 0; tries < 500; tries++) {
      const nums = shuffle([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
      g.hexes.forEach(h => { h.num = h.res === 'desert' ? null : nums.pop(); });
      const hot = g.hexes.filter(h => h.num === 6 || h.num === 8);
      if (!hot.some((a, i) => hot.some((b, j) => j > i && near(a, b)))) break;
    }
    // 9 harbors on the fixed spots of the sea frame (official variable setup: the spots stay, the harbor types are shuffled)
    const types = shuffle(['any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'wheat', 'ore']);
    g.ports = harborSpots(g).map((o, k) => ({ type: types[k], ...o }));
    g.robber = g.hexes.findIndex(h => h.res === 'desert');
    return g;
  }
  // The sea frame: a ring of 18 sea hexes around the island. Every 3rd one is a corner (touching 1 land hex, 1 coast
  // edge); the others touch 2 land hexes (2 coast edges). As on the printed frame, every other sea hex holds a harbor:
  // 3 corners and 6 sides. A side harbor faces the edge that keeps the 9 harbors evenly spread along the 30 coast edges
  // (gaps of 3, 4, 3 ...), so no two harbors share a corner.
  function seaRing() {
    const S3 = Math.sqrt(3), dir = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]], ring = [];
    let q = dir[4][0] * 3, r = dir[4][1] * 3;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { ring.push({ q, r, x: S3 * (q + r / 2), y: 1.5 * r }); q += dir[i][0]; r += dir[i][1]; }
    return ring;
  }
  function harborSpots(g) {
    const ring = seaRing(), near = (p, s) => Math.abs(Math.hypot(p.x - s.x, p.y - s.y) - 1) < .01;
    const coastOf = s => g.edges.map((e, i) => ({ i, e })).filter(o => o.e.hexes.length === 1 && near(g.verts[o.e.a], s) && near(g.verts[o.e.b], s));
    return ring.map((s, k) => ({ s, k })).filter(o => o.k % 2 === 0).map(({ s, k }) => {
      let edges = coastOf(s);
      if (edges.length === 2) {                                    // order the two edges along the ring: the one nearer the previous sea hex first
        const prev = ring[(k + 17) % 18], mid = o => { const a = g.verts[o.e.a], b = g.verts[o.e.b]; return Math.hypot((a.x + b.x) / 2 - prev.x, (a.y + b.y) / 2 - prev.y); };
        edges = edges.sort((x, y) => mid(x) - mid(y));
        edges = [edges[k % 6 === 2 ? 0 : 1]];
      }
      const e = edges[0].e, a = g.verts[e.a], b = g.verts[e.b], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      return { a: e.a, b: e.b, x: mx + (s.x - mx) * .62, y: my + (s.y - my) * .62 };     // the token sits in the sea hex, towards the coast
    });
  }

  /* ---------- Rules helpers ---------- */
  const owner = (st, v) => st.bld[v] ? st.bld[v].p : null;
  function canSettle(st, p, v, setup) {
    if (st.bld[v]) return false;
    if (st.board.verts[v].adj.some(w => st.bld[w])) return false;                 // distance rule
    if (setup) return true;
    return st.board.verts[v].edges.some(e => st.roads[e] === p);
  }
  function canRoad(st, p, e, setupFrom) {
    if (st.roads[e] != null) return false;
    const { a, b } = st.board.edges[e];
    if (setupFrom != null) return a === setupFrom || b === setupFrom;
    return [a, b].some(w => owner(st, w) === p || (owner(st, w) == null && st.board.verts[w].edges.some(f => f !== e && st.roads[f] === p)));
  }
  function count(st, p, kind) {
    if (kind === 'road') return Object.values(st.roads).filter(x => x === p).length;
    return Object.values(st.bld).filter(b => b.p === p && (kind === 'city' ? b.city : !b.city)).length;
  }
  function legal(st, p) {
    const V = st.board.verts.map((_, i) => i), E = st.board.edges.map((_, i) => i);
    if (st.step === 'setup-settle') return { settlement: V.filter(v => canSettle(st, p, v, true)) };
    if (st.step === 'setup-road') return { road: E.filter(e => canRoad(st, p, e, st.lastSettle)) };
    if (st.step === 'robber') return { robber: st.board.hexes.map((_, i) => i).filter(i => i !== st.board.robber) };
    const out = {};
    if (st.step === 'main' || st.step === 'roads') {
      out.road = count(st, p, 'road') < LIMIT.road ? E.filter(e => canRoad(st, p, e)) : [];
      if (st.step === 'main') {
        out.settlement = count(st, p, 'settlement') < LIMIT.settlement ? V.filter(v => canSettle(st, p, v)) : [];
        out.city = count(st, p, 'city') < LIMIT.city ? V.filter(v => st.bld[v] && st.bld[v].p === p && !st.bld[v].city) : [];
      }
    }
    return out;
  }
  // Longest continuous road of player p (can't run through another player's settlement or city)
  function longest(st, p) {
    const mine = Object.keys(st.roads).map(Number).filter(e => st.roads[e] === p);
    let best = 0;
    const walk = (v, used) => {
      let m = 0;
      for (const e of st.board.verts[v].edges) {
        if (st.roads[e] !== p || used.has(e)) continue;
        const ed = st.board.edges[e], w = ed.a === v ? ed.b : ed.a;
        used.add(e);
        const blocked = owner(st, w) != null && owner(st, w) !== p;
        m = Math.max(m, 1 + (blocked ? 0 : walk(w, used)));
        used.delete(e);
      }
      return m;
    };
    new Set(mine.flatMap(e => [st.board.edges[e].a, st.board.edges[e].b])).forEach(v => { best = Math.max(best, walk(v, new Set())); });
    return best;
  }
  // The holder keeps an award on a tie; it moves only to someone strictly ahead (none if tied without the holder)
  function award(cur, vals, min) {
    const max = Math.max(...vals);
    if (max < min) return null;
    const top = vals.map((x, i) => x === max ? i : -1).filter(i => i >= 0);
    if (cur != null && top.includes(cur)) return cur;
    return top.length === 1 ? top[0] : null;
  }
  // When the holder leaves the game, the title goes to the longest road (largest army) among the rest, if long enough;
  // on a tie, to whoever reached that length first (`since`: when each player's length last changed)
  function successor(vals, since, min, st) {
    const ok = vals.map((x, p) => (out(st, p) ? -1 : x)), max = Math.max(...ok);
    if (max < min) return null;
    return ok.map((x, p) => (x === max ? p : -1)).filter(p => p >= 0).sort((a, b) => since[a] - since[b] || a - b)[0];
  }
  function updateAwards(ctx, leaver) {
    const st = ctx.state, len = ctx.players.map((_, p) => (out(st, p) ? 0 : longest(st, p)));
    // the history for that: a counter for each update, and when each road length / army size was reached
    const h = st.since = st.since || { ev: 0, road: [], army: [], knights: [] };
    h.ev++;
    len.forEach((x, p) => { if (h.road[p] == null || x !== st.roadLen[p]) h.road[p] = h.ev; });
    st.knights.forEach((k, p) => { if (h.army[p] == null || k !== h.knights[p]) { h.army[p] = h.ev; h.knights[p] = k; } });
    st.roadLen = len;
    const holderLeft = (cur, vals, since, min) => (leaver != null && cur === leaver ? successor(vals, since, min, st) : award(cur, vals, min));
    const lr = holderLeft(st.longestRoad, len, h.road, 5), la = holderLeft(st.largestArmy, st.knights, h.army, 3);
    if (lr !== st.longestRoad) { ctx.log(lr == null ? '🛣️ Nobody holds Longest Road now.' : `🛣️ ${ctx.players[lr].name} takes Longest Road (${len[lr]}).`); if (lr != null) ctx.say(`${ctx.players[lr].name} has the longest road!`, 'pay'); }
    if (la !== st.largestArmy) { ctx.log(la == null ? '⚔️ Nobody holds Largest Army now.' : `⚔️ ${ctx.players[la].name} takes Largest Army (${st.knights[la]} knights).`); if (la != null) ctx.say(`${ctx.players[la].name} has the largest army!`, 'pay'); }
    st.longestRoad = lr; st.largestArmy = la;
  }
  const out = (st, p) => !!(st && st.out && st.out[p]);                // left the game
  const nextIn = (st, p, n) => { let q = p; while (out(st, q)) q = (q + 1) % n; return q; };
  const results = (ctx, winner) => ctx.players.map((pl, i) => ({ name: pl.name, won: i === winner, points: totalVP(ctx.state, i), ...(out(ctx.state, i) ? { left: true } : {}) }));
  const publicVP = (st, p) => count(st, p, 'settlement') + 2 * count(st, p, 'city') + (st.longestRoad === p ? 2 : 0) + (st.largestArmy === p ? 2 : 0);
  const totalVP = (st, p) => publicVP(st, p) + st.dev[p].filter(d => d.type === 'vp').length;
  function ratio(st, p, r) {
    const ports = st.board.ports.filter(o => owner(st, o.a) === p || owner(st, o.b) === p);
    return ports.some(o => o.type === r) ? 2 : ports.some(o => o.type === 'any') ? 3 : 4;
  }
  function checkWin(ctx) {
    const st = ctx.state, p = st.turn;
    if (totalVP(st, p) < st.target) return false;
    ctx.log(`🏆 ${ctx.players[p].name} reaches ${totalVP(st, p)} victory points!`);
    ctx.say(`${ctx.players[p].name} has ${totalVP(st, p)} victory points and wins Catan!`, 'wave');
    ctx.end(results(ctx, p),
      `<div class="note" style="text-align:center">Longest Road: ${st.longestRoad != null ? PartyKit.esc(ctx.players[st.longestRoad].name) : 'nobody'} · Largest Army: ${st.largestArmy != null ? PartyKit.esc(ctx.players[st.largestArmy].name) : 'nobody'}</div>`);
    return true;
  }

  /* ---------- Cards changing hands (for the animations on the Mac and phones) ---------- */
  // from / to: 'bank', a player number, or 'h' + a hex number (production). r: a resource, or 'dev' for a development
  // card (never its type). A stolen card is `secret`: only the thief and the victim see which resource it was.
  function flow(st, from, to, r, n = 1, secret) {
    if (!n) return;
    st.flows = st.flows || [];
    st.flowId = (st.flowId || 0) + 1;
    st.flows.push({ id: st.flowId, from, to, r, n, ...(secret ? { secret: true } : {}) });
    if (st.flows.length > 24) st.flows.shift();
  }
  const flowRes = (st, from, to, cards) => RES.forEach(r => flow(st, from, to, r, cards[r] || 0));
  const flowsFor = (st, i) => (st.flows || []).map(f => (f.secret && f.from !== i && f.to !== i ? { ...f, r: 'hidden' } : f));

  /* ---------- Turn timer (option): one clock at a time; a clock from a move that is already over does nothing ---------- */
  function arm(ctx, secs, label, onTimeout) {
    const st = ctx.state, gen = st.clockGen = (st.clockGen || 0) + 1;
    ctx.countdown(secs, label).then(skipped => { if (!skipped && ctx.alive && st.clockGen === gen) { onTimeout(); ctx.update(); } }, () => {});
  }
  function armTurn(ctx, secs) {
    const st = ctx.state;
    if (!st.turnTime) return;
    const left = secs ?? st.turnTime;
    st.turnEnds = Date.now() + left * 1000;
    arm(ctx, left, st.step.startsWith('setup') ? 'Placing' : 'Turn', () => {
      ctx.log(`⏱️ Time's up for ${ctx.players[st.turn].name}.`);
      ctx.say(`Time's up, ${ctx.players[st.turn].name}!`);
      st.timedOut = true;
      autoFinish(ctx);
    });
  }
  // Time ran out: finish the turn (or setup placement) with random legal moves, then pass it on
  function autoFinish(ctx) {
    const st = ctx.state, p = st.turn, key = `${st.turnNo}|${st.setupIdx}`, pick = a => a[ctx.rand(a.length)];
    for (let guard = 0; guard < 30 && ctx.alive && `${st.turnNo}|${st.setupIdx}` === key; guard++) {
      const L = legal(st, p);
      if (st.step === 'discard') return;                 // the others are discarding; the turn finishes after that
      if (st.step === 'setup-settle') api.act(ctx, p, { act: 'build', kind: 'settlement', at: pick(L.settlement) });
      else if (st.step === 'setup-road' || st.step === 'roads') { if (L.road.length) api.act(ctx, p, { act: 'build', kind: 'road', at: pick(L.road) }); else st.step = 'main'; }
      else if (st.step === 'roll') api.act(ctx, p, { act: 'roll' });
      else if (st.step === 'robber') api.act(ctx, p, { act: 'robber', h: pick(L.robber) });
      else if (st.step === 'steal') api.act(ctx, p, { act: 'steal', p: pick(st.victims) });
      else if (st.step === 'main') { st.trades = []; ctx.log(`⏱️ ${ctx.players[p].name}'s turn ended.`); endTurn(ctx); }
      else return;
    }
  }
  // After a 7 the turn clock pauses while the others discard (30 seconds; then random cards go)
  function armDiscard(ctx) {
    const st = ctx.state;
    if (!st.turnTime) return;
    st.turnLeft = Math.max(0, (st.turnEnds - Date.now()) / 1000);
    arm(ctx, 30, 'Discard', () => Object.keys(st.discards).forEach(q => {
      const cards = ctx.shuffle(RES.flatMap(r => Array(st.res[q][r]).fill(r))).slice(0, st.discards[q]);
      ctx.log(`⏱️ Time's up: ${ctx.players[q].name} discards at random.`);
      api.act(ctx, +q, { act: 'discard', res: cards.join(',') });
    }));
  }
  function discardsDone(ctx) {
    const st = ctx.state;
    if (!st.turnTime) return;
    if (st.timedOut) autoFinish(ctx); else armTurn(ctx, Math.max(10, Math.ceil(st.turnLeft)));
  }

  /* ---------- Before setup: the board check, then everyone rolls for turn order ---------- */
  function startOrder(ctx) {
    const st = ctx.state;
    st.step = 'order';
    st.order = { queue: ctx.shuffle(ctx.players.map((_, i) => i)), at: 0, rolls: [] };
    ctx.log('🎲 Everyone rolls for turn order: the highest roll starts.');
    callRoller(ctx);
  }
  function callRoller(ctx) {
    const st = ctx.state, p = st.order.queue[st.order.at];
    st.turn = p;
    ctx.say(`${ctx.players[p].name}, roll for turn order.`);
    if (st.turnTime) arm(ctx, 15, 'Roll for order', () => api.act(ctx, p, { act: 'orderRoll' }));
  }
  function finishOrder(ctx) {
    const st = ctx.state, o = st.order;
    st.first = firstPlayer(o.rolls);
    const top = o.rolls.filter(r => r.t === o.rolls.find(x => x.p === st.first).t);
    if (top.length > 1) ctx.log(`${top.map(r => ctx.players[r.p].name).join(' and ')} tied on ${top[0].t}; ${ctx.players[st.first].name} rolled it first.`);
    const names = seatOrder(st, ctx.players.length).filter(q => !out(st, q)).map(q => ctx.players[q].name);
    ctx.log(`🧭 Turn order: ${names.join(' → ')}.`);
    ctx.say(`${names[0]} goes first. The order is ${names.join(', ')}.`, 'point');
    placeSetup(ctx);
  }
  // The highest total starts; on a tie, whoever rolled that total first
  const firstPlayer = rolls => rolls.reduce((best, r) => (r.t > best.t ? r : best)).p;
  // Turn order: seat order (the digital "clockwise"), starting from the first player
  const seatOrder = (st, n) => [...Array(n)].map((_, k) => (st.first == null ? k : (st.first + k) % n));

  /* ---------- Trading between players ---------- */
  // Every trade involves the player whose turn it is (the official rule): on your turn you offer to everyone or to
  // chosen players; on someone else's turn you can send that player a request. A recipient accepts, declines or counters.
  // A trade sent to one player happens as soon as they accept; sent to several, the offerer picks whose answer to take.
  // A counter-offer always goes back to the proposer to confirm. Both hands are checked again at the moment of the trade.
  // One open trade per player: a new one replaces it. Offline players can't be sent a trade.
  const isOnline = (ctx, q) => !out(ctx.state, q) && (ctx.online ? ctx.online(q) : true);
  function doTrade(ctx, t, q, give, want) {             // the proposer gives `give` to q and gets `want`
    const st = ctx.state, a = t.from, A = ctx.players[a].name, Q = ctx.players[q].name;
    if (st.step !== 'main') return 'Trades happen once the dice are rolled and the robber has moved.';
    if (!has(st.res[a], give)) return `${A} doesn't have ${fmtRes(give)} any more.`;
    if (!has(st.res[q], want)) return `${Q} doesn't have ${fmtRes(want)} any more.`;
    pay(st.res[a], st.res[q], give); pay(st.res[q], st.res[a], want);
    flowRes(st, a, q, give); flowRes(st, q, a, want);
    ctx.log(`🤝 ${A} traded ${fmtRes(give)} to ${Q} for ${fmtRes(want)}.`);
    ctx.say(`${A} and ${Q} trade.`, 'pay');
    st.trades = st.trades.filter(x => x.id !== t.id);
  }

  /* ---------- Turn flow ---------- */
  function produce(ctx, roll, d) {
    const st = ctx.state, gain = ctx.players.map(() => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 })), from = [];
    st.board.hexes.forEach((h, hi) => {
      if (h.num !== roll || hi === st.board.robber) return;
      h.v.forEach(v => { const b = st.bld[v]; if (b) { gain[b.p][h.res] += b.city ? 2 : 1; from.push({ hi, p: b.p, r: h.res, n: b.city ? 2 : 1 }); } });
    });
    RES.forEach(r => {
      const want = gain.reduce((a, g) => a + g[r], 0);
      if (!want) return;
      const takers = gain.filter(g => g[r]).length;
      if (want > st.bank[r]) {                                           // the bank runs short
        if (takers > 1) { ctx.log(`🏦 The bank is short of ${RNAME[r]}: nobody gets any.`); gain.forEach(g => { g[r] = 0; }); return; }
        gain.forEach(g => { if (g[r]) g[r] = st.bank[r]; });
      }
      gain.forEach((g, p) => { st.res[p][r] += g[r]; st.bank[r] -= g[r]; });
    });
    const left = gain.map(g => ({ ...g }));                              // each card flies from the hex that produced it
    from.forEach(c => { const k = Math.min(c.n, left[c.p][c.r]); left[c.p][c.r] -= k; flow(st, 'h' + c.hi, c.p, c.r, k); });
    const lines = gain.map((g, p) => total(g) ? `${ctx.players[p].name} +${fmtRes(g)}` : null).filter(Boolean);
    ctx.log(`🎲 ${roll}${d ? ` (${d[0]} + ${d[1]})` : ''}: ${lines.length ? lines.join(' · ') : 'no production'}`);
  }
  function afterSeven(ctx) {
    const st = ctx.state;
    st.discards = {};
    ctx.players.forEach((_, p) => { const t = total(st.res[p]); if (t > 7) st.discards[p] = Math.floor(t / 2); });
    if (Object.keys(st.discards).length) {
      st.step = 'discard';
      ctx.say(`Seven! ${Object.keys(st.discards).map(p => ctx.players[p].name).join(' and ')} must discard half their cards.`, 'shake');
      armDiscard(ctx);
    } else { st.step = 'robber'; ctx.say(`Seven! ${ctx.players[st.turn].name}, move the robber.`, 'shake'); }
  }
  function startTurn(ctx) {
    const st = ctx.state;
    st.step = 'roll'; st.dice = null; st.devPlayed = false; st.trades = []; st.turnNo++; st.timedOut = false;
    st.dev.forEach(list => list.forEach(d => { d.fresh = false; }));
    if (checkWin(ctx)) return;
    ctx.say(`${ctx.players[st.turn].name}, your turn. Roll the dice!`);
    armTurn(ctx);
  }
  function endTurn(ctx) {
    const st = ctx.state;
    const n = ctx.players.length;
    st.turn = nextIn(st, (st.turn + 1) % n, n);                     // players who left are skipped
    startTurn(ctx);
  }
  function placeSetup(ctx) {
    const st = ctx.state, n = ctx.players.length, k = st.setupIdx;
    if (k >= 2 * n) { st.turn = nextIn(st, st.first, n); ctx.log('Setup done. Let the game begin!'); return startTurn(ctx); }
    st.turn = k < n ? (st.first + k) % n : (st.first + 2 * n - 1 - k) % n;
    if (out(st, st.turn)) { st.setupIdx++; return placeSetup(ctx); }   // a player who left places nothing
    st.step = 'setup-settle'; st.timedOut = false;
    ctx.say(`${ctx.players[st.turn].name}, place your ${k < n ? 'first' : 'second'} settlement.`);
    armTurn(ctx);
  }
  function moveRobber(ctx, h) {
    const st = ctx.state, p = st.turn;
    st.board.robber = h;
    const victims = [...new Set(st.board.hexes[h].v.map(v => owner(st, v)).filter(q => q != null && q !== p && total(st.res[q]) > 0))];
    ctx.log(`🦹 ${ctx.players[p].name} moved the robber to ${ICON[st.board.hexes[h].res]} ${st.board.hexes[h].num || ''}.`);
    if (victims.length > 1) { st.step = 'steal'; st.victims = victims; return; }
    if (victims.length === 1) steal(ctx, victims[0]);
    st.step = st.afterRobber;
  }
  function steal(ctx, q) {
    const st = ctx.state, p = st.turn, cards = RES.flatMap(r => Array(st.res[q][r]).fill(r));
    if (!cards.length) return;
    const r = cards[ctx.rand(cards.length)];
    st.res[q][r]--; st.res[p][r]++;
    flow(st, q, p, r, 1, true);
    ctx.log(`🫳 ${ctx.players[p].name} stole a card from ${ctx.players[q].name}.`);
    st.private[p].push(`You stole ${ICON[r]} ${RNAME[r]} from ${ctx.players[q].name}.`);
    st.private[q].push(`${ctx.players[p].name} stole your ${ICON[r]} ${RNAME[r]}.`);
  }
  const parseList = s => String(s || '').split(',').filter(r => RES.includes(r));
  const parseCounts = s => { const o = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }; parseList(s).forEach(r => o[r]++); return o; };

  /* ---------- Board drawing (shared by the Mac and the phones) ---------- */
  function boardSVG(b, colors, opt = {}) {
    const hl = opt.hl || {}, sz = 46, X = x => (x * sz).toFixed(1), Y = y => (y * sz).toFixed(1);
    const hexPts = (cx, cy) => [0, 1, 2, 3, 4, 5].map(k => { const a = Math.PI / 180 * (60 * k - 30); return `${X(cx + Math.cos(a))},${Y(cy + Math.sin(a))}`; }).join(' ');
    let s = seaRing().map(o => `<polygon points="${hexPts(o.x, o.y)}" fill="#22709e" stroke="#2b7fb0" stroke-width="1.5"/>`).join('');
    // harbors under the land: two wooden piers from the token to the two corners it serves
    b.ports.forEach(o => [o.a, o.b].forEach(v => {
      const c = b.verts[v], pier = w => `<line x1="${X(o.x)}" y1="${Y(o.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="${w ? '#c08a4e' : '#4a2f14'}" stroke-width="${w ? 4 : 7}" stroke-linecap="round"/>`;
      s += pier(0) + pier(1);
    }));
    b.hexes.forEach((h, i) => {
      const pts = h.v.map(v => `${X(b.verts[v].x)},${Y(b.verts[v].y)}`).join(' ');
      const pick = hl.robber && hl.robber.includes(i);
      s += `<polygon points="${pts}" fill="${FILL[h.res]}" stroke="#f3e2b5" stroke-width="2.5" data-hex="${i}"${pick ? ` class="pick-hex" data-act="robber" data-h="${i}"` : ''}/>`;
      s += `<text x="${X(h.x)}" y="${Y(h.y - .5)}" font-size="${sz * .34}" text-anchor="middle" opacity=".9" pointer-events="none">${ICON[h.res]}</text>`;
      if (h.num) {
        const hot = h.num === 6 || h.num === 8, pips = 6 - Math.abs(7 - h.num);
        s += `<circle cx="${X(h.x)}" cy="${Y(h.y + .08)}" r="${sz * .3}" fill="#fff8e6" stroke="#6b4f1d" stroke-width="1.2" pointer-events="none"/>
          <text x="${X(h.x)}" y="${Y(h.y + .18)}" font-size="${sz * .3}" font-weight="900" text-anchor="middle" fill="${hot ? '#c0262d' : '#1b1b1b'}" pointer-events="none">${h.num}</text>
          <text x="${X(h.x)}" y="${Y(h.y + .33)}" font-size="${sz * .16}" text-anchor="middle" fill="${hot ? '#c0262d' : '#1b1b1b'}" pointer-events="none">${'•'.repeat(pips)}</text>`;
      }
      // the robber: in the middle of a hex without a number (the desert, where it starts), beside the number otherwise
      if (i === b.robber) {
        const rx = h.num ? h.x + .4 : h.x, ry = h.num ? h.y - .05 : h.y + .12, rr = h.num ? .17 : .26;
        s += `<g pointer-events="none"><circle cx="${X(rx)}" cy="${Y(ry)}" r="${sz * rr}" fill="#1b1b1b" stroke="#fff" stroke-width="1.5"/><text x="${X(rx)}" y="${Y(ry + rr * .45)}" font-size="${sz * rr * 1.2}" text-anchor="middle">🦹</text></g>`;
      }
      if (pick) s += `<circle cx="${X(h.x)}" cy="${Y(h.y)}" r="${sz * .45}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 4" pointer-events="none" class="pulse"/>`;
    });
    b.ports.forEach(o => {
      [o.a, o.b].forEach(v => { s += `<circle cx="${X(b.verts[v].x)}" cy="${Y(b.verts[v].y)}" r="4.5" fill="#c08a4e" stroke="#4a2f14" stroke-width="1.5" pointer-events="none"/>`; });
      const two = o.type !== 'any';
      s += `<g pointer-events="none"><circle cx="${X(o.x)}" cy="${Y(o.y)}" r="${sz * .34}" fill="#f6ecd2" stroke="${two ? '#6b4f1d' : '#1e5f8a'}" stroke-width="2.5"/>
        <text x="${X(o.x)}" y="${Y(o.y - .01)}" font-size="${sz * .2}" text-anchor="middle">${two ? ICON[o.type] : '⚓'}</text>
        <text x="${X(o.x)}" y="${Y(o.y + .22)}" font-size="${sz * .16}" font-weight="900" text-anchor="middle" fill="#1b1b1b">${two ? '2:1' : '3:1'}</text></g>`;
    });
    b.edges.forEach((e, i) => {
      const a = b.verts[e.a], c = b.verts[e.b], p = b.roads[i];
      if (p != null) s += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="#1b1b1b" stroke-width="9" stroke-linecap="round"/><line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="${colors[p]}" stroke-width="6" stroke-linecap="round"/>`;
      else if (hl.road && hl.road.includes(i)) {
        const data = `data-act="${opt.roadAct || 'build'}" data-kind="road" data-at="${i}"`, m = (t, k) => a[k] + (c[k] - a[k]) * t;
        s += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="#fff" stroke-width="7" stroke-linecap="round" class="pick-edge" ${data} stroke-dasharray="4 4"/>`;
        // a wider invisible strip for fingers: the middle of the road only, so two roads meeting at a corner don't overlap
        s += `<line x1="${X(m(.3, 'x'))}" y1="${Y(m(.3, 'y'))}" x2="${X(m(.7, 'x'))}" y2="${Y(m(.7, 'y'))}" stroke="transparent" stroke-width="30" class="pick-hit" ${data}/>`;
      }
    });
    b.verts.forEach((v, i) => {
      const bl = b.bld[i];
      if (bl) {
        const c = colors[bl.p], x = +X(v.x), y = +Y(v.y);
        s += bl.city ? `<path d="M${x - 10} ${y + 8} V${y - 2} L${x - 4} ${y - 8} L${x + 2} ${y - 2} H${x + 10} V${y + 8} Z" fill="${c}" stroke="#1b1b1b" stroke-width="2"/>`
          : `<path d="M${x - 7} ${y + 6} V${y - 2} L${x} ${y - 9} L${x + 7} ${y - 2} V${y + 6} Z" fill="${c}" stroke="#1b1b1b" stroke-width="2"/>`;
      }
      const kind = hl.settlement && hl.settlement.includes(i) ? 'settlement' : hl.city && hl.city.includes(i) ? 'city' : null;
      if (kind) {
        const data = `data-act="${opt.settleAct || 'build'}" data-kind="${kind}" data-at="${i}"`;
        s += `<circle cx="${X(v.x)}" cy="${Y(v.y)}" r="${kind === 'city' ? 13 : 9}" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width="2.5" class="pick-vert" ${data}/>`
          + `<circle cx="${X(v.x)}" cy="${Y(v.y)}" r="21" fill="transparent" class="pick-hit" ${data}/>`;   // a bigger invisible target for fingers (corners are 46 apart)
      }
    });
    const W = 5.55, H = 4.95;                                          // wide enough for every harbor token
    return `<svg class="cat-board" viewBox="${-W * sz} ${-H * sz} ${2 * W * sz} ${2 * H * sz}" role="img" aria-label="Catan board"><defs><clipPath id="catClip"><rect x="${-W * sz}" y="${-H * sz}" width="${2 * W * sz}" height="${2 * H * sz}" rx="18"/></clipPath></defs><rect x="${-W * sz}" y="${-H * sz}" width="${2 * W * sz}" height="${2 * H * sz}" fill="#1e5f8a" rx="18"/><g clip-path="url(#catClip)">${s}</g></svg>`;
  }
  function boardData(st) {
    const b = st.board;
    return { hexes: b.hexes.map(h => ({ x: h.x, y: h.y, res: h.res, num: h.num, v: h.v })), verts: b.verts.map(v => ({ x: v.x, y: v.y })),
      edges: b.edges.map(e => ({ a: e.a, b: e.b })), ports: b.ports, robber: b.robber, bld: st.bld, roads: st.roads };
  }
  // A glow on a resource tile that just changed (`glow`: { r: { t, n } }); the negative delay keeps the glow running
  // smoothly across re-renders instead of restarting it
  const GLOW_MS = 2200;
  const glowAttr = (g, now) => (g && now - g.t < GLOW_MS ? ` data-d="${g.n > 0 ? '+' : ''}${g.n}" style="animation-delay:-${now - g.t}ms"` : '');
  const glowCls = (g, now) => (g && now - g.t < GLOW_MS ? (g.n > 0 ? ' cat-up' : ' cat-down') : '');
  const resRow = (obj, cls = '', glow = {}, now = Date.now()) => `<div class="cat-res ${cls}">${RES.map(r => `<span class="rc r-${r}${glowCls(glow[r], now)}"${glowAttr(glow[r], now)}><i>${ICON[r]}</i><b>${obj[r] || 0}</b></span>`).join('')}</div>`;
  // New flows since `fx.seen` add up into glows: fx.glow[key][r] = { t, n } (key: a player, or 'me' on a phone)
  function collectGlows(fx, flows, keyOf, now) {
    flows.filter(f => f.id > fx.seen).forEach(f => {
      [[f.to, f.n], [f.from, -f.n]].forEach(([who, n]) => {
        const key = keyOf(who); if (key == null) return;
        const g = fx.glow[key] = fx.glow[key] || {}, old = g[f.r];
        g[f.r] = old && now - old.t < 400 ? { t: old.t, n: old.n + n } : { t: now, n };
      });
    });
    fx.seen = Math.max(fx.seen, ...flows.map(f => f.id));
  }
  const FLY_ICON = { hidden: '🂠', dev: '🃏' };
  // Two real dice (pips on a 3×3 grid) and the total: the Unicode dice faces are too small to read
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const die = n => `<span class="cat-die" role="img" aria-label="${n}">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => `<i${PIPS[n].includes(k) ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const diceHTML = (d, cls = '') => `<span class="cat-dice2 ${cls}">${die(d[0])}${die(d[1])}<b>${d[0] + d[1]}</b></span>`;

  const api = {
    _test: { geometry, newBoard, seaRing, harborSpots, boardSVG, boardData, canSettle, canRoad, legal, longest, award, ratio, produce, count, publicVP, totalVP, firstPlayer, seatOrder, flowsFor, updateAwards, successor, COST, LIMIT },   // internals, for the unit tests only (test/unit)
    id: 'catan', name: 'Catan', min: 2, max: 4, wide: true, macRole: 'board and scoreboard', pointsLabel: 'VP',
    blurb: 'Build settlements, cities and roads; trade; race to 10 victory points. The board is on the Mac; your cards stay secret on your phone. 2–4 players (3–4 is classic).',
    options: [
      { key: 'target', label: 'Victory points to win', def: 10, choices: [[8, '8 (shorter game)'], [10, '10 (standard)'], [12, '12 (longer game)']] },
      { key: 'turnTime', label: 'Time per turn', def: 0, choices: [[0, 'Off'], [60, '60 seconds'], [90, '90 seconds'], [120, '2 minutes'], [180, '3 minutes']] },
    ],
    rules: [
      '<b>Before the game:</b> the host picks the island on the Mac (🔄 New board shuffles a fresh one). Then everyone rolls for turn order: the highest roll starts, and on a tie whoever rolled that number first. Play then goes in seat order from the starter, as listed on the Mac.',
      '<b>Setup:</b> in turn order each player places a settlement and a road; then in reverse order a second settlement and road. The second settlement gives you one of each resource around it.',
      '<b>Your turn:</b> roll the dice. Every hex with that number produces: each settlement on it gets 1 card, each city 2 (not while the robber sits on it). Then trade and build, and tap End turn.',
      '<b>Building costs:</b> road 🌲🧱 · settlement 🌲🧱🐑🌾 · city 🌾🌾⛰️⛰️⛰️ (upgrades a settlement) · development card 🐑🌾⛰️.',
      '<b>Placing:</b> settlements must be at least two corners from any other settlement and (after setup) touch your road. Roads connect to your roads or buildings. Limits: 15 roads, 5 settlements, 4 cities.',
      '<b>Rolling 7:</b> anyone with more than 7 cards discards half (rounded down). Then the roller moves the robber and steals a random card from a player next to it.',
      '<b>Development cards:</b> ⚔️ Knight (move the robber), ⭐ Victory Point, 🛣️ Road Building, 🎁 Year of Plenty, 💰 Monopoly. One per turn, not on the turn you bought it.',
      '<b>Trading with the bank:</b> 4:1, or 3:1 / 2:1 if you have a settlement on a harbor. One trade can mix resources and rates (e.g. 4 🌲 + 2 🐑 at a 🐑 harbor for 🧱 + 🌾); use + and − to set the cards.',
      '<b>Trading with players:</b> every trade involves the player whose turn it is. On your turn, offer to everyone or to the players you pick; on someone else\'s turn, tap <i>Ask … for a trade</i> to send them a request. Each player can accept, say no thanks, or send a counter-offer. If the trade went to one player, their yes makes the trade; if it went to several, the offerer picks whose answer to take, and a counter-offer always goes back to the offerer. Players who are offline can\'t be sent a trade.',
      '<b>Awards:</b> 🛣️ Longest Road (5+ connected roads) and ⚔️ Largest Army (3+ knights played) are worth 2 VP each and move to anyone who beats the holder.',
      '<b>Winning:</b> settlement 1 VP, city 2 VP. Reach the target (10 by default) on your turn to win; secret ⭐ cards count.',
      '<b>Leaving mid-game:</b> tap <i>Leave now</i> twice on your phone (or the host taps × next to your name on the Mac). Your roads and buildings come off the board, your resource cards go back to the bank and your unplayed development cards into the deck. If you held Longest Road or Largest Army, it goes to the longest road (largest army) of the rest, if long enough; on a tie, to whoever reached that length first. When only one player is left, they win. Players who left are not recorded on the leaderboard.',
      '<b>Time per turn</b> (if the host sets one): when it runs out, the game finishes your turn for you: it rolls, moves the robber or picks a victim at random if needed, withdraws your trade offer and ends the turn. In setup it places for you. After a 7, discards get 30 seconds of their own.',
    ],
    async start(ctx) {
      const n = ctx.players.length, empty = () => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
      const devDeck = ctx.shuffle([...Array(14).fill('knight'), ...Array(5).fill('vp'), 'roads', 'roads', 'plenty', 'plenty', 'monopoly', 'monopoly']);
      ctx.state = {
        board: newBoard(ctx.rand, ctx.shuffle), bld: {}, roads: {}, res: ctx.players.map(empty), dev: ctx.players.map(() => []),
        bank: { wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 }, devDeck, knights: ctx.players.map(() => 0), roadLen: ctx.players.map(() => 0),
        longestRoad: null, largestArmy: null, turn: 0, first: null, setupIdx: 0, step: 'board', dice: null, turnNo: 0, order: null, boards: 1,
        devPlayed: false, trades: [], tradeId: 0, discards: {}, victims: [], afterRobber: 'main', freeRoads: 0, private: ctx.players.map(() => []), target: ctx.opts.target || 10, lastSettle: null,
        turnTime: +ctx.opts.turnTime || 0, flows: [], flowId: 0, gid: ctx.rand(1e9),
      };
      ctx.log('A new island is ready.');
      ctx.update();
      await ctx.say('Welcome to Catan! Here is the island. Keep it, or shuffle a new one on the Mac.', 'welcome');
    },
    // A player leaves mid-game (from their phone, or removed on the Mac): their roads and buildings come off the board,
    // their resource cards go back to the bank and their unplayed development cards into the deck; the game goes on
    playerLeft(ctx, k) {
      const st = ctx.state, name = ctx.players[k].name;
      if (!st || out(st, k)) return;
      (st.out = st.out || ctx.players.map(() => false))[k] = true;
      Object.keys(st.bld).forEach(v => { if (st.bld[v].p === k) delete st.bld[v]; });
      Object.keys(st.roads).forEach(e => { if (st.roads[e] === k) delete st.roads[e]; });
      const cards = { ...st.res[k] };
      pay(st.res[k], st.bank, cards); flowRes(st, k, 'bank', cards);
      st.devDeck.push(...st.dev[k].map(d => d.type)); ctx.shuffle(st.devDeck); st.dev[k] = []; st.knights[k] = 0;
      st.trades = (st.trades || []).filter(t => t.from !== k).map(t => ({ ...t, to: t.to.filter(q => q !== k) })).filter(t => t.to.length);
      delete st.discards[k]; st.victims = (st.victims || []).filter(q => q !== k); st.private[k] = [];
      ctx.log(`👋 ${name} left the game: their roads and buildings are off the board, and their cards are back in the bank and the deck.`);
      ctx.say(`${name} has left the game.`);
      updateAwards(ctx, k);
      const still = ctx.players.map((_, p) => p).filter(p => !out(st, p));
      if (still.length < 2) {                           // one player left: they win
        ctx.log(`🏆 ${ctx.players[still[0]].name} is the last player at the table.`);
        ctx.say(`${ctx.players[still[0]].name} is the last one standing and wins!`, 'wave');
        return ctx.end(results(ctx, still[0]));
      }
      if (st.step === 'board') return;
      if (st.step === 'order') {
        const o = st.order;
        o.rolls = o.rolls.filter(r => r.p !== k); o.queue = o.queue.filter(q => q !== k); o.at = o.rolls.length;
        if (o.at >= o.queue.length) finishOrder(ctx); else if (st.turn === k) callRoller(ctx);
        return;
      }
      if (st.step.startsWith('setup')) { if (st.turn === k) { st.setupIdx++; placeSetup(ctx); } return; }
      if (st.turn === k) { st.discards = {}; return endTurn(ctx); }
      if (st.step === 'discard' && !Object.keys(st.discards).length) { st.step = 'robber'; st.afterRobber = 'main'; discardsDone(ctx); }
      if (st.step === 'steal' && st.victims.length < 2) { if (st.victims.length) steal(ctx, st.victims[0]); st.step = st.afterRobber; }
      checkWin(ctx);                                    // a title that moved may make the player on turn the winner
    },
    // The Mac's own buttons: shuffle a new island or keep it (before setup); remove a player (any time, asked twice)
    hostAct(ctx, d) {
      const st = ctx.state;
      if (!st) return;
      const fx = ctx.catFx = ctx.catFx || { seen: 0, flown: 0, glow: {} };
      if (d.host === 'remove') { fx.removing = +d.p; return; }
      if (d.host === 'removeNo') { fx.removing = null; return; }
      if (d.host === 'removeYes') {
        const q = fx.removing; fx.removing = null;
        if (q == null || out(st, q)) return;
        if (ctx.removePlayer) ctx.removePlayer(q); else api.playerLeft(ctx, q);
        return;
      }
      if (st.step !== 'board') return;
      if (d.host === 'newBoard') { st.board = newBoard(ctx.rand, ctx.shuffle); st.boards++; ctx.log(`🔄 A new island (board ${st.boards}).`); }
      if (d.host === 'useBoard') { ctx.log('🏝️ The island is set.'); startOrder(ctx); }
    },
    act(ctx, i, m) {
      const st = ctx.state, me = ctx.players[i].name, mine = st.turn === i, P = st.res[i];
      const need = (cost, what) => has(P, cost) ? null : `You need ${fmtRes(cost)} for ${what}.`;
      // anyone: discard after a 7, answer a trade
      if (m.act === 'discard') {
        if (st.step !== 'discard' || !st.discards[i]) return;
        const give = parseCounts(m.res);
        if (total(give) !== st.discards[i]) return `Discard exactly ${st.discards[i]} cards.`;
        if (!has(P, give)) return 'You don\'t have those cards.';
        pay(P, st.bank, give); flowRes(st, i, 'bank', give);
        ctx.log(`🗑️ ${me} discarded ${st.discards[i]} cards.`);
        delete st.discards[i];
        if (!Object.keys(st.discards).length) { st.step = 'robber'; st.afterRobber = 'main'; ctx.say(`${ctx.players[st.turn].name}, move the robber.`); discardsDone(ctx); }
        return;
      }
      if (m.act === 'offer') {                         // on your turn: an offer; otherwise: a request to the active player
        if (st.step !== 'main') return mine ? 'Roll the dice first.' : `You can trade once ${ctx.players[st.turn].name} has rolled.`;
        const give = parseCounts(m.give), want = parseCounts(m.want);
        if (!total(give) || !total(want)) return 'Pick what you give and what you want.';
        if (!has(P, give)) return 'You don\'t have those cards.';
        let to = [st.turn];
        if (mine) {
          to = String(m.to || '').split(',').filter(x => x !== '').map(Number);
          if (!to.length) to = ctx.players.map((_, q) => q).filter(q => q !== i && isOnline(ctx, q));
          if (!to.length) return 'Nobody else is online to trade with.';
          if (to.some(q => q === i || !ctx.players[q])) return 'Pick who to trade with.';
        }
        const off = to.find(q => !isOnline(ctx, q));
        if (off != null) return `${ctx.players[off].name} is offline right now.`;
        st.trades = (st.trades || []).filter(t => t.from !== i);
        st.tradeId = (st.tradeId || 0) + 1;
        st.trades.push({ id: st.tradeId, from: i, to, give, want, replies: {} });
        const who = mine ? (to.length === ctx.players.length - 1 ? 'everyone' : to.map(q => ctx.players[q].name).join(' and ')) : ctx.players[st.turn].name;
        ctx.log(mine ? `📣 ${me} offers ${fmtRes(give)} for ${fmtRes(want)} to ${who}.` : `🙋 ${me} asks ${who} to trade ${fmtRes(give)} for ${fmtRes(want)}.`);
        ctx.say(mine ? `${me} offers a trade.` : `${me} would like to trade with ${who}.`);
        return;
      }
      if (m.act === 'reply') {
        const t = (st.trades || []).find(x => x.id === +m.id);
        if (!t || !t.to.includes(i)) return 'That trade is no longer open.';
        const A = ctx.players[t.from].name;
        if (m.r === 'decline') { t.replies[i] = { r: 'decline' }; return; }
        if (m.r === 'accept') {
          if (!has(P, t.want)) return 'You don\'t have the cards they want.';
          if (t.to.length === 1) return doTrade(ctx, t, i, t.give, t.want);
          t.replies[i] = { r: 'accept' };
          ctx.log(`✅ ${me} accepts ${A}'s offer.`);
          return;
        }
        if (m.r === 'counter') {                        // give / want as the proposer would see them
          const give = parseCounts(m.give), want = parseCounts(m.want);
          if (!total(give) || !total(want)) return 'Pick both sides of your counter-offer.';
          if (!has(P, want)) return 'You don\'t have the cards you would give.';
          t.replies[i] = { r: 'counter', give, want };
          ctx.log(`🔁 ${me} counters ${A}: ${fmtRes(want)} for ${fmtRes(give)}.`);
          ctx.say(`${me} makes a counter-offer.`);
        }
        return;
      }
      if (m.act === 'confirm') {                         // the proposer takes one reply: an acceptance or a counter-offer
        const t = (st.trades || []).find(x => x.id === +m.id), rep = t && t.replies[+m.p];
        if (!t || t.from !== i) return 'That trade is no longer open.';
        if (!rep || rep.r === 'decline') return 'They haven\'t agreed to a trade.';
        return rep.r === 'counter' ? doTrade(ctx, t, +m.p, rep.give, rep.want) : doTrade(ctx, t, +m.p, t.give, t.want);
      }
      if (m.act === 'withdraw') { st.trades = (st.trades || []).filter(t => t.from !== i); return; }
      if (!mine) return "It's not your turn.";
      const L = legal(st, i);
      switch (m.act) {
        case 'orderRoll': {
          if (st.step !== 'order') return;
          const d = [1 + ctx.rand(6), 1 + ctx.rand(6)], o = st.order;
          o.rolls.push({ p: i, d, t: d[0] + d[1] });
          ctx.log(`🎲 ${me} rolled ${d[0] + d[1]} (${d[0]} + ${d[1]}) for turn order.`);
          ctx.say(`${me} rolls ${d[0]} and ${d[1]}: ${d[0] + d[1]}.`);
          if (++o.at < o.queue.length) callRoller(ctx); else finishOrder(ctx);
          return;
        }
        case 'build': {
          const at = +m.at, kind = m.kind;
          if (st.step === 'setup-settle' && kind === 'settlement') {
            if (!L.settlement.includes(at)) return 'You can\'t build there.';
            st.bld[at] = { p: i, city: false }; st.lastSettle = at; st.step = 'setup-road';
            if (st.setupIdx >= ctx.players.length) {        // second settlement: one of each resource around it
              const got = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
              st.board.verts[at].hexes.forEach(h => { const r = st.board.hexes[h].res; if (r !== 'desert') { got[r]++; st.bank[r]--; P[r]++; flow(st, 'h' + h, i, r); } });
              ctx.log(`🏠 ${me} placed a settlement and collected ${fmtRes(got) || 'nothing'}.`);
            } else ctx.log(`🏠 ${me} placed a settlement.`);
            ctx.say(`${me}, now place a road next to it.`);
            return;
          }
          if (st.step === 'setup-road' && kind === 'road') {
            if (!L.road.includes(at)) return 'Place the road next to your new settlement.';
            st.roads[at] = i; st.setupIdx++; updateAwards(ctx); placeSetup(ctx);
            return;
          }
          if (st.step === 'roads' && kind === 'road') {
            if (!L.road.includes(at)) return 'You can\'t build a road there.';
            st.roads[at] = i; st.freeRoads--;
            if (!st.freeRoads || !legal(st, i).road.length) st.step = 'main';
            ctx.log(`🛣️ ${me} built a free road.`);
            updateAwards(ctx); checkWin(ctx);
            return;
          }
          if (st.step !== 'main') return 'Roll the dice first.';
          if (!(L[kind] || []).includes(at)) return `You can't build a ${kind} there.`;
          const err = need(COST[kind], `a ${kind}`); if (err) return err;
          pay(P, st.bank, COST[kind]); flowRes(st, i, 'bank', COST[kind]);
          if (kind === 'road') st.roads[at] = i;
          else if (kind === 'settlement') st.bld[at] = { p: i, city: false };
          else st.bld[at].city = true;
          ctx.log(`${kind === 'road' ? '🛣️' : kind === 'city' ? '🏙️' : '🏠'} ${me} built a ${kind}.`);
          if (kind !== 'road') ctx.say(`${me} builds a ${kind}!`, 'pay');
          updateAwards(ctx); checkWin(ctx);
          return;
        }
        case 'roll': {
          if (st.step !== 'roll') return 'You already rolled.';
          const d = [1 + ctx.rand(6), 1 + ctx.rand(6)], t = d[0] + d[1];
          st.dice = d; st.lastRoll = { p: i, d };
          ctx.say(`${me} rolls ${d[0]} and ${d[1]}: ${t}.`);
          if (t === 7) { ctx.log(`🎲 ${me} rolled 7 (${d[0]} + ${d[1]}).`); st.afterRobber = 'main'; afterSeven(ctx); }
          else { produce(ctx, t, d); st.step = 'main'; }
          return;
        }
        case 'robber': {
          if (st.step !== 'robber') return;
          if (!L.robber.includes(+m.h)) return 'Move the robber to another hex.';
          moveRobber(ctx, +m.h);
          return;
        }
        case 'steal': {
          if (st.step !== 'steal' || !st.victims.includes(+m.p)) return;
          steal(ctx, +m.p); st.step = st.afterRobber;
          return;
        }
        case 'buydev': {
          if (st.step !== 'main') return 'Roll the dice first.';
          if (!st.devDeck.length) return 'No development cards left.';
          const err = need(COST.dev, 'a development card'); if (err) return err;
          pay(P, st.bank, COST.dev); flowRes(st, i, 'bank', COST.dev);
          const type = st.devDeck.pop();
          flow(st, 'bank', i, 'dev');
          st.dev[i].push({ type, fresh: true });
          ctx.log(`🃏 ${me} bought a development card.`);
          st.private[i].push(`You bought ${DEV[type][1]} ${DEV[type][0]}.`);
          checkWin(ctx);
          return;
        }
        case 'dev': {
          const type = m.card;
          if (st.devPlayed) return 'Only one development card per turn.';
          if (!['knight', 'roads', 'plenty', 'monopoly'].includes(type)) return;
          if (type !== 'knight' && st.step !== 'main') return 'Roll the dice first.';
          if (type === 'knight' && !['roll', 'main'].includes(st.step)) return 'Not now.';
          const k = st.dev[i].findIndex(d => d.type === type && !d.fresh);
          if (k < 0) return 'You can\'t play that card this turn (cards bought this turn wait until your next turn).';
          if (type === 'plenty') {
            const take = parseList(m.res);
            if (take.length !== 2) return 'Pick 2 resources.';
            const c = parseCounts(m.res);
            if (!has(st.bank, c)) return 'The bank doesn\'t have those.';
            pay(st.bank, P, c); flowRes(st, 'bank', i, c);
            ctx.log(`🎁 ${me} played Year of Plenty: ${fmtRes(c)}.`);
          } else if (type === 'monopoly') {
            const r = m.res; if (!RES.includes(r)) return 'Pick a resource.';
            let got = 0;
            st.res.forEach((o, q) => { if (q !== i) { got += o[r]; P[r] += o[r]; flow(st, q, i, r, o[r]); o[r] = 0; } });
            ctx.log(`💰 ${me} played Monopoly on ${RNAME[r]} and collected ${got}.`);
            ctx.say(`Monopoly! Everyone gives ${me} their ${RNAME[r]}.`, 'pay');
          } else if (type === 'roads') {
            st.freeRoads = 2; st.step = 'roads';
            if (!legal(st, i).road.length) st.step = 'main';
            ctx.log(`🛣️ ${me} played Road Building.`);
          } else {
            st.knights[i]++;
            ctx.log(`⚔️ ${me} played a Knight.`);
            ctx.say(`${me} plays a knight. Move the robber!`, 'point');
            st.afterRobber = st.step; st.step = 'robber';
            updateAwards(ctx);
          }
          st.dev[i].splice(k, 1); st.devPlayed = true;
          checkWin(ctx);
          return;
        }
        case 'bank': {
          if (st.step !== 'main') return 'Roll the dice first.';
          // give / get: lists of cards, mixing resources and rates in one trade (4 🌲 at 4:1 + 2 🐑 at 2:1 → 🧱 + 🌾).
          // A single resource on its own means one lot at your rate for it (giving the bank 1 card is never a trade).
          const get = parseCounts(m.get), one = parseList(m.give);
          const give = one.length === 1 ? { ...parseCounts(m.give), [one[0]]: ratio(st, i, one[0]) } : parseCounts(m.give);
          if (!total(give) || !total(get)) return 'Pick what to give and what to get.';
          if (RES.some(r => give[r] && get[r])) return 'You can\'t take back a resource you are giving.';
          const odd = RES.find(r => give[r] % ratio(st, i, r));
          if (odd) return `${RNAME[odd]} goes to the bank ${ratio(st, i, odd)} at a time (your rate is ${ratio(st, i, odd)}:1).`;
          const credit = RES.reduce((a, r) => a + give[r] / ratio(st, i, r), 0);
          if (credit !== total(get)) return `That buys ${credit} card${credit === 1 ? '' : 's'} from the bank, not ${total(get)}.`;
          if (!has(P, give)) return `You need ${fmtRes(give)}.`;
          if (!has(st.bank, get)) return 'The bank doesn\'t have those.';
          pay(P, st.bank, give); pay(st.bank, P, get);
          flowRes(st, i, 'bank', give); flowRes(st, 'bank', i, get);
          ctx.log(`🏦 ${me} traded ${fmtRes(give)} with the bank for ${fmtRes(get)}.`);
          return;
        }
        case 'end': {
          if (st.step !== 'main') return st.step === 'roll' ? 'Roll the dice first.' : 'Finish what you\'re doing first.';
          endTurn(ctx);
          return;
        }
      }
    },
    status(ctx) {
      const st = ctx.state, who = ctx.players[st.turn].name;
      if (st.step === 'board') return 'Choosing the island';
      if (st.step === 'order') return `Rolling for turn order · ${who} to roll`;
      return st.step.startsWith('setup') ? `Setup · ${who} is placing` : `${who}'s turn${st.dice ? ` · rolled ${st.dice[0] + st.dice[1]}` : ''}`;
    },
    view(ctx, i) {
      const st = ctx.state, mine = st.turn === i;
      const devs = st.dev[i].map(d => ({ type: d.type, fresh: !!d.fresh }));
      return {
        title: mine ? 'Your turn!' : `${ctx.players[st.turn].name}'s turn`,
        mine, step: st.step, board: boardData(st), colors: ctx.players.map(p => p.color), legal: mine ? legal(st, i) : {},
        res: st.res[i], dev: devs, devPlayed: st.devPlayed, deck: st.devDeck.length, bank: st.bank,
        ratios: Object.fromEntries(RES.map(r => [r, ratio(st, i, r)])), dice: st.dice, lastRoll: !st.dice && st.lastRoll ? { name: ctx.players[st.lastRoll.p].name, d: st.lastRoll.d } : null, discard: st.discards[i] || 0, waitingDiscard: Object.keys(st.discards).length,
        victims: st.step === 'steal' && mine ? st.victims.map(q => ({ i: q, name: ctx.players[q].name })) : [],
        // the trades this player is part of; a proposer sees every answer, a recipient only their own
        trades: (st.trades || []).filter(t => t.from === i || t.to.includes(i)).map(t => ({ id: t.id, from: t.from, fromName: ctx.players[t.from].name, give: t.give, want: t.want,
          sent: t.from === i, request: t.from !== st.turn, to: t.to.map(q => ({ i: q, name: ctx.players[q].name, reply: t.from === i || q === i ? t.replies[q] || null : null })),
          myReply: t.replies[i] || null, canAccept: t.to.includes(i) && has(st.res[i], t.want) })),
        canRequest: !mine && st.step === 'main' && isOnline(ctx, st.turn),
        attention: (st.trades || []).reduce((a, t) => a + (t.to.includes(i) && !t.replies[i] ? 1 : 0) + (t.from === i ? Object.values(t.replies).filter(r => r.r !== 'decline').length : 0), 0),
        freeRoads: st.freeRoads, me: i, vp: totalVP(st, i), target: st.target, notes: st.private[i].slice(-3).reverse(),
        players: seatOrder(st, ctx.players.length).map(q => ({ i: q, name: ctx.players[q].name, color: ctx.players[q].color, online: isOnline(ctx, q), left: out(st, q), vp: publicVP(st, q), cards: total(st.res[q]), devs: st.dev[q].length, knights: st.knights[q], road: st.roadLen[q], lr: st.longestRoad === q, la: st.largestArmy === q })),
        turnName: ctx.players[st.turn].name, ordered: st.first != null,
        rolls: st.order ? st.order.rolls.map(r => ({ name: ctx.players[r.p].name, d: r.d, t: r.t })) : [],
        flows: flowsFor(st, i).slice(-12), gid: st.gid,
      };
    },
    hostHTML(ctx, H) {
      const st = ctx.state, colors = ctx.players.map(p => p.color);
      const dice = st.dice ? `<div class="cat-dice">${diceHTML(st.dice, 'big')}</div>`
        : st.lastRoll && st.step !== 'order' ? `<div class="cat-dice cat-last">last roll · ${H.esc(ctx.players[st.lastRoll.p].name)} ${diceHTML(st.lastRoll.d)}</div>` : '';
      const step = { 'setup-settle': 'is placing a settlement', 'setup-road': 'is placing a road', roll: 'is about to roll', main: 'is building and trading', discard: '— waiting for discards', robber: 'is moving the robber', steal: 'is choosing who to steal from', roads: 'is building free roads', order: 'is rolling for turn order' }[st.step];
      // cards that just changed hands make the players' rows glow (+2 🌾 / −1 🧱); stolen cards stay face down
      const now = Date.now(), fx = ctx.catFx = ctx.catFx || { seen: 0, flown: 0, glow: {} };
      collectGlows(fx, flowsFor(st, -1), w => (typeof w === 'number' ? w : null), now);
      const badge = q => { const g = fx.glow[q] || {}, live = Object.keys(g).filter(r => now - g[r].t < GLOW_MS && g[r].n);
        if (!live.length) return '';
        const t0 = Math.min(...live.map(r => g[r].t));
        return `<span class="cat-delta" style="animation-delay:-${now - t0}ms">${live.map(r => `<span class="${g[r].n > 0 ? 'up' : 'down'}">${g[r].n > 0 ? '+' : '−'}${Math.abs(g[r].n)} ${ICON[r] || FLY_ICON[r]}</span>`).join(' ')}</span>`; };
      const glowRow = q => { const g = fx.glow[q] || {}, ts = Object.values(g).filter(x => now - x.t < GLOW_MS).map(x => x.t);
        return ts.length ? ` cat-glow" style="--pc:${colors[q]};animation-delay:-${now - Math.max(...ts)}ms` : `" style="--pc:${colors[q]}`; };
      const order = seatOrder(st, ctx.players.length);
      const head = st.step === 'board'
        ? `<div class="cat-turn"><b>Choose the island</b> Keep this board, or shuffle a new one.</div>
           <div class="cat-hostbtns"><button type="button" data-host="newBoard">🔄 New board</button><button type="button" data-host="useBoard" class="go">✅ Use this board</button></div>`
        : `<div class="cat-turn" style="--pc:${colors[st.turn]}"><b>${H.esc(ctx.players[st.turn].name)}</b> ${step}${dice}</div>`;
      const rolls = st.order && st.order.rolls.length ? `<div class="sec-title">Roll for turn order</div><div class="cat-rolls">${st.order.rolls.map(r =>
        `<span style="--pc:${colors[r.p]}" class="${st.first === r.p ? 'win' : ''}">${H.esc(ctx.players[r.p].name)} ${diceHTML(r.d)}</span>`).join('')}</div>` : '';
      return `<div class="cat-wrap"><div class="cat-main">${boardSVG(boardData(st), colors)}</div>
        <div class="cat-side">
          ${head}
          ${(st.trades || []).map(t => { const A = H.esc(ctx.players[t.from].name), mark = r => (!r ? '…' : { accept: '✅', decline: '✖', counter: '🔁' }[r.r]);
            return `<div class="cat-offer">${t.from === st.turn ? `📣 <b>${A}</b> offers` : `🙋 <b>${A}</b> asks <b>${H.esc(ctx.players[st.turn].name)}</b>:`} ${fmtRes(t.give)} for ${fmtRes(t.want)}
              <div class="cat-replies">${t.to.map(q => `<span>${H.esc(ctx.players[q].name)} ${mark(t.replies[q])}</span>`).join('')}</div></div>`; }).join('')}
          ${st.step === 'order' || (st.step.startsWith('setup') && st.setupIdx === 0) ? rolls : ''}
          <div class="sec-title">${st.first != null ? 'Turn order · ' : ''}Score (first to ${st.target})</div>
          ${fx.removing != null && !out(st, fx.removing) ? `<div class="cat-confirm">Remove <b>${H.esc(ctx.players[fx.removing].name)}</b> from the game? Their roads and buildings come off the board and their cards go back.
            <div class="cat-hostbtns"><button type="button" data-host="removeYes" class="danger">Remove</button><button type="button" data-host="removeNo">Cancel</button></div></div>` : ''}
          <table class="cat-score"><tbody>${order.map((q, k) => { const p = ctx.players[q];
            if (out(st, q)) return `<tr data-p="${q}" class="left"><td>${st.first != null ? `<span class="ord">${k + 1}</span>` : ''}<i style="background:${p.color}"></i>${H.esc(p.name)} <small>left the game</small></td><td colspan="5"></td></tr>`;
            return `<tr data-p="${q}" class="${q === st.turn && st.step !== 'board' ? 'now' : ''}${glowRow(q)}"><td>${st.first != null ? `<span class="ord">${k + 1}</span>` : ''}<i></i>${H.esc(p.name)}${badge(q)}<button type="button" class="cat-x" data-host="remove" data-p="${q}" title="Remove ${H.esc(p.name)} from the game" aria-label="Remove ${H.esc(p.name)}">×</button></td><td class="vp">${publicVP(st, q)}</td>
            <td>🂠 ${total(st.res[q])}</td><td>🃏 ${st.dev[q].length}</td><td>⚔️ ${st.knights[q]}</td><td>🛣️ ${st.roadLen[q]}</td></tr>`; }).join('')}</tbody></table>
          <div class="cat-awards"><div class="${st.longestRoad != null ? 'on' : ''}">🛣️ Longest Road<b>${st.longestRoad != null ? H.esc(ctx.players[st.longestRoad].name) + ` (${st.roadLen[st.longestRoad]})` : 'not awarded'}</b></div>
            <div class="${st.largestArmy != null ? 'on' : ''}">⚔️ Largest Army<b>${st.largestArmy != null ? H.esc(ctx.players[st.largestArmy].name) + ` (${st.knights[st.largestArmy]})` : 'not awarded'}</b></div></div>
          <div class="sec-title">Bank</div><div class="cat-bank">${resRow(st.bank)}</div>
          <div class="sec-title">Development cards</div><div class="cat-deck"><span class="stack"><span class="cat-devback">🃏</span><span class="n">${st.devDeck.length}</span></span> left in the deck</div>
          <div class="note">VP shown are public; secret ⭐ cards count too.</div>
        </div></div>`;
    },
    // After each Mac render: cards fly from where they came from (a hex, the bank, a player's row) to where they went
    hostAfter(el, ctx) {
      const st = ctx.state, fx = ctx.catFx;
      if (!st || !fx) return;
      const fresh = flowsFor(st, -1).filter(f => f.id > fx.flown);
      if (!fresh.length) return;
      fx.flown = Math.max(...fresh.map(f => f.id));
      if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const at = w => el.querySelector(w === 'bank' ? '.cat-bank' : typeof w === 'number' ? `tr[data-p="${w}"]` : `[data-hex="${String(w).slice(1)}"]`);
      let k = 0;
      fresh.forEach(f => {
        const a = at(f.from), b = at(f.to);
        if (!a || !b) return;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const x0 = ra.left + ra.width / 2, y0 = ra.top + ra.height / 2, x1 = rb.left + Math.min(rb.width / 2, 70), y1 = rb.top + rb.height / 2;
        for (let c = 0; c < Math.min(f.n, 3) && k < 18; c++, k++) {
          const card = document.createElement('div');
          card.className = 'cat-fly' + (f.r === 'hidden' ? ' back' : f.r === 'dev' ? ' dev' : '');
          card.textContent = ICON[f.r] || FLY_ICON[f.r];
          card.style.left = x0 + 'px'; card.style.top = y0 + 'px';
          document.body.appendChild(card);
          const to = `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px))`;
          card.animate([{ transform: 'translate(-50%, -50%) scale(.5)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1, offset: .15 },
            { transform: `${to} scale(.85)`, opacity: 1, offset: .85 }, { transform: `${to} scale(.6)`, opacity: 0 }],
          { duration: 1100, delay: k * 110, easing: 'ease-in-out', fill: 'both' }).onfinish = () => card.remove();
        }
      });
    },
    phoneNotify: (b, v) => v && v.mine && (!b || !b.mine || (b.step !== v.step && ['roll', 'robber', 'steal', 'setup-settle', 'order'].includes(v.step))) || (v && v.discard && !(b && b.discard)) || (v && (v.attention || 0) > ((b && b.attention) || 0)),
    phoneLocal(d, v, local) {
      const n = +d.n || 1;
      if (d.local === 'mode') local.mode = local.mode === d.mode ? null : d.mode;
      if (d.local === 'pick') { local[d.list] = local[d.list] || []; for (let k = 0; k < n; k++) local[d.list].push(d.r); }
      if (d.local === 'unpick') { const L = local[d.list] || []; for (let k = 0; k < n; k++) { const j = L.lastIndexOf(d.r); if (j >= 0) L.splice(j, 1); } }
      if (d.local === 'clear') local[d.list] = [];
      if (d.local === 'tab') local.tab = d.tab;
      if (d.local === 'to') {                            // who an offer goes to (everyone online until you pick)
        const all = v.players.filter(p => p.i !== v.me && p.online).map(p => p.i), cur = local.to || all, q = +d.q;
        local.to = cur.includes(q) ? cur.filter(x => x !== q) : [...cur, q];
      }
      if (d.local === 'ask') local.ask = !local.ask;
      if (d.local === 'counter') {                       // start a counter-offer from the trade's own cards
        const t = v.trades.find(x => x.id === +d.id), cards = o => RES.flatMap(r => Array(o[r] || 0).fill(r));
        if (t) { local.counter = local.counter === t.id ? null : t.id; local.cg = cards(t.want); local.cw = cards(t.give); }
      }
    },
    phoneAct(m, v, local) {
      if (m.act === 'build' && m.kind !== 'road') local.mode = null;
      if (['discard', 'offer', 'dev', 'bank', 'reply'].includes(m.act)) Object.assign(local, { disc: [], give: [], want: [], yp: [], bg: [], bt: [], cg: [], cw: [], counter: null, ask: false });
    },
    phoneHTML(v, local, H) {
      const L = v.legal || {}, st = v.step, now = Date.now();
      // your own cards glow when they arrive (green) or leave (red); a new game starts fresh
      if (!local.fx || local.fx.gid !== v.gid) local.fx = { gid: v.gid, seen: Math.max(0, ...(v.flows || []).map(f => f.id)), glow: {} };
      collectGlows(local.fx, v.flows || [], w => (w === v.me ? 'me' : null), now);
      let hl = {};
      if (v.mine) {
        if (st === 'setup-settle') hl = { settlement: L.settlement };
        else if (st === 'setup-road' || st === 'roads') hl = { road: L.road };
        else if (st === 'robber') hl = { robber: L.robber };
        else if (st === 'main' && local.mode) hl = { [local.mode]: L[local.mode] };
      }
      const board = `<div class="cat-phone-board">${boardSVG(v.board, v.colors, { hl })}</div>`;
      const cards = local.list || [];
      void cards;
      const cnt = (L, r) => L.filter(x => x === r).length, counts = L => Object.fromEntries(RES.map(r => [r, cnt(L, r)]));
      // +/− for each resource. step: cards per tap (e.g. your bank rate); max: the most of each (e.g. your hand); limit: the most in all
      const stepper = (list, label, { max, limit, step, sub } = {}) => {
        const sel = local[list] || [];
        return `<div class="sec-title">${label}${sel.length ? ` · ${sel.length} <button class="mini" type="button" data-local="clear" data-list="${list}">clear</button>` : ''}</div>
          <div class="cat-steps">${RES.map(r => {
            const n = cnt(sel, r), by = step ? step[r] : 1, up = (!max || n + by <= (max[r] || 0)) && (limit == null || sel.length + by <= limit);
            return `<div class="st"><button type="button" data-local="pick" data-list="${list}" data-r="${r}" data-n="${by}" ${up ? '' : 'disabled'} aria-label="More ${RNAME[r]}">+</button><span class="ic">${ICON[r]}</span><b>${n}</b><button type="button" data-local="unpick" data-list="${list}" data-r="${r}" data-n="${by}" ${n ? '' : 'disabled'} aria-label="Less ${RNAME[r]}">−</button>${sub ? `<small>${sub[r]}</small>` : ''}</div>`;
          }).join('')}</div>`;
      };
      // trades: yours (with every answer) and the ones sent to you (accept, no thanks, or counter)
      const sentHTML = t => `<div class="cat-offer">${t.request ? `🙋 You asked <b>${H.esc(t.to[0].name)}</b>` : '📣 Your offer'}: you give ${fmtRes(t.give)}, you get ${fmtRes(t.want)} <button class="mini" type="button" data-act="withdraw">withdraw</button>
        ${t.to.map(x => `<div class="cat-rep"><span>${H.esc(x.name)}</span> ${!x.reply ? '<i>waiting…</i>' : x.reply.r === 'decline' ? '✖ no thanks'
          : x.reply.r === 'accept' ? `✅ accepts <button type="button" class="mini go" data-act="confirm" data-id="${t.id}" data-p="${x.i}">Trade with ${H.esc(x.name)}</button>`
          : `🔁 counters: you give ${fmtRes(x.reply.give)}, you get ${fmtRes(x.reply.want)} <button type="button" class="mini go" data-act="confirm" data-id="${t.id}" data-p="${x.i}">Accept</button>`}</div>`).join('')}</div>`;
      const inHTML = t => {
        const head = `${t.request ? '🙋' : '📣'} <b>${H.esc(t.fromName)}</b> ${t.request ? 'asks you' : 'offers'}: you get ${fmtRes(t.give)}, you give ${fmtRes(t.want)}`;
        if (t.myReply) return `<div class="cat-offer">${head}<div class="note">You said ${{ decline: 'no thanks', accept: `yes; waiting for ${H.esc(t.fromName)}`, counter: `a counter-offer; waiting for ${H.esc(t.fromName)}` }[t.myReply.r]}.</div></div>`;
        const editing = local.counter === t.id, cg = local.cg || [], cw = local.cw || [];
        return `<div class="cat-offer">${head}
          <div class="choice"><button type="button" data-act="reply" data-id="${t.id}" data-r="accept" ${t.canAccept ? '' : 'disabled'}>✅ Accept</button><button type="button" data-act="reply" data-id="${t.id}" data-r="decline">✖ No thanks</button><button type="button" data-local="counter" data-id="${t.id}" class="${editing ? 'on' : ''}">🔁 Counter</button></div>
          ${editing ? `${stepper('cg', 'You give', { max: v.res })}${stepper('cw', 'You get')}
            <button class="go" type="button" data-act="reply" data-id="${t.id}" data-r="counter" data-give="${cw.join(',')}" data-want="${cg.join(',')}" ${cg.length && cw.length ? '' : 'disabled'}>🔁 Send: ${fmtRes(counts(cg)) || '…'} for ${fmtRes(counts(cw)) || '…'}</button>` : ''}</div>`;
      };
      const tradesHTML = (v.trades || []).map(t => (t.sent ? sentHTML(t) : inHTML(t))).join('');
      let actions = '';
      if (v.discard) {
        const sel = local.disc || [];
        actions = `<div class="cat-alert">Seven! Discard ${v.discard} cards.</div>${stepper('disc', 'Cards to discard', { max: v.res, limit: v.discard })}
          <button class="go red" type="button" data-act="discard" data-res="${sel.join(',')}" ${sel.length === v.discard ? '' : 'disabled'}>Discard ${sel.length} of ${v.discard}</button>`;
      } else if (st === 'board') actions = '<div class="note" style="text-align:center">The host is choosing the island on the Mac…</div>';
      else if (st === 'order') {
        actions = (v.mine ? '<div class="cat-alert">Roll for turn order: the highest roll starts.</div><button class="go" type="button" data-act="orderRoll">🎲 Roll for turn order</button>'
          : `<div class="note" style="text-align:center">${H.esc(v.turnName)} is rolling for turn order…</div>`)
          + (v.rolls.length ? `<div class="cat-rolls">${v.rolls.map(r => `<span>${H.esc(r.name)} ${diceHTML(r.d)}</span>`).join('')}</div>` : '');
      } else if (v.mine) {
        if (st === 'setup-settle') actions = '<div class="cat-alert">Tap a glowing corner to place your settlement.</div>';
        else if (st === 'setup-road') actions = '<div class="cat-alert">Tap a glowing edge to place your road.</div>';
        else if (st === 'roll') actions = `<button class="go" type="button" data-act="roll">🎲 Roll the dice</button>${v.dev.some(d => d.type === 'knight' && !d.fresh) && !v.devPlayed ? '<button class="go" type="button" data-act="dev" data-card="knight" style="background:#334155;color:#fff">⚔️ Play a Knight first</button>' : ''}`;
        else if (st === 'discard') actions = `<div class="cat-alert">Waiting for ${v.waitingDiscard} player(s) to discard…</div>`;
        else if (st === 'robber') actions = '<div class="cat-alert">Tap a hex to move the robber there.</div>';
        else if (st === 'steal') actions = `<div class="cat-alert">Steal a card from:</div><div class="choice">${v.victims.map(q => `<button type="button" data-act="steal" data-p="${q.i}">${H.esc(q.name)}</button>`).join('')}</div>`;
        else if (st === 'roads') actions = `<div class="cat-alert">Road Building: tap a glowing edge (${v.freeRoads} free road${v.freeRoads === 1 ? '' : 's'} left).</div>`;
        else if (st === 'main') {
          const can = c => RES.every(r => (v.res[r] || 0) >= (COST[c][r] || 0));
          const tab = local.tab || 'build';
          const modeBtn = (mode, label, cost) => `<button type="button" data-local="mode" data-mode="${mode}" class="${local.mode === mode ? 'on' : ''}" ${can(mode) && (L[mode] || []).length ? '' : 'disabled'}>${label}<small>${fmtRes(cost)}</small></button>`;
          actions = tradesHTML + `<div class="cat-tabs">${[['build', '🔨 Build'], ['cards', '🃏 Cards'], ['trade', '🤝 Trade']].map(([t, l]) => `<button type="button" data-local="tab" data-tab="${t}" class="${tab === t ? 'on' : ''}">${l}</button>`).join('')}</div>`;
          if (tab === 'build') actions += `<div class="choice cat-build">${modeBtn('road', '🛣️ Road', COST.road)}${modeBtn('settlement', '🏠 Settlement', COST.settlement)}${modeBtn('city', '🏙️ City', COST.city)}</div>
              ${local.mode ? `<div class="note">Tap a glowing ${local.mode === 'road' ? 'edge' : 'spot'} on the board above.</div>` : ''}
              <button class="go" type="button" data-act="buydev" ${can('dev') && v.deck ? '' : 'disabled'} style="background:#334155;color:#fff">🃏 Buy development card · ${fmtRes(COST.dev)}</button>`;
          if (tab === 'cards') {
            const playable = t => !v.devPlayed && v.dev.some(d => d.type === t && !d.fresh);
            const yp = local.yp || [];
            actions += `<div class="cat-devs">${v.dev.length ? v.dev.map(d => `<span class="dv${d.fresh ? ' fresh' : ''}">${DEV[d.type][1]} ${DEV[d.type][0]}${d.fresh ? ' <small>(new)</small>' : ''}</span>`).join('') : '<span class="note">No development cards.</span>'}</div>
              ${playable('knight') ? '<button class="go" type="button" data-act="dev" data-card="knight">⚔️ Play Knight</button>' : ''}
              ${playable('roads') ? '<button class="go" type="button" data-act="dev" data-card="roads">🛣️ Play Road Building</button>' : ''}
              ${playable('plenty') ? `${stepper('yp', 'Year of Plenty: pick 2', { max: v.bank, limit: 2 })}<button class="go" type="button" data-act="dev" data-card="plenty" data-res="${yp.join(',')}" ${yp.length === 2 ? '' : 'disabled'}>🎁 Take ${yp.map(r => ICON[r]).join(' ')}</button>` : ''}
              ${playable('monopoly') ? `<div class="sec-title">Monopoly: name a resource</div><div class="choice">${RES.map(r => `<button type="button" data-act="dev" data-card="monopoly" data-res="${r}">${ICON[r]} ${RNAME[r]}</button>`).join('')}</div>` : ''}
              ${v.devPlayed ? '<p class="note">You already played a development card this turn.</p>' : ''}`;
          }
          if (tab === 'trade') {
            const give = local.give || [], want = local.want || [], bg = local.bg || [], bt = local.bt || [];
            const credit = RES.reduce((a, r) => a + cnt(bg, r) / v.ratios[r], 0), clash = RES.some(r => cnt(bg, r) && cnt(bt, r));
            const others = v.players.filter(p => p.i !== v.me && !p.left), online = others.filter(p => p.online).map(p => p.i);
            const to = (local.to || online).filter(q => online.includes(q));
            const toLabel = to.length === online.length ? 'everyone' : to.map(q => others.find(p => p.i === q).name).join(', ');
            actions += `<div class="sec-title">Trade with the bank</div>
              ${stepper('bg', 'You give the bank', { max: v.res, step: v.ratios, sub: Object.fromEntries(RES.map(r => [r, `${v.ratios[r]}:1`])) })}
              ${stepper('bt', `You take${credit ? ` ${credit}` : ''}`, { max: Object.fromEntries(RES.map(r => [r, cnt(bg, r) ? 0 : v.bank[r]])), limit: credit })}
              <button class="go" type="button" data-act="bank" data-give="${bg.join(',')}" data-get="${bt.join(',')}" ${credit && bt.length === credit && !clash ? '' : 'disabled'}>🏦 Trade ${fmtRes(counts(bg)) || '…'} for ${fmtRes(counts(bt)) || '…'}</button>
              <div class="sec-title" style="margin-top:16px">Trade with players</div>
              ${stepper('give', 'You give', { max: v.res })}${stepper('want', 'You want')}
              <div class="sec-title">Offer to</div><div class="cat-to">${others.map(p => `<button type="button" data-local="to" data-q="${p.i}" class="${to.includes(p.i) ? 'on' : ''}" ${p.online ? '' : 'disabled'} style="--pc:${p.color}">${H.esc(p.name)}${p.online ? '' : ' · offline'}</button>`).join('')}</div>
              <button class="go" type="button" data-act="offer" data-give="${give.join(',')}" data-want="${want.join(',')}" data-to="${to.join(',')}" ${give.length && want.length && to.length ? '' : 'disabled'}>📣 Offer ${fmtRes(counts(give)) || '…'} for ${fmtRes(counts(want)) || '…'} to ${H.esc(toLabel || 'nobody')}</button>`;
          }
          actions += `<button class="go red" type="button" data-act="end" style="margin-top:14px">End turn</button>`;
        }
      } else {
        // someone else's turn: answer their offers, or ask them for a trade
        const asked = (v.trades || []).some(t => t.sent), give = local.give || [], want = local.want || [];
        actions = tradesHTML + (v.canRequest && !asked ? (local.ask
          ? `<div class="cat-offer">🙋 Ask <b>${H.esc(v.turnName)}</b> for a trade ${stepper('give', 'You give', { max: v.res })}${stepper('want', 'You want')}
              <div class="choice"><button class="go" type="button" data-act="offer" data-give="${give.join(',')}" data-want="${want.join(',')}" ${give.length && want.length ? '' : 'disabled'}>🙋 Send: ${fmtRes(counts(give)) || '…'} for ${fmtRes(counts(want)) || '…'}</button><button type="button" data-local="ask">Cancel</button></div></div>`
          : `<button class="go" type="button" data-local="ask" style="background:#334155;color:#fff">🙋 Ask ${H.esc(v.turnName)} for a trade</button>`) : '')
          + `<div class="note" style="text-align:center">${H.esc(v.turnName)} is playing…</div>`;
      }
      return `${board}
        <div class="cat-me"><span>⭐ ${v.vp} / ${v.target} VP</span>${v.dice ? diceHTML(v.dice) : v.lastRoll ? `<span class="cat-last">${H.esc(v.lastRoll.name)} ${diceHTML(v.lastRoll.d)}</span>` : ''}</div>
        ${resRow(v.res, 'mine', local.fx.glow.me, now)}
        ${v.notes.length ? `<div class="note">${v.notes.map(H.esc).join('<br>')}</div>` : ''}
        ${actions}
        <div class="sec-title">${v.ordered ? 'Turn order' : 'Players'}</div>${v.ordered && !v.dice && !v.lastRoll && v.rolls.length ? `<div class="cat-rolls">${v.rolls.map(r => `<span>${H.esc(r.name)} ${diceHTML(r.d)}</span>`).join('')}</div>` : ''}<div class="pills">${v.players.map((p, k) => `<span class="p${p.left ? ' left' : ''}" style="box-shadow:inset 3px 0 0 ${p.color}">${v.ordered ? `<span class="ord">${k + 1}</span>` : ''}${H.esc(p.name)} ${p.vp}⭐ · ${p.cards}🂠${p.lr ? ' 🛣️' : ''}${p.la ? ' ⚔️' : ''}</span>`).join('')}</div>`;
    },
    css: `
      .cat-wrap { display: grid; grid-template-columns: 1fr 330px; gap: 18px; align-items: start; }
      @media (max-width: 1100px) { .cat-wrap { grid-template-columns: 1fr; } }
      .cat-board { width: 100%; height: auto; display: block; }
      .cat-main .cat-board { max-height: 80vh; }
      .cat-wrap { grid-template-columns: 1fr 340px; }
      .pick-vert, .pick-edge, .pick-hex, .pick-hit { cursor: pointer; }
      .pick-vert { animation: catPulse 1s ease-in-out infinite alternate; }
      @keyframes catPulse { from { opacity: .55; } to { opacity: 1; } }
      .cat-turn { padding: 10px 12px; border-radius: 10px; background: rgba(0,0,0,.3); border-left: 5px solid var(--pc); display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .cat-dice { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
      .cat-last { font-size: .8rem; color: var(--muted, #b9c4bc); display: inline-flex; align-items: center; gap: 6px; }
      .cat-dice2 { display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; }
      .cat-dice2 b { font-size: 1.05rem; margin-left: 3px; color: var(--text, #fff); }
      .cat-die { display: inline-grid; grid-template: repeat(3, 1fr) / repeat(3, 1fr); gap: 1px; width: 24px; height: 24px; padding: 3px; box-sizing: border-box;
        border-radius: 6px; background: #fffdf5; box-shadow: inset 0 -2px 0 #d6cfbf, 0 2px 4px rgba(0,0,0,.4); }
      .cat-die i { border-radius: 50%; } .cat-die i.on { background: #1b1b1b; }
      .cat-dice2.big .cat-die { width: 38px; height: 38px; padding: 5px; gap: 2px; border-radius: 8px; } .cat-dice2.big b { font-size: 1.5rem; margin-left: 6px; }
      .cat-score { width: 100%; border-collapse: collapse; font-size: .9rem; }
      .cat-score td { padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,.1); white-space: nowrap; }
      .cat-score tr.now td { background: rgba(255,255,255,.06); }
      .cat-score i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--pc); margin-right: 6px; }
      .cat-score .vp { font-weight: 900; font-size: 1.15rem; color: var(--gold, #d4af37); }
      .cat-awards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
      .cat-awards div { padding: 8px; border-radius: 10px; background: rgba(0,0,0,.25); font-size: .8rem; color: var(--muted, #b9c4bc); display: grid; gap: 2px; }
      .cat-awards div.on { background: rgba(212,175,55,.2); color: var(--gold, #d4af37); }
      .cat-awards b { color: var(--text, #fff); font-size: .9rem; }
      .cat-res { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
      .cat-res .rc { display: grid; justify-items: center; padding: 6px 2px; border-radius: 10px; background: rgba(0,0,0,.3); }
      .cat-res .rc i { font-style: normal; font-size: 1.3rem; } .cat-res .rc b { font-size: 1.05rem; }
      .cat-res.mine .rc { background: rgba(255,255,255,.1); }
      .cat-deck { display: flex; align-items: center; gap: 14px; }
      .cat-devback { display: grid; place-items: center; width: 46px; height: 64px; border-radius: 8px; background: linear-gradient(#5b3b8c, #2a1f45); border: 2px solid #fff; font-size: 1.4rem; }
      .cat-offer { margin: 10px 0; padding: 10px; border-radius: 10px; background: rgba(212,175,55,.18); border: 1px solid rgba(212,175,55,.6); }
      .cat-alert { margin: 10px 0; padding: 10px 12px; border-radius: 10px; background: rgba(212,175,55,.2); font-weight: 800; text-align: center; }
      .cat-phone-board { margin: 0 -8px 8px; }
      .cat-me { display: flex; justify-content: space-between; font-weight: 800; margin: 6px 2px; }
      .cat-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 10px 0; }
      .cat-tabs button { padding: 10px; border-radius: 10px; border: 2px solid rgba(255,255,255,.25); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-weight: 800; }
      .cat-tabs button.on { border-color: var(--gold, #d4af37); background: rgba(212,175,55,.2); }
      .cat-build button { display: grid; justify-items: center; gap: 2px; flex: 1; } .cat-build small { font-size: .72rem; font-weight: 600; }
      .cat-picks { display: flex; gap: 6px; flex-wrap: wrap; }
      .cat-picks .pk { display: inline-flex; align-items: center; }
      .cat-picks button { position: relative; padding: 8px 10px; font-size: 1.3rem; border-radius: 10px; border: 2px solid rgba(255,255,255,.25); background: rgba(0,0,0,.3); color: inherit; }
      .cat-picks button b { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; border-radius: 10px; background: var(--gold, #d4af37); color: #1d1500; font-size: .75rem; display: grid; place-items: center; }
      .cat-picks .minus { font-size: 1rem; padding: 4px 8px; margin-left: 2px; }
      .cat-devs { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
      .cat-devs .dv { padding: 6px 10px; border-radius: 8px; background: rgba(91,59,140,.5); font-weight: 700; font-size: .88rem; } .cat-devs .fresh { opacity: .7; }
      .cat-res .rc { position: relative; }
      .cat-res .rc.cat-up { animation: catUp ${GLOW_MS}ms ease-out both; } .cat-res .rc.cat-down { animation: catDown ${GLOW_MS}ms ease-out both; }
      .cat-res .rc[data-d]::after { content: attr(data-d); position: absolute; top: -9px; right: -4px; padding: 1px 6px; border-radius: 99px; font-size: .78rem; font-weight: 900; color: #fff; background: #16a34a; animation: catBadge ${GLOW_MS}ms ease-out both; animation-delay: inherit; }
      .cat-res .rc.cat-down[data-d]::after { background: #dc2626; }
      @keyframes catUp { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 12%, 60% { box-shadow: 0 0 0 3px #4ade80, 0 0 18px #4ade80; background: rgba(74,222,128,.3); } }
      @keyframes catDown { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 12%, 60% { box-shadow: 0 0 0 3px #f87171, 0 0 18px #f87171; background: rgba(248,113,113,.3); } }
      @keyframes catBadge { 0% { opacity: 0; transform: translateY(5px); } 10%, 75% { opacity: 1; transform: none; } 100% { opacity: 0; } }
      .cat-score tr.cat-glow td { animation: catRow ${GLOW_MS}ms ease-out both; animation-delay: inherit; }
      @keyframes catRow { 0%, 100% { background: transparent; } 12%, 55% { background: rgba(255,255,255,.18); } }
      .cat-delta { margin-left: 8px; font-size: .82rem; font-weight: 900; animation: catBadge ${GLOW_MS}ms ease-out both; }
      .cat-delta .up { color: #4ade80; } .cat-delta .down { color: #f87171; }
      .ord { display: inline-grid; place-items: center; width: 20px; height: 20px; margin-right: 6px; border-radius: 50%; background: var(--gold, #d4af37); color: #1d1500; font-size: .75rem; font-weight: 900; vertical-align: middle; }
      .cat-rolls small { opacity: .75; }
      .cat-fly { position: fixed; z-index: 60; width: 34px; height: 46px; border-radius: 6px; display: grid; place-items: center; font-size: 1.25rem;
        background: #fffdf5; border: 2px solid #fff; box-shadow: 0 6px 16px rgba(0,0,0,.45); pointer-events: none; }
      .cat-fly.back { background: linear-gradient(#a8242a, #6b1218); color: #f3dc8b; } .cat-fly.dev { background: linear-gradient(#5b3b8c, #2a1f45); }
      @media (prefers-reduced-motion: reduce) { .cat-fly { display: none; } }
      .cat-hostbtns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
      .cat-hostbtns button { padding: 12px 10px; border-radius: 10px; border: 2px solid rgba(255,255,255,.3); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-weight: 800; cursor: pointer; }
      .cat-hostbtns .danger { background: linear-gradient(#e0565c, #8f1d22); color: #fff; border-color: #ffb4b7; }
      .cat-confirm { margin: 10px 0; padding: 10px 12px; border-radius: 10px; background: rgba(192,38,45,.2); border: 1px solid rgba(255,180,183,.6); font-size: .9rem; }
      .cat-x { margin-left: 6px; width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,.3); background: rgba(0,0,0,.3); color: var(--muted, #b9c4bc); font-size: .85rem; line-height: 1; cursor: pointer; opacity: .55; }
      .cat-x:hover { opacity: 1; color: #fff; background: #8f1d22; }
      .cat-score tr.left td { opacity: .45; } .cat-score tr.left small { font-style: italic; }
      .pills .p.left { opacity: .45; text-decoration: line-through; }
      .cat-hostbtns .go { background: linear-gradient(#e6c55a, #b8901f); color: #1d1500; border-color: #f3dc8b; }
      .cat-rolls { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
      .cat-rolls span { padding: 4px 10px; border-radius: 99px; background: rgba(0,0,0,.3); border-left: 4px solid var(--pc, rgba(255,255,255,.3)); font-size: .9rem; }
      .cat-rolls span.win { background: rgba(212,175,55,.3); font-weight: 800; }
      .cat-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px; }
      .cat-steps .st { display: grid; justify-items: center; gap: 3px; padding: 6px 2px; border-radius: 10px; background: rgba(0,0,0,.3); }
      .cat-steps .st button { width: 42px; height: 34px; border-radius: 9px; border: 1px solid rgba(255,255,255,.3); background: rgba(255,255,255,.1); color: inherit; font: inherit; font-size: 1.25rem; font-weight: 900; line-height: 1; }
      .cat-steps .st button:disabled { opacity: .3; }
      .cat-steps .ic { font-size: 1.3rem; } .cat-steps b { font-size: 1.05rem; } .cat-steps small { font-size: .7rem; opacity: .75; }
      .cat-to { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
      .cat-to button { padding: 8px 14px; border-radius: 99px; border: 2px solid rgba(255,255,255,.25); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-weight: 700; box-shadow: inset 4px 0 0 var(--pc); }
      .cat-to button.on { border-color: var(--gold, #d4af37); background: rgba(212,175,55,.25); } .cat-to button:disabled { opacity: .45; }
      .cat-rep { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; font-size: .9rem; } .cat-rep > span { font-weight: 800; }
      .cat-replies { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; font-size: .85rem; opacity: .9; }
      .mini.go { width: auto; margin: 0 0 0 4px; border-radius: 8px; background: var(--gold, #d4af37); color: #1d1500; border-color: #f3dc8b; font-weight: 800; padding: 6px 12px; font-size: .85rem; }
      .mini { padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,.4); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-size: .75rem; margin-left: 6px; }`,
  };
  return api;
})();
