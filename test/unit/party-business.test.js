// Business (public/games/party/business.js): a Monopoly-style property game with twelve themed boards (Beta)
const test = require('node:test');
const { describe } = test;
const assert = require('node:assert/strict');
const { loadScripts, plain, partyCtx, seededRand, flush } = require('./helpers');

const load = () => loadScripts(['games/party/common.js', 'games/party/business.js']).PARTY_GAME;
const T = () => load()._test;
const H = { esc: x => String(x), color: () => '#888' };
// A game past the roll for turn order. opts: the lobby options
async function game(n = 3, opts = {}, seed = 7) {
  const G = load(), ctx = partyCtx(n, { opts: { board: 'newyork', ...opts }, rand: seededRand(seed) });
  await G.start(ctx);
  while (ctx.state.step === 'order') G.act(ctx, ctx.state.turn, { act: 'orderRoll' });
  return { G, ctx, st: ctx.state, t: G._test };
}
// The next dice: each value is a die face (1–6); then the seeded randomness again
function dice(ctx, ...faces) {
  const rest = ctx.rand, queue = faces.map(f => f - 1);
  ctx.rand = n => (queue.length ? queue.shift() % n : rest(n));
}
const own = (st, p, ...spaces) => spaces.forEach(i => { st.own[i] = { p, h: 0, mort: false }; });

describe('The board and its twelve themes', () => {
  test('40 spaces: 22 streets in 8 colour sets, 4 stations, 2 utilities, the standard prices', () => {
    const t = T();
    assert.equal(t.SPACES.length, 40);
    assert.equal(t.STREETS.length, 22); assert.equal(t.STATIONS.length, 4); assert.equal(t.UTILITIES.length, 2); assert.equal(t.OWNABLE.length, 28);
    assert.deepEqual(Object.values(t.GROUPS).map(g => g.length), [2, 3, 3, 3, 3, 3, 3, 2]);
    assert.deepEqual(plain([0, 10, 20, 30].map(i => t.SPACES[i].type)), ['go', 'jail', 'parking', 'gotojail']);
    assert.equal(t.SPACES[1].price, 60); assert.equal(t.SPACES[39].price, 400); assert.deepEqual(plain(t.SPACES[39].rents), [50, 200, 600, 1400, 1700, 2000]);
    assert.equal(t.FORTUNE.length, 16); assert.equal(t.TREASURY.length, 16);
  });

  test('every board is complete: names, stations, utilities, 8 tokens, money, and all 32 cards and narrator lines in its own words', () => {
    const t = T();
    assert.deepEqual(plain(t.BOARD_KEYS), ['newyork', 'mumbai', 'paris', 'rio', 'zurich', 'tokyo', 'dublin', 'santorini', 'cairo', 'tromso', 'hongkong', 'prague']);
    for (const k of t.BOARD_KEYS) {
      const b = t.BOARDS[k];
      assert.equal(new Set(b.streets).size, 22, `${k}: 22 different streets`);
      assert.equal(b.stations.length, 4); assert.equal(b.utilities.length, 2); assert.equal(new Set(b.tokens).size, 8, `${k}: 8 different tokens`);
      assert.ok((b.sym || b.suffix) && b.factor > 0 && b.mood && b.colors.frame, `${k}: money and looks`);
      for (const key of t.FK) assert.ok(b.f[key], `${k}: Fortune card ${key}`);
      for (const key of t.TK) assert.ok(b.t[key], `${k}: Treasury card ${key}`);
      for (const key of t.SAY) assert.ok(b.say[key], `${k}: narrator line ${key}`);
      for (const c of [...t.FORTUNE.map(c => b.f[c.k]), ...t.TREASURY.map(c => b.t[c.k])].filter((x, i, all) => all.indexOf(x) === i))
        if (/collect|pay/.test(c) && !/salary|rent|10 ×/.test(c)) assert.match(c, /\{A\}/, `${k}: "${c}" shows its amount`);
    }
  });

  test('money is shown in each board\'s own scale and style', () => {
    const { money, BOARDS: B } = T();
    assert.equal(money(B.newyork, 400), '$4M'); assert.equal(money(B.newyork, 60), '$600k'); assert.equal(money(B.newyork, 1500), '$15M');
    assert.equal(money(B.zurich, 400), 'CHF 4.5M'); assert.equal(money(B.tromso, 400), 'NOK 10.5M'); assert.equal(money(B.rio, 400), 'R$3.9M');
    assert.equal(money(B.paris, 400), '€2.6M'); assert.equal(money(B.dublin, 400), '€1.7M'); assert.equal(money(B.cairo, 400), 'E£7.5M');
    assert.equal(money(B.tokyo, 400), '¥380M'); assert.equal(money(B.mumbai, 400), '₹16 Cr'); assert.equal(money(B.mumbai, 10), '₹40 L');
    assert.equal(money(B.santorini, 400), '€1.8M'); assert.equal(money(B.hongkong, 400), 'HK$90M'); assert.equal(money(B.prague, 400), 'Kč 40M'); assert.equal(money(B.prague, 60), 'Kč 6M');
  });
});

describe('Rent', () => {
  test('streets: base, doubled with the whole set, houses and hotel; nothing while mortgaged', async () => {
    const { st, t } = await game();
    own(st, 0, 37);
    assert.equal(t.rent(st, 37, 7), 35);
    own(st, 0, 39);
    assert.equal(t.rent(st, 37, 7), 70, 'the whole dark-blue set doubles the bare rent');
    st.own[37].h = 3; assert.equal(t.rent(st, 37, 7), 1100);
    st.own[37].h = t.HOTEL; assert.equal(t.rent(st, 37, 7), 1500);
    st.own[39].mort = true; assert.equal(t.rent(st, 39, 7), 0);
  });

  test('stations by how many the owner has; utilities 4 × or 10 × the dice', async () => {
    const { st, t } = await game();
    own(st, 1, 5); assert.equal(t.rent(st, 5, 7), 25);
    own(st, 1, 15, 25); assert.equal(t.rent(st, 5, 7), 100);
    own(st, 1, 35); assert.equal(t.rent(st, 35, 7), 200);
    own(st, 2, 12); assert.equal(t.rent(st, 12, 9), 36);
    own(st, 2, 28); assert.equal(t.rent(st, 12, 9), 90);
  });
});

describe('Building and mortgages', () => {
  test('only with the whole set, nothing mortgaged, built evenly; a hotel after 4 houses', async () => {
    const { st, t } = await game();
    own(st, 0, 1);
    assert.ok(!t.canBuild(st, 0, 1), 'not without the whole brown set');
    own(st, 0, 3);
    st.own[3].mort = true; assert.ok(!t.canBuild(st, 0, 1), 'not with a mortgaged street in the set'); st.own[3].mort = false;
    assert.ok(t.canBuild(st, 0, 1));
    st.own[1].h = 1; assert.ok(!t.canBuild(st, 0, 1), 'evenly: the other street first'); assert.ok(t.canBuild(st, 0, 3));
    st.own[1].h = 4; st.own[3].h = 4; assert.ok(t.canBuild(st, 0, 1), 'a hotel next');
    st.hotels = 0; assert.ok(!t.canBuild(st, 0, 1), 'not when the bank has no hotels'); st.hotels = 12;
    st.cash[0] = 10; assert.ok(!t.canBuild(st, 0, 1), 'not without the money');
  });

  test('through the phone: building and selling evenly at half price; the bank\'s houses and hotels', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn; st.step = 'main'; st.cash[p] = 2000;
    own(st, p, 1, 3);
    for (let k = 0; k < 8; k++) assert.equal(G.act(ctx, p, { act: 'build', at: k % 2 ? 3 : 1 }), undefined);
    assert.deepEqual([st.own[1].h, st.own[3].h, st.houses], [4, 4, 24]);
    G.act(ctx, p, { act: 'build', at: 1 });
    assert.deepEqual([st.own[1].h, st.houses, st.hotels], [5, 28, 11], 'the hotel returns its 4 houses to the bank');
    assert.match(G.act(ctx, p, { act: 'sell', at: 3 }), /evenly/, 'sell the hotel first');
    const cash = st.cash[p];
    G.act(ctx, p, { act: 'sell', at: 1 });
    assert.deepEqual([st.own[1].h, st.hotels, st.cash[p] - cash], [4, 12, 25], 'back to 4 houses, half the price back');
    assert.match(G.act(ctx, p, { act: 'mortgage', at: 1 }), /sell the buildings/);
  });

  test('the short game: a hotel after 3 houses', async () => {
    const { st, t } = await game(3, { length: 'short' });
    Object.keys(st.own).forEach(k => delete st.own[k]);
    own(st, 0, 1, 3); st.own[1].h = 3; st.own[3].h = 3;
    assert.ok(t.canBuild(st, 0, 1));
    st.own[1].h = t.HOTEL; assert.equal(t.rent(st, 1, 7), 250);
  });

  test('mortgage for half the price; pay it off with 10% interest', async () => {
    const { G, ctx, st, t } = await game();
    const p = st.turn; st.step = 'main'; st.cash[p] = 100;
    own(st, p, 39);
    G.act(ctx, p, { act: 'mortgage', at: 39 });
    assert.equal(st.cash[p], 300); assert.ok(st.own[39].mort);
    assert.equal(t.unmortgageCost(39), 220);
    G.act(ctx, p, { act: 'unmortgage', at: 39 });
    assert.equal(st.cash[p], 80); assert.ok(!st.own[39].mort);
  });
});

describe('Turns, doubles and jail', () => {
  test('everyone rolls for turn order; the highest starts, then seat order', async () => {
    const { t, st } = await game(4);
    assert.equal(t.firstPlayer([{ p: 2, t: 9 }, { p: 0, t: 11 }, { p: 1, t: 11 }]), 0, 'a tie: whoever rolled it first');
    assert.equal(st.turn, st.first); assert.equal(st.step, 'roll');
    assert.deepEqual(plain(t.seatOrder(st, 4)), [0, 1, 2, 3].map(k => (st.first + k) % 4));
  });

  test('roll and move; passing GO pays the salary; doubles roll again, three doubles go to jail', async () => {
    const { G, ctx, st, t } = await game();
    const p = st.turn; st.pos[p] = 36; st.cash[p] = 1500;
    t.OWNABLE.forEach(i => own(st, p, i));                       // the player owns everything: landings change nothing
    dice(ctx, 3, 4);
    G.act(ctx, p, { act: 'roll' });
    assert.equal(st.pos[p], 3); assert.equal(st.cash[p], 1700, 'passed GO');
    assert.equal(st.step, 'main', 'no doubles: the roll is over');
    st.step = 'roll'; st.pos[p] = 4;
    dice(ctx, 1, 1); G.act(ctx, p, { act: 'roll' });
    assert.deepEqual([st.pos[p], st.step], [6, 'roll'], 'doubles: roll again');
    dice(ctx, 2, 2); G.act(ctx, p, { act: 'roll' });
    assert.deepEqual([st.pos[p], st.step], [10, 'roll'], 'just visiting the jail; doubles again');
    dice(ctx, 3, 3); G.act(ctx, p, { act: 'roll' });
    assert.equal(st.pos[p], 10); assert.equal(st.jail[p], 0, 'the third doubles in a row: jail'); assert.equal(st.step, 'main');
  });

  test('jail: pay the fine, use a card, roll doubles to get out; after three tries pay and move', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn; st.step = 'main';
    G.act(ctx, p, { act: 'end' });
    const q = st.turn;
    st.jail[q] = 0; st.pos[q] = 10; st.step = 'jail'; st.cash[q] = 500;
    G.act(ctx, q, { act: 'jailpay' });
    assert.deepEqual([st.jail[q], st.step, st.cash[q]], [-1, 'roll', 450]);
    st.jail[q] = 0; st.step = 'jail'; st.jailFree[q].push({ deck: 'treasury', num: 4 });
    G.act(ctx, q, { act: 'jailcard' });
    assert.deepEqual([st.jail[q], st.jailFree[q].length], [-1, 0]);
    st.jail[q] = 0; st.step = 'jail';
    dice(ctx, 2, 2); G.act(ctx, q, { act: 'jailroll' });
    assert.equal(st.jail[q], -1); assert.equal(st.pos[q], 14, 'doubles: out, and move');
    st.pos[q] = 10; st.jail[q] = 2; st.step = 'jail'; st.cash[q] = 500;
    dice(ctx, 1, 2); G.act(ctx, q, { act: 'jailroll' });
    assert.equal(st.jail[q], -1); assert.equal(st.pos[q], 13); assert.ok(st.cash[q] <= 450, 'third failure: pay and move');
  });

  test('the short game: only one turn in jail', async () => {
    const { G, ctx, st } = await game(3, { length: 'short' });
    const p = st.turn;
    st.jail[p] = 0; st.pos[p] = 10; st.step = 'jail';
    dice(ctx, 1, 2); G.act(ctx, p, { act: 'jailroll' });
    assert.equal(st.jail[p], -1); assert.equal(st.pos[p], 13);
  });
});

describe('Buying and auctions', () => {
  test('buy at the printed price', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn; st.pos[p] = 35;
    dice(ctx, 1, 3); G.act(ctx, p, { act: 'roll' });              // → 39, the dearest street
    assert.equal(st.step, 'buy');
    G.act(ctx, p, { act: 'buy' });
    assert.equal(st.own[39].p, p); assert.equal(st.cash[p], 1100); assert.equal(st.step, 'main');
  });

  test('declined: everyone bids, the top bid wins when the clock runs out', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn, q = (p + 1) % 3, r = (p + 2) % 3; st.pos[p] = 35;
    dice(ctx, 1, 3); G.act(ctx, p, { act: 'roll' });
    G.act(ctx, p, { act: 'decline' });
    assert.equal(st.step, 'auction');
    G.act(ctx, q, { act: 'bid', add: 100 });
    G.act(ctx, r, { act: 'bid', add: 50 });
    assert.match(G.act(ctx, r, { act: 'bid', add: 10 }), /top bid/);
    G.act(ctx, p, { act: 'bid', add: 10 });
    assert.deepEqual([st.auction.bid, st.auction.by], [160, p]);
    ctx.expire(); await flush();
    assert.equal(st.own[39].p, p); assert.equal(st.cash[p], 1340); assert.equal(st.step, 'main');
  });

  test('when everyone else passes it closes at once; with no bids it stays with the bank; auctions off: it simply stays', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn, q = (p + 1) % 3, r = (p + 2) % 3; st.pos[p] = 35;
    dice(ctx, 1, 3); G.act(ctx, p, { act: 'roll' }); G.act(ctx, p, { act: 'decline' });
    G.act(ctx, q, { act: 'bid', add: 10 }); G.act(ctx, r, { act: 'apass' }); G.act(ctx, p, { act: 'apass' });
    assert.equal(st.own[39].p, q); assert.equal(st.auction, null);
    const g2 = await game(3, {}, 3); const p2 = g2.st.turn; g2.st.pos[p2] = 35;
    dice(g2.ctx, 1, 3); g2.G.act(g2.ctx, p2, { act: 'roll' }); g2.G.act(g2.ctx, p2, { act: 'decline' });
    g2.ctx.expire(); await flush();
    assert.equal(g2.st.own[39], undefined, 'nobody bid');
    const g3 = await game(3, { auctions: 'off' }); const p3 = g3.st.turn; g3.st.pos[p3] = 35;
    dice(g3.ctx, 1, 3); g3.G.act(g3.ctx, p3, { act: 'roll' }); g3.G.act(g3.ctx, p3, { act: 'decline' });
    assert.equal(g3.st.step, 'main'); assert.equal(g3.st.own[39], undefined);
  });
});

describe('Cards', () => {
  // Draw a chosen card for the player on turn
  const draw = (G, ctx, deck, k) => { const st = ctx.state, list = deck === 'fortune' ? G._test.FORTUNE : G._test.TREASURY; st.decks[deck] = [list.findIndex(c => c.k === k), ...st.decks[deck].filter(n => n !== list.findIndex(c => c.k === k))]; st.step = 'roll'; G._test.drawCard(ctx, st.turn, deck); };
  test('move, collect, pay, go back 3, go to jail; the text is the board\'s own, with its money', async () => {
    const { G, ctx, st } = await game(3, { board: 'mumbai' });
    const p = st.turn; st.pos[p] = 7; st.cash[p] = 1000;
    draw(G, ctx, 'fortune', 'adv39'); assert.equal(st.pos[p], 39); assert.match(st.card.text, /Altamount Road/);
    st.step = 'main'; st.pos[p] = 2;
    draw(G, ctx, 'treasury', 'error'); assert.equal(st.cash[p], 1200); assert.match(st.card.text, /₹8 Cr/);
    draw(G, ctx, 'treasury', 'doctor'); assert.equal(st.cash[p], 1150);
    st.pos[p] = 7; draw(G, ctx, 'fortune', 'back3'); assert.equal(st.pos[p], 4); assert.equal(st.cash[p], 950, 'back 3 onto Income Tax');
    st.pos[p] = 7; draw(G, ctx, 'fortune', 'jail'); assert.equal(st.pos[p], 10); assert.equal(st.jail[p], 0);
  });

  test('nearest station pays double; nearest utility pays 10 × a fresh roll; repairs per building', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn, q = (p + 1) % 3; st.pos[p] = 7; st.cash[p] = 1000;
    own(st, q, 15);
    draw(G, ctx, 'fortune', 'rail'); assert.equal(st.pos[p], 15); assert.equal(st.cash[p], 950, 'twice the 25 rent');
    st.pos[p] = 22; own(st, q, 28);
    dice(ctx, 3, 4); draw(G, ctx, 'fortune', 'util'); assert.equal(st.pos[p], 28); assert.equal(st.cash[p], 880, '10 × 7');
    own(st, p, 1, 3); st.own[1].h = 3; st.own[3].h = 5;
    draw(G, ctx, 'treasury', 'repairs'); assert.equal(st.cash[p], 880 - 3 * 40 - 115);
  });

  test('a birthday: everyone pays you; paying everyone; a kept Get Out of Jail Free card leaves the deck', async () => {
    const { G, ctx, st } = await game(4);
    const p = st.turn;
    st.cash = [500, 500, 500, 500];
    draw(G, ctx, 'treasury', 'birthday'); assert.equal(st.cash[p], 530);
    draw(G, ctx, 'fortune', 'payeach'); assert.equal(st.cash[p], 380);
    draw(G, ctx, 'treasury', 'jailfree'); assert.equal(st.jailFree[p].length, 1); assert.equal(st.decks.treasury.length, 15);
  });
});

describe('Debt and bankruptcy', () => {
  test('owing more than you have: raise money and pay; or go bankrupt and the creditor gets everything', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn, q = (p + 1) % 3;
    own(st, q, 37, 39); st.own[39].h = 3;                          // rent 1400
    own(st, p, 1, 5);
    st.cash[p] = 1000; st.pos[p] = 35;
    dice(ctx, 1, 3); G.act(ctx, p, { act: 'roll' });
    assert.equal(st.step, 'debt'); assert.equal(st.debts[0].n, 1400);
    assert.match(G.act(ctx, p, { act: 'paydebt' }), /raise/);
    G.act(ctx, p, { act: 'mortgage', at: 1 }); G.act(ctx, p, { act: 'mortgage', at: 5 });
    assert.equal(st.cash[p], 1130);
    G.act(ctx, p, { act: 'bankrupt' });
    assert.ok(st.out[p]); assert.equal(st.own[1].p, q); assert.equal(st.own[5].p, q);
    assert.ok(st.cash[q] >= 1500 + 1130 - 20, 'the cash, less the 10% on the mortgaged properties');
  });

  test('bankrupt to the bank: properties go back and up for auction; the last player standing wins', async () => {
    const { G, ctx, st } = await game(2);
    const p = st.turn, q = 1 - p;
    own(st, p, 1, 3);
    st.cash[p] = 50; st.pos[p] = 0;
    dice(ctx, 2, 2); G.act(ctx, p, { act: 'roll' });              // Income Tax 200
    assert.equal(st.step, 'debt');
    G.act(ctx, p, { act: 'bankrupt' });
    assert.ok(ctx.ended, 'two players: the other one wins');
    assert.equal(ctx.ended.results.find(r => r.won).name, ctx.players[q].name);
    assert.equal(st.own[1], undefined);
  });

  test('the short game ends at the first bankruptcy: the richest wins', async () => {
    const { G, ctx, st, t } = await game(3, { length: 'short' });
    assert.equal(Object.keys(st.own).length, 6, 'two free properties each');
    const p = st.turn;
    st.cash[p] = 10; st.pos[p] = 0;
    Object.keys(st.own).forEach(k => { if (st.own[k].p === p) delete st.own[k]; });
    dice(ctx, 2, 2); G.act(ctx, p, { act: 'roll' });
    G.act(ctx, p, { act: 'bankrupt' });
    assert.ok(ctx.ended);
    const rich = [0, 1, 2].filter(q => q !== p).sort((a, b) => t.netWorth(st, b) - t.netWorth(st, a))[0];
    assert.equal(ctx.ended.results.find(r => r.won).name, ctx.players[rich].name);
    assert.equal(ctx.ended.results.find(r => r.name === ctx.players[p].name).note, 'bankrupt');
  });
});

describe('Options', () => {
  test('the Free Parking jackpot and double salary on GO', async () => {
    const { G, ctx, st } = await game(3, { jackpot: 'on', doublego: 'on' });
    const p = st.turn; st.pos[p] = 0; st.cash[p] = 1000;
    dice(ctx, 2, 2); G.act(ctx, p, { act: 'roll' });              // Income Tax into the pot
    assert.equal(st.pot, 200);
    st.step = 'roll'; st.pos[p] = 16;
    dice(ctx, 1, 3); G.act(ctx, p, { act: 'roll' });              // → 20, Free Parking
    assert.equal(st.pot, 0); assert.equal(st.cash[p], 1000);
    st.step = 'roll'; st.pos[p] = 36;
    dice(ctx, 1, 3); G.act(ctx, p, { act: 'roll' });              // → exactly GO
    assert.equal(st.cash[p], 1400, 'passing (200) plus landing (another 200)');
  });

  test('the speed die: the bus, fast forward, triples', async () => {
    const { G, ctx, st } = await game(3, { speed: 'on' });
    const p = st.turn; st.passedGo[p] = true; st.pos[p] = 0;
    dice(ctx, 2, 3, 4); G.act(ctx, p, { act: 'roll' });           // speed die face 4 → SPEED[3]: the bus
    assert.equal(st.step, 'bus');
    G.act(ctx, p, { act: 'bus', use: 'a' });
    assert.equal(st.pos[p], 2);
    st.step = 'roll'; st.pos[p] = 0; st.card = null;
    Object.keys(st.own).forEach(k => delete st.own[k]); own(st, (p + 1) % 3, 6, 8, 9);
    dice(ctx, 1, 3, 5); G.act(ctx, p, { act: 'roll' });            // 4 → Income Tax; then fast forward past the owned light blues
    assert.equal(st.pos[p], 5, 'fast forward: on to the next property nobody owns'); assert.equal(st.step, 'buy');
    st.step = 'roll'; st.pos[p] = 0;
    dice(ctx, 2, 2, 2); G.act(ctx, p, { act: 'roll' });            // triples (2, 2, speed 2)
    assert.equal(st.step, 'triples');
    G.act(ctx, p, { act: 'goto', to: 39 });
    assert.equal(st.pos[p], 39);
  });
});

describe('Trades', () => {
  test('with the active player only: money, properties and cards; refused with buildings in the set; accepted moves everything', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn, q = (p + 1) % 3, r = (p + 2) % 3; st.step = 'main';
    own(st, p, 1); own(st, q, 3, 39); st.own[39].mort = true;
    assert.equal(G.act(ctx, q, { act: 'offer', to: r, gp: '3', wc: 10 }), undefined, 'q may only ask the active player, whoever they name');
    assert.equal(st.trades.length, 1); assert.equal(st.trades[0].to, p, 'a request goes to the active player');
    G.act(ctx, q, { act: 'twithdraw' });
    assert.match(G.act(ctx, p, { act: 'offer', to: q, gc: 100 }), /both sides/);
    G.act(ctx, p, { act: 'offer', to: q, gc: 100, wp: '3,39' });
    G.act(ctx, q, { act: 'treply', id: st.trades[0].id, r: 'accept' });
    assert.equal(st.own[3].p, p); assert.equal(st.own[39].p, p);
    assert.equal(st.cash[p], 1500 - 100 - 20, 'and the 10% on the mortgaged one');
    st.own[1].h = 1; st.own[3].h = 1;
    assert.match(G.act(ctx, p, { act: 'offer', to: q, gp: '1', wc: 10 }), /buildings/);
  });
});

describe('Time per turn and leaving', () => {
  test('time runs out: the game rolls, declines (auction) and ends the turn', async () => {
    const { ctx, st } = await game(3, { turnTime: 60, auctions: 'off' });
    const p = st.turn;
    ctx.expire(); await flush();
    assert.notEqual(st.turn, p); assert.ok(st.turnNo >= 2);
  });

  test('a player leaving counts as bankrupt to the bank; the last one left wins', async () => {
    const { G, ctx, st } = await game(3);
    const p = st.turn, q = (p + 1) % 3;
    own(st, q, 1, 3);
    G.playerLeft(ctx, q);
    assert.ok(st.out[q]); assert.equal(st.step, 'auction', 'their properties go to auction');
    G.playerLeft(ctx, (p + 2) % 3);
    assert.ok(ctx.ended); assert.equal(ctx.ended.results.find(r => r.won).name, ctx.players[p].name);
    assert.ok(ctx.ended.results.find(r => r.name === ctx.players[q].name).left);
  });
});

describe('The open table: showing the boards and voting', () => {
  test('the host flips through the boards; each phone votes once per board (a second tap takes it back)', () => {
    const G = load(), state = {}, opts = { board: 'newyork' }, apiL = { opts, setOpt: (k, v) => { opts[k] = v; } };
    G.lobbyAct(state, { host: true, lobby: 'open' }, apiL);
    assert.equal(state.open, true);
    G.lobbyAct(state, { host: true, lobby: 'next' }, apiL); assert.equal(opts.board, 'mumbai');
    G.lobbyAct(state, { host: true, lobby: 'prev' }, apiL); G.lobbyAct(state, { host: true, lobby: 'prev' }, apiL); assert.equal(opts.board, 'prague', 'wraps around');
    G.lobbyAct(state, { host: true, lobby: 'pick', board: 'tokyo' }, apiL); assert.equal(opts.board, 'tokyo');
    G.lobbyAct(state, { host: false, lobby: 'vote', board: 'rio', device: 'phone-a' }, apiL);
    G.lobbyAct(state, { host: false, lobby: 'vote', board: 'rio', device: 'phone-b' }, apiL);
    G.lobbyAct(state, { host: false, lobby: 'vote', board: 'cairo', device: 'phone-a' }, apiL);
    G.lobbyAct(state, { host: false, lobby: 'vote', board: 'rio', device: 'phone-a' }, apiL);       // taken back
    G.lobbyAct(state, { host: false, lobby: 'pick', board: 'paris' }, apiL);                         // phones can't pick the board
    assert.equal(opts.board, 'tokyo', 'only the host chooses');
    const v = plain(G.lobbyView(state, opts, 'phone-a'));
    assert.deepEqual([v.board, v.votes.rio, v.votes.cairo, v.mine], ['tokyo', 1, 1, ['cairo']]);
    const host = G.lobbyHTML(3, opts, state, { esc: x => String(x), qr: '/api/qr.svg', joinUrl: 'http://x:8080', players: [{ name: 'Ana', color: '#f00' }], canStart: true, min: 2, max: 8 });
    assert.match(host, /class="bz-show"/); assert.match(host, /data-lobby-start /); assert.match(host, /Start on Tokyo/); assert.match(host, /👍 1/); assert.match(host, /api\/qr\.svg/);
    assert.match(G.lobbyHTML(1, opts, state, { esc: x => String(x), canStart: false, min: 2, max: 8 }), /data-lobby-start disabled/);
    const phone = G.lobbyPhoneHTML(v, {}, { esc: x => String(x) });
    assert.equal((phone.match(/data-lobby="vote"/g) || []).length, 12);
    assert.match(phone, /class="on" data-lobby="vote" data-board="cairo"/);
  });

  test('the gavel moments: an auction opening and a sale', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn, q = (p + 1) % 3; st.pos[p] = 35;
    dice(ctx, 1, 3); G.act(ctx, p, { act: 'roll' }); G.act(ctx, p, { act: 'decline' });
    assert.deepEqual([st.fx.kind, st.fx.title, st.fx.sub], ['auction', 'AUCTION', 'Fifth Avenue']);
    const id = st.fx.id;
    G.act(ctx, q, { act: 'bid', add: 100 });
    ctx.expire(); await flush();
    assert.equal(st.fx.kind, 'sold'); assert.equal(st.fx.id, id + 1); assert.match(st.fx.sub, /Fifth Avenue to .* for \$1M/);
  });
});

describe('Screens', () => {
  test('every board draws on the Mac and the phones, in every step', async () => {
    for (const board of T().BOARD_KEYS) {
      const { G, ctx, st } = await game(3, { board, speed: 'on' });
      for (const step of ['roll', 'jail', 'main', 'bus', 'triples']) {
        st.step = step; st.dice = [3, 4]; st.speed = 'bus';
        const host = G.hostHTML(ctx, H);
        assert.match(host, /<svg class="bz-board"/);
        assert.equal((host.match(/data-space="/g) || []).length, 40);
        for (let i = 0; i < 3; i++) assert.ok(G.phoneHTML(plain(G.view(ctx, i)), {}, { ...H, me: i, seats: [] }).length > 500);
      }
    }
  });

  test('the phone: buy box, auction buttons, the debt screen, and the trade builder', async () => {
    const { G, ctx, st } = await game();
    const p = st.turn, q = (p + 1) % 3, HP = { ...H, me: p, seats: [] };
    st.pos[p] = 35; dice(ctx, 1, 3); G.act(ctx, p, { act: 'roll' });
    assert.match(G.phoneHTML(plain(G.view(ctx, p)), {}, HP), /data-act="buy"[^>]*>Buy for \$4M/);
    G.act(ctx, p, { act: 'decline' });
    const auction = G.phoneHTML(plain(G.view(ctx, q)), {}, { ...H, me: q, seats: [] });
    assert.match(auction, /data-act="bid" data-add="10"/); assert.match(auction, />\+\$100k</);
    ctx.expire(); await flush();
    own(st, p, 1);
    // money that just went out glows red, and the amount still shows
    const local = {}; G.phoneHTML(plain(G.view(ctx, p)), local, HP);
    st.flows.push({ id: 999, from: p, to: 'bank', n: 50 });             // a payment, as the game records it
    assert.match(G.phoneHTML(plain(G.view(ctx, p)), local, HP), /<span class="bz-money bz-glow down" style="animation-delay:-\d+ms">\$[\d.]+[kM]?<\/span>/);
    const trade = G.phoneHTML(plain(G.view(ctx, p)), { tab: 'trade' }, HP);
    assert.match(trade, /data-act="offer"/); assert.match(trade, /Coney Island/);
  });
});
