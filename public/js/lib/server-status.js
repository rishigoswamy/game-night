// Shows a bar when the Game Night server isn't running.
// The offline cache (sw.js) can still open pages after the server stops, which looks like a running game; this makes the
// real state obvious. Checks /api/info when the page opens and every few seconds (the cache never answers /api/ calls).
// Lobby pages (<script src="js/lib/server-status.js" data-reload="auto">) reload by themselves when the server is back;
// game pages offer a Reload button instead, because reloading would end a game in progress.
(function () {
  const script = document.currentScript;
  const autoReload = script && script.dataset.reload === 'auto';
  const EVERY_MS = 5000, DOWN_EVERY_MS = 2000, TIMEOUT_MS = 3000;   // checks more often while the server is down, so a restart is noticed quickly
  let seenUp = false, down = false, bar = null;

  function ensureBar() {
    if (bar) return bar;
    const css = document.createElement('style');
    css.textContent = `
      .server-down { position: sticky; top: 0; z-index: 1000; align-self: stretch; display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
        gap: 8px 14px; padding: max(10px, env(safe-area-inset-top)) 16px 10px; background: #b91c1c; color: #fff; font: 700 15px/1.4 system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,.45); text-align: center; }
      .server-down[hidden] { display: none; }
      .server-down.back { background: #15803d; }
      .server-down code { background: rgba(0,0,0,.25); padding: 1px 6px; border-radius: 5px; font-size: .92em; }
      .server-down button { font: inherit; font-size: 14px; padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,.7); background: rgba(0,0,0,.2); color: #fff; cursor: pointer; }`;
    document.head.appendChild(css);
    bar = document.createElement('div');
    bar.className = 'server-down'; bar.id = 'serverDown'; bar.setAttribute('role', 'alert'); bar.hidden = true;
    document.body.prepend(bar);
    // full width at the very top, pushing the page down (instead of covering its header)
    const cs = getComputedStyle(document.body);
    bar.style.margin = `-${cs.paddingTop} -${cs.paddingRight} 12px -${cs.paddingLeft}`;
    return bar;
  }
  function showDown() {
    const b = ensureBar();
    b.classList.remove('back');
    b.innerHTML = `<span>⚠️ Game Night isn't running. Start it with <code>Start Game Night.command</code> (or <code>npm start</code>). Phones can't join until it's running.</span>
      <button type="button" id="serverRetry">Check again</button>`;
    b.querySelector('#serverRetry').addEventListener('click', check);
    b.hidden = false;
  }
  function showBack() {
    // This page was opened from the offline copy, so it never connected: reload to connect (phones, voice, updates)
    if (autoReload) return location.reload();
    const b = ensureBar();
    b.classList.add('back');
    b.innerHTML = `<span>✅ Game Night is running again. Reload this page so phones can join (this ends the current game).</span>
      <button type="button" id="serverReload">Reload</button>`;
    b.querySelector('#serverReload').addEventListener('click', () => location.reload());
    b.hidden = false;
  }

  async function check() {
    let up = false;
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const r = await fetch('/api/info', { cache: 'no-store', signal: ctl.signal });
      clearTimeout(t);
      up = r.ok;
    } catch {}
    if (!up) { down = true; showDown(); return; }
    if (down && !seenUp) showBack();               // came up after the page was opened offline
    else if (bar) bar.hidden = true;               // a short outage: the page reconnects by itself
    down = false; seenUp = true;
  }

  if (location.protocol === 'file:') return;       // opened as a file: there is no server to talk to
  const loop = async () => { await check(); setTimeout(loop, down ? DOWN_EVERY_MS : EVERY_MS); };
  const start = () => loop();
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
  window.ServerStatus = { check };
})();
