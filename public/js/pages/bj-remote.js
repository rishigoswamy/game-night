const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = n => (n < 0 ? '-$' : '$') + money(Math.abs(n));
const short = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(Math.round(n * 100) / 100);
const CHIPS = [[5,'#6b7280'],[10,'#2563eb'],[25,'#16a34a'],[50,'#dc2626'],[100,'#111827'],[500,'#7c3aed']];
const chipColor = v => (CHIPS.find(c => c[0] === v) || [0, '#6b7280'])[1];
const STATUS = { bj: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust' };

// This phone's identity: keeps control of its players across reloads and reconnects
let DEVICE;
try { DEVICE = localStorage.getItem('gn-device'); } catch {}
if (!DEVICE) { DEVICE = 'd' + [...crypto.getRandomValues(new Uint8Array(8))].map(x => x.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('gn-device', DEVICE); } catch {} }
let token = null, code = null, es = null, ST = null, sel = null, closeAt = null, hostOnline = true, nextAt = null, myTurnKey = '';

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600);
}
function post(msg) {
  return fetch('/api/send', { method: 'POST', body: JSON.stringify({ t: code, from: DEVICE, token, msg }) })
    .then(r => r.ok ? null : r.json().then(j => toast(j.error || 'Could not reach the table.')))
    .catch(() => toast('Could not reach the table.'));
}

/* ---------- Find the one table (and go to the right page for its game) ---------- */
// Where each game is played on a phone
const PAGE_FOR = g => g === 'roulette' ? 'remote.html' : g === 'blackjack' ? 'bj-remote.html' : ['werewolf', 'catan', 'gofish', 'bluff'].includes(g) ? `party-remote.html?g=${g}` : `table-remote.html?g=${g}`;
let findTimer = null;
async function findTable() {
  clearTimeout(findTimer);
  try {
    const { tables } = await (await fetch('/api/tables')).json();
    if (tables[0] && tables[0].game !== 'blackjack') return location.replace(PAGE_FOR(tables[0].game));
    if (tables[0]) return tables[0].code === code && es ? null : connect(tables[0].code);
    $('#waitText').textContent = "The host computer isn't running a Casino-style game right now. This page joins the table automatically as soon as it is.";
  } catch { $('#waitText').textContent = "Can't reach the host computer. Make sure this phone is on the same Wi-Fi."; }
  showWaiting();
  findTimer = setTimeout(findTable, 3000);
}
function showWaiting() {
  es?.close(); es = null; code = null; ST = null;
  $('#tableView').hidden = true; $('#joinView').hidden = false; $('#offline').hidden = true;
  $('#where').textContent = 'Join the table';
}
function connect(c) {
  code = c;
  es?.close();
  es = new EventSource(`/api/stream?t=${c}&role=remote&device=${DEVICE}`);
  es.onopen = () => { $('#where').innerHTML = `<span class="conn"></span>Blackjack · table ${c}`; };
  es.onerror = () => {
    $('#where').innerHTML = `<span class="conn off"></span>Table ${c} · reconnecting…`;
    fetch('/api/tables').then(r => r.json()).then(({ tables }) => { if (!tables.some(t => t.code === c)) findTable(); }).catch(() => {});
  };
  es.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch {} };
  $('#joinView').hidden = true; $('#tableView').hidden = false;
}

/* ---------- Messages from the table ---------- */
function onMessage(m) {
  switch (m.type) {
    case 'session': token = m.token; post({ type: 'hello' }); break;
    case 'state':
      if (m.game !== 'blackjack') return location.replace(PAGE_FOR(m.game || 'roulette'));
      ST = m;
      closeAt = m.closesIn != null ? Date.now() + m.closesIn : null;
      if (m.phase === 'bet') nextAt = null;
      if (!mine().some(p => p.i === sel)) sel = mine()[0]?.i ?? null;
      followTurn();
      render();
      syncPause();
      break;
    case 'host':
      hostOnline = m.online;
      $('#offline').hidden = m.online;
      $('#offTitle').textContent = 'Table offline';
      $('#offText').textContent = 'The table screen has disconnected. Your players are kept; this reconnects automatically when it comes back.';
      break;
    case 'closed':
      if (m.replacedBy) { toast('The table moved to another screen. Add your players again there.'); connect(m.replacedBy); }
      else { toast('The table stopped sharing.'); findTable(); }
      break;
    case 'joined': sel = m.player; toast(`${m.name} joined the table.`); break;
    case 'queued': toast(`${m.name} will be seated when bets open.`); break;
    case 'error': toast(m.text); break;
    case 'say': say(m.text, m.pose); break;
    case 'next': nextAt = Date.now() + m.in * 1000; tick(); break;
    case 'turn': navigator.vibrate?.([80, 50, 80]); break;
    case 'result': showResult(m); break;
  }
}

/* ---------- Rendering ---------- */
const mine = () => ST ? ST.players.filter(p => p.owner === DEVICE && !p.cashedOut) : [];
const myTurn = () => ST && ST.turn && ST.players[ST.turn.p]?.owner === DEVICE;
function cardHTML(c) {
  if (c.down) return '<div class="card down"><div class="card-inner"><div class="face"></div><div class="back"></div></div></div>';
  const red = c.s === '♥' || c.s === '♦', pip = 'JQK'.includes(c.r) ? `<span class="court">${c.r}</span>` : c.s;
  return `<div class="card"><div class="card-inner"><div class="face${red ? ' red' : ''}"><span class="corner tl">${c.r}<br>${c.s}</span><span class="pip">${pip}</span><span class="corner br">${c.r}<br>${c.s}</span></div><div class="back"></div></div></div>`;
}
// On this phone's turn, switch to that player and bring the hand into view
function followTurn() {
  const key = ST.turn ? `${ST.round}:${ST.turn.p}:${ST.turn.h}` : '';
  if (myTurn() && key !== myTurnKey) {
    sel = ST.turn.p;
    setTimeout(() => $('#handsPanel').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }
  myTurnKey = key;
}
function phaseText() {
  if (!ST) return 'Connecting…';
  if (ST.paused) return '⏸ Paused by the table';
  if (ST.phase === 'bet') return closeAt ? 'Bets open' : 'Bets open · cards are dealt when the table is ready';
  if (ST.phase === 'deal') return 'Dealing…';
  if (ST.phase === 'play') return ST.turn ? `${ST.players[ST.turn.p].name}'s turn` : 'Playing…';
  if (ST.phase === 'dealer') return "Dealer's turn…";
  if (ST.phase === 'result') return 'Round over';
  return '';
}
function render() {
  if (!ST) return;
  $('#phase').textContent = phaseText();
  $('#roundNo').textContent = `Round ${ST.round}${ST.maxRounds ? ' of ' + ST.maxRounds : ''}`;
  const last = ST.history[0];
  $('#hist').innerHTML = last ? `<small class="muted">Dealer last</small><span class="${last === 'Bust' ? 'bg-red' : last === 'BJ' ? '' : 'bg-black'}" style="${last === 'BJ' ? 'background:var(--gold);color:#1d1500' : ''}">${last}</span>` : '';
  // dealer
  $('#dealerCards').innerHTML = ST.dealer.cards.map(cardHTML).join('');
  $('#dealerTotal').hidden = !ST.dealer.cards.length;
  $('#dealerTotal').textContent = ST.dealer.label;
  // everyone at the table
  $('#strip').innerHTML = ST.players.filter(p => !p.cashedOut && (p.inGame || p.hands.length)).map(p => {
    const now = ST.turn ? ST.turn.p === p.i : p.i === sel;
    return `<span class="pill${now ? ' now' : ''}${p.owner === DEVICE ? ' mine' : ''}" style="--pc:${p.color}"><span class="dot"></span>${esc(p.name)}${p.owner === DEVICE ? ' 📱' : ''}${p.status ? ` <span class="st">${esc(p.status)}</span>` : ''}</span>`;
  }).join('') || '<span class="muted">Nobody yet</span>';
  // this phone's players
  const my = mine(), canAdd = ST.seatsFree > 0;
  $('#tabs').innerHTML = my.map(p => `<button class="tab${p.i === sel ? ' sel' : ''}" type="button" data-i="${p.i}" style="--pc:${p.color}">
      <span class="nm">${esc(p.name)}</span><span class="bal">${fmt(p.bal)}</span></button>`).join('')
    + (canAdd ? `<button class="tab add" type="button" id="addTab">+ Add player</button>` : '');
  document.querySelectorAll('.tab[data-i]').forEach(t => t.addEventListener('click', () => { sel = +t.dataset.i; render(); }));
  $('#addTab')?.addEventListener('click', () => { $('#addForm').hidden = false; $('#nameIn').focus(); });
  if (!my.length && canAdd && $('#addForm').hidden) $('#addForm').hidden = false;
  if (!my.length && !canAdd) $('#tabs').innerHTML = '<p class="muted">The table is full (6 players). You can join when a seat frees up.</p>';
  $('#addCancel').hidden = !my.length;
  const p = ST.players.find(x => x.i === sel);
  $('#me').hidden = !p; $('#wlCard').hidden = !p;
  const betting = ST.phase === 'bet' && !ST.paused && hostOnline;
  if (p) {
    const net = p.bal + p.bet - p.start;
    $('#meBal').textContent = fmt(p.bal);
    $('#meSub').innerHTML = `Bet ${fmt(p.bet)} · overall <span class="${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}">${net >= 0 ? '+' : ''}${fmt(net)}</span>`;
    RouletteView.renderWinLoss($('#wlCard'), p.name, p.results || [], p.wlTotal || 0, fmt);
  }
  $('#cashBtn').disabled = !betting;
  // betting
  $('#betPanel').hidden = !p || ST.phase !== 'bet';
  if (p && ST.phase === 'bet') {
    $('#spot').innerHTML = p.bet ? p.betStack.slice(-6).map((v, k) => `<span class="disc" style="--cc:${chipColor(v)};--k:${k}"></span>`).join('') : '<span class="spot-label">BET</span>';
    $('#spotAmt').textContent = p.bet ? fmt(p.bet) : 'No bet yet';
    document.querySelectorAll('.chip').forEach(b => { b.disabled = !betting || p.bal <= 0; });
    $('#undoBtn').disabled = $('#clearBtn').disabled = !betting || !p.bet;
    $('#rebetBtn').disabled = !betting || !p.canRebet;
  }
  // hands
  const showHands = p && ST.phase !== 'bet';
  $('#handsPanel').hidden = !showHands;
  if (showHands) {
    $('#handsTitle').textContent = `${p.name}'s hands`;
    const turnHere = ST.turn && ST.turn.p === p.i;
    $('#hands').innerHTML = p.hands.length ? p.hands.map((h, k) => `<div class="hand${turnHere && ST.turn.h === k ? ' active' : ''}">
        <div class="cards">${h.cards.map(cardHTML).join('')}</div>
        <div class="hand-meta"><span class="total${h.total > 21 ? ' bust' : h.label === 'Blackjack' ? ' bj' : ''}">${h.label}</span>
          <span class="chip-mini" style="--pc:${p.color}">${short(h.bet)}</span>${h.doubled ? '<span class="badge">×2</span>' : ''}
          ${h.outcome ? `<span class="status ${h.outcome}">${STATUS[h.outcome]}${h.net ? ' ' + (h.net > 0 ? '+' : '') + fmt(h.net) : ''}</span>` : ''}</div></div>`).join('')
      : '<p class="muted">Sitting out this round.</p>';
    const go = myTurn() && turnHere && !ST.busy && !ST.paused;
    $('#acts').hidden = !(myTurn() && turnHere);
    $('#hitBtn').disabled = $('#standBtn').disabled = !go;
    $('#doubleBtn').disabled = !go || !ST.turn.canDouble;
    $('#splitBtn').disabled = !go || !ST.turn.canSplit;
    $('#actHint').textContent = myTurn() && turnHere ? (ST.turn.hint || '') : '';
    $('#turnNote').className = 'turn-note' + (turnHere && myTurn() ? ' mine' : '');
    $('#turnNote').textContent = turnHere && myTurn() ? 'Your turn: hit or stand?' : myTurn() ? `It's ${ST.players[ST.turn.p].name}'s turn (tap their tab)` : ST.turn ? `Waiting for ${ST.players[ST.turn.p].name}…` : '';
  }
  checkTableVersion();
  tick();
}
function tick() {
  if (ST && ST.phase === 'result' && nextAt && !ST.paused) {
    $('#phase').textContent = `Round over · next round in ${Math.max(0, Math.ceil((nextAt - Date.now()) / 1000))}s`;
  }
  const showBar = ST && (ST.phase === 'bet' || ST.phase === 'play') && closeAt && !ST.paused;
  $('#bar').hidden = !showBar;
  if (!showBar) return;
  const left = Math.max(0, closeAt - Date.now()), sec = Math.ceil(left / 1000), clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('#phase').textContent = ST.phase === 'bet' ? `Bets open · deal in ${clock}` : `${phaseText()} · ${clock}`;
  $('#barFill').style.width = (ST.windowLen ? left / (ST.windowLen * 1000) * 100 : 0) + '%';
  $('#bar').classList.toggle('low', left <= 10000);
}
setInterval(tick, 250);
function checkTableVersion() { $('#staleTable').hidden = !(ST && !('game' in ST)); }

/* ---------- Actions ---------- */
function act(type, extra = {}) {
  if (sel == null) return toast('Add a player first.');
  post({ type, player: sel, ...extra });
}
CHIPS.forEach(([v, c]) => {
  const b = document.createElement('button');
  b.className = 'chip'; b.type = 'button'; b.style.setProperty('--cc', c); b.textContent = v;
  b.addEventListener('click', () => act('bet', { amt: v }));
  $('#chips').appendChild(b);
});
$('#undoBtn').addEventListener('click', () => act('undo'));
$('#clearBtn').addEventListener('click', () => act('clear'));
$('#rebetBtn').addEventListener('click', () => act('rebet'));
['hit', 'stand', 'double', 'split'].forEach(k => $(`#${k}Btn`).addEventListener('click', () => act('act', { kind: k })));
$('#cashBtn').addEventListener('click', e => {
  const b = e.currentTarget, p = ST?.players.find(x => x.i === sel);
  if (!p) return;
  if (!b.dataset.armed) {
    b.dataset.armed = '1'; b.textContent = `Cash out ${fmt(p.bal + p.bet)}? Tap again`;
    setTimeout(() => { delete b.dataset.armed; b.textContent = 'Cash out'; }, 4000);
    return;
  }
  delete b.dataset.armed; b.textContent = 'Cash out';
  act('cashout');
});
$('#addForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#nameIn').value.trim();
  if (!name) return toast('Type a name first.');
  post({ type: 'join', name });
  $('#nameIn').value = ''; $('#addForm').hidden = true;
});
$('#addCancel').addEventListener('click', () => { $('#addForm').hidden = true; });

/* ---------- Results ---------- */
function showResult(m) {
  const lines = mine().map(p => p.i in m.nets ? { p, net: m.nets[p.i] } : null).filter(Boolean);
  if (lines.some(l => l.net > 0)) navigator.vibrate?.([80, 60, 80]);
  document.querySelectorAll('.banner').forEach(b => b.remove());
  const b = document.createElement('div');
  b.className = 'banner';
  b.innerHTML = `<div class="title">Dealer: ${esc(m.dealer)}</div><div class="lines">${lines.length
    ? lines.map(l => `<div>${esc(l.p.name)}: <span class="${l.net > 0 ? 'pos' : l.net < 0 ? 'neg' : ''}">${l.net > 0 ? '+' : ''}${fmt(l.net)}</span></div>`).join('')
    : '<div class="muted">No bets from this phone</div>'}</div>`;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 4300);
}

/* ---------- Dealer and voice ---------- */
const canSpeak = 'speechSynthesis' in window;
let voiceOn = true;
try { if (localStorage.getItem('gn-phone-voice') === 'off') voiceOn = false; } catch {}
let voice = null, sayToken = 0, serverVoice = false, voiceSrc = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /Daniel/.test(v.name) && v.lang.startsWith('en')) || vs.find(v => v.lang === 'en-GB') || vs.find(v => v.lang.startsWith('en')) || null;
}
if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
fetch('/api/info').then(r => r.json()).then(i => { serverVoice = !!i.tts; if (i.master === true) location.replace('blackjack.html'); }).catch(() => {});
const dealerEl = $('#dealer'), bubble = $('#bubble');
const sfx = createSfxPlayer(() => voiceOn);        // unlocks audio on the first tap; plays the dealer's clips
function setPose(pose, talking) {
  dealerEl.className = 'dealer'; void dealerEl.offsetWidth;
  dealerEl.className = 'dealer' + (pose ? ' ' + pose : '') + (talking ? ' talking' : '');
}
const clips = new Map();
function clip(text) {
  if (!clips.has(text)) {
    const job = fetch(`/api/tts?voice=Daniel&text=${encodeURIComponent(text)}`)
      .then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(data => sfx.context().decodeAudioData(data));
    job.catch(() => clips.delete(text));
    clips.set(text, job);
    if (clips.size > 80) clips.delete(clips.keys().next().value);
  }
  return clips.get(text);
}
// The table's dealer line: shown here and spoken in the table's own voice (rendered by the host computer)
// Browsers keep a freshly opened page silent until the first tap: hold the latest line and play it then
let heldLine = null;
['pointerup', 'touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, () => {
  if (!heldLine) return;
  const { text, pose, at } = heldLine; heldLine = null;
  if (Date.now() - at < 30000) setTimeout(() => say(text, pose), 60);   // after the tap has unlocked audio
}, true));
function say(text, pose) {
  const my = ++sayToken;
  bubble.textContent = text;
  bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
  setPose(pose, true);
  const done = () => { if (my === sayToken) dealerEl.classList.remove('talking'); };
  setTimeout(done, 700 + text.length * 60);
  if (!voiceOn || ST?.paused) return;
  const spoken = text.replace(/(\d+) \/ (\d+)/g, '$1 or $2');
  const browserSpeech = () => {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    if (voice) u.voice = voice;
    u.rate = 1.02; u.onend = done; speechSynthesis.speak(u);
  };
  const ac0 = sfx.context();
  if (!ac0 || ac0.state !== 'running') { heldLine = { text, pose, at: Date.now() }; return; }   // not allowed to play yet
  if (!serverVoice) return browserSpeech();
  clip(spoken).then(buf => {
    if (my !== sayToken) return;
    const ac = sfx.context(); if (!ac) return browserSpeech();
    try { voiceSrc?.stop(); } catch {}
    const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.onended = done;
    voiceSrc = src; src.start();
  }).catch(browserSpeech);
}
function renderVoiceBtn() {
  const b = $('#voiceBtn');
  b.textContent = voiceOn ? '🔊' : '🔈';
  b.setAttribute('aria-label', voiceOn ? 'Dealer voice: on' : 'Dealer voice: off'); b.title = b.getAttribute('aria-label');
  b.classList.toggle('voice-on', voiceOn);
}
$('#voiceBtn').addEventListener('click', () => {
  voiceOn = !voiceOn;
  if (!voiceOn) { if (canSpeak) speechSynthesis.cancel(); try { voiceSrc?.stop(); } catch {} }
  try { localStorage.setItem('gn-phone-voice', voiceOn ? 'on' : 'off'); } catch {}
  renderVoiceBtn();
});
renderVoiceBtn();
let wasPaused = false;
function syncPause() {
  const p = !!ST?.paused; if (p === wasPaused) return; wasPaused = p;
  if (canSpeak) p ? speechSynthesis.pause() : speechSynthesis.resume();
  sfx.hold(p);
}

/* ---------- Payout table, rules, tooltips, updates ---------- */
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
    <td class="num ex">${profit > 0 ? '+' : ''}${fmt(stake * profit)}</td><td class="num ex">${fmt(stake * ret)}</td><td class="ex sub">${often}</td></tr>`).join('');
}
$('#exStake').addEventListener('change', renderPayouts);
$('#exToggle').addEventListener('change', e => $('#payouts').classList.toggle('show-ex', e.target.checked));
renderPayouts();
const setRules = open => { $('#rules').hidden = !open; };
$('#rulesBtn').addEventListener('click', () => setRules($('#rules').hidden));
$('#rulesClose').addEventListener('click', () => setRules(false));
document.addEventListener('pointerdown', e => { if (!$('#rules').hidden && !e.target.closest('#rules, #rulesBtn')) setRules(false); });
const tip = $('#tip');
document.addEventListener('pointerover', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false;
  const half = tip.offsetWidth / 2 + 8;
  tip.style.left = Math.min(Math.max(e.clientX, half), innerWidth - half) + 'px'; tip.style.top = e.clientY + 'px';
});
// New game files → reload between hands (players are kept at the table)
let filesVer = null;
setInterval(async () => {
  try {
    const { version } = await (await fetch('/api/version', { cache: 'no-store' })).json();
    if (filesVer && version !== filesVer && !myTurn()) location.reload();
    filesVer ||= version;
  } catch {}
}, 10000);
fetch('/api/version', { cache: 'no-store' }).then(r => r.json()).then(v => { filesVer = v.version; }).catch(() => {});

findTable();
