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
    // 9 harbors spread evenly along the coast
    const coast = g.edges.map((e, i) => ({ i, e })).filter(o => o.e.hexes.length === 1)
      .map(o => { const a = g.verts[o.e.a], b = g.verts[o.e.b]; return { ...o, ang: Math.atan2((a.y + b.y) / 2, (a.x + b.x) / 2) }; })
      .sort((p, q) => p.ang - q.ang);
    const types = shuffle(['any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'wheat', 'ore']);
    g.ports = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => {
      const o = coast[Math.floor(k * coast.length / 9 + 1) % coast.length], a = g.verts[o.e.a], b = g.verts[o.e.b];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(mx, my);
      return { type: types[k], a: o.e.a, b: o.e.b, x: mx + mx / d * .55, y: my + my / d * .55 };
    });
    g.robber = g.hexes.findIndex(h => h.res === 'desert');
    return g;
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
  function updateAwards(ctx) {
    const st = ctx.state, n = ctx.players.length;
    st.roadLen = ctx.players.map((_, p) => longest(st, p));
    const lr = award(st.longestRoad, st.roadLen, 5), la = award(st.largestArmy, st.knights, 3);
    if (lr !== st.longestRoad) { ctx.log(lr == null ? '🛣️ Nobody holds Longest Road now.' : `🛣️ ${ctx.players[lr].name} takes Longest Road (${st.roadLen[lr]}).`); if (lr != null) ctx.say(`${ctx.players[lr].name} has the longest road!`, 'pay'); }
    if (la !== st.largestArmy && la != null) { ctx.log(`⚔️ ${ctx.players[la].name} takes Largest Army (${st.knights[la]} knights).`); ctx.say(`${ctx.players[la].name} has the largest army!`, 'pay'); }
    st.longestRoad = lr; st.largestArmy = la;
    void n;
  }
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
    ctx.end(ctx.players.map((pl, i) => ({ name: pl.name, won: i === p, points: totalVP(st, i) })),
      `<div class="note" style="text-align:center">Longest Road: ${st.longestRoad != null ? PartyKit.esc(ctx.players[st.longestRoad].name) : 'nobody'} · Largest Army: ${st.largestArmy != null ? PartyKit.esc(ctx.players[st.largestArmy].name) : 'nobody'}</div>`);
    return true;
  }

  /* ---------- Turn flow ---------- */
  function produce(ctx, roll) {
    const st = ctx.state, gain = ctx.players.map(() => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }));
    st.board.hexes.forEach((h, hi) => {
      if (h.num !== roll || hi === st.board.robber) return;
      h.v.forEach(v => { const b = st.bld[v]; if (b) gain[b.p][h.res] += b.city ? 2 : 1; });
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
    const lines = gain.map((g, p) => total(g) ? `${ctx.players[p].name} +${fmtRes(g)}` : null).filter(Boolean);
    ctx.log(`🎲 ${roll}: ${lines.length ? lines.join(' · ') : 'no production'}`);
  }
  function afterSeven(ctx) {
    const st = ctx.state;
    st.discards = {};
    ctx.players.forEach((_, p) => { const t = total(st.res[p]); if (t > 7) st.discards[p] = Math.floor(t / 2); });
    if (Object.keys(st.discards).length) {
      st.step = 'discard';
      ctx.say(`Seven! ${Object.keys(st.discards).map(p => ctx.players[p].name).join(' and ')} must discard half their cards.`, 'shake');
    } else { st.step = 'robber'; ctx.say(`Seven! ${ctx.players[st.turn].name}, move the robber.`, 'shake'); }
  }
  function startTurn(ctx) {
    const st = ctx.state;
    st.step = 'roll'; st.dice = null; st.devPlayed = false; st.offer = null; st.turnNo++;
    st.dev.forEach(list => list.forEach(d => { d.fresh = false; }));
    if (checkWin(ctx)) return;
    ctx.say(`${ctx.players[st.turn].name}, your turn. Roll the dice!`);
  }
  function endTurn(ctx) {
    const st = ctx.state;
    st.turn = (st.turn + 1) % ctx.players.length;
    startTurn(ctx);
  }
  function placeSetup(ctx) {
    const st = ctx.state, n = ctx.players.length, k = st.setupIdx;
    if (k >= 2 * n) { st.turn = st.first; ctx.log('Setup done. Let the game begin!'); return startTurn(ctx); }
    st.turn = k < n ? (st.first + k) % n : (st.first + 2 * n - 1 - k) % n;
    st.step = 'setup-settle';
    ctx.say(`${ctx.players[st.turn].name}, place your ${k < n ? 'first' : 'second'} settlement.`);
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
    ctx.log(`🫳 ${ctx.players[p].name} stole a card from ${ctx.players[q].name}.`);
    st.private[p].push(`You stole ${ICON[r]} ${RNAME[r]} from ${ctx.players[q].name}.`);
    st.private[q].push(`${ctx.players[p].name} stole your ${ICON[r]} ${RNAME[r]}.`);
  }
  const parseList = s => String(s || '').split(',').filter(r => RES.includes(r));
  const parseCounts = s => { const o = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }; parseList(s).forEach(r => o[r]++); return o; };

  /* ---------- Board drawing (shared by the Mac and the phones) ---------- */
  function boardSVG(b, colors, opt = {}) {
    const hl = opt.hl || {}, sz = 46, X = x => (x * sz).toFixed(1), Y = y => (y * sz).toFixed(1);
    let s = '';
    b.hexes.forEach((h, i) => {
      const pts = h.v.map(v => `${X(b.verts[v].x)},${Y(b.verts[v].y)}`).join(' ');
      const pick = hl.robber && hl.robber.includes(i);
      s += `<polygon points="${pts}" fill="${FILL[h.res]}" stroke="#f3e2b5" stroke-width="2.5"${pick ? ` class="pick-hex" data-act="robber" data-h="${i}"` : ''}/>`;
      s += `<text x="${X(h.x)}" y="${Y(h.y - .5)}" font-size="${sz * .34}" text-anchor="middle" opacity=".9" pointer-events="none">${ICON[h.res]}</text>`;
      if (h.num) {
        const hot = h.num === 6 || h.num === 8, pips = 6 - Math.abs(7 - h.num);
        s += `<circle cx="${X(h.x)}" cy="${Y(h.y + .08)}" r="${sz * .3}" fill="#fff8e6" stroke="#6b4f1d" stroke-width="1.2" pointer-events="none"/>
          <text x="${X(h.x)}" y="${Y(h.y + .18)}" font-size="${sz * .3}" font-weight="900" text-anchor="middle" fill="${hot ? '#c0262d' : '#1b1b1b'}" pointer-events="none">${h.num}</text>
          <text x="${X(h.x)}" y="${Y(h.y + .33)}" font-size="${sz * .16}" text-anchor="middle" fill="${hot ? '#c0262d' : '#1b1b1b'}" pointer-events="none">${'•'.repeat(pips)}</text>`;
      }
      if (i === b.robber) s += `<g pointer-events="none"><circle cx="${X(h.x + .38)}" cy="${Y(h.y - .05)}" r="${sz * .17}" fill="#1b1b1b" stroke="#fff" stroke-width="1.5"/><text x="${X(h.x + .38)}" y="${Y(h.y + .04)}" font-size="${sz * .2}" text-anchor="middle">🦹</text></g>`;
      if (pick) s += `<circle cx="${X(h.x)}" cy="${Y(h.y)}" r="${sz * .45}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 4" pointer-events="none" class="pulse"/>`;
    });
    b.ports.forEach(o => {
      const a = b.verts[o.a], c = b.verts[o.b];
      s += `<line x1="${X(o.x)}" y1="${Y(o.y)}" x2="${X(a.x)}" y2="${Y(a.y)}" stroke="#d9c38f" stroke-width="3" stroke-dasharray="3 3"/><line x1="${X(o.x)}" y1="${Y(o.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="#d9c38f" stroke-width="3" stroke-dasharray="3 3"/>
        <circle cx="${X(o.x)}" cy="${Y(o.y)}" r="${sz * .3}" fill="#f6ecd2" stroke="#6b4f1d"/><text x="${X(o.x)}" y="${Y(o.y - .02)}" font-size="${sz * .17}" text-anchor="middle">${o.type === 'any' ? '?' : ICON[o.type]}</text>
        <text x="${X(o.x)}" y="${Y(o.y + .19)}" font-size="${sz * .15}" font-weight="800" text-anchor="middle" fill="#1b1b1b">${o.type === 'any' ? '3:1' : '2:1'}</text>`;
    });
    b.edges.forEach((e, i) => {
      const a = b.verts[e.a], c = b.verts[e.b], p = b.roads[i];
      if (p != null) s += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="#1b1b1b" stroke-width="9" stroke-linecap="round"/><line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="${colors[p]}" stroke-width="6" stroke-linecap="round"/>`;
      else if (hl.road && hl.road.includes(i)) s += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="#fff" stroke-width="7" stroke-linecap="round" class="pick-edge" data-act="${opt.roadAct || 'build'}" data-kind="road" data-at="${i}" stroke-dasharray="4 4"/>`;
    });
    b.verts.forEach((v, i) => {
      const bl = b.bld[i];
      if (bl) {
        const c = colors[bl.p], x = +X(v.x), y = +Y(v.y);
        s += bl.city ? `<path d="M${x - 10} ${y + 8} V${y - 2} L${x - 4} ${y - 8} L${x + 2} ${y - 2} H${x + 10} V${y + 8} Z" fill="${c}" stroke="#1b1b1b" stroke-width="2"/>`
          : `<path d="M${x - 7} ${y + 6} V${y - 2} L${x} ${y - 9} L${x + 7} ${y - 2} V${y + 6} Z" fill="${c}" stroke="#1b1b1b" stroke-width="2"/>`;
      }
      const kind = hl.settlement && hl.settlement.includes(i) ? 'settlement' : hl.city && hl.city.includes(i) ? 'city' : null;
      if (kind) s += `<circle cx="${X(v.x)}" cy="${Y(v.y)}" r="${kind === 'city' ? 13 : 9}" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width="2.5" class="pick-vert" data-act="${opt.settleAct || 'build'}" data-kind="${kind}" data-at="${i}"/>`;
    });
    return `<svg class="cat-board" viewBox="${-5.3 * sz} ${-4.6 * sz} ${10.6 * sz} ${9.2 * sz}" role="img" aria-label="Catan board"><rect x="${-5.3 * sz}" y="${-4.6 * sz}" width="${10.6 * sz}" height="${9.2 * sz}" fill="#1e5f8a" rx="18"/>${s}</svg>`;
  }
  function boardData(st) {
    const b = st.board;
    return { hexes: b.hexes.map(h => ({ x: h.x, y: h.y, res: h.res, num: h.num, v: h.v })), verts: b.verts.map(v => ({ x: v.x, y: v.y })),
      edges: b.edges.map(e => ({ a: e.a, b: e.b })), ports: b.ports, robber: b.robber, bld: st.bld, roads: st.roads };
  }
  const resRow = (obj, cls = '') => `<div class="cat-res ${cls}">${RES.map(r => `<span class="rc r-${r}"><i>${ICON[r]}</i><b>${obj[r] || 0}</b></span>`).join('')}</div>`;

  return {
    id: 'catan', name: 'Catan', min: 2, max: 4, wide: true, macRole: 'board and scoreboard', pointsLabel: 'VP',
    blurb: 'Build settlements, cities and roads; trade; race to 10 victory points. The board is on the Mac; your cards stay secret on your phone. 2–4 players (3–4 is classic).',
    options: [{ key: 'target', label: 'Victory points to win', def: 10, choices: [[8, '8 (shorter game)'], [10, '10 (standard)'], [12, '12 (longer game)']] }],
    rules: [
      '<b>Setup:</b> in turn order each player places a settlement and a road; then in reverse order a second settlement and road. The second settlement gives you one of each resource around it.',
      '<b>Your turn:</b> roll the dice. Every hex with that number produces: each settlement on it gets 1 card, each city 2 (not while the robber sits on it). Then trade and build, and tap End turn.',
      '<b>Building costs:</b> road 🌲🧱 · settlement 🌲🧱🐑🌾 · city 🌾🌾⛰️⛰️⛰️ (upgrades a settlement) · development card 🐑🌾⛰️.',
      '<b>Placing:</b> settlements must be at least two corners from any other settlement and (after setup) touch your road. Roads connect to your roads or buildings. Limits: 15 roads, 5 settlements, 4 cities.',
      '<b>Rolling 7:</b> anyone with more than 7 cards discards half (rounded down). Then the roller moves the robber and steals a random card from a player next to it.',
      '<b>Development cards:</b> ⚔️ Knight (move the robber), ⭐ Victory Point, 🛣️ Road Building, 🎁 Year of Plenty, 💰 Monopoly. One per turn, not on the turn you bought it.',
      '<b>Trading:</b> with the bank at 4:1, or 3:1 / 2:1 if you have a settlement on a harbor; or offer a trade to everyone. The first player to accept makes the trade.',
      '<b>Awards:</b> 🛣️ Longest Road (5+ connected roads) and ⚔️ Largest Army (3+ knights played) are worth 2 VP each and move to anyone who beats the holder.',
      '<b>Winning:</b> settlement 1 VP, city 2 VP. Reach the target (10 by default) on your turn to win; secret ⭐ cards count.',
    ],
    async start(ctx) {
      const n = ctx.players.length, empty = () => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
      const devDeck = ctx.shuffle([...Array(14).fill('knight'), ...Array(5).fill('vp'), 'roads', 'roads', 'plenty', 'plenty', 'monopoly', 'monopoly']);
      ctx.state = {
        board: newBoard(ctx.rand, ctx.shuffle), bld: {}, roads: {}, res: ctx.players.map(empty), dev: ctx.players.map(() => []),
        bank: { wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 }, devDeck, knights: ctx.players.map(() => 0), roadLen: ctx.players.map(() => 0),
        longestRoad: null, largestArmy: null, turn: 0, first: ctx.rand(n), setupIdx: 0, step: 'setup-settle', dice: null, turnNo: 0,
        devPlayed: false, offer: null, discards: {}, victims: [], afterRobber: 'main', freeRoads: 0, private: ctx.players.map(() => []), target: ctx.opts.target || 10, lastSettle: null,
      };
      ctx.log('A new island is ready.');
      placeSetup(ctx);
      ctx.update();
      await ctx.say('Welcome to Catan! The board is set. Place your settlements and roads from your phone.', 'welcome');
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
        pay(P, st.bank, give);
        ctx.log(`🗑️ ${me} discarded ${st.discards[i]} cards.`);
        delete st.discards[i];
        if (!Object.keys(st.discards).length) { st.step = 'robber'; st.afterRobber = 'main'; ctx.say(`${ctx.players[st.turn].name}, move the robber.`); }
        return;
      }
      if (m.act === 'accept') {
        const o = st.offer;
        if (!o || o.from === i) return;
        if (!has(P, o.want)) return 'You don\'t have the cards they want.';
        if (!has(st.res[o.from], o.give)) { st.offer = null; return 'They no longer have those cards.'; }
        pay(st.res[o.from], P, o.give); pay(P, st.res[o.from], o.want);
        ctx.log(`🤝 ${ctx.players[o.from].name} traded ${fmtRes(o.give)} to ${me} for ${fmtRes(o.want)}.`);
        ctx.say(`${me} accepts the trade.`, 'pay');
        st.offer = null;
        return;
      }
      if (m.act === 'decline') { if (st.offer) st.offer.declined = [...new Set([...(st.offer.declined || []), i])]; return; }
      if (!mine) return "It's not your turn.";
      const L = legal(st, i);
      switch (m.act) {
        case 'build': {
          const at = +m.at, kind = m.kind;
          if (st.step === 'setup-settle' && kind === 'settlement') {
            if (!L.settlement.includes(at)) return 'You can\'t build there.';
            st.bld[at] = { p: i, city: false }; st.lastSettle = at; st.step = 'setup-road';
            if (st.setupIdx >= ctx.players.length) {        // second settlement: one of each resource around it
              const got = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
              st.board.verts[at].hexes.forEach(h => { const r = st.board.hexes[h].res; if (r !== 'desert') { got[r]++; st.bank[r]--; P[r]++; } });
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
          pay(P, st.bank, COST[kind]);
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
          st.dice = d;
          ctx.say(`${me} rolls ${t}.`);
          if (t === 7) { ctx.log(`🎲 ${me} rolled 7.`); st.afterRobber = 'main'; afterSeven(ctx); }
          else { produce(ctx, t); st.step = 'main'; }
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
          pay(P, st.bank, COST.dev);
          const type = st.devDeck.pop();
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
            pay(st.bank, P, c);
            ctx.log(`🎁 ${me} played Year of Plenty: ${fmtRes(c)}.`);
          } else if (type === 'monopoly') {
            const r = m.res; if (!RES.includes(r)) return 'Pick a resource.';
            let got = 0;
            st.res.forEach((o, q) => { if (q !== i) { got += o[r]; P[r] += o[r]; o[r] = 0; } });
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
          const give = m.give, get = m.get;
          if (!RES.includes(give) || !RES.includes(get) || give === get) return 'Pick what to give and what to get.';
          const n = ratio(st, i, give);
          if (P[give] < n) return `You need ${n} ${RNAME[give]}.`;
          if (!st.bank[get]) return `The bank has no ${RNAME[get]}.`;
          P[give] -= n; st.bank[give] += n; P[get]++; st.bank[get]--;
          ctx.log(`🏦 ${me} traded ${n} ${ICON[give]} with the bank for 1 ${ICON[get]}.`);
          return;
        }
        case 'offer': {
          if (st.step !== 'main') return 'Roll the dice first.';
          const give = parseCounts(m.give), want = parseCounts(m.want);
          if (!total(give) || !total(want)) return 'Pick what you give and what you want.';
          if (!has(P, give)) return 'You don\'t have those cards.';
          st.offer = { from: i, give, want, declined: [] };
          ctx.log(`📣 ${me} offers ${fmtRes(give)} for ${fmtRes(want)}.`);
          ctx.say(`${me} offers a trade.`);
          return;
        }
        case 'cancel': st.offer = null; return;
        case 'end': {
          if (st.step !== 'main') return st.step === 'roll' ? 'Roll the dice first.' : 'Finish what you\'re doing first.';
          endTurn(ctx);
          return;
        }
      }
    },
    status(ctx) {
      const st = ctx.state, who = ctx.players[st.turn].name;
      return st.step.startsWith('setup') ? `Setup · ${who} is placing` : `${who}'s turn${st.dice ? ` · rolled ${st.dice[0] + st.dice[1]}` : ''}`;
    },
    view(ctx, i) {
      const st = ctx.state, mine = st.turn === i;
      const devs = st.dev[i].map(d => ({ type: d.type, fresh: !!d.fresh }));
      return {
        title: mine ? 'Your turn!' : `${ctx.players[st.turn].name}'s turn`,
        mine, step: st.step, board: boardData(st), colors: ctx.players.map(p => p.color), legal: mine ? legal(st, i) : {},
        res: st.res[i], dev: devs, devPlayed: st.devPlayed, deck: st.devDeck.length, bank: st.bank,
        ratios: Object.fromEntries(RES.map(r => [r, ratio(st, i, r)])), dice: st.dice, discard: st.discards[i] || 0, waitingDiscard: Object.keys(st.discards).length,
        victims: st.step === 'steal' && mine ? st.victims.map(q => ({ i: q, name: ctx.players[q].name })) : [],
        offer: st.offer ? { from: st.offer.from, name: ctx.players[st.offer.from].name, give: st.offer.give, want: st.offer.want, canAccept: st.offer.from !== i && has(st.res[i], st.offer.want), declined: (st.offer.declined || []).includes(i) } : null,
        freeRoads: st.freeRoads, me: i, vp: totalVP(st, i), target: st.target, notes: st.private[i].slice(-3).reverse(),
        players: ctx.players.map((p, q) => ({ name: p.name, color: p.color, vp: publicVP(st, q), cards: total(st.res[q]), devs: st.dev[q].length, knights: st.knights[q], road: st.roadLen[q], lr: st.longestRoad === q, la: st.largestArmy === q })),
        turnName: ctx.players[st.turn].name,
      };
    },
    hostHTML(ctx, H) {
      const st = ctx.state, colors = ctx.players.map(p => p.color);
      const dice = st.dice ? `<div class="cat-dice">${st.dice.map(d => `<span>${'⚀⚁⚂⚃⚄⚅'[d - 1]}</span>`).join('')}<b>${st.dice[0] + st.dice[1]}</b></div>` : '';
      const step = { 'setup-settle': 'is placing a settlement', 'setup-road': 'is placing a road', roll: 'is about to roll', main: 'is building and trading', discard: '— waiting for discards', robber: 'is moving the robber', steal: 'is choosing who to steal from', roads: 'is building free roads' }[st.step];
      return `<div class="cat-wrap"><div class="cat-main">${boardSVG(boardData(st), colors)}</div>
        <div class="cat-side">
          <div class="cat-turn" style="--pc:${colors[st.turn]}"><b>${H.esc(ctx.players[st.turn].name)}</b> ${step}${dice}</div>
          ${st.offer ? `<div class="cat-offer">📣 ${H.esc(ctx.players[st.offer.from].name)} offers ${fmtRes(st.offer.give)} for ${fmtRes(st.offer.want)}</div>` : ''}
          <div class="sec-title">Score (first to ${st.target})</div>
          <table class="cat-score"><tbody>${ctx.players.map((p, q) => `<tr style="--pc:${p.color}" class="${q === st.turn ? 'now' : ''}"><td><i></i>${H.esc(p.name)}</td><td class="vp">${publicVP(st, q)}</td>
            <td>🂠 ${total(st.res[q])}</td><td>🃏 ${st.dev[q].length}</td><td>⚔️ ${st.knights[q]}</td><td>🛣️ ${st.roadLen[q]}</td></tr>`).join('')}</tbody></table>
          <div class="cat-awards"><div class="${st.longestRoad != null ? 'on' : ''}">🛣️ Longest Road<b>${st.longestRoad != null ? H.esc(ctx.players[st.longestRoad].name) + ` (${st.roadLen[st.longestRoad]})` : 'not awarded'}</b></div>
            <div class="${st.largestArmy != null ? 'on' : ''}">⚔️ Largest Army<b>${st.largestArmy != null ? H.esc(ctx.players[st.largestArmy].name) + ` (${st.knights[st.largestArmy]})` : 'not awarded'}</b></div></div>
          <div class="sec-title">Bank</div>${resRow(st.bank)}
          <div class="sec-title">Development cards</div><div class="cat-deck"><span class="stack"><span class="cat-devback">🃏</span><span class="n">${st.devDeck.length}</span></span> left in the deck</div>
          <div class="note">VP shown are public; secret ⭐ cards count too.</div>
        </div></div>`;
    },
    phoneNotify: (b, v) => v && v.mine && (!b || !b.mine || (b.step !== v.step && ['roll', 'robber', 'steal', 'setup-settle'].includes(v.step))) || (v && v.discard && !(b && b.discard)),
    phoneLocal(d, v, local) {
      if (d.local === 'mode') local.mode = local.mode === d.mode ? null : d.mode;
      if (d.local === 'pick') { local[d.list] = local[d.list] || []; local[d.list].push(d.r); }
      if (d.local === 'unpick') { const L = local[d.list] || []; const k = L.lastIndexOf(d.r); if (k >= 0) L.splice(k, 1); }
      if (d.local === 'clear') local[d.list] = [];
      if (d.local === 'bankGive') local.bankGive = d.r;
      if (d.local === 'bankGet') local.bankGet = d.r;
      if (d.local === 'tab') local.tab = d.tab;
    },
    phoneAct(m, v, local) { if (m.act === 'build' && m.kind !== 'road') local.mode = null; if (['discard', 'offer', 'dev'].includes(m.act)) { local.disc = []; local.give = []; local.want = []; local.yp = []; } },
    phoneHTML(v, local, H) {
      const L = v.legal || {}, st = v.step;
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
      const picker = (list, label, limit) => {
        const sel = local[list] || [];
        return `<div class="sec-title">${label}${sel.length ? ` · ${sel.length} picked <button class="mini" type="button" data-local="clear" data-list="${list}">clear</button>` : ''}</div>
          <div class="cat-picks">${RES.map(r => { const n = sel.filter(x => x === r).length; return `<span class="pk"><button type="button" data-local="pick" data-list="${list}" data-r="${r}" ${limit != null && sel.length >= limit ? 'disabled' : ''}>${ICON[r]}${n ? `<b>${n}</b>` : ''}</button>${n ? `<button type="button" class="minus" data-local="unpick" data-list="${list}" data-r="${r}">−</button>` : ''}</span>`; }).join('')}</div>`;
      };
      let actions = '';
      if (v.discard) {
        const sel = local.disc || [];
        actions = `<div class="cat-alert">Seven! Discard ${v.discard} cards.</div>${picker('disc', 'Cards to discard', v.discard)}
          <button class="go red" type="button" data-act="discard" data-res="${sel.join(',')}" ${sel.length === v.discard ? '' : 'disabled'}>Discard ${sel.length} of ${v.discard}</button>`;
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
          actions = `<div class="cat-tabs">${[['build', '🔨 Build'], ['cards', '🃏 Cards'], ['trade', '🤝 Trade']].map(([t, l]) => `<button type="button" data-local="tab" data-tab="${t}" class="${tab === t ? 'on' : ''}">${l}</button>`).join('')}</div>`;
          if (tab === 'build') actions += `<div class="choice cat-build">${modeBtn('road', '🛣️ Road', COST.road)}${modeBtn('settlement', '🏠 Settlement', COST.settlement)}${modeBtn('city', '🏙️ City', COST.city)}</div>
              ${local.mode ? `<div class="note">Tap a glowing ${local.mode === 'road' ? 'edge' : 'spot'} on the board above.</div>` : ''}
              <button class="go" type="button" data-act="buydev" ${can('dev') && v.deck ? '' : 'disabled'} style="background:#334155;color:#fff">🃏 Buy development card · ${fmtRes(COST.dev)}</button>`;
          if (tab === 'cards') {
            const playable = t => !v.devPlayed && v.dev.some(d => d.type === t && !d.fresh);
            const yp = local.yp || [];
            actions += `<div class="cat-devs">${v.dev.length ? v.dev.map(d => `<span class="dv${d.fresh ? ' fresh' : ''}">${DEV[d.type][1]} ${DEV[d.type][0]}${d.fresh ? ' <small>(new)</small>' : ''}</span>`).join('') : '<span class="note">No development cards.</span>'}</div>
              ${playable('knight') ? '<button class="go" type="button" data-act="dev" data-card="knight">⚔️ Play Knight</button>' : ''}
              ${playable('roads') ? '<button class="go" type="button" data-act="dev" data-card="roads">🛣️ Play Road Building</button>' : ''}
              ${playable('plenty') ? `${picker('yp', 'Year of Plenty: pick 2', 2)}<button class="go" type="button" data-act="dev" data-card="plenty" data-res="${yp.join(',')}" ${yp.length === 2 ? '' : 'disabled'}>🎁 Take ${yp.map(r => ICON[r]).join(' ')}</button>` : ''}
              ${playable('monopoly') ? `<div class="sec-title">Monopoly: name a resource</div><div class="choice">${RES.map(r => `<button type="button" data-act="dev" data-card="monopoly" data-res="${r}">${ICON[r]} ${RNAME[r]}</button>`).join('')}</div>` : ''}
              ${v.devPlayed ? '<p class="note">You already played a development card this turn.</p>' : ''}`;
          }
          if (tab === 'trade') {
            const give = local.give || [], want = local.want || [], bg = local.bankGive, bt = local.bankGet;
            actions += `<div class="sec-title">Trade with the bank</div>
              <div class="choice">${RES.map(r => `<button type="button" data-local="bankGive" data-r="${r}" class="${bg === r ? 'on' : ''}" ${v.res[r] >= v.ratios[r] ? '' : 'disabled'}>${v.ratios[r]} ${ICON[r]}</button>`).join('')}</div>
              <div class="note">for 1 of:</div><div class="choice">${RES.map(r => `<button type="button" data-local="bankGet" data-r="${r}" class="${bt === r ? 'on' : ''}" ${v.bank[r] && r !== bg ? '' : 'disabled'}>${ICON[r]}</button>`).join('')}</div>
              <button class="go" type="button" data-act="bank" data-give="${bg || ''}" data-get="${bt || ''}" ${bg && bt && bg !== bt && v.res[bg] >= v.ratios[bg] ? '' : 'disabled'}>Trade ${bg ? v.ratios[bg] + ' ' + ICON[bg] : '…'} for 1 ${bt ? ICON[bt] : '…'}</button>
              <div class="sec-title" style="margin-top:16px">Offer a trade to everyone</div>
              ${picker('give', 'You give')}${picker('want', 'You want')}
              <button class="go" type="button" data-act="offer" data-give="${give.join(',')}" data-want="${want.join(',')}" ${give.length && want.length ? '' : 'disabled'}>📣 Offer ${give.map(r => ICON[r]).join('')} for ${want.map(r => ICON[r]).join('')}</button>
              ${v.offer && v.offer.from === v.me ? `<div class="cat-offer">Your offer is out: ${fmtRes(v.offer.give)} for ${fmtRes(v.offer.want)} <button class="mini" type="button" data-act="cancel">withdraw</button></div>` : ''}`;
          }
          actions += `<button class="go red" type="button" data-act="end" style="margin-top:14px">End turn</button>`;
        }
      } else if (v.offer && v.offer.from !== v.me && !v.offer.declined) {
        actions = `<div class="cat-offer">📣 <b>${H.esc(v.offer.name)}</b> offers ${fmtRes(v.offer.give)} for your ${fmtRes(v.offer.want)}</div>
          <div class="choice"><button type="button" data-act="accept" ${v.offer.canAccept ? '' : 'disabled'}>✅ Accept</button><button type="button" data-act="decline">✖ No thanks</button></div>`;
      } else actions = `<div class="note" style="text-align:center">${H.esc(v.turnName)} is playing…</div>`;
      return `${board}
        <div class="cat-me"><span>⭐ ${v.vp} / ${v.target} VP</span>${v.dice ? `<span>🎲 ${v.dice[0] + v.dice[1]}</span>` : ''}</div>
        ${resRow(v.res, 'mine')}
        ${v.notes.length ? `<div class="note">${v.notes.map(H.esc).join('<br>')}</div>` : ''}
        ${actions}
        <div class="sec-title">Players</div><div class="pills">${v.players.map(p => `<span class="p" style="box-shadow:inset 3px 0 0 ${p.color}">${H.esc(p.name)} ${p.vp}⭐ · ${p.cards}🂠${p.lr ? ' 🛣️' : ''}${p.la ? ' ⚔️' : ''}</span>`).join('')}</div>`;
    },
    css: `
      .cat-wrap { display: grid; grid-template-columns: 1fr 330px; gap: 18px; align-items: start; }
      @media (max-width: 1100px) { .cat-wrap { grid-template-columns: 1fr; } }
      .cat-board { width: 100%; height: auto; display: block; }
      .cat-main .cat-board { max-height: 80vh; }
      .cat-wrap { grid-template-columns: 1fr 340px; }
      .pick-vert, .pick-edge, .pick-hex { cursor: pointer; }
      .pick-vert { animation: catPulse 1s ease-in-out infinite alternate; }
      @keyframes catPulse { from { opacity: .55; } to { opacity: 1; } }
      .cat-turn { padding: 10px 12px; border-radius: 10px; background: rgba(0,0,0,.3); border-left: 5px solid var(--pc); display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .cat-dice { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 1.7rem; } .cat-dice b { font-size: 1.3rem; margin-left: 6px; }
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
      .mini { padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,.4); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-size: .75rem; margin-left: 6px; }`,
  };
})();
