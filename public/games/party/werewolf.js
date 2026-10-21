// One Night Ultimate Werewolf (with the Daybreak roles): the Mac is the moderator (it narrates the night);
// every player uses their own phone.
window.PARTY_GAME = (() => {
  // tier: 1 beginner (the official first-game set), 2 intermediate, 3 advanced. The official games don't label difficulty;
  // this follows their advice: start with the first-game set, add the other roles as you learn them,
  // keep the Doppelgänger (and the trickier Daybreak roles) for players who know the rest.
  const ROLES = {
    werewolf: { name: 'Werewolf', icon: '🐺', team: 'wolf', tier: 1, text: 'Wake with the other werewolves. A lone werewolf may look at one center card. You win if no werewolf dies.' },
    villager: { name: 'Villager', icon: '🧑‍🌾', team: 'village', tier: 1, text: 'No night action. Find the werewolves!' },
    seer: { name: 'Seer', icon: '🔮', team: 'village', tier: 1, text: 'Look at another player\'s card, or two of the center cards.' },
    robber: { name: 'Robber', icon: '🦝', team: 'village', tier: 1, text: 'You may swap your card with another player\'s (or not). After a swap you may look at your new card. You are now that role.' },
    troublemaker: { name: 'Troublemaker', icon: '😈', team: 'village', tier: 1, text: 'You may swap the cards of two other players without looking at them (or not).' },
    minion: { name: 'Minion', icon: '🦹', team: 'wolf', tier: 2, text: 'You see who the werewolves are (they don\'t see you). You win with the werewolves, even if you die.' },
    mason: { name: 'Mason', icon: '🧱', team: 'village', tier: 2, text: 'Wake with the other Mason and see each other.' },
    drunk: { name: 'Drunk', icon: '🍺', team: 'village', tier: 2, text: 'Swap your card with a center card without looking. You are now that role.' },
    insomniac: { name: 'Insomniac', icon: '🦉', team: 'village', tier: 2, text: 'At the end of the night, look at your own card to see if it changed.' },
    hunter: { name: 'Hunter', icon: '🏹', team: 'village', tier: 2, text: 'If you die, the player you voted for dies too.' },
    tanner: { name: 'Tanner', icon: '🪢', team: 'tanner', tier: 2, text: 'You hate your job. You win only if you die.' },
    mystic: { name: 'Mystic Wolf', icon: '🔮🐺', team: 'wolf', tier: 2, text: 'A werewolf. You wake with the werewolves, then you may look at one other player\'s card.' },
    dreamwolf: { name: 'Dream Wolf', icon: '💤🐺', team: 'wolf', tier: 2, text: 'A werewolf who sleeps through the night: the other werewolves see you, but you don\'t see them.' },
    apprentice: { name: 'Apprentice Seer', icon: '🕯️', team: 'village', tier: 2, text: 'You may look at one of the center cards.' },
    revealer: { name: 'Revealer', icon: '🔦', team: 'village', tier: 2, text: 'You may turn another player\'s card face up for everyone to see. If it\'s a werewolf or the Tanner, it stays hidden (only you see it).' },
    bodyguard: { name: 'Bodyguard', icon: '🛡️', team: 'village', tier: 2, text: 'No night action. Whoever you vote for cannot die; the player with the next most votes dies instead.' },
    doppelganger: { name: 'Doppelgänger', icon: '🎭', team: 'village', tier: 3, text: 'Look at another player\'s card and become that role: you do its night action and join its team.' },
    sentinel: { name: 'Sentinel', icon: '🗿', team: 'village', tier: 3, text: 'You may put a shield on another player\'s card. A shielded card can\'t be looked at or moved tonight.' },
    alpha: { name: 'Alpha Wolf', icon: '👑🐺', team: 'wolf', tier: 3, text: 'A werewolf. After the werewolves wake, you must give the extra center Werewolf card to a non-werewolf player (swapping it for theirs).' },
    pi: { name: 'Paranormal Investigator', icon: '🕵️', team: 'village', tier: 3, text: 'You may look at up to two other players\' cards, one at a time. If you see a werewolf or the Tanner, you stop and join that side.' },
    witch: { name: 'Witch', icon: '🧹', team: 'village', tier: 3, text: 'You may look at one center card. If you do, you must swap it with any player\'s card (even your own).' },
    idiot: { name: 'Village Idiot', icon: '🤪', team: 'village', tier: 3, text: 'You may move every other player\'s card one seat to the left or right (shielded cards stay).' },
  };
  const R = r => ROLES[r];
  const label = r => `${R(r).icon} ${R(r).name}`;
  const WOLVES = new Set(['werewolf', 'mystic', 'dreamwolf', 'alpha']);           // the werewolf team's werewolves
  const isWolf = r => WOLVES.has(r);
  const TIERS = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };
  const CENTER = ['left', 'middle', 'right'];

  // Night order (as in the official games); each step lasts the same time whether or not anyone holds the role
  const NIGHT = [
    ['sentinel', 'Sentinel, wake up. You may place a shield on another player\'s card.', 'Sentinel, close your eyes.'],
    ['doppelganger', 'Doppelgänger, wake up and look at another player\'s card. You are now that role. If your new role acts at night, do it now.', 'Doppelgänger, close your eyes.'],
    ['werewolf', 'Werewolves, wake up and look for other werewolves. If you are the only werewolf, you may look at a card from the center.', 'Werewolves, close your eyes.'],
    ['alpha', 'Alpha Wolf, wake up and give the center werewolf card to a player who is not a werewolf.', 'Alpha Wolf, close your eyes.'],
    ['mystic', 'Mystic Wolf, wake up. You may look at another player\'s card.', 'Mystic Wolf, close your eyes.'],
    ['minion', 'Minion, wake up. Werewolves, keep your eyes closed. Minion, look at your phone to see who the werewolves are.', 'Minion, close your eyes.'],
    ['mason', 'Masons, wake up and look for the other mason.', 'Masons, close your eyes.'],
    ['seer', 'Seer, wake up. You may look at another player\'s card, or two of the center cards.', 'Seer, close your eyes.'],
    ['apprentice', 'Apprentice Seer, wake up. You may look at one of the center cards.', 'Apprentice Seer, close your eyes.'],
    ['pi', 'Paranormal Investigator, wake up. You may look at up to two other players\' cards.', 'Paranormal Investigator, close your eyes.'],
    ['robber', 'Robber, wake up. You may exchange your card with another player\'s card, and then view your new card.', 'Robber, close your eyes.'],
    ['witch', 'Witch, wake up. You may look at one of the center cards. If you do, you must exchange it with any player\'s card.', 'Witch, close your eyes.'],
    ['troublemaker', 'Troublemaker, wake up. You may exchange cards between two other players.', 'Troublemaker, close your eyes.'],
    ['idiot', 'Village Idiot, wake up. You may move everyone\'s card but your own one place to the left or the right.', 'Village Idiot, close your eyes.'],
    ['drunk', 'Drunk, wake up and exchange your card with a card from the center.', 'Drunk, close your eyes.'],
    ['insomniac', 'Insomniac, wake up and look at your card.', 'Insomniac, close your eyes.'],
    ['revealer', 'Revealer, wake up. You may flip another player\'s card face up.', 'Revealer, close your eyes.'],
  ];
  const plural = r => r === 'werewolf' ? 'Werewolves' : r === 'mason' ? 'Masons' : R(r).name;
  // What a Doppelgänger does after copying a role: act right away, or wake again with that role later
  const DOPPEL_NOW = new Set(['seer', 'apprentice', 'pi', 'robber', 'witch', 'troublemaker', 'idiot', 'drunk', 'sentinel', 'alpha', 'mystic']);
  const DOPPEL_LATER = { werewolf: 'werewolf', alpha: 'werewolf', mystic: 'werewolf', minion: 'minion', mason: 'mason', insomniac: 'insomniac', revealer: 'revealer' };

  // Which roles players can add, by difficulty (the first-game set is always in)
  const OPTIONAL = ['minion', 'mason', 'drunk', 'insomniac', 'hunter', 'tanner', 'mystic', 'dreamwolf', 'apprentice', 'revealer', 'bodyguard',
    'doppelganger', 'sentinel', 'alpha', 'pi', 'witch', 'idiot'];
  // The deck: 2 werewolves, Seer, Robber, Troublemaker, the chosen extras, villagers to fill (players + 3 cards).
  // Special werewolves (Mystic, Dream, Alpha) replace the plain Werewolf cards first. If there are too many extras for
  // the table, the hardest are left out first. The Alpha Wolf also brings an extra Werewolf card for the center.
  function buildDeck(n, extras) {
    const chosen = OPTIONAL.filter(r => extras.includes(r));
    const deck = ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker'];
    for (const r of chosen) {
      if (isWolf(r)) { const k = deck.indexOf('werewolf'); if (k >= 0) { deck[k] = r; continue; } }
      if (r === 'mason') deck.push('mason', 'mason'); else deck.push(r);
    }
    while (deck.length > n + 3) {                          // too many extras: drop the most advanced (latest in the list) first
      const k = deck.reduce((best, r, i) => (OPTIONAL.includes(r) && !(isWolf(r) && deck.filter(isWolf).length <= 2) && (best < 0 || OPTIONAL.indexOf(r) >= OPTIONAL.indexOf(deck[best])) ? i : best), -1);
      if (k < 0) break;
      if (deck[k] === 'mason') deck.splice(deck.indexOf('mason'), 2); else deck.splice(k, 1);
    }
    while (deck.length < n + 3) deck.push('villager');
    return deck.slice(0, n + 3);
  }

  /* ---------- Helpers on the state ---------- */
  const players = ctx => ctx.players.map((_, k) => k);
  const shielded = (st, k) => (st.shields || []).includes(k);
  // Who holds which role for the night steps (the Doppelgänger counts as the role it copied, where that role wakes later)
  function wakesAt(st, i, step) {
    const me = st.start[i];
    if (me === step) return true;
    if (step === 'werewolf' && (me === 'alpha' || me === 'mystic')) return true;          // special wolves wake with the werewolves
    return me === 'doppelganger' && st.dop?.copied && DOPPEL_LATER[st.dop.copied] === step;
  }
  // The role a player acts as right now (a Doppelgänger in its own step acts as the role it copied)
  function actingRole(st, i) {
    if (st.phase !== 'night' || !st.step) return null;
    const me = st.start[i];
    if (st.step === 'doppelganger' && me === 'doppelganger') return st.dop?.copied && DOPPEL_NOW.has(st.dop.copied) ? st.dop.copied : 'doppelganger';
    if (!wakesAt(st, i, st.step)) return null;
    return st.step;
  }
  // Werewolves known to the others: everyone who started as a werewolf (Dream Wolf included) and a Doppelgänger that became one
  const knownWolves = (ctx, st) => players(ctx).filter(k => isWolf(st.start[k]) || (st.start[k] === 'doppelganger' && isWolf(st.dop?.copied)));
  // The role a card counts as at the end (a Doppelgänger is what it copied; a Paranormal Investigator may have changed side)
  const finalRole = (st, card) => st.becomes?.[card] || card;
  function note(ctx, i, text) { ctx.state.notes[i].push(text); }
  const nm = (ctx, k) => ctx.players[k].name;

  async function night(ctx) {
    const st = ctx.state, inDeck = new Set(st.deck);
    st.phase = 'night';
    ctx.update();
    await ctx.say('Everyone, close your eyes.', 'sweep');
    await ctx.wait(1500);
    for (const [role, wake, sleep] of NIGHT) {
      if (!inDeck.has(role) && !(role === 'werewolf' && [...inDeck].some(isWolf))) continue;
      st.step = role; st.done = new Set();
      ctx.log(`🌙 ${plural(role)} wake${role === 'werewolf' || role === 'mason' ? '' : 's'} up.`);
      players(ctx).forEach(i => { if (wakesAt(st, i, role)) wakeInfo(ctx, i, role); });
      ctx.update();
      await ctx.say(wake);
      await ctx.countdown(role === 'doppelganger' ? st.actionTime * 2 : st.actionTime, plural(role));
      timeUp(ctx, role);
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
  // Information a role gets as soon as it wakes
  function wakeInfo(ctx, i, role) {
    const st = ctx.state, names = ks => ks.map(k => nm(ctx, k)).join(', ');
    if (role === 'werewolf') {
      const others = knownWolves(ctx, st).filter(k => k !== i);
      note(ctx, i, others.length ? `The other werewolves: ${names(others)}.` : 'You are the only werewolf. You may look at one center card.');
    }
    if (role === 'minion') {
      const wolves = knownWolves(ctx, st);
      note(ctx, i, wolves.length ? `The werewolves are: ${names(wolves)}.` : 'There are no werewolves among the players! You win if anyone else dies.');
    }
    if (role === 'mason') {
      const others = players(ctx).filter(k => k !== i && wakesAt(st, k, 'mason'));
      note(ctx, i, others.length ? `The other mason: ${names(others)}.` : 'You are the only mason (the other is in the center).');
    }
    if (role === 'insomniac') note(ctx, i, `At the end of the night your card is: ${label(st.cards[i])}.`);
  }
  // Roles that must act: if time runs out, the game does it for them
  function timeUp(ctx, role) {
    const st = ctx.state;
    players(ctx).forEach(i => {
      if (st.done.has(i)) return;
      const acting = actingRole(st, i);
      if (role === 'doppelganger' && st.start[i] === 'doppelganger' && !st.dop) {
        const pick = players(ctx).filter(k => k !== i && !shielded(st, k));
        if (pick.length) doDoppel(ctx, i, pick[ctx.rand(pick.length)]);
      }
      const a = actingRole(st, i) || acting;
      if (a === 'drunk' && !shielded(st, i)) doDrunk(ctx, i, ctx.rand(3));
      if (a === 'alpha' && st.alphaCard != null) {
        const pick = players(ctx).filter(k => !isWolf(st.cards[k]) && !shielded(st, k));
        if (pick.length) doAlpha(ctx, i, pick[ctx.rand(pick.length)]);
      }
      if (a === 'witch' && st.witch?.[i] != null) doWitchSwap(ctx, i, i);
    });
  }
  function doDoppel(ctx, i, t) {
    const st = ctx.state, copied = st.cards[t];
    st.dop = { i, copied }; st.becomes = { ...st.becomes, doppelganger: copied };
    note(ctx, i, `You looked at ${nm(ctx, t)}'s card: ${label(copied)}. You are now the ${R(copied).name}.` +
      (DOPPEL_NOW.has(copied) ? ' Do its night action now.' : DOPPEL_LATER[copied] ? ` You'll wake again with the ${plural(DOPPEL_LATER[copied])}.` : ''));
    st.nightLog.push(`Doppelgänger ${nm(ctx, i)} copied ${nm(ctx, t)}: ${R(copied).name}.`);
    if (!DOPPEL_NOW.has(copied)) st.done.add(i);
  }
  function doDrunk(ctx, i, c) {
    const st = ctx.state, n = ctx.players.length;
    [st.cards[i], st.cards[n + c]] = [st.cards[n + c], st.cards[i]];
    st.done.add(i);
    note(ctx, i, `You swapped your card with the ${CENTER[c]} center card (you don't know what you are now).`);
    st.nightLog.push(`Drunk ${nm(ctx, i)} swapped with the ${CENTER[c]} center card.`);
  }
  function doAlpha(ctx, i, t) {
    const st = ctx.state, a = st.alphaCard;
    [st.cards[t], st.cards[a]] = [st.cards[a], st.cards[t]];
    st.alphaCard = null; st.done.add(i);
    note(ctx, i, `You gave the center Werewolf card to ${nm(ctx, t)}. They are a werewolf now.`);
    st.nightLog.push(`Alpha Wolf ${nm(ctx, i)} turned ${nm(ctx, t)} into a werewolf.`);
  }
  function doWitchSwap(ctx, i, t) {
    const st = ctx.state, c = st.witch[i], n = ctx.players.length;
    [st.cards[t], st.cards[n + c]] = [st.cards[n + c], st.cards[t]];
    st.witch[i] = null; st.done.add(i);
    note(ctx, i, t === i ? `You took the ${CENTER[c]} center card for yourself.` : `You gave the ${CENTER[c]} center card to ${nm(ctx, t)}.`);
    st.nightLog.push(`Witch ${nm(ctx, i)} swapped the ${CENTER[c]} center card with ${t === i ? 'her own' : nm(ctx, t) + "'s"}.`);
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
    const final = st.cards.slice(0, n).map(c => finalRole(st, c));
    // the Bodyguard's vote protects that player: the most votes among everyone else decides
    const guarded = new Set(players(ctx).filter(k => final[k] === 'bodyguard' && st.votes[k] != null).map(k => st.votes[k]));
    const tally = Array(n).fill(0);
    Object.values(st.votes).forEach(t => tally[t]++);
    const open = tally.map((v, k) => (guarded.has(k) ? 0 : v));
    const top = Math.max(...open);
    const dead = new Set(top >= 2 ? open.map((v, k) => v === top ? k : -1).filter(k => k >= 0) : []);
    [...dead].forEach(k => { if (final[k] === 'hunter' && st.votes[k] != null && !guarded.has(st.votes[k])) dead.add(st.votes[k]); });   // the Hunter takes someone with them
    const wolves = players(ctx).filter(k => isWolf(final[k]));
    const wolfDied = wolves.some(k => dead.has(k));
    const tannerDied = [...dead].some(k => final[k] === 'tanner');
    const minions = players(ctx).filter(k => final[k] === 'minion');
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
    const shown = (card) => finalRole(st, card) !== card ? `${label(card)} <span class="note">(as ${R(finalRole(st, card)).name})</span>` : label(card);
    const esc = PartyKit.esc;
    const html = `<div class="ww-head">${headline}</div>
      <table class="ww-table"><thead><tr><th>Player</th><th>Started as</th><th>Ended as</th><th>Votes</th><th></th></tr></thead><tbody>
      ${ctx.players.map((p, k) => `<tr><td><b>${esc(p.name)}</b></td><td>${label(st.start[k])}</td><td>${shown(st.cards[k])}</td><td>${tally[k]}${st.votes[k] != null ? ` <span class="note">→ ${esc(ctx.players[st.votes[k]].name)}</span>` : ''}${guarded.has(k) ? ' 🛡️' : ''}</td><td>${dead.has(k) ? '💀' : ''}</td></tr>`).join('')}
      </tbody></table>
      <div class="note">Center cards: ${st.cards.slice(n, n + 3).map(label).join(' · ')}${st.cards.length > n + 3 ? ` · Alpha Wolf's center card: ${label(st.cards[n + 3])}` : ''}</div>
      <div class="sec-title">What happened in the night</div><div class="note">${st.nightLog.map(esc).join('<br>') || 'Nobody changed anything.'}</div>`;
    ctx.log(`🗳️ ${dead.size ? [...dead].map(k => nm(ctx, k)).join(', ') + ' died.' : 'Nobody died.'} ${headline}`);
    ctx.say(`${dead.size ? [...dead].map(k => `${nm(ctx, k)}, the ${R(final[k]).name},`).join(' and ') + ' died.' : 'Nobody died.'} ${headline}`, 'wave');
    ctx.end(ctx.players.map((p, k) => ({ name: p.name, won: won(k), note: `${R(st.start[k]).name}${final[k] !== st.start[k] ? ' → ' + R(final[k]).name : ''}${dead.has(k) ? ' · died' : ''}` })), html);
  }

  const tierChoices = t => OPTIONAL.filter(r => R(r).tier === t).map(r => [r, `${R(r).icon} ${R(r).name}${r === 'mason' ? ' ×2' : ''}`, R(r).text]);
  const roleGuide = t => Object.keys(ROLES).filter(r => R(r).tier === t).map(r => `${R(r).icon} <b>${R(r).name}</b>: ${R(r).text}`).join('<br>');

  return {
    _test: { buildDeck, reveal, ROLES, OPTIONAL, NIGHT, timeUp },   // internals, for the unit tests only (test/unit)
    id: 'werewolf', name: 'One Night Werewolf', min: 3, max: 10, macRole: 'moderator',
    blurb: 'One night, one vote. Everyone gets a secret role on their phone; the Mac narrates the night. Find a werewolf in the vote and the village wins. 3–10 players.',
    options: [
      { key: 'extras', type: 'checks', def: ['minion', 'insomniac'],
        label: 'Roles. Always in (Beginner): 🐺🐺 2 Werewolves, 🔮 Seer, 🦝 Robber, 😈 Troublemaker; 🧑‍🌾 Villagers fill the rest.',
        groups: [
          { title: 'Intermediate', note: 'The rest of the original game, plus the easier Daybreak roles. Add a few at a time.', choices: tierChoices(2) },
          { title: 'Advanced', note: 'For players who know the others. Special werewolves replace the plain Werewolf cards.', choices: tierChoices(3) },
        ] },
      { key: 'talk', label: 'Day discussion', def: 300, choices: [[180, '3 minutes'], [300, '5 minutes'], [420, '7 minutes'], [600, '10 minutes']] },
      { key: 'actionTime', label: 'Time for each night role', def: 15, choices: [[10, '10 seconds'], [15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds']] },
    ],
    rules: [
      '<b>Setup:</b> there are 3 more role cards than players. Each phone shows its player\'s secret role; the other 3 go to the center. Roles in the game are shown on the Mac.',
      '<b>Night:</b> everyone closes their eyes. The Mac calls each role in turn; when your role is called, open your eyes and use your phone (quietly!). Each call lasts the same time even if that card is in the center.',
      `<b>Beginner roles</b> (the official first game):<br>${roleGuide(1)}`,
      `<b>Intermediate roles:</b><br>${roleGuide(2)}`,
      `<b>Advanced roles:</b><br>${roleGuide(3)}`,
      '<b>Your card may change in the night!</b> You are on the team of the card in front of you at the end, which might not be the one you started with.',
      '<b>Day:</b> talk, accuse, lie. Then everyone votes on their phone. The player with the most votes dies (ties: all of them). If nobody gets more than one vote, nobody dies.',
      '<b>Winning:</b> the village wins if at least one werewolf dies (or if there are no werewolves among the players and nobody dies). The werewolves (and minion) win if no werewolf dies. The Tanner wins by dying, and then the werewolves can\'t win.',
      '<b>About the levels:</b> the official games don\'t grade roles; Beginner is their recommended first game, and Advanced follows their advice to add the Doppelgänger (and the trickier Daybreak roles) once everyone knows the rest.',
    ],
    _reveal: reveal,                                    // (for tests: settle the vote straight away)
    async start(ctx) {
      const n = ctx.players.length, o = ctx.opts;
      const deck = buildDeck(n, o.extras || []);
      const cards = ctx.shuffle(deck.slice());
      if (deck.includes('alpha')) cards.push('werewolf');   // the Alpha Wolf's extra center Werewolf card
      ctx.state = { deck, cards, start: cards.slice(0, n), phase: 'deal', step: null, done: new Set(), notes: ctx.players.map(() => []), nightLog: [],
        talk: o.talk || 300, actionTime: o.actionTime || 15, voteTime: 60, ready: new Set(), votes: {},
        shields: [], dop: null, becomes: {}, revealed: {}, witch: {}, pi: {}, alphaCard: deck.includes('alpha') ? n + 3 : null };
      ctx.log(`Roles: ${deck.map(r => R(r).name).join(', ')}${deck.includes('alpha') ? ' (+ the Alpha Wolf\'s center Werewolf card)' : ''}.`);
      ctx.update();
      await ctx.say('Welcome to One Night Werewolf. Look at your phone to see your role, and keep it secret!', 'welcome');
      await ctx.countdown(20, 'Look at your role');
      await night(ctx);
    },
    act(ctx, i, m) {
      const st = ctx.state, n = ctx.players.length;
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
      // night actions: only for the role you act as during its step, once
      st.robbed ||= {}; st.witch ||= {}; st.pi ||= {}; st.revealed ||= {}; st.becomes ||= {};
      const role = actingRole(st, i);
      if (!role || st.done.has(i)) return 'Not now.';
      const other = k => k >= 0 && k < n && k !== i;
      const free = k => !shielded(st, k);
      const center = c => c >= 0 && c < 3;
      const who = R(role).name + (st.start[i] === 'doppelganger' && role !== 'doppelganger' ? ' (Doppelgänger)' : '');
      if (m.act === 'pass') {
        if (['doppelganger', 'drunk', 'alpha'].includes(role)) return 'You must do this one.';
        if (role === 'witch' && st.witch[i] != null) return 'You looked, so now you must swap that card with someone.';
        note(ctx, i, role === 'pi' && st.pi[i]?.length ? 'You stopped looking.' : 'You did nothing tonight.');
      } else if (m.act === 'dopple' && role === 'doppelganger') {
        const t = +m.p; if (!other(t)) return 'Pick another player.';
        if (!free(t)) return 'That card is shielded.';
        doDoppel(ctx, i, t);
        return;                                           // its copied action (if any) comes next
      } else if (m.act === 'shield' && role === 'sentinel') {
        const t = +m.p; if (!other(t)) return 'Pick another player.';
        if (shielded(st, t)) return 'That card already has a shield.';
        (st.shields ||= []).push(t);
        note(ctx, i, `You put a shield on ${nm(ctx, t)}'s card.`);
        st.nightLog.push(`${who} ${nm(ctx, i)} shielded ${nm(ctx, t)}'s card.`);
      } else if (m.act === 'peek' && role === 'werewolf') {
        if (knownWolves(ctx, st).filter(k => k !== i).length) return 'Only a lone werewolf may look at the center.';
        const c = +m.c; if (!center(c)) return;
        note(ctx, i, `The ${CENTER[c]} center card is ${label(st.cards[n + c])}.`);
        st.nightLog.push(`Lone werewolf ${nm(ctx, i)} looked at the ${CENTER[c]} center card.`);
      } else if (m.act === 'alpha' && role === 'alpha') {
        const t = +m.p; if (!other(t)) return 'Pick another player.';
        if (!free(t)) return 'That card is shielded.';
        if (isWolf(st.cards[t])) return 'Pick a player who is not a werewolf.';
        if (st.alphaCard == null) return 'The center werewolf card is already given out.';
        return doAlpha(ctx, i, t);
      } else if (m.act === 'mystic' && role === 'mystic') {
        const t = +m.p; if (!other(t)) return 'Pick another player.';
        if (!free(t)) return 'That card is shielded.';
        note(ctx, i, `${nm(ctx, t)}'s card is ${label(st.cards[t])}.`);
        st.nightLog.push(`${who} ${nm(ctx, i)} looked at ${nm(ctx, t)}'s card.`);
      } else if (m.act === 'seer' && role === 'seer') {
        if (m.p != null && m.p !== '') {
          const t = +m.p; if (!other(t)) return 'Pick another player.';
          if (!free(t)) return 'That card is shielded.';
          note(ctx, i, `${nm(ctx, t)}'s card is ${label(st.cards[t])}.`);
          st.nightLog.push(`${who} ${nm(ctx, i)} looked at ${nm(ctx, t)}'s card.`);
        } else {
          const cs = String(m.c || '').split(',').map(Number).filter(center);
          if (cs.length !== 2 || cs[0] === cs[1]) return 'Pick two center cards.';
          note(ctx, i, cs.map(c => `The ${CENTER[c]} center card is ${label(st.cards[n + c])}.`).join(' '));
          st.nightLog.push(`${who} ${nm(ctx, i)} looked at two center cards.`);
        }
      } else if (m.act === 'apprentice' && role === 'apprentice') {
        const c = +m.c; if (!center(c)) return;
        note(ctx, i, `The ${CENTER[c]} center card is ${label(st.cards[n + c])}.`);
        st.nightLog.push(`${who} ${nm(ctx, i)} looked at the ${CENTER[c]} center card.`);
      } else if (m.act === 'pi' && role === 'pi') {
        const looked = st.pi[i] ||= [];
        const t = +m.p; if (!other(t) || looked.includes(t)) return 'Pick another player.';
        if (!free(t)) return 'That card is shielded.';
        looked.push(t);
        const card = st.cards[t];
        note(ctx, i, `${nm(ctx, t)}'s card is ${label(card)}.`);
        st.nightLog.push(`${who} ${nm(ctx, i)} looked at ${nm(ctx, t)}'s card.`);
        if (isWolf(card) || card === 'tanner') {
          const side = isWolf(card) ? 'werewolf' : 'tanner';
          st.becomes[st.start[i] === 'doppelganger' ? 'doppelganger' : 'pi'] = side;
          note(ctx, i, side === 'werewolf' ? 'You saw a werewolf: you are a werewolf now!' : 'You saw the Tanner: you are a Tanner now (you win only if you die).');
          st.nightLog.push(`${who} ${nm(ctx, i)} became a ${side === 'werewolf' ? 'werewolf' : 'Tanner'}.`);
        } else if (looked.length < 2) return;             // may look at one more
      } else if (m.act === 'rob' && role === 'robber') {
        if (st.robbed[i] != null) return 'You already swapped. Look at your new card, or not.';
        if (m.p === 'none') {
          note(ctx, i, 'You chose not to swap. You are still the Robber.');
          st.nightLog.push(`${who} ${nm(ctx, i)} chose not to swap.`);
        } else {
          const t = +m.p; if (!other(t)) return 'Pick another player.';
          if (!free(t) || !free(i)) return 'That card is shielded.';
          [st.cards[i], st.cards[t]] = [st.cards[t], st.cards[i]];
          st.robbed[i] = t;
          note(ctx, i, `You swapped cards with ${nm(ctx, t)}.`);
          st.nightLog.push(`${who} ${nm(ctx, i)} swapped cards with ${nm(ctx, t)}.`);
          return;                                         // not done yet: look at the new card, or not
        }
      } else if (m.act === 'roblook' && role === 'robber') {
        if (st.robbed[i] == null) return 'Swap first.';
        if (m.skip) note(ctx, i, 'You didn\'t look at your new card.');
        else { note(ctx, i, `Your new card is ${label(st.cards[i])}. You are now this role.`); st.nightLog.push(`${who} ${nm(ctx, i)} looked at the new card.`); }
      } else if (m.act === 'witchlook' && role === 'witch') {
        if (st.witch[i] != null) return 'You already looked.';
        const c = +m.c; if (!center(c)) return;
        st.witch[i] = c;
        note(ctx, i, `The ${CENTER[c]} center card is ${label(st.cards[n + c])}. Now give it to any player (or yourself).`);
        return;
      } else if (m.act === 'witchswap' && role === 'witch') {
        if (st.witch[i] == null) return 'Look at a center card first.';
        const t = +m.p; if (!(t >= 0 && t < n)) return 'Pick a player.';
        if (!free(t)) return 'That card is shielded.';
        return doWitchSwap(ctx, i, t);
      } else if (m.act === 'swap' && role === 'troublemaker') {
        if (m.ps === 'none') {
          note(ctx, i, 'You chose not to swap anyone.');
          st.nightLog.push(`${who} ${nm(ctx, i)} chose not to swap.`);
        } else {
          const [a, b] = String(m.ps || '').split(',').map(Number);
          if (!other(a) || !other(b) || a === b) return 'Pick two other players.';
          if (!free(a) || !free(b)) return 'One of those cards is shielded.';
          [st.cards[a], st.cards[b]] = [st.cards[b], st.cards[a]];
          note(ctx, i, `You swapped ${nm(ctx, a)}'s and ${nm(ctx, b)}'s cards.`);
          st.nightLog.push(`${who} ${nm(ctx, i)} swapped ${nm(ctx, a)} and ${nm(ctx, b)}.`);
        }
      } else if (m.act === 'idiot' && role === 'idiot') {
        const dir = m.dir === 'left' ? -1 : m.dir === 'right' ? 1 : 0;
        if (!dir) return 'Pick left or right.';
        const seats = players(ctx).filter(k => k !== i && free(k));            // everyone else's card, except shielded ones
        const before = seats.map(k => st.cards[k]);
        seats.forEach((k, j) => { st.cards[seats[(j + dir + seats.length) % seats.length]] = before[j]; });
        note(ctx, i, `You moved everyone else's card one seat to the ${m.dir}.`);
        st.nightLog.push(`${who} ${nm(ctx, i)} moved everyone's cards to the ${m.dir}.`);
      } else if (m.act === 'drunk' && role === 'drunk') {
        const c = +m.c; if (!center(c)) return;
        if (!free(i)) return 'Your card is shielded: it can\'t move.';
        return doDrunk(ctx, i, c);
      } else if (m.act === 'reveal' && role === 'revealer') {
        const t = +m.p; if (!other(t)) return 'Pick another player.';
        if (!free(t)) return 'That card is shielded.';
        const card = st.cards[t];
        if (isWolf(card) || card === 'tanner') {
          note(ctx, i, `${nm(ctx, t)}'s card is ${label(card)}, so you turned it face down again.`);
          st.nightLog.push(`${who} ${nm(ctx, i)} saw ${nm(ctx, t)}'s card and turned it back face down.`);
        } else {
          st.revealed[t] = card;
          note(ctx, i, `You turned ${nm(ctx, t)}'s card face up: ${label(card)}.`);
          st.nightLog.push(`${who} ${nm(ctx, i)} turned ${nm(ctx, t)}'s card face up.`);
        }
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
      const v = { phase: st.phase, role: me, roleName: R(me).name, icon: R(me).icon, text: R(me).text, tier: TIERS[R(me).tier], notes: st.notes[i],
        players: ctx.players.map((p, k) => ({ i: k, name: p.name, shielded: shielded(st, k) })).filter(p => p.i !== i), all: ctx.players.map((p, k) => ({ i: k, name: p.name })),
        deckRoles: st.deck.map(label), revealed: Object.entries(st.revealed || {}).map(([k, r]) => `${ctx.players[k].name}: ${label(r)}`) };
      v.title = st.phase === 'deal' ? 'Your secret role' : st.phase === 'night' ? '🌙 Night' : st.phase === 'day' ? '☀️ Day' : '🗳️ Vote';
      if (st.phase === 'night') {
        const role = actingRole(st, i);
        v.awake = !!role; v.acting = role; v.actingName = role && R(role).name; v.done = st.done.has(i);
        v.loneWolf = role === 'werewolf' && !knownWolves(ctx, st).filter(k => k !== i).length;
        if (role === 'robber' && st.robbed?.[i] != null) v.robbedFrom = ctx.players[st.robbed[i]].name;
        if (role === 'witch') v.witchLooked = st.witch?.[i] != null;
        if (role === 'pi') v.piLooked = (st.pi?.[i] || []).length;
        if (role === 'alpha') v.alphaAvailable = st.alphaCard != null;
        if (role === 'alpha') v.nonWolves = players(ctx).filter(k => k !== i && !isWolf(st.cards[k]) && !shielded(st, k)).map(k => ({ i: k, name: ctx.players[k].name }));
      }
      if (st.phase === 'day') { v.ready = st.ready.has(i); v.readyCount = st.ready.size; v.total = n; }
      if (st.phase === 'vote') v.voted = st.votes[i] ?? null;
      return v;
    },
    hostHTML(ctx, H) {
      const st = ctx.state;
      const roles = `<div class="sec-title">Roles in this game (${st.deck.length} cards: one each + 3 in the center${st.deck.includes('alpha') ? ', + the Alpha Wolf\'s center Werewolf' : ''})</div><div class="pills">${st.deck.map(r => `<span class="p">${label(r)}</span>`).join('')}</div>`;
      const faceUp = Object.entries(st.revealed || {}).map(([k, r]) => `<span class="p">🔦 ${H.esc(ctx.players[k].name)}: ${label(r)}</span>`).join('');
      const up = faceUp && st.phase !== 'night' ? `<div class="sec-title">Face-up cards</div><div class="pills">${faceUp}</div>` : '';
      if (st.phase === 'deal') return `<div class="ww-sky day"><div class="ww-big">🃏</div><div class="big-line">Look at your secret role on your phone. Don't show anyone!</div></div>${roles}`;
      if (st.phase === 'night') return `<div class="ww-sky night"><div class="ww-big">🌙</div><div class="big-line">Everyone, eyes closed${st.step ? `… the ${plural(st.step)} ${st.step === 'werewolf' || st.step === 'mason' ? 'are' : 'is'} awake` : '.'}</div></div>${roles}`;
      if (st.phase === 'day') return `<div class="ww-sky day"><div class="ww-big">☀️</div><div class="big-line">Who is a werewolf? Discuss!</div>
        <div class="note" style="text-align:center">Ready to vote: ${st.ready.size} of ${ctx.players.length}</div>
        <div style="text-align:center;margin-top:10px"><button class="btn primary" type="button" data-host="vote">Start the vote now</button></div></div>${up}${roles}`;
      return `<div class="ww-sky day"><div class="ww-big">🗳️</div><div class="big-line">Vote on your phone!</div><div class="note" style="text-align:center">${Object.keys(st.votes).length} of ${ctx.players.length} votes in</div></div>${up}${roles}`;
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
          <span class="ic">${local.shown ? v.icon : '❓'}</span><b>${local.shown ? v.roleName : 'Tap to see your role'}</b>${local.shown ? `<small>${H.esc(v.text)}</small><em class="ww-tier">${v.tier}</em>` : ''}</button>`;
      const notes = v.notes.length ? `<div class="sec-title">What you learned</div><div class="ww-notes">${v.notes.map(t => `<div>${H.esc(t)}</div>`).join('')}</div>` : '';
      const btns = (act, list, extra = '') => `<div class="choice">${list.map(([val, text, off]) => `<button type="button" data-act="${act}" ${extra}${val}${off ? ' disabled' : ''}>${text}</button>`).join('')}</div>`;
      const playersBtns = v.players.map(p => [`data-p="${p.i}"`, H.esc(p.name) + (p.shielded ? ' 🗿' : ''), p.shielded]);
      const centers = [0, 1, 2].map(c => [`data-c="${c}"`, `${['⬅️ Left', '⏺ Middle', '➡️ Right'][c]} card`]);
      const pass = text => `<div class="choice"><button type="button" data-act="pass">✋ ${text}</button></div>`;
      if (v.phase === 'deal') return `<p class="note">Look at your role, then hide it again. Keep it secret!</p>${card}`;
      if (v.phase === 'night') {
        if (!v.awake) return `<div class="ww-sleep">😴<b>Eyes closed</b><small>Wait for the moderator to call your role.</small></div>`;
        const a = v.acting;
        let ui = '';
        if (v.done) ui = '<p class="note">Done. Close your eyes when the moderator says so.</p>';
        else if (a === 'doppelganger') ui = `<p class="note">Look at another player's card and become that role:</p>${btns('dopple', playersBtns)}`;
        else if (a === 'sentinel') ui = `<p class="note">Put a shield on another player's card (it can't be looked at or moved tonight):</p>${btns('shield', playersBtns)}${pass("Don't shield anyone")}`;
        else if (a === 'werewolf' && v.loneWolf) ui = `<p class="note">You may look at one center card:</p>${btns('peek', centers)}${pass("Don't look")}`;
        else if (a === 'alpha') ui = v.alphaAvailable
          ? `<p class="note">Give the center Werewolf card to a player who isn't a werewolf (you must):</p>${btns('alpha', v.nonWolves.map(p => [`data-p="${p.i}"`, H.esc(p.name)]))}`
          : '<p class="note">The center Werewolf card was already given out tonight. Nothing to do.</p>';
        else if (a === 'mystic') ui = `<p class="note">You may look at another player's card:</p>${btns('mystic', playersBtns)}${pass("Don't look")}`;
        else if (a === 'seer') {
          const cc = local.cc || [];
          ui = `<p class="note">Look at one player's card…</p>${btns('seer', playersBtns)}<p class="note">…or pick two center cards:</p>
            <div class="choice">${[0, 1, 2].map(c => `<button type="button" data-local="cc" data-c="${c}" class="${cc.includes(c) ? 'on' : ''}">${['⬅️ Left', '⏺ Middle', '➡️ Right'][c]}</button>`).join('')}</div>
            <button class="go" type="button" data-act="seer" data-c="${cc.join(',')}" ${cc.length === 2 ? '' : 'disabled'}>Look at these two</button>${pass("Don't look")}`;
        } else if (a === 'apprentice') ui = `<p class="note">You may look at one center card:</p>${btns('apprentice', centers)}${pass("Don't look")}`;
        else if (a === 'pi') ui = `<p class="note">${v.piLooked ? 'You may look at one more card:' : 'You may look at up to two other players\' cards, one at a time:'}</p>${btns('pi', playersBtns)}${pass(v.piLooked ? 'Stop here' : "Don't look")}`;
        else if (a === 'robber') ui = v.robbedFrom
          ? `<p class="note">You took ${H.esc(v.robbedFrom)}'s card. Do you want to look at it?</p>
             <div class="choice"><button type="button" data-act="roblook">👀 Look at my new card</button><button type="button" data-act="roblook" data-skip="1">🙈 Don't look</button></div>`
          : `<p class="note">Swap your card with:</p>${btns('rob', playersBtns)}<div class="choice"><button type="button" data-act="rob" data-p="none">✋ Don't swap</button></div>`;
        else if (a === 'witch') ui = v.witchLooked
          ? `<p class="note">Give that center card to a player (or yourself):</p>${btns('witchswap', v.all.map(p => [`data-p="${p.i}"`, H.esc(p.name)]))}`
          : `<p class="note">You may look at one center card:</p>${btns('witchlook', centers)}${pass("Don't look")}`;
        else if (a === 'troublemaker') {
          const pp = local.pp || [];
          ui = `<p class="note">Pick two other players to swap:</p><div class="choice">${v.players.map(p => `<button type="button" data-local="pp" data-p="${p.i}" class="${pp.includes(p.i) ? 'on' : ''}"${p.shielded ? ' disabled' : ''}>${H.esc(p.name)}${p.shielded ? ' 🗿' : ''}</button>`).join('')}</div>
            <button class="go" type="button" data-act="swap" data-ps="${pp.join(',')}" ${pp.length === 2 ? '' : 'disabled'}>Swap their cards</button>
            <div class="choice"><button type="button" data-act="swap" data-ps="none">✋ Don't swap</button></div>`;
        } else if (a === 'idiot') ui = `<p class="note">Move everyone else's card one seat:</p><div class="choice"><button type="button" data-act="idiot" data-dir="left">⬅️ Left</button><button type="button" data-act="idiot" data-dir="right">➡️ Right</button></div>${pass("Don't move them")}`;
        else if (a === 'drunk') ui = `<p class="note">Swap your card with a center card (you won't see it):</p>${btns('drunk', centers)}`;
        else if (a === 'revealer') ui = `<p class="note">You may turn another player's card face up for everyone:</p>${btns('reveal', playersBtns)}${pass("Don't flip any")}`;
        const as = v.role === 'doppelganger' && a !== 'doppelganger' ? `Doppelgänger (as ${v.actingName})` : v.roleName;
        return `<div class="ww-awake">👀 <b>Your turn, ${H.esc(as)}</b></div>${notes}${ui}`;
      }
      const up = v.revealed.length ? `<div class="sec-title">Face-up cards</div><div class="pills">${v.revealed.map(r => `<span class="p">🔦 ${H.esc(r)}</span>`).join('')}</div>` : '';
      if (v.phase === 'day') return `${card}${notes}${up}<div class="sec-title">Roles in this game</div><div class="pills">${v.deckRoles.map(r => `<span class="p">${r}</span>`).join('')}</div>
        <button class="go${v.ready ? ' red' : ''}" type="button" data-act="ready">${v.ready ? 'Not ready yet' : 'Ready to vote'}</button><p class="note">${v.readyCount} of ${v.total} ready</p>`;
      return `${notes}${up}<div class="sec-title">Vote: who is a werewolf?</div><div class="choice">${v.players.map(p => `<button type="button" data-act="vote" data-p="${p.i}" class="${v.voted === p.i ? 'on' : ''}">${H.esc(p.name)}</button>`).join('')}</div>
        <p class="note">${v.voted != null ? 'Vote saved. You can change it until time runs out.' : 'Tap a name to vote.'}</p>`;
    },
    css: `
      .ww-card { display: grid; justify-items: center; gap: 6px; width: 100%; padding: 22px 14px; border-radius: 16px; border: 2px solid var(--gold, #d4af37);
        background: linear-gradient(#2a1f45, #120d22); color: #fff; font: inherit; cursor: pointer; text-align: center; }
      .ww-card .ic { font-size: 3.4rem; } .ww-card b { font-size: 1.4rem; font-family: Georgia, serif; } .ww-card small { color: #d9d3f0; line-height: 1.4; }
      .ww-card .ww-tier { font-style: normal; font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; color: var(--gold, #d4af37); }
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
