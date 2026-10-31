// Rules and payouts of the casino table modules (public/games/casino/*.js)
const test = require('node:test');
const { describe } = test;
const assert = require('node:assert/strict');
const { loadScripts, plain, seededRand, card } = require('./helpers');

const load = name => loadScripts([`games/casino/${name}.js`]).GAME;
// The context table.html gives a module while it plays a round (no screen, no waiting)
function roundCtx(rand = seededRand(7)) {
  const ctx = { rand, stages: [], said: [], sfx() {}, async wait() {}, async say(t) { ctx.said.push(t); },
    setStage(st) { ctx.stages.push(plain(st)); ctx.current = st; }, get stage() { return ctx.current || {}; } };
  return ctx;
}
// rand that returns these values in order (then 0)
const script = (...values) => { let i = 0; return () => (i < values.length ? values[i++] : 0); };

/* ---------------- Boards and payout tables ---------------- */
describe('Boards and payout tables', () => {
  test('every module has a well-formed betting board and payout table', () => {
    for (const name of ['baccarat', 'dragontiger', 'sicbo', 'craps']) {
      const G = load(name);
      assert.equal(G.id, name);
      const keys = G.bets.map(b => b.key);
      assert.equal(new Set(keys).size, keys.length, `${name}: bet keys are unique`);
      for (const b of G.bets) assert.ok(b.label && Number.isInteger(b.row), `${name}: ${b.key} has a label and a row`);
      for (const row of G.payouts) assert.equal(row.length, 5, `${name}: payout rows are [name, when, pays, multiple, how often]`);
      assert.ok(G.rules.length >= 3);
    }
  });
});

/* ---------------- Baccarat ---------------- */

// Deal order is Player, Banker, Player, Banker, then third cards; the shoe deals from its end
const shoeFor = deal => [...Array(70)].map(() => card('2', '♣')).concat([...deal].reverse());
describe('Baccarat', () => {
  test('card values and totals (only the last digit counts)', () => {
    const { val, total } = load('baccarat')._test;
    assert.equal(val('A'), 1);
    for (const r of ['10', 'J', 'Q', 'K']) assert.equal(val(r), 0);
    for (let n = 2; n <= 9; n++) assert.equal(val(String(n)), n);
    assert.equal(total([card('7'), card('8')]), 5);
    assert.equal(total([card('9'), card('K'), card('A')]), 0);
  });

  test("banker's third-card rule matches the official tableau", () => {
    const { bankerDraws } = load('baccarat')._test;
    // Player stood (no third card): banker draws on 0–5
    for (let b = 0; b <= 7; b++) assert.equal(bankerDraws(b, null), b <= 5, `banker ${b}, player stood`);
    // Player drew: draws[b] = the player's third-card values on which the banker draws
    const draws = { 0: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      3: [0, 1, 2, 3, 4, 5, 6, 7, 9], 4: [2, 3, 4, 5, 6, 7], 5: [4, 5, 6, 7], 6: [6, 7], 7: [] };
    const rankOf = v => (v === 0 ? 'K' : v === 1 ? 'A' : String(v));
    for (let b = 0; b <= 7; b++) {
      for (let t = 0; t <= 9; t++) assert.equal(bankerDraws(b, card(rankOf(t))), draws[b].includes(t), `banker ${b}, player's third card ${t}`);
    }
  });

  test('payouts for every bet (amount returned, stake included)', () => {
    const G = load('baccarat');
    const o = (winner, extra = {}) => ({ winner, pt: 0, bt: 0, ppair: false, bpair: false, ...extra });
    assert.equal(G.settle('player', 10, o('player')), 20);
    assert.equal(G.settle('player', 10, o('banker')), 0);
    assert.equal(G.settle('player', 10, o('tie')), 10, 'player bet pushes on a tie');
    assert.equal(G.settle('banker', 10, o('banker')), 19.5, 'banker pays 0.95:1');
    assert.equal(G.settle('banker', 10, o('player')), 0);
    assert.equal(G.settle('banker', 10, o('tie')), 10, 'banker bet pushes on a tie');
    assert.equal(G.settle('tie', 10, o('tie')), 90, 'tie pays 8:1');
    assert.equal(G.settle('tie', 10, o('player')), 0);
    assert.equal(G.settle('ppair', 10, o('player', { ppair: true })), 120, 'pairs pay 11:1');
    assert.equal(G.settle('bpair', 10, o('banker', { bpair: true })), 120);
    assert.equal(G.settle('ppair', 10, o('player', { bpair: true })), 0);
  });

  test('a natural stops the deal', async () => {
    const G = load('baccarat');
    G._test.setShoe(shoeFor([card('4'), card('7'), card('5'), card('K')]));     // player 4+5 = 9, banker 7+K = 7
    const o = await G.play(roundCtx());
    assert.deepEqual(plain(o), { winner: 'player', pt: 9, bt: 7, natural: true, ppair: false, bpair: false });
  });

  test('player draws on 5, banker follows the tableau', async () => {
    const G = load('baccarat');
    // player 2+3 = 5 → draws a 4 (total 9); banker 3+K = 3 draws unless the player's third card is an 8 → draws a 5 (total 8)
    G._test.setShoe(shoeFor([card('2'), card('3'), card('3'), card('K'), card('4'), card('5')]));
    const ctx = roundCtx();
    const o = await G.play(ctx);
    assert.equal(o.pt, 9); assert.equal(o.bt, 8); assert.equal(o.winner, 'player');
    const final = ctx.stages.at(-1);
    assert.equal(final.player.length, 3); assert.equal(final.banker.length, 3);
  });

  test('player stands on 6 or 7, banker draws on 5 or less', async () => {
    const G = load('baccarat');
    G._test.setShoe(shoeFor([card('6'), card('A'), card('K'), card('4'), card('Q')]));   // player 6; banker 1+4 = 5 → draws Q (0) → 5
    const ctx = roundCtx();
    const o = await G.play(ctx);
    assert.equal(ctx.stages.at(-1).player.length, 2, 'player stands on 6');
    assert.equal(ctx.stages.at(-1).banker.length, 3, 'banker draws on 5');
    assert.equal(o.winner, 'player');
  });

  test('pairs and ties are detected', async () => {
    const G = load('baccarat');
    G._test.setShoe(shoeFor([card('8'), card('8', '♥'), card('8', '♦'), card('8', '♣')]));   // both 8+8 = 6, both pairs
    const o = await G.play(roundCtx());
    assert.equal(o.winner, 'tie'); assert.equal(o.ppair, true); assert.equal(o.bpair, true);
  });

  test('3,000 random rounds always follow the drawing rules', async () => {
    const G = load('baccarat'), { total, bankerDraws } = G._test, rand = seededRand(42);
    G.reset(rand);
    for (let k = 0; k < 3000; k++) {
      const ctx = roundCtx(rand);
      const o = await G.play(ctx);
      const { player: P, banker: B } = ctx.stages.at(-1);
      const p2 = total(P.slice(0, 2)), b2 = total(B.slice(0, 2)), natural = p2 >= 8 || b2 >= 8;
      assert.equal(P.length === 3, !natural && p2 <= 5, 'player third card');
      const banker3 = !natural && bankerDraws(b2, P.length === 3 ? P[2] : null);
      assert.equal(B.length === 3, banker3, 'banker third card');
      assert.equal(o.pt, total(P)); assert.equal(o.bt, total(B));
      assert.equal(o.winner, o.pt > o.bt ? 'player' : o.bt > o.pt ? 'banker' : 'tie');
    }
  });
});

/* ---------------- Dragon Tiger ---------------- */
describe('Dragon Tiger', () => {
  test('ranks run Ace (low) to King (high), suits ignored', () => {
    const { rank } = load('dragontiger')._test;
    const order = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    order.forEach((r, i) => assert.equal(rank(card(r, '♥')), i + 1));
  });

  test('payouts, including half back on a tie', () => {
    const G = load('dragontiger');
    assert.equal(G.settle('dragon', 10, { winner: 'dragon' }), 20);
    assert.equal(G.settle('tiger', 10, { winner: 'dragon' }), 0);
    assert.equal(G.settle('tie', 10, { winner: 'tie' }), 90, 'tie pays 8:1');
    assert.equal(G.settle('dragon', 10, { winner: 'tie' }), 5, 'dragon loses half on a tie');
    assert.equal(G.settle('tiger', 10, { winner: 'tie' }), 5, 'tiger loses half on a tie');
    assert.equal(G.settle('tie', 10, { winner: 'tiger' }), 0);
  });

  test('the higher card wins; equal ranks tie', async () => {
    const G = load('dragontiger');
    const deal = (d, t) => { G._test.setShoe([...Array(40)].map(() => card('2')).concat([t, d])); return G.play(roundCtx()); };
    assert.equal((await deal(card('K'), card('Q'))).winner, 'dragon');
    assert.equal((await deal(card('A'), card('2'))).winner, 'tiger', 'ace is low');
    assert.equal((await deal(card('7', '♠'), card('7', '♥'))).winner, 'tie', 'suits do not matter');
    assert.match(G.announce(await deal(card('Q'), card('10'))), /Dragon wins, Queen over 10/);
  });
});

/* ---------------- Sic Bo ---------------- */
const SICBO_TOTALS = { 4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 17, 16: 30, 17: 60 };
function sicboExpected(key, stake, dice) {
  const total = dice[0] + dice[1] + dice[2], triple = dice[0] === dice[1] && dice[1] === dice[2];
  const count = n => dice.filter(d => d === n).length;
  if (key === 'small') return !triple && total >= 4 && total <= 10 ? 2 * stake : 0;
  if (key === 'big') return !triple && total >= 11 && total <= 17 ? 2 * stake : 0;
  if (key === 'odd') return !triple && total % 2 === 1 ? 2 * stake : 0;
  if (key === 'even') return !triple && total % 2 === 0 ? 2 * stake : 0;
  if (key === 'anytriple') return triple ? 31 * stake : 0;
  let m;
  if ((m = /^t(\d+)$/.exec(key))) return total === +m[1] ? (SICBO_TOTALS[total] + 1) * stake : 0;
  if ((m = /^tr(\d)$/.exec(key))) return triple && dice[0] === +m[1] ? 181 * stake : 0;
  if ((m = /^d(\d)$/.exec(key))) return count(+m[1]) >= 2 ? 11 * stake : 0;
  if ((m = /^s(\d)$/.exec(key))) return count(+m[1]) ? (count(+m[1]) + 1) * stake : 0;
  throw new Error('unknown bet ' + key);
}
describe('Sic Bo', () => {
  test('the board has every bet (Big/Small, Odd/Even, any triple, 14 totals, 6 doubles, 6 triples, 6 numbers)', () => {
    const keys = plain(load('sicbo').bets.map(b => b.key)).sort();
    const want = ['small', 'big', 'odd', 'even', 'anytriple'];
    for (let t = 4; t <= 17; t++) want.push('t' + t);
    for (let d = 1; d <= 6; d++) want.push('d' + d, 'tr' + d, 's' + d);
    assert.deepEqual(keys, want.sort());
  });

  test('every bet pays correctly on all 216 possible rolls', () => {
    const G = load('sicbo');
    let checks = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
      const dice = [a, b, c], total = a + b + c, triple = a === b && b === c;
      for (const { key } of G.bets) { assert.equal(G.settle(key, 10, { dice, total, triple }), sicboExpected(key, 10, dice), `${key} on ${dice}`); checks++; }
    }
    assert.equal(checks, 216 * 37);
  });

  test('a round rolls three dice and spots triples', async () => {
    const G = load('sicbo');
    const o = await G.play(roundCtx(script(3, 3, 3)));          // the first three draws are the final dice
    assert.deepEqual(plain(o), { dice: [4, 4, 4], total: 12, triple: true });
    assert.equal(G.special(o).label, 'TRIPLE');
    const o2 = await G.play(roundCtx(script(0, 1, 5)));
    assert.deepEqual(plain(o2), { dice: [1, 2, 6], total: 9, triple: false });
    assert.equal(G.special(o2), null);
  });
});

/* ---------------- Craps ---------------- */
// Each roll animates six frames (two dice each) and then makes the real roll: 14 draws, the last two count
function crapsDice(...rolls) {
  const values = rolls.flatMap(([a, b]) => [...Array(12).fill(0), a - 1, b - 1]);
  return script(...values);
}
describe('Craps', () => {
  test('come-out roll outcomes for Pass and Don\'t Pass', async () => {
    const G = load('craps');
    const cases = [[[3, 4], 7, 'win', 'lose'], [[5, 6], 11, 'win', 'lose'], [[1, 1], 2, 'lose', 'win'], [[1, 2], 3, 'lose', 'win'], [[6, 6], 12, 'lose', 'push']];
    for (const [dice, come, pass, dont] of cases) {
      const o = await G.play(roundCtx(crapsDice(dice)));
      assert.equal(o.come, come); assert.equal(o.point, null); assert.equal(o.pass, pass); assert.equal(o.dont, dont);
    }
  });

  test('a point is set, then made or sevened out', async () => {
    const G = load('craps');
    const made = await G.play(roundCtx(crapsDice([2, 4], [2, 3], [1, 5])));    // point 6, a 5, then 6
    assert.equal(made.point, 6); assert.deepEqual(plain(made.rolls), [6, 5, 6]); assert.equal(made.pass, 'win'); assert.equal(made.dont, 'lose');
    const out = await G.play(roundCtx(crapsDice([2, 2], [6, 3], [3, 4])));     // point 4, a 9, then 7
    assert.equal(out.point, 4); assert.deepEqual(plain(out.rolls), [4, 9, 7]); assert.equal(out.pass, 'lose'); assert.equal(out.dont, 'win');
  });

  test('payouts (one-roll bets use the come-out roll only)', () => {
    const G = load('craps');
    const o = (come, extra = {}) => ({ come, point: null, pass: 'lose', dont: 'lose', ...extra });
    assert.equal(G.settle('pass', 10, o(7, { pass: 'win' })), 20);
    assert.equal(G.settle('dontpass', 10, o(12, { dont: 'push' })), 10, "don't pass pushes on 12");
    assert.equal(G.settle('dontpass', 10, o(3, { dont: 'win' })), 20);
    for (const c of [2, 12]) assert.equal(G.settle('field', 10, o(c)), 30, `field pays 2:1 on ${c}`);
    for (const c of [3, 4, 9, 10, 11]) assert.equal(G.settle('field', 10, o(c)), 20, `field pays 1:1 on ${c}`);
    for (const c of [5, 6, 7, 8]) assert.equal(G.settle('field', 10, o(c)), 0, `field loses on ${c}`);
    assert.equal(G.settle('any7', 10, o(7)), 50);
    for (const c of [2, 3, 12]) assert.equal(G.settle('anycraps', 10, o(c)), 80);
    assert.equal(G.settle('yo', 10, o(11)), 160);
    assert.equal(G.settle('yo', 10, o(6, { point: 6, rolls: [6, 11] })), 0, 'an 11 after the come-out does not pay Yo');
  });
});

/* ---------------- What the dealer says and shows ---------------- */
describe('What the dealer says and shows', () => {
  test('dealer announcements: each table says the result the way players expect', () => {
    const B = load('baccarat'), C = load('craps'), S = load('sicbo'), D = load('dragontiger');
    assert.equal(B.announce({ winner: 'banker', pt: 5, bt: 7 }), 'Banker wins, 7 to 5.');
    assert.equal(B.announce({ winner: 'tie', pt: 6, bt: 6, natural: false }), 'Tie, 6 each.');
    assert.match(B.announce({ winner: 'player', pt: 9, bt: 3, natural: true, ppair: true }), /^Player wins, 9 to 3\. A natural! Player pair!$/);
    assert.equal(C.announce({ come: 7, pass: 'win' }), '7 on the come-out. Pass Line wins!');
    assert.equal(C.announce({ come: 12, pass: 'lose' }), "Craps twelve. Don't Pass pushes.");
    assert.match(C.announce({ come: 2, pass: 'lose' }), /^Craps 2\. Don't Pass wins/);
    assert.equal(C.announce({ point: 6, pass: 'win' }), 'Point 6 made. Pass Line wins!');
    assert.equal(C.announce({ point: 6, pass: 'lose' }), "Seven out. Don't Pass wins!");
    assert.equal(S.announce({ dice: [4, 4, 4], total: 12, triple: true }), 'Triple fours! Total 12.');
    assert.match(S.announce({ dice: [1, 2, 4], total: 7 }), /^1, 2, 4\. Total 7, small/);
    assert.match(S.announce({ dice: [6, 5, 4], total: 15 }), /Total 15, big/);
    assert.equal(D.announce({ winner: 'tie', d: card('K'), t: card('K', '♥') }), 'Tie! King and King.');
  });

  test('result beads (the recent-results strip): letter, colour and group for each outcome', () => {
    const B = load('baccarat'), C = load('craps'), S = load('sicbo'), D = load('dragontiger');
    assert.deepEqual(plain(B.token({ winner: 'player', pt: 8, bt: 2 })).text, 'P');
    assert.deepEqual(plain(B.token({ winner: 'tie', pt: 4, bt: 4 })).text, 'T');
    assert.deepEqual(plain(C.token({ come: 7, rolls: [7], pass: 'win', dont: 'lose' })), { text: '7', cls: 'tok-blue', tip: 'Come-out 7 · Pass won', group: 'Pass' });
    assert.deepEqual(plain(C.token({ point: 8, come: 8, rolls: [8, 5, 7], pass: 'lose', dont: 'win' })), { text: '8', cls: 'tok-dark', tip: "Point 8 · 3 rolls · Don't Pass won", group: "Don't Pass" });
    assert.equal(C.token({ come: 12, rolls: [12], pass: 'lose', dont: 'push' }).group, 'Push (12)');
    assert.equal(S.token({ dice: [3, 3, 3], total: 9, triple: true }).cls, 'tok-gold');
    assert.equal(S.token({ dice: [6, 6, 5], total: 17 }).cls, 'tok-red');
    const t = plain(D.token({ winner: 'tiger', d: card('2'), t: card('9') }));
    assert.equal(t.text, 'T'); assert.equal(t.group, 'Tiger'); assert.equal(t.tip, 'Dragon 2 · Tiger 9');
  });

  test('table stages: cards, dice and the craps puck are drawn from the round\'s state', () => {
    const h = { card: c => `[${c.r}${c.s}]`, die: d => `<die ${d}>` };
    const D = load('dragontiger'), B = load('baccarat'), S = load('sicbo'), C = load('craps');
    const dt = D.stageHTML({ dragon: card('K'), tiger: card('3'), winner: 'dragon' }, h);
    assert.match(dt, /dt-d win/); assert.match(dt, /\[K♠\]/); assert.match(dt, /\[3♠\]/);
    assert.match(D.stageHTML({ dragon: null, tiger: null }, h), /card-slot/);
    const bac = B.stageHTML({ player: [card('9')], banker: [card('2'), card('3')], pt: 9, bt: 5, winner: 'player' }, h);
    assert.match(bac, /bac-p win/); assert.match(bac, /\[9♠\]/);
    assert.match(S.stageHTML({ dice: [1, 2, 3], total: 6 }, h), /Total <b>6<\/b> · Small/);
    assert.match(S.stageHTML({ dice: [5, 5, 5], total: 15, triple: true }, h), /TRIPLE!/);
    assert.match(C.stageHTML({ point: 6, dice: [3, 3], total: 6, rolls: [8, 6] }, h), /ON<b>6<\/b>/);
    assert.match(C.stageHTML({}, h), /OFF/);
    assert.match(C.stageHTML({}, h), /Come-out roll next/);
  });

  test('dragon tiger: a fresh 8-deck shoe is shuffled when fewer than 30 cards are left', async () => {
    const G = load('dragontiger');
    G._test.setShoe([]);
    const ctx = roundCtx(seededRand(3));
    const o = await G.play(ctx);
    assert.match(ctx.said[0], /Shuffling a fresh shoe/);
    assert.ok(o.d && o.t && ['dragon', 'tiger', 'tie'].includes(o.winner));
    // 8 decks: the next 40 rounds come from the same shoe (no more shuffling announced)
    for (let k = 0; k < 40; k++) await G.play(ctx);
    assert.equal(ctx.said.filter(t => /Shuffling/.test(t)).length, 1);
  });
});
