// Sic Bo for the Casino table engine: three dice, bet on totals, numbers, doubles and triples.
window.GAME = (() => {
  // Total → payout ratio (standard Macau table)
  const TOTAL_PAYS = { 4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 17, 16: 30, 17: 60 };
  // How many of the 216 rolls give each total (for "how often")
  const WAYS = { 4: 3, 5: 6, 6: 10, 7: 15, 8: 21, 9: 25, 10: 27, 11: 27, 12: 25, 13: 21, 14: 15, 15: 10, 16: 6, 17: 3 };
  const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const pct = n => '≈ ' + (n * 100).toFixed(n < .01 ? 2 : 1) + '%';
  const bets = [
    { key: 'small', label: 'Small', sub: '4–10 · 1:1', row: 0, span: 3, cls: 'b-blue big' },
    { key: 'odd', label: 'Odd', sub: '1:1', row: 0, span: 2, cls: 'b-dark' },
    { key: 'anytriple', label: 'Any Triple', sub: '30:1', row: 0, span: 2, cls: 'b-gold' },
    { key: 'even', label: 'Even', sub: '1:1', row: 0, span: 2, cls: 'b-dark' },
    { key: 'big', label: 'Big', sub: '11–17 · 1:1', row: 0, span: 3, cls: 'b-red big' },
  ];
  for (let t = 4; t <= 17; t++) bets.push({ key: 't' + t, label: String(t), sub: TOTAL_PAYS[t] + ':1', row: 1, span: t === 4 || t === 17 ? 1 : 1, cls: 'b-green num' });
  for (let d = 1; d <= 6; d++) bets.push({ key: 'd' + d, label: FACES[d] + FACES[d], sub: 'Double 10:1', row: 2, span: 2, cls: 'b-dark dice' });
  for (let d = 1; d <= 6; d++) bets.push({ key: 'tr' + d, label: FACES[d] + FACES[d] + FACES[d], sub: '180:1', row: 3, span: 2, cls: 'b-gold dice' });
  for (let d = 1; d <= 6; d++) bets.push({ key: 's' + d, label: FACES[d], sub: '1:1 · 2:1 · 3:1', row: 4, span: 2, cls: 'b-blue dice big-die' });
  const name = (n) => ['', 'one', 'two', 'three', 'four', 'five', 'six'][n];
  return {
    id: 'sicbo', name: 'Sic Bo', verb: 'roll', minBet: 5, columns: 12,
    tagline: 'Three dice. Bet on Big or Small, the total, a number, a double or a triple.',
    bets,
    rowHeights: ['64px', '52px', '50px', '50px', '58px'],
    payouts: [
      ['Small / Big', 'Total 4–10 / 11–17, and not a triple', '1:1', 1, pct(105 / 216)],
      ['Odd / Even', 'Total is odd / even, and not a triple', '1:1', 1, pct(105 / 216)],
      ['Single number', 'Your number shows on 1 / 2 / 3 dice', '1:1 · 2:1 · 3:1', 1, pct(91 / 216)],
      ['Total 4 or 17', 'The three dice add up to it', '60:1', 60, pct(3 / 216)],
      ['Total 5 or 16', '', '30:1', 30, pct(6 / 216)],
      ['Total 6 or 15', '', '17:1', 17, pct(10 / 216)],
      ['Total 7 or 14', '', '12:1', 12, pct(15 / 216)],
      ['Total 8 or 13', '', '8:1', 8, pct(21 / 216)],
      ['Total 9–12', '', '6:1', 6, pct(25 / 216) + '–' + (27 / 216 * 100).toFixed(1) + '%'],
      ['Specific double', 'At least two dice show that number', '10:1', 10, pct(16 / 216)],
      ['Any triple', 'All three dice the same', '30:1', 30, pct(6 / 216)],
      ['Specific triple', 'All three dice show that number', '180:1', 180, pct(1 / 216)],
    ],
    rules: [
      '<b>The roll:</b> the dealer shakes three dice. Bet on what they show.',
      '<b>Small / Big:</b> total 4–10 or 11–17. <b>Odd / Even</b> on the total. All four <b>lose on any triple</b>. Pays 1:1.',
      '<b>Totals:</b> bet on an exact total 4–17; rarer totals pay more (4 or 17 pays 60:1).',
      '<b>Single number:</b> pays 1:1 if it shows on one die, 2:1 on two dice, 3:1 on all three.',
      '<b>Doubles and triples:</b> a specific double (at least two dice) pays 10:1, any triple 30:1, a specific triple 180:1.',
    ],
    reset() {},
    idleStage: () => ({ dice: null }),
    async play(ctx) {
      const dice = [1 + ctx.rand(6), 1 + ctx.rand(6), 1 + ctx.rand(6)];
      ctx.setStage({ rolling: true, dice: [1 + ctx.rand(6), 1 + ctx.rand(6), 1 + ctx.rand(6)] });
      ctx.sfx('dice');
      for (let k = 0; k < 8; k++) { await ctx.wait(160); ctx.setStage({ rolling: true, dice: [1 + ctx.rand(6), 1 + ctx.rand(6), 1 + ctx.rand(6)] }); }
      const total = dice[0] + dice[1] + dice[2], triple = dice[0] === dice[1] && dice[1] === dice[2];
      ctx.setStage({ dice, total, triple });
      await ctx.wait(500);
      return { dice, total, triple };
    },
    settle(key, amt, o) {
      const { dice, total, triple } = o, count = n => dice.filter(d => d === n).length;
      if (key === 'small') return !triple && total <= 10 ? amt * 2 : 0;
      if (key === 'big') return !triple && total >= 11 ? amt * 2 : 0;
      if (key === 'odd') return !triple && total % 2 ? amt * 2 : 0;
      if (key === 'even') return !triple && total % 2 === 0 ? amt * 2 : 0;
      if (key === 'anytriple') return triple ? amt * 31 : 0;
      if (key[0] === 't' && key[1] !== 'r') return total === +key.slice(1) ? amt * (TOTAL_PAYS[total] + 1) : 0;
      if (key.startsWith('tr')) return triple && dice[0] === +key.slice(2) ? amt * 181 : 0;
      if (key[0] === 'd') return count(+key.slice(1)) >= 2 ? amt * 11 : 0;
      if (key[0] === 's') { const c = count(+key.slice(1)); return c ? amt * (c + 1) : 0; }
      return 0;
    },
    announce: o => o.triple ? `Triple ${name(o.dice[0])}s! Total ${o.total}.` : `${o.dice.join(', ')}. Total ${o.total}, ${o.total <= 10 ? 'small' : 'big'}.`,
    special: o => o.triple ? { big: o.dice.join(' '), label: 'TRIPLE', sub: 'Any Triple pays 30:1 · this triple 180:1' } : null,
    token: o => ({ text: String(o.total), cls: o.triple ? 'tok-gold' : o.total <= 10 ? 'tok-blue' : 'tok-red', tip: o.dice.join(' · ') + (o.triple ? ' · Triple!' : ''), group: o.triple ? 'Triple' : o.total <= 10 ? 'Small' : 'Big' }),
    stageHTML(st, h) {
      const dice = st.dice || [0, 0, 0];
      return `<div class="sb-stage${st.rolling ? ' rolling' : ''}">${dice.map((d, k) => h.die(d, k)).join('')}</div>
        <div class="stage-note">${st.total ? `Total <b>${st.total}</b> · ${st.triple ? 'TRIPLE!' : st.total <= 10 ? 'Small' : 'Big'}` : st.rolling ? 'Rolling…' : 'Place your bets'}</div>`;
    },
    css: `
      .sb-stage { display: flex; gap: 18px; justify-content: center; padding: 6px 0; }
      .board .b-cell.num .lbl { font-size: 1.15rem; }
      .board .b-cell.dice .lbl { font-size: 1.5rem; letter-spacing: -2px; line-height: 1; }
      .board .b-cell.big-die .lbl { font-size: 2rem; }`,
  };
})();
