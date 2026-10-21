// Bluff (also called Cheat or I Doubt It): play cards face down claiming the rank in sequence; anyone may call "Bluff!".
window.PARTY_GAME = (() => {
  const K = PartyKit, RANKS = K.RANKS;
  const id = c => `${c.r}|${c.s}`;
  const many = (n, r) => `${n} ${n === 1 ? K.rankName(r) : K.rankName(r, 2)}`;

  function nextSeat(ctx, from) { return (from + 1) % ctx.players.length; }
  // After a claim is settled: the claimant wins if they emptied their hand and weren't caught; otherwise play moves on
  async function settle(ctx) {
    const st = ctx.state, c = st.claim;
    if (!st.hands[c.by].length && !c.caught) {
      ctx.log(`🏁 ${ctx.players[c.by].name} played their last card.`);
      await ctx.say(`${ctx.players[c.by].name} is out of cards and wins!`, 'pay');
      return ctx.end(ctx.players.map((p, i) => ({ name: p.name, won: i === c.by, note: `${st.hands[i].length} cards left` })));
    }
    st.claim = null; st.reveal = null; st.phase = 'play';
    st.rank = (st.rank + 1) % RANKS.length;
    st.turn = nextSeat(ctx, c.by);
    ctx.update();
    ctx.say(`${ctx.players[st.turn].name}, play ${K.rankName(RANKS[st.rank], 2)}.`);
  }
  // The window for calling "Bluff!" after each play
  async function challengeWindow(ctx, claimNo) {
    const st = ctx.state;
    const called = await ctx.countdown(st.window, 'Call bluff?');
    if (st.claimNo !== claimNo || st.phase !== 'challenge') return;
    if (!called) { ctx.log(`✅ Nobody doubted ${ctx.players[st.claim.by].name}.`); await settle(ctx); }
  }
  async function resolveCall(ctx, caller) {
    const st = ctx.state, c = st.claim;
    st.phase = 'reveal';
    const lie = c.cards.some(x => x.r !== c.rank);
    const taker = lie ? c.by : caller;
    st.reveal = { cards: c.cards, lie, caller, taker };
    c.caught = lie;
    ctx.log(`📣 ${ctx.players[caller].name} called bluff on ${ctx.players[c.by].name}: ${lie ? 'it WAS a bluff' : 'it was the truth'}. ${ctx.players[taker].name} takes ${st.pile.length} card${st.pile.length === 1 ? '' : 's'}.`);
    ctx.update();
    await ctx.say(`${ctx.players[caller].name} calls bluff! ... ${lie ? 'It was a bluff!' : 'It was the truth!'} ${ctx.players[taker].name} takes the pile.`, lie ? 'pay' : 'shake');
    st.hands[taker].push(...st.pile.map(p => p.card));
    st.pile = [];
    await ctx.wait(2500);
    await settle(ctx);
  }

  return {
    id: 'bluff', name: 'Bluff', min: 3, max: 8, macRole: 'table',
    blurb: 'Play cards face down and say what they are. Lie if you like; call "Bluff!" when you doubt someone. First with no cards wins. 3–8 players on their phones.',
    options: [{ key: 'window', label: 'Time to call "Bluff!" after each play', def: 8, choices: [[5, '5 seconds'], [8, '8 seconds'], [12, '12 seconds'], [20, '20 seconds']] }],
    rules: [
      '<b>Deal:</b> the whole deck is dealt out. The pile in the middle starts empty.',
      '<b>Your turn:</b> play 1–4 cards face down and claim they are the rank being called: Aces first, then 2s, 3s… up to Kings, then Aces again. You may lie!',
      '<b>Bluff!</b> After each play, anyone else can tap <b>Bluff!</b> before the timer runs out. The cards are turned over: if any card is not the claimed rank, the player who played them takes the whole pile. If they told the truth, the caller takes the pile.',
      '<b>Winning:</b> the first player to get rid of all their cards (and survive any bluff call on their last play) wins.',
    ],
    async start(ctx) {
      const n = ctx.players.length, deck = ctx.shuffle(K.deck());
      ctx.state = { hands: ctx.players.map(() => []), pile: [], rank: 0, turn: ctx.rand(n), phase: 'play', claim: null, reveal: null, claimNo: 0, window: ctx.opts.window || 8 };
      deck.forEach((c, k) => ctx.state.hands[k % n].push(c));
      ctx.log('The whole deck is dealt. First rank: Aces.');
      ctx.update();
      await ctx.say(`Cards are dealt. ${ctx.players[ctx.state.turn].name}, start us off with Aces.`, 'welcome');
    },
    act(ctx, i, m) {
      const st = ctx.state;
      if (m.act === 'play') {
        if (st.phase !== 'play' || st.turn !== i) return "It's not your turn to play.";
        const ids = String(m.cards || '').split(',').filter(Boolean);
        if (ids.length < 1 || ids.length > 4) return 'Play 1 to 4 cards.';
        const cards = ids.map(x => st.hands[i].find(c => id(c) === x));
        if (cards.some(c => !c) || new Set(ids).size !== ids.length) return 'Those cards are not in your hand.';
        st.hands[i] = st.hands[i].filter(c => !ids.includes(id(c)));
        cards.forEach(card => st.pile.push({ card, by: i }));
        const rank = RANKS[st.rank];
        st.claim = { by: i, count: cards.length, rank, cards, caught: false };
        st.phase = 'challenge'; st.claimNo++;
        ctx.log(`🃏 ${ctx.players[i].name} played ${many(cards.length, rank)} (they say).`);
        ctx.say(`${ctx.players[i].name}: ${many(cards.length, rank)}.`, 'point');
        challengeWindow(ctx, st.claimNo).catch(() => {});
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
    status: ctx => `Rank to play: ${K.rankName(RANKS[ctx.state.rank], 2)} · pile ${ctx.state.pile.length} cards`,
    view(ctx, i) {
      const st = ctx.state, c = st.claim;
      return {
        title: st.phase === 'play' ? (st.turn === i ? 'Your turn!' : `${ctx.players[st.turn].name}'s turn`) : st.phase === 'challenge' ? (c.by === i ? 'Will they believe you?' : 'Bluff or truth?') : 'Cards revealed',
        phase: st.phase, myTurn: st.phase === 'play' && st.turn === i, rank: RANKS[st.rank], hand: K.sortCards(st.hands[i]), pile: st.pile.length,
        claim: c ? { name: ctx.players[c.by].name, count: c.count, rank: c.rank, mine: c.by === i } : null,
        canCall: st.phase === 'challenge' && c && c.by !== i,
        reveal: st.reveal ? { cards: st.reveal.cards, lie: st.reveal.lie, caller: ctx.players[st.reveal.caller].name, taker: ctx.players[st.reveal.taker].name } : null,
        turnName: ctx.players[st.turn].name,
        others: ctx.players.map((p, k) => ({ name: p.name, count: st.hands[k].length, me: k === i })),
      };
    },
    hostHTML(ctx, H) {
      const st = ctx.state, c = st.claim, rv = st.reveal;
      const centre = rv
        ? `<div class="big-line">${H.esc(ctx.players[rv.caller].name)} called bluff on ${H.esc(ctx.players[c.by].name)}: <span class="${rv.lie ? 'neg' : 'pos'}">${rv.lie ? 'BLUFF!' : 'TRUTH!'}</span></div>
           <div class="fan">${rv.cards.map(x => K.cardHTML(x, { cls: 'lg' + (x.r === c.rank ? '' : ' liar') })).join('')}</div>
           <div class="note" style="text-align:center">${H.esc(ctx.players[rv.taker].name)} takes the pile.</div>`
        : c ? `<div class="big-line">${H.esc(ctx.players[c.by].name)} says: <b>${many(c.count, c.rank)}</b></div><div class="fan">${c.cards.map(() => K.backHTML('lg')).join('')}</div>
              <div class="note" style="text-align:center">Anyone can tap <b>Bluff!</b> on their phone before time runs out.</div>`
        : `<div class="big-line">${H.esc(ctx.players[st.turn].name)}, play <b>${K.rankName(RANKS[st.rank], 2)}</b></div>`;
      return `<div class="bluff-rank">Now playing: <b>${RANKS[st.rank]}</b></div>
        <div style="display:flex;justify-content:center;margin:8px 0 14px"><div class="stack">${st.pile.length ? K.backHTML('lg') : '<div class="card-slot"></div>'}<span class="n">${st.pile.length}</span></div></div>
        ${centre}
        <div class="seat-grid" style="margin-top:18px">${ctx.players.map((p, i) => `<div class="seat-box${st.phase === 'play' && st.turn === i ? ' now' : ''}" style="--pc:${p.color}">
          <div class="who"><i></i>${H.esc(p.name)}${st.phase === 'play' && st.turn === i ? '<span class="tag">Turn</span>' : ''}</div>
          <div class="fan tight">${st.hands[i].slice(0, 14).map(() => K.backHTML('sm')).join('')}</div><div class="note">${st.hands[i].length} cards</div></div>`).join('')}</div>`;
    },
    phoneNotify: (before, now) => now && ((now.myTurn && !(before && before.myTurn)) || (now.canCall && !(before && before.canCall) ? [40] : false)),
    phoneLocal(d, v, local) {
      if (d.local !== 'card' || !v.myTurn) return;
      local.sel ||= [];
      local.sel = local.sel.includes(d.id) ? local.sel.filter(x => x !== d.id) : local.sel.length < 4 ? [...local.sel, d.id] : local.sel;
    },
    phoneAct(msg, v, local) { if (msg.act === 'play') local.sel = []; },
    phoneHTML(v, local, H) {
      local.sel = (local.sel || []).filter(x => v.hand.some(c => id(c) === x));
      if (!v.myTurn) local.sel = [];
      const n = local.sel.length, plural = K.rankName(v.rank, 2);
      let top = '';
      if (v.reveal) top = `<div class="big-line ${v.reveal.lie ? 'neg' : 'pos'}">${v.reveal.lie ? 'BLUFF!' : 'TRUTH!'}</div>
        <div class="fan">${v.reveal.cards.map(c => K.cardHTML(c, { cls: 'sm' })).join('')}</div><div class="note" style="text-align:center">${H.esc(v.reveal.taker)} takes the pile.</div>`;
      else if (v.claim) top = `<div class="big-line">${v.claim.mine ? 'You said' : H.esc(v.claim.name) + ' says'}: ${many(v.claim.count, v.claim.rank)}</div>` +
        (v.canCall ? '<button class="go red" type="button" data-act="bluff" style="font-size:1.6rem;padding:20px">Bluff!</button>' : '<div class="note" style="text-align:center">Waiting to see if anyone calls bluff…</div>');
      else top = `<div class="big-line">${v.myTurn ? `Play your ${plural}` : `${H.esc(v.turnName)} is playing ${plural}`}</div>`;
      return top + `
        <div class="sec-title">Your hand (${v.hand.length})${v.myTurn ? ' · tap 1–4 cards' : ''}</div>
        <div class="fan">${v.hand.map(c => K.cardHTML(c, { cls: (v.myTurn ? 'pick' : '') + (local.sel.includes(id(c)) ? ' sel' : ''), attrs: v.myTurn ? `data-local="card" data-id="${id(c)}"` : '' })).join('')}</div>
        ${v.myTurn ? `<button class="go" type="button" data-act="play" data-cards="${local.sel.join(',')}" ${n ? '' : 'disabled'}>${n ? `Play ${n} card${n === 1 ? '' : 's'} as ${many(n, v.rank)}` : `Pick the cards you'll call ${plural}`}</button>` : ''}
        <div class="sec-title">Players</div><div class="pills">${v.others.map(o => `<span class="p">${H.esc(o.name)}${o.me ? ' (you)' : ''}: ${o.count}</span>`).join('')}</div>
        <div class="note">Pile: ${v.pile} cards</div>`;
    },
    css: `.bluff-rank { text-align: center; font-family: Georgia, serif; color: var(--gold, #d4af37); font-size: 1.3rem; letter-spacing: .08em; }
      .bluff-rank b { font-size: 2.6rem; display: block; color: var(--text, #fff); }
      .pcard.liar { box-shadow: 0 0 0 4px #ef4444, 0 6px 14px rgba(0,0,0,.4); }
      .card-slot { width: 76px; height: 108px; border-radius: 8px; border: 2px dashed rgba(255,255,255,.25); }
      .neg { color: #f87171; } .pos { color: #4ade80; }`,
  };
})();
