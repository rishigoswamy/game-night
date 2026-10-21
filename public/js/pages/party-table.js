const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const G = PARTY_GAME;
const COLORS = ['#3b82f6', '#ea580c', '#0e9fbd', '#e0408a', '#b98004', '#a855f7', '#16a34a', '#dc2626', '#64748b', '#f59e0b'];
document.title = `${G.name} · Game Night`;
if (G.wide) $('#gameView').classList.add('wide');
$('#title').textContent = G.name;
$('#blurb').textContent = G.blurb;
if (G.css) document.head.insertAdjacentHTML('beforeend', `<style>${G.css}</style>`);
function toast(msg) {
  const t = $('#toast'); t.innerHTML = `<div style="background:#fffdf5;color:#1b1b1b;font-weight:700;padding:8px 14px;border-radius:10px;box-shadow:0 6px 16px rgba(0,0,0,.4)">${esc(msg)}</div>`;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.innerHTML = ''; }, 3000);
}

/* ---------- Seats: one player per phone ---------- */
// P.seats: [{ name, device, color }] in seating order (turn order). Phones that join during a game wait for the next one.
const P = { phase: 'lobby', seats: [], waiting: [], opts: {}, ctx: null, endInfo: null };
const online = new Set();
function seatIndex(device) { return P.seats.findIndex(s => s.device === device); }
function addSeat(name, device) {
  const used = new Set(P.seats.map(s => s.color));
  P.seats.push({ name, device, color: COLORS.find(c => !used.has(c)) || COLORS[P.seats.length % COLORS.length] });
}

/* ---------- Options from the game module ---------- */
function renderOpts() {
  $('#opts').innerHTML = (G.options || []).map(o => {
    if (o.type === 'checks') return `<div class="field"><label>${o.label}</label><div class="checks">${o.choices.map(([v, l]) =>
      `<label><input type="checkbox" data-opt="${o.key}" value="${v}"${(P.opts[o.key] ?? o.def).includes(v) ? ' checked' : ''}>${l}</label>`).join('')}</div></div>`;
    return `<div class="field"><label for="opt-${o.key}">${o.label}</label><select id="opt-${o.key}" data-opt="${o.key}">${o.choices.map(([v, l]) =>
      `<option value="${v}"${String(P.opts[o.key] ?? o.def) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;
  }).join('');
  $('#opts').querySelectorAll('[data-opt]').forEach(el => el.addEventListener('change', readOpts));
}
function readOpts() {
  (G.options || []).forEach(o => {
    if (o.type === 'checks') P.opts[o.key] = [...$('#opts').querySelectorAll(`input[data-opt="${o.key}"]:checked`)].map(i => i.value);
    else { const v = $(`#opt-${o.key}`).value; P.opts[o.key] = isNaN(+v) ? v : +v; }
  });
  renderLobby();
}
(G.options || []).forEach(o => { P.opts[o.key] = o.def; });

function renderLobby() {
  const n = P.seats.length;
  $('#seatTitle').textContent = `Players (${n} of ${G.max})`;
  $('#seats').innerHTML = n ? P.seats.map((s, i) => `<li style="--pc:${s.color}"><span class="dot"></span><span class="nm">${esc(s.name)}</span>
      ${online.has(s.device) ? '' : '<span class="off">phone disconnected</span>'}<button class="x" type="button" data-kick="${i}" title="Remove ${esc(s.name)}">×</button></li>`).join('')
    : '<li class="empty">Nobody yet. Players join by scanning the QR code with their phone.</li>';
  $('#seats').querySelectorAll('[data-kick]').forEach(b => b.addEventListener('click', () => {
    const s = P.seats.splice(+b.dataset.kick, 1)[0];
    if (s) send({ type: 'kicked' }, s.device);
    renderLobby(); push();
  }));
  const why = G.canStart ? G.canStart(n, P.opts) : null;
  const ok = n >= G.min && n <= G.max && !why;
  $('#startBtn').disabled = !ok || !sharing();
  $('#startNote').textContent = !sharing() ? 'Opening the table for phones…' : n < G.min ? `Needs at least ${G.min} players.` : n > G.max ? `At most ${G.max} players.` : why || `Ready: ${n} players.`;
  $('#info').textContent = P.phase === 'lobby' ? `Lobby · ${n} player${n === 1 ? '' : 's'} joined` : $('#info').textContent;
}

/* ---------- Running a game ---------- */
const ABORT = Symbol('abort');
function randInt(n) {
  const a = new Uint32Array(1), lim = Math.floor(2 ** 32 / n) * n;
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return a[0] % n;
}
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = randInt(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
let clockId = null;
function makeCtx() {
  const ctx = {
    alive: true,
    players: P.seats.map((s, i) => ({ i, name: s.name, color: s.color, device: s.device })),
    opts: { ...P.opts },
    state: null,
    rand: randInt, shuffle,
    log(text) { ctx.logLines.unshift(text); ctx.logLines.length = Math.min(ctx.logLines.length, 60); },
    logLines: [],
    say(text, pose) { return ctx.alive ? say(text, pose) : Promise.resolve(); },
    async wait(ms) { await new Promise(r => setTimeout(r, ms)); if (!ctx.alive) throw ABORT; },
    update() { if (ctx.alive) render(); },
    // A countdown everyone sees; resolves when it runs out or ctx.skip() is called (e.g. everyone has voted)
    countdown(seconds, label) {
      ctx.clear?.();
      if (ctx.skipNext) { ctx.skipNext = false; return Promise.resolve(true); }   // skipped before it started (e.g. everyone was already ready)
      ctx.deadline = Date.now() + seconds * 1000; ctx.clockLen = seconds; ctx.clockLabel = label;
      render();
      return new Promise((res, rej) => {
        const t = setInterval(() => {
          if (!ctx.alive) { clearInterval(t); return rej(ABORT); }
          if (Date.now() >= ctx.deadline) { clearInterval(t); ctx.deadline = null; ctx.clear = null; render(); res(false); }
        }, 200);
        ctx.clear = () => { clearInterval(t); ctx.deadline = null; ctx.clear = null; res(true); };
      });
    },
    skip() { if (ctx.clear) ctx.clear(); else ctx.skipNext = true; },
    end(results, html) { finishGame(results, html); },
  };
  return ctx;
}
async function startGame() {
  if (P.phase !== 'lobby' && P.phase !== 'end') return;
  readOpts();
  if (P.seats.length < G.min) return;
  unlockAudio();
  $('#endModal').hidden = true;
  P.phase = 'game';
  P.endInfo = null;
  const ctx = P.ctx = makeCtx();
  $('#lobbyView').hidden = true; $('#gameView').hidden = false; $('#endBtn').hidden = false;
  render();
  try { await G.start(ctx); } catch (e) { if (e !== ABORT) { console.error(e); toast('Something went wrong in the game: ' + e.message); } }
}
function finishGame(results, html) {
  const ctx = P.ctx;
  if (!ctx || !ctx.alive) return;
  ctx.alive = false; ctx.clear?.();
  P.phase = 'end';
  P.endInfo = { results: results.map(r => ({ name: r.name, won: !!r.won, points: r.points ?? null, note: r.note || '' })), html: html || '' };
  Leaderboard.recordParty(G.id, results);
  dropLeavers();
  const winners = results.filter(r => r.won).map(r => r.name);
  $('#endTitle').textContent = winners.length ? `🏆 ${winners.join(' & ')} win${winners.length === 1 ? 's' : ''}!` : 'Game over';
  $('#endBody').innerHTML = (html || '') + `<div class="end-rows">${results.map(r => {
      const s = P.seats.find(x => x.name === r.name);
      return `<div class="sum-row" style="--pc:${s ? s.color : '#888'}"><div class="who"><span class="dot"></span>${esc(r.name)}${r.note ? ` <span class="zero">${esc(r.note)}</span>` : ''}</div>
        <div>${r.points != null ? `${r.points} ${G.pointsLabel || 'pts'} · ` : ''}${r.won ? '<span class="pos">Winner</span>' : '<span class="zero">—</span>'}</div></div>`; }).join('')}</div>`;
  $('#endModal').hidden = false;
  $('#endBtn').hidden = true;
  render();
  say(winners.length ? `${winners.join(' and ')} ${winners.length === 1 ? 'wins' : 'win'}! Well played, everyone.` : 'Game over.', 'wave');
}
function stopGame() {
  if (P.ctx) { P.ctx.alive = false; P.ctx.clear?.(); }
  P.ctx = null;
  P.phase = 'lobby';
  dropLeavers();
  seatWaiting();
  $('#lobbyView').hidden = false; $('#gameView').hidden = true; $('#endBtn').hidden = true; $('#endModal').hidden = true;
  $('#clockPanel').hidden = true;
  render();
}
function dropLeavers() {
  P.seats.filter(s => s.leaving).forEach(s => send({ type: 'left' }, s.device));
  P.seats = P.seats.filter(s => !s.leaving);
}
function seatWaiting() {
  while (P.waiting.length && P.seats.length < G.max) { const w = P.waiting.shift(); if (seatIndex(w.device) < 0) addSeat(w.name, w.device); }
}

/* ---------- Render (Mac) and push (phones) ---------- */
function render() {
  renderLobby();
  const ctx = P.ctx;
  if (ctx && ctx.state && P.phase !== 'lobby') {
    $('#info').textContent = (G.status ? G.status(ctx) : '') || `${ctx.players.length} players`;
    $('#stage').innerHTML = G.hostHTML(ctx, HOST_HELPERS);
    $('#log').innerHTML = ctx.logLines.map(l => `<div>${l}</div>`).join('');
  }
  renderClock();
  push();
}
function renderClock() {
  const ctx = P.ctx, on = !!(ctx && ctx.deadline);
  $('#clockPanel').hidden = !on;
  if (!on) return;
  const left = Math.max(0, ctx.deadline - Date.now()), sec = Math.ceil(left / 1000);
  $('#clockText').textContent = `${ctx.clockLabel ? ctx.clockLabel + ' · ' : ''}${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('#clockBar').style.width = (left / (ctx.clockLen * 1000) * 100) + '%';
  $('#clock').classList.toggle('low', left <= 10000);
}
setInterval(renderClock, 250);
const HOST_HELPERS = { esc, color: i => P.seats[i]?.color || '#888' };

// Each phone gets the shared table info plus its own private view (its cards, its role) and nothing else
let pushTimer = null;
function push() { if (sharing() && !pushTimer) pushTimer = setTimeout(pushNow, 80); }
function pushNow() {
  clearTimeout(pushTimer); pushTimer = null;
  if (!sharing()) return;
  const ctx = P.ctx;
  const base = {
    type: 'state', game: G.id, phase: P.phase, max: G.max, min: G.min,
    seats: P.seats.map(s => ({ name: s.name, color: s.color, online: online.has(s.device) })),
    deadline: ctx && ctx.deadline ? ctx.deadline - Date.now() : null, clockLen: ctx?.clockLen || 0, clockLabel: ctx?.clockLabel || '',
    end: P.endInfo, log: ctx ? ctx.logLines.slice(0, 8) : [],
  };
  P.seats.forEach((s, i) => {
    const k = ctx ? ctx.players.findIndex(p => p.device === s.device) : -1;   // this phone's player in the current game
    send({ ...base, me: i, leaving: !!s.leaving, view: ctx && ctx.state && P.phase !== 'lobby' && k >= 0 ? G.view(ctx, k) : null }, s.device);
  });
  P.waiting.forEach(w => send({ ...base, me: null, waiting: true, view: null }, w.device));
  // phones that are connected but not seated (just left, or haven't joined yet) still see the lobby
  const known = new Set([...P.seats.map(s => s.device), ...P.waiting.map(w => w.device)]);
  online.forEach(d => { if (!known.has(d)) send({ ...base, me: null, view: null }, d); });
}

/* ---------- Phones (relay through the Casino server) ---------- */
const NET = { code: null, hostKey: null, es: null, addresses: [], port: location.port, tts: false };
const sharing = () => !!NET.code;
async function startSharing(takeover = false) {
  try {
    const r = await fetch('/api/host', { method: 'POST', body: JSON.stringify({ game: G.id, code: NET.code, hostKey: NET.hostKey, takeover }) });
    if (r.status === 409) { $('#takeoverModal').hidden = false; return; }
    if (!r.ok) throw 0;
    const info = await r.json();
    Object.assign(NET, { code: info.code, hostKey: info.hostKey, addresses: info.addresses, port: info.port });
  } catch { return; }
  NET.es?.close();
  NET.es = new EventSource(`/api/stream?t=${NET.code}&role=host&key=${NET.hostKey}`);
  NET.es.onmessage = e => { try { handleRemote(JSON.parse(e.data)); } catch (err) { console.error(err); } };
  NET.es.onerror = () => setTimeout(async () => {
    try {
      const { tables } = await (await fetch('/api/tables')).json();
      if (!tables.some(t => t.code === NET.code)) { NET.es.close(); NET.code = NET.hostKey = null; startSharing(true); }
    } catch {}
  }, 2500);
  render();
}
function send(msg, to = 'all') {
  if (!sharing()) return;
  fetch('/api/send', { method: 'POST', body: JSON.stringify({ t: NET.code, from: 'host', hostKey: NET.hostKey, to, msg }) }).catch(() => {});
}
function handleRemote(m) {
  if (m.type === 'replaced') { NET.es?.close(); NET.code = null; toast('Another screen took over the table.'); return render(); }
  if (m.type === 'presence') { m.online ? online.add(m.device) : online.delete(m.device); return render(); }
  if (!m.device) return;
  const reply = msg => send(msg, m.device);
  const i = seatIndex(m.device);
  switch (m.type) {
    case 'hello':
      pushNow();
      if (i < 0 && !P.waiting.some(w => w.device === m.device)) reply({ type: 'state', game: G.id, phase: P.phase, me: null, seats: P.seats.map(s => ({ name: s.name, color: s.color })), max: G.max, min: G.min, view: null });
      return;
    case 'join': {
      const name = String(m.name || '').trim().slice(0, 16);
      if (!name) return reply({ type: 'error', text: 'Type a name first.' });
      if (P.seats.some((s, k) => k !== i && s.name.toLowerCase() === name.toLowerCase())) return reply({ type: 'error', text: `Someone is already called ${name}. Pick another name.` });
      if (i >= 0) {                                      // already seated: change name (between games)
        if (P.phase === 'game') return reply({ type: 'error', text: 'You can change your name after this game.' });
        P.seats[i].name = name; return render();
      }
      if (P.phase === 'lobby' || P.phase === 'end') {
        if (P.seats.length >= G.max) return reply({ type: 'error', text: `The game is full (${G.max} players).` });
        addSeat(name, m.device);
        if (P.phase === 'lobby') say(`Welcome, ${name}!`, 'welcome');
        return render();
      }
      if (!P.waiting.some(w => w.device === m.device)) P.waiting.push({ name, device: m.device });
      reply({ type: 'error', text: 'A game is in progress. You will be seated for the next one.' });
      return render();
    }
    case 'leave':
      P.waiting = P.waiting.filter(w => w.device !== m.device);
      if (i >= 0 && P.phase === 'game') {               // mid-game: leave when this game ends (or change your mind)
        P.seats[i].leaving = !m.stay;
        P.ctx?.log(m.stay ? `${esc(P.seats[i].name)} is staying.` : `👋 ${esc(P.seats[i].name)} will leave after this game.`);
        reply({ type: 'error', text: m.stay ? "You're staying for the next game too." : "You'll leave the table when this game ends." });
      } else if (i >= 0) {
        const s = P.seats.splice(i, 1)[0];
        if (P.phase === 'lobby') say(`Goodbye, ${s.name}!`);
      }
      return render();
    case 'act': {
      if (i < 0 || P.phase !== 'game' || !P.ctx) return;
      let err;
      try { err = G.act(P.ctx, i, m); } catch (e) { if (e !== ABORT) { console.error(e); err = 'That move did not work.'; } }
      if (err) reply({ type: 'error', text: err });
      render();
    }
  }
}
$('#takeoverNo').addEventListener('click', () => { $('#takeoverModal').hidden = true; });
$('#takeoverYes').addEventListener('click', () => { $('#takeoverModal').hidden = true; startSharing(true); });

/* ---------- Moderator voice: this computer's speech (via the server), browser speech as a fallback ---------- */
const dealerEl = $('#dealer'), bubble = $('#bubble');
let voiceOn = true, audioCtx = null, voiceSrc = null, sayToken = 0;
try { if (localStorage.getItem('gn-party-voice') === 'off') voiceOn = false; } catch {}
function getAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
  return audioCtx;
}
function unlockAudio() {
  const ac = getAudio(); if (!ac) return;
  const b = ac.createBufferSource(); b.buffer = ac.createBuffer(1, 1, 22050); b.connect(ac.destination); b.start(0);
  if (ac.state === 'running') $('#soundBar').hidden = true;
}
['pointerdown', 'click', 'keydown'].forEach(t => document.addEventListener(t, unlockAudio, true));
const clips = new Map();
function clip(text) {
  if (!clips.has(text)) {
    const job = fetch(`/api/tts?voice=Daniel&text=${encodeURIComponent(text)}`).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(d => getAudio().decodeAudioData(d));
    job.catch(() => clips.delete(text));
    clips.set(text, job);
    if (clips.size > 120) clips.delete(clips.keys().next().value);
  }
  return clips.get(text);
}
function setPose(pose, talking) {
  dealerEl.className = 'dealer'; void dealerEl.offsetWidth;
  dealerEl.className = 'dealer' + (pose ? ' ' + pose : '') + (talking ? ' talking' : '');
}
// Shows the line, speaks it, and resolves when done (also sent to the phones as text)
function say(text, pose) {
  send({ type: 'say', text });
  const my = ++sayToken;
  bubble.textContent = text;
  bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
  setPose(pose, true);
  return new Promise(res => {
    let done = false;
    const finish = () => { if (done) return; done = true; if (my === sayToken) dealerEl.classList.remove('talking'); setTimeout(res, 150); };
    const est = 700 + text.length * 60;
    if (!voiceOn) return setTimeout(finish, est);
    const browser = () => {
      if (!('speechSynthesis' in window)) return setTimeout(finish, est);
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.rate = 1.0; u.onend = finish; u.onerror = finish;
      speechSynthesis.speak(u); setTimeout(finish, est + 3000);
    };
    if (!NET.tts) return browser();
    (async () => {
      const ac = getAudio();
      if (ac && ac.state !== 'running') { try { await ac.resume(); } catch {} }
      if (!ac || ac.state !== 'running') { $('#soundBar').hidden = false; return setTimeout(finish, est); }
      let buf; try { buf = await clip(text); } catch { return browser(); }
      if (done || my !== sayToken) return finish();
      try { voiceSrc?.stop(); } catch {}
      const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.onended = finish;
      voiceSrc = src; src.start();
      setTimeout(finish, buf.duration * 1000 + 2500);
    })();
  });
}
function renderVoiceBtn() { $('#voiceBtn').textContent = 'Moderator voice: ' + (voiceOn ? 'On' : 'Off'); }
$('#voiceBtn').addEventListener('click', () => {
  voiceOn = !voiceOn;
  if (!voiceOn) { try { voiceSrc?.stop(); } catch {} if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  try { localStorage.setItem('gn-party-voice', voiceOn ? 'on' : 'off'); } catch {}
  renderVoiceBtn();
});
renderVoiceBtn();
$('#soundCheck').addEventListener('click', () => { unlockAudio(); say('Sound check. Can you hear me?', 'welcome'); });
$('#soundClose').addEventListener('click', () => { $('#soundBar').hidden = true; });

/* ---------- Rules, buttons, wiring ---------- */
$('#rulesTitle').textContent = `${G.name} rules`;
$('#rulesList').innerHTML = G.rules.map(r => `<li>${r}</li>`).join('') +
  `<li><b>Playing:</b> this Mac is the ${G.macRole || 'table'}; nobody plays on it. Everyone joins with their own phone by scanning the QR code (same Wi-Fi), and plays from the phone. Phones that join mid-game are seated for the next game.</li>
   <li><b>Leaderboard:</b> every finished game is recorded on this Mac (below). Flushing it needs the admin lock.</li>`;
const setRules = open => { $('#rules').hidden = !open; $('#rulesBtn').setAttribute('aria-pressed', open); };
$('#rulesBtn').addEventListener('click', () => setRules($('#rules').hidden));
$('#rulesClose').addEventListener('click', () => setRules(false));
document.addEventListener('pointerdown', e => { if (!$('#rules').hidden && !e.target.closest('#rules, #rulesBtn')) setRules(false); });
$('#startBtn').addEventListener('click', startGame);
// Buttons on the Mac's own game screen (e.g. "Start the vote now")
$('#stage').addEventListener('click', e => {
  const el = e.target.closest('[data-host]');
  if (!el || el.disabled || !P.ctx || !G.hostAct) return;
  G.hostAct(P.ctx, { ...el.dataset });
  render();
});
$('#againBtn').addEventListener('click', () => { seatWaiting(); startGame(); });
$('#toLobbyBtn').addEventListener('click', stopGame);
$('#endBtn').addEventListener('click', () => { $('#confirmModal').hidden = false; });
$('#confirmNo').addEventListener('click', () => { $('#confirmModal').hidden = true; });
$('#confirmYes').addEventListener('click', () => { $('#confirmModal').hidden = true; stopGame(); say('The game has ended.'); });
const tip = $('#tip');
document.addEventListener('pointerover', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false;
  tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
});
Leaderboard.mount(G.id, $('#lbAnchor'));
renderOpts();
// The QR code and address phones use to join
(async () => {
  try {
    const info = await (await fetch('/api/info')).json();
    if (info.master === false) return location.replace(`party-remote.html?g=${G.id}`);
    NET.tts = !!info.tts;
    const ip = (info.addresses || [])[0] || location.hostname;
    $('#joinUrl').textContent = `http://${ip}:${info.port}`;
    const img = $('#qr'); img.onload = () => { img.hidden = false; }; img.src = '/api/qr.svg';
    startSharing();
  } catch { $('#joinUrl').textContent = 'Start the Casino server (serve.sh) to let phones join.'; }
})();
let filesVer = null;
setInterval(async () => {
  try { const { version } = await (await fetch('/api/version', { cache: 'no-store' })).json(); if (filesVer && version !== filesVer) $('#updateBar').hidden = false; filesVer ||= version; } catch {}
}, 15000);
fetch('/api/version', { cache: 'no-store' }).then(r => r.json()).then(v => { filesVer = v.version; }).catch(() => {});
$('#updateBtn').addEventListener('click', () => location.reload());
window.addEventListener('beforeunload', () => { if (sharing()) navigator.sendBeacon?.('/api/close', JSON.stringify({ code: NET.code, hostKey: NET.hostKey })); });
render();
