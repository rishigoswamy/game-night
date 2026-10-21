const $ = s => document.querySelector(s);
const PCOLORS = ['var(--p0)', 'var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p5)'];
// A player's colour; players who join later take the first colour nobody has used
const pc = i => S?.players[i]?.color ?? PCOLORS[i % PCOLORS.length];
const CHIPS = [[5,'#6b7280'],[10,'#2563eb'],[25,'#16a34a'],[50,'#dc2626'],[100,'#111827'],[500,'#7c3aed']];
const chipColor = v => (CHIPS.find(c => c[0] === v) || [0, '#6b7280'])[1];
const MIN_BET = 5;
const ABORT = Symbol('abort');   // thrown when the game is exited mid-sequence

const money = n => Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = n => (n < 0 ? '-$' : '$') + money(Math.abs(n));
const short = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(Math.round(n * 100) / 100);
const sum = a => a.reduce((x, y) => x + y, 0);

let S = null;
let cardSeq = 0;
const cardEls = new Map();

/* ---------- Cards & shoe ---------- */
function randInt(n) {
  const a = new Uint32Array(1), lim = Math.floor(2 ** 32 / n) * n;
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return a[0] % n;
}
const newShoe = decks => BlackjackRules.newShoe(decks, randInt);
function drawCard() {
  if (!S.shoe.length) S.shoe = newShoe(S.decks);
  return { ...S.shoe.pop(), id: ++cardSeq, down: false };
}
// The rules (card values, totals, blackjack, double/split, the dealer, payouts) live in games/casino/blackjack-rules.js
const { cardVal, handTotal, isBlackjack, totalLabel, spokenTotal } = BlackjackRules;
const dealerBJ = () => BlackjackRules.isDealerBlackjack(S.dealer.cards);

function cardEl(c) {
  let el = cardEls.get(c.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'card';
    const red = c.s === '♥' || c.s === '♦';
    const pip = 'JQK'.includes(c.r) ? `<span class="court">${c.r}</span>` : c.s;
    el.innerHTML = `<div class="card-inner"><div class="face${red ? ' red' : ''}">
      <span class="corner tl">${c.r}<br>${c.s}</span><span class="pip">${pip}</span><span class="corner br">${c.r}<br>${c.s}</span>
      </div><div class="back"></div></div>`;
    el.setAttribute('aria-label', `${c.r} of ${c.s}`);
    cardEls.set(c.id, el);
  }
  el.classList.toggle('down', !!c.down);
  return el;
}

/* ---------- Rendering ---------- */
// One seat on screen at a time: whoever is betting, playing or being paid (S.focus).
const seatEl = $('#seat');
function buildChips() {
  CHIPS.forEach(([v, c]) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.style.setProperty('--cc', c); b.textContent = v; b.dataset.v = v;
    b.setAttribute('aria-label', `Add $${v} to bet`);
    b.addEventListener('click', () => { if (Date.now() - (+b.dataset.dragged || 0) > 400) addChip(v); });
    enableChipDrag(b, v, c);
    $('#chips').appendChild(b);
  });
}
const betTotal = i => sum(S.betStacks[i]);
const curHand = () => S.turn && S.hands[S.turn.p][S.turn.h];
const pillEl = i => $(`#order .pill[data-i="${i}"]`);
const anchorFor = i => i === S.focus ? seatEl : (pillEl(i) || seatEl);   // where chips/cards for player i fly
function seatTag(i) {
  if (S.phase === 'bet' && S.active === i) return 'Betting';
  if (S.phase === 'play' && S.turn && S.turn.p === i) return lockedToPhone(i) ? 'Playing on phone' : 'Your turn';
  if (S.phase === 'result') return 'Payout';
  return '';
}
const casinoMode = () => S && S.mode === 'casino';

function render() {
  if (!S) return;
  keepLocalActive();
  $('#roundInfo').textContent = `Round ${S.round}${S.maxRounds ? ' of ' + S.maxRounds : ''} · ${S.openTable ? 'open table · ' : ''}${alive().length} playing`;
  // Only the dealer's latest result so the top bar never wraps
  const h = S.history[0];
  $('#history').innerHTML = h ? `<small>Dealer last</small><span class="${h === 'BJ' ? 'h-bj' : h === 'Bust' ? 'h-bust' : ''}">${h}</span>` : '';
  $('#shoeCount').textContent = `${S.shoe.length} cards`;
  renderDealer();
  renderOrder();
  renderSeat();
  renderControls();
  shareSync();
}

function renderDealer() {
  const cards = S.dealer.cards;
  $('#dealerCards').replaceChildren(...cards.map(cardEl));
  const tot = $('#dealerTotal');
  tot.hidden = !cards.length;
  if (!cards.length) return;
  const hidden = cards.some(c => c.down);
  const t = handTotal(cards).t;
  tot.className = 'total' + (t > 21 ? ' bust' : !hidden && dealerBJ() ? ' bj' : '');
  tot.textContent = hidden ? `${totalLabel(cards)} + ?` : dealerBJ() ? 'Blackjack' : totalLabel(cards);
}

// Compact strip of every player: who's up, plus a one-word status (no balances)
function pillStatus(i) {
  const p = S.players[i];
  if (!S.order.includes(i) && p.bal < 1) return 'out';
  if (S.phase === 'bet') {
    const amt = betTotal(i);
    return amt ? fmt(amt) : !casinoMode() && S.order.indexOf(i) < S.turnIdx ? 'no bet' : '';
  }
  const hands = S.hands[i];
  if (!hands.length) return 'sitting out';
  if (S.phase === 'result' && hands.every(h => h.outcome)) {
    const net = sum(hands.map(h => h.net));
    return net > 0 ? `+${fmt(net)}` : net < 0 ? `-${fmt(-net)}` : 'push';
  }
  return hands.map(h => h.outcome === 'bust' ? 'Bust' : isBlackjack(h) ? 'BJ' : handTotal(h.cards).t).join(' / ');
}
function renderOrder() {
  const box = $('#order');
  box.innerHTML = '';
  S.players.forEach((p, i) => {
    if (p.cashedOut || (S.openTable && p.bal < 1 && !S.order.includes(i))) return;   // left the table: keep them off the UI
    const out = !S.order.includes(i) && p.bal < 1;
    const st = pillStatus(i);
    const pick = casinoMode() && S.phase === 'bet' && !out && !lockedToPhone(i);    // tap a name to bet as that player
    const pill = document.createElement(pick ? 'button' : 'span');
    if (pick) { pill.type = 'button'; pill.title = `Bet as ${p.name}`; pill.addEventListener('click', () => { S.active = S.focus = i; render(); }); }
    pill.className = 'pill' + (i === S.focus ? ' now' : out ? ' out' : '');
    pill.dataset.i = i;
    pill.style.setProperty('--pc', pc(i));
    pill.innerHTML = `<span class="dot"></span><span class="nm"></span>${p.owner ? `<span class="ph" title="${NET.online.has(p.owner) ? 'Plays from a phone' : 'Phone disconnected'}">📱</span>` : ''}${st && !out ? `<span class="st">${st}</span>` : out ? ' · out' : ''}`;
    if (p.owner && !NET.online.has(p.owner)) pill.classList.add('away');
    pill.querySelector('.nm').textContent = p.name;
    box.appendChild(pill);
  });
  if (S.phase === 'bet' && alive().length < PCOLORS.length) {
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'pill add'; add.textContent = '+ Add player';
    add.addEventListener('click', openAddPlayer);
    box.appendChild(add);
  }
}

function renderSeat() {
  const i = S.focus, p = S.players[i];
  if (i == null || !p) {                          // nobody seated here yet (open table, or only phone players)
    seatEl.classList.remove('active');
    seatEl.style.removeProperty('--pc');
    seatEl.querySelector('.nm').textContent = sharing() ? 'Shared table' : 'Table open';
    seatEl.querySelector('.bal').textContent = '';
    seatEl.querySelector('.tag').hidden = true;
    $('#wlCard').hidden = true;
    seatEl.querySelector('.seat-body').innerHTML = `<div class="seat-empty">${sharing()
      ? 'Players on phones bet and play from their phones. Tap <b>+ Add player</b> to also play from this screen.'
      : 'No one is at the table yet. Tap <b>+ Add player</b> to join.'}</div>`;
    return;
  }
  const tag = seatTag(i);
  seatEl.dataset.i = i;
  seatEl.style.setProperty('--pc', pc(i));
  seatEl.classList.toggle('active', !!tag && S.phase !== 'result');
  seatEl.querySelector('.nm').textContent = p.name;
  seatEl.querySelector('.bal').textContent = fmt(p.bal);
  const tg = seatEl.querySelector('.tag'); tg.hidden = !tag; tg.textContent = tag;
  $('#wlCard').hidden = false;
  RouletteView.renderWinLoss($('#wlCard'), p.name, p.results || [], (p.results || []).reduce((a, r) => a + r.net, 0), fmt);
  const body = seatEl.querySelector('.seat-body');
  body.replaceChildren();
  if (S.phase === 'bet') {
    body.appendChild(betSpot(i));
    if (S.active === i && inGame(p) && !lockedToPhone(i)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn cashout'; b.id = 'cashOutBtn'; b.textContent = 'Cash out';
      b.addEventListener('click', () => openCashOut(i));
      body.appendChild(b);
    }
  }
  else if (!S.hands[i].length) body.innerHTML = '<span class="seat-note">Sitting out this round</span>';
  else S.hands[i].forEach((h, k) => body.appendChild(handEl(i, h, k)));
}

function betSpot(i) {
  const stack = S.betStacks[i], amt = betTotal(i);
  const open = S.active === i;
  const d = document.createElement('div');
  d.className = 'bet-spot' + (open ? ' open' : '');
  d.innerHTML = `<div class="spot-ring${amt && open ? ' has-chips' : ''}">${amt
      ? stack.slice(-6).map((v, k) => `<span class="disc" style="--cc:${chipColor(v)};--k:${k}"></span>`).join('')
      : '<span class="spot-label">BET</span>'}</div>
    <div class="spot-amt">${amt ? fmt(amt) : open ? 'Place a bet' : 'No bet yet'}</div>`;
  if (amt && open) enablePullBack(d.querySelector('.spot-ring'), i);
  return d;
}

const STATUS = { bj: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust' };
function handEl(i, h, k) {
  const active = S.phase === 'play' && S.turn && S.turn.p === i && S.turn.h === k;
  const d = document.createElement('div');
  d.className = 'hand' + (active ? ' active' : '') + (h.swept ? ' swept' : '');
  const cards = document.createElement('div');
  cards.className = 'cards';
  cards.append(...h.cards.map(cardEl));
  const t = handTotal(h.cards).t;
  const bj = isBlackjack(h);
  const meta = document.createElement('div');
  meta.className = 'hand-meta';
  meta.innerHTML = `<span class="total${t > 21 ? ' bust' : bj ? ' bj' : ''}">${bj ? 'Blackjack' : totalLabel(h.cards)}</span>
    <span class="chip-mini" style="--pc:${pc(i)}">${short(h.bet)}</span>
    ${h.doubled ? '<span class="badge">×2</span>' : ''}
    ${h.outcome ? `<span class="status ${h.outcome}">${STATUS[h.outcome]}${h.net ? ' ' + (h.net > 0 ? '+' : '') + fmt(h.net) : ''}</span>` : ''}`;
  d.append(cards, meta);
  return d;
}

const canDouble = h => BlackjackRules.canDouble(h, S.players[S.turn.p].bal);
// Why Double / Split can't be used right now (shown under the buttons)
function moveHint(h) {
  if (!h) return '';
  const bal = S.players[S.turn.p].bal, notes = [];
  if (!canDouble(h)) notes.push(h.cards.length !== 2 ? 'Double: only on your first two cards' : h.split && h.cards[0].r === 'A' ? 'Double: not on split Aces' : bal < h.bet ? `Double: needs ${fmt(h.bet)} more chips` : '');
  if (!canSplit(h)) notes.push(h.cards.length !== 2 ? 'Split: only on your first two cards' : h.split || S.hands[S.turn.p].length > 1 ? 'Split: once per hand' : cardVal(h.cards[0]) !== cardVal(h.cards[1]) ? 'Split: needs a pair (same value)' : bal < h.bet ? `Split: needs ${fmt(h.bet)} more chips` : '');
  return notes.filter(Boolean).join(' · ');
}
const canSplit = h => BlackjackRules.canSplit(h, S.hands[S.turn.p].length, S.players[S.turn.p].bal);

function renderControls() {
  const betting = S.phase === 'bet';
  $('#betControls').hidden = !betting;
  $('#playControls').hidden = betting;
  const p = S.players[S.active];
  document.querySelectorAll('.chip').forEach(b => { b.disabled = !betting || !p || p.bal <= 0; });
  const hasBet = betting && p && betTotal(S.active) > 0;
  $('#undoBtn').disabled = !hasBet;
  $('#clearBtn').disabled = !hasBet;
  $('#rebetBtn').disabled = !betting || !p || !S.lastBets[S.active]?.length;
  const mb = $('#mainBtn');
  mb.disabled = !betting;
  mb.hidden = sharing() && casinoMode();                  // shared: the cards are dealt when the window closes
  const last = S.turnIdx >= S.order.length - 1;
  mb.textContent = casinoMode() ? 'No more bets → deal' : last ? 'Deal the cards' : `Done → pass to ${S.players[S.order[S.turnIdx + 1]].name}`;

  const h = curHand();
  const myTurn = S.phase === 'play' && !S.busy && h && !h.done && !lockedToPhone(S.turn.p);
  $('#hitBtn').disabled = !myTurn;
  $('#standBtn').disabled = !myTurn;
  $('#doubleBtn').disabled = !myTurn || !canDouble(h);
  $('#splitBtn').disabled = !myTurn || !canSplit(h);
  $('#actHint').textContent = myTurn ? moveHint(h) : '';

  const turn = $('#turn');
  if (betting) {
    if (!p) { turn.textContent = sharing() ? 'Bets open · phones are betting' : 'Table open · waiting for players'; return; }
    turn.style.setProperty('--pc', pc(S.active));
    turn.innerHTML = casinoMode()
      ? `<span>Betting as <b class="nm"></b> · ${sharing() ? 'cards are dealt when the window closes' : 'tap a name above to switch player'}</span>`
      : '<span><b class="nm"></b>, place your bet</span>';
    turn.querySelector('.nm').textContent = p.name;
  } else if (S.phase === 'play' && h) {
    const multi = S.hands[S.turn.p].length > 1;
    turn.style.setProperty('--pc', pc(S.turn.p));
    turn.innerHTML = `<span><b class="nm"></b>${multi ? ` · hand ${S.turn.h + 1}` : ''}: ${totalLabel(h.cards)}. ${lockedToPhone(S.turn.p) ? 'Playing on their phone…' : 'Hit or stand?'}</span>`;
    turn.querySelector('.nm').textContent = S.players[S.turn.p].name;
  } else {
    turn.textContent = S.phase === 'deal' ? 'Dealing…' : S.phase === 'dealer' ? "Dealer's turn…" : 'Round over';
  }
}

/* ---------- Betting ---------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.textContent = '', 2400);
}
// Betting actions act for a player (this screen's selected player by default, or a phone's player).
// They return an error message when not allowed; taps on this screen show it as a toast.
function addChip(v, who = S?.active, quiet = false) {
  const fail = m => { if (!quiet) toast(m); return m; };
  if (!S || S.phase !== 'bet' || paused) return fail('Betting is closed.');
  if (who == null) return fail(sharing() ? 'Players on phones bet from their phones. Add a player here to bet from this screen.' : 'No one is at the table yet. Tap "+ Add player" to join.');
  const p = S.players[who];
  if (!p || !inGame(p)) return fail('That player is no longer at the table.');
  if (!quiet && lockedToPhone(who)) return fail(`${p.name} bets from their own phone.`);
  if (!casinoMode() && who !== S.active) return fail(`It's ${S.players[S.active].name}'s turn to bet.`);
  const amt = Math.min(v, p.bal);
  if (amt <= 0) return fail(`${p.name} has no chips left.`);
  p.bal -= amt;
  S.betStacks[who].push(amt);
  render();
}
function undoChip(who = S.active) {
  const st = S.betStacks[who];
  if (st?.length) S.players[who].bal += st.pop();
  render();
}
function clearBet(who = S.active) {
  const st = S.betStacks[who];
  if (!st) return;
  S.players[who].bal += sum(st);
  st.length = 0;
  render();
}
function rebet(who = S.active, quiet = false) {
  const fail = m => { if (!quiet) toast(m); return m; };
  if (who == null) return;
  const prev = S.lastBets[who];
  if (!prev?.length) return fail('No bet from last round to repeat.');
  const p = S.players[who];
  if (sum(prev) > p.bal + betTotal(who)) return fail(`Not enough chips to rebet (${fmt(sum(prev))} needed).`);
  clearBet(who);
  prev.forEach(v => { p.bal -= v; S.betStacks[who].push(v); });
  render();
}
// Bets under the minimum are handed back when the betting closes
function refundSmallBets() {
  S.players.forEach((p, i) => { const b = betTotal(i); if (b > 0 && b < MIN_BET && p.bal > 0) clearBet(i); });
}
function mainAction() {
  if (!S || S.phase !== 'bet' || paused) return;
  if (casinoMode()) {
    if (sharing()) return;                           // shared table: only the betting-window timer deals
    refundSmallBets();
    return run(deal);
  }
  const amt = betTotal(S.active);
  if (amt > 0 && amt < MIN_BET && S.players[S.active].bal > 0) return toast(`Minimum bet is ${fmt(MIN_BET)}.`);
  if (S.turnIdx < S.order.length - 1) {
    S.turnIdx++;
    S.active = S.focus = S.order[S.turnIdx];
    render();
    say(`Thank you. ${S.players[S.active].name}, place your bet.`, 'welcome');
    startTurnTimer();
  } else run(deal);
}

// Drag a chip from the rack onto the seat to add it to your bet.
function enableChipDrag(btn, v, color) {
  btn.addEventListener('pointerdown', e => {
    if (btn.disabled || e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null, over = null;
    btn.setPointerCapture(e.pointerId);
    const seatAt = (x, y) => document.elementFromPoint(x, y)?.closest('#seat') || null;
    const move = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost'; ghost.style.setProperty('--cc', color); ghost.textContent = v;
        document.body.appendChild(ghost);
        document.body.classList.add('dragging');
      }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      const s = seatAt(ev.clientX, ev.clientY);
      if (s !== over) { over?.classList.remove('drop-target'); over = s; over?.classList.add('drop-target'); }
    };
    const end = ev => {
      btn.removeEventListener('pointermove', move);
      btn.removeEventListener('pointerup', end);
      btn.removeEventListener('pointercancel', end);
      if (!ghost) return;
      btn.dataset.dragged = Date.now();
      ghost.remove();
      document.body.classList.remove('dragging');
      over?.classList.remove('drop-target');
      if (over && ev.type === 'pointerup') addChip(v);
    };
    btn.addEventListener('pointermove', move);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
  });
}

// Drag your bet off the circle (outside the seat) to take it back.
function enablePullBack(ring, i) {
  ring.addEventListener('pointerdown', e => {
    if (!S || S.phase !== 'bet' || S.active !== i || e.button !== 0) return;
    const total = betTotal(i);
    const sx = e.clientX, sy = e.clientY;
    let ghost = null;
    ring.setPointerCapture(e.pointerId);
    const inSeat = (x, y) => !!document.elementFromPoint(x, y)?.closest('#seat');
    const move = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.style.setProperty('--cc', pc(i));
        ghost.textContent = short(total);
        document.body.appendChild(ghost);
        document.body.classList.add('dragging');
        ring.classList.add('drag-source');
      }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      ghost.classList.toggle('removing', !inSeat(ev.clientX, ev.clientY));
    };
    const end = ev => {
      ring.removeEventListener('pointermove', move);
      ring.removeEventListener('pointerup', end);
      ring.removeEventListener('pointercancel', end);
      if (!ghost) return;
      ghost.remove();
      document.body.classList.remove('dragging');
      ring.classList.remove('drag-source');
      if (ev.type !== 'pointerup' || !S || S.phase !== 'bet') return;
      if (!inSeat(ev.clientX, ev.clientY)) {
        clearBet(i);
        toast(`${S.players[i].name} pulled ${fmt(total)} back.`);
      }
    };
    ring.addEventListener('pointermove', move);
    ring.addEventListener('pointerup', end);
    ring.addEventListener('pointercancel', end);
  });
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
// Time per turn from the setup form: a preset, or a custom number of seconds (5–600)
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

/* ---------- Game flow ---------- */
// Run an async game sequence; exiting the game aborts it quietly.
function run(fn) { fn().catch(e => { if (e !== ABORT) console.error(e); }); }
async function step(g, promise) {
  const v = await promise;
  if (S !== g) throw ABORT;
  return v;
}
function newHand(bet) { return { cards: [], bet, done: false, doubled: false, split: false, outcome: null, net: 0, swept: false }; }

const inGame = p => p.bal >= 1 && !p.cashedOut;
const alive = () => S.players.map((_, i) => i).filter(i => inGame(S.players[i]));
// Everyone still in, starting from this round's first player
function tableOrder() {
  const a = alive(), k = a.indexOf(S.starter);
  return k < 0 ? a : [...a.slice(k), ...a.slice(0, k)];
}
function nextStarter() {
  const n = S.players.length;
  for (let d = 1; d <= n; d++) { const i = (S.starter + d) % n; if (inGame(S.players[i])) return i; }
  return S.starter;
}
const empties = () => S.players.map(() => []);

// open = start an empty Casino-style table that players join later
function newGame(open = false) {
  const n = open ? 0 : +$('#numPlayers').value;
  const names = [...Array(n)].map((_, i) => ($('#n' + i)?.value || '').trim() || 'Player ' + (i + 1));
  const bal = +$('#startBal').value, decks = +$('#decks').value;
  const rounds = open || $('#untilBust').checked ? 0 : Math.max(1, Math.min(999, Math.round(+$('#rounds').value) || 5));
  S = {
    mode: open ? 'casino' : $('#tableMode').value, openTable: open, startBal: bal,
    players: names.map((name, i) => ({ name, bal, start: bal, results: [], color: PCOLORS[i], owner: null })),
    round: 1, maxRounds: rounds, timeLimit: readTimeLimit() || (open ? 30 : 0), decks,
    shoe: newShoe(decks), cutAt: Math.floor(decks * 52 * .25),
    starter: 0, order: [], turnIdx: 0, active: null, focus: null, phase: 'bet', busy: false, turn: null,
    betStacks: names.map(() => []), lastBets: names.map(() => []), hands: names.map(() => []), dealer: { cards: [] },
    history: [], deadline: 0, warned: false,
  };
  S.order = tableOrder();
  S.active = S.focus = S.order[0] ?? null;
  cardEls.clear();
  $('#setup').hidden = true; $('#endModal').hidden = true;
  render();
  say(open ? 'The blackjack table is open! Join any time and place your bets please.'
    : casinoMode() ? 'Welcome to the blackjack table! Place your bets please.'
    : `Welcome to the blackjack table! Place your bets please. ${S.players[S.active].name}, you're first.`, 'welcome');
  startTurnTimer();
  updateMasterBtns();
  autoShare();
}

async function dealTo(target, owner, down = false) {
  const c = drawCard();
  c.down = down;
  target.cards.push(c);
  render();
  const [sx, sy] = center($('#shoeTop'));
  const el = cardEl(c);          // created even when that player's seat isn't on screen
  if (el.isConnected) {
    const r = el.getBoundingClientRect();
    const dx = sx - (r.left + r.width / 2), dy = sy - (r.top + r.height / 2);
    await el.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(-25deg) scale(.75)`, opacity: .7 },
      { transform: 'none', opacity: 1 },
    ], { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished;
  } else {
    // Player isn't on screen: a face-down card slides to their name in the strip
    const ghost = document.createElement('div');
    ghost.className = 'card down fly-card';
    ghost.innerHTML = '<div class="card-inner"><div class="face"></div><div class="back"></div></div>';
    ghost.style.left = sx + 'px'; ghost.style.top = sy + 'px';
    document.body.appendChild(ghost);
    const [tx, ty] = center(anchorFor(owner));
    await ghost.animate([
      { transform: 'translate(-50%, -50%) rotate(-25deg) scale(.6)', opacity: .9 },
      { transform: `translate(calc(-50% + ${tx - sx}px), calc(-50% + ${ty - sy}px)) scale(.35)`, opacity: .2 },
    ], { duration: 380, easing: 'ease-in', fill: 'forwards' }).finished;
    ghost.remove();
  }
  return c;
}
async function reveal() {
  const hole = S.dealer.cards.find(c => c.down);
  if (!hole) return;
  hole.down = false;
  render();
  await pwait(600);
}

async function deal() {
  const g = S;
  stopTurnTimer();
  const seats = S.order.filter(i => betTotal(i) > 0);
  S.lastBets = S.betStacks.map(s => [...s]);
  if (!seats.length) {
    S.phase = 'deal'; render();
    if (alive().length) await step(g, say('No bets this round.'));
    else await step(g, pwait(600));
    return nextRound();
  }
  S.hands = S.players.map((_, i) => betTotal(i) ? [newHand(betTotal(i))] : []);
  S.betStacks = empties();
  S.phase = 'deal';
  S.focus = seats[0];
  render();
  if (S.shoe.length < S.cutAt) {
    say('Shuffling a fresh shoe.', 'sweep');
    $('#shoe').classList.add('shuffling');
    await step(g, pwait(1400));
    $('#shoe').classList.remove('shuffling');
    S.shoe = newShoe(S.decks);
    render();
  }
  say('Bets are closed. Good luck!', 'wave');
  for (let round = 0; round < 2; round++) {
    for (const i of seats) await step(g, dealTo(S.hands[i][0], i));
    await step(g, dealTo(S.dealer, -1, round === 1));
  }

  // Dealer peeks for blackjack when showing an Ace or a 10
  if (BlackjackRules.dealerChecksForBlackjack(S.dealer.cards[0])) {
    await step(g, say('Dealer checks for blackjack…', 'point'));
    await step(g, pwait(500));
    if (dealerBJ()) {
      await step(g, reveal());
      await step(g, say('Dealer has blackjack!', 'point'));
      return settle(g);
    }
    await step(g, say('No blackjack. Play on.'));
  }
  for (const i of seats) {
    if (isBlackjack(S.hands[i][0])) {
      S.hands[i][0].done = true;
      S.focus = i;
      render();
      await step(g, say(`Blackjack for ${S.players[i].name}!`, 'pay'));
    }
  }
  S.phase = 'play';
  nextTurn(g);
}

function nextTurn(g) {
  for (const i of S.order) {
    for (let k = 0; k < S.hands[i].length; k++) {
      if (!S.hands[i][k].done) {
        S.turn = { p: i, h: k };
        S.focus = i;
        render();
        const multi = S.hands[i].length > 1;
        say(`${S.players[i].name}${multi ? `, hand ${k + 1}` : ''}. You have ${spokenTotal(S.hands[i][k].cards)}.`, 'point');
        if (lockedToPhone(i)) send({ type: 'turn', player: i, hand: k }, S.players[i].owner);   // nudge that phone
        startTurnTimer();
        return;
      }
    }
  }
  S.turn = null;
  run(() => dealerPlay(g));
}

// fromPhone = the hand's own phone asked for this; this screen can't act for a phone's player
async function act(kind, fromPhone = false) {
  if (!S || S.phase !== 'play' || S.busy || paused || !S.turn) return;
  const g = S, { p: i, h: k } = S.turn, h = S.hands[i][k], P = S.players[i];
  if (lockedToPhone(i) && !fromPhone && !timeUp) return toast(`${P.name} plays from their own phone.`);
  if (kind === 'double' && !canDouble(h)) return;
  if (kind === 'split' && !canSplit(h)) return;
  S.busy = true;
  stopTurnTimer();
  render();
  try {
    if (kind === 'hit') {
      await step(g, dealTo(h, i));
    } else if (kind === 'stand') {
      h.done = true;
      await step(g, say(`${P.name} stands on ${handTotal(h.cards).t}.`));
    } else if (kind === 'double') {
      P.bal -= h.bet; h.bet *= 2; h.doubled = true;
      render();
      say(`${P.name} doubles down.`, 'point');
      await step(g, dealTo(h, i));
      h.done = true;
    } else if (kind === 'split') {
      P.bal -= h.bet;
      const h2 = newHand(h.bet);
      h2.split = h.split = true;
      h2.cards.push(h.cards.pop());
      S.hands[i].splice(k + 1, 0, h2);
      render();
      say(`${P.name} splits.`, 'point');
      await step(g, dealTo(h, i));
      await step(g, dealTo(h2, i));
      if (BlackjackRules.isSplitAces(h)) h.done = h2.done = true;     // split Aces: one card each
      for (const x of [h, h2]) if (handTotal(x.cards).t === 21) x.done = true;
    }
    const t = handTotal(h.cards).t;
    if (t > 21) {
      h.done = true; h.outcome = 'bust'; h.net = -h.bet;
      render();
      await step(g, say(`${t}. ${P.name} busts.`, 'shake'));
      await step(g, sweep([[h, i]]));
    } else if (t === 21) h.done = true;
  } finally {
    if (S === g) S.busy = false;
  }
  if (h.done) nextTurn(g);
  else { render(); startTurnTimer(); }
}

async function dealerPlay(g) {
  S.phase = 'dealer';
  render();
  await step(g, reveal());
  const live = allHands().filter(([h]) => !h.outcome && !isBlackjack(h));
  let t = handTotal(S.dealer.cards).t;
  await step(g, say(`Dealer has ${t}.`, 'point'));
  if (live.length) {
    while (BlackjackRules.dealerHits(t)) {
      await step(g, pwait(350));
      await step(g, dealTo(S.dealer, -1));
      t = handTotal(S.dealer.cards).t;
    }
    if (t > 21) await step(g, say(`Dealer busts with ${t}!`, 'shake'));
    else if (S.dealer.cards.length > 2) await step(g, say(`Dealer stands on ${t}.`));
  }
  await settle(g);
}

const allHands = () => S.players.flatMap((_, i) => S.hands[i].map(h => [h, i]));

// Chips from the given hands fly to the dealer.
async function sweep(list) {
  if (!list.length) return;
  setPose('sweep');
  const target = $('#dealerHandL');
  await Promise.all(list.map(([h, i], n) => {
    const from = i === S.focus ? (seatEl.querySelectorAll('.hand')[S.hands[i].indexOf(h)] || seatEl) : anchorFor(i);
    return fly(from, target, pc(i), short(h.bet), n * 90);
  }));
  list.forEach(([h]) => { h.swept = true; });
  render();
}

async function settle(g) {
  S.phase = 'result';
  S.turn = null;
  stopTurnTimer();
  const d = handTotal(S.dealer.cards, true).t, dBJ = dealerBJ();
  for (const [h] of allHands()) Object.assign(h, BlackjackRules.result(h, S.dealer.cards));
  S.history.unshift(dBJ ? 'BJ' : d > 21 ? 'Bust' : String(d));

  const summary = S.players.map((_, i) => ({
    hands: S.hands[i].map(h => ({ total: handTotal(h.cards, true).t, bj: isBlackjack(h), bet: h.bet, outcome: h.outcome, net: h.net, doubled: h.doubled })),
    staked: sum(S.hands[i].map(h => h.bet)),
    returned: sum(S.hands[i].map(BlackjackRules.returned)),
  }));

  // One player at a time: show their seat, take losing chips, pay winnings
  S.players.forEach((P, i) => { if (summary[i].staked) P.results.push({ round: S.round, net: summary[i].returned - summary[i].staked }); });
  send({ type: 'result', dealer: dBJ ? 'Blackjack' : d > 21 ? `Bust (${d})` : String(d),
    nets: Object.fromEntries(summary.map((x, i) => [i, x.staked ? x.returned - x.staked : null]).filter(([, v]) => v !== null)) });
  for (const i of S.order) {
    const s = summary[i], P = S.players[i], net = s.returned - s.staked;
    if (!s.staked) continue;
    S.focus = i;
    render();
    await step(g, pwait(250));
    await step(g, sweep(S.hands[i].filter(h => h.outcome === 'lose' && !h.swept).map(h => [h, i])));
    if (s.returned) {
      const bj = s.hands.some(h => h.outcome === 'bj');
      const msg = net > 0 ? `${bj ? 'Blackjack! ' : ''}${P.name} wins ${fmt(net)}!`
        : net === 0 ? `${P.name} pushes. ${fmt(s.returned)} back to you.`
        : `${P.name} gets ${fmt(s.returned)} back, but is down ${fmt(-net)}.`;
      const talk = say(msg, 'pay');
      const chips = Math.min(8, 3 + Math.floor(s.returned / 100));
      await step(g, Promise.all([...Array(chips)].map((_, n) =>
        fly($('#dealerHand'), seatEl, pc(i), n === chips - 1 ? short(s.returned) : '', 300 + n * 90))));
      P.bal += s.returned;
      render();
      seatEl.classList.remove('paid'); void seatEl.offsetWidth; seatEl.classList.add('paid');
      await step(g, talk);
    } else {
      await step(g, say(`${P.name} loses ${fmt(s.staked)}. Better luck next time.`, 'shake'));
    }
  }
  setPose('');
  await step(g, pwait(300));
  showRoundModal(summary, d, dBJ);
}

// Ends when nobody is left, rounds run out, or one player remains after the others went bust.
// If others cashed out instead, the last player can keep playing until they cash out too.
const isOver = () => S.openTable ? false : alive().length === 0 || (S.maxRounds && S.round >= S.maxRounds)
  || (alive().length === 1 && S.players.length > 1 && !S.players.some(p => p.cashedOut));

function showRoundModal(summary, d, dBJ) {
  $('#rmTitle').textContent = `Round ${S.round} result`;
  $('#rmDealer').innerHTML = `Dealer: <b>${dBJ ? 'Blackjack' : d > 21 ? `Bust (${d})` : d}</b>`;
  const rows = $('#rmRows'); rows.innerHTML = '';
  S.players.forEach((p, i) => {
    const s = summary[i], net = s.returned - s.staked;
    if (p.cashedOut && !s.staked) return;
    const row = document.createElement('div');
    row.className = 'sum-row'; row.style.setProperty('--pc', pc(i));
    row.innerHTML = `<div class="sum-top"><div class="who"><span class="dot"></span><span class="nm"></span></div>
      <span class="${net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'}">${s.staked ? (net > 0 ? '+' : '') + fmt(net) : p.bal < 1 ? 'out' : 'sat out'}</span></div>
      <ul class="sum-hands">${s.hands.map((h, k) => `<li>${s.hands.length > 1 ? `Hand ${k + 1} · ` : ''}${h.bj ? 'Blackjack' : h.total}
        · bet ${fmt(h.bet)}${h.doubled ? ' (doubled)' : ''} → ${STATUS[h.outcome]}${h.net ? ' ' + (h.net > 0 ? '+' : '') + fmt(h.net) : ''}</li>`).join('')}</ul>`;
    row.querySelector('.nm').textContent = p.name;
    rows.appendChild(row);
  });
  $('#rmBtn').textContent = isOver() ? 'See final results' : 'Next round';
  $('#roundModal').hidden = false;
  startAutoNext();
}

// Casino style (or any table with a time limit): the next round starts by itself after a short countdown
const AUTO_NEXT_SECONDS = 5;
let autoNextId = null;
function startAutoNext() {
  stopAutoNext();
  if ((!casinoMode() && !S.timeLimit) || isOver()) return;
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
  S.starter = nextStarter();
  S.order = tableOrder();
  S.turnIdx = 0;
  S.active = S.focus = S.order[0] ?? null;
  S.phase = 'bet';
  S.hands = empties();
  S.dealer = { cards: [] };
  S.betStacks = empties();
  cardEls.clear();
  render();
  seatPending();
  say(casinoMode() ? 'Place your bets please.' : `Place your bets please. ${S.players[S.active].name} goes first.`, 'welcome');
  startTurnTimer();
}

function showEnd() {
  stopTurnTimer();
  S.players.forEach(p => Leaderboard.record('blackjack', p));
  const ranked = S.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.bal - a.p.bal);
  const top = ranked[0].p.bal;
  const winners = ranked.filter(x => x.p.bal === top);
  const title = winners.length > 1 ? `It's a tie: ${winners.map(x => x.p.name).join(' & ')}!` : `${winners[0].p.name} wins!`;
  const rounds = `${S.round} round${S.round === 1 ? '' : 's'}`;
  const sub = S.maxRounds && S.round >= S.maxRounds ? `After ${rounds}.`
    : alive().length === 0 ? `Everyone cashed out after ${rounds}.`
    : `Last player standing after ${rounds}.`;
  $('#endTitle').textContent = title;
  $('#endSub').textContent = sub;
  $('#endRows').innerHTML = '';
  ranked.forEach(({ p, i }, rank) => {
    const net = p.bal - p.start;
    const row = document.createElement('div');
    row.className = 'sum-row'; row.style.setProperty('--pc', pc(i));
    row.innerHTML = `<div class="sum-top"><div class="who">${rank + 1}. <span class="dot"></span><span class="nm"></span>${p.cashedOut ? ' <span class="zero">(cashed out)</span>' : p.bal < 1 ? ' <span class="zero">(out)</span>' : ''}</div>
      <div>${fmt(p.bal)} <span class="${net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'}">(${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))})</span></div></div>`;
    row.querySelector('.nm').textContent = p.name;
    $('#endRows').appendChild(row);
  });
  $('#endModal').hidden = false;
  say(winners.length > 1 ? "It's a tie! Well played, everyone." : `${title} Congratulations!`, 'wave');
}

/* ---------- Cash out ---------- */
// During betting, a player can leave with their balance locked in; any chips in their bet circle come back first.
let cashFor = null;
function openCashOut(i) {
  if (!S || S.phase !== 'bet') return;
  const p = S.players[i], total = p.bal + betTotal(i), net = total - p.start;
  cashFor = i;
  pauseGame();
  $('#pauseModal').hidden = true;
  $('#cashText').textContent = `${p.name} leaves the table with ${fmt(total)} (${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))} overall)` +
    (betTotal(i) ? `, including the ${fmt(betTotal(i))} bet that hasn't been dealt yet.` : '.') + " They can't rejoin this game.";
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
  p.bal += betTotal(i);
  S.betStacks[i] = [];
  S.lastBets[i] = [];
  p.cashedOut = true;
  Leaderboard.record('blackjack', p);                  // on the leaderboard with what they leave with
  const idx = S.order.indexOf(i);
  S.order.splice(idx, 1);
  toast(`${p.name} cashed out with ${fmt(p.bal)}.`);
  say(`${p.name} cashes out with ${fmt(p.bal)}. Thank you for playing!`, 'pay');
  if (!S.order.length) {
    if (!S.openTable) { stopTurnTimer(); return showEnd(); }
    S.active = S.focus = null;                               // an open table keeps running with nobody at it
    return render();
  }
  if (casinoMode()) {                                         // everyone bets at once: just pick another local player
    if (S.active === i) S.active = S.focus = alive().find(k => !lockedToPhone(k)) ?? null;
    return render();
  }
  if (idx < S.turnIdx) S.turnIdx--;                         // someone who already bet left
  else if (idx === S.turnIdx && S.turnIdx >= S.order.length) {
    S.turnIdx = S.order.length - 1;                          // the last bettor left: everyone else is done, deal
    S.active = S.focus = S.order[S.turnIdx];
    return run(deal);
  }
  S.active = S.focus = S.order[S.turnIdx];
  render();
  if (idx === S.turnIdx) startTurnTimer();                  // next player's betting turn starts fresh
}

/* ---------- Add a player mid-game ---------- */
function openAddPlayer() {
  if (!S || S.phase !== 'bet' || alive().length >= PCOLORS.length) return;
  pauseGame();                      // hold the timer while the name is typed
  $('#pauseModal').hidden = true;
  $('#newName').value = `Player ${S.players.length + 1}`;
  $('#addNote').textContent = `Joins with ${fmt(S.startBal)} in chips` + (casinoMode() ? ' and can bet right away.' : ' and bets last this round.');
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
// Seats a new player (owner = the phone that controls them, or null for this screen). Returns their index.
function addPlayer(name, owner = null) {
  const i = S.players.length;
  const everUsed = new Set(S.players.map(q => q.color)), seated = new Set(alive().map(k => S.players[k].color));
  const color = PCOLORS.find(c => !everUsed.has(c)) || PCOLORS.find(c => !seated.has(c));
  S.players.push({ name, bal: S.startBal, start: S.startBal, results: [], color, owner });
  S.betStacks.push([]); S.lastBets.push([]); S.hands.push([]);
  S.order.push(i);
  if (S.active == null && !owner) S.active = S.focus = i;
  render();
  say(`Welcome to the table, ${name}!`, 'welcome');
  return i;
}

/* ---------- Turn timer ---------- */
let timerId = null, timeUp = false;
function startTurnTimer() {
  stopTurnTimer();
  S.warned = false;
  if (!S.timeLimit) return renderTimer();
  S.deadline = Date.now() + S.timeLimit * 1000;
  timerId = setInterval(tickTimer, 250);
  tickTimer();
}
function stopTurnTimer() {
  clearInterval(timerId); timerId = null;
  if (S) renderTimer();
}
function tickTimer() {
  if (paused) return;
  if (!S || (S.phase !== 'bet' && S.phase !== 'play')) return stopTurnTimer();
  const left = Math.max(0, S.deadline - Date.now());
  renderTimer(left);
  if (!S.warned && left <= 10000 && S.timeLimit > 15) { S.warned = true; say('Ten seconds left!'); }
  if (left > 0) return;
  stopTurnTimer();
  if (S.phase === 'bet') {
    if (casinoMode()) { refundSmallBets(); return run(deal); }    // the betting window closes for everyone
    toast(`Time's up for ${S.players[S.active].name}!`);
    if (betTotal(S.active) > 0 && betTotal(S.active) < MIN_BET) clearBet();
    mainAction();
  } else if (!S.busy) {
    toast(`Time's up! ${S.players[S.turn.p].name} stands.`);
    timeUp = true;
    run(async () => { try { await act('stand'); } finally { timeUp = false; } });
  }
}
function renderTimer(left) {
  const t = $('#timer');
  t.hidden = !(S && S.timeLimit && timerId && (S.phase === 'bet' || S.phase === 'play'));
  if (t.hidden) return;
  const sec = Math.ceil(left / 1000);
  $('#tText').textContent = (S.phase === 'bet' && casinoMode() ? 'Bets close in ' : '') + `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('#tBar').style.width = (left / (S.timeLimit * 1000) * 100) + '%';
  t.classList.toggle('low', left <= 10000);
}

/* ---------- Master table: guests join from their own phones ---------- */
// The Blackjack table on the host computer is the master table. While a Casino-style game runs here it is
// shared automatically: phones on the Wi-Fi join with their own players, bet, and play their own hands.
const NET = { master: false, tts: false, code: null, hostKey: null, es: null, online: new Set(), pending: [], syncTimer: null, addresses: [], port: location.port };
const sharing = () => !!NET.code;
// While shared, a phone's players belong to that phone only
const lockedToPhone = i => sharing() && !!S?.players[i]?.owner;
// Keep this screen's betting selection on one of its own players
function keepLocalActive() {
  if (!S || S.phase !== 'bet' || S.active == null || !lockedToPhone(S.active)) return;
  S.active = S.focus = alive().find(i => !lockedToPhone(i)) ?? null;
}
async function startSharing(takeover = false) {
  if (!S || !NET.master || !casinoMode()) return;
  try {
    const r = await fetch('/api/host', { method: 'POST', body: JSON.stringify({ game: 'blackjack', code: NET.code, hostKey: NET.hostKey, takeover }) });
    if (r.status === 409) {                          // only one shared table: another screen has it
      const { code } = await r.json();
      $('#takeoverText').textContent = `Another screen is already sharing table ${code}. Take it over? That table closes and its phones move to this one.`;
      $('#takeoverModal').hidden = false;
      return;
    }
    if (!r.ok) throw 0;
    const info = await r.json();
    Object.assign(NET, { code: info.code, hostKey: info.hostKey, addresses: info.addresses, port: info.port });
  } catch { return; }                                // no Game Night server: a one-device table
  if (!S.timeLimit) {                                // with guests, cards are dealt when the betting window closes
    S.timeLimit = 30;
    if (S.phase === 'bet' || S.phase === 'play') startTurnTimer();
  }
  NET.es?.close();
  NET.es = new EventSource(`/api/stream?t=${NET.code}&role=host&key=${NET.hostKey}`);
  NET.es.onmessage = e => { try { handleRemote(JSON.parse(e.data)); } catch {} };
  NET.es.onerror = () => setTimeout(async () => {   // server restarted: open the table again, phones follow
    if (!sharing()) return;
    try {
      const { tables } = await (await fetch('/api/tables')).json();
      if (!tables.some(t => t.code === NET.code)) { NET.es.close(); NET.code = NET.hostKey = null; startSharing(true); }
    } catch {}
  }, 2500);
  render();
  syncNow();
  toast(`Phones on the Wi-Fi can join: ${phoneAddress()}`);
}
const phoneAddress = () => `http://${NET.addresses[0] || location.hostname}:${NET.port || location.port}`;
function autoShare() { if (NET.master && S && casinoMode() && !sharing()) startSharing(); }
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
const cardData = c => c.down ? { down: true } : { r: c.r, s: c.s };     // the hole card stays hidden on phones too
// Everything the phones need to draw the table
function snapshot() {
  const h = curHand();
  return {
    type: 'state', game: 'blackjack', code: NET.code, phase: S.phase, paused, round: S.round, maxRounds: S.maxRounds, mode: S.mode,
    closesIn: (S.phase === 'bet' || S.phase === 'play') && timerId && S.deadline ? Math.max(0, S.deadline - Date.now()) : null,
    windowLen: S.timeLimit || 0, minBet: MIN_BET, seatsFree: PCOLORS.length - alive().length, shoe: S.shoe.length,
    history: S.history.slice(0, 1), busy: !!S.busy,
    players: S.players.map((p, i) => ({
      i, name: p.name, bal: p.bal, start: p.start, color: p.color || pc(i), owner: p.owner || null,
      inGame: inGame(p), cashedOut: !!p.cashedOut, bet: betTotal(i), betStack: S.betStacks[i] || [], canRebet: !!S.lastBets[i]?.length,
      results: (p.results || []).slice(-12), wlTotal: sum((p.results || []).map(r => r.net)), status: pillStatus(i),
      hands: (S.hands[i] || []).map(x => ({ cards: x.cards.map(cardData), bet: x.bet, doubled: x.doubled, outcome: x.outcome, net: x.net,
        label: isBlackjack(x) ? 'Blackjack' : totalLabel(x.cards), total: handTotal(x.cards).t, done: x.done })),
    })),
    dealer: { cards: S.dealer.cards.map(cardData), label: !S.dealer.cards.length ? '' : S.dealer.cards.some(c => c.down)
      ? `${totalLabel(S.dealer.cards)} + ?` : dealerBJ() ? 'Blackjack' : totalLabel(S.dealer.cards) },
    turn: S.phase === 'play' && S.turn && h ? { p: S.turn.p, h: S.turn.h, canDouble: !!canDouble(h), canSplit: !!canSplit(h), hint: moveHint(h) } : null,
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
  if (m.type === 'hello') {                         // a phone just connected: catch it up and greet it personally
    send(snapshot(), m.device);
    return send({ type: 'say', pose: 'welcome', text: S.phase === 'bet'
      ? 'Welcome to the blackjack table! Bets are open, place your bets please.'
      : 'Welcome to the blackjack table! A hand is being played; you can bet in the next round.' }, m.device);
  }
  if (m.type === 'join') {
    const name = String(m.name || '').trim().slice(0, 16) || `Player ${S.players.length + 1}`;
    if (alive().length + NET.pending.length >= PCOLORS.length) return refuse('The table is full (6 players).');
    if (S.phase !== 'bet' || paused) { NET.pending.push({ name, device: m.device }); return reply({ type: 'queued', name }); }
    return reply({ type: 'joined', player: addPlayer(name, m.device), name });
  }
  const who = +m.player;
  if (!ownedBy(who, m.device)) return refuse('That player is not on this phone.');
  if (paused) return refuse('The table is paused.');
  if (m.type === 'act') {
    if (S.phase !== 'play' || !S.turn || S.turn.p !== who) return refuse("It isn't this player's turn.");
    if (!['hit', 'stand', 'double', 'split'].includes(m.kind)) return;
    return run(() => act(m.kind, true));
  }
  if (S.phase !== 'bet') return refuse('Bets are closed until the next round.');
  let err;
  switch (m.type) {
    case 'bet': err = addChip(Math.max(1, +m.amt || 0), who, true); break;
    case 'undo': undoChip(who); break;
    case 'clear': clearBet(who); break;
    case 'rebet': err = rebet(who, true); break;
    case 'cashout': err = doCashOut(who); break;
  }
  if (err) refuse(err);
}
// Phones that asked to join mid-round take their seats when bets open again
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
  b.textContent = `📱 Join · ${NET.online.size} phone${NET.online.size === 1 ? '' : 's'}`;
  b.classList.toggle('on', sharing());
}
function renderShare() {
  if (!sharing()) return;
  $('#shareUrls').innerHTML = (NET.addresses.length ? NET.addresses : [location.hostname]).map(ip => `<code>http://${ip}:${NET.port}</code>`).join('');
  const byDevice = {};
  S?.players.forEach(p => { if (p.owner && !p.cashedOut) (byDevice[p.owner] ||= []).push(p.name); });
  const devices = Object.entries(byDevice);
  $('#sharePhones').innerHTML = devices.length
    ? devices.map(([d, names], k) => `<li><span class="${NET.online.has(d) ? 'on' : 'off'}">●</span> Phone ${k + 1}: ${names.map(n => n.replace(/[<>&]/g, '')).join(', ')}${NET.online.has(d) ? '' : ' <small>(disconnected)</small>'}</li>`).join('')
    : '<li class="muted">No phones yet. Players on phones appear here as they join.</li>';
}
$('#shareBtn').addEventListener('click', () => { renderShare(); $('#shareQr').src = '/api/qr.svg'; $('#shareModal').hidden = false; });
$('#shareClose').addEventListener('click', () => { $('#shareModal').hidden = true; });
$('#takeoverNo').addEventListener('click', () => { $('#takeoverModal').hidden = true; });
$('#takeoverYes').addEventListener('click', () => { $('#takeoverModal').hidden = true; startSharing(true); });
// Is this the host computer? Other devices join the master table instead of running their own.
(async () => {
  try {
    const info = await (await fetch('/api/info')).json();
    Object.assign(NET, { master: info.master !== false, tts: !!info.tts, addresses: info.addresses || [], port: info.port });
    if (info.master === false) return location.replace('remote.html');
    autoShare();
  } catch {}                                         // no Game Night server: a one-device table
})();
// New game files → offer a reload (never forced mid-game)
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

/* ---------- Sound: unlocking audio, and saying so when the browser blocks it ---------- */
let audioCtx = null;
function getAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) { audioCtx = new AC(); try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {} }
  if (audioCtx.state !== 'running' && !paused) audioCtx.resume().catch(() => {});
  return audioCtx;
}
function unlockAudio() {
  const ac = getAudio(); if (!ac) return;
  const blip = ac.createBufferSource(); blip.buffer = ac.createBuffer(1, 1, 22050); blip.connect(ac.destination); blip.start(0);
  if (ac.state === 'running') ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(t => document.removeEventListener(t, unlockAudio, true));
}
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, unlockAudio, true));
function soundProblem(kind) {
  if (!voiceOn) return;
  $('#soundBar').hidden = false;
  $('#soundMsg').textContent = kind === 'blocked' ? '🔇 The browser is blocking sound until you click this page.' : "🔇 The dealer's voice isn't playing.";
}
function soundOk() { $('#soundBar').hidden = true; $('#soundTips').hidden = true; }
$('#soundCheck').addEventListener('click', () => {
  getAudio();
  if (canSpeak) { speechSynthesis.cancel(); speechSynthesis.resume(); }
  say('Sound check. Can you hear me?', 'welcome');
  $('#soundTips').hidden = false;
});
$('#soundClose').addEventListener('click', soundOk);

/* ---------- Pause / resume / exit ---------- */
let paused = false, pausedAnims = [], exitTarget = null;
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
  if (S && S.remaining != null) { S.deadline = Date.now() + S.remaining; S.remaining = null; }
  if (canSpeak) speechSynthesis.resume();
  audioCtx?.resume();
  pausedAnims.forEach(a => a.play());
  pausedAnims = [];
  $('#pauseModal').hidden = true;
  updateMasterBtns();
}
function askExit(target) {
  exitTarget = target;
  $('#pmConfirmTitle').textContent = target === 'lobby' ? 'Leave for the lobby?' : 'Exit game?';
  $('#pmConfirmText').textContent = target === 'lobby'
    ? 'This game and all chip balances will be lost.'
    : "This round and all chip balances will be lost. You'll go back to the setup screen.";
  pauseGame(true);
}
function exitGame() {
  stopSharing();
  stopAutoNext();
  $('#cashModal').hidden = true;
  $('#addModal').hidden = true;
  stopTurnTimer();
  paused = false;
  pausedAnims.forEach(a => a.play()); pausedAnims = [];
  if (canSpeak) { speechSynthesis.resume(); speechSynthesis.cancel(); }
  stopVoice();
  document.querySelectorAll('.fly-chip').forEach(c => c.getAnimations().forEach(a => a.finish()));
  if (S) S.players.forEach((p, i) => Leaderboard.record('blackjack', p, S.phase === 'bet' ? betTotal(i) : 0));   // leaving mid-game still counts
  S = null;                     // in-flight sequences see this and stop
  ['#pauseModal', '#roundModal', '#endModal'].forEach(id => $(id).hidden = true);
  setRules(false);
  $('#dealerCards').replaceChildren();
  $('#dealerTotal').hidden = true;
  seatEl.querySelector('.seat-body').replaceChildren(); seatEl.classList.remove('active');
  seatEl.querySelector('.nm').textContent = ''; seatEl.querySelector('.bal').textContent = ''; seatEl.querySelector('.tag').hidden = true;
  $('#order').innerHTML = '';
  $('#timer').hidden = true;
  $('#turn').textContent = '';
  sayToken++; setPose('');
  bubble.textContent = 'Thanks for playing! Come back soon.';
  $('#setup').hidden = false;
  updateMasterBtns();
}
$('#pauseBtn').addEventListener('click', () => paused ? resumeGame() : pauseGame());
$('#quitBtn').addEventListener('click', () => askExit(null));
$('#resumeBtn').addEventListener('click', resumeGame);
$('#exitBtn').addEventListener('click', () => askExit(null));
$('#exitNo').addEventListener('click', () => pauseGame(false));
$('#exitYes').addEventListener('click', () => { exitGame(); if (exitTarget === 'lobby') location.href = 'casino.html'; });
$('#lobbyBtn').addEventListener('click', e => { if (S) { e.preventDefault(); askExit('lobby'); } });

/* ---------- Dealer voice & animation ---------- */
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
  void dealerEl.offsetWidth;
  dealerEl.className = 'dealer' + (pose ? ' ' + pose : '') + (talking ? ' talking' : '');
}
// The dealer's voice comes from this computer's own speech via the server (/api/tts) when it can, played through
// Web Audio; the browser's built-in speech is only a fallback (Chrome's can get stuck on Macs).
const ttsClips = new Map();
let voiceSrc = null;
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
  const spoken = text.replace(/(\d+) \/ (\d+)/g, '$1 or $2');
  return new Promise(res => {
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      if (my === sayToken) dealerEl.classList.remove('talking');
      pwait(150).then(res);
    };
    const est = 700 + text.length * 60;
    if (!voiceOn) return pwait(est).then(finish);
    const browserSpeech = () => {
      if (!canSpeak) return pwait(est).then(finish);
      if (speechSynthesis.paused) speechSynthesis.resume();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(spoken);
      if (voice) u.voice = voice;
      u.rate = 1.02;
      let started = false;
      u.onstart = () => { started = true; soundOk(); };
      u.onend = finish;
      u.onerror = e => { if (e.error === 'not-allowed') soundProblem('blocked'); finish(); };
      speechSynthesis.speak(u);
      setTimeout(() => {
        if (started || done || my !== sayToken || paused) return;
        speechSynthesis.cancel(); speechSynthesis.resume(); speechSynthesis.speak(u);
        setTimeout(() => { if (!started && !done && my === sayToken && !paused) soundProblem('silent'); }, 1500);
      }, 1500);
      pwait(est + 3000).then(finish);
    };
    if (!NET.tts) return browserSpeech();
    (async () => {
      const ac = getAudio();
      if (ac && ac.state !== 'running') { try { await ac.resume(); } catch {} }
      if (!ac || ac.state !== 'running') { soundProblem('blocked'); return pwait(est).then(finish); }
      let clip;
      try { clip = await ttsClip(spoken); } catch { return browserSpeech(); }
      if (done || my !== sayToken) return;
      try { voiceSrc?.stop(); } catch {}
      if (canSpeak) speechSynthesis.cancel();
      const src = ac.createBufferSource();
      src.buffer = clip; src.connect(ac.destination);
      voiceSrc = src;
      src.onended = () => { if (voiceSrc === src) voiceSrc = null; finish(); };
      src.start();
      soundOk();
      pwait(clip.duration * 1000 + 2500).then(finish);
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
  if (!voiceOn) speechSynthesis.cancel();
  try { localStorage.setItem('gn-voice', voiceOn ? 'on' : 'off'); } catch {}
  renderVoiceBtn();
});

/* ---------- Payout table ---------- */
// [outcome, when, pays, profit multiple, returned multiple, how often]
const PAYOUTS = [
  ['Blackjack', 'Ace + 10-value card as your first two cards (and the dealer has no blackjack)', '3:2', 1.5, 2.5, '≈ 4.5%'],
  ['Win', 'Your final total is higher than the dealer\'s', '1:1', 1, 2, '≈ 42% (all wins)'],
  ['Dealer busts', 'Dealer goes over 21 while your hand is still in', '1:1', 1, 2, '≈ 28% of dealer hands'],
  ['Double down win', 'You doubled (bet is now 2×) and won', '1:1 on 2× bet', 2, 4, '—'],
  ['Split hand win', 'Each hand after a split is paid on its own', '1:1 per hand', 1, 2, '—'],
  ['Push', 'Same total as the dealer, or both have blackjack', 'Bet returned', 0, 1, '≈ 8.5%'],
  ['Lose / Bust', 'You go over 21, or the dealer finishes higher', 'Bet lost', -1, 0, '≈ 49%'],
];
function renderPayouts() {
  const stake = +$('#exStake').value;
  $('#payoutRows').innerHTML = PAYOUTS.map(([name, when, pays, profit, ret, often]) => `<tr>
    <td><b>${name}</b></td><td class="sub">${when}</td><td class="num odds">${pays}</td>
    <td class="num ex">${profit > 0 ? '+' : ''}${fmt(stake * profit)}</td><td class="num ex">${fmt(stake * ret)}</td>
    <td class="ex sub">${often}</td></tr>`).join('');
}
$('#exStake').addEventListener('change', renderPayouts);
$('#exToggle').addEventListener('change', e => $('#payouts').classList.toggle('show-ex', e.target.checked));

/* ---------- Rules window ---------- */
function setRules(open) {
  $('#rules').hidden = !open;
  $('#rulesBtn').setAttribute('aria-pressed', open);
  if (open) $('.table-area').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('#rulesBtn').addEventListener('click', () => setRules($('#rules').hidden));
$('#rulesClose').addEventListener('click', () => setRules(false));
document.addEventListener('pointerdown', e => {
  if (!$('#rules').hidden && !e.target.closest('#rules, #rulesBtn')) setRules(false);
});

/* ---------- Wire up ---------- */
Leaderboard.mount('blackjack', $('#payouts'));
Leaderboard.mount('blackjack', $('#setupForm .lobby-exit'), { compact: true });   // top 5 on the setup screen
window.addEventListener('pagehide', () => { if (S) S.players.forEach((p, i) => Leaderboard.record('blackjack', p, S.phase === 'bet' ? betTotal(i) : 0)); });
buildNameFields();
buildChips();
renderVoiceBtn();
renderPayouts();
$('#setupForm').addEventListener('submit', e => { e.preventDefault(); newGame(); });
$('#openTableBtn').addEventListener('click', () => newGame(true));
$('#mainBtn').addEventListener('click', mainAction);
$('#undoBtn').addEventListener('click', () => undoChip());
$('#clearBtn').addEventListener('click', () => clearBet());
$('#rebetBtn').addEventListener('click', () => rebet());
$('#hitBtn').addEventListener('click', () => run(() => act('hit')));
$('#standBtn').addEventListener('click', () => run(() => act('stand')));
$('#doubleBtn').addEventListener('click', () => run(() => act('double')));
$('#splitBtn').addEventListener('click', () => run(() => act('split')));
$('#rmBtn').addEventListener('click', () => nextRound());
$('#againBtn').addEventListener('click', () => newGame());
$('#newBtn').addEventListener('click', exitGame);
document.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'escape' && !$('#rules').hidden) return setRules(false);
  if (k === 'p' && S) return paused ? resumeGame() : pauseGame();
  if (paused) { if (k === 'escape') resumeGame(); return; }
  if (!S) return;
  if (k === 'enter' && !$('#roundModal').hidden) return nextRound();
  if (S.phase === 'bet' && k === ' ' && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); mainAction(); }
  if (S.phase === 'play') {
    const map = { h: 'hit', s: 'stand', d: 'double', x: 'split' };
    if (map[k]) { e.preventDefault(); run(() => act(map[k])); }
  }
});

// Phone / app support
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !paused) pauseGame(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#installBtn').hidden = false; });
$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt(); await installPrompt.userChoice;
  installPrompt = null; $('#installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; });
