// One Night Ultimate Werewolf: the Mac is the moderator (it narrates the night); every player uses their own phone.
window.PARTY_GAME = (() => {
  const ROLES = {
    werewolf: { name: 'Werewolf', icon: '🐺', team: 'wolf', text: 'Wake with the other werewolves. A lone werewolf may look at one center card. You win if no werewolf dies.' },
    minion: { name: 'Minion', icon: '🦹', team: 'wolf', text: 'You see who the werewolves are (they don\'t see you). You win with the werewolves, even if you die.' },
    mason: { name: 'Mason', icon: '🧱', team: 'village', text: 'Wake with the other Mason and see each other.' },
    seer: { name: 'Seer', icon: '🔮', team: 'village', text: 'Look at another player\'s card, or two of the center cards.' },
    robber: { name: 'Robber', icon: '🦝', team: 'village', text: 'You may swap your card with another player\'s (or not). After a swap you may look at your new card. You are now that role.' },
    troublemaker: { name: 'Troublemaker', icon: '😈', team: 'village', text: 'Swap the cards of two other players without looking at them.' },
    drunk: { name: 'Drunk', icon: '🍺', team: 'village', text: 'Swap your card with a center card without looking. You are now that role.' },
    insomniac: { name: 'Insomniac', icon: '🦉', team: 'village', text: 'At the end of the night, look at your own card to see if it changed.' },
    villager: { name: 'Villager', icon: '🧑‍🌾', team: 'village', text: 'No night action. Find the werewolves!' },
    hunter: { name: 'Hunter', icon: '🏹', team: 'village', text: 'If you die, the player you voted for dies too.' },
    tanner: { name: 'Tanner', icon: '🪢', team: 'tanner', text: 'You hate your job. You win only if you die.' },
  };
  // Night order; each step lasts the same time whether or not anyone holds the role
  const NIGHT = [
    ['werewolf', 'Werewolves, wake up and look for other werewolves. If you are the only werewolf, you may look at a card from the center.', 'Werewolves, close your eyes.'],
    ['minion', 'Minion, wake up. Werewolves, show yourselves on the minion\'s phone. Minion, see who the werewolves are.', 'Minion, close your eyes.'],
    ['mason', 'Masons, wake up and look for the other mason.', 'Masons, close your eyes.'],
    ['seer', 'Seer, wake up. You may look at another player\'s card, or two of the center cards.', 'Seer, close your eyes.'],
    ['robber', 'Robber, wake up. You may exchange your card with another player\'s card, and then view your new card.', 'Robber, close your eyes.'],
    ['troublemaker', 'Troublemaker, wake up. You may exchange cards between two other players.', 'Troublemaker, close your eyes.'],
    ['drunk', 'Drunk, wake up and exchange your card with a card from the center.', 'Drunk, close your eyes.'],
    ['insomniac', 'Insomniac, wake up and look at your card.', 'Insomniac, close your eyes.'],
  ];
  const OPTIONAL = ['minion', 'mason', 'drunk', 'insomniac', 'hunter', 'tanner'];
  // The deck: 2 werewolves, Seer, Robber, Troublemaker, the chosen extras, villagers to fill (players + 3 cards)
  function buildDeck(n, extras) {
    const deck = ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker'];
    for (const r of OPTIONAL) if (extras.includes(r)) { if (r === 'mason') deck.push('mason', 'mason'); else deck.push(r); }
    while (deck.length > n + 3) {                          // too many extras for this table: drop from the end
      const k = deck.findLastIndex(r => OPTIONAL.includes(r));
      if (k < 0) break;
      if (deck[k] === 'mason') deck.splice(deck.indexOf('mason'), 2); else deck.splice(k, 1);
    }
    while (deck.length < n + 3) deck.push('villager');
    return deck.slice(0, n + 3);
  }
  const R = r => ROLES[r];
  const plural = r => r === 'werewolf' ? 'Werewolves' : R(r).name + 's';
  const label = r => `${R(r).icon} ${R(r).name}`;
  const CENTER = ['left', 'middle', 'right'];

  async function night(ctx) {
    const st = ctx.state, inDeck = new Set(st.deck);
    st.phase = 'night';
    ctx.update();
    await ctx.say('Everyone, close your eyes.', 'sweep');
    await ctx.wait(1500);
    for (const [role, wake, sleep] of NIGHT) {
      if (!inDeck.has(role)) continue;
      st.step = role; st.done = new Set();
      ctx.log(`🌙 ${plural(role)} wake up.`);
      // info roles learn what they see as soon as they wake
      ctx.players.forEach((p, i) => { if (st.start[i] === role) wakeInfo(ctx, i, role); });
      ctx.update();
      await ctx.say(wake);
      await ctx.countdown(st.actionTime, plural(role));
      // the Drunk must swap: if time ran out, a random center card
      if (role === 'drunk') ctx.players.forEach((p, i) => { if (st.start[i] === 'drunk' && !st.done.has(i)) doDrunk(ctx, i, ctx.rand(3)); });
      st.step = null;
      ctx.update();
      await ctx.say(sleep);
      await ctx.wait(1200);
    }
    st.phase = 'day'; st.ready = new Set();
    ctx.log('☀️ Day: discuss, then vote.');
    ctx.update();
    await ctx.say(`Everyone, wake up! You have ${Math.round(st.talk / 60)} minutes to find the werewolves. Tap ready to vote when you are done.`, 'welcome');
    await ctx.countdown(st.talk, 'Discussion');
    await vote(ctx);
  }
  function note(ctx, i, text) { ctx.state.notes[i].push(text); }
  function wakeInfo(ctx, i, role) {
    const st = ctx.state, names = k => ctx.players[k].name;
    if (role === 'werewolf') {
      const wolves = ctx.players.map((_, k) => k).filter(k => st.start[k] === 'werewolf' && k !== i);
      note(ctx, i, wolves.length ? `The other werewolf: ${wolves.map(names).join(', ')}.` : 'You are the only werewolf. You may look at one center card.');
    }
    if (role === 'minion') {
      const wolves = ctx.players.map((_, k) => k).filter(k => st.start[k] === 'werewolf');
      note(ctx, i, wolves.length ? `The werewolves are: ${wolves.map(names).join(', ')}.` : 'There are no werewolves among the players!');
    }
    if (role === 'mason') {
      const others = ctx.players.map((_, k) => k).filter(k => st.start[k] === 'mason' && k !== i);
      note(ctx, i, others.length ? `The other mason: ${others.map(names).join(', ')}.` : 'You are the only mason (the other is in the center).');
    }
    if (role === 'insomniac') note(ctx, i, `At the end of the night your card is: ${label(st.cards[i])}.`);
  }
  function doDrunk(ctx, i, c) {
    const st = ctx.state;
    [st.cards[i], st.cards[ctx.players.length + c]] = [st.cards[ctx.players.length + c], st.cards[i]];
    st.done.add(i);
    note(ctx, i, `You swapped your card with the ${CENTER[c]} center card (you don't know what you are now).`);
    st.nightLog.push(`Drunk ${ctx.players[i].name} swapped with the ${CENTER[c]} center card.`);
  }

  async function vote(ctx) {
    const st = ctx.state;
    st.phase = 'vote'; st.votes = {};
    ctx.update();
    await ctx.say('Time to vote! On your phone, pick who you think is a werewolf.', 'point');
    await ctx.countdown(st.voteTime, 'Vote');
    reveal(ctx);
  }
  function reveal(ctx) {
    const st = ctx.state, n = ctx.players.length;
    const tally = Array(n).fill(0);
    Object.values(st.votes).forEach(t => tally[t]++);
    const top = Math.max(...tally);
    const dead = new Set(top >= 2 ? tally.map((v, k) => v === top ? k : -1).filter(k => k >= 0) : []);
    [...dead].forEach(k => { if (st.cards[k] === 'hunter' && st.votes[k] != null) dead.add(st.votes[k]); });   // the Hunter takes someone with them
    const final = st.cards.slice(0, n);
    const wolves = final.map((r, k) => r === 'werewolf' ? k : -1).filter(k => k >= 0);
    const wolfDied = wolves.some(k => dead.has(k));
    const tannerDied = [...dead].some(k => final[k] === 'tanner');
    const minions = final.map((r, k) => r === 'minion' ? k : -1).filter(k => k >= 0);
    let villageWins, wolfWins;
    if (wolves.length) {                                  // werewolves among the players
      villageWins = wolfDied;
      wolfWins = !wolfDied && !tannerDied;
    } else {                                              // no werewolf among the players: nobody should die
      const others = [...dead].filter(k => final[k] !== 'minion');
      villageWins = others.length === 0;
      wolfWins = minions.length > 0 && others.length > 0 && !tannerDied;   // the Minion wins if someone else dies
    }
    const won = k => final[k] === 'tanner' ? dead.has(k) : R(final[k]).team === 'wolf' ? wolfWins : villageWins;
    const headline = tannerDied && !wolfDied ? 'The Tanner got their wish!' : wolfWins ? 'The werewolves win!' : villageWins ? 'The village wins!' : 'Nobody wins!';
    const html = `<div class="ww-head">${headline}</div>
      <table class="ww-table"><thead><tr><th>Player</th><th>Started as</th><th>Ended as</th><th>Votes</th><th></th></tr></thead><tbody>
      ${ctx.players.map((p, k) => `<tr><td><b>${PartyKit.esc(p.name)}</b></td><td>${label(st.start[k])}</td><td>${label(final[k])}</td><td>${tally[k]}${st.votes[k] != null ? ` <span class="note">→ ${PartyKit.esc(ctx.players[st.votes[k]].name)}</span>` : ''}</td><td>${dead.has(k) ? '💀' : ''}</td></tr>`).join('')}
      </tbody></table>
      <div class="note">Center cards: ${st.cards.slice(n).map(label).join(' · ')}</div>
      <div class="sec-title">What happened in the night</div><div class="note">${st.nightLog.map(PartyKit.esc).join('<br>') || 'Nobody changed anything.'}</div>`;
    ctx.log(`🗳️ ${dead.size ? [...dead].map(k => ctx.players[k].name).join(', ') + ' died.' : 'Nobody died.'} ${headline}`);
    ctx.say(`${dead.size ? [...dead].map(k => `${ctx.players[k].name}, the ${R(final[k]).name},`).join(' and ') + ' died.' : 'Nobody died.'} ${headline}`, 'wave');
    ctx.end(ctx.players.map((p, k) => ({ name: p.name, won: won(k), note: `${R(st.start[k]).name}${final[k] !== st.start[k] ? ' → ' + R(final[k]).name : ''}${dead.has(k) ? ' · died' : ''}` })), html);
  }

  return {
    id: 'werewolf', name: 'One Night Werewolf', min: 3, max: 10, macRole: 'moderator',
    blurb: 'One night, one vote. Everyone gets a secret role on their phone; the Mac narrates the night. Find a werewolf in the vote and the village wins. 3–10 players.',
    options: [
      { key: 'extras', label: 'Extra roles (always: 2 Werewolves, Seer, Robber, Troublemaker; Villagers fill the rest)', type: 'checks', def: ['minion', 'insomniac'],
        choices: OPTIONAL.map(r => [r, `${R(r).icon} ${R(r).name}${r === 'mason' ? ' ×2' : ''}`]) },
      { key: 'talk', label: 'Day discussion', def: 300, choices: [[180, '3 minutes'], [300, '5 minutes'], [420, '7 minutes'], [600, '10 minutes']] },
      { key: 'actionTime', label: 'Time for each night role', def: 15, choices: [[10, '10 seconds'], [15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds']] },
    ],
    rules: [
      '<b>Setup:</b> there are 3 more role cards than players. Each phone shows its player\'s secret role; the other 3 go to the center. Roles in the game are shown on the Mac.',
      '<b>Night:</b> everyone closes their eyes. The Mac calls each role in turn; when your role is called, open your eyes and use your phone (quietly!). Each call lasts the same time even if that card is in the center.',
      '<b>Roles:</b> 🐺 Werewolves see each other (a lone wolf may peek at a center card) · 🦹 Minion sees the wolves · 🧱 Masons see each other · 🔮 Seer looks at one player\'s card or two center cards · 🦝 Robber may swap with a player, then may look at the new card · 😈 Troublemaker swaps two other players\' cards · 🍺 Drunk swaps with a center card blind · 🦉 Insomniac checks their card at the end · 🏹 Hunter: if they die, whoever they voted for dies · 🪢 Tanner wins only if they die.',
      '<b>Your card may change in the night!</b> You are on the team of the card in front of you at the end, which might not be the one you started with.',
      '<b>Day:</b> talk, accuse, lie. Then everyone votes on their phone. The player with the most votes dies (ties: all of them). If nobody gets more than one vote, nobody dies.',
      '<b>Winning:</b> the village wins if at least one werewolf dies (or if there are no werewolves among the players and nobody dies). The werewolves (and minion) win if no werewolf dies. The Tanner wins by dying, and then the werewolves can\'t win.',
    ],
    _reveal: reveal,                                    // (for tests: settle the vote straight away)
    async start(ctx) {
      const n = ctx.players.length, o = ctx.opts;
      const deck = buildDeck(n, o.extras || []);
      const cards = ctx.shuffle(deck.slice());
      ctx.state = { deck, cards, start: cards.slice(0, n), phase: 'deal', step: null, done: new Set(), notes: ctx.players.map(() => []), nightLog: [],
        talk: o.talk || 300, actionTime: o.actionTime || 15, voteTime: 60, ready: new Set(), votes: {} };
      ctx.log(`Roles: ${deck.map(r => R(r).name).join(', ')}.`);
      ctx.update();
      await ctx.say('Welcome to One Night Werewolf. Look at your phone to see your role, and keep it secret!', 'welcome');
      await ctx.countdown(20, 'Look at your role');
      await night(ctx);
    },
    act(ctx, i, m) {
      const st = ctx.state, n = ctx.players.length, me = st.start[i], name = k => ctx.players[k].name;
      if (m.act === 'ready') {
        if (st.phase !== 'day') return;
        st.ready.has(i) ? st.ready.delete(i) : st.ready.add(i);
        if (st.ready.size === n) { ctx.log('Everyone is ready to vote.'); ctx.skip(); }
        return;
      }
      if (m.act === 'vote') {
        if (st.phase !== 'vote') return 'Voting is not open.';
        const t = +m.p;
        if (!(t >= 0 && t < n) || t === i) return 'Vote for another player.';
        st.votes[i] = t;
        if (Object.keys(st.votes).length === n) ctx.skip();
        return;
      }
      // night actions: only for your starting role, during its step, once
      if (st.phase !== 'night' || st.step !== me || st.done.has(i)) return 'Not now.';
      const other = k => k >= 0 && k < n && k !== i;
      if (m.act === 'peek' && me === 'werewolf') {
        if (st.start.filter(r => r === 'werewolf').length > 1) return 'Only a lone werewolf may look at the center.';
        const c = +m.c; if (!(c >= 0 && c < 3)) return;
        note(ctx, i, `The ${CENTER[c]} center card is ${label(st.cards[n + c])}.`);
        st.nightLog.push(`Lone werewolf ${name(i)} looked at the ${CENTER[c]} center card.`);
      } else if (m.act === 'seer' && me === 'seer') {
        if (m.p != null && m.p !== '') {
          const t = +m.p; if (!other(t)) return 'Pick another player.';
          note(ctx, i, `${name(t)}'s card is ${label(st.cards[t])}.`);
          st.nightLog.push(`Seer ${name(i)} looked at ${name(t)}'s card.`);
        } else {
          const cs = String(m.c || '').split(',').map(Number).filter(c => c >= 0 && c < 3);
          if (cs.length !== 2 || cs[0] === cs[1]) return 'Pick two center cards.';
          note(ctx, i, cs.map(c => `The ${CENTER[c]} center card is ${label(st.cards[n + c])}.`).join(' '));
          st.nightLog.push(`Seer ${name(i)} looked at two center cards.`);
        }
      } else if (m.act === 'rob' && me === 'robber') {
        st.robbed ||= {};
        if (st.robbed[i] != null) return 'You already swapped. Look at your new card, or not.';
        if (m.p === 'none') {
          note(ctx, i, 'You chose not to swap. You are still the Robber.');
          st.nightLog.push(`Robber ${name(i)} chose not to swap.`);
        } else {
          const t = +m.p; if (!other(t)) return 'Pick another player.';
          [st.cards[i], st.cards[t]] = [st.cards[t], st.cards[i]];
          st.robbed[i] = t;
          note(ctx, i, `You swapped cards with ${name(t)}.`);
          st.nightLog.push(`Robber ${name(i)} swapped cards with ${name(t)}.`);
          return;                                         // not done yet: look at the new card, or not
        }
      } else if (m.act === 'roblook' && me === 'robber') {
        if (!st.robbed || st.robbed[i] == null) return 'Swap first.';
        if (m.skip) note(ctx, i, 'You didn\'t look at your new card.');
        else { note(ctx, i, `Your new card is ${label(st.cards[i])}. You are now this role.`); st.nightLog.push(`Robber ${name(i)} looked at the new card.`); }
      } else if (m.act === 'swap' && me === 'troublemaker') {
        const [a, b] = String(m.ps || '').split(',').map(Number);
        if (!other(a) || !other(b) || a === b) return 'Pick two other players.';
        [st.cards[a], st.cards[b]] = [st.cards[b], st.cards[a]];
        note(ctx, i, `You swapped ${name(a)}'s and ${name(b)}'s cards.`);
        st.nightLog.push(`Troublemaker ${name(i)} swapped ${name(a)} and ${name(b)}.`);
      } else if (m.act === 'drunk' && me === 'drunk') {
        const c = +m.c; if (!(c >= 0 && c < 3)) return;
        return doDrunk(ctx, i, c);
      } else return 'Not now.';
      st.done.add(i);
    },
    hostAct(ctx, d) {
      if (d.host === 'vote' && ctx.state.phase === 'day') ctx.skip();
    },
    status(ctx) {
      const st = ctx.state;
      return st.phase === 'deal' ? 'Look at your role' : st.phase === 'night' ? '🌙 Night' : st.phase === 'day' ? '☀️ Day: discussion' : '🗳️ Vote';
    },
    view(ctx, i) {
      const st = ctx.state, n = ctx.players.length, me = st.start[i];
      const v = { phase: st.phase, role: me, roleName: R(me).name, icon: R(me).icon, text: R(me).text, notes: st.notes[i],
        players: ctx.players.map((p, k) => ({ i: k, name: p.name })).filter(p => p.i !== i), deckRoles: st.deck.map(label) };
      v.title = st.phase === 'deal' ? 'Your secret role' : st.phase === 'night' ? '🌙 Night' : st.phase === 'day' ? '☀️ Day' : '🗳️ Vote';
      if (st.phase === 'night') {
        v.awake = st.step === me;                       // your role's turn: eyes open
        v.done = st.done.has(i);
        v.loneWolf = me === 'werewolf' && st.start.filter(r => r === 'werewolf').length === 1;
        if (me === 'robber' && st.robbed && st.robbed[i] != null) v.robbedFrom = ctx.players[st.robbed[i]].name;
      }
      if (st.phase === 'day') { v.ready = st.ready.has(i); v.readyCount = st.ready.size; v.total = n; }
      if (st.phase === 'vote') v.voted = st.votes[i] ?? null;
      return v;
    },
    hostHTML(ctx, H) {
      const st = ctx.state;
      const roles = `<div class="sec-title">Roles in this game (${st.deck.length} cards: one each + 3 in the center)</div><div class="pills">${st.deck.map(r => `<span class="p">${label(r)}</span>`).join('')}</div>`;
      if (st.phase === 'deal') return `<div class="ww-sky day"><div class="ww-big">🃏</div><div class="big-line">Look at your secret role on your phone. Don't show anyone!</div></div>${roles}`;
      if (st.phase === 'night') return `<div class="ww-sky night"><div class="ww-big">🌙</div><div class="big-line">Everyone, eyes closed${st.step ? `… ${plural(st.step)} are awake` : '.'}</div></div>${roles}`;
      if (st.phase === 'day') return `<div class="ww-sky day"><div class="ww-big">☀️</div><div class="big-line">Who is a werewolf? Discuss!</div>
        <div class="note" style="text-align:center">Ready to vote: ${st.ready.size} of ${ctx.players.length}</div>
        <div style="text-align:center;margin-top:10px"><button class="btn primary" type="button" data-host="vote">Start the vote now</button></div></div>${roles}`;
      return `<div class="ww-sky day"><div class="ww-big">🗳️</div><div class="big-line">Vote on your phone!</div><div class="note" style="text-align:center">${Object.keys(st.votes).length} of ${ctx.players.length} votes in</div></div>${roles}`;
    },
    phoneNotify: (b, v) => v && b && b.phase !== v.phase && v.phase !== 'night',
    phoneLocal(d, v, local) {
      if (d.local === 'flip') local.shown = !local.shown;
      if (d.local === 'cc') { local.cc = local.cc || []; const c = +d.c; local.cc = local.cc.includes(c) ? local.cc.filter(x => x !== c) : [...local.cc, c].slice(-2); }
      if (d.local === 'pp') { local.pp = local.pp || []; const p = +d.p; local.pp = local.pp.includes(p) ? local.pp.filter(x => x !== p) : [...local.pp, p].slice(-2); }
    },
    phoneAct(m, v, local) { local.cc = []; local.pp = []; },
    phoneHTML(v, local, H) {
      const card = `<button type="button" class="ww-card${local.shown || v.phase !== 'deal' && v.phase !== 'night' ? '' : ' hidden'}" data-local="flip">
          <span class="ic">${local.shown ? v.icon : '❓'}</span><b>${local.shown ? v.roleName : 'Tap to see your role'}</b>${local.shown ? `<small>${H.esc(v.text)}</small>` : ''}</button>`;
      const notes = v.notes.length ? `<div class="sec-title">What you learned</div><div class="ww-notes">${v.notes.map(t => `<div>${H.esc(t)}</div>`).join('')}</div>` : '';
      const btns = (act, list, extra = '') => `<div class="choice">${list.map(([val, text]) => `<button type="button" data-act="${act}" ${extra}${val}>${text}</button>`).join('')}</div>`;
      const players = v.players.map(p => [`data-p="${p.i}"`, H.esc(p.name)]);
      const centers = [0, 1, 2].map(c => [`data-c="${c}"`, `${['⬅️ Left', '⏺ Middle', '➡️ Right'][c]} card`]);
      if (v.phase === 'deal') return `<p class="note">Look at your role, then hide it again. Keep it secret!</p>${card}`;
      if (v.phase === 'night') {
        if (!v.awake) return `<div class="ww-sleep">😴<b>Eyes closed</b><small>Wait for the moderator to call your role.</small></div>`;
        let ui = '';
        if (v.done) ui = '<p class="note">Done. Close your eyes when the moderator says so.</p>';
        else if (v.role === 'werewolf' && v.loneWolf) ui = `<p class="note">You may look at one center card:</p>${btns('peek', centers)}`;
        else if (v.role === 'seer') {
          const cc = local.cc || [];
          ui = `<p class="note">Look at one player's card…</p>${btns('seer', players)}<p class="note">…or pick two center cards:</p>
            <div class="choice">${[0, 1, 2].map(c => `<button type="button" data-local="cc" data-c="${c}" class="${cc.includes(c) ? 'on' : ''}">${['⬅️ Left', '⏺ Middle', '➡️ Right'][c]}</button>`).join('')}</div>
            <button class="go" type="button" data-act="seer" data-c="${cc.join(',')}" ${cc.length === 2 ? '' : 'disabled'}>Look at these two</button>`;
        } else if (v.role === 'robber') ui = v.robbedFrom
          ? `<p class="note">You took ${H.esc(v.robbedFrom)}'s card. Do you want to look at it?</p>
             <div class="choice"><button type="button" data-act="roblook">👀 Look at my new card</button><button type="button" data-act="roblook" data-skip="1">🙈 Don't look</button></div>`
          : `<p class="note">Swap your card with:</p>${btns('rob', players)}<div class="choice"><button type="button" data-act="rob" data-p="none">✋ Don't swap</button></div>`;
        else if (v.role === 'troublemaker') {
          const pp = local.pp || [];
          ui = `<p class="note">Pick two other players to swap:</p><div class="choice">${v.players.map(p => `<button type="button" data-local="pp" data-p="${p.i}" class="${pp.includes(p.i) ? 'on' : ''}">${H.esc(p.name)}</button>`).join('')}</div>
            <button class="go" type="button" data-act="swap" data-ps="${pp.join(',')}" ${pp.length === 2 ? '' : 'disabled'}>Swap their cards</button>`;
        } else if (v.role === 'drunk') ui = `<p class="note">Swap your card with a center card (you won't see it):</p>${btns('drunk', centers)}`;
        return `<div class="ww-awake">👀 <b>Your turn, ${H.esc(v.roleName)}</b></div>${notes}${ui}`;
      }
      if (v.phase === 'day') return `${card}${notes}<div class="sec-title">Roles in this game</div><div class="pills">${v.deckRoles.map(r => `<span class="p">${r}</span>`).join('')}</div>
        <button class="go${v.ready ? ' red' : ''}" type="button" data-act="ready">${v.ready ? 'Not ready yet' : 'Ready to vote'}</button><p class="note">${v.readyCount} of ${v.total} ready</p>`;
      return `${notes}<div class="sec-title">Vote: who is a werewolf?</div><div class="choice">${v.players.map(p => `<button type="button" data-act="vote" data-p="${p.i}" class="${v.voted === p.i ? 'on' : ''}">${H.esc(p.name)}</button>`).join('')}</div>
        <p class="note">${v.voted != null ? 'Vote saved. You can change it until time runs out.' : 'Tap a name to vote.'}</p>`;
    },
    css: `
      .ww-card { display: grid; justify-items: center; gap: 6px; width: 100%; padding: 22px 14px; border-radius: 16px; border: 2px solid var(--gold, #d4af37);
        background: linear-gradient(#2a1f45, #120d22); color: #fff; font: inherit; cursor: pointer; text-align: center; }
      .ww-card .ic { font-size: 3.4rem; } .ww-card b { font-size: 1.4rem; font-family: Georgia, serif; } .ww-card small { color: #d9d3f0; line-height: 1.4; }
      .ww-sleep, .ww-awake { display: grid; justify-items: center; gap: 4px; padding: 30px 10px; font-size: 2.6rem; text-align: center; }
      .ww-sleep b, .ww-awake b { font-size: 1.2rem; } .ww-sleep small { font-size: .9rem; color: var(--muted, #b9c4bc); }
      .ww-awake { font-size: 1.6rem; padding: 10px; color: var(--gold, #d4af37); }
      .ww-notes { display: grid; gap: 6px; } .ww-notes div { background: rgba(0,0,0,.3); border-left: 3px solid var(--gold, #d4af37); padding: 8px 10px; border-radius: 6px; }
      .ww-sky { border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 14px; }
      .ww-sky.night { background: radial-gradient(circle at 50% 20%, #2a3a6e, #0a0f24 70%); }
      .ww-sky.day { background: radial-gradient(circle at 50% 20%, rgba(255,213,79,.35), rgba(0,0,0,.2) 70%); }
      .ww-big { font-size: 5rem; line-height: 1.1; }
      .ww-head { font-family: Georgia, serif; font-size: 1.6rem; color: var(--gold, #d4af37); text-align: center; margin-bottom: 10px; }
      .ww-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: .9rem; }
      .ww-table th, .ww-table td { text-align: left; padding: 6px; border-bottom: 1px solid rgba(255,255,255,.12); }
      .ww-table th { color: var(--gold, #d4af37); font-size: .72rem; text-transform: uppercase; }`,
  };
})();
