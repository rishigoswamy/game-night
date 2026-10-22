const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = n => (n < 0 ? '-$' : '$') + money(Math.abs(n));
const short = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(Math.round(n * 100) / 100);
const CHIPS = [[5,'#6b7280'],[10,'#2563eb'],[25,'#16a34a'],[50,'#dc2626'],[100,'#111827'],[500,'#7c3aed']];
// Where each game is played on a phone
const PAGE_FOR = g => g === 'roulette' ? 'remote.html' : g === 'blackjack' ? 'bj-remote.html' : ['werewolf', 'catan', 'gofish', 'bluff', 'tambola'].includes(g) ? `party-remote.html?g=${g}` : `table-remote.html?g=${g}`;
const G = window.GAME && GAME.id === GAME_ID ? GAME : null;

let DEVICE;
try { DEVICE = localStorage.getItem('gn-device'); } catch {}
if (!DEVICE) { DEVICE = 'd' + [...crypto.getRandomValues(new Uint8Array(8))].map(x => x.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('gn-device', DEVICE); } catch {} }
let token = null, code = null, es = null, ST = null, sel = null, closeAt = null, hostOnline = true, nextAt = null, chip = 25;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600);
}
function post(msg) {
  return fetch('/api/send', { method: 'POST', body: JSON.stringify({ t: code, from: DEVICE, token, msg }) })
    .then(r => r.ok ? null : r.json().then(j => toast(j.error || 'Could not reach the table.')))
    .catch(() => toast('Could not reach the table.'));
}
// Go to the page for the game the table is running (this page reloads itself with the right game)
function follow(game) {
  if (game === GAME_ID && G) return false;
  location.replace(PAGE_FOR(game));
  return true;
}

/* ---------- Find the one table ---------- */
let findTimer = null;
async function findTable() {
  clearTimeout(findTimer);
  try {
    const { tables } = await (await fetch('/api/tables')).json();
    if (tables[0] && follow(tables[0].game)) return;
    if (tables[0]) return tables[0].code === code && es ? null : connect(tables[0].code);
    $('#waitText').textContent = "The host computer isn't running a game right now. This page joins the table automatically as soon as it is.";
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
  es.onopen = () => { $('#where').innerHTML = `<span class="conn"></span>${esc(G.name)} · table ${c}`; };
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
      if (follow(m.game || 'roulette')) return;
      ST = m;
      closeAt = m.closesIn != null ? Date.now() + m.closesIn : null;
      if (m.phase === 'bet') nextAt = null;
      if (!mine().some(p => p.i === sel)) sel = mine()[0]?.i ?? null;
      render();
      syncPause();
      break;
    case 'stage': if (ST) { ST.stage = m.stage; renderStage(); } break;
    case 'host':
      hostOnline = m.online;
      $('#offline').hidden = m.online;
      break;
    case 'closed':
      if (m.replacedBy) { toast('The table moved to another screen. Add your players again there.'); connect(m.replacedBy); }
      else { toast('The table stopped sharing.'); findTable(); }
      break;
    case 'joined': sel = m.player; toast(`${m.name} joined the table.`); break;
    case 'queued': toast(`${m.name} will be seated when bets open.`); break;
    case 'error': toast(m.text); break;
    case 'say': say(m.text, m.pose); break;
    case 'sfx': if (SFX[m.kind]) sfx.play(...SFX[m.kind]); break;
    case 'next': nextAt = Date.now() + m.in * 1000; tick(); break;
    case 'result': showResult(m); break;
    case 'fx':
      if (m.kind === 'special') banner('special', `<div class="title">${esc(m.label)}</div><div class="lines"><div style="font-size:2rem">${esc(m.big)}</div><div class="muted">${esc(m.sub || '')}</div></div>`);
      if (m.kind === 'big') {
        navigator.vibrate?.([120, 60, 120, 60, 200]);
        setTimeout(() => banner('big', `<div class="title">BIG WIN!</div><div class="lines">${m.winners.map(w => `<div>${esc(w.name)} <span class="pos">+${fmt(w.net)}</span></div>`).join('')}</div>`), 600);
      }
      break;
  }
}

/* ---------- Rendering ---------- */
const mine = () => ST ? ST.players.filter(p => p.owner === DEVICE && !p.cashedOut) : [];
function cardHTML(c) {
  const red = c.s === '♥' || c.s === '♦', pip = 'JQK'.includes(c.r) ? `<span class="court">${c.r}</span>` : c.s;
  return `<div class="pcard"><div class="face${red ? ' red' : ''}"><span class="corner tl">${c.r}<br>${c.s}</span><span class="pip">${pip}</span><span class="corner br">${c.r}<br>${c.s}</span></div></div>`;
}
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function dieHTML(v, k = 0) {
  if (!v) return `<div class="die blank" style="--k:${k}">?</div>`;
  return `<div class="die v${v}" style="--k:${k}">${[...Array(9)].map((_, i) => `<i${PIPS[v].includes(i) ? ' class="on"' : ''}></i>`).join('')}</div>`;
}
let shownCards = 0;
function renderStage() {
  $('#stage').innerHTML = G.stageHTML(ST?.stage || G.idleStage(), { card: cardHTML, die: dieHTML });
  const cards = [...$('#stage').querySelectorAll('.pcard')];
  if (cards.length < shownCards) shownCards = 0;
  cards.slice(shownCards).forEach(el => el.animate([{ transform: 'translate(90px, -60px) rotate(14deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' }));
  shownCards = cards.length;
}
function phaseText() {
  if (!ST) return 'Connecting…';
  if (ST.paused) return '⏸ Paused by the table';
  if (ST.phase === 'bet') return closeAt ? 'Bets open' : 'Bets open · the round starts when the table is ready';
  if (ST.phase === 'play') return G.verb === 'roll' ? 'Rolling the dice…' : 'Dealing…';
  return 'Round over';
}
function render() {
  if (!ST) return;
  $('#phase').textContent = phaseText();
  $('#roundNo').textContent = `Round ${ST.round}${ST.maxRounds ? ' of ' + ST.maxRounds : ''}`;
  const last = ST.history[0];
  $('#hist').innerHTML = last ? `<small class="muted">Last</small><span class="tok ${last.cls}">${esc(last.text)}</span>` : '';
  renderStage();
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
    const net = p.bal + p.onTable - p.start;
    $('#meBal').textContent = fmt(p.bal);
    $('#meSub').innerHTML = `On table ${fmt(p.onTable)} · overall <span class="${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}">${net >= 0 ? '+' : ''}${fmt(net)}</span>`;
    RouletteView.renderWinLoss($('#wlCard'), p.name, p.results || [], p.wlTotal || 0, fmt);
  }
  $('#cashBtn').disabled = !betting;
  // everyone's chips on the board; this phone's selected player's are outlined
  for (const [key, el] of Object.entries(cells)) {
    const tot = {};
    ST.bets.forEach(b => { if (b.key === key) tot[b.p] = (tot[b.p] || 0) + b.amt; });
    el.querySelector('.stacks').innerHTML = Object.entries(tot).map(([i, t]) => {
      const pl = ST.players[+i];
      return `<span class="chip-mini${+i === sel ? ' mine' : ''}" style="--pc:${pl ? pl.color : '#888'}">${short(t)}</span>`;
    }).join('');
    el.classList.toggle('win', (ST.winKeys || []).includes(key));
  }
  $('#board').classList.toggle('locked', !betting || !p);
  document.querySelectorAll('.chip').forEach(b => { b.disabled = !betting || !p || p.bal <= 0; b.classList.toggle('sel', +b.dataset.v === chip); });
  const has = p && ST.bets.some(b => b.p === p.i);
  $('#undoBtn').disabled = $('#clearBtn').disabled = !betting || !has;
  $('#rebetBtn').disabled = !betting || !p || !p.canRebet;
  renderLog();
  tick();
}
function renderLog() {
  const log = ST.log || [], counts = {};
  log.forEach(t => { (counts[t.group] ||= { n: 0, cls: t.cls }).n++; });
  $('#logStats').innerHTML = Object.entries(counts).map(([g, c]) => `<span><span class="tok ${c.cls}"></span>${esc(g)} ${c.n}</span>`).join('');
  $('#beads').innerHTML = log.length
    ? log.map((t, k) => `<span class="tok ${t.cls}${k === log.length - 1 ? ' latest' : ''}" data-tip="${esc(t.tip || t.text)}">${esc(t.text)}</span>`).join('')
    : '<div class="log-empty">Results will appear here, oldest to newest.</div>';
}
function tick() {
  if (ST && ST.phase === 'result' && nextAt && !ST.paused) $('#phase').textContent = `Round over · next round in ${Math.max(0, Math.ceil((nextAt - Date.now()) / 1000))}s`;
  const showBar = ST && ST.phase === 'bet' && closeAt && !ST.paused;
  $('#bar').hidden = !showBar;
  if (!showBar) return;
  const left = Math.max(0, closeAt - Date.now()), sec = Math.ceil(left / 1000);
  $('#phase').textContent = `Bets open · closes in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('#barFill').style.width = (ST.windowLen ? left / (ST.windowLen * 1000) * 100 : 0) + '%';
  $('#bar').classList.toggle('low', left <= 10000);
}
setInterval(tick, 250);

/* ---------- Board and actions ---------- */
const cells = {};
function buildBoard() {
  const rows = [];
  G.bets.forEach(b => (rows[b.row] ||= []).push(b));
  rows.forEach((list, r) => {
    const row = document.createElement('div');
    row.className = 'brow';
    row.style.setProperty('--rh', G.rowHeights?.[r] || '56px');
    list.forEach(b => {
      const d = document.createElement('button');
      d.type = 'button'; d.className = 'b-cell ' + (b.cls || 'b-dark'); d.dataset.key = b.key;
      d.style.setProperty('--span', b.span || 1);
      d.innerHTML = `<span class="lbl">${b.label}</span><span class="sub">${b.sub || ''}</span><div class="stacks"></div>`;
      // tap = bet the selected chip; long-press (or right-click) = take this player's chips back off the space
      let pressT = null, longPressed = false;
      d.addEventListener('pointerdown', () => { longPressed = false; clearTimeout(pressT); pressT = setTimeout(() => { longPressed = true; act('remove', { key: b.key }); navigator.vibrate?.(30); }, 550); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => d.addEventListener(t, () => clearTimeout(pressT)));
      d.addEventListener('click', () => { if (!longPressed) act('bet', { key: b.key, amt: chip }); });
      d.addEventListener('contextmenu', e => e.preventDefault());
      row.appendChild(d);
      cells[b.key] = d;
    });
    $('#board').appendChild(row);
  });
}
function act(type, extra = {}) {
  if (sel == null) return toast('Add a player first.');
  post({ type, player: sel, ...extra });
}
CHIPS.forEach(([v, c]) => {
  const b = document.createElement('button');
  b.className = 'chip'; b.type = 'button'; b.style.setProperty('--cc', c); b.textContent = v; b.dataset.v = v;
  b.addEventListener('click', () => { chip = v; document.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', +x.dataset.v === chip)); });
  $('#chips').appendChild(b);
});
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
  $('#nameIn').value = ''; $('#addForm').hidden = true;
});
$('#addCancel').addEventListener('click', () => { $('#addForm').hidden = true; });

/* ---------- Results ---------- */
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
  // after the dealer's call, so the cards / dice stay on show first
  setTimeout(() => banner('', `<span class="tok ${m.token.cls}">${esc(m.token.text)}</span><div class="title" style="font-size:1.15rem">${esc(m.text)}</div>
    <div class="lines">${lines.length ? lines.map(l => `<div>${esc(l.p.name)}: <span class="${l.net > 0 ? 'pos' : l.net < 0 ? 'neg' : ''}">${l.net > 0 ? '+' : ''}${fmt(l.net)}</span></div>`).join('') : '<div class="muted">No bets from this phone</div>'}</div>`), 1800);
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
fetch('/api/info').then(r => r.json()).then(i => { serverVoice = !!i.tts; if (i.master === true) location.replace(`table.html?g=${GAME_ID}`); }).catch(() => {});
const dealerEl = $('#dealer'), bubble = $('#bubble');
const sfx = createSfxPlayer(() => voiceOn);        // unlocks audio on the first tap; plays the dealer's clips and table sounds
const SFX = { groan: [buildGroan, 4.8], cheer: [buildCheer, 6], hurray: [buildHurray, 7], dice: [buildDice, 1.4] };
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
  if (!voiceOn) { if (canSpeak) speechSynthesis.cancel(); try { voiceSrc?.stop(); } catch {} sfx.stop(); }
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
function renderPayouts() {
  const stake = +$('#exStake').value, c = n => Math.round(n * 100) / 100;
  $('#payoutRows').innerHTML = G.payouts.map(([name, when, pays, mult, often]) => `<tr>
    <td><b>${name}</b></td><td class="sub">${when}</td><td class="num odds">${pays}</td>
    <td class="num ex">+${fmt(c(stake * mult))}</td><td class="num ex">${fmt(c(stake * (mult + 1)))}</td><td class="ex sub">${often}</td></tr>`).join('');
}
$('#exStake').addEventListener('change', renderPayouts);
$('#exToggle').addEventListener('change', e => $('#payouts').classList.toggle('show-ex', e.target.checked));
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
// New game files → reload between rounds (players are kept at the table)
let filesVer = null;
setInterval(async () => {
  try {
    const { version } = await (await fetch('/api/version', { cache: 'no-store' })).json();
    if (filesVer && version !== filesVer && ST?.phase !== 'play') location.reload();
    filesVer ||= version;
  } catch {}
}, 10000);
fetch('/api/version', { cache: 'no-store' }).then(r => r.json()).then(v => { filesVer = v.version; }).catch(() => {});

if (G) {
  document.title = G.name + ' Table';
  document.head.insertAdjacentHTML('beforeend', `<style>${G.css || ''}</style>`);
  $('#rulesTitle').textContent = `${G.name} rules`;
  $('#rulesList').innerHTML = `<li><b>The table:</b> ${esc(G.name)} runs on the host computer. This phone joins with your own players; you bet for them from here.</li>`
    + G.rules.map(r => `<li>${r}</li>`).join('')
    + `<li><b>Your players:</b> add up to 6 seats (shared with everyone) with <b>+ Add player</b>; switch with the tabs. Only this phone can bet for them.</li>
       <li><b>Betting:</b> pick a chip and tap a space. Long-press a space to take your chips back. The round starts for everyone when the betting window closes.</li>
       <li><b>Cash out:</b> while bets are open, leave with the player's balance (chips on the table come back first).</li>
       <li><b>Connection:</b> if this phone drops off, your players stay; reopen this page to carry on.</li>`;
  buildBoard();
  renderPayouts();
  renderStage();
}
findTable();
