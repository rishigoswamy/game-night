// Baccarat (Punto Banco) for the Casino table engine.
// Everyone bets on Player, Banker or Tie (plus pair side bets); the dealer draws by the fixed tableau.
window.GAME = (() => {
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const val = r => r === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(r) ? 0 : +r;
  const total = cards => cards.reduce((a, c) => a + val(c.r), 0) % 10;
  let shoe = [];
  function newShoe(rand) {
    const s = [];
    for (let d = 0; d < 8; d++) for (const su of SUITS) for (const r of RANKS) s.push({ r, s: su });
    for (let i = s.length - 1; i > 0; i--) { const j = rand(i + 1); [s[i], s[j]] = [s[j], s[i]]; }
    return s;
  }
  // The banker's third-card rule, given the banker's total and the player's third card (or null if the player stood)
  function bankerDraws(b, third) {
    if (third == null) return b <= 5;
    const t = val(third.r);
    if (b <= 2) return true;
    if (b === 3) return t !== 8;
    if (b === 4) return t >= 2 && t <= 7;
    if (b === 5) return t >= 4 && t <= 7;
    if (b === 6) return t === 6 || t === 7;
    return false;
  }
  return {
    id: 'baccarat', name: 'Baccarat', verb: 'deal', minBet: 5,
    tagline: 'Bet on Player, Banker or Tie. The dealer draws by the rules; closest to 9 wins.',
    bets: [
      { key: 'ppair', label: 'Player Pair', sub: '11:1', row: 0, cls: 'b-blue' },
      { key: 'tie', label: 'Tie', sub: '8:1', row: 0, cls: 'b-green' },
      { key: 'bpair', label: 'Banker Pair', sub: '11:1', row: 0, cls: 'b-red' },
      { key: 'player', label: 'Player', sub: '1:1', row: 1, cls: 'b-blue big' },
      { key: 'banker', label: 'Banker', sub: '0.95:1', row: 1, cls: 'b-red big' },
    ],
    rowHeights: ['58px', '84px'],
    payouts: [
      ['Player', 'Player hand is closer to 9', '1:1', 1, '≈ 44.6%'],
      ['Banker', 'Banker hand is closer to 9 (5% commission on wins)', '0.95:1', .95, '≈ 45.9%'],
      ['Tie', 'Both hands have the same total. Player and Banker bets push (returned).', '8:1', 8, '≈ 9.5%'],
      ['Player Pair', "Player's first two cards are the same rank", '11:1', 11, '≈ 7.5%'],
      ['Banker Pair', "Banker's first two cards are the same rank", '11:1', 11, '≈ 7.5%'],
    ],
    rules: [
      '<b>Goal:</b> bet on which hand ends closer to <b>9</b>: Player or Banker, or a Tie. You don\'t play the hands; the dealer draws by fixed rules.',
      '<b>Card values:</b> Ace = 1, 2–9 face value, 10/J/Q/K = 0. Only the last digit counts (7 + 8 = 15 → 5).',
      '<b>The deal:</b> two cards each. An 8 or 9 is a <b>natural</b> and nobody draws. Otherwise the Player draws on 0–5, and the Banker draws by the standard tableau.',
      '<b>Payouts:</b> Player 1:1 · Banker 0.95:1 (5% commission) · Tie 8:1 (Player/Banker bets are returned on a tie) · Pairs 11:1.',
      '<b>Shoe:</b> 8 decks, reshuffled when it runs low.',
    ],
    reset(rand) { shoe = newShoe(rand); },
    idleStage: () => ({ player: [], banker: [] }),
    async play(ctx) {
      if (shoe.length < 60) { shoe = newShoe(ctx.rand); await ctx.say('Shuffling a fresh shoe.', 'sweep'); }
      const P = [], B = [];
      const show = extra => ctx.setStage({ player: [...P], banker: [...B], pt: P.length ? total(P) : null, bt: B.length ? total(B) : null, ...extra });
      for (const hand of [P, B, P, B]) { hand.push(shoe.pop()); show(); await ctx.wait(650); }
      let third = null;
      if (total(P) < 8 && total(B) < 8) {
        if (total(P) <= 5) { third = shoe.pop(); P.push(third); show({ note: 'Player draws' }); await ctx.wait(800); }
        if (bankerDraws(total(B), third)) { B.push(shoe.pop()); show({ note: 'Banker draws' }); await ctx.wait(800); }
      }
      const pt = total(P), bt = total(B);
      const o = { winner: pt > bt ? 'player' : bt > pt ? 'banker' : 'tie', pt, bt,
        natural: (P.length === 2 && B.length === 2) && (pt >= 8 || bt >= 8),
        ppair: P[0].r === P[1].r, bpair: B[0].r === B[1].r };
      show({ winner: o.winner });
      return o;
    },
    settle(key, amt, o) {
      switch (key) {
        case 'player': return o.winner === 'player' ? amt * 2 : o.winner === 'tie' ? amt : 0;
        case 'banker': return o.winner === 'banker' ? amt * 1.95 : o.winner === 'tie' ? amt : 0;
        case 'tie': return o.winner === 'tie' ? amt * 9 : 0;
        case 'ppair': return o.ppair ? amt * 12 : 0;
        case 'bpair': return o.bpair ? amt * 12 : 0;
      }
      return 0;
    },
    announce(o) {
      const main = o.winner === 'tie' ? `Tie, ${o.pt} each.` : `${o.winner === 'player' ? 'Player' : 'Banker'} wins, ${Math.max(o.pt, o.bt)} to ${Math.min(o.pt, o.bt)}.`;
      return main + (o.natural ? ' A natural!' : '') + (o.ppair ? ' Player pair!' : '') + (o.bpair ? ' Banker pair!' : '');
    },
    token: o => ({ text: o.winner === 'player' ? 'P' : o.winner === 'banker' ? 'B' : 'T', cls: o.winner === 'player' ? 'tok-blue' : o.winner === 'banker' ? 'tok-red' : 'tok-green', tip: `Player ${o.pt} · Banker ${o.bt}`, group: o.winner === 'player' ? 'Player' : o.winner === 'banker' ? 'Banker' : 'Tie' }),
    stageHTML(st, h) {
      const side = (label, cards, t, cls, win) => `<div class="bac-side ${cls}${win ? ' win' : ''}"><div class="bac-label">${label}${t != null ? ` <b>${t}</b>` : ''}</div><div class="cards">${cards.map(h.card).join('') || '<div class="card-slot"></div>'}</div></div>`;
      return `<div class="bac-stage">${side('PLAYER', st.player, st.pt, 'bac-p', st.winner === 'player')}${side('BANKER', st.banker, st.bt, 'bac-b', st.winner === 'banker')}</div>
        <div class="stage-note">${st.winner === 'tie' ? 'Tie!' : st.note || ''}</div>`;
    },
    css: `
      .bac-stage { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; width: 100%; }
      .bac-side { border-radius: 14px; padding: 10px; text-align: center; border: 2px solid transparent; }
      .bac-p { background: rgba(37,99,235,.18); } .bac-b { background: rgba(192,38,45,.18); }
      .bac-side.win { border-color: var(--gold); box-shadow: 0 0 22px rgba(212,175,55,.6); }
      .bac-label { font-family: Georgia, serif; letter-spacing: .2em; color: var(--gold); margin-bottom: 8px; }
      .bac-label b { display: inline-grid; place-items: center; min-width: 30px; height: 30px; border-radius: 50%; background: #fffdf5; color: #1b1b1b; letter-spacing: 0; margin-left: 6px; }`,
  };
})();
