// Shared helpers for the party games (loaded on the Mac and on the phones before the game module)
const PartyKit = (() => {
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const NAMES = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  const rankName = (r, n = 1) => { const w = NAMES[r] || r; return n === 1 ? w : (w === '6' ? 'sixes' : w + 's'); };
  const deck = () => SUITS.flatMap(s => RANKS.map(r => ({ r, s })));
  const sortCards = cards => cards.slice().sort((a, b) => RANKS.indexOf(a.r) - RANKS.indexOf(b.r) || SUITS.indexOf(a.s) - SUITS.indexOf(b.s));
  const red = c => c.s === '♥' || c.s === '♦';
  // A face-up card; `attrs` adds attributes (data-…) and `cls` extra classes
  function cardHTML(c, { attrs = '', cls = '' } = {}) {
    const pip = 'JQK'.includes(c.r) ? `<span class="court">${c.r}</span>` : c.s;
    return `<div class="pcard ${cls}" ${attrs}><div class="face${red(c) ? ' red' : ''}"><span class="corner tl">${c.r}<br>${c.s}</span><span class="pip">${pip}</span><span class="corner br">${c.r}<br>${c.s}</span></div></div>`;
  }
  const backHTML = (cls = '') => `<div class="pcard back ${cls}"></div>`;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return { SUITS, RANKS, rankName, deck, sortCards, cardHTML, backHTML, esc };
})();
