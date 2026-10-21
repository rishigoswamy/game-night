const $ = s => document.querySelector(s);
// American wheel; 37 represents 00
const ORDER = [0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,37,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2];
const POCKETS = ORDER.length;
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const lbl = n => n === 37 ? '00' : String(n);
const isZero = n => n === 0 || n === 37;
const colorOf = n => isZero(n) ? 'green' : RED.has(n) ? 'red' : 'black';
const PCOLORS = ['var(--p0)', 'var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p5)'];
// A player's colour; players who join later take the first colour nobody at the table is using
const pc = i => S?.players[i]?.color ?? PCOLORS[i % PCOLORS.length];
const CHIPS = [[5,'#6b7280'],[10,'#2563eb'],[25,'#16a34a'],[50,'#dc2626'],[100,'#111827'],[500,'#7c3aed']];

const DEFS = {};
for (let n = 0; n <= 37; n++) DEFS['n' + n] = { label: lbl(n), payout: 35, wins: x => x === n };
Object.assign(DEFS, {
  red:   { label: 'Red',    payout: 1, wins: x => RED.has(x) },
  black: { label: 'Black',  payout: 1, wins: x => !isZero(x) && !RED.has(x) },
  odd:   { label: 'Odd',    payout: 1, wins: x => !isZero(x) && x % 2 === 1 },
  even:  { label: 'Even',   payout: 1, wins: x => !isZero(x) && x % 2 === 0 },
  low:   { label: '1–18',   payout: 1, wins: x => x >= 1 && x <= 18 },
  high:  { label: '19–36',  payout: 1, wins: x => x >= 19 && x <= 36 },
  d1:    { label: '1st 12', payout: 2, wins: x => x >= 1 && x <= 12 },
  d2:    { label: '2nd 12', payout: 2, wins: x => x >= 13 && x <= 24 },
  d3:    { label: '3rd 12', payout: 2, wins: x => x >= 25 && x <= 36 },
  c1:    { label: '2 to 1', payout: 2, wins: x => !isZero(x) && x % 3 === 1 },
  c2:    { label: '2 to 1', payout: 2, wins: x => !isZero(x) && x % 3 === 2 },
  c3:    { label: '2 to 1', payout: 2, wins: x => !isZero(x) && x % 3 === 0 },
});

let S = null;          // game state
let chip = 25;         // selected chip value
const fmt = n => '$' + n.toLocaleString();
const short = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(n);

/* ---------- Board ---------- */
const cells = {};
function buildBoard() {
  const board = $('#board');
  const add = (key, cls, style) => {
    const d = document.createElement('div');
    d.className = 'cell ' + cls;
    d.style.cssText = style;
    d.dataset.key = key;
    d.innerHTML = `<span>${DEFS[key].label}</span><div class="stacks"></div>`;
    d.addEventListener('click', () => {
      if (Date.now() - (+d.dataset.dragged || 0) < 400) return;   // this click ended a drag
      place(key);
    });
    enableStackDrag(d, key);
    d.addEventListener('contextmenu', e => { e.preventDefault(); removeKey(key); });
    board.appendChild(d);
    cells[key] = d;
  };
  add('n0', 'bg-green', 'grid-row:1/4;grid-column:1');
  add('n37', 'bg-green', 'grid-row:4/7;grid-column:1');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) {
    const n = 3 * (c + 1) - r;
    add('n' + n, 'bg-' + colorOf(n), `grid-row:${r * 2 + 1}/span 2;grid-column:${c + 2}`);
  }
  add('c3', 'outside', 'grid-row:1/span 2;grid-column:14');
  add('c2', 'outside', 'grid-row:3/span 2;grid-column:14');
  add('c1', 'outside', 'grid-row:5/span 2;grid-column:14');
  ['d1','d2','d3'].forEach((k, i) => add(k, 'outside', `grid-row:7;grid-column:${2 + i * 4}/span 4`));
  ['low','even','red','black','odd','high'].forEach((k, i) =>
    add(k, k === 'red' ? 'bg-red' : k === 'black' ? 'bg-black' : 'outside', `grid-row:8;grid-column:${2 + i * 2}/span 2`));
}

// Drag a chip from the rack and drop it on a table space to bet it.
function enableChipDrag(btn, v, color) {
  btn.addEventListener('pointerdown', e => {
    if (btn.disabled || e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null, over = null;
    btn.setPointerCapture(e.pointerId);
    const move = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost'; ghost.style.setProperty('--cc', color); ghost.textContent = v;
        document.body.appendChild(ghost);
        document.body.classList.add('dragging');
        chip = v; render();
      }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      const cell = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.cell') || null;
      if (cell !== over) {
        over?.classList.remove('drop-target');
        over = cell;
        over?.classList.add('drop-target');
      }
    };
    const end = ev => {
      btn.removeEventListener('pointermove', move);
      btn.removeEventListener('pointerup', end);
      btn.removeEventListener('pointercancel', end);
      if (!ghost) return;
      ghost.remove();
      document.body.classList.remove('dragging');
      over?.classList.remove('drop-target');
      if (over && ev.type === 'pointerup') place(over.dataset.key, v);
    };
    btn.addEventListener('pointermove', move);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
  });
}

// Drag your own chips off a space to take them back, or onto another space to move them.
function enableStackDrag(cell, key) {
  cell.addEventListener('pointerdown', e => {
    if (!S || S.phase !== 'bet' || e.button !== 0) return;
    const mine = S.bets.filter(b => b.p === S.active && b.key === key);
    if (!mine.length) return;
    const total = mine.reduce((a, b) => a + b.amt, 0);
    const sx = e.clientX, sy = e.clientY;
    let ghost = null, over = null;
    cell.setPointerCapture(e.pointerId);
    const targetAt = (x, y) => document.elementFromPoint(x, y)?.closest('.cell') || null;
    const move = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.style.setProperty('--cc', pc(S.active));
        ghost.textContent = short(total);
        document.body.appendChild(ghost);
        document.body.classList.add('dragging');
        cell.classList.add('drag-source');
      }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      const t = targetAt(ev.clientX, ev.clientY);
      const dest = t === cell ? null : t;
      if (dest !== over) {
        over?.classList.remove('drop-target');
        over = dest;
        over?.classList.add('drop-target');
      }
      ghost.classList.toggle('removing', !t);
      ghost.classList.toggle('moving', !!dest);
    };
    const end = ev => {
      cell.removeEventListener('pointermove', move);
      cell.removeEventListener('pointerup', end);
      cell.removeEventListener('pointercancel', end);
      if (!ghost) return;
      cell.dataset.dragged = Date.now();
      ghost.remove();
      document.body.classList.remove('dragging');
      cell.classList.remove('drag-source');
      over?.classList.remove('drop-target');
      if (ev.type !== 'pointerup' || !S || S.phase !== 'bet') return;
      const t = targetAt(ev.clientX, ev.clientY);
      if (!t) {
        removeKey(key);
        toast(`${S.players[S.active].name} pulled ${fmt(total)} back from ${DEFS[key].label}.`);
      } else if (t !== cell) {
        mine.forEach(b => { b.key = t.dataset.key; });
        render();
      }
    };
    cell.addEventListener('pointermove', move);
    cell.addEventListener('pointerup', end);
    cell.addEventListener('pointercancel', end);
  });
}

function buildChips() {
  const wrap = $('#chips');
  CHIPS.forEach(([v, c]) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.style.setProperty('--cc', c); b.textContent = v; b.dataset.v = v;
    b.addEventListener('click', () => { chip = v; render(); });
    enableChipDrag(b, v, c);
    wrap.appendChild(b);
  });
}

/* ---------- Betting ---------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.textContent = '', 2200);
}
// Betting actions take the player they act for (the table's selected player by default, or a phone's player).
// They return an error message when the action isn't allowed; taps on this device show it as a toast.
function place(key, val = chip, who = S?.active, quiet = false) {
  const fail = m => { if (!quiet) toast(m); return m; };
  if (!S || S.phase !== 'bet') return fail('Betting is closed.');
  if (who == null) return fail(sharing() ? 'Players on phones bet from their phones. Add a player here to bet from this screen.' : 'No one is at the table yet. Tap "+ Add player" to join.');
  const p = S.players[who];
  if (!p || !inGame(p)) return fail('That player is no longer at the table.');
  if (!quiet && lockedToPhone(who)) return fail(`${p.name} bets from their own phone.`);
  if (!DEFS[key]) return fail('Unknown bet.');
  const amt = Math.min(val, p.bal);
  if (amt <= 0) return fail(`${p.name} has no chips left to bet.`);
  p.bal -= amt;
  S.bets.push({ p: who, key, amt });
  render();
}
function refund(i) { const b = S.bets[i]; S.players[b.p].bal += b.amt; S.bets.splice(i, 1); }
function removeKey(key, who = S.active) {
  if (S.phase !== 'bet') return;
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
  const prev = S.lastBets[who];
  if (!prev.length) return fail('No bets from last round to repeat.');
  const total = prev.reduce((a, b) => a + b.amt, 0);
  const p = S.players[who];
  if (total > p.bal + staked(who)) return fail(`Not enough chips to rebet (${fmt(total)} needed).`);
  clearMine(who);
  prev.forEach(b => { p.bal -= b.amt; S.bets.push({ p: who, key: b.key, amt: b.amt }); });
  render();
}
function mainAction() {
  if (!S || paused) return;
  if (sharing() && S.mode === 'casino') return;     // shared table: only the betting-window timer spins the wheel
  if (S.phase === 'ready') return spin();
  if (S.phase !== 'bet') return;
  if (S.mode === 'casino') return spin();          // "No more bets" closes the window early
  if (S.turnIdx < S.order.length - 1) {
    S.turnIdx++;
    S.active = S.focus = S.order[S.turnIdx];
    render();
    say(`Thank you. ${S.players[S.active].name}, place your bets.`, 'welcome');
    startTurnTimer();
  } else {
    // Everyone has bet: lock the table, then spin as a separate final step
    S.phase = 'ready';
    stopTurnTimer();
    $('#result').textContent = 'All bets are in';
    render();
    if (S.timeLimit) {
      say(`All bets are in. Spinning in ${AUTO_SPIN_SECONDS} seconds.`, 'point');
      startTurnTimer(AUTO_SPIN_SECONDS);
    } else say('All bets are in. Spin the wheel when ready.', 'point');
  }
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
$('#tableMode').addEventListener('change', e => {
  $('#timeLabel').textContent = e.target.value === 'casino' ? 'Betting window' : 'Betting time per turn';
});
$('#timeLimit').addEventListener('change', e => {
  const custom = e.target.value === 'custom';
  $('#customTime').hidden = !custom;
  if (custom) $('#customTime').focus();
});

$('#untilBust').addEventListener('change', e => { $('#rounds').disabled = e.target.checked; });
buildNameFields();

/* ---------- Game flow ---------- */
const inGame = p => p.bal >= 1 && !p.cashedOut;
// Players who have left are kept off the table UI so the layout never fills up with them:
// cashed-out players always, busted players on an open table (a normal game keeps showing "out").
const gone = p => p.cashedOut || (S.openTable && p.bal < 1);
const alive = () => S.players.map((_, i) => i).filter(i => inGame(S.players[i]));
// Everyone still in, starting from this round's first bettor
function bettingOrder() {
  const a = alive(), k = a.indexOf(S.starter);
  return k < 0 ? a : [...a.slice(k), ...a.slice(0, k)];
}
function nextStarter() {
  const n = S.players.length;
  for (let d = 1; d <= n; d++) { const i = (S.starter + d) % n; if (inGame(S.players[i])) return i; }
  return S.starter;
}
const staked = i => S.bets.filter(b => b.p === i).reduce((a, b) => a + b.amt, 0);

// open = start an empty casino table that players join later
function newGame(open = false) {
  const n = open ? 0 : +$('#numPlayers').value;
  const names = [...Array(n)].map((_, i) => ($('#n' + i)?.value || '').trim() || 'Player ' + (i + 1));
  const bal = +$('#startBal').value;
  const rounds = open || $('#untilBust').checked ? 0 : Math.max(1, Math.min(999, Math.round(+$('#rounds').value) || 5));
  S = {
    mode: open ? 'casino' : $('#tableMode').value, startBal: bal, openTable: open,
    players: names.map((name, i) => ({ name, bal, start: bal, results: [], color: PCOLORS[i] })),
    round: 1, maxRounds: rounds, timeLimit: readTimeLimit() || (open ? 30 : 0), deadline: 0, warned: false,
    starter: 0, order: [], turnIdx: 0, active: 0, focus: 0, phase: 'bet',
    bets: [], lastBets: names.map(() => []), history: [],
  };
  S.order = bettingOrder();
  S.active = S.focus = S.order[0] ?? null;
  Object.values(cells).forEach(c => c.classList.remove('win'));
  $('#result').textContent = 'Place your bets';
  $('#setup').hidden = true; $('#endModal').hidden = true;
  ball.pocket = null;
  render();
  say(open ? 'The table is open! Join any time and place your bets please.'
    : S.mode === 'casino' ? 'Welcome to the table! Place your bets please. The betting window is open.'
    : `Welcome to the table! Place your bets please. ${S.players[S.active].name}, you're first.`, 'welcome');
  startTurnTimer();
  updateMasterBtns();
  autoShare();
}

function spin() {
  S.phase = 'spinning';
  stopTurnTimer();
  $('#result').textContent = 'No more bets…';
  render();
  say('No more bets!', 'wave');
  const n = randInt(POCKETS);
  send({ type: 'spin', n });                         // phones spin their wheels to the same number, at the same time
  spinWheelTo(n, () => resolve(n));
}

function randInt(n) {
  const a = new Uint32Array(1), lim = Math.floor(2 ** 32 / n) * n;
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return a[0] % n;
}

async function resolve(n) {
  const g = S;
  S.phase = 'result';
  const sum = S.players.map(() => ({ staked: 0, returned: 0 }));
  for (const b of S.bets) {
    sum[b.p].staked += b.amt;
    if (DEFS[b.key].wins(n)) sum[b.p].returned += b.amt * (DEFS[b.key].payout + 1);
  }
  S.history.unshift(n);
  logSpin(n);
  send({ type: 'result', n, color: colorOf(n), nets: Object.fromEntries(sum.map((x, i) => [i, x.staked ? x.returned - x.staked : null]).filter(([, v]) => v !== null)) });
  S.lastBets = S.players.map((_, p) => S.bets.filter(b => b.p === p).map(b => ({ key: b.key, amt: b.amt })));
  Object.entries(cells).forEach(([k, c]) => c.classList.toggle('win', DEFS[k].wins(n)));
  const col = colorOf(n);
  $('#result').innerHTML = `<div class="num bg-${col}">${lbl(n)}</div><span>${col[0].toUpperCase() + col.slice(1)}${isZero(n) ? '' : (n % 2 ? ', Odd' : ', Even')}</span>`;
  render();

  // 0/00: the celebration starts as the ball lands and stays up through the dealer's call and the groan
  let zeroDone = () => {};
  const fx = isZero(n) ? zeroFx(n, new Promise(res => { zeroDone = res; })) : null;
  if (isZero(n)) send({ type: 'fx', kind: 'zero', n });
  await say(n === 37 ? 'Double zero! Green.' : n === 0 ? 'Zero! Green.' : `${n}, ${col}.`, 'point');
  if (isZero(n) && S === g) crowdGroan().then(zeroDone); else zeroDone();   // the table's long, disappointed "awww"
  const hotHit = !isZero(n) && hotNumbers().find(([h]) => h === n);
  if (hotHit && S === g) { send({ type: 'fx', kind: 'hot', n, count: hotHit[1] }); await hotFx(n, hotHit[1], false, crowdCheer()); if (S !== g) return; }   // hot number: fire for as long as the cheer
  if (fx) await fx;
  if (S !== g) return;

  // Dealer sweeps the losing chips off the table
  const losers = S.bets.filter(b => !DEFS[b.key].wins(n));
  if (losers.length) {
    setPose('sweep');
    await Promise.all(losers.map((b, i) => fly(cells[b.key], $('#dealerHandL'), pc(b.p), short(b.amt), i * 50)));
    if (S !== g) return;
    S.bets = S.bets.filter(b => DEFS[b.key].wins(n));
    render();
  }

  // Announce each player's result (in betting order) and pay out winners
  for (const i of S.order) {
    const s = sum[i], p = S.players[i], net = s.returned - s.staked;
    if (!s.staked) continue;
    p.results.push({ round: S.round, net });
    S.focus = i;
    S.paying = i;
    S.payNote = `bet ${fmt(s.staked)} → ${net > 0 ? 'won ' + fmt(net) : net < 0 ? 'lost ' + fmt(-net) : 'broke even'} · balance ${fmt(p.bal + s.returned)}`;
    render();
    if (s.returned) {
      const msg = net > 0 ? `${p.name} wins ${fmt(net)}!`
        : net === 0 ? `${p.name} breaks even. ${fmt(s.returned)} back to you.`
        : `${p.name} gets ${fmt(s.returned)} back, but is down ${fmt(-net)}.`;
      const talk = say(msg, 'pay');
      const chips = Math.min(8, 3 + Math.floor(s.returned / 100));
      await Promise.all([...Array(chips)].map((_, k) =>
        fly($('#dealerHand'), $('#turn'), pc(i), k === chips - 1 ? short(s.returned) : '', 300 + k * 90)));
      if (S !== g) return;
      p.bal += s.returned;
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
  if (sum.every(x => !x.staked) && S.order.length) await say('No bets this round.');
  // Anyone who won $500 or more on this spin gets the big-win celebration
  const big = S.order.filter(i => sum[i].returned - sum[i].staked >= BIG_WIN)
    .map(i => ({ name: S.players[i].name, net: sum[i].returned - sum[i].staked, color: pc(i) }))
    .sort((a, b) => b.net - a.net);
  if (big.length && S === g) { send({ type: 'fx', kind: 'big', winners: big.map(w => ({ name: w.name, net: w.net })) }); setPose('wave'); await bigWinFx(big); }
  if (S !== g) return;
  setPose('');
  await pwait(300);
  if (S !== g) return;
  showRoundModal(n, sum);
}

const isOver = () => S.openTable ? false : alive().length === 0 || (S.maxRounds && S.round >= S.maxRounds)
  || (alive().length === 1 && S.players.length > 1 && !S.players.some(p => p.cashedOut));

function showRoundModal(n, sum) {
  $('#rmTitle').textContent = `Round ${S.round} result`;
  const num = $('#rmNum'); num.className = 'big-num bg-' + colorOf(n); num.textContent = lbl(n);
  $('#rmRows').innerHTML = '';
  S.players.forEach((p, i) => {
    if (gone(p) && !sum[i].staked) return;
    const net = sum[i].returned - sum[i].staked;
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

// With a time limit on, the next round starts by itself after a short countdown
const AUTO_NEXT_SECONDS = 5;
let autoNextId = null;
function startAutoNext() {
  stopAutoNext();
  if ((S.mode !== 'casino' && !S.timeLimit) || isOver()) return;
  let left = AUTO_NEXT_SECONDS;
  send({ type: 'next', in: AUTO_NEXT_SECONDS });     // phones show the same "next round in…" countdown
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
  S.order = bettingOrder();
  S.turnIdx = 0;
  S.active = S.focus = S.order[0] ?? null;
  S.bets = [];
  S.phase = 'bet';
  Object.values(cells).forEach(c => c.classList.remove('win'));
  $('#result').textContent = 'Place your bets';
  ball.pocket = null;     // ball pops out of the pocket and keeps circling
  render();
  seatPending();
  say(S.mode === 'casino' ? 'Place your bets please.' : `Place your bets please. ${S.players[S.active].name} goes first.`, 'welcome');
  startTurnTimer();
}

/* ---------- Betting timer ---------- */
// With a time limit on, each betting turn is timed, and once all bets are in
// the wheel spins by itself after a short countdown (the Spin button still works).
const AUTO_SPIN_SECONDS = 5;
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
  if (!S || (S.phase !== 'bet' && S.phase !== 'ready')) return stopTurnTimer();
  const left = Math.max(0, S.deadline - Date.now());
  renderTimer(left);
  if (!S.warned && left <= 10000 && S.timerTotal > 15 && S.order.length) { S.warned = true; say('Ten seconds left!'); }
  if (left > 0) return;
  stopTurnTimer();
  if (S.phase === 'ready' || S.mode === 'casino') return spin();
  toast(`Time's up for ${S.players[S.active].name}!`);
  mainAction();
}
function renderTimer(left) {
  const t = $('#timer');
  t.hidden = !(S && S.timeLimit && (S.phase === 'bet' || S.phase === 'ready') && timerId);
  if (t.hidden) return;
  const sec = Math.ceil(left / 1000);
  $('#tText').textContent = (S.phase === 'ready' ? 'Spinning in ' : S.mode === 'casino' ? 'Bets close in ' : '') + `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('#tBar').style.width = (left / (S.timerTotal * 1000) * 100) + '%';
  t.classList.toggle('low', left <= 10000);
}

function showEnd() {
  stopTurnTimer();
  S.players.forEach(p => Leaderboard.record('roulette', p));
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
  // Only the latest number up here so the top bar never wraps; the full history is in the Recent Numbers chart
  $('#history').innerHTML = S.history.length
    ? `<small>Last</small><span class="bg-${colorOf(S.history[0])}">${lbl(S.history[0])}</span>` : '';

  // Betting order strip (names only; money is shown for the current player alone)
  const casino = S.mode === 'casino';
  const doneSet = new Set(casino ? [] : S.phase === 'bet' ? S.order.slice(0, S.turnIdx) : S.order);
  const ready = S.phase === 'ready';
  $('#order').innerHTML = '';
  S.players.forEach((p, i) => {
    if (gone(p) && !S.order.includes(i)) return;
    const out = !S.order.includes(i) && !inGame(p);
    const pick = casino && S.phase === 'bet' && !out && !lockedToPhone(i);   // tap a name to bet as that player (this screen's players only)
    const pill = document.createElement(pick ? 'button' : 'span');
    if (pick) {
      pill.type = 'button';
      pill.title = `Bet as ${p.name}`;
      pill.addEventListener('click', () => { S.active = S.focus = i; render(); });
    }
    pill.className = 'pill' + (i === S.focus && !ready ? ' now' : out ? ' out' : doneSet.has(i) ? ' done' : '');
    pill.style.setProperty('--pc', pc(i));
    pill.innerHTML = `<span class="dot"></span><span class="nm"></span>${p.owner ? `<span class="ph" title="${NET.online.has(p.owner) ? 'Plays from a phone' : 'Phone disconnected'}">📱</span>` : ''}${out ? ' · out' : doneSet.has(i) && (i !== S.focus || ready) ? ' ✓' : ''}`;
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

  // Player section only while betting; during the spin and payout the mat moves up
  $('#playerArea').hidden = S.phase !== 'bet' && S.phase !== 'ready';

  // Current player's money
  keepLocalActive();
  const i = S.focus, p = S.players[i];
  const cur = $('#curCard');
  if (i == null || !p) {
    cur.style.removeProperty('--pc');
    cur.classList.remove('active');
    cur.innerHTML = sharing()
      ? `<div class="name">Shared table</div><div class="sub" style="margin-top:6px">Players on phones bet from their phones. Tap <b>+ Add player</b> to also play from this screen. The wheel spins when the betting window closes.</div>`
      : `<div class="name">Table open</div><div class="sub" style="margin-top:6px">No one is betting yet. Tap <b>+ Add player</b> to join. The wheel keeps spinning and Recent Numbers keeps counting.</div>`;
    $('#wlCard').innerHTML = '<div class="wl-head"><span>Win / loss by round</span></div><div class="wl-empty">Waiting for players</div>';
  } else {
  cur.style.setProperty('--pc', pc(i));
  cur.classList.toggle('active', S.phase === 'bet');
  const tag = S.phase === 'bet' ? 'Betting' : S.phase === 'result' ? 'Payout' : '';
  cur.innerHTML = `<div class="name"><span class="dot"></span><span class="nm"></span>${tag ? `<span class="tag">${tag}</span>` : ''}</div>
    <div class="bal">${fmt(p.bal)}</div><div class="sub">On table: ${fmt(staked(i))}</div>
    ${S.phase === 'bet' && inGame(p) ? '<button class="btn cashout" id="cashOutBtn" type="button">Cash out</button>' : ''}`;
  $('#cashOutBtn')?.addEventListener('click', () => openCashOut(i));
  cur.querySelector('.nm').textContent = p.name;
  renderWinLoss(i);
  }

  const turn = $('#turn');
  turn.style.setProperty('--pc', pc(S.active));
  const payee = S.phase === 'result' && S.paying != null ? S.paying : null;
  turn.style.setProperty('--pc', pc(payee ?? S.active));
  turn.innerHTML = S.phase === 'bet' ? (casino ? (sharing() ? '<span>Betting as <b class="nm"></b> · the wheel spins when the window closes</span>' : '<span>Betting as <b class="nm"></b> · tap a name above to switch player</span>') : '<span><b class="nm"></b>, place your bets</span>')
    : S.phase === 'ready' ? `<span>All bets are in. ${S.timeLimit ? 'The wheel spins automatically.' : 'Spin the wheel!'}</span>`
    : S.phase === 'spinning' ? '<span>Wheel is spinning…</span>'
    : payee != null ? `<span><b class="nm"></b>: ${S.payNote || ''}</span>` : '<span>Round over</span>';
  if (S.phase === 'bet' && S.active == null) turn.innerHTML = '<span>Table open · waiting for players</span>';
  const nm = turn.querySelector('.nm'); if (nm) nm.textContent = S.players[payee ?? S.active].name;

  // Chip stacks per cell
  for (const [key, el] of Object.entries(cells)) {
    const tot = S.players.map(() => 0);
    S.bets.forEach(b => { if (b.key === key) tot[b.p] += b.amt; });
    el.classList.toggle('has-mine', S.phase === 'bet' && tot[S.active] > 0);
    el.querySelector('.stacks').innerHTML = tot.map((t, k) => t ? `<span class="chip-mini" style="--pc:${pc(k)}">${short(t)}</span>` : '').join('');
  }

  const betting = S.phase === 'bet';
  $('#board').classList.toggle('locked', !betting);
  document.querySelectorAll('.chip').forEach(b => {
    b.classList.toggle('sel', +b.dataset.v === chip);
    b.disabled = !betting || S.active == null;
  });
  const mine = S.bets.some(b => b.p === S.active);
  $('#undoBtn').disabled = !betting || !mine;
  $('#clearBtn').disabled = !betting || !mine;
  $('#rebetBtn').disabled = !betting || S.active == null || !S.lastBets[S.active]?.length;
  const mb = $('#mainBtn');
  mb.disabled = !betting && !ready;
  mb.hidden = sharing() && S.mode === 'casino';           // shared: nobody can force an early spin
  const last = S.turnIdx >= S.order.length - 1;
  mb.textContent = ready ? 'Spin the wheel'
    : !betting ? (S.phase === 'spinning' ? 'Spinning…' : 'Paying out…')
    : casino ? 'No more bets → spin'
    : last ? 'Done → all bets in' : `Done → pass to ${S.players[S.order[S.turnIdx + 1]].name}`;
  shareSync();
}

/* ---------- Cash out ---------- */
// A player leaves with their balance locked in. Chips they put on the table this round come back first.
let cashFor = null;
function openCashOut(i) {
  if (!S || S.phase !== 'bet') return;
  const p = S.players[i], onTable = staked(i), total = p.bal + onTable, net = total - p.start;
  cashFor = i;
  pauseGame();
  $('#pauseModal').hidden = true;
  $('#cashText').textContent = `${p.name} leaves the table with ${fmt(total)} (${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))} overall)` +
    (onTable ? `, including ${fmt(onTable)} taken back from this round's bets.` : '.') + ' They can\'t rejoin this game.';
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
  Leaderboard.record('roulette', p);                  // on the leaderboard with what they leave with
  S.lastBets[i] = [];
  const idx = S.order.indexOf(i);
  S.order.splice(idx, 1);
  toast(`${p.name} cashed out with ${fmt(p.bal)}.`);
  say(`${p.name} cashes out with ${fmt(p.bal)}. Thank you for playing!`, 'pay');
  if (!S.order.length) {
    if (!S.openTable) { stopTurnTimer(); return showEnd(); }
    S.active = S.focus = null;          // open table keeps running with nobody at it
    return render();
  }
  if (S.mode === 'turns') {
    if (idx < S.turnIdx) S.turnIdx--;                      // someone who already bet left
    else if (idx === S.turnIdx) {                          // the current bettor left
      if (S.turnIdx >= S.order.length) { S.turnIdx = S.order.length - 1; S.active = S.focus = S.order[S.turnIdx]; return mainAction(); }
      S.active = S.focus = S.order[S.turnIdx];
      render();
      return startTurnTimer();
    }
    S.active = S.focus = S.order[S.turnIdx];
  } else if (S.active === i) S.active = S.focus = S.order[0];
  render();
}

/* ---------- Add a player mid-game ---------- */
function openAddPlayer() {
  if (!S || S.phase !== 'bet' || alive().length >= PCOLORS.length) return;
  pauseGame();                      // hold the timer while the name is typed
  $('#pauseModal').hidden = true;
  $('#newName').value = `Player ${S.players.length + 1}`;   // numbered by arrival
  $('#addNote').textContent = `Joins with ${fmt(S.startBal)} in chips` +
    (S.mode === 'turns' ? ' and bets last this round.' : ' and can bet right away.');
  $('#addModal').hidden = false;
  $('#newName').select();
}
function closeAddPlayer() {
  $('#addModal').hidden = true;
  resumeGame();
}
$('#addCancel').addEventListener('click', closeAddPlayer);
$('#addForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!S || alive().length >= PCOLORS.length) return closeAddPlayer();
  const i = addPlayer($('#newName').value.trim() || `Player ${S.players.length + 1}`);
  if (S.mode === 'casino') S.active = S.focus = i;
  closeAddPlayer();
  render();
});
// Seats a new player (owner = the phone that controls them, or null for this device). Returns their index.
function addPlayer(name, owner = null) {
  const i = S.players.length;
  // Prefer a colour nobody has used yet; reuse a departed player's colour only when all six are taken
  const everUsed = new Set(S.players.map(q => q.color)), seated = new Set(alive().map(k => S.players[k].color));
  const color = PCOLORS.find(c => !everUsed.has(c)) || PCOLORS.find(c => !seated.has(c));
  S.players.push({ name, bal: S.startBal, start: S.startBal, results: [], color, owner });
  S.lastBets.push([]);
  S.order.push(i);
  if (S.active == null && !owner) S.active = S.focus = i;
  render();
  say(`Welcome to the table, ${name}!`, 'welcome');
  return i;
}

/* ---------- Flush Recent Numbers (admin) ---------- */
// The lock itself is created and managed on the Admin page (admin.html); here we only unlock with it.
let lockBio = false;
async function openFlush() {
  if (!spinLog.length) return;
  if (S && !paused) { pauseGame(); $('#pauseModal').hidden = true; }
  const has = AdminLock.hasLock(), n = spinLog.length;
  lockBio = has && AdminLock.hasDeviceUnlock() && await AdminLock.bioAvailable();
  $('#lockTitle').textContent = 'Flush Recent Numbers';
  $('#lockText').textContent = has
    ? `This erases all ${n} recorded spin${n === 1 ? '' : 's'} in Recent Numbers on this device.`
    : 'Flushing needs an admin lock, and none is set up on this device yet. An admin can create one on the Admin page.';
  $('#bioBtn').hidden = !lockBio;
  $('#bioBtn').textContent = `Unlock with ${AdminLock.bioName()}`;
  $('#lockOr').hidden = !lockBio;
  $('#pinField').hidden = !has;
  $('#lockSubmit').hidden = !has;
  $('#adminLink').hidden = has;
  $('#lockCancel').textContent = has ? 'Cancel' : 'Close';
  $('#lockNote').textContent = has ? 'Forgot the PIN? Manage it on the Admin page (from the lobby).' : '';
  $('#pin1').value = '';
  $('#lockErr').textContent = '';
  $('#lockModal').hidden = false;
  if (has) $(lockBio ? '#bioBtn' : '#pin1').focus();
}
function closeFlush() {
  $('#lockModal').hidden = true;
  if (S && paused) resumeGame();
}
function doFlush() {
  const n = spinLog.length;
  spinLog = [];
  saveSpins();
  renderSpinChart();
  closeFlush();
  if (S) render();
  toast(`Recent Numbers erased (${n} spin${n === 1 ? '' : 's'}).`);
}
$('#flushBtn').addEventListener('click', openFlush);
$('#lockCancel').addEventListener('click', closeFlush);
$('#adminLink').addEventListener('click', closeFlush);
$('#bioBtn').addEventListener('click', async () => {
  try {
    if (await AdminLock.verifyPasskey()) return doFlush();
    $('#lockErr').textContent = 'The device did not confirm it was you. Use the PIN instead.';
  } catch {
    $('#lockErr').textContent = "Device unlock was cancelled or isn't available. Use the PIN instead.";
  }
});
$('#lockForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!AdminLock.hasLock()) return;
  const res = AdminLock.checkPin($('#pin1').value.trim());
  if (res.ok) return doFlush();
  $('#pin1').value = '';
  $('#lockErr').textContent = res.error;
});
// The Admin page (another tab) can flush the history too: pick that up immediately
window.addEventListener('storage', e => {
  if (e.key !== SPIN_KEY) return;
  try { spinLog = JSON.parse(e.newValue) || []; } catch { spinLog = []; }
  renderSpinChart();
});

/* ---------- 0 / 00 celebration ---------- */
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

// Preview from the Rules window: plays the celebration and the dealer's call; game and bets are untouched
document.querySelectorAll('[data-fx]').forEach(b => b.addEventListener('click', () => {
  const n = +b.dataset.fx;
  b.blur();                                   // so a later Space/Enter can't replay the preview
  setRules(false);
  if (b.dataset.fx === 'big') {
    const who = S && S.focus != null ? S.players[S.focus] : null;
    say('Big winner!', 'wave');
    bigWinFx([{ name: who ? who.name : 'Player 1', net: 875, color: who ? pc(S.focus) : PCOLORS[0] }]);
    return;
  }
  if (b.dataset.fx === 'hot') {
    const hot = hotNumbers().find(([h]) => !isZero(h)), [h, c] = hot || [17, 3];
    say(`${lbl(h)}, ${colorOf(h)}.`, 'point').then(() => hotFx(h, c, !hot, crowdCheer()));
    return;
  }
  let done;
  zeroFx(n, new Promise(res => { done = res; }));
  say(n === 37 ? 'Double zero! Green.' : 'Zero! Green.', 'point').then(() => crowdGroan().then(done));
}));
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

// Hot number: full-screen fire: flame-coloured rays, a giant flickering flame behind the number,
// spark bursts and embers rising from the bottom, for as long as the cheer lasts
async function hotFx(n, count, preview, until) {
  const fx = document.createElement('div');
  fx.className = 'hot-fx';
  fx.setAttribute('role', 'status');
  fx.innerHTML = `<div class="rays"></div><div class="hf-flame">${FLAME_SVG}</div>
    <div class="big hot-${colorOf(n)}">${lbl(n)}</div>
    <div class="label">HOT NUMBER</div>
    <div class="hf-sub">${preview ? 'preview' : `${count}× in the last ${spinLog.length} spins`}</div>`;
  const fire = ['#ff3d00', '#ff9100', '#ffd54f', '#fff3b0', '#ff6d00'];
  await holdFx(fx, until, () => {
    sparkBurst(fx, fire, 40, { dist: [26, 40], size: [7, 9] });
    for (let k = 0; k < 45; k++) {                       // embers drifting up
      const e = document.createElement('span');
      e.className = 'ember';
      e.style.left = Math.random() * 100 + 'vw';
      e.style.setProperty('--s', (4 + Math.random() * 8).toFixed(0) + 'px');
      e.style.setProperty('--c', fire[k % fire.length]);
      fx.appendChild(e);
      const sway = (Math.random() - .5) * 14;
      animateOnce(e, [
        { transform: 'translate(0, 0) scale(1)', opacity: 0 },
        { opacity: 1, offset: .12 },
        { transform: `translate(${sway}vw, -55vh) scale(.8)`, opacity: .9, offset: .55 },
        { transform: `translate(${-sway / 2}vw, -112vh) scale(.3)`, opacity: 0 },
      ], { duration: 2600 + Math.random() * 2000, delay: Math.random() * 2000, easing: 'ease-out', fill: 'both' });
    }
  });
}

// 0 / 00: green burst, gold rays, cash explosion, for as long as the dealer's call and the groan last
async function zeroFx(n, until) {
  const fx = document.createElement('div');
  fx.className = 'zero-fx';
  fx.setAttribute('aria-hidden', 'true');
  fx.innerHTML = `<div class="rays"></div><div class="ring"></div><div class="big">${lbl(n)}</div><div class="label">${n === 37 ? 'DOUBLE ZERO' : 'ZERO'}</div>`;
  const colors = ['#22c55e', '#d4af37', '#fff6cf', '#4ade80', '#f3dc8b'];
  await holdFx(fx, until, () => { sparkBurst(fx, colors, 48); cashBurst(fx); });
}

/* ---------- Master table: guests join from their own phones ---------- */
// The Roulette table on the host computer (where server.js runs) is the master table. While a Casino-style
// game is running there, it is shared automatically: phones on the same Wi-Fi open the computer's address and
// join it with their own players. Other devices can't run a table of their own; they are sent to the join page.
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
  if (!S || !NET.master || S.mode !== 'casino') return;
  try {
    const r = await fetch('/api/host', { method: 'POST', body: JSON.stringify({ game: 'roulette', code: NET.code, hostKey: NET.hostKey, takeover }) });
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
    return;                                          // no Game Night server: plays as a one-device table
  }
  if (!S.timeLimit) {                               // with guests, the wheel spins only when the betting window closes
    S.timeLimit = 30;
    if (S.phase === 'bet') startTurnTimer();
    toast('Shared tables spin on a timer: the betting window is now 30 seconds.');
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
function autoShare() { if (NET.master && S && S.mode === 'casino' && !sharing()) startSharing(); }
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
    type: 'state', game: 'roulette', code: NET.code, phase: S.phase, paused, round: S.round, maxRounds: S.maxRounds,
    closesIn: S.phase === 'bet' && timerId && S.deadline ? Math.max(0, S.deadline - Date.now()) : null, windowLen: S.timerTotal || 0,
    players: S.players.map((p, i) => ({ i, name: p.name, bal: p.bal, start: p.start, color: p.color || pc(i), owner: p.owner || null,
      inGame: inGame(p), cashedOut: !!p.cashedOut, onTable: staked(i), canRebet: !!S.lastBets[i]?.length,
      results: p.results.slice(-12), wlTotal: p.results.reduce((a, r) => a + r.net, 0) })),
    bets: S.bets, history: S.history.slice(0, 12), hot: hotNumbers(), seatsFree: PCOLORS.length - alive().length,
    recent: spinLog.slice(-50),                      // the master's Recent Numbers, for the phones' chart
    lastResult: S.phase === 'result' || S.phase === 'bet' ? S.history[0] ?? null : null,
  };
}
// Coalesce bursts of renders into one update for the phones
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
        ? 'Welcome to the table! Bets are open, place your bets please.'
        : 'Welcome to the table! The wheel is spinning; you can bet in the next round.' }, m.device);
    case 'join': {
      const name = String(m.name || '').trim().slice(0, 16) || `Player ${S.players.length + 1}`;
      if (alive().length + NET.pending.length >= PCOLORS.length) return refuse('The table is full (6 players).');
      if (S.phase !== 'bet' || paused) {                  // seated as soon as the next betting window opens
        NET.pending.push({ name, device: m.device });
        return reply({ type: 'queued', name });
      }
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
// Players who asked to join while the wheel was spinning take their seats when bets open again
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
$('#shareBtn').addEventListener('click', () => { renderShare(); $('#shareQr').src = '/api/qr.svg'; $('#shareModal').hidden = false; });
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
    if (info.master === false) return location.replace('remote.html');   // only when the server clearly says "not the host computer"
    autoShare();
  } catch {}                                         // no Game Night server (e.g. opened as a file): one-device table
})();
$('#takeoverNo').addEventListener('click', () => { $('#takeoverModal').hidden = true; });
$('#takeoverYes').addEventListener('click', () => { $('#takeoverModal').hidden = true; startSharing(true); });

/* ---------- Charts ---------- */
const svgNS = 'http://www.w3.org/2000/svg';
// Bar with rounded corners only on the end away from the zero line
function barPath(x, y0, w, h, up) {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return '';
  return up
    ? `M${x} ${y0} V${y0 - h + r} Q${x} ${y0 - h} ${x + r} ${y0 - h} H${x + w - r} Q${x + w} ${y0 - h} ${x + w} ${y0 - h + r} V${y0} Z`
    : `M${x} ${y0} V${y0 + h - r} Q${x} ${y0 + h} ${x + r} ${y0 + h} H${x + w - r} Q${x + w} ${y0 + h} ${x + w} ${y0 + h - r} V${y0} Z`;
}
const signed = v => (v > 0 ? '+' : v < 0 ? '-' : '') + fmt(Math.abs(v));

function renderWinLoss(i) {
  const p = S.players[i], card = $('#wlCard');
  const all = p.results, data = all.slice(-12);
  const total = all.reduce((a, r) => a + r.net, 0);
  card.innerHTML = `<div class="wl-head"><span>Win / loss by round</span><b class="${total > 0 ? 'pos' : total < 0 ? 'neg' : 'zero'}">${all.length ? signed(total) : ''}</b></div>`;
  if (!data.length) {
    card.insertAdjacentHTML('beforeend', '<div class="wl-empty">No rounds played yet</div>');
    return;
  }
  const W = Math.max(120, card.clientWidth - 28), H = 70, mid = H / 2;
  const maxAbs = Math.max(...data.map(r => Math.abs(r.net)), 1);
  const slot = W / 12, bw = Math.min(16, slot - 4);
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${p.name}: ${data.map(r => `round ${r.round} ${signed(r.net)}`).join(', ')}`);
  let html = `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="rgba(255,255,255,.35)" stroke-width="1"/>`;
  data.forEach((r, k) => {
    const x = k * slot + (slot - bw) / 2;
    const h = Math.max(r.net ? 3 : 0, Math.abs(r.net) / maxAbs * (mid - 4));
    const tipText = `Round ${r.round}: ${r.net ? signed(r.net) : 'even'}`;
    if (h) html += `<path d="${barPath(x, mid, bw, h, r.net > 0)}" fill="${r.net > 0 ? '#4ade80' : '#f87171'}"/>`;
    else html += `<circle cx="${x + bw / 2}" cy="${mid}" r="3" fill="#b9c4bc"/>`;
    html += `<rect x="${k * slot}" y="0" width="${slot}" height="${H}" fill="transparent" data-tip="${tipText}"/>`;
  });
  svg.innerHTML = html;
  card.appendChild(svg);
}

// Last 50 spins on this device: kept across games, reloads and app restarts until the protected Flush
const SPIN_KEY = 'gn-spins';
let spinLog = [];
try { spinLog = JSON.parse(localStorage.getItem(SPIN_KEY) || sessionStorage.getItem(SPIN_KEY)) || []; } catch {}
function saveSpins() { try { localStorage.setItem(SPIN_KEY, JSON.stringify(spinLog)); } catch {} }
function logSpin(n) {
  spinLog.push(n);
  if (spinLog.length > 50) spinLog.shift();
  saveSpins();
  renderSpinChart();
}
const FLAME_SVG = `<svg class="flame" viewBox="0 0 24 32" aria-hidden="true">
  <defs><linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#d50000"/><stop offset=".35" stop-color="#ff3d00"/><stop offset=".7" stop-color="#ff9100"/><stop offset="1" stop-color="#ffd54f"/>
  </linearGradient></defs>
  <path d="M12 1c1.2 6.2 8 9.4 8 17.6A8 8 0 0 1 4 18.6c0-4.3 2.2-6.6 3.4-8.8.9 3.1 2.3 4.5 4.3 4.6C9.6 10.2 10.4 5.5 12 1z" fill="url(#flameGrad)"/>
  <path class="core" d="M12.2 15c.8 3 4.3 4.6 4.3 8.2a4.4 4.4 0 0 1-8.8 0c0-2.3 1.1-3.5 1.8-4.6.6 1.5 1.5 2.3 2.6 2.3-1-2.4-.6-4.3.1-5.9z" fill="#fff3b0"/>
</svg>`;
const POCKET_FILL = { red: '#e5484d', black: '#1b1b1b', green: '#22c55e' };
// Hot numbers: up to 3 numbers seen more than once in the recent spins, most frequent first → [[n, count]]
function hotNumbers() {
  const freq = {};
  spinLog.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  return Object.entries(freq).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => [+n, c]);
}
function renderSpinChart() {
  const box = $('#spinChart');
  const counts = { red: 0, black: 0, green: 0 }, freq = {};
  spinLog.forEach(n => { counts[colorOf(n)]++; freq[n] = (freq[n] || 0) + 1; });
  const hot = hotNumbers();
  $('#spinSub').textContent = spinLog.length ? `Last ${spinLog.length} of up to 50 spins on this device` : 'Kept on this device until flushed';
  $('#flushBtn').disabled = !spinLog.length;
  $('#spinStats').innerHTML = !spinLog.length ? '' :
    ['red', 'black', 'green'].map(c => `<span><span class="sw" style="background:${POCKET_FILL[c]};${c === 'black' ? 'box-shadow:0 0 0 1.5px #f5f1e6' : ''}"></span>${c[0].toUpperCase() + c.slice(1)} ${counts[c]}</span>`).join('')
    + `<span class="hot"><span class="hot-label">${FLAME_SVG}Hot</span>${hot.length
        ? hot.map(([n, c]) => `<span class="hot-num" title="${lbl(+n)} came up ${c} times"><b class="bg-${colorOf(+n)}">${lbl(+n)}</b><small>${c}×</small></span>`).join('')
        : '<span class="sub">none yet</span>'}</span>`;
  if (!spinLog.length) { box.innerHTML = '<div class="chart-empty">Spin the wheel and results will appear here.</div>'; $('#spinHint').hidden = true; return; }

  // At least 22px per spin so each numbered dot fits; wider than the box → it scrolls sideways
  const SLOT = 22, L = 34, R = 14, T = 16, B = 30;
  const W = Math.max(box.clientWidth || 280, L + R + 50 * SLOT), H = 270;
  const x = k => L + (k + .5) * (W - L - R) / 50;
  const y = n => T + (37 - n) / 37 * (H - T - B);       // 00 is stored as 37 and sits on top
  let html = '';
  [0, 9, 18, 27, 37].forEach(v => {
    html += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.12)"/>
      <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#b9c4bc">${lbl(v)}</text>`;
  });
  html += `<text x="${W - R}" y="${H - 6}" font-size="11" fill="#b9c4bc" text-anchor="end">Spin order: oldest → newest (gold ring = latest)</text>`;
  html += `<polyline fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5" stroke-linejoin="round"
    points="${spinLog.map((n, k) => `${x(k)},${y(n)}`).join(' ')}"/>`;
  // Each spin is a dot in its pocket colour with the number written inside it
  spinLog.forEach((n, k) => {
    const c = colorOf(n), latest = k === spinLog.length - 1, cx = x(k), cy = y(n);
    if (latest) html += `<circle cx="${cx}" cy="${cy}" r="13.5" fill="none" stroke="#d4af37" stroke-width="2.5"/>`;
    html += `<circle cx="${cx}" cy="${cy}" r="9.5" fill="${POCKET_FILL[c]}"
      stroke="${c === 'black' ? '#f5f1e6' : '#0b3a24'}" stroke-width="${c === 'black' ? 1.2 : 1.5}"/>`;
    html += `<text x="${cx}" y="${cy + 3.3}" text-anchor="middle" font-size="${lbl(n).length > 1 ? 9 : 10}" font-weight="800"
      fill="${c === 'green' ? '#06301b' : '#fff'}" pointer-events="none">${lbl(n)}</text>`;
    html += `<circle cx="${cx}" cy="${cy}" r="12" fill="transparent"
      data-tip="Spin ${k + 1}${latest ? ' (latest)' : ''}: ${lbl(n)} ${c[0].toUpperCase() + c.slice(1)}"/>`;
  });
  box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Last ${spinLog.length} roulette numbers: ${spinLog.map(lbl).join(', ')}">${html}</svg>`;
  box.scrollLeft = Math.max(0, x(spinLog.length - 1) + 40 - box.clientWidth);   // latest spin near the right edge, never past the dots
  $('#spinHint').hidden = box.scrollLeft < 2;           // only when older spins are off to the left
}

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
let chartResize = null;
window.addEventListener('resize', () => {
  clearTimeout(chartResize);
  chartResize = setTimeout(() => { renderSpinChart(); if (S && S.focus != null) renderWinLoss(S.focus); }, 120);
});
renderSpinChart();

/* ---------- Wheel ---------- */
const cv = $('#wheel'), ctx = cv.getContext('2d');
const SIZE = 440, C = SIZE / 2, SEG = Math.PI * 2 / POCKETS;
const R_RIM = 218, R_TRACK_OUT = 200, R_POCKET_OUT = 172, R_NUM_IN = 142, R_POCKET_IN = 108;
const BALL_TRACK = 186, BALL_POCKET = 125;
let dpr = 1, rot = 0, anim = null;
const ball = { a: -Math.PI / 2, r: BALL_TRACK, visible: true, pocket: null };
const BALL_IDLE_SPEED = 2.6;   // radians per second while circling between spins
let lastFrame = performance.now();

function resize() {
  dpr = window.devicePixelRatio || 1;
  cv.width = SIZE * dpr; cv.height = SIZE * dpr;
}
const mod = (a, m) => ((a % m) + m) % m;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
function easeOutBounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
  return n * (t -= 2.625 / d) * t + .984375;
}

function spinWheelTo(n, done) {
  const idx = ORDER.indexOf(n);
  const land = Math.random() * Math.PI * 2;           // where on screen the ball settles
  const r0 = rot, b0 = ball.pocket != null ? rot + ball.pocket * SEG : ball.a;
  const r1 = r0 + Math.PI * 2 * 4 + mod(land - idx * SEG - r0, Math.PI * 2);
  const b1 = b0 - Math.PI * 2 * 7 - mod(b0 - land, Math.PI * 2);
  ball.visible = true; ball.pocket = null;
  anim = { t0: performance.now(), dur: 6500, r0, r1, b0, b1, br0: ball.r, idx, done };
}

function frame(now) {
  const dt = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (paused) { draw(); return requestAnimationFrame(frame); }
  if (anim) {
    const k = Math.min(1, (now - anim.t0) / anim.dur);
    rot = anim.r0 + (anim.r1 - anim.r0) * easeOutCubic(k);
    ball.a = anim.b0 + (anim.b1 - anim.b0) * easeOutQuart(k);
    if (k < .08) ball.r = anim.br0 + (BALL_TRACK - anim.br0) * (k / .08);
    else if (k < .6) ball.r = BALL_TRACK;
    else ball.r = BALL_TRACK + (BALL_POCKET - BALL_TRACK) * easeOutBounce(Math.min(1, (k - .6) / .3));
    if (k >= 1) {
      ball.pocket = anim.idx;
      const cb = anim.done; anim = null; cb();
    }
  } else {
    rot += 0.15 * dt;
    if (ball.pocket != null) { ball.a = rot + ball.pocket * SEG; ball.r = BALL_POCKET; }
    else {
      ball.a -= BALL_IDLE_SPEED * dt;
      ball.r += (BALL_TRACK - ball.r) * Math.min(1, 6 * dt);   // ease back up onto the track
    }
  }
  draw();
  requestAnimationFrame(frame);
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Wooden rim
  let g = ctx.createRadialGradient(C, C, R_TRACK_OUT, C, C, R_RIM);
  g.addColorStop(0, '#3b200e'); g.addColorStop(.5, '#7a4520'); g.addColorStop(1, '#2a1608');
  circle(R_RIM, g);
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2; ring(R_RIM - 1);

  // Ball track
  g = ctx.createRadialGradient(C, C, R_POCKET_OUT, C, C, R_TRACK_OUT);
  g.addColorStop(0, '#1d1d1d'); g.addColorStop(1, '#4a4a4a');
  circle(R_TRACK_OUT, g);

  // Pockets (rotating)
  ctx.save();
  ctx.translate(C, C);
  ctx.rotate(rot);
  for (let i = 0; i < POCKETS; i++) {
    const n = ORDER[i], a0 = i * SEG - SEG / 2, a1 = a0 + SEG;
    ctx.beginPath();
    ctx.arc(0, 0, R_POCKET_OUT, a0, a1);
    ctx.arc(0, 0, R_POCKET_IN, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = isZero(n) ? '#0a8a45' : RED.has(n) ? '#c0262d' : '#151515';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212,175,55,.85)'; ctx.lineWidth = 1.2; ctx.stroke();

    ctx.save();
    ctx.rotate(i * SEG + Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lbl(n), 0, -(R_POCKET_OUT + R_NUM_IN) / 2);
    ctx.restore();
  }
  // Divider between number band and pockets
  ctx.beginPath(); ctx.arc(0, 0, R_NUM_IN, 0, Math.PI * 2);
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2; ctx.stroke();

  // Center cone
  g = ctx.createRadialGradient(-20, -20, 10, 0, 0, R_POCKET_IN);
  g.addColorStop(0, '#9a6235'); g.addColorStop(.7, '#5a3317'); g.addColorStop(1, '#2d1809');
  ctx.beginPath(); ctx.arc(0, 0, R_POCKET_IN, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.stroke();

  // Turret
  ctx.fillStyle = '#e8c766'; ctx.strokeStyle = '#8a6d1a'; ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    ctx.save(); ctx.rotate(k * Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, -62); ctx.lineTo(5, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -62, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 16);
  g.addColorStop(0, '#fff6cf'); g.addColorStop(1, '#b8901f');
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.restore();

  // Ball
  if (ball.visible) {
    const x = C + Math.cos(ball.a) * ball.r, y = C + Math.sin(ball.a) * ball.r;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    g = ctx.createRadialGradient(x - 2.5, y - 2.5, 1, x, y, 8);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b8b8b8');
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }
}
function circle(r, fill) { ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function ring(r) { ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.stroke(); }

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
  $('#addModal').hidden = true;
  $('#cashModal').hidden = true;
  $('#lockModal').hidden = true;
  stopAutoNext();
  stopTurnTimer();
  paused = false;
  pausedAnims.forEach(a => a.play()); pausedAnims = [];
  if (canSpeak) { speechSynthesis.resume(); speechSynthesis.cancel(); }
  stopVoice();
  stopSfx();
  anim = null;                  // drops the pending spin result
  ball.pocket = null;
  document.querySelectorAll('.fly-chip').forEach(c => c.getAnimations().forEach(a => a.finish()));
  document.querySelectorAll('.zero-fx, .hot-fx, .bigwin-fx').forEach(el => el.remove());
  if (S) S.players.forEach((p, i) => Leaderboard.record('roulette', p, S.phase === 'bet' ? staked(i) : 0));   // leaving mid-game still counts
  S = null;                     // any in-flight payout sequence sees this and stops
  ['#pauseModal', '#roundModal', '#endModal'].forEach(id => $(id).hidden = true);
  setRules(false);
  Object.values(cells).forEach(c => { c.classList.remove('win'); c.querySelector('.stacks').innerHTML = ''; });
  $('#timer').hidden = true;
  $('#result').textContent = 'Place your bets';
  sayToken++; setPose('');
  bubble.textContent = 'Thanks for playing! Come back soon.';
  $('#setup').hidden = false;
  updateMasterBtns();
}

$('#pauseBtn').addEventListener('click', () => paused ? resumeGame() : pauseGame());
let exitTarget = null;   // null = back to setup, 'lobby' = leave for the lobby page
function askExit(target) {
  exitTarget = target;
  $('#pmConfirmTitle').textContent = target === 'lobby' ? 'Leave for the lobby?' : 'Exit game?';
  $('#pmConfirmText').textContent = target === 'lobby'
    ? 'This game and all chip balances will be lost.'
    : "This round and all chip balances will be lost. You'll go back to the setup screen.";
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

/* ---------- Payout table ---------- */
const PAYOUT_ROWS = [
  ['Inside bet'],
  ['Straight up', 'Any single number, 0 or 00', 'n0', '1 number'],
  ['Outside bets'],
  ['Dozen', '1st 12 · 2nd 12 · 3rd 12', 'd1', '12 numbers (1–12, 13–24, 25–36)'],
  ['Column', '“2 to 1” at the end of a row', 'c1', '12 numbers (one row of the table)'],
  ['Red / Black', 'Red or Black box', 'red', '18 numbers'],
  ['Odd / Even', 'Odd or Even box', 'odd', '18 numbers'],
  ['Low / High', '1–18 or 19–36 box', 'low', '18 numbers'],
];
function renderPayouts() {
  const stake = +$('#exStake').value;
  $('#payoutRows').innerHTML = PAYOUT_ROWS.map(([name, where, key, covers]) => {
    if (!where) return `<tr class="group"><td colspan="7">${name}</td></tr>`;
    const d = DEFS[key];
    const count = [...Array(POCKETS).keys()].filter(d.wins).length;
    const pct = count / POCKETS * 100;
    return `<tr><td><b>${name}</b></td><td class="sub">${where}</td><td class="sub">${covers}</td>
      <td class="num odds">${d.payout}:1</td><td class="num ex">+${fmt(stake * d.payout)}</td>
      <td class="num ex">${fmt(stake * (d.payout + 1))}</td>
      <td class="ex"><span class="bar" style="width:${pct * 1.4}px"></span>${pct.toFixed(2)}% <span class="sub">(${count} in ${POCKETS})</span></td></tr>`;
  }).join('');
}
$('#exStake').addEventListener('change', renderPayouts);
$('#exToggle').addEventListener('change', e => $('#payouts').classList.toggle('show-ex', e.target.checked));

function setRules(open) {
  $('#rules').hidden = !open;
  $('#rulesBtn').setAttribute('aria-pressed', open);
  if (open) $('.table-area').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#rules').hidden) setRules(false); });
document.addEventListener('pointerdown', e => {
  if (!$('#rules').hidden && !e.target.closest('#rules, #rulesBtn')) setRules(false);
});
$('#rulesBtn').addEventListener('click', () => setRules($('#rules').hidden));
$('#rulesClose').addEventListener('click', () => setRules(false));
renderPayouts();

/* ---------- Wire up ---------- */
Leaderboard.mount('roulette', $('#payouts'));
Leaderboard.mount('roulette', $('#setupForm .lobby-exit'), { compact: true });   // top 5 on the setup screen
window.addEventListener('pagehide', () => { if (S) S.players.forEach((p, i) => Leaderboard.record('roulette', p, S.phase === 'bet' ? staked(i) : 0)); });
buildBoard();
buildChips();
resize();
window.addEventListener('resize', resize);
requestAnimationFrame(frame);

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
  else if (e.key === ' ' && S && (S.phase === 'bet' || S.phase === 'ready') && $('#setup').hidden && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault(); mainAction();
  }
});

/* ---------- Phone / app support ---------- */
// Pause automatically when the app is sent to the background (phone call, home button…)
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !paused) pauseGame(); });

// Offline support + installability (needs https or localhost)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; });
