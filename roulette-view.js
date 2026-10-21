// Roulette visuals for pages that show the table without running it (the phone join page):
// the wheel, the Recent Numbers chart and the payout table. Drawn exactly like the master table.
(function () {
  const ORDER = [0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,37,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2];
  const POCKETS = ORDER.length;
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const lbl = n => n === 37 ? '00' : String(n);
  const isZero = n => n === 0 || n === 37;
  const colorOf = n => isZero(n) ? 'green' : RED.has(n) ? 'red' : 'black';
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

  /* ---------- Wheel ---------- */
  // spinTo(n) lands the ball on n after the same 6.5 s spin as the master; settle(n) puts it straight in the pocket
  // (for a phone that joins mid-round); release() sends it back to circling for the next round.
  function createWheel(cv) {
    const ctx = cv.getContext('2d');
    const SIZE = 440, C = SIZE / 2, SEG = Math.PI * 2 / POCKETS;
    const R_RIM = 218, R_TRACK_OUT = 200, R_POCKET_OUT = 172, R_NUM_IN = 142, R_POCKET_IN = 108;
    const BALL_TRACK = 186, BALL_POCKET = 125, BALL_IDLE_SPEED = 2.6;
    let dpr = 1, rot = 0, anim = null, paused = false, pausedAt = 0, last = performance.now();
    const ball = { a: -Math.PI / 2, r: BALL_TRACK, pocket: null };
    const resize = () => { dpr = window.devicePixelRatio || 1; cv.width = SIZE * dpr; cv.height = SIZE * dpr; };
    resize();
    window.addEventListener('resize', resize);

    function spinTo(n, done = () => {}) {
      const idx = ORDER.indexOf(n), land = Math.random() * Math.PI * 2;
      const r0 = rot, b0 = ball.pocket != null ? rot + ball.pocket * SEG : ball.a;
      const r1 = r0 + Math.PI * 2 * 4 + mod(land - idx * SEG - r0, Math.PI * 2);
      const b1 = b0 - Math.PI * 2 * 7 - mod(b0 - land, Math.PI * 2);
      ball.pocket = null;
      anim = { t0: performance.now(), dur: 6500, r0, r1, b0, b1, br0: ball.r, idx, done };
    }
    const settle = n => { if (!anim) { ball.pocket = ORDER.indexOf(n); ball.r = BALL_POCKET; } };
    const release = () => { if (!anim) ball.pocket = null; };
    function setPaused(p) {
      if (p && !paused) pausedAt = performance.now();
      if (!p && paused && anim) anim.t0 += performance.now() - pausedAt;
      paused = p;
    }
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      if (!paused) {
        if (anim) {
          const k = Math.min(1, (now - anim.t0) / anim.dur);
          rot = anim.r0 + (anim.r1 - anim.r0) * easeOutCubic(k);
          ball.a = anim.b0 + (anim.b1 - anim.b0) * easeOutQuart(k);
          if (k < .08) ball.r = anim.br0 + (BALL_TRACK - anim.br0) * (k / .08);
          else if (k < .6) ball.r = BALL_TRACK;
          else ball.r = BALL_TRACK + (BALL_POCKET - BALL_TRACK) * easeOutBounce(Math.min(1, (k - .6) / .3));
          if (k >= 1) { ball.pocket = anim.idx; const cb = anim.done; anim = null; cb(); }
        } else {
          rot += 0.15 * dt;
          if (ball.pocket != null) { ball.a = rot + ball.pocket * SEG; ball.r = BALL_POCKET; }
          else { ball.a -= BALL_IDLE_SPEED * dt; ball.r += (BALL_TRACK - ball.r) * Math.min(1, 6 * dt); }
        }
      }
      draw();
      requestAnimationFrame(frame);
    }
    const circle = (r, fill) => { ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
    const ring = r => { ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.stroke(); };
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      let g = ctx.createRadialGradient(C, C, R_TRACK_OUT, C, C, R_RIM);          // wooden rim
      g.addColorStop(0, '#3b200e'); g.addColorStop(.5, '#7a4520'); g.addColorStop(1, '#2a1608');
      circle(R_RIM, g);
      ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2; ring(R_RIM - 1);
      g = ctx.createRadialGradient(C, C, R_POCKET_OUT, C, C, R_TRACK_OUT);        // ball track
      g.addColorStop(0, '#1d1d1d'); g.addColorStop(1, '#4a4a4a');
      circle(R_TRACK_OUT, g);
      ctx.save(); ctx.translate(C, C); ctx.rotate(rot);                           // pockets
      for (let i = 0; i < POCKETS; i++) {
        const n = ORDER[i], a0 = i * SEG - SEG / 2, a1 = a0 + SEG;
        ctx.beginPath(); ctx.arc(0, 0, R_POCKET_OUT, a0, a1); ctx.arc(0, 0, R_POCKET_IN, a1, a0, true); ctx.closePath();
        ctx.fillStyle = isZero(n) ? '#0a8a45' : RED.has(n) ? '#c0262d' : '#151515'; ctx.fill();
        ctx.strokeStyle = 'rgba(212,175,55,.85)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.save(); ctx.rotate(i * SEG + Math.PI / 2);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(lbl(n), 0, -(R_POCKET_OUT + R_NUM_IN) / 2);
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, R_NUM_IN, 0, Math.PI * 2); ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2; ctx.stroke();
      g = ctx.createRadialGradient(-20, -20, 10, 0, 0, R_POCKET_IN);              // centre cone
      g.addColorStop(0, '#9a6235'); g.addColorStop(.7, '#5a3317'); g.addColorStop(1, '#2d1809');
      ctx.beginPath(); ctx.arc(0, 0, R_POCKET_IN, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#e8c766'; ctx.strokeStyle = '#8a6d1a'; ctx.lineWidth = 1;   // turret
      for (let k = 0; k < 4; k++) {
        ctx.save(); ctx.rotate(k * Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, -62); ctx.lineTo(5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -62, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 16); g.addColorStop(0, '#fff6cf'); g.addColorStop(1, '#b8901f');
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.restore();
      const x = C + Math.cos(ball.a) * ball.r, y = C + Math.sin(ball.a) * ball.r;   // ball
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      g = ctx.createRadialGradient(x - 2.5, y - 2.5, 1, x, y, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b8b8b8');
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(frame);
    return { spinTo, settle, release, setPaused, get spinning() { return !!anim; } };
  }

  /* ---------- Recent Numbers ---------- */
  const FLAME_SVG = `<svg class="flame" viewBox="0 0 24 32" aria-hidden="true">
  <defs><linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#d50000"/><stop offset=".35" stop-color="#ff3d00"/><stop offset=".7" stop-color="#ff9100"/><stop offset="1" stop-color="#ffd54f"/>
  </linearGradient></defs>
  <path d="M12 1c1.2 6.2 8 9.4 8 17.6A8 8 0 0 1 4 18.6c0-4.3 2.2-6.6 3.4-8.8.9 3.1 2.3 4.5 4.3 4.6C9.6 10.2 10.4 5.5 12 1z" fill="url(#flameGrad)"/>
  <path class="core" d="M12.2 15c.8 3 4.3 4.6 4.3 8.2a4.4 4.4 0 0 1-8.8 0c0-2.3 1.1-3.5 1.8-4.6.6 1.5 1.5 2.3 2.6 2.3-1-2.4-.6-4.3.1-5.9z" fill="#fff3b0"/>
</svg>`;
  const POCKET_FILL = { red: '#e5484d', black: '#1b1b1b', green: '#22c55e' };
  function hotNumbers(log) {
    const freq = {};
    log.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
    return Object.entries(freq).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => [+n, c]);
  }
  // els: { box, stats, sub, hint } — same chart as the master table, from the master's spins
  function renderRecent(els, log) {
    const { box, stats, sub, hint } = els;
    const counts = { red: 0, black: 0, green: 0 };
    log.forEach(n => { counts[colorOf(n)]++; });
    const hot = hotNumbers(log);
    sub.textContent = log.length ? `Last ${log.length} of up to 50 spins at the table` : 'No spins yet';
    stats.innerHTML = !log.length ? '' :
      ['red', 'black', 'green'].map(c => `<span><span class="sw" style="background:${POCKET_FILL[c]};${c === 'black' ? 'box-shadow:0 0 0 1.5px #f5f1e6' : ''}"></span>${c[0].toUpperCase() + c.slice(1)} ${counts[c]}</span>`).join('')
      + `<span class="hot"><span class="hot-label">${FLAME_SVG}Hot</span>${hot.length
          ? hot.map(([n, c]) => `<span class="hot-num" title="${lbl(n)} came up ${c} times"><b class="bg-${colorOf(n)}">${lbl(n)}</b><small>${c}×</small></span>`).join('')
          : '<span class="muted">none yet</span>'}</span>`;
    if (!log.length) { box.innerHTML = '<div class="chart-empty">Results will appear here after the first spin.</div>'; hint.hidden = true; return; }
    const SLOT = 22, L = 34, R = 14, T = 16, B = 30;
    const W = Math.max(box.clientWidth || 280, L + R + 50 * SLOT), H = 270;
    const x = k => L + (k + .5) * (W - L - R) / 50;
    const y = n => T + (37 - n) / 37 * (H - T - B);
    let html = '';
    [0, 9, 18, 27, 37].forEach(v => {
      html += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.12)"/>
        <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#b9c4bc">${lbl(v)}</text>`;
    });
    html += `<text x="${W - R}" y="${H - 6}" font-size="11" fill="#b9c4bc" text-anchor="end">Spin order: oldest → newest (gold ring = latest)</text>`;
    html += `<polyline fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5" stroke-linejoin="round" points="${log.map((n, k) => `${x(k)},${y(n)}`).join(' ')}"/>`;
    log.forEach((n, k) => {
      const c = colorOf(n), latest = k === log.length - 1, cx = x(k), cy = y(n);
      if (latest) html += `<circle cx="${cx}" cy="${cy}" r="13.5" fill="none" stroke="#d4af37" stroke-width="2.5"/>`;
      html += `<circle cx="${cx}" cy="${cy}" r="9.5" fill="${POCKET_FILL[c]}" stroke="${c === 'black' ? '#f5f1e6' : '#0b3a24'}" stroke-width="${c === 'black' ? 1.2 : 1.5}"/>`;
      html += `<text x="${cx}" y="${cy + 3.3}" text-anchor="middle" font-size="${lbl(n).length > 1 ? 9 : 10}" font-weight="800" fill="${c === 'green' ? '#06301b' : '#fff'}" pointer-events="none">${lbl(n)}</text>`;
      html += `<circle cx="${cx}" cy="${cy}" r="12" fill="transparent" data-tip="Spin ${k + 1}${latest ? ' (latest)' : ''}: ${lbl(n)} ${c[0].toUpperCase() + c.slice(1)}"/>`;
    });
    box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Last ${log.length} roulette numbers: ${log.map(lbl).join(', ')}">${html}</svg>`;
    // Scroll so the latest spin sits near the right edge (with few spins, that's the start, so the dots stay in view)
    box.scrollLeft = Math.max(0, x(log.length - 1) + 40 - box.clientWidth);
    hint.hidden = box.scrollLeft < 2;                     // only when older spins are off to the left
  }

  /* ---------- Payout table ---------- */
  const WINS = {
    n0: x => x === 0, d1: x => x >= 1 && x <= 12, c1: x => !isZero(x) && x % 3 === 1,
    red: x => RED.has(x), odd: x => !isZero(x) && x % 2 === 1, low: x => x >= 1 && x <= 18,
  };
  const PAYS = { n0: 35, d1: 2, c1: 2, red: 1, odd: 1, low: 1 };
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
  function renderPayouts(tbody, stake, fmt) {
    tbody.innerHTML = PAYOUT_ROWS.map(([name, where, key, covers]) => {
      if (!where) return `<tr class="group"><td colspan="7">${name}</td></tr>`;
      const count = ORDER.filter(WINS[key]).length, pct = count / POCKETS * 100, pays = PAYS[key];
      return `<tr><td><b>${name}</b></td><td class="sub">${where}</td><td class="sub">${covers}</td>
        <td class="num odds">${pays}:1</td><td class="num ex">+${fmt(stake * pays)}</td><td class="num ex">${fmt(stake * (pays + 1))}</td>
        <td class="ex"><span class="pbar" style="width:${pct * 1.4}px"></span>${pct.toFixed(2)}% <span class="sub">(${count} in ${POCKETS})</span></td></tr>`;
    }).join('');
  }

  /* ---------- Win / loss by round ---------- */
  // Bar with rounded corners only on the end away from the zero line
  function barPath(x, y0, w, h, up) {
    const r = Math.min(4, w / 2, h);
    if (h <= 0) return '';
    return up
      ? `M${x} ${y0} V${y0 - h + r} Q${x} ${y0 - h} ${x + r} ${y0 - h} H${x + w - r} Q${x + w} ${y0 - h} ${x + w} ${y0 - h + r} V${y0} Z`
      : `M${x} ${y0} V${y0 + h - r} Q${x} ${y0 + h} ${x + r} ${y0 + h} H${x + w - r} Q${x + w} ${y0 + h} ${x + w} ${y0 + h - r} V${y0} Z`;
  }
  // The last 12 rounds for one player: green bars up for wins, red down for losses; total = their overall net
  function renderWinLoss(card, name, results, total, fmt) {
    const signed = v => (v > 0 ? '+' : v < 0 ? '-' : '') + fmt(Math.abs(v));
    const data = results.slice(-12);
    card.innerHTML = `<div class="wl-head"><span>Win / loss by round</span><b class="${total > 0 ? 'pos' : total < 0 ? 'neg' : ''}">${results.length ? signed(total) : ''}</b></div>`;
    if (!data.length) { card.insertAdjacentHTML('beforeend', '<div class="wl-empty">No rounds played yet</div>'); return; }
    const W = Math.max(120, card.clientWidth - 4), H = 70, mid = H / 2;
    const maxAbs = Math.max(...data.map(r => Math.abs(r.net)), 1);
    const slot = W / 12, bw = Math.min(16, slot - 4);
    let html = `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="rgba(255,255,255,.35)" stroke-width="1"/>`;
    data.forEach((r, k) => {
      const x = k * slot + (slot - bw) / 2, h = Math.max(r.net ? 3 : 0, Math.abs(r.net) / maxAbs * (mid - 4));
      if (h) html += `<path d="${barPath(x, mid, bw, h, r.net > 0)}" fill="${r.net > 0 ? '#4ade80' : '#f87171'}"/>`;
      else html += `<circle cx="${x + bw / 2}" cy="${mid}" r="3" fill="#b9c4bc"/>`;
      html += `<rect x="${k * slot}" y="0" width="${slot}" height="${H}" fill="transparent" data-tip="Round ${r.round}: ${r.net ? signed(r.net) : 'even'}"/>`;
    });
    card.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${String(name).replace(/"/g, '')}: ${data.map(r => `round ${r.round} ${signed(r.net)}`).join(', ')}">${html}</svg>`);
  }

  window.RouletteView = { lbl, isZero, colorOf, createWheel, renderRecent, hotNumbers, renderPayouts, renderWinLoss, FLAME_SVG };
})();
