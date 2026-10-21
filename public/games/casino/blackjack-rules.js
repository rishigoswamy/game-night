// Blackjack rules, used by blackjack.html. No screen code: the page deals with animation, voice and the order of play.
// Cards are { r: rank, s: suit, down? }; a hand is { cards, bet, split?, done? }.
// House rules: dealer stands on all 17s and checks for blackjack with an Ace or 10 showing; blackjack pays 3:2;
// one split per hand; split Aces get one card each; double on any first two cards (not on split Aces).
window.BlackjackRules = (() => {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

  // A shuffled shoe of `decks` decks; randInt(n) gives 0..n-1
  function newShoe(decks, randInt) {
    const shoe = [];
    for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s });
    for (let i = shoe.length - 1; i > 0; i--) { const j = randInt(i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
    return shoe;
  }
  const cardVal = c => c.r === 'A' ? 11 : 'JQK'.includes(c.r) || c.r === '10' ? 10 : +c.r;
  // Best total; face-down cards are skipped unless `all` is set. soft: an Ace still counts 11.
  function handTotal(cards, all = false) {
    let t = 0, aces = 0;
    for (const c of cards) {
      if (c.down && !all) continue;
      t += cardVal(c);
      if (c.r === 'A') aces++;
    }
    while (t > 21 && aces) { t -= 10; aces--; }
    return { t, soft: aces > 0 };
  }
  // A two-card 21 that didn't come from a split
  const isBlackjack = h => h.cards.length === 2 && !h.split && handTotal(h.cards, true).t === 21;
  const isDealerBlackjack = cards => cards.length === 2 && handTotal(cards, true).t === 21;
  function totalLabel(cards) {
    const { t, soft } = handTotal(cards);
    if (t > 21) return `Bust ${t}`;
    return soft && t < 21 ? `${t - 10} / ${t}` : String(t);
  }
  const spokenTotal = cards => { const { t, soft } = handTotal(cards); return soft && t < 21 ? `soft ${t}` : String(t); };

  // bal: the player's chips not on the table; hands: how many hands they have this round
  const canDouble = (h, bal) => h && h.cards.length === 2 && !h.done && !(h.split && h.cards[0].r === 'A') && bal >= h.bet;
  const canSplit = (h, hands, bal) => h && h.cards.length === 2 && !h.split && hands === 1
    && cardVal(h.cards[0]) === cardVal(h.cards[1]) && bal >= h.bet;
  const isSplitAces = h => h.cards[0].r === 'A';                        // after a split: one card each, no more
  const dealerChecksForBlackjack = upcard => cardVal(upcard) >= 10;    // Ace or a 10-value card showing
  const dealerHits = total => total < 17;                              // stands on all 17s, soft or hard

  // The end of the round: this hand's outcome and its net win/loss (hands already bust keep their result)
  function result(h, dealerCards) {
    if (h.outcome) return { outcome: h.outcome, net: h.net };
    const d = handTotal(dealerCards, true).t, dBJ = isDealerBlackjack(dealerCards);
    const t = handTotal(h.cards, true).t, bj = isBlackjack(h);
    let outcome;
    if (bj && dBJ) outcome = 'push';
    else if (bj) outcome = 'bj';
    else if (dBJ) outcome = 'lose';
    else if (d > 21 || t > d) outcome = 'win';
    else if (t === d) outcome = 'push';
    else outcome = 'lose';
    const net = outcome === 'bj' ? h.bet * 1.5 : outcome === 'win' ? h.bet : outcome === 'push' ? 0 : -h.bet;
    return { outcome, net };
  }
  // Chips that come back to the player for a settled hand (stake included)
  const returned = h => h.outcome === 'lose' || h.outcome === 'bust' ? 0 : h.bet + h.net;

  return { SUITS, RANKS, newShoe, cardVal, handTotal, isBlackjack, isDealerBlackjack, totalLabel, spokenTotal,
    canDouble, canSplit, isSplitAces, dealerChecksForBlackjack, dealerHits, result, returned };
})();
