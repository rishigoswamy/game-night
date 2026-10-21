const $ = s => document.querySelector(s);
// Recent results of each game on this computer (Roulette's Recent Numbers, the other tables' Recent Results)
const RECENT = { roulette: 'gn-spins', baccarat: 'gn-log-baccarat', dragontiger: 'gn-log-dragontiger', sicbo: 'gn-log-sicbo', craps: 'gn-log-craps' };
let unlocked = false, bio = false;

const recentCount = g => { try { return (JSON.parse(localStorage.getItem(RECENT[g])) || []).length; } catch { return 0; } };
const spinCount = () => Object.keys(RECENT).reduce((a, g) => a + recentCount(g), 0);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function fillSelect(sel, games, countOf, unit) {
  const keep = sel.value;
  sel.innerHTML = `<option value="*">All games (${plural(games.reduce((a, g) => a + countOf(g), 0), unit)})</option>` +
    games.map(g => `<option value="${g}">${Leaderboard.NAMES[g]} (${plural(countOf(g), unit)})</option>`).join('');
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
function msg(id, text, ok) { const m = $(id); m.textContent = text; m.className = 'msg ' + (ok ? 'ok' : 'err'); }

function render() {
  const has = AdminLock.hasLock(), dev = AdminLock.hasDeviceUnlock(), n = spinCount();
  $('#stPin').innerHTML = has ? '<span class="on">Set</span>' : '<span class="off">Not set</span>';
  $('#stBio').innerHTML = dev ? `<span class="on">On</span> (${AdminLock.bioName()})`
    : `<span class="off">Off</span>${bio ? '' : ' · needs https or localhost'}`;
  $('#stAddr').textContent = location.host;
  $('#setupPanel').hidden = has;
  $('#unlockPanel').hidden = !has || unlocked;
  $('#managePanel').hidden = !has || !unlocked;
  $('#bioUnlock').hidden = !(dev && bio);
  $('#bioUnlock').textContent = `Unlock with ${AdminLock.bioName()}`;
  $('#setupBio').hidden = !bio;
  $('#setupBioText').textContent = `Also allow ${AdminLock.bioName()} on this device`;
  $('#setupBioNote').hidden = bio;
  $('#setupBioNote').textContent = `${AdminLock.bioName()} needs this page on https or localhost; the PIN works everywhere.`;
  $('#bioDesc').textContent = dev ? `On: ${AdminLock.bioName()} can unlock admin actions on this device.`
    : bio ? `Off: let ${AdminLock.bioName()} unlock admin actions on this device.` : 'Unavailable here: needs https or localhost.';
  $('#bioToggle').textContent = dev ? 'Turn off' : 'Turn on';
  $('#bioToggle').disabled = !dev && !bio;
  const boards = Leaderboard.count();
  $('#stSpins').textContent = `${plural(n, 'result')} stored`;
  $('#stBoards').textContent = `${plural(boards, 'entry')} stored`.replace('entrys', 'entries');
  fillSelect($('#lbGame'), Object.keys(Leaderboard.NAMES), g => Leaderboard.count(g), 'entry');
  fillSelect($('#rrGame'), Object.keys(RECENT), recentCount, 'result');
  document.querySelectorAll('#lbGame option, #rrGame option').forEach(o => { o.textContent = o.textContent.replace(/(\d+) entrys/, '$1 entries'); });
  $('#lbDesc').textContent = 'Erase one game\'s leaderboard, or every leaderboard (master).';
  $('#rrDesc').textContent = 'Erase one game\'s recent results, or all of them.';
  $('#lbFlushBtn').disabled = !boards; $('#rrFlushBtn').disabled = !n; $('#masterFlushBtn').disabled = !boards && !n;
}

// ---- create ----
$('#setupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const p1 = $('#newPin').value.trim(), p2 = $('#newPin2').value.trim();
  if (!AdminLock.validPin(p1)) return msg('#setupMsg', 'Use 4 to 8 digits.');
  if (p1 !== p2) return msg('#setupMsg', "The two PINs don't match.");
  AdminLock.setPin(p1);
  unlocked = true;
  if (bio && $('#setupBioChk').checked) {
    try { await AdminLock.enableDeviceUnlock(); }
    catch { msg('#manageMsg', `${AdminLock.bioName()} wasn't set up; the PIN works. You can turn it on below.`); }
  }
  render();
  if (!$('#manageMsg').textContent) msg('#manageMsg', 'Admin lock created.', true);
});

// ---- unlock ----
$('#unlockForm').addEventListener('submit', e => {
  e.preventDefault();
  const r = AdminLock.checkPin($('#pin').value.trim());
  $('#pin').value = '';
  if (!r.ok) return msg('#unlockMsg', r.error);
  unlocked = true; $('#manageMsg').textContent = ''; render();
});
$('#bioUnlock').addEventListener('click', async () => {
  try {
    if (await AdminLock.verifyPasskey()) { unlocked = true; $('#manageMsg').textContent = ''; return render(); }
    msg('#unlockMsg', 'The device did not confirm it was you. Use the PIN instead.');
  } catch { msg('#unlockMsg', "Device unlock was cancelled or isn't available. Use the PIN instead."); }
});

// ---- manage (only reachable while unlocked) ----
// Destructive buttons ask for a second tap instead of a browser confirm dialog
function confirmTap(btn, label, action) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; return action(); }
  btn.dataset.armed = '1'; btn.textContent = 'Tap again to confirm';
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; } }, 4000);
}
$('#changeForm').addEventListener('submit', e => {
  e.preventDefault();
  const p1 = $('#chPin').value.trim(), p2 = $('#chPin2').value.trim();
  if (!AdminLock.validPin(p1)) return msg('#manageMsg', 'Use 4 to 8 digits.');
  if (p1 !== p2) return msg('#manageMsg', "The two PINs don't match.");
  AdminLock.setPin(p1);
  $('#chPin').value = $('#chPin2').value = '';
  msg('#manageMsg', 'Admin PIN changed.', true);
});
$('#bioToggle').addEventListener('click', async () => {
  if (AdminLock.hasDeviceUnlock()) {
    const forgotten = await AdminLock.disableDeviceUnlock();
    msg('#manageMsg', forgotten ? 'Device unlock turned off, and the browser was told to delete its saved entry.'
      : 'Device unlock turned off. If the entry still shows in your passwords list, see the steps below to delete it.', true);
  } else {
    try { await AdminLock.enableDeviceUnlock(); msg('#manageMsg', `${AdminLock.bioName()} can now unlock admin actions.`, true); }
    catch { msg('#manageMsg', `${AdminLock.bioName()} wasn't set up (cancelled or unavailable).`); }
  }
  render();
});
function flushRecent(g) {
  const games = g === '*' ? Object.keys(RECENT) : [g], n = games.reduce((a, k) => a + recentCount(k), 0);
  games.forEach(k => { try { localStorage.setItem(RECENT[k], '[]'); } catch {} });
  return n;
}
$('#lbFlushBtn').addEventListener('click', e => confirmTap(e.currentTarget, 'Flush', () => {
  const g = $('#lbGame').value, n = Leaderboard.flush(g === '*' ? undefined : g);
  msg('#manageMsg', `${g === '*' ? 'All leaderboards' : Leaderboard.NAMES[g] + ' leaderboard'} erased (${plural(n, 'entry').replace('entrys', 'entries')}). Open game tabs update right away.`, true);
  render();
}));
$('#rrFlushBtn').addEventListener('click', e => confirmTap(e.currentTarget, 'Flush', () => {
  const g = $('#rrGame').value, n = flushRecent(g);
  msg('#manageMsg', `${g === '*' ? 'All recent results' : Leaderboard.NAMES[g] + ' recent results'} erased (${plural(n, 'result')}). Open game tabs update right away.`, true);
  render();
}));
$('#masterFlushBtn').addEventListener('click', e => confirmTap(e.currentTarget, 'Master flush', () => {
  const r = flushRecent('*'), b = Leaderboard.flush();
  msg('#manageMsg', `Master flush done: ${plural(b, 'leaderboard entry').replace('entrys', 'entries')} and ${plural(r, 'recent result')} erased.`, true);
  render();
}));
window.addEventListener('storage', render);
$('#removeBtn').addEventListener('click', e => confirmTap(e.currentTarget, 'Remove lock', async () => {
  const forgotten = await AdminLock.removeLock();
  unlocked = false;
  render();
  msg('#setupMsg', 'Admin lock removed.' + (forgotten ? ' The browser was told to delete the device-unlock entry.' : ''), true);
}));
$('#relockBtn').addEventListener('click', () => { unlocked = false; $('#unlockMsg').textContent = ''; render(); });

(async () => { bio = await AdminLock.bioAvailable(); render(); })();
render();
