// Dragon Tiger for the Casino table engine: one card to Dragon, one to Tiger, the higher card wins.
window.GAME = (() => {
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const rank = c => RANKS.indexOf(c.r) + 1;                 // Ace low (1) … King high (13)
  const NAMES = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  const say = c => NAMES[c.r] || c.r;
  let shoe = [];
  function newShoe(rand) {
    const s = [];
    for (let d = 0; d < 8; d++) for (const su of SUITS) for (const r of RANKS) s.push({ r, s: su });
    for (let i = s.length - 1; i > 0; i--) { const j = rand(i + 1); [s[i], s[j]] = [s[j], s[i]]; }
    return s;
  }
  return {
    id: 'dragontiger', name: 'Dragon Tiger', verb: 'deal', minBet: 5,
    tagline: 'One card to the Dragon, one to the Tiger. Higher card wins: Ace is low, King is high.',
    bets: [
      { key: 'dragon', label: '🐉 Dragon', sub: '1:1', row: 0, cls: 'b-red big' },
      { key: 'tie', label: 'Tie', sub: '8:1', row: 0, cls: 'b-green' },
      { key: 'tiger', label: '🐯 Tiger', sub: '1:1', row: 0, cls: 'b-orange big' },
    ],
    rowHeights: ['96px'],
    payouts: [
      ['Dragon', "Dragon's card is higher", '1:1', 1, '≈ 46.3%'],
      ['Tiger', "Tiger's card is higher", '1:1', 1, '≈ 46.3%'],
      ['Tie', 'Both cards have the same rank. Dragon and Tiger bets lose half.', '8:1', 8, '≈ 7.5%'],
    ],
    rules: [
      '<b>Goal:</b> bet on which side gets the higher card: <b>Dragon</b> or <b>Tiger</b>, or a <b>Tie</b>.',
      '<b>Card ranks:</b> Ace is lowest (1), then 2–10, Jack, Queen, King highest. Suits don\'t matter.',
      '<b>Payouts:</b> Dragon or Tiger 1:1 · Tie 8:1. On a tie, Dragon and Tiger bets lose only half their stake.',
      '<b>Shoe:</b> 8 decks, reshuffled when it runs low. Rounds are quick: one card each.',
    ],
    reset(rand) { shoe = newShoe(rand); },
    idleStage: () => ({ dragon: null, tiger: null }),
    async play(ctx) {
      if (shoe.length < 30) { shoe = newShoe(ctx.rand); await ctx.say('Shuffling a fresh shoe.', 'sweep'); }
      const d = shoe.pop(); ctx.setStage({ dragon: d, tiger: null }); await ctx.wait(900);
      const t = shoe.pop(); ctx.setStage({ dragon: d, tiger: t }); await ctx.wait(700);
      const o = { winner: rank(d) > rank(t) ? 'dragon' : rank(t) > rank(d) ? 'tiger' : 'tie', d, t };
      ctx.setStage({ dragon: d, tiger: t, winner: o.winner });
      return o;
    },
    settle(key, amt, o) {
      if (key === 'tie') return o.winner === 'tie' ? amt * 9 : 0;
      if (o.winner === 'tie') return amt / 2;                // Dragon/Tiger lose half on a tie
      return o.winner === key ? amt * 2 : 0;
    },
    announce: o => o.winner === 'tie' ? `Tie! ${say(o.d)} and ${say(o.t)}.` : `${o.winner === 'dragon' ? 'Dragon' : 'Tiger'} wins, ${say(o.winner === 'dragon' ? o.d : o.t)} over ${say(o.winner === 'dragon' ? o.t : o.d)}.`,
    token: o => ({ text: o.winner === 'dragon' ? 'D' : o.winner === 'tiger' ? 'T' : '=', cls: o.winner === 'dragon' ? 'tok-red' : o.winner === 'tiger' ? 'tok-orange' : 'tok-green', tip: `Dragon ${o.d.r} · Tiger ${o.t.r}`, group: o.winner === 'dragon' ? 'Dragon' : o.winner === 'tiger' ? 'Tiger' : 'Tie' }),
    stageHTML(st, h) {
      const side = (label, c, cls, win) => `<div class="dt-side ${cls}${win ? ' win' : ''}"><div class="dt-label">${label}</div><div class="cards dt-card">${c ? h.card(c) : '<div class="card-slot"></div>'}</div></div>`;
      return `<div class="dt-stage">${side('🐉 DRAGON', st.dragon, 'dt-d', st.winner === 'dragon')}<div class="dt-vs">VS</div>${side('🐯 TIGER', st.tiger, 'dt-t', st.winner === 'tiger')}</div>
        <div class="stage-note">${st.winner === 'tie' ? 'Tie!' : ''}</div>`;
    },
    css: `
      .dt-stage { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; width: 100%; }
      .dt-side { border-radius: 14px; padding: 12px; text-align: center; border: 2px solid transparent; }
      .dt-d { background: rgba(192,38,45,.2); } .dt-t { background: rgba(234,88,12,.2); }
      .dt-side.win { border-color: var(--gold); box-shadow: 0 0 22px rgba(212,175,55,.6); }
      .dt-label { font-family: Georgia, serif; letter-spacing: .2em; color: var(--gold); margin-bottom: 8px; }
      .dt-vs { font-family: Georgia, serif; font-weight: 900; color: var(--gold); font-size: 1.4rem; }
      .dt-card { --cw: 84px; --ch: 120px; }`,
  };
})();
