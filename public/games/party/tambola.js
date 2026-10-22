// Tambola (Housie): the Mac is the caller and every phone holds tickets. Numbers 1–90 are called at random;
// players mark them off and claim prizes (Early Five, the lines, Four Corners, Full House) before anyone else.
window.PARTY_GAME = (() => {
  /* ---------- Calling the numbers ---------- */
  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
    'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const words = n => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  // Traditional calls (the British bingo calls, as used in Housie and Tambola). Only family-friendly ones that are still
  // widely known; the other numbers are called by their digits ("four and seven, forty-seven").
  const NICK = {
    1: "Kelly's eye", 2: 'One little duck', 3: 'Cup of tea', 4: 'Knock at the door', 5: 'Man alive', 6: 'Half a dozen', 7: 'Lucky seven',
    8: 'Garden gate', 9: "Doctor's orders", 11: 'Legs eleven', 12: 'One dozen', 13: 'Unlucky for some', 14: "Valentine's Day",
    15: 'Young and keen', 16: 'Sweet sixteen', 17: 'Dancing queen', 18: 'Coming of age', 19: 'Goodbye, teens', 20: 'One score',
    21: 'Key of the door', 22: 'Two little ducks', 24: 'Two dozen', 25: 'Duck and dive', 26: 'Pick and mix', 28: 'In a state',
    29: 'Rise and shine', 31: 'Get up and run', 32: 'Buckle my shoe', 33: 'All the threes', 34: 'Ask for more', 35: 'Jump and jive',
    36: 'Three dozen', 38: 'Christmas cake', 39: 'Thirty-nine steps', 40: 'Life begins', 41: 'Time for fun', 42: 'Winnie the Pooh',
    44: 'All the fours', 45: 'Halfway there', 46: 'Up to tricks', 48: 'Four dozen', 50: 'Half a century', 52: 'Deck of cards',
    55: 'All the fives', 57: 'Heinz varieties', 58: 'Make them wait', 61: "Baker's bun", 62: 'Tickety-boo', 63: 'Tickle me',
    66: 'Clickety click', 67: 'Stairway to heaven', 68: 'Pick a mate', 69: 'Any way up', 70: 'Three score and ten', 71: 'Bang on the drum',
    73: 'Queen bee', 74: 'Hit the floor', 76: 'Trombones', 77: 'Sunset strip', 79: 'One more time', 82: 'Straight on through',
    83: 'Time for tea', 84: 'Give me more', 85: 'Staying alive', 86: 'Between the sticks', 89: 'Nearly there', 90: 'Top of the house',
  };
  // What the caller says: "Kelly's eye, number one." / "Four and seven, forty-seven." / plain: "Number forty-seven."
  function callText(n, style = 'nick') {
    if (style === 'plain') return `Number ${words(n)}.`;
    const digits = n >= 10 && n % 10 ? `${ONES[Math.floor(n / 10)]} and ${ONES[n % 10]}, ${words(n)}` : n < 10 ? `number ${words(n)}` : words(n);
    const said = NICK[n] ? `${NICK[n]}, ${n < 10 ? `number ${words(n)}` : words(n)}` : digits;
    return said.charAt(0).toUpperCase() + said.slice(1) + '.';
  }

  /* ---------- Tickets ---------- */
  // 3 rows × 9 columns, 15 numbers: 5 in every row, 1–3 in every column (column 1 holds 1–9, column 2 10–19, … column 9 80–90),
  // each column's numbers going down in increasing order. A player's tickets never share a number.
  const COLS = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 69], [70, 79], [80, 90]];
  const colOf = n => n === 90 ? 8 : Math.floor(n / 10);
  function shuffleWith(rand, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = rand(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  function makeTicket(rand, used = new Set()) {
    const avail = COLS.map(([a, b]) => { const l = []; for (let x = a; x <= b; x++) if (!used.has(x)) l.push(x); return l; });
    const cap = avail.map(l => Math.min(3, l.length));
    if (cap.some(c => c < 1) || cap.reduce((a, b) => a + b, 0) < 15) return null;
    for (let tries = 0; tries < 500; tries++) {
      // how many numbers in each column: at least 1, at most 3, 15 in all
      const counts = cap.map(() => 1);
      let left = 6;
      while (left) { const j = rand(9); if (counts[j] < cap[j]) { counts[j]++; left--; } }
      // which rows they go in: fullest columns first, each into the rows that still need the most numbers
      const need = [5, 5, 5], cells = [[], [], []].map(() => Array(9).fill(false));
      const order = shuffleWith(rand, [...Array(9).keys()]).sort((a, b) => counts[b] - counts[a]);
      let ok = true;
      for (const j of order) {
        const rows = shuffleWith(rand, [0, 1, 2]).sort((a, b) => need[b] - need[a]).slice(0, counts[j]);
        if (rows.some(r => need[r] <= 0)) { ok = false; break; }
        rows.forEach(r => { need[r]--; cells[r][j] = true; });
      }
      if (!ok || need.some(x => x)) continue;
      const rows = [[], [], []].map(() => Array(9).fill(0));
      COLS.forEach((_, j) => {
        const nums = shuffleWith(rand, avail[j].slice()).slice(0, counts[j]).sort((a, b) => a - b);
        [0, 1, 2].filter(r => cells[r][j]).forEach((r, k) => { rows[r][j] = nums[k]; });
      });
      return rows;
    }
    return null;
  }
  const numbersOf = t => t.flat().filter(Boolean);
  const corners = t => [t[0], t[2]].flatMap(row => { const r = row.filter(Boolean); return [r[0], r[r.length - 1]]; });

  /* ---------- Prizes ---------- */
  const PRIZES = {
    early5: { name: 'Early Five', icon: '5️⃣', text: 'The first to have any 5 numbers on one ticket called.', test: (t, has) => numbersOf(t).filter(has).length >= 5 },
    top: { name: 'Top Line', icon: '⬆️', text: 'All 5 numbers of a ticket\'s top line called.', test: (t, has) => t[0].filter(Boolean).every(has) },
    middle: { name: 'Middle Line', icon: '↔️', text: 'All 5 numbers of a ticket\'s middle line called.', test: (t, has) => t[1].filter(Boolean).every(has) },
    bottom: { name: 'Bottom Line', icon: '⬇️', text: 'All 5 numbers of a ticket\'s bottom line called.', test: (t, has) => t[2].filter(Boolean).every(has) },
    corners: { name: 'Four Corners', icon: '🔲', text: 'The first and last numbers of the top and bottom lines called.', test: (t, has) => corners(t).every(has) },
    full: { name: 'Full House', icon: '🏠', text: 'All 15 numbers of a ticket called. Wins the game.', test: (t, has) => numbersOf(t).every(has) },
    full2: { name: 'Second Full House', icon: '🏡', text: 'The next full ticket after the Full House.', test: (t, has) => numbersOf(t).every(has) },
  };
  const PRIZE_KEYS = Object.keys(PRIZES);
  const hasFrom = called => { const s = new Set(called); return n => s.has(n); };

  // Is this claim good? Returns the ticket that wins it, or a reason it isn't
  function check(st, i, key) {
    const P = PRIZES[key], prize = st.prizes[key], now = st.called.length;
    if (!prize) return { why: 'That prize isn\'t in this game.' };
    if (prize.wins.some(w => w.i === i)) return { why: `You already won the ${P.name}.` };
    if (prize.at != null && prize.at !== now) return { why: `The ${P.name} has already been won.`, gone: true };
    if (key === 'full2' && !st.prizes.full.wins.length) return { why: 'The Full House has to be won first.' };
    if (key === 'full2' && st.prizes.full.at === now) return { why: 'The Full House was won on this number; the Second Full House needs the next one.' };
    const has = hasFrom(st.called), before = hasFrom(st.called.slice(0, -1));
    const won = (t, k) => P.test(t, has) && !(key === 'full2' && st.prizes.full.wins.some(w => w.i === i && w.t === k));
    const t = st.tickets[i].findIndex(won);
    if (t < 0) return { why: `Not yet: your ${P.name} isn't complete.`, bogus: true };
    if (st.late === 'strict' && P.test(st.tickets[i][t], before))
      return { why: `Too late: your ${P.name} was complete before the last number. Claims must come before the next number is called.`, late: true };
    return { t };
  }
  function award(ctx, i, key, t) {
    const st = ctx.state, prize = st.prizes[key], P = PRIZES[key], name = ctx.players[i].name, shared = prize.wins.length > 0;
    prize.wins.push({ i, t });
    prize.at = st.called.length;
    st.claims.unshift({ i, key, ok: true, n: st.current });
    ctx.log(`${P.icon} ${name} wins the ${P.name}${shared ? ' (shared)' : ''} on ${st.current}.`);
    st.pending.push({ good: true, text: shared ? `${name} also has the ${P.name}! They share it.` : `${name} claims the ${P.name}… and it's good! Well done, ${name}!` });
  }
  // In automatic mode the Mac spots every completed prize after each number (several players on the same number share)
  function autoClaims(ctx) {
    const st = ctx.state;
    PRIZE_KEYS.filter(k => st.prizes[k]).forEach(k => ctx.players.forEach((_, i) => { const r = check(st, i, k); if (r.t != null) award(ctx, i, k, r.t); }));
  }
  const open = st => PRIZE_KEYS.filter(k => st.prizes[k] && !st.prizes[k].wins.length);
  const allWon = st => !open(st).length;

  /* ---------- The game ---------- */
  // The caller stops to announce claims. After a good one, like a real caller, "Any more claims?": anyone else who completed
  // the same prize on the same number has a few seconds to claim a share before the next number.
  const SHARE_SECONDS = 5;
  async function announce(ctx) {
    const st = ctx.state;
    let good = false;
    while (st.pending.length) { const a = st.pending.shift(); good ||= a.good; ctx.update(); await ctx.say(a.text, a.good ? 'pay' : 'shake'); }
    if (good && !st.auto) {
      await ctx.countdown(SHARE_SECONDS, 'Any more claims?');
      while (st.pending.length) { const a = st.pending.shift(); ctx.update(); await ctx.say(a.text, a.good ? 'pay' : 'shake'); }
    }
  }
  async function caller(ctx) {
    const st = ctx.state;
    while (st.bag.length && !allWon(st)) {
      if (st.paused) await new Promise(res => { ctx.resume = res; });   // the caller pressed Pause on the Mac
      const n = st.bag.pop();
      st.called.push(n); st.current = n;
      ctx.log(`🎱 <b>${n}</b>${st.style === 'nick' && NICK[n] ? ` · ${NICK[n]}` : ''}`);
      ctx.update();
      await ctx.say(callText(n, st.style), 'point');
      if (st.auto) autoClaims(ctx);
      await announce(ctx);
      if (allWon(st)) break;
      await ctx.countdown(st.gap, 'Next number');
      await announce(ctx);
    }
    if (!allWon(st)) {
      st.lastCall = true; ctx.update();
      await ctx.say('That was the last number! Any more claims?', 'point');
      if (st.auto) autoClaims(ctx);
      await announce(ctx);
      if (!st.auto) { await ctx.countdown(20, 'Last claims'); await announce(ctx); }
    }
    finish(ctx);
  }
  function finish(ctx) {
    const st = ctx.state, esc = PartyKit.esc;
    const mine = i => PRIZE_KEYS.filter(k => st.prizes[k]?.wins.some(w => w.i === i));
    const html = `<div class="tb-endprizes">${PRIZE_KEYS.filter(k => st.prizes[k]).map(k => {
      const p = st.prizes[k];
      return `<div><span>${PRIZES[k].icon} ${PRIZES[k].name}</span><b>${p.wins.length ? p.wins.map(w => esc(ctx.players[w.i].name)).join(' & ') + ` <span class="note">(number ${st.called[p.at - 1]}, call ${p.at})</span>` : '<span class="note">not won</span>'}</b></div>`;
    }).join('')}</div><div class="note">${st.called.length} of 90 numbers called.</div>`;
    ctx.end(ctx.players.map((p, i) => ({ name: p.name, won: st.prizes.full.wins.some(w => w.i === i), points: mine(i).length,
      note: mine(i).map(k => PRIZES[k].name).join(', ') })), html);
  }

  const prizeView = (ctx, i) => PRIZE_KEYS.filter(k => ctx.state.prizes[k]).map(k => {
    const st = ctx.state, p = st.prizes[k];
    return { key: k, name: PRIZES[k].name, icon: PRIZES[k].icon, text: PRIZES[k].text, winners: p.wins.map(w => ctx.players[w.i].name),
      mine: p.wins.some(w => w.i === i), barred: st.barred[i].includes(k), shareable: p.at === st.called.length, at: p.at };
  });

  return {
    _test: { makeTicket, callText, words, NICK, PRIZES, check, corners, numbersOf, COLS },   // internals, for the unit tests only
    id: 'tambola', name: 'Tambola', min: 2, max: 10, macRole: 'caller', pointsLabel: 'prizes',
    blurb: 'Housie! The Mac calls the numbers 1–90; tick them off on your phone\'s ticket and claim Early Five, the lines, Four Corners and Full House before anyone else. 2–10 players.',
    options: [
      { key: 'prizes', type: 'checks', label: 'Prizes (hover for the rules)', def: ['early5', 'top', 'middle', 'bottom', 'corners', 'full'],
        choices: PRIZE_KEYS.map(k => [k, `${PRIZES[k].icon} ${PRIZES[k].name}`, PRIZES[k].text]) },
      { key: 'tickets', label: 'Tickets per player', def: 1, choices: [[1, '1 ticket'], [2, '2 tickets'], [3, '3 tickets']] },
      { key: 'gap', label: 'Time between numbers', def: 6, choices: [[3, '3 seconds (fast)'], [6, '6 seconds'], [10, '10 seconds'], [15, '15 seconds (relaxed)']] },
      { key: 'claims', label: 'Claiming prizes', def: 'manual', choices: [['manual', 'Players claim on their phone (traditional)'], ['auto', 'Automatic: the Mac spots the winners']] },
      { key: 'marking', label: 'Marking numbers', def: 'manual', choices: [['manual', 'Players tap to mark them'], ['auto', 'Marked automatically']] },
      { key: 'late', label: 'Late claims', def: 'allow', choices: [['allow', 'Allowed while the prize is open'], ['strict', 'Must claim before the next number']] },
      { key: 'bogus', label: 'Wrong claims', def: 'warn', choices: [['warn', 'Just a warning'], ['bar', 'Out of that prize']] },
      { key: 'calls', label: 'Calling style', def: 'nick', choices: [['nick', 'Traditional calls ("Kelly\'s eye, number one")'], ['plain', 'Just the number']] },
    ],
    canStart(n, o) {
      const p = o.prizes || [];
      if (!p.length) return 'Pick at least one prize.';
      if (p.includes('full2') && !p.includes('full')) return 'The Second Full House needs the Full House too.';
      return null;
    },
    rules: [
      '<b>Tickets:</b> each player gets a ticket (or more) on their phone: 3 lines of 5 numbers, 15 in all. The first column holds 1–9, the second 10–19, and so on up to 80–90.',
      '<b>Calling:</b> the Mac draws the numbers 1 to 90 at random and calls them out, with the traditional calls ("Kelly\'s eye, number one", "Two little ducks, twenty-two"). The board on the Mac shows every number called.',
      '<b>Marking:</b> tap a number on your ticket to mark it when it\'s called (or let the game mark them, if the host chose that).',
      `<b>Prizes:</b><br>${PRIZE_KEYS.map(k => `${PRIZES[k].icon} <b>${PRIZES[k].name}:</b> ${PRIZES[k].text}`).join('<br>')}`,
      '<b>Claiming:</b> when you complete a prize, tap its Claim button on your phone. The Mac checks it against the numbers called (not your marks). If several players complete the same prize on the same number, they share it.',
      '<b>Wrong claims</b> ("bogus"): a claim for a prize that isn\'t complete is announced, and depending on the host\'s choice it is just a warning or puts you out of that prize.',
      '<b>Late claims:</b> by default you can claim while the prize is still open. With strict claims, you must claim before the next number is called.',
      '<b>Winning:</b> the game ends when every prize is won (or all 90 numbers are called). The Full House wins the game; the leaderboard also counts prizes.',
    ],
    async start(ctx) {
      const o = ctx.opts, n = ctx.players.length, T = +o.tickets || 1;
      const tickets = ctx.players.map(() => {
        const used = new Set(), list = [];
        for (let k = 0; k < T; k++) { const t = makeTicket(ctx.rand, used); numbersOf(t).forEach(x => used.add(x)); list.push(t); }
        return list;
      });
      const prizes = {};
      (o.prizes && o.prizes.length ? o.prizes : ['early5', 'top', 'middle', 'bottom', 'corners', 'full']).forEach(k => { if (PRIZES[k]) prizes[k] = { wins: [], at: null }; });
      ctx.state = { tickets, prizes, bag: ctx.shuffle([...Array(90)].map((_, k) => k + 1)), called: [], current: null, marks: ctx.players.map(() => []),
        barred: ctx.players.map(() => []), claims: [], pending: [], paused: false, lastCall: false,
        gap: +o.gap || 6, auto: o.claims === 'auto', automark: o.marking === 'auto', late: o.late || 'allow', bogus: o.bogus || 'warn', style: o.calls || 'nick' };
      ctx.log(`${n} players, ${T} ticket${T === 1 ? '' : 's'} each. Prizes: ${Object.keys(prizes).map(k => PRIZES[k].name).join(', ')}.`);
      ctx.update();
      await ctx.say('Welcome to Tambola! Your tickets are on your phones. Eyes down… here we go!', 'welcome');
      await ctx.countdown(5, 'Eyes down');
      await caller(ctx);
    },
    act(ctx, i, m) {
      const st = ctx.state;
      if (m.act === 'mark') {
        const n = +m.n;
        if (!st.tickets[i].some(t => numbersOf(t).includes(n))) return 'That number isn\'t on your ticket.';
        st.marks[i] = st.marks[i].includes(n) ? st.marks[i].filter(x => x !== n) : [...st.marks[i], n];
        return;
      }
      if (m.act === 'claim') {
        if (st.auto) return 'Prizes are claimed automatically in this game.';
        const key = m.prize, P = PRIZES[key], name = ctx.players[i].name;
        if (!st.called.length) return 'No numbers have been called yet.';
        if (st.barred[i].includes(key)) return `You're out of the ${P ? P.name : 'that prize'} after a wrong claim.`;
        const r = check(st, i, key);
        if (r.t != null) { award(ctx, i, key, r.t); if (st.paused) announce(ctx); else ctx.skip(); return; }   // the caller stops to announce it
        if (r.bogus || r.late) {
          st.claims.unshift({ i, key, ok: false, n: st.current });
          ctx.log(`❌ ${name}: ${r.late ? 'late' : 'wrong'} claim for the ${P.name}${r.bogus && st.bogus === 'bar' ? ' (out of that prize)' : ''}.`);
          if (r.bogus) {
            if (st.bogus === 'bar') st.barred[i].push(key);
            st.pending.push({ good: false, text: `Oh no, ${name}! That's a bogus claim, the ${P.name} isn't complete.${st.bogus === 'bar' ? ` ${name} is out of the ${P.name}.` : ''}` });
          }
          if (st.paused) announce(ctx); else ctx.skip();
        }
        return r.why + (r.bogus && st.bogus === 'bar' ? ' You are out of this prize.' : '');
      }
    },
    hostAct(ctx, d) {
      const st = ctx.state;
      if (d.host === 'pause') {
        st.paused = !st.paused;
        ctx.log(st.paused ? '⏸ The caller paused the game.' : '▶️ The game goes on.');
        if (!st.paused && ctx.resume) { const r = ctx.resume; ctx.resume = null; r(); }
        ctx.update();
      }
      if (d.host === 'next' && !st.paused) ctx.skip();          // call the next number now
    },
    status(ctx) {
      const st = ctx.state, left = open(st).length;
      return `${st.paused ? '⏸ Paused · ' : ''}Number ${st.called.length} of 90 · ${left} prize${left === 1 ? '' : 's'} left`;
    },
    view(ctx, i) {
      const st = ctx.state, has = hasFrom(st.called), mineNums = st.tickets[i].flatMap(numbersOf);
      return {
        title: st.current ? `Number ${st.called.length} of 90` : 'Eyes down…', current: st.current, nick: st.current && st.style === 'nick' ? NICK[st.current] || '' : '',
        recent: st.called.slice(-6, -1).reverse(), called: st.called.slice(), count: st.called.length, tickets: st.tickets[i],
        marks: st.automark ? mineNums.filter(has) : st.marks[i].slice(), automark: st.automark, auto: st.auto,
        onMine: !!st.current && mineNums.includes(st.current), prizes: prizeView(ctx, i), paused: st.paused, lastCall: st.lastCall,
        lastClaim: st.claims[0] ? { name: ctx.players[st.claims[0].i].name, prize: PRIZES[st.claims[0].key].name, ok: st.claims[0].ok } : null,
      };
    },
    hostHTML(ctx, H) {
      const st = ctx.state, c = st.current, recent = st.called.slice(-6, -1).reverse(), called = new Set(st.called);
      const board = [...Array(90)].map((_, k) => k + 1).map(n => `<span class="${n === c ? 'now' : called.has(n) ? 'on' : ''}">${n}</span>`).join('');
      const prizes = PRIZE_KEYS.filter(k => st.prizes[k]).map(k => {
        const p = st.prizes[k];
        return `<div class="tb-prize${p.wins.length ? ' won' : ''}"><span>${PRIZES[k].icon} ${PRIZES[k].name}</span>
          <b>${p.wins.length ? p.wins.map(w => `<i style="--pc:${H.color(w.i)}"></i>${H.esc(ctx.players[w.i].name)}`).join(' & ') + ` <span class="note">on ${st.called[p.at - 1]}</span>` : '<span class="note">open</span>'}</b></div>`;
      }).join('');
      const last = st.claims[0];
      return `<div class="tb-top">
          <div class="tb-ball${c ? ' pop' : ''}" data-n="${c || ''}">${c || '–'}</div>
          <div class="tb-said"><div class="tb-nick">${c ? H.esc(st.style === 'nick' && NICK[c] ? NICK[c] : `Number ${c}`) : 'Eyes down…'}</div>
            <div class="note">${st.lastCall ? 'All 90 numbers called: last claims!' : `Number ${st.called.length} of 90`}${st.paused ? ' · ⏸ paused' : ''}</div>
            <div class="tb-recent">${recent.map(n => `<span>${n}</span>`).join('')}</div></div>
          <div class="tb-ctrl"><button class="btn" type="button" data-host="pause">${st.paused ? '▶️ Resume' : '⏸ Pause'}</button>
            <button class="btn" type="button" data-host="next" ${st.paused ? 'disabled' : ''}>⏭ Next number now</button></div>
        </div>
        ${last ? `<div class="big-line ${last.ok ? 'tb-ok' : 'tb-bad'}">${last.ok ? '🎉' : '❌'} ${H.esc(ctx.players[last.i].name)}: ${last.ok ? '' : 'wrong claim for '}${PRIZES[last.key].name}${last.ok ? '!' : ''}</div>` : ''}
        <div class="tb-cols"><div><div class="sec-title">Board</div><div class="tb-board">${board}</div></div>
        <div><div class="sec-title">Prizes</div><div class="tb-prizes">${prizes}</div>
          <div class="sec-title">Players</div><div class="pills">${ctx.players.map((p, i) => {
            const won = PRIZE_KEYS.filter(k => st.prizes[k]?.wins.some(w => w.i === i)).length;
            return `<span class="p" style="border-left:4px solid ${H.color(i)}">${H.esc(p.name)}${won ? ` · ${won} 🏆` : ''}</span>`; }).join('')}</div></div></div>`;
    },
    // a short buzz when the number just called is on your ticket
    phoneNotify: (before, now) => !!(now && now.onMine && now.current !== before?.current && !now.automark) && [60],
    phoneLocal(d, v, local) { if (d.local === 'board') local.board = !local.board; },
    phoneHTML(v, local, H) {
      const marks = new Set(v.marks), called = new Set(v.called);
      const ticket = (t, k) => `<div class="tb-ticket">${v.tickets.length > 1 ? `<div class="tb-tno">Ticket ${k + 1}</div>` : ''}<div class="tb-grid">${t.map(row => row.map(n => !n ? '<span class="blank"></span>'
        : v.automark ? `<span class="${marks.has(n) ? 'mk' : ''}">${n}</span>`
        : `<button type="button" data-act="mark" data-n="${n}" class="${marks.has(n) ? 'mk' : ''}">${n}</button>`).join('')).join('')}</div></div>`;
      const prizes = v.prizes.map(p => {
        const status = p.winners.length ? `${p.mine ? '🏆 You' + (p.winners.length > 1 ? ' & ' + p.winners.filter(w => w !== H.seats[H.me]?.name).map(H.esc).join(' & ') : '') : p.winners.map(H.esc).join(' & ')}` : '';
        const canClaim = !v.auto && !p.mine && !p.barred && (!p.winners.length || p.shareable) && v.count > 0;
        return `<div class="tb-pz${p.winners.length ? ' won' : ''}"><span>${p.icon} ${p.name}${status ? ` <small>${status}</small>` : p.barred ? ' <small>you\'re out of this one</small>' : ''}</span>
          ${canClaim ? `<button type="button" data-act="claim" data-prize="${p.key}">Claim</button>` : ''}</div>`;
      }).join('');
      const lc = v.lastClaim;
      return `<div class="tb-now"><div class="tb-ball sm">${v.current || '–'}</div><div><b>${v.current ? H.esc(v.nick || `Number ${v.current}`) : 'Eyes down…'}</b>
          <div class="note">${v.lastCall ? 'Last claims!' : `Number ${v.count} of 90`}${v.paused ? ' · paused' : ''}</div>
          <div class="tb-recent">${v.recent.map(n => `<span>${n}</span>`).join('')}</div></div></div>
        ${lc ? `<div class="note" style="text-align:center">${lc.ok ? '🎉' : '❌'} ${H.esc(lc.name)}: ${lc.ok ? lc.prize + '!' : 'wrong claim for ' + lc.prize}</div>` : ''}
        <div class="sec-title">Your ticket${v.tickets.length > 1 ? 's' : ''}${v.automark ? ' (marked for you)' : ' · tap a number to mark it'}</div>
        ${v.tickets.map(ticket).join('')}
        <div class="sec-title">Prizes${v.auto ? ' (claimed automatically)' : ''}</div><div class="tb-pzs">${prizes}</div>
        <button type="button" class="tb-boardbtn" data-local="board">${local.board ? 'Hide' : 'Show'} the numbers called (${v.count})</button>
        ${local.board ? `<div class="tb-board sm">${[...Array(90)].map((_, k) => `<span class="${called.has(k + 1) ? 'on' : ''}">${k + 1}</span>`).join('')}</div>` : ''}`;
    },
    css: `
      .tb-ball { width: 120px; height: 120px; border-radius: 50%; display: grid; place-items: center; font: 900 3.4rem/1 Georgia, serif; color: #1b1b1b;
        background: radial-gradient(circle at 24% 20%, rgba(255,255,255,.9) 0 6%, transparent 7%), radial-gradient(circle at 35% 30%, #fff3c4 0 8%, #ffd54f 30% 62%, #c8920a 100%); box-shadow: 0 10px 24px rgba(0,0,0,.5), inset 0 -6px 12px rgba(0,0,0,.25); flex: none; }
      .tb-ball.pop { animation: tbPop .5s cubic-bezier(.2,1.6,.4,1); }
      .tb-ball.sm { width: 64px; height: 64px; font-size: 1.8rem; }
      @keyframes tbPop { from { transform: scale(.4) rotate(-90deg); } to { transform: none; } }
      .tb-top { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
      .tb-said { flex: 1; min-width: 200px; } .tb-nick { font: 800 1.7rem/1.2 Georgia, serif; color: var(--gold, #d4af37); }
      .tb-recent { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
      .tb-recent span { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: .85rem; background: rgba(255,255,255,.12); }
      .tb-ctrl { display: flex; flex-direction: column; gap: 8px; }
      .tb-cols { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 18px; margin-top: 8px; }
      @media (max-width: 800px) { .tb-cols { grid-template-columns: 1fr; } }
      .tb-board { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
      .tb-board span { aspect-ratio: 1; display: grid; place-items: center; border-radius: 8px; background: rgba(0,0,0,.3); color: rgba(255,255,255,.45); font-weight: 800; font-size: .95rem; }
      .tb-board span.on { background: #b8901f; color: #fff; }
      .tb-board span.now { background: #ffd54f; color: #1b1b1b; box-shadow: 0 0 14px #ffd54f; }
      .tb-board.sm { margin-top: 8px; } .tb-board.sm span { font-size: .72rem; border-radius: 6px; }
      .tb-prizes { display: grid; gap: 6px; }
      .tb-prize { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,.25); }
      .tb-prize.won { background: rgba(212,175,55,.18); } .tb-prize b i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--pc); margin: 0 4px 0 6px; }
      .tb-ok { color: #9be89b; } .tb-bad { color: #ffb4a8; }
      .tb-now { display: flex; align-items: center; gap: 12px; }
      .tb-ticket { margin-bottom: 10px; } .tb-tno { font-size: .75rem; color: var(--muted, #b9c4bc); margin-bottom: 3px; }
      .tb-grid { display: grid; grid-template-columns: repeat(9, 1fr); gap: 3px; background: #f3e2b5; padding: 4px; border-radius: 8px; }
      .tb-grid > * { aspect-ratio: 1 / 1.1; display: grid; place-items: center; border-radius: 5px; font: 800 1rem/1 system-ui, sans-serif; background: #fffdf5; color: #1b1b1b; border: 0; padding: 0; }
      .tb-grid > .blank { background: #e8d29a; }
      .tb-grid > button { cursor: pointer; }
      .tb-grid > .mk { background: radial-gradient(circle, #e0408a 0 55%, #fffdf5 57%); color: #fff; }
      .tb-pzs { display: grid; gap: 6px; }
      .tb-pz { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; background: rgba(0,0,0,.25); }
      .tb-pz.won { opacity: .8; } .tb-pz small { display: block; color: var(--muted, #b9c4bc); }
      .tb-pz button { padding: 8px 14px; border-radius: 10px; border: 1px solid #f3dc8b; background: linear-gradient(#e6c55a, #b8901f); color: #1d1500; font: inherit; font-weight: 900; cursor: pointer; }
      .tb-boardbtn { width: 100%; margin-top: 10px; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,.3); background: rgba(0,0,0,.25); color: inherit; font: inherit; font-weight: 700; }
      .tb-endprizes { display: grid; gap: 4px; margin-bottom: 8px; } .tb-endprizes div { display: flex; justify-content: space-between; gap: 10px; }`,
  };
})();
