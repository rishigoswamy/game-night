// Roulette and Blackjack rules (public/games/casino/roulette-rules.js, blackjack-rules.js)
const test = require('node:test');
const { describe } = test;
const assert = require('node:assert/strict');
const { loadScripts, plain, seededRand, card } = require('./helpers');

const R = loadScripts(['games/casino/roulette-rules.js']).RouletteRules;
const B = loadScripts(['games/casino/blackjack-rules.js']).BlackjackRules;

/* ---------------- Roulette ---------------- */
describe('Roulette', () => {
  test('roulette wheel: 38 pockets (0, 00, 1–36), each once; 18 red, 18 black, 2 green', () => {
    assert.equal(R.POCKETS, 38);
    assert.deepEqual(plain(R.ORDER).sort((a, b) => a - b), [...Array(38).keys()]);
    const colours = { red: 0, black: 0, green: 0 };
    for (let n = 0; n <= 37; n++) colours[R.colorOf(n)]++;
    assert.deepEqual(colours, { red: 18, black: 18, green: 2 });
    assert.equal(R.lbl(37), '00'); assert.equal(R.lbl(0), '0');
    assert.ok(R.isZero(0) && R.isZero(37) && !R.isZero(1));
    // standard American layout: 1 red, 2 black, 10 black, 11 black, 19 red, 36 red
    assert.deepEqual([1, 2, 10, 11, 19, 36].map(R.colorOf), ['red', 'black', 'black', 'black', 'red', 'red']);
  });

  test('roulette bets: how many pockets each covers and what it pays', () => {
    const covers = key => [...Array(38).keys()].filter(R.DEFS[key].wins).length;
    for (let n = 0; n <= 37; n++) { assert.equal(covers('n' + n), 1); assert.equal(R.DEFS['n' + n].payout, 35); }
    for (const k of ['d1', 'd2', 'd3', 'c1', 'c2', 'c3']) { assert.equal(covers(k), 12, k); assert.equal(R.DEFS[k].payout, 2); }
    for (const k of ['red', 'black', 'odd', 'even', 'low', 'high']) { assert.equal(covers(k), 18, k); assert.equal(R.DEFS[k].payout, 1); }
  });

  test('0 and 00 lose every outside bet', () => {
    for (const z of [0, 37]) for (const k of ['red', 'black', 'odd', 'even', 'low', 'high', 'd1', 'd2', 'd3', 'c1', 'c2', 'c3']) {
      assert.equal(R.DEFS[k].wins(z), false, `${k} on ${R.lbl(z)}`);
    }
  });

  test('every bet has the same house edge (36/38 back on average)', () => {
    for (const [k, d] of Object.entries(R.DEFS)) {
      const wins = [...Array(38).keys()].filter(d.wins).length;
      assert.ok(Math.abs(wins * (d.payout + 1) / 38 - 36 / 38) < 1e-12, k);
    }
  });

  test('roulette settle: each player gets back stake + winnings of their winning bets', () => {
    // the example from the payout notes: $10 on 17 and $10 on Black; 17 (black) comes up → $380 back
    assert.deepEqual(plain(R.settle([{ p: 0, key: 'n17', amt: 10 }, { p: 0, key: 'black', amt: 10 }], 17, 1)), [{ staked: 20, returned: 380 }]);
    const bets = [{ p: 0, key: 'red', amt: 25 }, { p: 1, key: 'd1', amt: 10 }, { p: 1, key: 'c3', amt: 5 }, { p: 2, key: 'n0', amt: 5 }];
    assert.deepEqual(plain(R.settle(bets, 12, 4)), [{ staked: 25, returned: 50 }, { staked: 15, returned: 45 }, { staked: 5, returned: 0 }, { staked: 0, returned: 0 }]);
    assert.deepEqual(plain(R.settle(bets, 37, 3)).map(x => x.returned), [0, 0, 0], '00: everything here loses');
  });

  test('the phones draw the wheel with the same numbers and colours as the table', () => {
    const V = loadScripts(['js/lib/roulette-view.js']).RouletteView;
    for (let n = 0; n <= 37; n++) {
      assert.equal(V.lbl(n), R.lbl(n)); assert.equal(V.isZero(n), R.isZero(n)); assert.equal(V.colorOf(n), R.colorOf(n));
    }
  });
});

/* ---------------- Blackjack ---------------- */
const hand = (ranks, extra = {}) => ({ cards: ranks.map(r => card(r)), bet: 10, ...extra });
const total = ranks => plain(B.handTotal(ranks.map(r => card(r))));
describe('Blackjack', () => {
  test('blackjack card values: 2–10 as shown, J/Q/K 10, Ace 11 or 1', () => {
    for (let n = 2; n <= 10; n++) assert.equal(B.cardVal(card(String(n))), n);
    for (const r of ['J', 'Q', 'K']) assert.equal(B.cardVal(card(r)), 10);
    assert.equal(B.cardVal(card('A')), 11);
  });

  test('blackjack totals: soft and hard hands', () => {
    assert.deepEqual(total(['A', '6']), { t: 17, soft: true });
    assert.deepEqual(total(['A', '6', 'K']), { t: 17, soft: false }, 'the Ace drops to 1');
    assert.deepEqual(total(['A', 'A']), { t: 12, soft: true });
    assert.deepEqual(total(['A', 'A', '9']), { t: 21, soft: true });
    assert.deepEqual(total(['K', 'Q', '5']), { t: 25, soft: false });
    const withHole = [card('K'), { ...card('9'), down: true }];
    assert.equal(B.handTotal(withHole).t, 10, 'a face-down card is not counted…');
    assert.equal(B.handTotal(withHole, true).t, 19, '…unless asked for all cards');
  });

  test('what is a blackjack, and how totals are shown and spoken', () => {
    assert.equal(B.isBlackjack(hand(['A', 'K'])), true);
    assert.equal(B.isBlackjack(hand(['K', 'A'])), true);
    assert.equal(B.isBlackjack(hand(['A', 'K'], { split: true })), false, 'a split 21 is not a blackjack');
    assert.equal(B.isBlackjack(hand(['7', '7', '7'])), false);
    assert.equal(B.isDealerBlackjack([card('A'), card('Q')]), true);
    assert.equal(B.totalLabel([card('A'), card('6')]), '7 / 17');
    assert.equal(B.totalLabel([card('A'), card('K')]), '21');
    assert.equal(B.totalLabel([card('K'), card('Q'), card('5')]), 'Bust 25');
    assert.equal(B.spokenTotal([card('A'), card('6')]), 'soft 17');
    assert.equal(B.spokenTotal([card('10'), card('7')]), '17');
  });

  test('double on any first two cards (not after split Aces) if you can cover the bet', () => {
    assert.equal(!!B.canDouble(hand(['5', '6']), 10), true);
    assert.equal(!!B.canDouble(hand(['5', '6']), 9), false, 'needs the chips');
    assert.equal(!!B.canDouble(hand(['5', '3', '2']), 100), false, 'only on two cards');
    assert.equal(!!B.canDouble(hand(['5', '6'], { done: true }), 100), false);
    assert.equal(!!B.canDouble(hand(['A', '6'], { split: true }), 100), false, 'not on split Aces');
    assert.equal(!!B.canDouble(hand(['8', '3'], { split: true }), 100), true, 'double after splitting other cards is fine');
  });

  test('split a pair of equal value, once, if you can cover the bet', () => {
    assert.equal(!!B.canSplit(hand(['8', '8']), 1, 10), true);
    assert.equal(!!B.canSplit(hand(['K', 'Q']), 1, 10), true, 'any two 10-value cards');
    assert.equal(!!B.canSplit(hand(['8', '9']), 1, 10), false);
    assert.equal(!!B.canSplit(hand(['8', '8']), 2, 10), false, 'already split this round');
    assert.equal(!!B.canSplit(hand(['8', '8'], { split: true }), 1, 10), false);
    assert.equal(!!B.canSplit(hand(['8', '8']), 1, 5), false, 'needs the chips');
    assert.equal(B.isSplitAces(hand(['A', '5'])), true);
  });

  test('blackjack dealer: checks for blackjack with an Ace or 10 showing; stands on all 17s', () => {
    for (const r of ['A', '10', 'J', 'Q', 'K']) assert.equal(B.dealerChecksForBlackjack(card(r)), true, r);
    for (const r of ['2', '6', '9']) assert.equal(B.dealerChecksForBlackjack(card(r)), false, r);
    assert.equal(B.dealerHits(16), true);
    assert.equal(B.dealerHits(17), false, 'stands on 17, soft or hard');
    assert.equal(B.dealerHits(B.handTotal([card('A'), card('6')]).t), false, 'soft 17 stands');
  });

  test('blackjack results and payouts', () => {
    const dealer = ranks => ranks.map(r => card(r));
    const res = (ranks, dealerRanks, extra) => plain(B.result(hand(ranks, extra), dealer(dealerRanks)));
    assert.deepEqual(res(['10', '9'], ['10', '8']), { outcome: 'win', net: 10 });
    assert.deepEqual(res(['10', '7'], ['10', '8']), { outcome: 'lose', net: -10 });
    assert.deepEqual(res(['10', '8'], ['9', '9']), { outcome: 'push', net: 0 });
    assert.deepEqual(res(['10', '2'], ['10', '6', '9']), { outcome: 'win', net: 10 }, 'dealer busts');
    assert.deepEqual(res(['A', 'K'], ['10', '9']), { outcome: 'bj', net: 15 }, 'blackjack pays 3:2');
    assert.deepEqual(plain(B.result(hand(['A', 'K'], { bet: 5 }), dealer(['10', '9']))), { outcome: 'bj', net: 7.5 }, '$5 blackjack pays $7.50');
    assert.deepEqual(res(['A', 'K'], ['A', 'Q']), { outcome: 'push', net: 0 }, 'both have blackjack');
    assert.deepEqual(res(['7', '7', '7'], ['A', 'Q']), { outcome: 'lose', net: -10 }, "dealer's blackjack beats a three-card 21");
    assert.deepEqual(res(['A', 'K'], ['10', '9'], { split: true }), { outcome: 'win', net: 10 }, 'a split 21 is paid 1:1');
    assert.deepEqual(res(['K', 'Q', '5'], ['10', '6', '9'], { outcome: 'bust', net: -10 }), { outcome: 'bust', net: -10 }, 'a busted hand loses even if the dealer busts');
    assert.deepEqual(res(['5', '6'], ['10', '7'], { bet: 20, doubled: true }), { outcome: 'lose', net: -20 }, 'a doubled bet wins or loses double');
  });

  test('chips returned per hand (stake included)', () => {
    assert.equal(B.returned({ bet: 10, outcome: 'win', net: 10 }), 20);
    assert.equal(B.returned({ bet: 10, outcome: 'bj', net: 15 }), 25);
    assert.equal(B.returned({ bet: 10, outcome: 'push', net: 0 }), 10);
    assert.equal(B.returned({ bet: 10, outcome: 'lose', net: -10 }), 0);
    assert.equal(B.returned({ bet: 10, outcome: 'bust', net: -10 }), 0);
  });

  test('blackjack shoe: 6 decks = 312 cards, each card 6 times, shuffled reproducibly', () => {
    const shoe = plain(B.newShoe(6, seededRand(3)));
    assert.equal(shoe.length, 312);
    const counts = {};
    shoe.forEach(c => { counts[c.r + c.s] = (counts[c.r + c.s] || 0) + 1; });
    assert.equal(Object.keys(counts).length, 52);
    assert.ok(Object.values(counts).every(n => n === 6));
    assert.deepEqual(plain(B.newShoe(6, seededRand(3))), shoe, 'same random numbers → same order');
    assert.notDeepEqual(plain(B.newShoe(6, seededRand(4))), shoe);
  });
});
