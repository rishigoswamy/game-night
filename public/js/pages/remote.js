const $ = s => document.querySelector(s);
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const isZero = n => n === 0 || n === 37;
const colorOf = n => isZero(n) ? 'green' : RED.has(n) ? 'red' : 'black';
const lbl = n => n === 37 ? '00' : String(n);
const fmt = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const short = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(n);
const CHIPS = [[5,'#6b7280'],[10,'#2563eb'],[25,'#16a34a'],[50,'#dc2626'],[100,'#111827'],[500,'#7c3aed']];
const LABELS = { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1–18', high: '19–36', d1: '1st 12', d2: '2nd 12', d3: '3rd 12', c1: '2 to 1', c2: '2 to 1', c3: '2 to 1' };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// This phone's identity: keeps control of its players across reloads and reconnects
let DEVICE;
try { DEVICE = localStorage.getItem('gn-device'); } catch {}
if (!DEVICE) { DEVICE = 'd' + [...crypto.getRandomValues(new Uint8Array(8))].map(x => x.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('gn-device', DEVICE); } catch {} }

let token = null;          // proves to the server that actions really come from this phone
let code = null, es = null, ST = null, sel = null, chip = 25, closeAt = null, hostOnline = true, waitingToJoin = 0;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600);
}
function post(msg) {
  return fetch('/api/send', { method: 'POST', body: JSON.stringify({ t: code, from: DEVICE, token, msg }) })
    .then(r => r.ok ? null : r.json().then(j => toast(j.error || 'Could not reach the table.')))
    .catch(() => toast('Could not reach the table.'));
}

/* ---------- Find the table ---------- */
// There is only ever one shared table: join it as soon as it exists, and follow it if another screen takes over.
// Where each game is played on a phone
const PAGE_FOR = g => g === 'roulette' ? 'remote.html' : g === 'blackjack' ? 'bj-remote.html' : ['werewolf', 'catan', 'gofish', 'bluff', 'tambola', 'mafia', 'business'].includes(g) ? `party-remote.html?g=${g}` : `table-remote.html?g=${g}`;
let findTimer = null;
async function findTable() {
  clearTimeout(findTimer);
  try {
    const { tables } = await (await fetch('/api/tables')).json();
    if (tables[0] && tables[0].game !== 'roulette') return location.replace(PAGE_FOR(tables[0].game));
    if (tables[0]) return tables[0].code === code && es ? null : connect(tables[0].code);
    $('#waitText').textContent = "The host computer isn't running a Casino-style Roulette game right now. This page joins the table automatically as soon as it is.";
  } catch {
    $('#waitText').textContent = "Can't reach the host computer. Make sure this phone is on the same Wi-Fi.";
  }
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
  history.replaceState(null, '', `?t=${c}`);
  es?.close();
  es = new EventSource(`/api/stream?t=${c}&role=remote&device=${DEVICE}`);
  es.onopen = () => { $('#where').innerHTML = `<span class="conn"></span>Table ${c}`; };
  es.onerror = () => {
    $('#where').innerHTML = `<span class="conn off"></span>Table ${c} · reconnecting…`;
    // the table may have been replaced or closed while we were away
    fetch('/api/tables').then(r => r.json()).then(({ tables }) => { if (!tables.some(t => t.code === c)) findTable(); }).catch(() => {});
  };
  es.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch {} };
  $('#joinView').hidden = true;
  $('#tableView').hidden = false;
}
/* ---------- Messages from the table ---------- */
function onMessage(m) {
  switch (m.type) {
    case 'session': token = m.token; post({ type: 'hello' }); break;   // a fresh key each time the stream (re)connects
    case 'state':
      if (m.game && m.game !== 'roulette') return location.replace(PAGE_FOR(m.game));
      ST = m;
      closeAt = m.closesIn != null ? Date.now() + m.closesIn : null;
      if (!mine().some(p => p.i === sel)) sel = mine()[0]?.i ?? null;
      render();
      syncView();
      syncPause();
      checkTableVersion();
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
    case 'joined': sel = m.player; waitingToJoin = Math.max(0, waitingToJoin - 1); toast(`${m.name} joined the table.`); break;
    case 'queued': toast(`${m.name} will be seated when bets open.`); break;
    case 'error': toast(m.text); waitingToJoin = 0; break;
    case 'spin': startSpin(m.n); break;
    case 'say': say(m.text, m.pose); break;
    case 'next': nextAt = Date.now() + m.in * 1000; tick(); break;
    case 'sfx': if (SFX[m.kind]) sfx.play(...SFX[m.kind]); break;
    case 'result': if (!wheel.spinning) wheelCaption('', m.n); afterLanding(() => showResult(m)); break;
    case 'fx': afterLanding(() => showFx(m)); break;
  }
}

/* ---------- Rendering ---------- */
const mine = () => ST ? ST.players.filter(p => p.owner === DEVICE && !p.cashedOut) : [];
const cells = {};
function buildBoard() {
  const board = $('#board');
  const add = (key, label, cls, style) => {
    const d = document.createElement('div');
    d.className = 'cell ' + cls; d.style.cssText = style; d.dataset.key = key;
    d.innerHTML = `<span>${label}</span><div class="stacks"></div>`;
    d.addEventListener('click', () => bet(key));
    d.addEventListener('contextmenu', e => { e.preventDefault(); act('remove', { key }); });
    board.appendChild(d); cells[key] = d;
  };
  add('n0', '0', 'bg-green', 'grid-row:1/4;grid-column:1');
  add('n37', '00', 'bg-green', 'grid-row:4/7;grid-column:1');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) {
    const n = 3 * (c + 1) - r;
    add('n' + n, n, 'bg-' + colorOf(n), `grid-row:${r * 2 + 1}/span 2;grid-column:${c + 2}`);
  }
  add('c3', LABELS.c3, 'outside', 'grid-row:1/span 2;grid-column:14');
  add('c2', LABELS.c2, 'outside', 'grid-row:3/span 2;grid-column:14');
  add('c1', LABELS.c1, 'outside', 'grid-row:5/span 2;grid-column:14');
  ['d1', 'd2', 'd3'].forEach((k, i) => add(k, LABELS[k], 'outside', `grid-row:7;grid-column:${2 + i * 4}/span 4`));
  ['low', 'even', 'red', 'black', 'odd', 'high'].forEach((k, i) =>
    add(k, LABELS[k], k === 'red' ? 'bg-red' : k === 'black' ? 'bg-black' : 'outside', `grid-row:8;grid-column:${2 + i * 2}/span 2`));
}
function buildChips() {
  CHIPS.forEach(([v, c]) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.style.setProperty('--cc', c); b.textContent = v; b.dataset.v = v;
    b.addEventListener('click', () => { chip = v; renderChips(); });
    $('#chips').appendChild(b);
  });
}
const renderChips = () => document.querySelectorAll('.chip').forEach(b => b.classList.toggle('sel', +b.dataset.v === chip));

function phaseText() {
  if (!ST) return 'Connecting…';
  if (ST.paused) return '⏸ Paused by the table';
  if (ST.phase === 'bet') return closeAt ? 'Bets open' : 'Bets open · the table spins when ready';
  if (ST.phase === 'ready') return 'All bets are in';
  if (ST.phase === 'spinning') return 'No more bets · wheel spinning…';
  if (ST.phase === 'result') return ST.lastResult != null ? `Result: ${lbl(ST.lastResult)} ${colorOf(ST.lastResult)}` : 'Paying out…';
  return '';
}
let nextAt = null;            // when the table's result window moves on to the next round
function render() {
  if (!ST) return;
  if (ST.phase === 'bet') nextAt = null;
  $('#phase').textContent = phaseText();
  $('#roundNo').textContent = `Round ${ST.round}${ST.maxRounds ? ' of ' + ST.maxRounds : ''}`;
  const last = ST.history[0];
  $('#hist').innerHTML = last != null ? `<small class="muted">Last</small><span class="bg-${colorOf(last)}">${lbl(last)}</span>` : '';
  // tabs for this phone's players
  const my = mine(), canAdd = ST.seatsFree > 0;
  $('#tabs').innerHTML = my.map(p => `<button class="tab${p.i === sel ? ' sel' : ''}" type="button" data-i="${p.i}" style="--pc:${p.color}">
      <span class="nm">${esc(p.name)}</span><span class="bal">${fmt(p.bal)}</span></button>`).join('')
    + (canAdd ? `<button class="tab add" type="button" id="addTab">+ Add player</button>` : '');
  document.querySelectorAll('.tab[data-i]').forEach(t => t.addEventListener('click', () => { sel = +t.dataset.i; render(); }));
  $('#addTab')?.addEventListener('click', () => { $('#addForm').hidden = false; $('#nameIn').focus(); });
  if (!my.length && canAdd && $('#addForm').hidden) $('#addForm').hidden = false;
  if (!my.length && !canAdd) $('#tabs').innerHTML = '<p class="muted">The table is full (6 players). You can join when a seat frees up.</p>';
  $('#addCancel').hidden = !my.length;
  // selected player
  const p = ST.players.find(x => x.i === sel);
  $('#me').hidden = !p;
  $('#betPanel').hidden = !p;
  $('#wlCard').hidden = !p;
  if (p) RV.renderWinLoss($('#wlCard'), p.name, p.results || [], p.wlTotal || 0, fmt);
  if (p) {
    const net = p.bal + p.onTable - p.start;
    $('#meBal').textContent = fmt(p.bal);
    $('#meSub').innerHTML = `On table ${fmt(p.onTable)} · overall <span class="${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}">${net >= 0 ? '+' : ''}${fmt(net)}</span>`;
  }
  const open = ST.phase === 'bet' && !ST.paused && hostOnline;
  $('#board').classList.toggle('locked', !open);
  $('#cashBtn').disabled = !open;
  $('#undoBtn').disabled = $('#clearBtn').disabled = !open || !p || !p.onTable;
  $('#rebetBtn').disabled = !open || !p || !p.canRebet;
  // everyone's chips on the board; this phone's selected player's are outlined
  for (const [key, el] of Object.entries(cells)) {
    const tot = {};
    ST.bets.forEach(b => { if (b.key === key) tot[b.p] = (tot[b.p] || 0) + b.amt; });
    const entries = Object.entries(tot);
    el.querySelector('.stacks').innerHTML = entries.slice(0, 3).map(([i, t]) => {
      const pl = ST.players[+i];
      return `<span class="chip-mini${+i === sel ? ' mine' : ''}" style="--pc:${pl ? pl.color : '#888'}">${short(t)}</span>`;
    }).join('') + (entries.length > 3 ? `<span class="chip-mini" style="--pc:#555">+${entries.length - 3}</span>` : '');
    el.classList.toggle('win', ST.phase === 'result' && ST.lastResult != null && wins(key, ST.lastResult));
  }
  tick();
}
function wins(key, n) {
  if (key[0] === 'n') return +key.slice(1) === n;
  if (isZero(n)) return false;
  return { red: RED.has(n), black: !RED.has(n), odd: n % 2 === 1, even: n % 2 === 0, low: n <= 18, high: n >= 19,
    d1: n <= 12, d2: n > 12 && n <= 24, d3: n > 24, c1: n % 3 === 1, c2: n % 3 === 2, c3: n % 3 === 0 }[key];
}
// Betting-window countdown
function tick() {
  if (ST && ST.phase === 'result' && nextAt && !ST.paused) {
    const sec = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
    $('#phase').textContent = `${phaseText()} · next round in ${sec}s`;
  }
  const showBar = ST && ST.phase === 'bet' && closeAt && !ST.paused;
  $('#bar').hidden = !showBar;
  if (!showBar) return;
  const left = Math.max(0, closeAt - Date.now()), sec = Math.ceil(left / 1000);
  $('#phase').textContent = `Bets open · closes in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('#barFill').style.width = (ST.windowLen ? left / (ST.windowLen * 1000) * 100 : 0) + '%';
  $('#bar').classList.toggle('low', left <= 10000);
}
setInterval(tick, 250);

/* ---------- Actions ---------- */
function act(type, extra = {}) {
  if (sel == null) return toast('Add a player first.');
  post({ type, player: sel, ...extra });
}
function bet(key) {
  if (!ST || ST.phase !== 'bet' || ST.paused) return toast('Bets are closed right now.');
  act('bet', { key, amt: chip });
}
// Long-press on a space (phones don't right-click) removes your bets from it
let pressTimer = null;
$('#board').addEventListener('touchstart', e => {
  const cell = e.target.closest('.cell'); if (!cell) return;
  pressTimer = setTimeout(() => { pressTimer = 'fired'; act('remove', { key: cell.dataset.key }); navigator.vibrate?.(30); }, 550);
}, { passive: true });
$('#board').addEventListener('touchend', e => { if (pressTimer === 'fired') e.preventDefault(); clearTimeout(pressTimer); pressTimer = null; });
$('#board').addEventListener('touchmove', () => { clearTimeout(pressTimer); pressTimer = null; }, { passive: true });

$('#undoBtn').addEventListener('click', () => act('undo'));
$('#clearBtn').addEventListener('click', () => act('clear'));
$('#rebetBtn').addEventListener('click', () => act('rebet'));
$('#cashBtn').addEventListener('click', e => {
  const b = e.currentTarget, p = ST?.players.find(x => x.i === sel);
  if (!p) return;
  if (!b.dataset.armed) {
    b.dataset.armed = '1'; b.textContent = `Cash out ${fmt(p.bal + p.onTable)}? Tap again`;
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
  waitingToJoin++;
  $('#nameIn').value = '';
  $('#addForm').hidden = true;
});
$('#addCancel').addEventListener('click', () => { $('#addForm').hidden = true; });

/* ---------- Results and celebrations ---------- */
function banner(cls, html) {
  document.querySelectorAll('.banner').forEach(b => b.remove());
  const b = document.createElement('div');
  b.className = 'banner ' + cls; b.innerHTML = html;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 4300);
}
function showResult(m) {
  const lines = mine().map(p => p.i in m.nets ? { p, net: m.nets[p.i] } : null).filter(Boolean);
  if (lines.some(l => l.net > 0)) navigator.vibrate?.([80, 60, 80]);
  if (isZero(m.n)) return;                         // the 0/00 banner below covers it
  banner('', `<div class="num bg-${m.color}">${lbl(m.n)}</div><div class="title">${lbl(m.n)} ${m.color.toUpperCase()}</div>
    <div class="lines">${lines.length ? lines.map(l => `<div>${esc(l.p.name)}: <span class="${l.net > 0 ? 'pos' : l.net < 0 ? 'neg' : ''}">${l.net > 0 ? '+' : ''}${fmt(l.net)}</span></div>`).join('') : '<div class="muted">No bets from this phone</div>'}</div>`);
}
function showFx(m) {
  if (m.kind === 'zero') banner('zero', `<div class="num bg-green">${lbl(m.n)}</div><div class="title">${m.n === 37 ? 'DOUBLE ZERO' : 'ZERO'}</div><div class="lines muted">Outside bets lose</div>`);
  if (m.kind === 'hot') banner('hot', `<div class="num bg-${colorOf(m.n)}">${lbl(m.n)}</div><div class="title">🔥 HOT NUMBER</div><div class="lines">${m.count}× in the recent spins</div>`);
  if (m.kind === 'big') {
    navigator.vibrate?.([120, 60, 120, 60, 200]);
    banner('big', `<div class="title">BIG WIN!</div><div class="lines">${m.winners.map(w => `<div>${esc(w.name)} <span class="pos">+${fmt(w.net)}</span></div>`).join('')}</div>`);
  }
}

/* ---------- Table view: wheel, recent numbers, payouts, rules ---------- */
const RV = RouletteView;
const wheel = RV.createWheel($('#wheel'));
let prevPhase = null, recentKey = '';
// The spin: bring the wheel into view, let the ball land, and hold the landed number for 3 s before any banner
const HOLD_MS = 3000;
let landedAt = 0;
function startSpin(n) {
  landedAt = 0;
  $('.wheel-panel').classList.remove('landed');
  wheelCaption('No more bets…');
  const r = $('#wheel').getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) $('.wheel-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  wheel.spinTo(n, () => {
    landedAt = Date.now();
    wheelCaption('', n);
    $('.wheel-panel').classList.add('landed');
    setTimeout(() => $('.wheel-panel').classList.remove('landed'), HOLD_MS + 1500);
  });
}
// Runs fn once the ball has landed here and the number has been on show for HOLD_MS
function afterLanding(fn) {
  const wait = () => wheel.spinning ? setTimeout(wait, 100) : setTimeout(fn, Math.max(0, landedAt + HOLD_MS - Date.now()));
  wait();
}
function wheelCaption(text, n) {
  $('#wheelCap').innerHTML = n != null ? `<span class="num bg-${colorOf(n)}">${lbl(n)}</span>${colorOf(n)[0].toUpperCase() + colorOf(n).slice(1)}` : text;
}
// Keep the wheel, caption and chart in step with the table's state
function syncView() {
  wheel.setPaused(!!ST.paused);
  if (ST.phase === 'bet' && prevPhase !== 'bet') { wheel.release(); wheelCaption('Place your bets'); }
  if (ST.phase === 'result' && ST.lastResult != null && !wheel.spinning && !landedAt) { wheel.settle(ST.lastResult); wheelCaption('', ST.lastResult); }
  if (ST.phase === 'spinning' && !wheel.spinning) wheelCaption('No more bets…');
  prevPhase = ST.phase;
  const key = (ST.recent || []).join(',');
  if (key !== recentKey) { recentKey = key; drawRecent(); }
}
const drawRecent = () => RV.renderRecent({ box: $('#spinChart'), stats: $('#spinStats'), sub: $('#spinSub'), hint: $('#spinHint') }, ST?.recent || []);
let resizeT = null;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => ST && drawRecent(), 150); });
const renderPayouts = () => RV.renderPayouts($('#payoutRows'), +$('#exStake').value, fmt);
$('#exStake').addEventListener('change', renderPayouts);
$('#exToggle').addEventListener('change', e => $('#payouts').classList.toggle('show-ex', e.target.checked));
renderPayouts();
// Rules window
const setRules = open => { $('#rules').hidden = !open; };
$('#rulesBtn').addEventListener('click', () => setRules($('#rules').hidden));
$('#rulesClose').addEventListener('click', () => setRules(false));
document.addEventListener('pointerdown', e => { if (!$('#rules').hidden && !e.target.closest('#rules, #rulesBtn')) setRules(false); });
// Tap/hover a dot in Recent Numbers for its details
const tip = $('#tip');
document.addEventListener('pointerover', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false;
  const half = tip.offsetWidth / 2 + 8;
  tip.style.left = Math.min(Math.max(e.clientX, half), innerWidth - half) + 'px'; tip.style.top = e.clientY + 'px';
});
window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

/* ---------- Dealer, voice and crowd sounds (in step with the table) ---------- */
const canSpeak = 'speechSynthesis' in window;
let voiceOn = true;               // on by default; each guest can switch their phone's voice off
try { if (localStorage.getItem('gn-phone-voice') === 'off') voiceOn = false; } catch {}
let voice = null, sayToken = 0;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /Daniel/.test(v.name) && v.lang.startsWith('en')) || vs.find(v => v.lang === 'en-GB') || vs.find(v => v.lang.startsWith('en')) || null;
}
if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
const dealerEl = $('#dealer'), bubble = $('#bubble');
function setPose(pose, talking) {
  dealerEl.className = 'dealer'; void dealerEl.offsetWidth;
  dealerEl.className = 'dealer' + (pose ? ' ' + pose : '') + (talking ? ' talking' : '');
}
// The table's dealer line, shown here and spoken (if switched on) in the table's own voice: the host computer
// renders it (/api/tts) and the phone plays the clip through Web Audio, which taps have already unlocked.
// Phone browsers often refuse built-in speech that isn't started by a tap, so that's only the fallback.
let serverVoice = false, voiceSrc = null;
fetch('/api/info').then(r => r.json()).then(i => { serverVoice = !!i.tts; }).catch(() => {});
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
  const browserSpeech = () => {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.02; u.onend = done;
    speechSynthesis.speak(u);
  };
  const ac0 = sfx.context();
  if (!ac0 || ac0.state !== 'running') { heldLine = { text, pose, at: Date.now() }; return; }   // not allowed to play yet
  if (!serverVoice) return browserSpeech();
  clip(text).then(buf => {
    if (my !== sayToken) return;                  // a newer line already started
    const ac = sfx.context();
    if (!ac) return browserSpeech();
    try { voiceSrc?.stop(); } catch {}
    const src = ac.createBufferSource();
    src.buffer = buf; src.connect(ac.destination); src.onended = done;
    voiceSrc = src; src.start();
  }).catch(browserSpeech);
}
const sfx = createSfxPlayer(() => voiceOn);
const SFX = { groan: [buildGroan, 4.8], cheer: [buildCheer, 6], hurray: [buildHurray, 7] };
function renderVoiceBtn() {
  const b = $('#voiceBtn');
  b.textContent = voiceOn ? '🔊' : '🔈';
  b.setAttribute('aria-label', voiceOn ? 'Dealer voice and crowd sounds: on' : 'Dealer voice and crowd sounds: off');
  b.title = b.getAttribute('aria-label');
  b.classList.toggle('voice-on', voiceOn);
}
$('#voiceBtn').addEventListener('click', () => {
  voiceOn = !voiceOn;
  if (!voiceOn) { if (canSpeak) speechSynthesis.cancel(); try { voiceSrc?.stop(); } catch {} sfx.stop(); }
  try { localStorage.setItem('gn-phone-voice', voiceOn ? 'on' : 'off'); } catch {}
  renderVoiceBtn();
  toast(voiceOn ? 'You\'ll hear the dealer and the crowd on this phone.' : 'Dealer voice and crowd sounds off on this phone.');
});
renderVoiceBtn();
let wasPaused = false;
function syncPause() {
  const p = !!ST?.paused;
  if (p === wasPaused) return;
  wasPaused = p;
  if (canSpeak) p ? speechSynthesis.pause() : speechSynthesis.resume();
  sfx.hold(p);
}

/* ---------- Staying up to date ---------- */
// New game files → this page reloads itself between spins (your players are kept at the table)
let filesVer = null;
setInterval(async () => {
  try {
    const { version } = await (await fetch('/api/version', { cache: 'no-store' })).json();
    if (filesVer && version !== filesVer && !wheel.spinning) location.reload();
    filesVer ||= version;
  } catch {}
}, 10000);
fetch('/api/version', { cache: 'no-store' }).then(r => r.json()).then(v => { filesVer = v.version; }).catch(() => {});
// The table screen itself must be current too: an old one doesn't send the wheel spin or Recent Numbers
function checkTableVersion() {
  const old = ST && !('recent' in ST);
  $('#staleTable').hidden = !old;
}

/* ---------- Start ---------- */
buildBoard();
buildChips();
renderChips();
// On the host computer itself, this isn't the place to be: go to the master table
fetch('/api/info').then(r => r.json()).then(info => { if (info.master === true) location.replace('roulette.html'); }).catch(() => {});
findTable();                                         // always the current table, never a remembered old one
