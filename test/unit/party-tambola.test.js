// Tambola / Housie rules (public/games/party/tambola.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain, partyCtx, flush, seededRand } = require('./helpers');

const load = () => loadScripts(['games/party/common.js', 'games/party/tambola.js']).PARTY_GAME;
const H = { esc: t => String(t), me: 0, seats: [{ name: 'Ana' }, { name: 'Bob' }, { name: 'Cy' }] };
const DEF = ['early5', 'top', 'middle', 'bottom', 'corners', 'full'];
// A known ticket: top 1 23 45 61 88, middle 17 36 52 67 74, bottom 9 27 38 59 90
const T1 = [[1, 0, 23, 0, 45, 0, 61, 0, 88], [0, 17, 0, 36, 0, 52, 67, 74, 0], [9, 0, 27, 38, 0, 59, 0, 0, 90]];
const T2 = [[2, 12, 0, 31, 0, 50, 0, 70, 0], [0, 14, 24, 0, 41, 0, 62, 0, 81], [5, 0, 0, 33, 46, 0, 64, 77, 0]];
const T3 = [[3, 0, 20, 0, 42, 0, 60, 71, 0], [0, 10, 21, 32, 0, 53, 0, 0, 82], [6, 0, 0, 34, 0, 54, 65, 0, 85]];
// A game in a given moment, without running the caller: players' tickets and the numbers called so far
function game(opts = {}, tickets = [[T1], [T2], [T3]]) {
  const G = load(), ctx = partyCtx(tickets.length, { opts: { prizes: DEF, ...opts } });
  ctx.state = { tickets, prizes: Object.fromEntries((opts.prizes || DEF).map(k => [k, { wins: [], at: null }])), bag: [], called: [], current: null,
    marks: tickets.map(() => []), barred: tickets.map(() => []), claims: [], pending: [], paused: false, lastCall: false,
    gap: 6, auto: opts.claims === 'auto', automark: opts.marking === 'auto', late: opts.late || 'allow', bogus: opts.bogus || 'warn', style: 'nick' };
  const call = (...ns) => ns.forEach(n => { ctx.state.called.push(n); ctx.state.current = n; });
  return { G, ctx, st: ctx.state, call };
}
const winners = (ctx, k) => plain(ctx.state.prizes[k].wins.map(w => ctx.players[w.i].name));

/* ---------------- Tickets ---------------- */
function validTicket(t) {
  assert.equal(t.length, 3);
  t.forEach(row => { assert.equal(row.length, 9); assert.equal(row.filter(Boolean).length, 5, 'five numbers in every row'); });
  const { COLS } = load()._test;
  for (let j = 0; j < 9; j++) {
    const col = [t[0][j], t[1][j], t[2][j]].filter(Boolean);
    assert.ok(col.length >= 1 && col.length <= 3, 'one to three numbers in every column');
    col.forEach(n => assert.ok(n >= COLS[j][0] && n <= COLS[j][1], `${n} belongs in column ${j + 1}`));
    for (let k = 1; k < col.length; k++) assert.ok(col[k] > col[k - 1], 'increasing down each column');
  }
  const all = t.flat().filter(Boolean);
  assert.equal(new Set(all).size, 15, '15 different numbers');
}

test('tickets: 3 lines of 5, 1–3 numbers per column in the right range, increasing downwards (5,000 random tickets)', () => {
  const { makeTicket } = load()._test, rand = seededRand(11);
  for (let k = 0; k < 5000; k++) validTicket(plain(makeTicket(rand)));
});

test('tickets: a player\'s tickets (up to 3) never share a number; every number can turn up', () => {
  const { makeTicket, numbersOf } = load()._test, rand = seededRand(5), seen = new Set();
  for (let k = 0; k < 600; k++) {
    const used = new Set(), all = [];
    for (let t = 0; t < 3; t++) { const tk = plain(makeTicket(rand, used)); validTicket(tk); numbersOf(tk).forEach(n => { used.add(n); all.push(n); seen.add(n); }); }
    assert.equal(new Set(all).size, 45);
  }
  assert.equal(seen.size, 90);
});

/* ---------------- Calls ---------------- */
test('calls: the traditional call and the number for 1–90 ("Kelly\'s eye, number one"); digits for the others; plain style', () => {
  const { callText, NICK } = load()._test;
  assert.equal(callText(1), "Kelly's eye, number one.");
  assert.equal(callText(22), 'Two little ducks, twenty-two.');
  assert.equal(callText(90), 'Top of the house, ninety.');
  assert.equal(callText(47), 'Four and seven, forty-seven.');
  assert.equal(callText(30), 'Thirty.');
  assert.equal(callText(47, 'plain'), 'Number forty-seven.');
  assert.equal(callText(1, 'plain'), 'Number one.');
  for (let n = 1; n <= 90; n++) assert.match(callText(n), /^[A-Z].*\.$/, `${n} gets a call`);
  assert.ok(Object.keys(NICK).length > 60);
  assert.ok(Object.keys(NICK).every(n => n >= 1 && n <= 90));
  assert.ok(!Object.values(NICK).some(t => /fat|dirty|gandhi/i.test(t)), 'only family-friendly calls');
});

/* ---------------- Prizes ---------------- */
test('prizes: what counts for each pattern', () => {
  const { PRIZES } = load()._test, has = ns => n => ns.includes(n);
  assert.ok(PRIZES.early5.test(T1, has([1, 17, 9, 90, 45])));
  assert.ok(!PRIZES.early5.test(T1, has([1, 17, 9, 90, 2])));
  assert.ok(PRIZES.top.test(T1, has([1, 23, 45, 61, 88])));
  assert.ok(!PRIZES.top.test(T1, has([1, 23, 45, 61])));
  assert.ok(PRIZES.middle.test(T1, has([17, 36, 52, 67, 74])));
  assert.ok(PRIZES.bottom.test(T1, has([9, 27, 38, 59, 90])));
  assert.ok(PRIZES.corners.test(T1, has([1, 88, 9, 90])), 'first and last of the top and bottom lines');
  assert.ok(!PRIZES.corners.test(T1, has([1, 88, 9, 59])));
  assert.ok(PRIZES.full.test(T1, has(T1.flat())));
  assert.ok(!PRIZES.full.test(T1, has(T1.flat().filter(n => n !== 74))));
});

/* ---------------- Claims ---------------- */
test('claims: a good claim wins (checked against the numbers called, not the marks)', () => {
  const { G, ctx, st, call } = game();
  call(1, 23, 45, 61, 88);
  assert.equal(G.act(ctx, 0, { act: 'claim', prize: 'top' }), undefined);
  assert.deepEqual(winners(ctx, 'top'), ['Ana']);
  assert.match(st.pending[0].text, /Ana claims the Top Line… and it's good/);
  assert.match(G.act(ctx, 0, { act: 'claim', prize: 'top' }), /already won/);
  assert.equal(G.act(ctx, 0, { act: 'claim', prize: 'early5' }), undefined, 'the same five numbers also make Early Five');
});

test('claims: bogus claims are announced; "warn" lets you try again, "bar" puts you out of that prize', () => {
  let { G, ctx, st, call } = game();
  call(1, 23, 45);
  assert.match(G.act(ctx, 0, { act: 'claim', prize: 'top' }), /Not yet/);
  assert.match(st.pending[0].text, /bogus claim/);
  call(61, 88);
  assert.equal(G.act(ctx, 0, { act: 'claim', prize: 'top' }), undefined, 'a warning only: can claim again');
  ({ G, ctx, st, call } = game({ bogus: 'bar' }));
  call(1, 23, 45);
  assert.match(G.act(ctx, 0, { act: 'claim', prize: 'top' }), /out of this prize/);
  call(61, 88);
  assert.match(G.act(ctx, 0, { act: 'claim', prize: 'top' }), /out of the Top Line/);
  assert.deepEqual(winners(ctx, 'top'), []);
  assert.equal(G.act(ctx, 0, { act: 'claim', prize: 'early5' }), undefined, 'still in for the other prizes');
});

test('claims: players who complete a prize on the same number share it; after the next number it is gone', () => {
  const A = [[1, 0, 20, 0, 40, 0, 60, 0, 80], [0, 11, 0, 31, 0, 51, 61, 71, 0], [2, 0, 21, 32, 0, 52, 0, 0, 81]];
  const B = [[3, 0, 22, 0, 42, 0, 62, 0, 82], [0, 12, 0, 33, 0, 53, 63, 72, 0], [4, 0, 23, 34, 0, 54, 0, 0, 83]];
  const C = [[5, 0, 24, 0, 43, 0, 64, 0, 84], [0, 13, 0, 35, 0, 55, 65, 73, 0], [6, 0, 25, 36, 0, 56, 0, 0, 85]];
  const { G, ctx, st, call } = game({}, [[A], [B], [C]]);
  call(1, 20, 40, 60, 3, 22, 42, 62, 80, 82);           // Ana's and Bob's top lines both complete on 82
  assert.equal(G.act(ctx, 1, { act: 'claim', prize: 'top' }), undefined);
  assert.equal(G.act(ctx, 0, { act: 'claim', prize: 'top' }), undefined, 'Ana completed on the same number: shares');
  assert.deepEqual(winners(ctx, 'top'), ['Bob', 'Ana']);
  assert.match(st.pending[1].text, /also has the Top Line/);
  call(5, 24, 43, 64, 84);
  assert.match(G.act(ctx, 2, { act: 'claim', prize: 'top' }), /already been won/);
});

test('claims: strict mode refuses a claim made after the next number was called', () => {
  const { G, ctx, call } = game({ late: 'strict' });
  call(1, 23, 45, 61, 88, 5);                          // the top line was complete before 5 was called
  assert.match(G.act(ctx, 0, { act: 'claim', prize: 'top' }), /Too late/);
  assert.deepEqual(winners(ctx, 'top'), []);
  const g2 = game({ late: 'strict' });
  g2.call(1, 23, 45, 61, 88);
  assert.equal(g2.G.act(g2.ctx, 0, { act: 'claim', prize: 'top' }), undefined, 'on time');
});

test('claims: with several tickets, any of them counts; the Second Full House needs another ticket or player, on a later number', () => {
  const { G, ctx, call } = game({ prizes: ['full', 'full2'] }, [[T1, T2], [T3]]);
  call(...T2.flat().filter(Boolean));
  assert.equal(G.act(ctx, 0, { act: 'claim', prize: 'full' }), undefined, 'ticket 2 is full');
  assert.match(G.act(ctx, 0, { act: 'claim', prize: 'full2' }), /won on this number/);
  call(...T1.flat().filter(Boolean));
  assert.match(G.act(ctx, 0, { act: 'claim', prize: 'full' }), /already won/);
  assert.equal(G.act(ctx, 0, { act: 'claim', prize: 'full2' }), undefined, 'Ana\'s other ticket is full later');
  const g = game({ prizes: ['full', 'full2'] });
  g.call(...T1.flat().filter(Boolean));
  assert.match(g.G.act(g.ctx, 1, { act: 'claim', prize: 'full2' }), /Full House has to be won first/);
});

test('claims and marks: refused when they make no sense', () => {
  const { G, ctx, st, call } = game();
  assert.match(G.act(ctx, 0, { act: 'claim', prize: 'top' }), /No numbers/);
  call(1);
  assert.match(G.act(ctx, 0, { act: 'claim', prize: 'full2' }), /isn't in this game/);
  assert.match(G.act(ctx, 0, { act: 'mark', n: 2 }), /isn't on your ticket/);
  G.act(ctx, 0, { act: 'mark', n: 1 }); G.act(ctx, 0, { act: 'mark', n: 90 });
  assert.deepEqual(plain(st.marks[0]), [1, 90], 'you may mark any number on your ticket (claims check the calls)');
  G.act(ctx, 0, { act: 'mark', n: 1 });
  assert.deepEqual(plain(st.marks[0]), [90], 'tap again to unmark');
  const auto = game({ claims: 'auto' });
  auto.call(1);
  assert.match(auto.G.act(auto.ctx, 0, { act: 'claim', prize: 'top' }), /automatically/);
});

/* ---------------- Whole games ---------------- */
async function play(opts, n = 3, seed = 3) {
  const G = load(), ctx = partyCtx(n, { opts: { prizes: DEF, tickets: 1, gap: 3, claims: 'manual', ...opts }, rand: seededRand(seed) });
  G.start(ctx); await flush();
  const st = () => ctx.state;
  const step = async () => { ctx.expire(); for (let k = 0; k < 4; k++) await flush(); };
  return { G, ctx, st, step };
}

test('a whole automatic game: every number at most once, prizes found as they complete, Full House wins', async () => {
  const g = await play({ claims: 'auto' });
  for (let k = 0; k < 200 && !g.ctx.ended; k++) await g.step();
  assert.ok(g.ctx.ended, 'the game ended');
  const called = plain(g.st().called);
  assert.equal(new Set(called).size, called.length, 'no number twice');
  assert.ok(called.every(n => n >= 1 && n <= 90));
  const { PRIZES } = g.G._test;
  for (const k of DEF) {
    const p = g.st().prizes[k];
    assert.ok(p.wins.length, `${k} was won`);
    const has = n => called.slice(0, p.at).includes(n), before = n => called.slice(0, p.at - 1).includes(n);
    for (const w of p.wins) {
      const t = g.st().tickets[w.i][w.t];
      assert.ok(PRIZES[k].test(t, has) && !PRIZES[k].test(t, before), `${k}: won on the exact number it completed`);
    }
  }
  const fh = g.st().prizes.full.wins.map(w => w.i);
  g.ctx.ended.results.forEach((r, i) => assert.equal(r.won, fh.includes(i), 'the Full House wins the game'));
  g.ctx.ended.results.forEach((r, i) => assert.equal(r.points, DEF.filter(k => g.st().prizes[k].wins.some(w => w.i === i)).length, 'points = prizes won'));
  assert.match(g.ctx.ended.html, /Full House/);
  assert.match(g.ctx.said.join(' '), /Kelly's eye|little duck|Top of the house|, [a-z-]+\./);
});

test('a manual game: claims during the game are announced by the caller; the game ends after the last prize', async () => {
  const g = await play({ prizes: ['top', 'full'] }, 2, 9);
  const { PRIZES } = g.G._test;
  const has = () => { const s = new Set(g.st().called); return n => s.has(n); };
  for (let k = 0; k < 200 && !g.ctx.ended; k++) {
    // each player claims as soon as their own ticket shows a prize (as a sharp-eyed player would)
    for (const i of [0, 1]) for (const key of ['top', 'full']) if (!g.st().prizes[key].wins.length && PRIZES[key].test(g.st().tickets[i][0], has())) g.G.act(g.ctx, i, { act: 'claim', prize: key });
    await g.step();
  }
  assert.ok(g.ctx.ended);
  assert.ok(g.st().prizes.top.wins.length && g.st().prizes.full.wins.length);
  assert.match(g.ctx.said.join(' | '), /claims the Top Line… and it's good/);
  assert.match(g.ctx.said.join(' | '), /claims the Full House… and it's good/);
});

test('if nobody claims, all 90 numbers are called and the game still ends ("last claims")', async () => {
  const g = await play({ prizes: ['full'] }, 2, 4);
  for (let k = 0; k < 300 && !g.ctx.ended; k++) await g.step();
  assert.ok(g.ctx.ended);
  assert.equal(g.st().called.length, 90);
  assert.ok(g.st().lastCall);
  assert.ok(g.ctx.ended.results.every(r => !r.won));
});

test('the caller can pause (no new numbers until resumed) and call the next number early', async () => {
  const g = await play({});
  await g.step();                                       // first number
  const n = g.st().called.length;
  g.G.hostAct(g.ctx, { host: 'pause' });
  assert.equal(g.st().paused, true);
  await g.step(); await g.step();
  assert.equal(g.st().called.length, n, 'after the current number\'s wait, no new number while paused');
  g.G.hostAct(g.ctx, { host: 'pause' }); for (let k = 0; k < 4; k++) await flush();
  assert.equal(g.st().paused, false);
  assert.equal(g.st().called.length, n + 1, 'resumed: the next number is called');
  const before = g.st().called.length;
  g.G.hostAct(g.ctx, { host: 'next' }); for (let k = 0; k < 4; k++) await flush();
  assert.equal(g.st().called.length, before + 1, '"Next number now" skips the wait');
});

test('options: tickets per player, prizes picked, can\'t start without a prize or with Second Full House alone', async () => {
  const g = await play({ tickets: 3, prizes: ['early5', 'full'] });
  g.st().tickets.forEach(list => assert.equal(list.length, 3));
  assert.deepEqual(Object.keys(g.st().prizes), ['early5', 'full']);
  const G = load();
  assert.match(G.canStart(3, { prizes: [] }), /at least one prize/);
  assert.match(G.canStart(3, { prizes: ['full2'] }), /needs the Full House/);
  assert.equal(G.canStart(3, { prizes: DEF }), null);
  assert.deepEqual(plain(G.options.find(o => o.key === 'prizes').def), DEF);
});

test('phones: each phone sees only its own tickets; marks, claim buttons, auto-marking, the buzz', () => {
  const { G, ctx, st, call } = game();
  call(1, 23);
  G.act(ctx, 0, { act: 'mark', n: 1 });
  const v = G.view(ctx, 0);
  assert.deepEqual(plain(v.tickets), [T1]);
  assert.ok(!JSON.stringify(v).includes(JSON.stringify(T2[0])), 'no other player\'s ticket');
  assert.deepEqual(plain(v.marks), [1]);
  let html = G.phoneHTML(v, {}, H);
  assert.match(html, /data-act="mark" data-n="1" class="mk"/);
  assert.match(html, /data-act="mark" data-n="23" class=""/, 'called but not marked: up to the player');
  assert.equal((html.match(/data-act="claim"/g) || []).length, DEF.length);
  assert.match(html, /Two little ducks|Cup of tea|23|Kelly/);
  assert.ok(G.phoneNotify({ current: 1 }, G.view(ctx, 0)), 'buzz: 23 is on Ana\'s ticket');
  assert.ok(!G.phoneNotify({ current: 1 }, G.view(ctx, 1)), 'not on Bob\'s');
  // a won prize: no claim button for others (unless they share on the same number)
  call(45, 61, 88); G.act(ctx, 0, { act: 'claim', prize: 'top' });
  assert.match(G.phoneHTML(G.view(ctx, 1), {}, H), /Top Line <small>Ana<\/small><\/span>\s*<button type="button" data-act="claim" data-prize="top">/, 'same number: may still share');
  call(5);
  assert.doesNotMatch(G.phoneHTML(G.view(ctx, 1), {}, H), /data-prize="top"/);
  // auto-marking and automatic claims
  const a = game({ marking: 'auto', claims: 'auto' });
  a.call(1, 23, 2);
  const av = a.G.view(a.ctx, 0);
  assert.deepEqual(plain(av.marks).sort(), [1, 23]);
  const ah = a.G.phoneHTML(av, {}, H);
  assert.doesNotMatch(ah, /data-act="mark"|data-act="claim"/);
  assert.match(ah, /marked for you/);
});

test('the Mac: called numbers on the board, the latest highlighted, prizes and winners, pause and next buttons', () => {
  const { G, ctx, call } = game();
  call(1, 23, 45, 61, 88);
  G.act(ctx, 0, { act: 'claim', prize: 'top' });
  const html = G.hostHTML(ctx, { esc: t => t, color: () => '#888' });
  assert.match(html, /<span class="on">1<\/span>/);
  assert.match(html, /<span class="now">88<\/span>/);
  assert.match(html, /<span class="">2<\/span>/);
  assert.match(html, /Top Line<\/span>\s*<b><i style="--pc:#888"><\/i>Ana <span class="note">on 88/);
  assert.match(html, /data-host="pause"/); assert.match(html, /data-host="next"/);
  assert.match(G.status(ctx), /Number 5 of 90 · 5 prizes left/);
});

test('after a good claim the caller waits ("Any more claims?") so others on the same number can share, then goes on', async () => {
  const g = await play({ prizes: ['early5', 'full'] }, 3, 21);
  const { PRIZES } = g.G._test;
  const has = () => { const s = new Set(g.st().called); return n => s.has(n); };
  // call numbers until someone has Early Five
  let who = -1;
  for (let k = 0; k < 60 && who < 0; k++) { await g.step(); who = [0, 1, 2].find(i => PRIZES.early5.test(g.st().tickets[i][0], has())) ?? -1; }
  assert.ok(who >= 0);
  const n = g.st().called.length;
  g.G.act(g.ctx, who, { act: 'claim', prize: 'early5' });
  for (let k = 0; k < 4; k++) await flush();
  assert.match(g.ctx.said.at(-1), /claims the Early Five/);
  assert.equal(g.st().called.length, n, 'no new number during "Any more claims?"');
  // a second player claims during the pause: wrong or a share, it is heard before the next number
  const other = [0, 1, 2].find(i => i !== who);
  g.G.act(g.ctx, other, { act: 'claim', prize: 'early5' });
  assert.equal(g.st().called.length, n);
  await g.step();                                        // the pause ends
  assert.ok(g.st().called.length >= n, 'the game goes on');
  assert.ok(g.ctx.said.some(t => /also has the Early Five|bogus claim/.test(t)), 'the second claim was announced');
});
