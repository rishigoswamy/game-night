// What the phones show at a Roulette table (public/js/lib/roulette-view.js): the wheel, the Recent Numbers chart,
// the payout table and the win / loss chart
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./helpers');

const ORDER = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const label = n => (n === 37 ? '00' : String(n));

// A page with a fake clock and animation frames, and a canvas that records every drawing call
function page() {
  let now = 0, frameCb = null;
  const calls = [];
  const state = {};
  const ctx = new Proxy(state, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args) => { calls.push({ op: k, args, fillStyle: t.fillStyle }); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  const cv = { width: 0, height: 0, getContext: () => ctx };
  const sandbox = loadScripts(['js/lib/roulette-view.js'], { extra: {
    performance: { now: () => now },
    requestAnimationFrame: cb => { frameCb = cb; },
    addEventListener() {}, devicePixelRatio: 2,
  } });
  // run the animation for `ms` milliseconds, one frame every 16 ms
  const run = ms => { const end = now + ms; while (now < end) { now = Math.min(end, now + 16); calls.length = 0; frameCb(now); } };
  return { RV: sandbox.RouletteView, cv, calls, run };
}

// From the last frame drawn: which pocket the ball is in (by angle, relative to the turning wheel) and its distance
// from the centre
function ballPosition(calls) {
  const C = 220, SEG = Math.PI * 2 / 38;
  const rot = calls.find(c => c.op === 'rotate').args[0];                  // the wheel's turn (the first rotate)
  const ballArc = calls.filter(c => c.op === 'arc' && c.args[2] === 7).at(-1);   // the ball is the circle of radius 7
  const [x, y] = ballArc.args;
  const rel = ((Math.atan2(y - C, x - C) - rot) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
  const slot = Math.round(rel / SEG) % 38;
  return { number: ORDER[slot], offCentre: Math.abs(rel - slot * SEG), radius: Math.hypot(x - C, y - C) };
}

/* ---------------- The wheel ---------------- */
test('wheel: the 38 pockets in the order of a real American wheel, each in its colour (0 and 00 green)', () => {
  const { RV, cv, calls, run } = page();
  RV.createWheel(cv);
  run(16);
  const pockets = [];
  let lastFill = null;
  for (const c of calls) {
    if (c.op === 'fill') lastFill = c.fillStyle;
    if (c.op === 'fillText') pockets.push([c.args[0], lastFill]);
  }
  assert.deepEqual(pockets.map(p => p[0]), ORDER.map(label));
  const colour = n => (n === 0 || n === 37 ? '#0a8a45' : RED.has(n) ? '#c0262d' : '#151515');
  assert.deepEqual(pockets.map(p => p[1]), ORDER.map(colour));
  assert.equal(cv.width, 880, 'drawn sharp on a high-resolution screen (440 × 2)');
});

test('wheel: a spin takes 6.5 s and lands the ball in the pocket of the number called, and it stays there', () => {
  for (const n of [0, 37, 17, 32, 2]) {
    const { RV, cv, calls, run } = page();
    const wheel = RV.createWheel(cv);
    run(500);                                                   // the ball circles before the round
    let landed = 0;
    wheel.spinTo(n, () => { landed++; });
    assert.equal(wheel.spinning, true);
    run(6400);
    assert.equal(landed, 0, 'still spinning just before 6.5 s');
    run(200);
    assert.equal(landed, 1, 'done is called once when it lands');
    assert.equal(wheel.spinning, false);
    run(16);
    let at = ballPosition(calls);
    assert.equal(at.number, n, `the ball is in pocket ${label(n)}`);
    assert.ok(at.offCentre < 0.01, 'in the middle of the pocket');
    assert.ok(at.radius > 108 && at.radius < 142, 'down in the pocket ring, not on the track');
    run(3000);                                                  // the wheel keeps turning slowly…
    at = ballPosition(calls);
    assert.equal(at.number, n, '…and the ball turns with it, in the same pocket');
    assert.equal(landed, 1);
  }
});

test('wheel: a second spin starts from where the ball lies and lands on the new number', () => {
  const { RV, cv, calls, run } = page();
  const wheel = RV.createWheel(cv);
  wheel.spinTo(5); run(6600);
  wheel.spinTo(36); run(6600);
  run(16);
  assert.equal(ballPosition(calls).number, 36);
});

test('wheel: pausing stops the spin (it lands that much later); settle and release while idle', () => {
  const { RV, cv, calls, run } = page();
  const wheel = RV.createWheel(cv);
  let landed = false;
  wheel.spinTo(23, () => { landed = true; });
  run(2000);
  wheel.setPaused(true);
  run(10000);
  assert.equal(landed, false, 'paused: no progress');
  wheel.setPaused(false);
  run(4400);
  assert.equal(landed, false, '6.4 s of spinning so far');
  run(200);
  assert.equal(landed, true);
  run(16);
  assert.equal(ballPosition(calls).number, 23);
  // a phone that joins after the ball landed shows it straight in the pocket
  const late = page();
  const w2 = late.RV.createWheel(late.cv);
  w2.settle(9);
  late.run(16);
  assert.equal(ballPosition(late.calls).number, 9);
  assert.ok(ballPosition(late.calls).radius < 142);
  w2.release();                                                 // next round: the ball goes back to the track
  late.run(1000);
  assert.ok(ballPosition(late.calls).radius > 172, 'circling on the track again');
  // settle doesn't interrupt a spin in progress
  w2.spinTo(4); w2.settle(9); late.run(6600); late.run(16);
  assert.equal(ballPosition(late.calls).number, 4);
});

/* ---------------- Recent Numbers ---------------- */
const els = (width = 300) => ({ box: { clientWidth: width, innerHTML: '', scrollLeft: 0 }, stats: { innerHTML: '' }, sub: { textContent: '' }, hint: { hidden: false } });

test('recent numbers: colour counts, hot numbers (repeats only, top 3), 00 and the latest spin ringed', () => {
  const { RV } = page();
  const e = els();
  const log = [1, 37, 2, 1, 0, 32, 32, 32, 1, 5, 37];          // 1 ×3, 32 ×3, 37 ×2
  RV.renderRecent(e, log);
  assert.equal(e.sub.textContent, 'Last 11 of up to 50 spins at the table');
  assert.match(e.stats.innerHTML, /Red 7<\/span>/);           // 1,1,32,32,32,1,5
  assert.match(e.stats.innerHTML, /Black 1<\/span>/);         // 2
  assert.match(e.stats.innerHTML, /Green 3<\/span>/);         // 37, 0, 37
  assert.deepEqual(plain(RV.hotNumbers(log)), [[1, 3], [32, 3], [37, 2]]);
  assert.match(e.stats.innerHTML, /title="00 came up 2 times"/);
  assert.match(e.box.innerHTML, /aria-label="Last 11 roulette numbers: 1, 00, 2, 1, 0, 32, 32, 32, 1, 5, 00"/);
  assert.equal((e.box.innerHTML.match(/stroke="#d4af37"/g) || []).length, 1, 'one gold ring');
  assert.match(e.box.innerHTML, /data-tip="Spin 11 \(latest\): 00 Green"/);
  assert.deepEqual(plain(RV.hotNumbers([4, 5, 6])), [], 'no repeats: nothing is hot');
});

test('recent numbers: before any spin, a friendly empty state; with many spins it scrolls to the newest', () => {
  const { RV } = page();
  let e = els();
  RV.renderRecent(e, []);
  assert.equal(e.sub.textContent, 'No spins yet');
  assert.match(e.box.innerHTML, /Results will appear here after the first spin/);
  assert.equal(e.hint.hidden, true);
  e = els(300);
  RV.renderRecent(e, [...Array(40)].map((_, k) => k % 38));
  assert.ok(e.box.scrollLeft > 0, 'scrolled right, to the latest spin');
  assert.equal(e.hint.hidden, false, 'and a hint that older spins are to the left');
  e = els(2000);
  RV.renderRecent(e, [3, 4]);
  assert.equal(e.box.scrollLeft, 0);
  assert.equal(e.hint.hidden, true, 'everything fits: no hint');
});

/* ---------------- Payout table ---------------- */
test('payout table: each bet\'s odds, winnings for the stake, and chance of winning on a 38-pocket wheel', () => {
  const { RV } = page();
  const tbody = { innerHTML: '' };
  RV.renderPayouts(tbody, 10, v => '$' + v);
  const rows = tbody.innerHTML.split('</tr>').map(r => r.replace(/\s+/g, ' '));
  const row = name => rows.find(r => r.includes(`<b>${name}</b>`));
  assert.match(row('Straight up'), /35:1.*\+\$350.*\$360.*2\.63% <span class="sub">\(1 in 38\)/);
  assert.match(row('Dozen'), /2:1.*\+\$20.*\$30.*31\.58% <span class="sub">\(12 in 38\)/);
  assert.match(row('Column'), /2:1.*31\.58%/);
  for (const name of ['Red / Black', 'Odd / Even', 'Low / High']) assert.match(row(name), /1:1.*\+\$10.*\$20.*47\.37% <span class="sub">\(18 in 38\)/, name);
  assert.equal((tbody.innerHTML.match(/class="group"/g) || []).length, 2, 'Inside bet / Outside bets headings');
});

/* ---------------- Win / loss by round ---------------- */
test('win / loss chart: the last 12 rounds, wins up in green, losses down in red, an even round as a dot', () => {
  const { RV } = page();
  const card = { innerHTML: '', clientWidth: 300, insertAdjacentHTML(_, h) { this.innerHTML += h; } };
  const results = [...Array(14)].map((_, k) => ({ round: k + 1, net: [10, -5, 0][k % 3] * (k + 1) }));
  RV.renderWinLoss(card, 'Ana "the bold"', results, 125, v => '$' + v);
  assert.match(card.innerHTML, /<b class="pos">\+\$125<\/b>/);
  assert.doesNotMatch(card.innerHTML, /Round 1:|Round 2:/, 'only the last 12 rounds');
  assert.match(card.innerHTML, /data-tip="Round 14: -\$70"/);
  assert.match(card.innerHTML, /data-tip="Round 13: \+\$130"/);
  assert.match(card.innerHTML, /data-tip="Round 3: even"/);
  assert.equal((card.innerHTML.match(/fill="#4ade80"/g) || []).length, 4, 'four wins (rounds 4, 7, 10, 13)');
  assert.equal((card.innerHTML.match(/fill="#f87171"/g) || []).length, 4, 'four losses');
  assert.equal((card.innerHTML.match(/<circle /g) || []).length, 4, 'four even rounds as dots');
  assert.match(card.innerHTML, /aria-label="Ana the bold: round 3 \$0/, 'quotes removed from the name');
  const win = card.innerHTML.match(/<path d="M[\d.]+ 35 V([\d.]+)/);
  assert.ok(+win[1] < 35, 'a win\'s bar goes up from the middle line');
  const empty = { innerHTML: '', clientWidth: 300, insertAdjacentHTML(_, h) { this.innerHTML += h; } };
  RV.renderWinLoss(empty, 'Bob', [], 0, v => '$' + v);
  assert.match(empty.innerHTML, /No rounds played yet/);
  const lost = { innerHTML: '', clientWidth: 300, insertAdjacentHTML(_, h) { this.innerHTML += h; } };
  RV.renderWinLoss(lost, 'Cy', [{ round: 1, net: -50 }], -50, v => '$' + v);
  assert.match(lost.innerHTML, /<b class="neg">-\$50<\/b>/);
});
