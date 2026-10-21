// Roulette rules (American double-zero wheel), used by roulette.html. No screen code: the page does the drawing,
// animation and voice. Pocket 37 stands for 00.
window.RouletteRules = (() => {
  const ORDER = [0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,37,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2];
  const POCKETS = ORDER.length;
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const lbl = n => n === 37 ? '00' : String(n);
  const isZero = n => n === 0 || n === 37;
  const colorOf = n => isZero(n) ? 'green' : RED.has(n) ? 'red' : 'black';

  // Every bet on the table: its label, what it pays (to 1) and which pockets win it
  const DEFS = {};
  for (let n = 0; n <= 37; n++) DEFS['n' + n] = { label: lbl(n), payout: 35, wins: x => x === n };
  Object.assign(DEFS, {
    red:   { label: 'Red',    payout: 1, wins: x => RED.has(x) },
    black: { label: 'Black',  payout: 1, wins: x => !isZero(x) && !RED.has(x) },
    odd:   { label: 'Odd',    payout: 1, wins: x => !isZero(x) && x % 2 === 1 },
    even:  { label: 'Even',   payout: 1, wins: x => !isZero(x) && x % 2 === 0 },
    low:   { label: '1–18',   payout: 1, wins: x => x >= 1 && x <= 18 },
    high:  { label: '19–36',  payout: 1, wins: x => x >= 19 && x <= 36 },
    d1:    { label: '1st 12', payout: 2, wins: x => x >= 1 && x <= 12 },
    d2:    { label: '2nd 12', payout: 2, wins: x => x >= 13 && x <= 24 },
    d3:    { label: '3rd 12', payout: 2, wins: x => x >= 25 && x <= 36 },
    c1:    { label: '2 to 1', payout: 2, wins: x => !isZero(x) && x % 3 === 1 },
    c2:    { label: '2 to 1', payout: 2, wins: x => !isZero(x) && x % 3 === 2 },
    c3:    { label: '2 to 1', payout: 2, wins: x => !isZero(x) && x % 3 === 0 },
  });

  // The ball lands on n: for each player, what they staked and what comes back (stake included).
  // bets: [{ p: player index, key, amt }]
  function settle(bets, n, players) {
    const sum = [...Array(players)].map(() => ({ staked: 0, returned: 0 }));
    for (const b of bets) {
      sum[b.p].staked += b.amt;
      if (DEFS[b.key].wins(n)) sum[b.p].returned += b.amt * (DEFS[b.key].payout + 1);
    }
    return sum;
  }

  return { ORDER, POCKETS, RED, lbl, isZero, colorOf, DEFS, settle };
})();
