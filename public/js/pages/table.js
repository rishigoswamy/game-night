const $ = s => document.querySelector(s);
const PCOLORS = ['var(--p0)', 'var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p5)'];
const pc = i => S?.players[i]?.color ?? PCOLORS[i % PCOLORS.length];
const CHIPS = [[5,'#6b7280'],[10,'#2563eb'],[25,'#16a34a'],[50,'#dc2626'],[100,'#111827'],[500,'#7c3aed']];
const BET = Object.fromEntries(GAME.bets.map(b => [b.key, b]));
const cents = n => Math.round(n * 100) / 100;
const fmt = n => '$' + (Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const short = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(Math.round(n * 100) / 100);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let S = null;          // game state
let chip = 25;         // selected chip value
document.title = GAME.name + ' · Casino';
$('#gameTitle').textContent = GAME.name;
$('#setupTitle').textContent = `New ${GAME.name} Game`;
$('#tagline').textContent = GAME.tagline;
document.head.insertAdjacentHTML('beforeend', `<style>${GAME.css || ''}</style>`);

/* ---------- Cards and dice for the stage (shared look with the phones) ---------- */
function cardHTML(c) {
  const red = c.s === '♥' || c.s === '♦', pip = 'JQK'.includes(c.r) ? `<span class="court">${c.r}</span>` : c.s;
  return `<div class="pcard"><div class="face${red ? ' red' : ''}"><span class="corner tl">${c.r}<br>${c.s}</span><span class="pip">${pip}</span><span class="corner br">${c.r}<br>${c.s}</span></div></div>`;
}
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function dieHTML(v, k = 0) {
  if (!v) return `<div class="die blank" style="--k:${k}">?</div>`;
  return `<div class="die v${v}" style="--k:${k}" aria-label="${v}">${[...Array(9)].map((_, i) => `<i${PIPS[v].includes(i) ? ' class="on"' : ''}></i>`).join('')}</div>`;
}
const STAGE_HELPERS = { card: cardHTML, die: dieHTML };
let shownCards = 0;
// Draws the cards/dice; cards that weren't on the table before slide in from the shoe
function renderStage() {
  const st = S?.stage || GAME.idleStage();
  $('#stage').innerHTML = GAME.stageHTML(st, STAGE_HELPERS);
  const cards = [...$('#stage').querySelectorAll('.pcard')];
  if (cards.length < shownCards) shownCards = 0;
  cards.slice(shownCards).forEach(el => el.animate([{ transform: 'translate(120px, -80px) rotate(14deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' }));
  shownCards = cards.length;
}

/* ---------- Board ---------- */
const cells = {};
function buildBoard() {
  const board = $('#board');
  const rows = [];
  GAME.bets.forEach(b => (rows[b.row] ||= []).push(b));
  rows.forEach((list, r) => {
    const row = document.createElement('div');
    row.className = 'brow';
    row.style.setProperty('--rh', GAME.rowHeights?.[r] || '56px');
    list.forEach(b => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'b-cell ' + (b.cls || 'b-dark');
      d.style.setProperty('--span', b.span || 1);
      d.dataset.key = b.key;
      d.innerHTML = `<span class="lbl">${b.label}</span><span class="sub">${b.sub || ''}</span><div class="stacks"></div>`;
      d.addEventListener('click', () => place(b.key));
      d.addEventListener('contextmenu', e => { e.preventDefault(); removeKey(b.key); });
      row.appendChild(d);
      cells[b.key] = d;
    });
    board.appendChild(row);
  });
}
function buildChips() {
  CHIPS.forEach(([v, c]) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.style.setProperty('--cc', c); b.textContent = v; b.dataset.v = v;
    b.addEventListener('click', () => { chip = v; render(); });
    $('#chips').appendChild(b);
  });
}

/* ---------- Betting ---------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.textContent = '', 2600);
}
// Betting actions take the player they act for (this screen's selected player by default, or a phone's player).
// They return an error message when the action isn't allowed; taps on this device show it as a toast.
function place(key, val = chip, who = S?.active, quiet = false) {
  const fail = m => { if (!quiet) toast(m); return m; };
  if (!S || S.phase !== 'bet') return fail('Betting is closed.');
  if (who == null) return fail(sharing() ? 'Players on phones bet from their phones. Add a player here to bet from this screen.' : 'No one is at the table yet. Tap "+ Add player" to join.');
  const p = S.players[who];
  if (!p || !inGame(p)) return fail('That player is no longer at the table.');
  if (!quiet && lockedToPhone(who)) return fail(`${p.name} bets from their own phone.`);
  if (!BET[key]) return fail('Unknown bet.');
  const amt = Math.min(val, p.bal);
  if (amt <= 0) return fail(`${p.name} has no chips left to bet.`);
  p.bal = cents(p.bal - amt);
  S.bets.push({ p: who, key, amt });
  render();
}
function refund(i) { const b = S.bets[i]; S.players[b.p].bal = cents(S.players[b.p].bal + b.amt); S.bets.splice(i, 1); }
function removeKey(key, who = S?.active) {
  if (!S || S.phase !== 'bet' || who == null) return;
  for (let i = S.bets.length - 1; i >= 0; i--) if (S.bets[i].p === who && S.bets[i].key === key) refund(i);
  render();
}
function undo(who = S.active) {
  for (let i = S.bets.length - 1; i >= 0; i--) if (S.bets[i].p === who) { refund(i); break; }
  render();
}
function clearMine(who = S.active) {
  for (let i = S.bets.length - 1; i >= 0; i--) if (S.bets[i].p === who) refund(i);
  render();
}
function rebet(who = S.active, quiet = false) {
  const fail = m => { if (!quiet) toast(m); return m; };
  if (who == null) return;
  const prev = S.lastBets[who] || [];
  if (!prev.length) return fail('No bets from last round to repeat.');
  const total = prev.reduce((a, b) => a + b.amt, 0), p = S.players[who];
  if (total > p.bal + staked(who)) return fail(`Not enough chips to rebet (${fmt(total)} needed).`);
  clearMine(who);
  prev.forEach(b => { p.bal = cents(p.bal - b.amt); S.bets.push({ p: who, key: b.key, amt: b.amt }); });
  render();
}
function mainAction() {
  if (!S || paused || S.phase !== 'bet') return;
  if (sharing()) return;                            // shared table: only the betting-window timer starts the round
  play();
}

/* ---------- Setup ---------- */
function buildNameFields() {
  const n = +$('#numPlayers').value, box = $('#names');
  const old = [...box.querySelectorAll('input')].map(i => i.value);
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const f = document.createElement('div');
    f.className = 'field';
    f.innerHTML = `<label for="n${i}"><span class="dot" style="--pc:${PCOLORS[i]}"></span>Player ${i + 1}</label><input id="n${i}" maxlength="16">`;
    f.querySelector('input').value = old[i] ?? `Player ${i + 1}`;
    box.appendChild(f);
  }
}
$('#numPlayers').addEventListener('change', buildNameFields);
function readTimeLimit() {
  const v = $('#timeLimit').value;
  return v === 'custom' ? Math.max(5, Math.min(600, Math.round(+$('#customTime').value) || 45)) : +v;
}
$('#timeLimit').addEventListener('change', e => {
  const custom = e.target.value === 'custom';
  $('#customTime').hidden = !custom;
  if (custom) $('#customTime').focus();
});
$('#untilBust').addEventListener('change', e => { $('#rounds').disabled = e.target.checked; });
buildNameFields();

/* ---------- Game flow ---------- */
const inGame = p => p.bal >= 1 && !p.cashedOut;
// Players who have left are kept off the table UI so the layout never fills up with them
const gone = p => p.cashedOut || (S.openTable && p.bal < 1);
const alive = () => S.players.map((_, i) => i).filter(i => inGame(S.players[i]));
const staked = i => cents(S.bets.filter(b => b.p === i).reduce((a, b) => a + b.amt, 0));
function randInt(n) {
  const a = new Uint32Array(1), lim = Math.floor(2 ** 32 / n) * n;
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return a[0] % n;
}

// open = start an empty table that players join later
function newGame(open = false) {
  const n = open ? 0 : +$('#numPlayers').value;
  const names = [...Array(n)].map((_, i) => ($('#n' + i)?.value || '').trim() || 'Player ' + (i + 1));
  const bal = +$('#startBal').value;
  const rounds = open || $('#untilBust').checked ? 0 : Math.max(1, Math.min(999, Math.round(+$('#rounds').value) || 5));
  GAME.reset(randInt);
  S = {
    startBal: bal, openTable: open,
    players: names.map((name, i) => ({ name, bal, start: bal, results: [], color: PCOLORS[i] })),
    round: 1, maxRounds: rounds, timeLimit: readTimeLimit() || (open ? 30 : 0), deadline: 0, warned: false,
    active: n ? 0 : null, phase: 'bet', bets: [], lastBets: names.map(() => []), history: [], stage: null,
  };
  Object.values(cells).forEach(c => c.classList.remove('win'));
  $('#setup').hidden = true; $('#endModal').hidden = true;
  renderStage();
  render();
  say(open ? 'The table is open! Join any time and place your bets please.' : `Welcome to ${GAME.name}! Place your bets please.`, 'welcome');
  startTurnTimer();
  updateMasterBtns();
  autoShare();
}

// The dealer plays the round (deals the cards / rolls the dice), then the bets are settled
const ABORT = Symbol('abort');
async function play() {
  if (!S || S.phase !== 'bet') return;
  const g = S;
  S.phase = 'play';
  stopTurnTimer();
  render();
  await say(GAME.verb === 'roll' ? 'No more bets! Here come the dice.' : 'No more bets!', 'wave');
  if (S !== g) return;
  const ctx = {
    rand: randInt,
    wait: async ms => { await pwait(ms); if (S !== g) throw ABORT; },
    say: (text, pose) => S === g ? say(text, pose) : Promise.resolve(),
    setStage: st => { if (S !== g) throw ABORT; S.stage = st; renderStage(); send({ type: 'stage', stage: st }); },
    get stage() { return S?.stage || {}; },
    sfx: kind => { if (kind === 'dice') diceSound(); },
  };
  let o;
  try { o = await GAME.play(ctx); } catch (e) { if (e === ABORT) return; throw e; }
  if (S !== g) return;
  resolve(o);
}

async function resolve(o) {
  const g = S;
  S.phase = 'result';
  S.outcome = o;
  const sum = S.players.map(() => ({ staked: 0, returned: 0 }));
  const back = S.bets.map(b => cents(GAME.settle(b.key, b.amt, o)));
  S.bets.forEach((b, k) => { sum[b.p].staked = cents(sum[b.p].staked + b.amt); sum[b.p].returned = cents(sum[b.p].returned + back[k]); });
  const token = GAME.token(o), line = GAME.announce(o);
  S.history.unshift(token);
  logResult(token);
  S.lastBets = S.players.map((_, p) => S.bets.filter(b => b.p === p).map(b => ({ key: b.key, amt: b.amt })));
  S.winKeys = GAME.bets.filter(b => GAME.settle(b.key, 100, o) > 100).map(b => b.key);
  Object.entries(cells).forEach(([k, c]) => c.classList.toggle('win', S.winKeys.includes(k)));
  send({ type: 'result', text: line, token, nets: Object.fromEntries(sum.map((x, i) => [i, x.staked ? cents(x.returned - x.staked) : null]).filter(([, v]) => v !== null)) });
  render();

  // The call, with a full-screen celebration for something special (a Sic Bo triple)
  const sp = GAME.special?.(o);
  if (sp) {
    send({ type: 'fx', kind: 'special', ...sp });
    await specialFx(sp, say(line, 'point').then(() => S === g ? crowdCheer() : null));
  } else await say(line, 'point');
  if (S !== g) return;

  // Dealer sweeps the losing chips off the table
  const losers = S.bets.filter((b, k) => !back[k]);
  if (losers.length) {
    setPose('sweep');
    await Promise.all(losers.map((b, i) => fly(cells[b.key], $('#dealerHandL'), pc(b.p), short(b.amt), i * 50)));
    if (S !== g) return;
    S.bets = S.bets.filter((b, k) => back[k]);
    render();
  }

  // Announce each player's result and pay out
  for (const i of S.players.map((_, k) => k)) {
    const s = sum[i], p = S.players[i], net = cents(s.returned - s.staked);
    if (!s.staked) continue;
    p.results.push({ round: S.round, net });
    S.focus = i; S.paying = i;
    S.payNote = `bet ${fmt(s.staked)} → ${net > 0 ? 'won ' + fmt(net) : net < 0 ? 'lost ' + fmt(-net) : 'broke even'} · balance ${fmt(cents(p.bal + s.returned))}`;
    render();
    if (s.returned) {
      const msg = net > 0 ? `${p.name} wins ${fmt(net)}!` : net === 0 ? `${p.name} pushes. ${fmt(s.returned)} back to you.` : `${p.name} gets ${fmt(s.returned)} back, but is down ${fmt(-net)}.`;
      const talk = say(msg, 'pay');
      const n = Math.min(8, 3 + Math.floor(s.returned / 100));
      await Promise.all([...Array(n)].map((_, k) => fly($('#dealerHand'), $('#turn'), pc(i), k === n - 1 ? short(s.returned) : '', 300 + k * 90)));
      if (S !== g) return;
      p.bal = cents(p.bal + s.returned);
      S.bets = S.bets.filter(b => b.p !== i);
      render();
      await talk;
      if (S !== g) return;
    } else {
      await say(`${p.name} loses ${fmt(s.staked)}. Better luck next time.`, 'shake');
      if (S !== g) return;
    }
  }
  S.paying = null;
  render();
  if (sum.every(x => !x.staked) && alive().length) await say('No bets this round.');
  const big = S.players.map((_, i) => i).filter(i => sum[i].returned - sum[i].staked >= BIG_WIN)
    .map(i => ({ name: S.players[i].name, net: cents(sum[i].returned - sum[i].staked), color: pc(i) })).sort((a, b) => b.net - a.net);
  if (big.length && S === g) { send({ type: 'fx', kind: 'big', winners: big.map(w => ({ name: w.name, net: w.net })) }); setPose('wave'); await bigWinFx(big); }
  if (S !== g) return;
  setPose('');
  await pwait(300);
  if (S !== g) return;
  showRoundModal(sum, token, line);
}

const isOver = () => S.openTable ? false : alive().length === 0 || (S.maxRounds && S.round >= S.maxRounds);

function showRoundModal(sum, token, line) {
  $('#rmTitle').textContent = `Round ${S.round} result`;
  const num = $('#rmNum'); num.className = 'big-num tok ' + token.cls; num.textContent = token.text;
  $('#rmText').textContent = line;
  $('#rmRows').innerHTML = '';
  S.players.forEach((p, i) => {
    if (gone(p) && !sum[i].staked) return;
    const net = cents(sum[i].returned - sum[i].staked);
    const row = document.createElement('div');
    row.className = 'sum-row'; row.style.setProperty('--pc', pc(i));
    const detail = sum[i].staked
      ? `bet ${fmt(sum[i].staked)} → <span class="${net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'}">${net > 0 ? '+' : net < 0 ? '-' : ''}${fmt(Math.abs(net))}</span>`
      : `<span class="zero">${p.cashedOut ? 'cashed out' : p.bal < 1 ? 'out' : 'no bets'}</span>`;
    row.innerHTML = `<div class="who"><span class="dot"></span><span class="nm"></span></div><div>${detail}</div>`;
    row.querySelector('.nm').textContent = p.name;
    $('#rmRows').appendChild(row);
  });
  $('#rmBtn').textContent = isOver() ? 'See final results' : 'Next round';
  $('#roundModal').hidden = false;
  startAutoNext();
}

// The next round starts by itself after a short countdown (unless the betting window has no time limit)
const AUTO_NEXT_SECONDS = 5;
let autoNextId = null;
function startAutoNext() {
  stopAutoNext();
  if (!S.timeLimit || isOver()) return;
  let left = AUTO_NEXT_SECONDS;
  send({ type: 'next', in: AUTO_NEXT_SECONDS });
  const btn = $('#rmBtn');
  btn.textContent = `Next round (${left})`;
  autoNextId = setInterval(() => {
    if (paused) return;
    if (--left <= 0) { stopAutoNext(); nextRound(); }
    else btn.textContent = `Next round (${left})`;
  }, 1000);
}
function stopAutoNext() { clearInterval(autoNextId); autoNextId = null; }

function nextRound() {
  stopAutoNext();
  $('#roundModal').hidden = true;
  if (isOver()) return showEnd();
  S.round++;
  S.bets = [];
  S.phase = 'bet';
  S.paying = null; S.focus = S.active;
  S.stage = null;
  if (S.active == null || !inGame(S.players[S.active])) S.active = alive().find(i => !lockedToPhone(i)) ?? null;
  Object.values(cells).forEach(c => c.classList.remove('win'));
  renderStage();
  render();
  seatPending();
  say('Place your bets please.', 'welcome');
  startTurnTimer();
}

/* ---------- Betting timer ---------- */
let timerId = null;
function startTurnTimer(seconds = S.timeLimit) {
  stopTurnTimer();
  S.warned = false;
  if (!S.timeLimit) return renderTimer();
  S.timerTotal = seconds;
  S.deadline = Date.now() + seconds * 1000;
  timerId = setInterval(tickTimer, 250);
  tickTimer();
}
function stopTurnTimer() {
  clearInterval(timerId); timerId = null;
  if (S) renderTimer();
}
function tickTimer() {
  if (paused) return;
  if (!S || S.phase !== 'bet') return stopTurnTimer();
  const left = Math.max(0, S.deadline - Date.now());
  renderTimer(left);
  if (!S.warned && left <= 10000 && S.timerTotal > 15 && alive().length) { S.warned = true; say('Ten seconds left!'); }
  if (left > 0) return;
  stopTurnTimer();
  play();
}
function renderTimer(left) {
  const t = $('#timer');
  t.hidden = !(S && S.timeLimit && S.phase === 'bet' && timerId);
  if (t.hidden) return;
  const sec = Math.ceil(left / 1000);
  $('#tText').textContent = `Bets close in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('#tBar').style.width = (left / (S.timerTotal * 1000) * 100) + '%';
  t.classList.toggle('low', left <= 10000);
}

function showEnd() {
  stopTurnTimer();
  S.players.forEach(p => Leaderboard.record(GAME.id, p));
  const ranked = S.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.bal - a.p.bal);
  if (!ranked.length) { exitGame(); return; }
  const top = ranked[0].p.bal, winners = ranked.filter(x => x.p.bal === top);
  const title = winners.length > 1 ? `It's a tie: ${winners.map(x => x.p.name).join(' & ')}!` : `${winners[0].p.name} wins!`;
  const rounds = `${S.round} round${S.round === 1 ? '' : 's'}`;
  $('#endTitle').textContent = title;
  $('#endSub').textContent = S.maxRounds && S.round >= S.maxRounds ? `After ${rounds}.` : `Everyone has left the table after ${rounds}.`;
  $('#endRows').innerHTML = '';
  ranked.forEach(({ p, i }, rank) => {
    const net = cents(p.bal - p.start);
    const row = document.createElement('div');
    row.className = 'sum-row'; row.style.setProperty('--pc', pc(i));
    row.innerHTML = `<div class="who">${rank + 1}. <span class="dot"></span><span class="nm"></span>${p.cashedOut ? ' <span class="zero">(cashed out)</span>' : p.bal < 1 ? ' <span class="zero">(out)</span>' : ''}</div>
      <div>${fmt(p.bal)} <span class="${net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'}">(${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))})</span></div>`;
    row.querySelector('.nm').textContent = p.name;
    $('#endRows').appendChild(row);
  });
  $('#endModal').hidden = false;
  say(winners.length > 1 ? "It's a tie! Well played, everyone." : `${title} Congratulations!`, 'wave');
}

/* ---------- Render ---------- */
function render() {
  if (!S) return;
  $('#roundInfo').textContent = `Round ${S.round}${S.maxRounds ? ' of ' + S.maxRounds : ''} · ${S.openTable ? 'open table · ' : ''}${alive().length} playing`;
  const last = S.history[0];
  $('#history').innerHTML = last ? `<small>Last</small><span class="tok ${last.cls}">${esc(last.text)}</span>` : '';

  // Player strip: tap a name to bet as that player (this screen's players only)
  keepLocalActive();
  $('#order').innerHTML = '';
  S.players.forEach((p, i) => {
    if (gone(p)) return;
    const out = !inGame(p);
    const pick = S.phase === 'bet' && !out && !lockedToPhone(i);
    const pill = document.createElement(pick ? 'button' : 'span');
    if (pick) { pill.type = 'button'; pill.title = `Bet as ${p.name}`; pill.addEventListener('click', () => { S.active = S.focus = i; render(); }); }
    const now = S.phase === 'result' && S.paying != null ? S.paying === i : S.active === i;
    pill.className = 'pill' + (now ? ' now' : out ? ' out' : '');
    pill.style.setProperty('--pc', pc(i));
    pill.innerHTML = `<span class="dot"></span><span class="nm"></span>${p.owner ? `<span class="ph" title="${NET.online.has(p.owner) ? 'Plays from a phone' : 'Phone disconnected'}">📱</span>` : ''}${out ? ' · out' : staked(i) && S.phase === 'bet' ? ' ✓' : ''}`;
    if (p.owner && !NET.online.has(p.owner)) pill.classList.add('away');
    pill.querySelector('.nm').textContent = p.name;
    $('#order').appendChild(pill);
  });
  if (S.phase === 'bet' && alive().length < PCOLORS.length) {
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'pill add'; add.textContent = '+ Add player';
    add.addEventListener('click', openAddPlayer);
    $('#order').appendChild(add);
  }

  // The selected (or currently paid) player's money and win/loss chart
  const i = S.phase === 'result' && S.paying != null ? S.paying : S.active, p = S.players[i];
  const cur = $('#curCard');
  if (i == null || !p) {
    cur.style.removeProperty('--pc'); cur.classList.remove('active');
    cur.innerHTML = sharing()
      ? `<div class="name">Shared table</div><div class="sub" style="margin-top:6px">Players on phones bet from their phones. Tap <b>+ Add player</b> to also play from this screen. Each round starts when the betting window closes.</div>`
      : `<div class="name">Table open</div><div class="sub" style="margin-top:6px">No one is betting yet. Tap <b>+ Add player</b> to join. The table keeps playing and Recent Results keeps counting.</div>`;
    $('#wlCard').innerHTML = '<div class="wl-head"><span>Win / loss by round</span></div><div class="wl-empty">Waiting for players</div>';
  } else {
    cur.style.setProperty('--pc', pc(i));
    cur.classList.toggle('active', S.phase === 'bet');
    const tag = lockedToPhone(i) ? 'On phone' : S.phase === 'bet' ? 'Betting' : S.phase === 'result' ? 'Payout' : '';
    cur.innerHTML = `<div class="name"><span class="dot"></span><span class="nm"></span>${tag ? `<span class="tag">${tag}</span>` : ''}</div>
      <div class="bal">${fmt(p.bal)}</div><div class="sub">On table: ${fmt(staked(i))}</div>
      ${S.phase === 'bet' && inGame(p) && !lockedToPhone(i) ? '<button class="btn cashout" id="cashOutBtn" type="button">Cash out</button>' : ''}`;
    $('#cashOutBtn')?.addEventListener('click', () => openCashOut(i));
    cur.querySelector('.nm').textContent = p.name;
    RouletteView.renderWinLoss($('#wlCard'), p.name, p.results, p.results.reduce((a, r) => a + r.net, 0), fmt);
  }

  const turn = $('#turn');
  const payee = S.phase === 'result' && S.paying != null ? S.paying : null;
  turn.style.setProperty('--pc', pc(payee ?? S.active));
  turn.innerHTML = S.phase === 'bet' ? (S.active == null ? '<span>Table open · waiting for players</span>'
      : sharing() ? '<span>Betting as <b class="nm"></b> · the round starts when the window closes</span>' : '<span>Betting as <b class="nm"></b> · tap a name above to switch player</span>')
    : S.phase === 'play' ? `<span>${GAME.verb === 'roll' ? 'Rolling the dice…' : 'Dealing…'}</span>`
    : payee != null ? `<span><b class="nm"></b>: ${S.payNote || ''}</span>` : '<span>Round over</span>';
  const nm = turn.querySelector('.nm'); if (nm) nm.textContent = S.players[payee ?? S.active]?.name || '';

  // Chip stacks per space
  for (const [key, el] of Object.entries(cells)) {
    const tot = S.players.map(() => 0);
    S.bets.forEach(b => { if (b.key === key) tot[b.p] += b.amt; });
    el.querySelector('.stacks').innerHTML = tot.map((t, k) => t ? `<span class="chip-mini" style="--pc:${pc(k)}">${short(t)}</span>` : '').join('');
  }
  const betting = S.phase === 'bet';
  $('#board').classList.toggle('locked', !betting || S.active == null);
  document.querySelectorAll('.chip').forEach(b => { b.classList.toggle('sel', +b.dataset.v === chip); b.disabled = !betting || S.active == null; });
  const mine = S.active != null && S.bets.some(b => b.p === S.active);
  $('#undoBtn').disabled = $('#clearBtn').disabled = !betting || !mine;
  $('#rebetBtn').disabled = !betting || S.active == null || !S.lastBets[S.active]?.length;
  const mb = $('#mainBtn');
  mb.hidden = sharing();                              // shared: nobody can start the round early
  mb.disabled = !betting;
  mb.textContent = !betting ? (S.phase === 'play' ? (GAME.verb === 'roll' ? 'Rolling…' : 'Dealing…') : 'Paying out…') : `No more bets → ${GAME.verb}`;
  shareSync();
}

/* ---------- Cash out ---------- */
let cashFor = null;
function openCashOut(i) {
  if (!S || S.phase !== 'bet') return;
  const p = S.players[i], onTable = staked(i), total = cents(p.bal + onTable), net = cents(total - p.start);
  cashFor = i;
  pauseGame(); $('#pauseModal').hidden = true;
  $('#cashText').textContent = `${p.name} leaves the table with ${fmt(total)} (${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))} overall)` +
    (onTable ? `, including ${fmt(onTable)} taken back from this round's bets.` : '.');
  $('#cashModal').hidden = false;
}
function closeCashOut() { $('#cashModal').hidden = true; cashFor = null; resumeGame(); }
$('#cashCancel').addEventListener('click', closeCashOut);
$('#cashYes').addEventListener('click', () => {
  const i = cashFor;
  closeCashOut();
  if (lockedToPhone(i)) return toast(`${S.players[i].name} cashes out from their own phone.`);
  doCashOut(i);
});
function doCashOut(i) {
  if (!S || i == null || S.phase !== 'bet' || !S.players[i] || S.players[i].cashedOut) return 'Cash out is only possible while bets are open.';
  const p = S.players[i];
  for (let k = S.bets.length - 1; k >= 0; k--) if (S.bets[k].p === i) refund(k);
  p.cashedOut = true;
  Leaderboard.record(GAME.id, p);                  // on the leaderboard with what they leave with
  S.lastBets[i] = [];
  toast(`${p.name} cashed out with ${fmt(p.bal)}.`);
  say(`${p.name} cashes out with ${fmt(p.bal)}. Thank you for playing!`, 'pay');
  if (!alive().length && !S.openTable) { stopTurnTimer(); return showEnd(); }
  if (S.active === i) S.active = S.focus = alive().find(k => !lockedToPhone(k)) ?? null;
  render();
}

/* ---------- Add a player mid-game ---------- */
function openAddPlayer() {
  if (!S || S.phase !== 'bet' || alive().length >= PCOLORS.length) return;
  pauseGame(); $('#pauseModal').hidden = true;
  $('#newName').value = `Player ${S.players.length + 1}`;
  $('#addNote').textContent = `Joins with ${fmt(S.startBal)} in chips and can bet right away.`;
  $('#addModal').hidden = false;
  $('#newName').select();
}
function closeAddPlayer() { $('#addModal').hidden = true; resumeGame(); }
$('#addCancel').addEventListener('click', closeAddPlayer);
$('#addForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!S || alive().length >= PCOLORS.length) return closeAddPlayer();
  const i = addPlayer($('#newName').value.trim() || `Player ${S.players.length + 1}`);
  S.active = S.focus = i;
  closeAddPlayer();
  render();
});
// Seats a new player (owner = the phone that controls them, or null for this device). Returns their index.
function addPlayer(name, owner = null) {
  const i = S.players.length;
  const everUsed = new Set(S.players.map(q => q.color)), seated = new Set(alive().map(k => S.players[k].color));
  const color = PCOLORS.find(c => !everUsed.has(c)) || PCOLORS.find(c => !seated.has(c));
  S.players.push({ name, bal: S.startBal, start: S.startBal, results: [], color, owner });
  S.lastBets.push([]);
  if (S.active == null && !owner) S.active = S.focus = i;
  render();
  say(`Welcome to the table, ${name}!`, 'welcome');
  return i;
}

/* ---------- Recent results (kept on this device per game until the protected Flush) ---------- */
const LOG_KEY = 'gn-log-' + GAME.id;
let resultLog = [];
try { resultLog = JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch {}
function logResult(token) {
  resultLog.push(token);
  if (resultLog.length > 50) resultLog.shift();
  try { localStorage.setItem(LOG_KEY, JSON.stringify(resultLog)); } catch {}
  renderLog();
}
function renderLog() {
  const counts = {};
  resultLog.forEach(t => { (counts[t.group] ||= { n: 0, cls: t.cls }).n++; });
  $('#logSub').textContent = resultLog.length ? `Last ${resultLog.length} of up to 50 rounds on this device` : 'Kept on this device until flushed';
  $('#flushBtn').disabled = !resultLog.length;
  $('#logStats').innerHTML = Object.entries(counts).map(([g, c]) => `<span><span class="tok ${c.cls}"></span>${esc(g)} ${c.n}</span>`).join('');
  $('#beads').innerHTML = resultLog.length
    ? resultLog.map((t, k) => `<span class="tok ${t.cls}${k === resultLog.length - 1 ? ' latest' : ''}" data-tip="Round ${k + 1}${k === resultLog.length - 1 ? ' (latest)' : ''}: ${esc(t.tip || t.text)}">${esc(t.text)}</span>`).join('')
    : '<div class="log-empty">Results will appear here, oldest to newest.</div>';
}
let lockBio = false;
async function openFlush() {
  if (!resultLog.length) return;
  if (S && !paused) { pauseGame(); $('#pauseModal').hidden = true; }
  const has = AdminLock.hasLock(), n = resultLog.length;
  lockBio = has && AdminLock.hasDeviceUnlock() && await AdminLock.bioAvailable();
  $('#lockText').textContent = has ? `This erases all ${n} recorded ${GAME.name} result${n === 1 ? '' : 's'} on this device.`
    : 'Flushing needs an admin lock, and none is set up on this device yet. An admin can create one on the Admin page.';
  $('#bioBtn').hidden = !lockBio; $('#bioBtn').textContent = `Unlock with ${AdminLock.bioName()}`;
  $('#lockOr').hidden = !lockBio; $('#pinField').hidden = !has; $('#lockSubmit').hidden = !has; $('#adminLink').hidden = has;
  $('#lockCancel').textContent = has ? 'Cancel' : 'Close';
  $('#lockNote').textContent = has ? 'Forgot the PIN? Manage it on the Admin page (from the lobby).' : '';
  $('#pin1').value = ''; $('#lockErr').textContent = '';
  $('#lockModal').hidden = false;
  if (has) $(lockBio ? '#bioBtn' : '#pin1').focus();
}
function closeFlush() { $('#lockModal').hidden = true; if (S && paused) resumeGame(); }
function doFlush() {
  const n = resultLog.length;
  resultLog = [];
  try { localStorage.setItem(LOG_KEY, '[]'); } catch {}
  renderLog(); closeFlush();
  if (S) render();
  toast(`Recent Results erased (${n} round${n === 1 ? '' : 's'}).`);
}
$('#flushBtn').addEventListener('click', openFlush);
$('#lockCancel').addEventListener('click', closeFlush);
$('#adminLink').addEventListener('click', closeFlush);
$('#bioBtn').addEventListener('click', async () => {
  try { if (await AdminLock.verifyPasskey()) return doFlush(); $('#lockErr').textContent = 'The device did not confirm it was you. Use the PIN instead.'; }
  catch { $('#lockErr').textContent = "Device unlock was cancelled or isn't available. Use the PIN instead."; }
});
$('#lockForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!AdminLock.hasLock()) return;
  const res = AdminLock.checkPin($('#pin1').value.trim());
  if (res.ok) return doFlush();
  $('#pin1').value = ''; $('#lockErr').textContent = res.error;
});
window.addEventListener('storage', e => {
  if (e.key !== LOG_KEY) return;
  try { resultLog = JSON.parse(e.newValue) || []; } catch { resultLog = []; }
  renderLog();
});

/* ---------- No-sound helper ---------- */
// Chrome blocks sound until the page is clicked, a tab can be muted, or speech can get stuck: say so on screen
function soundProblem(kind) {
  if (!voiceOn) return;
  $('#soundBar').hidden = false;
  $('#soundMsg').textContent = kind === 'blocked'
    ? '🔇 The browser is blocking sound until you click this page.'
    : "🔇 The dealer's voice isn't playing.";
}
function soundOk() { $('#soundBar').hidden = true; $('#soundTips').hidden = true; }
$('#soundCheck').addEventListener('click', () => {
  // this click itself is what browsers wait for before allowing sound
  getAudio();
  if (canSpeak) { speechSynthesis.cancel(); speechSynthesis.resume(); }
  say('Sound check. Can you hear me?', 'welcome');
  playSfx((ac, out, t0) => ({ master: ac.createGain(), nodes: cashRegister(ac, out, t0, .6) }), 1.5);
  $('#soundTips').hidden = false;
});
$('#soundClose').addEventListener('click', soundOk);

/* ---------- Crowd sounds: groan for 0 / 00, cheer for hot numbers ---------- */
// Synthesized with Web Audio (no sound files). They follow the Dealer voice switch; pausing holds them.
let audioCtx = null, sfxOut = [];
function getAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    audioCtx = new AC();
    // iPhone: let these sounds play even when the ring/silent switch is on (Safari 16.4+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  }
  if (audioCtx.state !== 'running' && !paused) audioCtx.resume().catch(() => {});
  return audioCtx;
}
// Browsers only allow sound after a user gesture. Phones count the finger lifting (not touching down),
// so unlock on every kind of tap/click/key until the audio engine is actually running.
function unlockAudio() {
  const ac = getAudio();
  if (!ac) return;
  const blip = ac.createBufferSource();                // a silent sample: iOS needs something to play
  blip.buffer = ac.createBuffer(1, 1, 22050);
  blip.connect(ac.destination); blip.start(0);
  if (ac.state === 'running') ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(t => document.removeEventListener(t, unlockAudio, true));
}
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, unlockAudio, true));

// The crowd sounds themselves (groan, cheer, hurray and their parts) live in casino-sounds.js, shared with the phones.
// Lengths (seconds). A 0/00 and a hot number both come to ~7 s including the dealer's call; the big-win hurray is 7 s.
const SFX_LEN = { groan: 4.8, cheer: 6, hurray: 7 };
// Plays a crowd sound and returns a (pause-aware) promise for when it has finished, echo included.
// The timing is the same with Dealer voice off, so the visuals keep the same rhythm silently.
function playSfx(build, dur) {
  const ended = pwait((dur + .6) * 1000);
  (async () => {
    if (!voiceOn) return;
    const ac = getAudio();
    if (!ac) return;
    if (ac.state !== 'running') { try { await ac.resume(); } catch {} }   // wake it before scheduling
    if (ac.state !== 'running') soundProblem('blocked');
    sfxOut = sfxOut.filter(o => o.endAt > ac.currentTime);              // drop finished sounds; new ones layer on top
    sfxOut.push({ ...build(ac, ac.destination, ac.currentTime + .05, dur), endAt: ac.currentTime + dur + 3 });
  })();
  return ended;
}
// Each crowd sound also plays on the phones at the same moment
const crowdGroan = () => { send({ type: 'sfx', kind: 'groan' }); return playSfx(buildGroan, SFX_LEN.groan); };
const crowdCheer = () => { send({ type: 'sfx', kind: 'cheer' }); return playSfx(buildCheer, SFX_LEN.cheer); };
const crowdHurray = () => { send({ type: 'sfx', kind: 'hurray' }); return playSfx(buildHurray, SFX_LEN.hurray); };
function stopSfx() {
  sfxOut.forEach(o => { o.nodes.forEach(n => { try { n.stop(); } catch {} }); o.master.disconnect(); });
  sfxOut = [];
}
const diceSound = () => { send({ type: 'sfx', kind: 'dice' }); return playSfx(buildDice, 1.4); };

// Preview from the Rules window
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fx]');
  if (!b) return;
  b.blur(); setRules(false);
  if (b.dataset.fx === 'big') {
    const who = S && S.active != null ? S.players[S.active] : null;
    say('Big winner!', 'wave');
    bigWinFx([{ name: who ? who.name : 'Player 1', net: 875, color: who ? pc(S.active) : PCOLORS[0] }]);
  } else if (b.dataset.fx === 'special') {
    const sp = { big: '6 6 6', label: 'TRIPLE', sub: 'preview' };
    specialFx(sp, say('Triple sixes! Total 18.', 'point').then(() => crowdCheer()));
  }
});

// ---- Celebration overlays: shown until their sound ends, topped up with fresh particles ----
const calmMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Particles remove themselves when their animation ends, so long celebrations don't pile up elements
const animateOnce = (el, frames, opts) => el.animate(frames, opts).finished.then(() => el.remove(), () => {});
// Shows `fx` until `until` resolves (and at least minMs), calling burst() now and every `every` ms, then fades it out.
// Everything waits with pwait, so pausing the game freezes the celebration too.
async function holdFx(fx, until, burst, { every = 2400, minMs = 2800 } = {}) {
  document.body.appendChild(fx);
  let alive = true;
  (async () => { while (alive && fx.isConnected) { if (!calmMotion()) burst(); await pwait(every); } })();
  await Promise.all([until, pwait(minMs)]);
  alive = false;
  if (!fx.isConnected) return;
  fx.classList.add('fx-out');
  await pwait(700);
  fx.remove();
}
// A ring of glowing sparks flying out from (x, y), in two quick waves
function sparkBurst(fx, colors, count, { x = '50%', y = '50%', dist = [28, 42], size = [8, 10], delay = 0, waves = true } = {}) {
  for (let k = 0; k < count; k++) {
    const a = k / count * Math.PI * 2 + Math.random() * .3, d = dist[0] + Math.random() * dist[1], sp = document.createElement('span');
    sp.className = 'spark';
    sp.style.cssText = `left:${x};top:${y};--x:${(Math.cos(a) * d).toFixed(1)}vmin;--y:${(Math.sin(a) * d).toFixed(1)}vmin;` +
      `--c:${colors[k % colors.length]};--s:${(size[0] + Math.random() * size[1]).toFixed(0)}px;--d:${(delay + (waves && k % 2 ? .5 : 0) + Math.random() * .25).toFixed(2)}s`;
    sp.addEventListener('animationend', () => sp.remove());
    fx.appendChild(sp);
  }
}
// Banknotes and gold coins burst out of the centre, flutter, then fall
function cashBurst(fx, count = 64) {
  for (let k = 0; k < count; k++) {
    const bill = k % 3 !== 2, el = document.createElement('span');
    el.className = bill ? 'cash-bill' : 'cash-coin';
    el.textContent = bill ? '$100' : '$';
    fx.appendChild(el);                                 // in front, so the burst reads clearly
    const a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.7;   // mostly upward and outward
    const dist = 30 + Math.random() * 38, dx = Math.cos(a) * dist, dy = Math.sin(a) * dist;
    const spin = (Math.random() - .5) * 900, flip = 180 + Math.random() * 540;
    animateOnce(el, [
      { transform: 'translate(-50%, -50%) scale(.2) rotate(0deg)', opacity: 0 },
      { transform: `translate(-50%, -50%) translate(${dx * .5}vmin, ${dy * .5}vmin) scale(1.1) rotate(${spin * .3}deg) rotateY(${flip * .3}deg)`, opacity: 1, offset: .15 },
      { transform: `translate(-50%, -50%) translate(${dx}vmin, ${dy}vmin) scale(1) rotate(${spin * .6}deg) rotateY(${flip * .6}deg)`, opacity: 1, offset: .45 },
      { transform: `translate(-50%, -50%) translate(${dx * 1.2}vmin, ${dy + 70 + Math.random() * 30}vmin) scale(.9) rotate(${spin}deg) rotateY(${flip}deg)`, opacity: 0 },
    ], { duration: 2200 + Math.random() * 600, delay: Math.random() * 300, easing: 'cubic-bezier(.25,.7,.45,1)', fill: 'both' });
  }
}

// Big win: full-screen celebration with confetti, a coin fountain, fireworks and a rolling win counter, for as long as the hurray lasts
const BIG_WIN = 500;
async function bigWinFx(winners) {
  const fx = document.createElement('div');
  fx.className = 'bigwin-fx';
  fx.setAttribute('role', 'status');
  fx.innerHTML = `<div class="bw-rays"></div>
    <div class="bw-title">BIG WIN!</div>
    <div class="bw-list">${winners.map(w => `<div class="bw-win" style="--pc:${w.color}"><span class="dot"></span><span class="nm"></span><b data-to="${w.net}">+$0</b></div>`).join('')}</div>`;
  winners.forEach((w, k) => { fx.querySelectorAll('.bw-win .nm')[k].textContent = w.name; });
  const colors = ['#d4af37', '#f3dc8b', '#e5484d', '#3b82f6', '#22c55e', '#a855f7', '#ffffff', '#ff9100'];
  const burst = () => {
    for (let k = 0; k < 90; k++) {                       // confetti raining down
      const c = document.createElement('span');
      c.className = 'confetti'; c.style.background = colors[k % colors.length];
      c.style.left = Math.random() * 100 + 'vw';
      if (k % 4 === 0) c.style.borderRadius = '50%';
      fx.appendChild(c);
      const sway = (Math.random() - .5) * 16, spin = (Math.random() - .5) * 1440;
      animateOnce(c, [
        { transform: 'translate(0, -12vh) rotate(0) rotateX(0)', opacity: 1 },
        { transform: `translate(${sway}vw, 50vh) rotate(${spin / 2}deg) rotateX(${spin}deg)`, opacity: 1, offset: .5 },
        { transform: `translate(${-sway / 2}vw, 112vh) rotate(${spin}deg) rotateX(${spin * 2}deg)`, opacity: .9 },
      ], { duration: 3200 + Math.random() * 2200, delay: Math.random() * 1800, easing: 'linear', fill: 'both' });
    }
    for (let k = 0; k < 26; k++) {                       // gold coins fountaining up from the bottom
      const coin = document.createElement('span');
      coin.className = 'cash-coin'; coin.textContent = '$';
      fx.appendChild(coin);
      const dx = (Math.random() - .5) * 90, peak = 45 + Math.random() * 45, flip = 360 + Math.random() * 1080;
      animateOnce(coin, [
        { transform: 'translate(-50%, 0) scale(.6)', opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * .5}vw), -${peak}vh) scale(1) rotateY(${flip / 2}deg)`, opacity: 1, offset: .45 },
        { transform: `translate(calc(-50% + ${dx}vw), 10vh) scale(.9) rotateY(${flip}deg)`, opacity: 1 },
      ], { duration: 2000 + Math.random() * 900, delay: Math.random() * 1800, easing: 'cubic-bezier(.3,.7,.6,1)', fill: 'both' });
    }
    for (let k = 0; k < 3; k++)                          // firework bursts
      sparkBurst(fx, colors.slice(k).concat(colors.slice(0, k)), 22,
        { x: (12 + Math.random() * 76) + 'vw', y: (10 + Math.random() * 45) + 'vh', dist: [9, 7], size: [6, 3], delay: .2 + k * .7, waves: false });
  };
  // Roll each amount up from $0 (holds while paused)
  const amounts = [...fx.querySelectorAll('.bw-win b')];
  let t = 0;
  const roll = setInterval(() => {
    if (paused) return;
    t = Math.min(1, t + 30 / 1800);
    const e = 1 - Math.pow(1 - t, 3);
    amounts.forEach(el => { el.textContent = '+' + fmt(Math.round(+el.dataset.to * e)); });
    if (t >= 1) clearInterval(roll);
  }, 30);
  await holdFx(fx, crowdHurray(), burst);
  clearInterval(roll);
}

// Something special (a Sic Bo triple): full-screen gold burst with cash, for as long as the call and the cheer last
async function specialFx(sp, until) {
  const fx = document.createElement('div');
  fx.className = 'zero-fx';
  fx.setAttribute('aria-hidden', 'true');
  fx.innerHTML = `<div class="rays"></div><div class="ring"></div><div class="big" style="font-size:min(26vw,40vh);color:#ffd54f">${esc(sp.big)}</div><div class="label">${esc(sp.label)}</div>`;
  const colors = ['#ffd54f', '#d4af37', '#fff6cf', '#4ade80', '#f3dc8b'];
  await holdFx(fx, until, () => { sparkBurst(fx, colors, 48); cashBurst(fx); });
}

/* ---------- Master table: guests join from their own phones ---------- */
const NET = { master: false, code: null, hostKey: null, es: null, online: new Set(), pending: [], syncTimer: null, addresses: [], port: location.port };
const sharing = () => !!NET.code;
// While the table is shared, a phone's players belong to that phone only: this screen can't select, bet for or cash them out
const lockedToPhone = i => sharing() && !!S?.players[i]?.owner;
// Keep this screen's selection on one of its own players
function keepLocalActive() {
  if (!S || S.phase !== 'bet' || S.active == null || !lockedToPhone(S.active)) return;
  const local = alive().find(i => !lockedToPhone(i));
  S.active = S.focus = local ?? null;
}

async function startSharing(takeover = false) {
  if (!S || !NET.master) return;
  try {
    const r = await fetch('/api/host', { method: 'POST', body: JSON.stringify({ game: GAME.id, code: NET.code, hostKey: NET.hostKey, takeover }) });
    if (r.status === 409) {                          // only one shared table: another screen has it
      const { code } = await r.json();
      $('#takeoverText').textContent = `Another screen is already sharing table ${code}. Take it over? That table closes and its phones move to this one.`;
      $('#takeoverModal').hidden = false;
      return;
    }
    if (!r.ok) throw 0;
    const info = await r.json();
    NET.code = info.code; NET.hostKey = info.hostKey; NET.addresses = info.addresses; NET.port = info.port;
  } catch {
    return;                                          // no Casino server: plays as a one-device table
  }
  if (!S.timeLimit) {                               // with guests, the wheel spins only when the betting window closes
    S.timeLimit = 30;
    if (S.phase === 'bet') startTurnTimer();
    toast('Shared tables deal on a timer: the betting window is now 30 seconds.');
  }
  NET.es?.close();
  NET.es = new EventSource(`/api/stream?t=${NET.code}&role=host&key=${NET.hostKey}`);
  NET.es.onmessage = e => { try { handleRemote(JSON.parse(e.data)); } catch {} };
  // If the server restarted, our table is gone: open it again (phones follow automatically)
  NET.es.onerror = () => setTimeout(async () => {
    if (!sharing()) return;
    try {
      const { tables } = await (await fetch('/api/tables')).json();
      if (!tables.some(t => t.code === NET.code)) { NET.es.close(); NET.code = NET.hostKey = null; startSharing(true); }
    } catch {}
  }, 2500);
  render();                                         // hides the spin button and locks phone players right away
  syncNow();
  toast(`Phones on the Wi-Fi can join: ${phoneAddress()}`);
}
// The address guests type on their phones (just the computer's address; they join the table automatically)
const phoneAddress = () => `http://${NET.addresses[0] || location.hostname}:${NET.port || location.port}`;
// The master table shares itself as soon as a Casino-style game is running
function autoShare() { if (NET.master && S && !sharing()) startSharing(); }
function stopSharing(replaced = false) {
  if (!sharing()) return;
  if (!replaced) fetch('/api/close', { method: 'POST', body: JSON.stringify({ code: NET.code, hostKey: NET.hostKey }) }).catch(() => {});
  NET.es?.close();
  Object.assign(NET, { code: null, hostKey: null, es: null, online: new Set(), pending: [] });
  if (S) S.players.forEach(p => { if (p.owner) p.owner = null; });   // their players stay, now controlled here
  $('#shareModal').hidden = true;
  renderShareBtn();
  if (S) render();
}
function send(msg, to = 'all') {
  if (!sharing()) return;
  fetch('/api/send', { method: 'POST', body: JSON.stringify({ t: NET.code, from: 'host', hostKey: NET.hostKey, to, msg }) }).catch(() => {});
}
// What phones need to draw the table
function snapshot() {
  return {
    type: 'state', game: GAME.id, code: NET.code, phase: S.phase, paused, round: S.round, maxRounds: S.maxRounds,
    closesIn: S.phase === 'bet' && timerId && S.deadline ? Math.max(0, S.deadline - Date.now()) : null, windowLen: S.timerTotal || 0,
    players: S.players.map((p, i) => ({ i, name: p.name, bal: p.bal, start: p.start, color: p.color || pc(i), owner: p.owner || null,
      inGame: inGame(p), cashedOut: !!p.cashedOut, onTable: staked(i), canRebet: !!S.lastBets[i]?.length,
      results: p.results.slice(-12), wlTotal: cents(p.results.reduce((a, r) => a + r.net, 0)) })),
    bets: S.bets, stage: S.stage, history: S.history.slice(0, 1), seatsFree: PCOLORS.length - alive().length,
    log: resultLog.slice(-50), winKeys: S.phase === 'result' ? S.winKeys || [] : [],
  };
}
function shareSync() {
  renderShareBtn();
  if (!sharing() || NET.syncTimer) return;
  NET.syncTimer = setTimeout(syncNow, 120);
}
function syncNow() {
  clearTimeout(NET.syncTimer); NET.syncTimer = null;
  if (sharing() && S) send(snapshot());
  renderShareBtn();
  if (!$('#shareModal').hidden) renderShare();
}
const ownedBy = (i, device) => S.players[i] && S.players[i].owner === device;
// Actions arriving from phones
function handleRemote(m) {
  if (m.type === 'replaced') { stopSharing(true); return toast('Another screen took over the shared table. This game continues here on its own.'); }
  if (m.type === 'presence') { m.online ? NET.online.add(m.device) : NET.online.delete(m.device); if (S) render(); return; }
  if (!S || !m.device) return;
  const reply = msg => send(msg, m.device);
  const refuse = text => reply({ type: 'error', text });
  switch (m.type) {
    case 'hello':                                  // a phone just connected: catch it up and greet it personally
      send(snapshot(), m.device);
      return send({ type: 'say', pose: 'welcome', text: S.phase === 'bet'
        ? `Welcome to ${GAME.name}! Bets are open, place your bets please.`
        : `Welcome to ${GAME.name}! A round is being played; you can bet in the next one.` }, m.device);
    case 'join': {
      const name = String(m.name || '').trim().slice(0, 16) || `Player ${S.players.length + 1}`;
      if (alive().length + NET.pending.length >= PCOLORS.length) return refuse('The table is full (6 players).');
      if (S.phase !== 'bet' || paused) { NET.pending.push({ name, device: m.device }); return reply({ type: 'queued', name }); }
      const i = addPlayer(name, m.device);
      return reply({ type: 'joined', player: i, name });
    }
  }
  const who = +m.player;
  if (!ownedBy(who, m.device)) return refuse('That player is not on this phone.');
  if (paused) return refuse('The table is paused.');
  if (S.phase !== 'bet') return refuse('Bets are closed until the next round.');
  let err;
  switch (m.type) {
    case 'bet': err = place(m.key, Math.max(1, +m.amt || 0), who, true); break;
    case 'remove': removeKey(m.key, who); break;
    case 'undo': undo(who); break;
    case 'clear': clearMine(who); break;
    case 'rebet': err = rebet(who, true); break;
    case 'cashout': err = doCashOut(who); break;
  }
  if (err) refuse(err);
}
// Players who asked to join during a round take their seats when bets open again
function seatPending() {
  if (!sharing() || !S || S.phase !== 'bet') return;
  while (NET.pending.length && alive().length < PCOLORS.length) {
    const { name, device } = NET.pending.shift();
    send({ type: 'joined', player: addPlayer(name, device), name }, device);
  }
  NET.pending.forEach(({ device }) => send({ type: 'error', text: 'The table filled up before you were seated.' }, device));
  NET.pending = [];
}
function renderShareBtn() {
  const b = $('#shareBtn');
  b.hidden = !sharing();
  b.textContent = `📱 ${NET.online.size} phone${NET.online.size === 1 ? '' : 's'}`;
  b.classList.toggle('on', sharing());
}
function renderShare() {
  if (!sharing()) return;
  const urls = (NET.addresses.length ? NET.addresses : [location.hostname]).map(ip => `http://${ip}:${NET.port}`);
  $('#shareUrls').innerHTML = urls.map(u => `<code>${u}</code>`).join('');
  const phones = S ? S.players.map((p, i) => ({ p, i })).filter(({ p }) => p.owner && !p.cashedOut) : [];
  const byDevice = {};
  phones.forEach(({ p }) => { (byDevice[p.owner] ||= []).push(p.name); });
  const devices = Object.entries(byDevice);
  $('#sharePhones').innerHTML = devices.length
    ? devices.map(([d, names], k) => `<li><span class="${NET.online.has(d) ? 'on' : 'off'}">●</span> Phone ${k + 1}: ${names.map(n => n.replace(/[<>&]/g, '')).join(', ')}${NET.online.has(d) ? '' : ' <small>(disconnected)</small>'}</li>`).join('')
    : '<li class="muted">No phones yet. Players on phones appear here as they join.</li>';
}
$('#shareBtn').addEventListener('click', () => { renderShare(); $('#shareModal').hidden = false; });
$('#shareClose').addEventListener('click', () => { $('#shareModal').hidden = true; });
// When the game files are updated, offer a reload (never forced mid-game on the table)
let filesVer = null;
setInterval(async () => {
  try {
    const { version } = await (await fetch('/api/version', { cache: 'no-store' })).json();
    if (filesVer && version !== filesVer) $('#updateBar').hidden = false;
    filesVer ||= version;
  } catch {}
}, 15000);
fetch('/api/version', { cache: 'no-store' }).then(r => r.json()).then(v => { filesVer = v.version; }).catch(() => {});
$('#updateBtn').addEventListener('click', () => location.reload());
// Is this the host computer (master)? Other devices go to the join page instead of running their own table.
(async () => {
  try {
    const info = await (await fetch('/api/info')).json();
    Object.assign(NET, { master: info.master !== false, addresses: info.addresses || [], port: info.port, tts: !!info.tts });
    if (info.master === false) return location.replace('table-remote.html');   // only when the server clearly says "not the host computer"
    autoShare();
  } catch {}                                         // no Casino server (e.g. opened as a file): one-device table
})();
$('#takeoverNo').addEventListener('click', () => { $('#takeoverModal').hidden = true; });
$('#takeoverYes').addEventListener('click', () => { $('#takeoverModal').hidden = true; startSharing(true); });

// One shared hover/tap tooltip for both charts
const tip = $('#tip');
document.addEventListener('pointerover', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip;
  tip.hidden = false;
  placeTip(e);
});
// Follow the pointer but never spill off the screen edges
function placeTip(e) {
  const half = tip.offsetWidth / 2 + 8;
  tip.style.left = Math.min(Math.max(e.clientX, half), innerWidth - half) + 'px';
  tip.style.top = e.clientY + 'px';
}
document.addEventListener('pointermove', e => { if (!tip.hidden) placeTip(e); });
window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
window.addEventListener('resize', () => { if (S) render(); });

let anim = null;                     // (no wheel at this table)
/* ---------- Pause / resume / exit ---------- */
let paused = false, pausedAt = 0, pausedAnims = [];

// setTimeout that stops counting while the game is paused
function pwait(ms) {
  return new Promise(res => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      if (!paused) ms -= now - last;
      last = now;
      if (ms <= 0) { clearInterval(id); res(); }
    }, 50);
  });
}

function updateMasterBtns() {
  $('#pauseBtn').disabled = !S;
  $('#quitBtn').disabled = !S;
  $('#pauseBtn').textContent = paused ? 'Resume' : 'Pause';
}

function pauseGame(confirmExit = false) {
  if (!S) return;
  if (!paused) {
    paused = true;
    pausedAt = performance.now();
    if (timerId) S.remaining = S.deadline - Date.now();
    if (canSpeak) speechSynthesis.pause();
    audioCtx?.suspend();
    pausedAnims = document.getAnimations().filter(a => a.playState === 'running');
    pausedAnims.forEach(a => a.pause());
  }
  $('#pmMain').hidden = confirmExit;
  $('#pmConfirm').hidden = !confirmExit;
  $('#pauseModal').hidden = false;
  updateMasterBtns();
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  if (anim) anim.t0 += performance.now() - pausedAt;
  if (S && S.remaining != null) { S.deadline = Date.now() + S.remaining; S.remaining = null; }
  if (canSpeak) speechSynthesis.resume();
  audioCtx?.resume();
  pausedAnims.forEach(a => a.play());
  pausedAnims = [];
  $('#pauseModal').hidden = true;
  updateMasterBtns();
}

function exitGame() {
  stopSharing();
  ['#addModal', '#cashModal', '#lockModal', '#pauseModal', '#roundModal', '#endModal'].forEach(id => $(id).hidden = true);
  stopAutoNext();
  stopTurnTimer();
  paused = false;
  pausedAnims.forEach(a => a.play()); pausedAnims = [];
  stopVoice();
  stopSfx();
  document.querySelectorAll('.fly-chip').forEach(c => c.getAnimations().forEach(a => a.finish()));
  document.querySelectorAll('.zero-fx, .bigwin-fx').forEach(el => el.remove());
  if (S) S.players.forEach((p, i) => Leaderboard.record(GAME.id, p, S.phase === 'bet' ? staked(i) : 0));   // leaving mid-game still counts
  S = null;                     // any round in progress sees this and stops
  setRules(false);
  Object.values(cells).forEach(c => { c.classList.remove('win'); c.querySelector('.stacks').innerHTML = ''; });
  $('#timer').hidden = true;
  renderStage();
  sayToken++; setPose('');
  bubble.textContent = 'Thanks for playing! Come back soon.';
  $('#setup').hidden = false;
  updateMasterBtns();
}
$('#pauseBtn').addEventListener('click', () => paused ? resumeGame() : pauseGame());
let exitTarget = null;
function askExit(target) {
  exitTarget = target;
  $('#pmConfirmTitle').textContent = target === 'lobby' ? 'Leave for the lobby?' : 'Exit game?';
  $('#pmConfirmText').textContent = target === 'lobby' ? 'This game and all chip balances will be lost.' : "This round and all chip balances will be lost. You'll go back to the setup screen.";
  pauseGame(true);
}
$('#quitBtn').addEventListener('click', () => askExit(null));
$('#lobbyBtn').addEventListener('click', e => { if (S) { e.preventDefault(); askExit('lobby'); } });
$('#resumeBtn').addEventListener('click', resumeGame);
$('#exitBtn').addEventListener('click', () => askExit(null));
$('#exitNo').addEventListener('click', () => pauseGame(false));
$('#exitYes').addEventListener('click', () => { exitGame(); if (exitTarget === 'lobby') location.href = 'casino.html'; });

/* ---------- Dealer ---------- */
const dealerEl = $('#dealer'), bubble = $('#bubble');
const canSpeak = 'speechSynthesis' in window;
let voiceOn = canSpeak, voice = null, sayToken = 0;
try { if (localStorage.getItem('gn-voice') === 'off') voiceOn = false; } catch {}
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /Daniel/.test(v.name) && v.lang.startsWith('en'))
    || vs.find(v => v.lang === 'en-GB') || vs.find(v => v.lang.startsWith('en')) || null;
}
if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function setPose(pose, talking) {
  dealerEl.className = 'dealer';
  void dealerEl.offsetWidth;            // restart CSS animations
  dealerEl.className = 'dealer' + (pose ? ' ' + pose : '') + (talking ? ' talking' : '');
}

// Shows the line in the speech bubble and speaks it; resolves when finished.
// The dealer's voice comes from this computer's own speech via the server (/api/tts) when it can, played through
// Web Audio like the crowd sounds; the browser's built-in speech is only a fallback (Chrome's can get stuck on Macs).
const ttsClips = new Map();          // line → Promise<AudioBuffer>
let voiceSrc = null;                 // the line playing right now
function ttsClip(text) {
  if (!ttsClips.has(text)) {
    const job = fetch(`/api/tts?voice=Daniel&text=${encodeURIComponent(text)}`)
      .then(r => { if (!r.ok) throw new Error('no speech'); return r.arrayBuffer(); })
      .then(data => getAudio().decodeAudioData(data));
    job.catch(() => ttsClips.delete(text));
    ttsClips.set(text, job);
    if (ttsClips.size > 120) ttsClips.delete(ttsClips.keys().next().value);
  }
  return ttsClips.get(text);
}
function stopVoice() { try { voiceSrc?.stop(); } catch {} voiceSrc = null; if (canSpeak) speechSynthesis.cancel(); }
function say(text, pose) {
  send({ type: 'say', text, pose });                 // phones' dealers say the same line
  const my = ++sayToken;
  bubble.textContent = text;
  bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
  setPose(pose, true);
  return new Promise(res => {
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      if (my === sayToken) dealerEl.classList.remove('talking');
      pwait(150).then(res);
    };
    const est = 700 + text.length * 60;
    if (!voiceOn) return pwait(est).then(finish);
    // Fallback: the browser's own speech
    const browserSpeech = () => {
      if (!canSpeak) return pwait(est).then(finish);
      if (speechSynthesis.paused) speechSynthesis.resume();   // Chrome can stay paused after a pause/resume
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 1.02;
      let started = false;
      u.onstart = () => { started = true; soundOk(); };
      u.onend = finish;
      u.onerror = e => { if (e.error === 'not-allowed') soundProblem('blocked'); finish(); };
      speechSynthesis.speak(u);
      // If the browser never starts speaking, nudge it once, then say so on screen
      setTimeout(() => {
        if (started || done || my !== sayToken || paused) return;
        speechSynthesis.cancel(); speechSynthesis.resume(); speechSynthesis.speak(u);
        setTimeout(() => { if (!started && !done && my === sayToken && !paused) soundProblem('silent'); }, 1500);
      }, 1500);
      pwait(est + 3000).then(finish);   // safety net if onend never fires
    };
    if (!NET.tts) return browserSpeech();
    // This computer's voice, through Web Audio
    (async () => {
      const ac = getAudio();
      if (ac && ac.state !== 'running') { try { await ac.resume(); } catch {} }
      if (!ac || ac.state !== 'running') { soundProblem('blocked'); return pwait(est).then(finish); }
      let clip;
      try { clip = await ttsClip(text); } catch { return browserSpeech(); }
      if (done || my !== sayToken) return;
      try { voiceSrc?.stop(); } catch {}
      if (canSpeak) speechSynthesis.cancel();
      const src = ac.createBufferSource();
      src.buffer = clip; src.connect(ac.destination);
      voiceSrc = src;
      src.onended = () => { if (voiceSrc === src) voiceSrc = null; finish(); };
      src.start();
      soundOk();
      pwait(clip.duration * 1000 + 2500).then(finish);   // safety net
    })();
  });
}

function center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
function fly(fromEl, toEl, color, label, delay = 0) {
  const [x0, y0] = center(fromEl), [x1, y1] = center(toEl), dx = x1 - x0, dy = y1 - y0;
  const c = document.createElement('div');
  c.className = 'fly-chip'; c.style.setProperty('--pc', color); c.textContent = label || '';
  c.style.left = x0 + 'px'; c.style.top = y0 + 'px';
  document.body.appendChild(c);
  const t = (x, y, sc) => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${sc})`;
  const a = c.animate([
    { transform: t(0, 0, .8), opacity: 0 },
    { transform: t(dx / 2, dy / 2 - 70, 1.25), opacity: 1, offset: .5 },
    { transform: t(dx, dy, .9), opacity: .95 },
  ], { duration: 750, delay, easing: 'ease-in-out', fill: 'both' });
  return a.finished.then(() => c.remove());
}

function renderVoiceBtn() {
  const b = $('#voiceBtn');
  b.textContent = 'Dealer voice: ' + (voiceOn ? 'On' : 'Off');
  b.disabled = !canSpeak;
}
$('#voiceBtn').addEventListener('click', () => {
  voiceOn = !voiceOn;
  if (!voiceOn) { stopVoice(); stopSfx(); }
  try { localStorage.setItem('gn-voice', voiceOn ? 'on' : 'off'); } catch {}
  renderVoiceBtn();
});
renderVoiceBtn();

/* ---------- Payout table and rules ---------- */
function renderPayouts() {
  const stake = +$('#exStake').value;
  $('#payoutRows').innerHTML = GAME.payouts.map(([name, when, pays, mult, often]) => `<tr><td><b>${name}</b></td><td class="sub">${when}</td>
    <td class="num odds">${pays}</td><td class="num ex">+${fmt(cents(stake * mult))}</td><td class="num ex">${fmt(cents(stake * (mult + 1)))}</td><td class="ex sub">${often}</td></tr>`).join('');
}
$('#exStake').addEventListener('change', renderPayouts);
$('#exToggle').addEventListener('change', e => $('#payouts').classList.toggle('show-ex', e.target.checked));
$('#rulesTitle').textContent = `${GAME.name} rules`;
$('#rulesList').innerHTML = GAME.rules.map(r => `<li>${r}</li>`).join('') + `
  <li><b>Betting:</b> select a chip, then tap a space on the table (tap again to add more). Right-click / long-press a space to take your chips back; Undo, Clear and Rebet work on the selected player.</li>
  <li><b>Casino style:</b> the dealer opens a betting window and everyone bets at once; tap a name above the table to bet as that player. When the window closes the dealer plays the round, and 5 seconds after the result the next window opens. With no time limit, press "No more bets" when ready.</li>
  <li><b>Phones at the table:</b> this computer's table is the master. Guests on the same Wi-Fi open this computer's address on their phone and join automatically with their own players (up to 6 seats in all). Each phone controls only its own players. With phones connected the round starts only when the betting window closes. 📱 marks phone players.</li>
  <li><b>Open table / Add player / Cash out:</b> "Open the table now" starts an empty table that never ends on its own. Join with "+ Add player" (up to 6) and leave with "Cash out" while bets are open.</li>
  <li><b>Big wins:</b> anyone winning $500 or more in one round gets the big-win celebration. <span class="fx-preview"><button type="button" class="btn" data-fx="big">Preview big win</button>${GAME.special ? '<button type="button" class="btn" data-fx="special">Preview triple</button>' : ''}</span></li>
  <li><b>Recent Results</b> are kept on this device until flushed with the admin lock (set up on the Admin page).</li>
  <li><b>Keys:</b> Space = no more bets · Enter = next round · P = pause / resume · Esc = resume / close rules.</li>`;
function setRules(open) {
  $('#rules').hidden = !open;
  $('#rulesBtn').setAttribute('aria-pressed', open);
  if (open) $('.table-area').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#rules').hidden) setRules(false); });
document.addEventListener('pointerdown', e => { if (!$('#rules').hidden && !e.target.closest('#rules, #rulesBtn')) setRules(false); });
$('#rulesBtn').addEventListener('click', () => setRules($('#rules').hidden));
$('#rulesClose').addEventListener('click', () => setRules(false));
renderPayouts();

/* ---------- Wire up ---------- */
Leaderboard.mount(GAME.id, $('#payouts'));
Leaderboard.mount(GAME.id, $('#setupForm .lobby-exit'), { compact: true });   // top 5 on the setup screen
window.addEventListener('pagehide', () => { if (S) S.players.forEach((p, i) => Leaderboard.record(GAME.id, p, S.phase === 'bet' ? staked(i) : 0)); });
buildBoard();
buildChips();
renderStage();
renderLog();
$('#setupForm').addEventListener('submit', e => { e.preventDefault(); newGame(); });
$('#openTableBtn').addEventListener('click', () => newGame(true));
$('#mainBtn').addEventListener('click', mainAction);
$('#undoBtn').addEventListener('click', () => undo());
$('#clearBtn').addEventListener('click', () => clearMine());
$('#rebetBtn').addEventListener('click', () => rebet());
$('#rmBtn').addEventListener('click', nextRound);
$('#againBtn').addEventListener('click', () => newGame());
$('#newBtn').addEventListener('click', () => { $('#endModal').hidden = true; $('#setup').hidden = false; });
document.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'INPUT') return;
  if ((e.key === 'p' || e.key === 'P') && S) { paused ? resumeGame() : pauseGame(); return; }
  if (paused) { if (e.key === 'Escape') resumeGame(); return; }
  if (e.key === 'Enter' && !$('#roundModal').hidden) nextRound();
  else if (e.key === ' ' && S && S.phase === 'bet' && $('#setup').hidden) { e.preventDefault(); mainAction(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !paused) pauseGame(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#installBtn').hidden = false; });
$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt(); await installPrompt.userChoice;
  installPrompt = null; $('#installBtn').hidden = true;
});
