// Go Fish: ask another player for a rank you hold; collect books of four. The Mac is the table; everyone plays on a phone.
window.PARTY_GAME = (() => {
  const K = PartyKit;
  const RANKS = K.RANKS;
  const plural = r => K.rankName(r, 2);

  function deal(ctx) {
    const st = ctx.state, n = ctx.players.length, per = n <= 3 ? 7 : 5;
    st.deck = ctx.shuffle(K.deck());
    st.hands = ctx.players.map(() => st.deck.splice(0, per));
    st.books = ctx.players.map(() => []);
    ctx.players.forEach((_, i) => takeBooks(ctx, i, true));
  }
  // Any four of a kind in hand become a book
  function takeBooks(ctx, i, quiet) {
    const st = ctx.state, made = [];
    RANKS.forEach(r => {
      if (st.hands[i].filter(c => c.r === r).length === 4) {
        st.hands[i] = st.hands[i].filter(c => c.r !== r);
        st.books[i].push(r); made.push(r);
      }
    });
    made.forEach(r => {
      ctx.log(`📚 ${ctx.players[i].name} made a book of ${plural(r)}.`);
      if (!quiet) ctx.say(`${ctx.players[i].name} makes a book of ${plural(r)}!`, 'pay');
    });
    return made.length;
  }
  const totalBooks = st => st.books.reduce((a, b) => a + b.length, 0);
  // A player with no cards draws one (if the pond has any)
  function refill(ctx, i) {
    const st = ctx.state;
    if (!st.hands[i].length && st.deck.length) { st.hands[i].push(st.deck.pop()); takeBooks(ctx, i); }
  }
  function over(ctx) {
    const st = ctx.state;
    return totalBooks(st) === 13 || (!st.deck.length && st.hands.every(h => !h.length));
  }
  function finish(ctx) {
    const st = ctx.state, best = Math.max(...st.books.map(b => b.length));
    ctx.end(ctx.players.map((p, i) => ({ name: p.name, won: st.books[i].length === best, points: st.books[i].length })));
  }
  // Pass the turn to the next player who still has cards (drawing one if their hand ran out)
  function nextTurn(ctx) {
    const st = ctx.state, n = ctx.players.length;
    for (let d = 1; d <= n; d++) {
      const i = (st.turn + d) % n;
      refill(ctx, i);
      if (st.hands[i].length) { st.turn = i; ctx.say(`${ctx.players[i].name}, your turn.`); return; }
    }
    st.turn = null;
  }

  return {
    id: 'gofish', name: 'Go Fish', min: 2, max: 6, macRole: 'table', pointsLabel: 'books',
    blurb: 'Ask other players for cards of a rank you hold. Collect books of four. Most books wins. 2–6 players, everyone on their own phone.',
    rules: [
      '<b>Deal:</b> 7 cards each with 2–3 players, 5 cards each with 4–6. The rest is the pond (the deck in the middle of the Mac screen).',
      '<b>Your turn:</b> pick a rank you hold and a player, then ask. If they have any, they hand over all of them and you go again.',
      '<b>Go fish:</b> if they have none, you draw from the pond. Draw the rank you asked for and you go again; otherwise the turn passes.',
      '<b>Books:</b> four of a kind is a book and goes face up in front of you. If your hand runs out, you draw a card.',
      '<b>Winning:</b> when all 13 books are made, the player with the most books wins (ties share the win).',
    ],
    async start(ctx) {
      ctx.state = { turn: ctx.rand(ctx.players.length), last: '' };
      deal(ctx);
      ctx.log(`Dealt ${ctx.state.hands[0].length + ctx.state.books[0].length * 4} cards each.`);
      ctx.update();
      await ctx.say(`Cards are dealt. ${ctx.players[ctx.state.turn].name} goes first.`, 'welcome');
      if (!ctx.state.hands[ctx.state.turn].length) nextTurn(ctx);
      ctx.update();
    },
    act(ctx, i, m) {
      const st = ctx.state;
      if (m.act !== 'ask') return;
      if (st.turn !== i) return "It's not your turn.";
      const t = +m.target, r = m.rank, me = ctx.players[i].name;
      if (!(t >= 0 && t < ctx.players.length) || t === i) return 'Pick another player to ask.';
      if (!st.hands[i].some(c => c.r === r)) return 'You can only ask for a rank you hold.';
      if (!st.hands[t].length) return `${ctx.players[t].name} has no cards. Ask someone else.`;
      const them = ctx.players[t].name, got = st.hands[t].filter(c => c.r === r);
      if (got.length) {
        st.hands[t] = st.hands[t].filter(c => c.r !== r);
        st.hands[i].push(...got);
        st.last = `${me} asked ${them} for ${plural(r)} and got ${got.length}! ${me} goes again.`;
        ctx.log(`🎣 ${me} took ${got.length} ${got.length === 1 ? K.rankName(r) : plural(r)} from ${them}.`);
        ctx.say(`${them} has ${got.length}! ${me} goes again.`, 'pay');
        takeBooks(ctx, i);
        refill(ctx, t);
        refill(ctx, i);
        if (over(ctx)) return finish(ctx);
        if (!st.hands[i].length) nextTurn(ctx);
        return;
      }
      if (!st.deck.length) {
        st.last = `${me} asked ${them} for ${plural(r)}. No cards, and the pond is empty.`;
        ctx.log(`🙅 ${them} had no ${plural(r)}; the pond is empty.`);
        ctx.say(`Go fish! But the pond is empty.`, 'shake');
        nextTurn(ctx);
        if (over(ctx) || st.turn == null) return finish(ctx);
        return;
      }
      const card = st.deck.pop();
      st.hands[i].push(card);
      const wish = card.r === r;
      st.last = `${me} asked ${them} for ${plural(r)}. Go fish!${wish ? ` ${me} fished a ${K.rankName(r)} and goes again!` : ''}`;
      ctx.log(`🐟 ${me} asked ${them} for ${plural(r)}: go fish${wish ? ' (and fished their wish!)' : '.'}`);
      ctx.say(wish ? `Go fish! ${me} fished their wish and goes again!` : 'Go fish!', wish ? 'pay' : 'shake');
      takeBooks(ctx, i);
      if (over(ctx)) return finish(ctx);
      if (!wish || !st.hands[i].length) nextTurn(ctx);
      if (st.turn == null) return finish(ctx);
    },
    status: ctx => `Pond: ${ctx.state.deck.length} cards · ${totalBooks(ctx.state)} of 13 books made`,
    view(ctx, i) {
      const st = ctx.state;
      return {
        title: st.turn === i ? 'Your turn!' : st.turn != null ? `${ctx.players[st.turn].name}'s turn` : 'Game over',
        myTurn: st.turn === i, hand: K.sortCards(st.hands[i]), books: st.books[i], deck: st.deck.length, last: st.last,
        others: ctx.players.map((p, k) => ({ i: k, name: p.name, color: p.color, count: st.hands[k].length, books: st.books[k].length })).filter(o => o.i !== i),
      };
    },
    hostHTML(ctx, H) {
      const st = ctx.state;
      return `<div class="big-line">${H.esc(st.last || 'Ask for a rank you hold. Collect books of four!')}</div>
        <div style="display:flex;justify-content:center;margin:10px 0 20px"><div class="stack">${K.backHTML('lg')}<span class="n">${st.deck.length}</span></div></div>
        <div class="seat-grid">${ctx.players.map((p, i) => `<div class="seat-box${st.turn === i ? ' now' : ''}" style="--pc:${p.color}">
          <div class="who"><i></i>${H.esc(p.name)}${st.turn === i ? '<span class="tag">Turn</span>' : ''}</div>
          <div class="fan tight">${st.hands[i].map(() => K.backHTML('sm')).join('') || '<span class="note">No cards</span>'}</div>
          <div class="sec-title">Books: ${st.books[i].length}</div>
          <div class="pills">${st.books[i].map(r => `<span class="p">${r}</span>`).join('')}</div></div>`).join('')}</div>`;
    },
    phoneNotify: (before, now) => now && now.myTurn && !(before && before.myTurn),
    phoneLocal(d, v, local) {
      if (d.local === 'rank') local.rank = local.rank === d.rank ? null : d.rank;
      if (d.local === 'target') local.target = +d.target;
    },
    phoneAct(msg, v, local) {
      if (msg.act === 'ask') { local.rank = null; }     // clear the choice once asked
    },
    phoneHTML(v, local, H) {
      if (!v.hand.some(c => c.r === local.rank)) local.rank = null;
      if (!v.others.some(o => o.i === local.target && o.count)) local.target = null;
      const ranks = [...new Set(v.hand.map(c => c.r))];
      return `<div class="note" style="text-align:center">${H.esc(v.last || '')}</div>
        <div class="sec-title">Your hand (${v.hand.length})${v.myTurn ? ' · tap a rank to ask for' : ''}</div>
        <div class="fan">${v.hand.map(c => K.cardHTML(c, { cls: (v.myTurn ? 'pick' : '') + (local.rank === c.r ? ' sel' : ''), attrs: v.myTurn ? `data-local="rank" data-rank="${c.r}"` : '' })).join('') || '<span class="note">No cards</span>'}</div>
        ${v.myTurn ? `<div class="sec-title">Ask who?</div>
          <div class="choice">${v.others.map(o => `<button type="button" data-local="target" data-target="${o.i}" class="${local.target === o.i ? 'on' : ''}" ${o.count ? '' : 'disabled'}>${H.esc(o.name)} · ${o.count} 🂠</button>`).join('')}</div>
          <button class="go" type="button" data-act="ask" data-rank="${local.rank || ''}" data-target="${local.target ?? ''}" ${local.rank && local.target != null ? '' : 'disabled'}>
            ${local.rank && local.target != null ? `Ask ${H.esc(v.others.find(o => o.i === local.target).name)} for ${K.rankName(local.rank, 2)}` : 'Pick a rank and a player'}</button>` : ''}
        <div class="sec-title">Your books (${v.books.length})</div><div class="pills">${v.books.map(r => `<span class="p">${r}</span>`).join('') || '<span class="note">None yet</span>'}</div>
        <div class="sec-title">Others</div><div class="pills">${v.others.map(o => `<span class="p">${H.esc(o.name)}: ${o.count} cards · ${o.books} books</span>`).join('')}</div>
        <div class="note">Pond: ${v.deck} cards</div>`;
    },
  };
})();
