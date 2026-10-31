// Bluff (also called Cheat or I Doubt It), Indian style: whoever leads a round names a rank; each next player adds cards
// face down claiming that rank (true or not), passes, or calls "Bluff!". The winner of a challenge leads the next round;
// if everyone passes back to the last player who played, the pile is set aside and that player leads.
window.PARTY_GAME = (() => {
  const K = PartyKit, RANKS = K.RANKS;
  const id = c => `${c.r}|${c.s}`;
  // Claims in words, so the number of cards and the rank can't run together ("3 7s" reads as "three Sevens")
  const WORD = { A: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', J: 'Jack', Q: 'Queen', K: 'King' };
  const COUNT = ['no', 'one', 'two', 'three', 'four'];
  const rankWord = (r, n = 2) => (n === 1 ? WORD[r] : r === '6' ? 'Sixes' : WORD[r] + 's');
  const many = (n, r) => `${COUNT[n] || n} ${rankWord(r, n)}`;
  // …and as a picture: the number of cards in a circle, the rank on a card
  const claimHTML = (n, r) => `<span class="bl-claim"><span class="bl-n">${n}</span><span class="bl-x">×</span><span class="bl-r">${r}</span><span class="bl-w">${many(n, r)}</span></span>`;
  const FRESH_MS = 3000;                                        // cards just picked up glow this long on the taker's phone

  const nextSeat = (ctx, from) => (from + 1) % ctx.players.length;
  const win = (ctx, p) => {
    const st = ctx.state;
    ctx.log(`🏁 ${ctx.players[p].name} played their last card.`);
    ctx.say(`${ctx.players[p].name} is out of cards and wins!`, 'pay');
    ctx.end(ctx.players.map((pl, i) => ({ name: pl.name, won: i === p, note: `${st.hands[i].length} cards left` })));
  };
  function newRound(ctx, lead, why) {
    const st = ctx.state;
    st.round = { rank: null, lead, last: null, passed: [] };
    st.claim = null; st.reveal = null; st.lastClaim = null; st.phase = 'play'; st.turn = lead;
    ctx.update();
    ctx.say(`${why ? why + ' ' : ''}${ctx.players[lead].name}, start a new round: pick a rank and play.`);
  }
  // Nobody called in time: the claimant wins if that was their last card; otherwise the next player adds, passes or calls
  function settle(ctx) {
    const st = ctx.state, c = st.claim;
    if (!st.hands[c.by].length) return win(ctx, c.by);
    st.round.last = c.by; st.round.passed = [];
    st.lastClaim = { by: c.by, count: c.count, rank: c.rank };
    st.claim = null; st.phase = 'play';
    st.turn = nextSeat(ctx, c.by);
    ctx.update();
    ctx.say(`${ctx.players[st.turn].name}: add ${rankWord(st.round.rank)}, or pass.`);
  }
  async function challengeWindow(ctx, claimNo) {
    const st = ctx.state;
    const called = await ctx.countdown(st.window, 'Call bluff?');
    if (st.claimNo !== claimNo || st.phase !== 'challenge') return;
    if (!called) { ctx.log(`✅ Nobody doubted ${ctx.players[st.claim.by].name}.`); settle(ctx); }
  }
  // A call: the cards are turned over. Whoever was wrong takes the pile; whoever was right leads the next round.
  async function resolveCall(ctx, caller) {
    const st = ctx.state, c = st.claim;
    st.phase = 'reveal';
    const lie = c.cards.some(x => x.r !== c.rank), taker = lie ? c.by : caller, winner = lie ? caller : c.by;
    st.reveal = { cards: c.cards, lie, caller, taker };
    ctx.log(`📣 ${ctx.players[caller].name} called bluff on ${ctx.players[c.by].name}: ${lie ? 'it WAS a bluff' : 'it was the truth'}. ${ctx.players[taker].name} takes ${st.pile.length} card${st.pile.length === 1 ? '' : 's'}.`);
    ctx.update();
    await ctx.say(`${ctx.players[caller].name} calls bluff! ... ${lie ? 'It was a bluff!' : 'It was the truth!'} ${ctx.players[taker].name} takes the pile.`, lie ? 'pay' : 'shake');
    const got = st.pile.map(p => p.card);
    st.hands[taker].push(...got);
    st.fresh = { p: taker, ids: got.map(id), n: ++st.freshNo };
    st.pile = [];
    ctx.update();
    await ctx.wait(2500);
    if (!lie && !st.hands[c.by].length) return win(ctx, c.by);   // a truthful last card still wins
    newRound(ctx, winner, `${ctx.players[winner].name} was right and leads.`);
  }

  return {
    _test: { many, rankWord },                                   // internals, for the unit tests only (test/unit)
    id: 'bluff', name: 'Bluff', min: 3, max: 8, macRole: 'table',
    blurb: 'Play cards face down and say what they are. Lie if you like; call "Bluff!" when you doubt someone. First with no cards wins. 3–8 players on their phones.',
    options: [{ key: 'window', label: 'Time to call "Bluff!" after each play', def: 8, choices: [[5, '5 seconds'], [8, '8 seconds'], [12, '12 seconds'], [20, '20 seconds']] }],
    rules: [
      '<b>Deal:</b> the whole deck is dealt out. The pile in the middle starts empty.',
      '<b>A round:</b> the leader picks any rank and plays 1–4 cards face down, saying how many (e.g. "three Sevens"). Each next player either adds 1–4 cards claiming the same rank, or passes. Any cards will do: you may lie!',
      '<b>Bluff!</b> After each play, anyone else can tap <b>Bluff!</b> before the timer runs out. The cards are turned over: if any card is not the claimed rank, the player who played them takes the whole pile and the caller leads the next round. If they told the truth, the caller takes the pile and the player who was doubted leads.',
      '<b>Everyone passes:</b> when play comes back to the last player who played and nobody added anything, the pile is set aside face down for the rest of the game, and that player leads a new round.',
      '<b>Winning:</b> the first player to get rid of all their cards (and survive any bluff call on their last play) wins.',
    ],
    async start(ctx) {
      const n = ctx.players.length, deck = ctx.shuffle(K.deck()), lead = ctx.rand(n);
      ctx.state = { hands: ctx.players.map(() => []), pile: [], cleared: 0, turn: lead, phase: 'play', round: { rank: null, lead, last: null, passed: [] },
        claim: null, lastClaim: null, reveal: null, claimNo: 0, window: ctx.opts.window || 8, fresh: null, freshNo: 0 };
      deck.forEach((c, k) => ctx.state.hands[k % n].push(c));
      ctx.log('The whole deck is dealt.');
      ctx.update();
      await ctx.say(`Cards are dealt. ${ctx.players[lead].name}, start us off: pick a rank and play.`, 'welcome');
    },
    act(ctx, i, m) {
      const st = ctx.state, me = ctx.players[i].name;
      if (m.act === 'play') {
        if (st.phase !== 'play' || st.turn !== i) return "It's not your turn to play.";
        const rank = st.round.rank || m.rank;
        if (!RANKS.includes(rank)) return 'Pick the rank you are claiming.';
        const ids = String(m.cards || '').split(',').filter(Boolean);
        if (ids.length < 1 || ids.length > 4) return 'Play 1 to 4 cards.';
        const cards = ids.map(x => st.hands[i].find(c => id(c) === x));
        if (cards.some(c => !c) || new Set(ids).size !== ids.length) return 'Those cards are not in your hand.';
        st.hands[i] = st.hands[i].filter(c => !ids.includes(id(c)));
        cards.forEach(card => st.pile.push({ card, by: i }));
        if (!st.round.rank) ctx.log(`🎯 ${me} starts a round of ${rankWord(rank)}.`);
        st.round.rank = rank;
        st.claim = { by: i, count: cards.length, rank, cards };
        st.lastClaim = null; st.phase = 'challenge'; st.claimNo++;
        ctx.log(`🃏 ${me} played ${many(cards.length, rank)} (they say).`);
        ctx.say(`${me}: ${many(cards.length, rank)}.`, 'point');
        challengeWindow(ctx, st.claimNo).catch(() => {});
        return;
      }
      if (m.act === 'pass') {
        if (st.phase !== 'play' || st.turn !== i) return "It's not your turn.";
        if (!st.round.rank) return 'You lead this round: pick a rank and play.';
        st.round.passed.push(i);
        ctx.log(`➖ ${me} passes.`);
        const nx = nextSeat(ctx, i);
        if (nx === st.round.last) {                    // back to the last player who played: nobody added anything
          ctx.log(`🧹 Everyone passed: the pile (${st.pile.length} card${st.pile.length === 1 ? '' : 's'}) is set aside face down.`);
          st.cleared += st.pile.length; st.pile = [];
          return newRound(ctx, nx, 'Everyone passed. The pile is set aside.');
        }
        st.turn = nx;
        ctx.say(`${me} passes. ${ctx.players[nx].name}: add ${rankWord(st.round.rank)}, or pass.`);
        return;
      }
      if (m.act === 'bluff') {
        if (st.phase !== 'challenge' || !st.claim) return 'Too late to call bluff.';
        if (st.claim.by === i) return "You can't call bluff on yourself.";
        st.phase = 'reveal';                           // first caller only
        ctx.skip();
        resolveCall(ctx, i).catch(() => {});
      }
    },
    status: ctx => { const st = ctx.state; return `${st.round.rank ? `Round of ${rankWord(st.round.rank)}` : 'New round'} · pile ${st.pile.length} card${st.pile.length === 1 ? '' : 's'}${st.cleared ? ` · ${st.cleared} set aside` : ''}`; },
    view(ctx, i) {
      const st = ctx.state, c = st.claim, lead = !st.round.rank;
      return {
        title: st.phase === 'play' ? (st.turn === i ? (lead ? 'You lead: pick a rank' : 'Your turn!') : `${ctx.players[st.turn].name}'s turn`) : st.phase === 'challenge' ? (c.by === i ? 'Will they believe you?' : 'Bluff or truth?') : 'Cards revealed',
        phase: st.phase, myTurn: st.phase === 'play' && st.turn === i, lead, rank: st.round.rank, hand: K.sortCards(st.hands[i]), pile: st.pile.length, cleared: st.cleared,
        claim: c ? { name: ctx.players[c.by].name, count: c.count, rank: c.rank, mine: c.by === i } : null,
        last: st.lastClaim ? { name: ctx.players[st.lastClaim.by].name, count: st.lastClaim.count, rank: st.lastClaim.rank, mine: st.lastClaim.by === i } : null,
        canCall: st.phase === 'challenge' && c && c.by !== i,
        reveal: st.reveal ? { cards: st.reveal.cards, lie: st.reveal.lie, caller: ctx.players[st.reveal.caller].name, taker: ctx.players[st.reveal.taker].name } : null,
        fresh: st.fresh && st.fresh.p === i ? { n: st.fresh.n, ids: st.fresh.ids } : null,
        turnName: ctx.players[st.turn].name, leadName: ctx.players[st.round.lead].name,
        others: ctx.players.map((p, k) => ({ name: p.name, count: st.hands[k].length, me: k === i, passed: st.round.passed.includes(k) })),
      };
    },
    hostHTML(ctx, H) {
      const st = ctx.state, c = st.claim, rv = st.reveal, rank = st.round.rank, who = H.esc(ctx.players[st.turn].name);
      const centre = rv
        ? `<div class="big-line">${H.esc(ctx.players[rv.caller].name)} called bluff on ${H.esc(ctx.players[c.by].name)}: <span class="${rv.lie ? 'neg' : 'pos'}">${rv.lie ? 'BLUFF!' : 'TRUTH!'}</span></div>
           <div class="fan">${rv.cards.map(x => K.cardHTML(x, { cls: 'lg' + (x.r === c.rank ? '' : ' liar') })).join('')}</div>
           <div class="note" style="text-align:center">${H.esc(ctx.players[rv.taker].name)} takes the pile.</div>`
        : c ? `<div class="big-line">${H.esc(ctx.players[c.by].name)} says ${claimHTML(c.count, c.rank)}</div><div class="fan">${c.cards.map(() => K.backHTML('lg')).join('')}</div>
              <div class="note" style="text-align:center">Anyone can tap <b>Bluff!</b> on their phone before time runs out.</div>`
        : rank ? `${st.lastClaim ? `<div class="note" style="text-align:center">Last play: ${H.esc(ctx.players[st.lastClaim.by].name)} said ${many(st.lastClaim.count, st.lastClaim.rank)}</div>` : ''}
              <div class="big-line">${who}: add <b>${rankWord(rank)}</b> or pass</div>`
        : `<div class="big-line">${who} leads: picks a rank and plays</div>`;
      return `<div class="bluff-rank">${rank ? `Round of<b>${rankWord(rank)}</b>` : `New round<b>${H.esc(ctx.players[st.round.lead].name)} leads</b>`}</div>
        <div style="display:flex;justify-content:center;gap:24px;margin:8px 0 14px"><div class="stack">${st.pile.length ? K.backHTML('lg') : '<div class="card-slot"></div>'}<span class="n">${st.pile.length}</span></div>
          ${st.cleared ? `<div class="note" style="align-self:center">${st.cleared} card${st.cleared === 1 ? '' : 's'} set aside</div>` : ''}</div>
        ${centre}
        <div class="seat-grid" style="margin-top:18px">${ctx.players.map((p, i) => `<div class="seat-box${st.phase === 'play' && st.turn === i ? ' now' : ''}" style="--pc:${p.color}">
          <div class="who"><i></i>${H.esc(p.name)}${st.phase === 'play' && st.turn === i ? '<span class="tag">Turn</span>' : st.round.passed.includes(i) ? '<span class="tag off">passed</span>' : ''}</div>
          <div class="fan tight">${st.hands[i].slice(0, 14).map(() => K.backHTML('sm')).join('')}</div><div class="note">${st.hands[i].length} cards</div></div>`).join('')}</div>`;
    },
    phoneNotify: (before, now) => now && ((now.myTurn && !(before && before.myTurn)) || (now.canCall && !(before && before.canCall) ? [40] : false)),
    phoneLocal(d, v, local) {
      if (!v.myTurn) return;
      if (d.local === 'rank') local.rank = local.rank === d.rank ? null : d.rank;
      if (d.local !== 'card') return;
      local.sel ||= [];
      local.sel = local.sel.includes(d.id) ? local.sel.filter(x => x !== d.id) : local.sel.length < 4 ? [...local.sel, d.id] : local.sel;
    },
    phoneAct(msg, v, local) { if (msg.act === 'play' || msg.act === 'pass') { local.sel = []; local.rank = null; } },
    phoneHTML(v, local, H) {
      local.sel = (local.sel || []).filter(x => v.hand.some(c => id(c) === x));
      if (!v.myTurn) { local.sel = []; local.rank = null; }
      // the cards you just picked up glow for a few seconds (the negative delay keeps the glow going across redraws)
      const now = Date.now();
      if (v.fresh && (!local.fresh || local.fresh.n !== v.fresh.n)) local.fresh = { n: v.fresh.n, t: now };
      const glow = v.fresh && local.fresh && now - local.fresh.t < FRESH_MS ? new Set(v.fresh.ids) : null;
      const rank = v.lead ? local.rank : v.rank, n = local.sel.length;
      let top = '';
      if (v.reveal) top = `<div class="big-line ${v.reveal.lie ? 'neg' : 'pos'}">${v.reveal.lie ? 'BLUFF!' : 'TRUTH!'}</div>
        <div class="fan">${v.reveal.cards.map(c => K.cardHTML(c, { cls: 'sm' })).join('')}</div><div class="note" style="text-align:center">${H.esc(v.reveal.taker)} takes the pile.</div>`;
      else if (v.claim) top = `<div class="big-line">${v.claim.mine ? 'You said' : H.esc(v.claim.name) + ' says'} ${claimHTML(v.claim.count, v.claim.rank)}</div>` +
        (v.canCall ? '<button class="go red" type="button" data-act="bluff" style="font-size:1.6rem;padding:20px">Bluff!</button>' : '<div class="note" style="text-align:center">Waiting to see if anyone calls bluff…</div>');
      else if (v.myTurn && v.lead) top = `<div class="big-line">You lead: pick a rank</div>
        <div class="bl-ranks">${K.RANKS.map(r => `<button type="button" data-local="rank" data-rank="${r}" class="${local.rank === r ? 'on' : ''}" aria-label="${rankWord(r)}">${r}</button>`).join('')}</div>`;
      else if (v.myTurn) top = `${v.last ? `<div class="note" style="text-align:center">${v.last.mine ? 'You' : H.esc(v.last.name)} said ${many(v.last.count, v.last.rank)}</div>` : ''}<div class="big-line">Add your <b>${rankWord(v.rank)}</b>, or pass</div>`;
      else top = `<div class="big-line">${v.rank ? `${H.esc(v.turnName)}: add ${rankWord(v.rank)} or pass` : `${H.esc(v.turnName)} is picking a rank`}</div>`;
      const play = v.myTurn ? `<button class="go" type="button" data-act="play" data-cards="${local.sel.join(',')}" data-rank="${rank || ''}" ${n && rank ? '' : 'disabled'}>${n && rank ? `Play ${n} card${n === 1 ? '' : 's'} as ${many(n, rank)}` : rank ? `Pick the cards you'll call ${rankWord(rank)}` : 'Pick a rank, then your cards'}</button>
        ${v.lead ? '' : '<button class="go" type="button" data-act="pass" style="background:#334155;color:#fff">Pass</button>'}` : '';
      return top + `
        <div class="sec-title">Your hand (${v.hand.length})${v.myTurn ? ' · tap 1–4 cards' : ''}</div>
        <div class="fan">${v.hand.map(c => K.cardHTML(c, { cls: (v.myTurn ? 'pick' : '') + (local.sel.includes(id(c)) ? ' sel' : '') + (glow && glow.has(id(c)) ? ' fresh' : ''),
          attrs: (v.myTurn ? `data-local="card" data-id="${id(c)}"` : '') + (glow && glow.has(id(c)) ? ` style="animation-delay:-${now - local.fresh.t}ms"` : '') })).join('')}</div>
        ${play}
        <div class="sec-title">Players</div><div class="pills">${v.others.map(o => `<span class="p">${H.esc(o.name)}${o.me ? ' (you)' : ''}: ${o.count}${o.passed ? ' · passed' : ''}</span>`).join('')}</div>
        <div class="note">Pile: ${v.pile} card${v.pile === 1 ? '' : 's'}${v.cleared ? ` · ${v.cleared} set aside` : ''}</div>`;
    },
    css: `.bluff-rank { text-align: center; font-family: Georgia, serif; color: var(--gold, #d4af37); font-size: 1.3rem; letter-spacing: .08em; }
      .bluff-rank b { font-size: 2.6rem; display: block; color: var(--text, #fff); }
      .pcard.liar { box-shadow: 0 0 0 4px #ef4444, 0 6px 14px rgba(0,0,0,.4); }
      .pcard.fresh { animation: blFresh ${FRESH_MS}ms ease-out both; }
      @keyframes blFresh { 0%, 75% { box-shadow: 0 0 0 3px #4ade80, 0 0 16px #4ade80; transform: translateY(-6px); } 100% { box-shadow: none; transform: none; } }
      .card-slot { width: 76px; height: 108px; border-radius: 8px; border: 2px dashed rgba(255,255,255,.25); }
      .neg { color: #f87171; } .pos { color: #4ade80; }
      .bl-claim { display: inline-flex; align-items: center; gap: 8px; vertical-align: middle; flex-wrap: wrap; justify-content: center; }
      .bl-n { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: var(--gold, #d4af37); color: #1d1500; font-weight: 900; font-size: 1.4rem; }
      .bl-x { opacity: .7; font-weight: 800; }
      .bl-r { display: grid; place-items: center; min-width: 40px; height: 56px; padding: 0 4px; border-radius: 6px; background: #fffdf5; color: #1b1b1b; font-weight: 900; font-size: 1.4rem; border: 2px solid #fff; box-shadow: 0 3px 8px rgba(0,0,0,.35); }
      .bl-w { font-weight: 800; }
      .bl-ranks { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 8px 0; }
      .bl-ranks button { padding: 10px 0; border-radius: 8px; border: 2px solid rgba(255,255,255,.25); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-weight: 900; font-size: 1.05rem; }
      .bl-ranks button.on { border-color: var(--gold, #d4af37); background: rgba(212,175,55,.3); }
      .tag.off { background: rgba(255,255,255,.15); color: var(--muted, #b9c4bc); }`,
  };
})();
