// Craps (simplified) for the Casino table engine.
// Each round is one Pass Line decision: the come-out roll, then (if a point is set) rolls until the point or a 7.
window.GAME = (() => {
  const SAY = { 2: 'Two, craps', 3: 'Three, craps', 7: 'Seven', 11: 'Yo eleven', 12: 'Twelve, craps' };
  const pct = n => '≈ ' + (n * 100).toFixed(1) + '%';
  return {
    id: 'craps', name: 'Craps', verb: 'roll', minBet: 5, columns: 6,
    tagline: 'Pass or Don\'t Pass: the dealer rolls the come-out, then rolls for the point.',
    bets: [
      { key: 'pass', label: 'Pass Line', sub: '1:1', row: 0, span: 3, cls: 'b-blue big' },
      { key: 'dontpass', label: "Don't Pass", sub: '1:1 · 12 pushes', row: 0, span: 3, cls: 'b-dark big' },
      { key: 'field', label: 'Field', sub: '2,3,4,9,10,11,12 · 2 & 12 pay 2:1', row: 1, span: 6, cls: 'b-green' },
      { key: 'any7', label: 'Any 7', sub: '4:1', row: 2, span: 2, cls: 'b-red' },
      { key: 'anycraps', label: 'Any Craps', sub: '2,3,12 · 7:1', row: 2, span: 2, cls: 'b-red' },
      { key: 'yo', label: 'Yo 11', sub: '15:1', row: 2, span: 2, cls: 'b-red' },
    ],
    rowHeights: ['80px', '58px', '58px'],
    payouts: [
      ['Pass Line', 'Come-out 7 or 11; or a point is set and rolled again before a 7', '1:1', 1, pct(.4929)],
      ["Don't Pass", 'Come-out 2 or 3; or a 7 comes before the point. A come-out 12 pushes.', '1:1', 1, pct(.4793)],
      ['Field', 'Come-out roll is 3, 4, 9, 10 or 11 (pays 1:1); 2 or 12 (pays 2:1)', '1:1 / 2:1', 1, pct(16 / 36)],
      ['Any 7', 'Come-out roll is a 7', '4:1', 4, pct(6 / 36)],
      ['Any Craps', 'Come-out roll is 2, 3 or 12', '7:1', 7, pct(4 / 36)],
      ['Yo 11', 'Come-out roll is an 11', '15:1', 15, pct(2 / 36)],
    ],
    rules: [
      '<b>Simplified craps:</b> each round is one complete Pass Line decision. Bets are placed before the come-out roll; the dealer rolls for the whole table.',
      '<b>Come-out roll:</b> 7 or 11 → Pass wins. 2, 3 or 12 (craps) → Pass loses; Don\'t Pass wins on 2 or 3 and pushes on 12.',
      '<b>The point:</b> any other total (4, 5, 6, 8, 9, 10) becomes the point. The dealer keeps rolling: the point again → Pass wins; a 7 first → Don\'t Pass wins.',
      '<b>One-roll bets</b> (Field, Any 7, Any Craps, Yo 11) are settled on the come-out roll only.',
    ],
    reset() {},
    idleStage: () => ({ dice: null, point: null, rolls: [] }),
    async play(ctx) {
      const rolls = [];
      let point = null;
      const roll = async () => {
        ctx.sfx('dice');
        for (let k = 0; k < 6; k++) { ctx.setStage({ rolling: true, dice: [1 + ctx.rand(6), 1 + ctx.rand(6)], point, rolls: [...rolls] }); await ctx.wait(150); }
        const d = [1 + ctx.rand(6), 1 + ctx.rand(6)], t = d[0] + d[1];
        rolls.push(t);
        ctx.setStage({ dice: d, total: t, point, rolls: [...rolls] });
        return { d, t };
      };
      const first = await roll();
      const come = first.t;
      if ([7, 11, 2, 3, 12].includes(come)) {
        await ctx.say(`${SAY[come]}!`, come === 7 || come === 11 ? 'happy' : 'sad');
      } else {
        point = come;
        ctx.setStage({ dice: first.d, total: come, point, rolls: [...rolls] });
        await ctx.say(`The point is ${come}.`, 'point');
        for (;;) {
          await ctx.wait(700);
          const r = await roll();
          if (r.t === point) { await ctx.say(`${point}! The point is made.`, 'happy'); break; }
          if (r.t === 7) { await ctx.say('Seven out!', 'sad'); break; }
          ctx.say(String(r.t), null, true);
        }
      }
      const last = rolls[rolls.length - 1];
      const passWins = point ? last === point : come === 7 || come === 11;
      const o = { come, point, last, rolls, pass: passWins ? 'win' : 'lose',
        dont: point ? (passWins ? 'lose' : 'win') : (come === 12 ? 'push' : [2, 3].includes(come) ? 'win' : 'lose') };
      ctx.setStage({ dice: ctx.stage.dice, total: last, point, rolls, done: o.pass });
      return o;
    },
    settle(key, amt, o) {
      const c = o.come;
      switch (key) {
        case 'pass': return o.pass === 'win' ? amt * 2 : 0;
        case 'dontpass': return o.dont === 'win' ? amt * 2 : o.dont === 'push' ? amt : 0;
        case 'field': return c === 2 || c === 12 ? amt * 3 : [3, 4, 9, 10, 11].includes(c) ? amt * 2 : 0;
        case 'any7': return c === 7 ? amt * 5 : 0;
        case 'anycraps': return [2, 3, 12].includes(c) ? amt * 8 : 0;
        case 'yo': return c === 11 ? amt * 16 : 0;
      }
      return 0;
    },
    announce: o => o.point ? (o.pass === 'win' ? `Point ${o.point} made. Pass Line wins!` : `Seven out. Don't Pass wins!`)
      : (o.pass === 'win' ? `${o.come} on the come-out. Pass Line wins!` : o.come === 12 ? "Craps twelve. Don't Pass pushes." : `Craps ${o.come}. Don't Pass wins!`),
    token: o => ({ text: o.point ? String(o.point) : String(o.come), cls: o.pass === 'win' ? 'tok-blue' : 'tok-dark', tip: (o.point ? `Point ${o.point} · ${o.rolls.length} rolls` : `Come-out ${o.come}`) + (o.pass === 'win' ? ' · Pass won' : o.dont === 'push' ? ' · push' : " · Don't Pass won"), group: o.pass === 'win' ? 'Pass' : o.dont === 'push' ? 'Push (12)' : "Don't Pass" }),
    stageHTML(st, h) {
      const dice = st.dice || [0, 0];
      return `<div class="cr-stage">
          <div class="cr-puck${st.point ? ' on' : ''}">${st.point ? 'ON<b>' + st.point + '</b>' : 'OFF'}</div>
          <div class="sb-stage${st.rolling ? ' rolling' : ''}">${dice.map((d, k) => h.die(d, k)).join('')}</div>
          <div class="cr-rolls">${(st.rolls || []).slice(-10).map(t => `<span class="${t === 7 ? 'r7' : t === st.point ? 'rp' : ''}">${t}</span>`).join('')}</div>
        </div>
        <div class="stage-note">${st.total ? `Rolled <b>${st.total}</b>` : st.rolling ? 'Rolling…' : 'Come-out roll next'}${st.point ? ` · point ${st.point}` : ''}</div>`;
    },
    css: `
      .cr-stage { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; width: 100%; }
      .sb-stage { display: flex; gap: 18px; justify-content: center; padding: 6px 0; }
      .cr-puck { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; align-content: center; font-weight: 900; font-size: .8rem;
        background: #1b1b1b; color: #fff; border: 3px solid #fff; letter-spacing: .1em; }
      .cr-puck.on { background: #fffdf5; color: #1b1b1b; box-shadow: 0 0 16px rgba(255,255,255,.6); }
      .cr-puck b { font-size: 1.4rem; letter-spacing: 0; line-height: 1; }
      .cr-rolls { display: flex; flex-wrap: wrap; gap: 4px; max-width: 160px; justify-content: flex-end; }
      .cr-rolls span { min-width: 24px; height: 24px; border-radius: 12px; display: grid; place-items: center; font-size: .75rem; font-weight: 800; background: rgba(0,0,0,.35); }
      .cr-rolls .r7 { background: #c0262d; } .cr-rolls .rp { background: var(--gold); color: #1b1b1b; }
      @media (max-width: 520px) { .cr-stage { grid-template-columns: auto 1fr; } .cr-rolls { grid-column: 1 / -1; max-width: none; justify-content: center; } }`,
  };
})();
