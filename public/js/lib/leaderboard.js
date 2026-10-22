// Master leaderboard, kept on the host computer.
// Casino games: every player who leaves a table (cash out, game over or exit) is recorded with their winnings.
// Party games: every finished game records who won; players are ranked by wins.
// Each game's page shows that game's board; the lobbies show every game's leaders. Flushing needs the admin lock.
const Leaderboard = (() => {
  const KEY = 'gn-leaderboard', KEEP = 100;
  const CASINO = { roulette: 'Roulette', blackjack: 'Blackjack', baccarat: 'Baccarat', dragontiger: 'Dragon Tiger', sicbo: 'Sic Bo', craps: 'Craps' };
  const PARTY = { werewolf: 'One Night Werewolf', catan: 'Catan', gofish: 'Go Fish', bluff: 'Bluff', tambola: 'Tambola', mafia: 'Mafia' };
  const POINTS = { catan: 'Victory points', gofish: 'Books', tambola: 'Prizes', mafia: 'Survived' };   // party games whose points are worth showing
  const NAMES = { ...CASINO, ...PARTY };
  const isParty = g => g in PARTY;
  const cents = n => Math.round(n * 100) / 100;
  const money = n => '$' + (Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const signed = n => (n > 0 ? '+' : n < 0 ? '-' : '') + money(Math.abs(n));
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const listeners = [];
  const changed = () => listeners.forEach(f => f());
  function save(all) {
    // keep the best KEEP casino entries per game, and the latest 1000 party results per game
    const byGame = {};
    all.forEach(e => (byGame[e.game] ||= []).push(e));
    const kept = Object.entries(byGame).flatMap(([g, list]) => isParty(g)
      ? list.sort((a, b) => b.at - a.at).slice(0, 1000) : list.sort((a, b) => b.net - a.net).slice(0, KEEP));
    try { localStorage.setItem(KEY, JSON.stringify(kept)); } catch {}
    changed();
  }

  // Casino: a player leaves the table; onTable = chips of theirs still on the table that count as theirs
  function record(game, p, onTable = 0) {
    if (!p || p.lbRecorded || !p.results || !p.results.length) return;   // only players who played at least one round
    p.lbRecorded = true;
    const final = cents(p.bal + onTable);
    const all = load();
    all.push({ game, name: p.name, net: cents(final - p.start), final, rounds: p.results.length,
      best: cents(Math.max(0, ...p.results.map(r => r.net))), at: Date.now() });
    save(all);
  }
  // Party: one finished game → [{ name, won, points? }]
  function recordParty(game, results) {
    const all = load(), at = Date.now();
    results.forEach(r => all.push({ game, name: String(r.name).slice(0, 16), won: !!r.won, points: r.points ?? null, at }));
    save(all);
  }
  const top = (game, n = 10) => load().filter(e => e.game === game).sort((a, b) => b.net - a.net || b.at - a.at).slice(0, n);
  // Party ranking: by name (case-insensitive) → wins, games, points
  function topParty(game, n = 10) {
    const by = {};
    load().filter(e => e.game === game).forEach(e => {
      const k = e.name.trim().toLowerCase(), r = by[k] ||= { name: e.name, wins: 0, games: 0, points: 0, at: 0 };
      r.games++; if (e.won) r.wins++; r.points += e.points || 0; if (e.at > r.at) { r.at = e.at; r.name = e.name; }
    });
    return Object.values(by).sort((a, b) => b.wins - a.wins || b.wins / b.games - a.wins / a.games || b.points - a.points || b.at - a.at).slice(0, n);
  }
  const count = game => load().filter(e => !game || e.game === game).length;
  // Erase one game's board, or every board in `games` (all games when omitted)
  function flush(games) {
    const set = new Set(typeof games === 'string' ? [games] : games || Object.keys(NAMES));
    const all = load(), keep = all.filter(e => !set.has(e.game));
    try { localStorage.setItem(KEY, JSON.stringify(keep)); } catch {}
    changed();
    return all.length - keep.length;
  }
  const fmtDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const CSS = `
    .lb { max-width: 1200px; margin: 28px auto 0; background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.15); border-radius: 12px; padding: 18px 20px; width: 100%; }
    .lb-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; margin-bottom: 10px; }
    .lb h2 { margin: 0; font-family: Georgia, serif; color: var(--gold, #d4af37); font-size: 1.5rem; }
    .lb .lb-tools { display: inline-flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .lb .lb-sub { color: var(--muted, #b9c4bc); font-size: .9rem; }
    .lb .lb-flush { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font: inherit; font-size: .85rem; border-radius: 8px; cursor: pointer;
      background: rgba(0,0,0,.3); border: 1px solid rgba(224,86,92,.7); color: #ffb4b7; }
    .lb .lb-flush:disabled { opacity: .45; cursor: not-allowed; }
    .lb-scroll { overflow-x: auto; }
    .lb table { width: 100%; border-collapse: collapse; min-width: 520px; }
    .lb th, .lb td { padding: 8px 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.12); font-variant-numeric: tabular-nums; }
    .lb th { color: var(--gold, #d4af37); font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; }
    .lb td.num, .lb th.num { text-align: right; }
    .lb .rank { width: 44px; font-weight: 900; color: var(--muted, #b9c4bc); }
    .lb tr.r1 .rank { color: #ffd54f; } .lb tr.r2 .rank { color: #e5e7eb; } .lb tr.r3 .rank { color: #d97706; }
    .lb .nm { font-weight: 800; }
    .lb .pos { color: #4ade80; font-weight: 800; } .lb .neg { color: #f87171; font-weight: 800; }
    .lb .lb-empty { color: var(--muted, #b9c4bc); font-style: italic; padding: 18px 0; text-align: center; }
    .lb .lb-games { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    .lb .lb-game { background: rgba(0,0,0,.2); border-radius: 10px; padding: 10px 12px; }
    .lb .lb-game h3 { margin: 0 0 6px; font-size: 1rem; color: var(--text, #f5f1e6); }
    .lb .lb-game table { min-width: 0; }
    .lb .lb-game td, .lb .lb-game th { padding: 5px 6px; font-size: .88rem; }
    @media (max-width: 600px) { .lb { padding: 14px; } .lb h2 { font-size: 1.25rem; } }
    .lb.lb-mini { margin: 14px 0 0; padding: 10px 12px; background: rgba(0,0,0,.22); }
    .lb.lb-mini h2 { font-size: 1.05rem; } .lb.lb-mini .lb-head { margin-bottom: 4px; align-items: center; }
    .lb.lb-mini table { min-width: 0; } .lb.lb-mini td, .lb.lb-mini th { padding: 4px 6px; font-size: .85rem; }
    .lb.lb-mini .lb-empty { padding: 6px 0; font-size: .85rem; }
    .lb-modal { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.65); backdrop-filter: blur(3px); }
    .lb-modal form { width: min(420px, 100%); background: linear-gradient(#11402a, #082a1b); border: 2px solid var(--gold, #d4af37); border-radius: 16px; padding: 22px;
      color: var(--text, #f5f1e6); box-shadow: 0 20px 60px rgba(0,0,0,.6); font-family: system-ui, -apple-system, sans-serif; }
    .lb-modal h2 { margin: 0 0 8px; font-family: Georgia, serif; color: var(--gold, #d4af37); text-align: center; }
    .lb-modal p { color: var(--muted, #b9c4bc); text-align: center; margin: 0 0 12px; line-height: 1.45; }
    .lb-modal label { display: block; font-size: .85rem; color: var(--muted, #b9c4bc); margin-bottom: 4px; }
    .lb-modal input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.3); background: rgba(0,0,0,.35); color: inherit; font: inherit; }
    .lb-modal .err { color: #ff8a8f; min-height: 1.3em; font-size: .9rem; margin: 6px 0; text-align: center; }
    .lb-modal .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .lb-modal button, .lb-modal a { padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,.35); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-weight: 700; cursor: pointer; text-align: center; text-decoration: none; }
    .lb-modal .danger { background: #8f1d22; border-color: #e0565c; }
    .lb-modal .bio { width: 100%; margin-bottom: 10px; background: linear-gradient(#e6c55a, #b8901f); color: #1d1500; border-color: #f3dc8b; }`;
  function addCss() {
    if (document.getElementById('lbCss')) return;
    const s = document.createElement('style'); s.id = 'lbCss'; s.textContent = CSS; document.head.appendChild(s);
  }

  // Admin check before a flush: the device's own unlock or the admin PIN (the lock is set up on the Admin page).
  // Resolves true once confirmed, false if cancelled.
  async function confirmAdmin(title, text) {
    addCss();
    const AL = window.AdminLock, has = !!AL && AL.hasLock();
    const bio = has && AL.hasDeviceUnlock() && await AL.bioAvailable();
    return new Promise(done => {
      const m = document.createElement('div');
      m.className = 'lb-modal';
      m.innerHTML = `<form autocomplete="off"><h2>${esc(title)}</h2><p>${has ? esc(text) : 'Flushing needs an admin lock, and none is set up on this device yet. Create one on the Admin page.'}</p>
        ${bio ? `<button type="button" class="bio">Unlock with ${esc(AL.bioName())}</button><p style="margin:0 0 8px">or enter the admin PIN</p>` : ''}
        ${has ? '<label for="lbPin">Admin PIN</label><input id="lbPin" type="password" inputmode="numeric" maxlength="8">' : ''}
        <div class="err" role="alert"></div>
        <div class="row"><button type="button" class="cancel">${has ? 'Cancel' : 'Close'}</button>${has ? '<button type="submit" class="danger">Flush</button>' : '<a href="admin.html">Admin page</a>'}</div></form>`;
      document.body.appendChild(m);
      const end = ok => { m.remove(); done(ok); };
      const err = t => { m.querySelector('.err').textContent = t; };
      m.querySelector('.cancel').addEventListener('click', () => end(false));
      m.querySelector('.bio')?.addEventListener('click', async () => {
        try { if (await AL.verifyPasskey()) return end(true); err('The device did not confirm it was you. Use the PIN instead.'); }
        catch { err("Device unlock was cancelled or isn't available. Use the PIN instead."); }
      });
      m.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const r = AL.checkPin(m.querySelector('#lbPin').value.trim());
        if (r.ok) return end(true);
        m.querySelector('#lbPin').value = ''; err(r.error);
      });
      (m.querySelector('.bio') || m.querySelector('#lbPin') || m.querySelector('.cancel')).focus();
    });
  }

  const moneyRow = (e, k, full) => `<tr class="r${k + 1}"><td class="rank">${k === 0 ? '🏆' : k + 1}</td><td class="nm">${esc(e.name)}</td>
    <td class="num ${e.net > 0 ? 'pos' : e.net < 0 ? 'neg' : ''}">${signed(e.net)}</td>${full ? `<td class="num">${money(e.final)}</td><td class="num">${e.rounds}</td><td class="num">${e.best ? '+' + money(e.best) : '—'}</td>` : ''}<td class="num">${fmtDate(e.at)}</td></tr>`;
  const partyRow = (r, k, full, game) => `<tr class="r${k + 1}"><td class="rank">${k === 0 ? '🏆' : k + 1}</td><td class="nm">${esc(r.name)}</td>
    <td class="num">${r.wins}</td>${full ? `<td class="num">${r.games}</td><td class="num">${Math.round(r.wins / r.games * 100)}%</td>${POINTS[game] ? `<td class="num">${r.points}</td>` : ''}` : ''}<td class="num">${fmtDate(r.at)}</td></tr>`;
  const flushBtn = label => `<button type="button" class="lb-flush" title="Erase this leaderboard (admin)"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/></svg>${label}</button>`;
  function table(game, n, full) {
    if (isParty(game)) {
      const list = topParty(game, n);
      if (!list.length) return '';
      const pts = full && POINTS[game];
      return `<table><thead><tr><th>#</th><th>Player</th><th class="num">Wins</th>${full ? `<th class="num">Games</th><th class="num">Win rate</th>${pts ? `<th class="num">${pts}</th>` : ''}` : ''}<th class="num">Last played</th></tr></thead>
        <tbody>${list.map((r, k) => partyRow(r, k, full, game)).join('')}</tbody></table>`;
    }
    const list = top(game, n);
    if (!list.length) return '';
    return `<table><thead><tr><th>#</th><th>Player</th><th class="num">Won / lost</th>${full ? '<th class="num">Final chips</th><th class="num">Rounds</th><th class="num">Best round</th>' : ''}<th class="num">Date</th></tr></thead>
      <tbody>${list.map((e, k) => moneyRow(e, k, full)).join('')}</tbody></table>`;
  }

  // One game's leaderboard, as a section on its play page (inserted before `before`), with its own Flush.
  // compact: a short top 5 for the setup screen
  function mount(game, before, { compact = false } = {}) {
    addCss();
    const sec = document.createElement('section');
    sec.className = 'lb' + (compact ? ' lb-mini' : ''); sec.id = compact ? 'leaderboardMini' : 'leaderboard';
    before.parentNode.insertBefore(sec, before);
    const draw = () => {
      const t = table(game, compact ? 5 : 10, !compact);
      sec.innerHTML = `<div class="lb-head"><h2>🏆 ${compact ? 'Leaderboard' : `${NAMES[game] || game} Leaderboard`}</h2><span class="lb-tools">${compact ? '' : `<span class="lb-sub">${isParty(game)
          ? 'Top 10 by wins · recorded on this computer at the end of each game' : 'Top 10 by winnings · recorded on this computer when a player cashes out or the game ends'}</span>`}${flushBtn('Flush')}</span></div>` +
        (t ? `<div class="lb-scroll">${t}</div>` : `<div class="lb-empty">No one on the board yet. ${isParty(game) ? 'Finish a game' : 'Finish a game or cash out'} to get on it.</div>`);
      const b = sec.querySelector('.lb-flush');
      b.disabled = !count(game);
      b.addEventListener('click', async () => {
        if (await confirmAdmin(`Flush ${NAMES[game]} leaderboard`, `This erases every ${NAMES[game]} entry on this computer's leaderboard.`)) flush(game);
      });
    };
    draw();
    listeners.push(draw);
    window.addEventListener('storage', e => { if (e.key === KEY) draw(); });
  }
  // The lobby's leaderboard: top 5 of each game in `games`, with a Flush for all of them
  function mountAll(before, games = Object.keys(CASINO), label = 'casino') {
    addCss();
    const sec = document.createElement('section');
    sec.className = 'lb'; sec.id = 'leaderboard';
    before.parentNode.insertBefore(sec, before);
    const draw = () => {
      const boards = games.map(g => [g, table(g, 5, false)]).filter(([, t]) => t);
      sec.innerHTML = `<div class="lb-head"><h2>🏆 Leaderboard</h2><span class="lb-tools"><span class="lb-sub">Top players of every ${label} game on this computer</span>${flushBtn(`Flush all ${label} boards`)}</span></div>` +
        (boards.length ? `<div class="lb-games">${boards.map(([g, t]) => `<div class="lb-game"><h3>${NAMES[g]}</h3>${t}</div>`).join('')}</div>`
          : '<div class="lb-empty">No one on the board yet. Play a game to get on it.</div>');
      const b = sec.querySelector('.lb-flush');
      b.disabled = !games.some(g => count(g));
      b.addEventListener('click', async () => {
        if (await confirmAdmin(`Flush all ${label} leaderboards`, `This erases the leaderboards of ${games.map(g => NAMES[g]).join(', ')} on this computer.`)) flush(games);
      });
    };
    draw();
    listeners.push(draw);
    window.addEventListener('storage', e => { if (e.key === KEY) draw(); });
  }
  return { record, recordParty, top, topParty, count, flush, mount, mountAll, confirmAdmin, NAMES, CASINO, PARTY, isParty,
    _test: { table } };   // internals, for the unit tests only
})();
