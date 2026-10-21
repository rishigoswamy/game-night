// Game Night used to be called "Roulette Duel" and then "Duel Casino". Saved data (leaderboard, recent results,
// admin PIN, settings, this phone's seat) moves from the old storage names (rd-…, dc-…) to gn-… the first time a page loads.
(function () {
  for (const store of ['localStorage', 'sessionStorage']) {
    try {
      const s = window[store];
      for (const k of Object.keys(s)) {
        const m = /^(rd|dc)-(.+)$/.exec(k);
        if (!m || k === 'rd-admin') continue;            // rd-admin: the very first in-game PIN, removed by admin-lock.js
        const nk = 'gn-' + m[2];
        if (s.getItem(nk) == null) s.setItem(nk, s.getItem(k));
        s.removeItem(k);
      }
    } catch {}
  }
})();
