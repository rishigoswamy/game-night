const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const G = window.PARTY_GAME && PARTY_GAME.id === PARTY_ID ? PARTY_GAME : null;
const PAGE_FOR = g => g === 'roulette' ? 'remote.html' : g === 'blackjack' ? 'bj-remote.html' : g in PARTY_IDS ? `party-remote.html?g=${g}` : `table-remote.html?g=${g}`;
let DEVICE;
try { DEVICE = localStorage.getItem('gn-device'); } catch {}
if (!DEVICE) { DEVICE = 'd' + [...crypto.getRandomValues(new Uint8Array(8))].map(x => x.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('gn-device', DEVICE); } catch {} }
let myName = '';
try { myName = localStorage.getItem('gn-party-name') || ''; } catch {}
let token = null, code = null, es = null, ST = null, deadlineAt = null, renaming = false;
// Was this phone seated in this browser tab? Then it rejoins by itself if the Mac reloads. Reopening the page later,
// or tapping Leave, shows the join form instead (your last name filled in, so you can keep it or pick another).
const SEATED = 'gn-party-seated';
const wasSeated = () => { try { return sessionStorage.getItem(SEATED) === '1'; } catch { return false; } };
const setSeated = on => { try { on ? sessionStorage.setItem(SEATED, '1') : sessionStorage.removeItem(SEATED); } catch {} };
const local = {};        // this phone's own selections (cards picked, targets…), kept between updates

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3000);
}
function post(msg) {
  return fetch('/api/send', { method: 'POST', body: JSON.stringify({ t: code, from: DEVICE, token, msg }) })
    .then(r => r.ok ? null : r.json().then(j => toast(j.error || 'Could not reach the game.'))).catch(() => toast('Could not reach the game.'));
}
function follow(game) { if (G && game === G.id) return false; location.replace(PAGE_FOR(game)); return true; }

let findTimer = null;
async function findTable() {
  clearTimeout(findTimer);
  try {
    const { tables } = await (await fetch('/api/tables')).json();
    if (tables[0] && follow(tables[0].game)) return;
    if (tables[0]) return tables[0].code === code && es ? null : connect(tables[0].code);
    $('#waitText').textContent = "The host computer isn't running a game right now. This page joins automatically as soon as it is.";
  } catch { $('#waitText').textContent = "Can't reach the host computer. Make sure this phone is on the same Wi-Fi."; }
  es?.close(); es = null; code = null; ST = null;
  $('#gameView').hidden = true; $('#joinView').hidden = false;
  findTimer = setTimeout(findTable, 3000);
}
function connect(c) {
  code = c; es?.close();
  es = new EventSource(`/api/stream?t=${c}&role=remote&device=${DEVICE}`);
  es.onopen = () => { $('#where').innerHTML = `<span class="conn"></span>${esc(G.name)}`; };
  es.onerror = () => {
    $('#where').innerHTML = `<span class="conn off"></span>${esc(G.name)} · reconnecting…`;
    fetch('/api/tables').then(r => r.json()).then(({ tables }) => { if (!tables.some(t => t.code === c)) findTable(); }).catch(() => {});
  };
  es.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch (err) { console.error(err); } };
  $('#joinView').hidden = true; $('#gameView').hidden = false;
}
function onMessage(m) {
  switch (m.type) {
    case 'session': token = m.token; post({ type: 'hello' }); break;
    case 'state': {
      if (follow(m.game)) return;
      const was = ST;
      ST = m;
      deadlineAt = m.deadline != null ? Date.now() + m.deadline : null;
      if (m.me != null) setSeated(true);
      // Seated again automatically after the host reloads (same name, same phone, same tab)
      else if (!m.waiting && myName && wasSeated() && (m.phase === 'lobby' || m.phase === 'end') && !was?.autoJoined) { ST.autoJoined = true; post({ type: 'join', name: myName }); }
      if (G.phoneNotify) { const buzz = G.phoneNotify(was?.view, m.view); if (buzz) navigator.vibrate?.(buzz === true ? [80, 50, 80] : buzz); }
      render();
      break;
    }
    case 'host': $('#offline').hidden = m.online; break;
    case 'closed': if (m.replacedBy) connect(m.replacedBy); else findTable(); break;
    case 'kicked': setSeated(false); toast('The host removed you from the game.'); break;
    case 'left': setSeated(false); toast('You have left the table. Join again any time.'); break;
    case 'error': toast(m.text); break;
    case 'say': $('#bubble').textContent = m.text; break;
  }
}
function render() {
  if (!ST) return;
  const seated = ST.me != null, phase = ST.phase;
  const seatsHTML = (ST.seats || []).map((s, i) => `<span style="--pc:${s.color}" class="${i === ST.me ? 'me' : ''}"><i></i>${esc(s.name)}</span>`).join('') || '<span>Nobody yet</span>';
  if (!seated) renaming = false;
  $('#namePanel').hidden = (seated && !renaming) || ST.waiting;
  $('#nameTitle').textContent = renaming ? 'Change your name' : phase === 'game' ? 'A game is in progress' : 'Join the game';
  $('#nameForm button[type=submit]').textContent = renaming ? 'Save' : 'Join';
  $('#leavePanel').hidden = !(seated && phase === 'game');
  $('#leaveText').textContent = ST.leaving ? "You'll leave the table when this game ends." : 'Need to go? You can leave once this game is over.';
  $('#leaveLaterBtn').textContent = ST.leaving ? 'Stay for the next game' : 'Leave after this game';
  $('#seatsA').innerHTML = seatsHTML;
  if (!seated && !$('#nameIn').value && myName) $('#nameIn').value = myName;
  $('#lobbyPanel').hidden = !((seated && (phase === 'lobby' || phase === 'end')) || ST.waiting);
  $('#renameBtn').hidden = !seated;
  $('#lobbyText').textContent = ST.waiting ? 'A game is in progress. You will be seated for the next one.'
    : `Waiting for the host to start. ${G.name} needs ${ST.min}–${ST.max} players; ${ST.seats.length} joined.`;
  $('#seatsB').innerHTML = seatsHTML;
  $('#viewPanel').hidden = !(seated && ST.view && phase !== 'lobby');
  if (!$('#viewPanel').hidden) {
    $('#view').innerHTML = G.phoneHTML(ST.view, local, { esc, me: ST.me, seats: ST.seats });
    G.phoneAfter?.($('#view'), ST.view, local);
  }
  $('#endPanel').hidden = !(phase === 'end' && ST.end);
  if (ST.end) {
    const w = ST.end.results.filter(r => r.won).map(r => r.name);
    $('#endTitle').textContent = w.length ? `🏆 ${w.join(' & ')} win${w.length === 1 ? 's' : ''}!` : 'Game over';
    $('#endBody').innerHTML = (ST.end.html || '') + `<div class="endlist">${ST.end.results.map(r => `<div><span>${esc(r.name)}${r.note ? ` <span class="muted">${esc(r.note)}</span>` : ''}</span><span>${r.points != null ? r.points + ' · ' : ''}${r.won ? '<span class="pos">Winner</span>' : '—'}</span></div>`).join('')}</div>`;
  }
  $('#phase').textContent = phase === 'lobby' ? 'Lobby' : phase === 'end' ? 'Game over' : (ST.view?.title || G.name);
  $('#sub').textContent = seated ? `You are ${ST.seats[ST.me]?.name}` : '';
  tick();
}
function tick() {
  const on = ST && deadlineAt && ST.phase === 'game';
  $('#bar').hidden = !on;
  if (!on) return;
  const ms = Math.max(0, deadlineAt - Date.now()), sec = Math.ceil(ms / 1000);
  $('#sub').textContent = `${ST.clockLabel ? ST.clockLabel + ' · ' : ''}${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('#barFill').style.width = (ST.clockLen ? ms / (ST.clockLen * 1000) * 100 : 0) + '%';
  $('#bar').classList.toggle('low', ms <= 10000);
}
setInterval(tick, 250);

// Taps on the game view: the game module handles local choices (picking cards…); [data-act] buttons go to the Mac
$('#view').addEventListener('click', e => {
  const el = e.target.closest('[data-act], [data-local]');
  if (!el || el.disabled || !ST?.view) return;
  const send = msg => post({ type: 'act', ...msg });
  if (el.dataset.local != null) { G.phoneLocal?.(el.dataset, ST.view, local, send); return render(); }
  const msg = { ...el.dataset };
  if (G.phoneAct && G.phoneAct(msg, ST.view, local, send) === true) return render();
  send(msg);
});
$('#nameForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#nameIn').value.trim();
  if (!name) return toast('Type your name first.');
  myName = name; renaming = false;
  try { localStorage.setItem('gn-party-name', name); } catch {}
  post({ type: 'join', name });                     // when already seated, this renames you
  render();
});
$('#leaveBtn').addEventListener('click', () => { setSeated(false); renaming = false; post({ type: 'leave' }); });
$('#renameBtn').addEventListener('click', () => { renaming = true; render(); $('#nameIn').value = myName; $('#nameIn').select(); });
$('#leaveLaterBtn').addEventListener('click', () => {
  const stay = !!ST?.leaving;
  setSeated(stay);
  post(stay ? { type: 'leave', stay: true } : { type: 'leave' });
});
const setRules = open => { $('#rules').hidden = !open; };
$('#rulesBtn').addEventListener('click', () => setRules($('#rules').hidden));
$('#rulesClose').addEventListener('click', () => setRules(false));
let filesVer = null;
setInterval(async () => {
  try { const { version } = await (await fetch('/api/version', { cache: 'no-store' })).json(); if (filesVer && version !== filesVer && ST?.phase !== 'game') location.reload(); filesVer ||= version; } catch {}
}, 10000);
fetch('/api/version', { cache: 'no-store' }).then(r => r.json()).then(v => { filesVer = v.version; }).catch(() => {});
fetch('/api/info').then(r => r.json()).then(i => { if (i.master === true && G) location.replace(`party-table.html?g=${G.id}`); }).catch(() => {});
if (G) {
  document.title = G.name;
  if (G.css) document.head.insertAdjacentHTML('beforeend', `<style>${G.css}</style>`);
  $('#rulesTitle').textContent = `${G.name} rules`;
  $('#rulesList').innerHTML = G.rules.map(r => `<li>${r}</li>`).join('');
}
findTable();
