// Business (Beta): the picture in the middle of each board. Each city is a painted collage of three or four of its best-known
// landmarks and a touch of daily life, drawn from reference photos, on a 1000 × 1000 canvas that business.js scales into
// the board. Ids start with "bzA<board>" so business.js can make them unique per drawing.
(function () {
  const f = n => Math.round(n * 10) / 10;
  const seeded = seed => { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const stops = list => list.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
  const lg = (id, list, x1 = 0, y1 = 0, x2 = 0, y2 = 1, user) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops(list)}</linearGradient>`;
  const rg = (id, list, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;
  const blur = (id, d) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${d}"/></filter>`;
  const pts = list => list.map(p => `${f(p[0])} ${f(p[1])}`).join(' L');
  const poly = (list, fill, extra = '') => `<path d="M${pts(list)} Z" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
  const line = (x1, y1, x2, y2, col, w, extra = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}"${extra ? ' ' + extra : ''}/>`;
  const rect = (x, y, w, h, fill, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
  const circ = (x, y, r, fill, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
  const ell = (x, y, rx, ry, fill, extra = '') => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
  // a smooth curve through points (monotone, so a profile never overshoots): returns x → y
  const curve = list => {
    const n = list.length, xs = list.map(p => p[0]), ys = list.map(p => p[1]), d = [], m = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 3 * (d[i - 1] + d[i]) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
    return x => {
      let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = Math.min(1, Math.max(0, (x - xs[i]) / h)), t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  };
  // soft clouds: puffs of ellipses, lit from one side, blurred a little
  const cloud = (cx, cy, s, lit, shade, filt) => `<g filter="url(#${filt})">${ell(cx, cy + 6 * s, 70 * s, 16 * s, shade)}${ell(cx - 30 * s, cy, 34 * s, 20 * s, lit)}${ell(cx + 4 * s, cy - 10 * s, 40 * s, 26 * s, lit)}${ell(cx + 40 * s, cy, 30 * s, 17 * s, lit)}</g>`;
  // a row of leafy trees standing on y = base: each a clump of overlapping round masses, dark below, lit at the top left
  const trees = (r, x0, x1, base, hMin, hMax, dark, mid, lite) => {
    let s = '';
    for (let x = x0; x < x1;) {
      const w = 22 + r() * 26, h = hMin + r() * (hMax - hMin), cx = x + w / 2, top = base - h;
      const blobs = [...Array(7)].map(() => [cx + (r() - 0.5) * w * 0.8, top + h * (0.25 + r() * 0.5), w * (0.2 + r() * 0.16)]);
      s += blobs.map(([bx, by, br]) => circ(bx, by, br, dark)).join('') + ell(cx, base - h * 0.12, w * 0.45, h * 0.14, dark);
      s += blobs.map(([bx, by, br]) => circ(bx - br * 0.18, by - br * 0.2, br * 0.78, mid)).join('');
      s += blobs.filter(b => b[1] < top + h * 0.5).map(([bx, by, br]) => circ(bx - br * 0.35, by - br * 0.38, br * 0.38, lite)).join('');
      x += w * (0.5 + r() * 0.3);
    }
    return s;
  };
  // glittering water: short horizontal strokes, denser and brighter near a light source
  const glitter = (r, x0, x1, y0, y1, col, n, cx, spread) => {
    let s = '';
    for (let k = 0; k < n; k++) {
      const y = y0 + Math.pow(r(), 1.3) * (y1 - y0), near = cx == null ? x0 + r() * (x1 - x0) : cx + (r() - 0.5) * spread * (0.4 + (y - y0) / (y1 - y0)), len = 6 + r() * 26 * (0.5 + (y - y0) / (y1 - y0));
      s += line(near - len / 2, y, near + len / 2, y, col, 1 + r() * 1.6, `opacity="${f(0.25 + r() * 0.6)}" stroke-linecap="round"`);
    }
    return s;
  };
  // a grid of windows on a façade
  const windows = (x, y, w, h, cols, rows, col, ww = 0.45, wh = 0.55, extra = '') => {
    let s = '';
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) s += rect(x + (i + (1 - ww) / 2) * w / cols, y + (j + (1 - wh) / 2) * h / rows, w / cols * ww, h / rows * wh, col, extra);
    return s;
  };

  /* ---------------- Paris: the Eiffel Tower, the Arc de Triomphe, the Louvre and its pyramid, Sacré-Cœur on Montmartre,
     the Seine with a bateau-mouche, lamps and the green bookstalls of the quays; a golden evening ---------------- */
  function paris() {
    const K = 'bzAparis', r = seeded(1889), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    let d = lg(id('sky'), [[0, '#3f5f9a'], [0.32, '#8aa3cf'], [0.58, '#e9c3a6'], [0.74, '#f5b377'], [0.8, '#f8a65c']])
      + rg(id('sun'), [[0, '#fff6dc'], [0.12, '#ffe2a8', 0.9], [0.4, '#ffc47a', 0.35], [1, '#ffb366', 0]])
      + lg(id('haze'), [[0, '#f6c08a', 0], [1, '#f6c08a', 0.75]])
      + lg(id('river'), [[0, '#6f7fa6'], [0.35, '#3d4f7c'], [1, '#1d2747']])
      + lg(id('iron'), [[0, '#d69a5c'], [0.45, '#8a5a36'], [1, '#4a2e1c']], 0, 0, 1, 0)
      + lg(id('stone'), [[0, '#fbe7c6'], [1, '#d9b98d']], 0, 0, 1, 0)
      + lg(id('stoneSide'), [[0, '#b8946c'], [1, '#8c6c4c']], 0, 0, 1, 0)
      + lg(id('glass'), [[0, '#ffe8b0'], [0.5, '#f2b765'], [1, '#c77d3a']], 0, 0, 1, 1)
      + lg(id('glassR'), [[0, '#b8794a'], [1, '#6e4630']], 0, 0, 1, 1)
      + lg(id('slate'), [[0, '#7d8aa3'], [1, '#4b5670']])
      + lg(id('quay'), [[0, '#d7bf9c'], [1, '#a88e6c']])
      + blur(id('b3'), 3) + blur(id('b8'), 8) + blur(id('b1'), 1)
      + `<pattern id="${id('lat')}" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0 L7 7 M7 0 L0 7" stroke="#4a2e1c" stroke-width="0.9"/></pattern>`;
    let s = rect(0, 0, 1000, 1000, u('sky'));
    s += circ(230, 650, 330, u('sun'));
    s += cloud(170, 220, 1.6, '#f9e3cf', '#c9a8b6', id('b3')) + cloud(520, 300, 1.1, '#fbd9bb', '#c3a0b0', id('b3')) + cloud(760, 380, 0.9, '#fcd3ad', '#bf98a6', id('b3')) + cloud(380, 420, 0.7, '#fde0bd', '#d0a9aa', id('b3'));

    // Montmartre and Sacré-Cœur, far away and hazy
    const hillC = curve([[0, 640], [60, 600], [150, 556], [250, 566], [330, 610], [420, 660]]);
    s += `<path d="M0 700 ${[...Array(43)].map((_, k) => `L${k * 10} ${f(hillC(k * 10))}`).join(' ')} L420 700 Z" fill="#c7a6b1"/>`;
    s += trees(r, 0, 400, 640, 10, 22, '#a98f9e', '#b79ba9', '#c9aeb6');
    const sc = (cx, base) => {
      const w = '#f7ebe4', sh = '#d9c3c6', o = [];
      o.push(rect(cx - 52, base - 46, 104, 46, w), rect(cx + 20, base - 46, 32, 46, sh));                      // the body
      o.push(rect(cx - 22, base - 70, 44, 26, w), rect(cx + 6, base - 70, 16, 26, sh));                       // the drum
      o.push(`<path d="M${cx - 24} ${base - 70} C${cx - 26} ${base - 110} ${cx - 6} ${base - 124} ${cx} ${base - 128} C${cx + 6} ${base - 124} ${cx + 26} ${base - 110} ${cx + 24} ${base - 70} Z" fill="${w}"/>`);
      o.push(`<path d="M${cx + 4} ${base - 127} C${cx + 18} ${base - 114} ${cx + 26} ${base - 100} ${cx + 24} ${base - 70} H${cx + 8} C${cx + 12} ${base - 96} ${cx + 10} ${base - 114} ${cx + 4} ${base - 127} Z" fill="${sh}"/>`);
      o.push(rect(cx - 4, base - 144, 8, 17, w), `<path d="M${cx - 5} ${base - 144} Q${cx} ${base - 156} ${cx + 5} ${base - 144} Z" fill="${w}"/>`, line(cx, base - 156, cx, base - 166, w, 1.6));
      [[-40, 0.62], [40, 0.62]].forEach(([dx, sz]) => { o.push(rect(cx + dx - 9, base - 64, 18, 20, w), `<path d="M${cx + dx - 10} ${base - 64} C${cx + dx - 10} ${base - 80} ${cx + dx} ${base - 86} ${cx + dx} ${base - 88} C${cx + dx} ${base - 86} ${cx + dx + 10} ${base - 80} ${cx + dx + 10} ${base - 64} Z" fill="${w}"/>`, line(cx + dx, base - 88, cx + dx, base - 95, w, 1.4)); });
      o.push(rect(cx + 64, base - 112, 18, 112, w), rect(cx + 74, base - 112, 8, 112, sh), `<path d="M${cx + 63} ${base - 112} Q${cx + 73} ${base - 132} ${cx + 83} ${base - 112} Z" fill="${w}"/>`, line(cx + 73, base - 132, cx + 73, base - 140, w, 1.4));   // the bell tower
      for (let k = 0; k < 3; k++) o.push(`<path d="M${cx - 30 + k * 22} ${base} V${base - 22} A9 9 0 0 1 ${cx - 12 + k * 22} ${base - 22} V${base} Z" fill="#c9aeb2"/>`);
      for (let k = 0; k < 8; k++) o.push(rect(cx - 19 + k * 5, base - 66, 2, 12, '#cdb6b8'));
      return `<g opacity="0.92">${o.join('')}</g>`;
    };
    s += sc(165, 566);
    s += rect(0, 540, 1000, 160, u('haze'));

    // the city's roofs, layer behind layer, in the evening haze
    for (const [base, col, hh] of [[700, '#b993a0', 40], [722, '#a57f90', 34]]) {
      let x = -10, p = `M-10 760`;
      while (x < 1010) { const w = 26 + r() * 40, h = hh * (0.6 + r() * 0.6); p += ` L${f(x)} ${f(base - h)} L${f(x + 6)} ${f(base - h - 10)} L${f(x + w - 6)} ${f(base - h - 10)} L${f(x + w)} ${f(base - h)}`; x += w; }
      s += `<path d="${p} L1010 760 Z" fill="${col}"/>`;
    }

    // the Arc de Triomphe, three-quarter view, lit from the left
    const arc = (x, base, w, h) => {
      const o = [], sd = w * 0.26, side = '#a7896a', face = u('stone');
      o.push(poly([[x + w, base], [x + w + sd, base - sd * 0.35], [x + w + sd, base - h - sd * 0.35], [x + w, base - h]], u('stoneSide')));
      o.push(rect(x, base - h, w, h, face));
      // the side arch
      o.push(`<path d="M${f(x + w + sd * 0.25)} ${f(base - sd * 0.09)} V${f(base - h * 0.42)} A${f(sd * 0.25)} ${f(sd * 0.3)} 0 0 1 ${f(x + w + sd * 0.75)} ${f(base - h * 0.42 - sd * 0.18)} V${f(base - sd * 0.26)} Z" fill="#5d4535"/>`);
      // the great arch
      const aw = w * 0.36, ax = x + w / 2 - aw / 2, ah = h * 0.6;
      o.push(`<path d="M${f(ax)} ${base} V${f(base - ah + aw / 2)} A${f(aw / 2)} ${f(aw / 2)} 0 0 1 ${f(ax + aw)} ${f(base - ah + aw / 2)} V${base} Z" fill="#6b4f3d"/>`);
      o.push(`<path d="M${f(ax + aw * 0.55)} ${base} V${f(base - ah + aw / 2)} A${f(aw / 2)} ${f(aw / 2)} 0 0 1 ${f(ax + aw)} ${f(base - ah + aw / 2)} V${base} Z" fill="#f4b46c" opacity="0.55"/>`);
      o.push(`<path d="M${f(ax - 3)} ${f(base - ah + aw / 2)} A${f(aw / 2 + 3)} ${f(aw / 2 + 3)} 0 0 1 ${f(ax + aw + 3)} ${f(base - ah + aw / 2)}" stroke="#c9a77f" stroke-width="2.5" fill="none"/>`);
      // the reliefs on the piers, the frieze, the cornices, the attic
      [x + w * 0.06, x + w * 0.73].forEach(px => { o.push(rect(px, base - h * 0.42, w * 0.21, h * 0.3, '#e6cfa9'), ell(px + w * 0.1, base - h * 0.28, w * 0.07, h * 0.12, '#c4a47c'), ell(px + w * 0.08, base - h * 0.36, w * 0.035, h * 0.05, '#bf9f77')); o.push(rect(px, base - h * 0.84, w * 0.21, h * 0.16, '#e6cfa9'), ell(px + w * 0.1, base - h * 0.76, w * 0.08, h * 0.05, '#c9aa82')); });
      o.push(rect(x - 3, base - h * 0.66, w + 6, h * 0.035, '#d8bd96'), rect(x - 4, base - h * 0.88, w + 8, h * 0.04, '#f6e3c3'), rect(x, base - h * 0.85, w, h * 0.12, '#ead4ae'));
      for (let k = 0; k < 14; k++) o.push(circ(x + w * 0.05 + k * w * 0.068, base - h * 0.94, w * 0.02, '#c9aa82'));
      o.push(rect(x - 4, base - h - 4, w + 8, 6, '#fbecd0'));
      o.push(line(x, base - h, x, base, '#fff4dc', 1.5, 'opacity="0.8"'));
      return o.join('');
    };
    s += arc(208, 742, 120, 136);
    s += trees(r, 120, 400, 750, 18, 34, '#4f5a3a', '#6b7547', '#8e9358');

    // the Louvre: a wing of the palace with its pavilion, and the glass pyramid glowing in front
    const louvre = () => {
      const o = [], base = 792;
      o.push(rect(360, base - 70, 360, 70, u('stone')));
      o.push(poly([[352, base - 70], [728, base - 70], [716, base - 92], [364, base - 92]], u('slate')));
      for (let k = 0; k < 16; k++) o.push(rect(376 + k * 21.5, base - 88, 7, 10, '#e9d6b4'), rect(373 + k * 21.5, base - 58, 10, 18, '#7a5a42'), rect(373 + k * 21.5, base - 30, 10, 20, '#6d4e39'));
      o.push(rect(490, base - 104, 100, 104, u('stone')), poly([[482, base - 104], [598, base - 104], [580, base - 146], [500, base - 146]], u('slate')));
      for (let k = 0; k < 4; k++) o.push(rect(500 + k * 22, base - 96, 12, 22, '#76563f'), rect(500 + k * 22, base - 62, 12, 24, '#6d4e39'));
      o.push(rect(520, base - 140, 40, 14, '#efe0c4'), circ(540, base - 133, 5, '#b89a72'));
      o.push(line(360, base - 72, 720, base - 72, '#fff2d6', 2));
      // the pyramid: two faces, the lit one warm, the grid of its panes, people at its feet
      const px = 545, pw = 240, ph = 150, apex = [px, base + 8 - ph];
      o.push(poly([[px - pw / 2, base + 8], apex, [px + 18, base + 8]], u('glass')), poly([[px + 18, base + 8], apex, [px + pw / 2, base + 8]], u('glassR')));
      // panes: lines parallel to each sloping edge of each face
      const grid = (a, b, c, col) => { let g = ''; for (let k = 1; k < 10; k++) { const t = k / 10; const p1 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], p2 = [c[0] + (b[0] - c[0]) * t, c[1] + (b[1] - c[1]) * t]; g += line(p1[0], p1[1], a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, col, 0.7) + line(p2[0], p2[1], c[0] + (a[0] - c[0]) * t, c[1] + (a[1] - c[1]) * t, col, 0.7); } return g; };
      o.push(`<g opacity="0.75">${grid([px - pw / 2, base + 8], apex, [px + 18, base + 8], '#8a5a2e')}${grid([px + 18, base + 8], apex, [px + pw / 2, base + 8], '#3f2a1c')}</g>`);
      o.push(line(apex[0], apex[1], px + 18, base + 8, '#fff1c8', 1.6), line(apex[0], apex[1], px - pw / 2, base + 8, '#fff6dc', 1.2));
      o.push(ell(px - 30, base - 18, 46, 22, '#fff1c0', `opacity="0.35" filter="url(#${id('b8')})"`));
      for (let k = 0; k < 9; k++) { const xx = 400 + r() * 300; o.push(rect(xx, base + 1, 2.6, 8, '#3a2a22'), circ(xx + 1.3, base, 1.8, '#3a2a22')); }
      return o.join('');
    };
    s += louvre();

    // the Eiffel Tower: the real profile (324 m tall, 125 m wide at the base), four legs that join above the second floor,
    // the great arch under the first floor, criss-cross girders everywhere; warm iron, lit from the setting sun
    const eiffel = (cx, base, H) => {
      const k = H / 324, Z = z => base - z * k, hw = curve([[0, 62.5], [57, 37], [115, 21], [180, 12.5], [240, 8.4], [276, 6.6], [300, 3.2], [324, 0.8]]);
      const inner = curve([[0, 36], [30, 30], [57, 23], [90, 15], [115, 9]]), X = (z, side, fn = hw) => cx + side * fn(z) * k;
      const o = [], iron = u('iron'), dark = '#3d2617', lite = '#c98a52';
      const girder = (zs, side, fnA, fnB, n, wEdge = 2.6) => {
        const K = 'bzAparis';
        // a leg (or a half-shaft) between two profiles, with its edges and X-bracing in n panels
        let g = '', top = zs[1], bot = zs[0];
        const pA = [], pB = [];
        for (let i = 0; i <= 24; i++) { const z = bot + (top - bot) * i / 24; pA.push([X(z, side, fnA), Z(z)]); pB.push([X(z, side, fnB), Z(z)]); }
        const shape = `M${pts(pA)} L${pts(pB.slice().reverse())} Z`;
        g += `<path d="${shape}" fill="${iron}" opacity="0.4"/><path d="${shape}" fill="url(#${K}-lat)" opacity="0.8"/>`;
        g += `<path d="M${pts(pA)}" stroke="${side < 0 ? lite : dark}" stroke-width="${wEdge}" fill="none"/><path d="M${pts(pB)}" stroke="${side < 0 ? '#b77a48' : '#5b3a24'}" stroke-width="${wEdge * 0.8}" fill="none"/>`;
        for (let i = 0; i < n; i++) {
          const z0 = bot + (top - bot) * i / n, z1 = bot + (top - bot) * (i + 1) / n;
          const a0 = [X(z0, side, fnA), Z(z0)], b0 = [X(z0, side, fnB), Z(z0)], a1 = [X(z1, side, fnA), Z(z1)], b1 = [X(z1, side, fnB), Z(z1)];
          g += line(a0[0], a0[1], b1[0], b1[1], side < 0 ? '#c98a55' : '#6a4329', 1.1) + line(b0[0], b0[1], a1[0], a1[1], side < 0 ? '#c98a55' : '#6a4329', 1.1) + line(a1[0], a1[1], b1[0], b1[1], side < 0 ? '#d79a62' : '#5b3a24', 1.4);
          // the finer lattice inside each panel
          const m0 = [(a0[0] + b0[0]) / 2, a0[1]], m1 = [(a1[0] + b1[0]) / 2, a1[1]];
          g += line(m0[0], m0[1], m1[0], m1[1], '#7a4f31', 0.6, 'opacity="0.7"');
        }
        return g;
      };
      // the legs up to the first floor, then the pillars up to the second, then the single shaft
      for (const side of [-1, 1]) {
        o.push(girder([0, 57], side, hw, inner, 7, 3.2));
        o.push(girder([57, 115], side, hw, inner, 6, 2.4));
      }
      const centre = () => 0;
      for (const side of [-1, 1]) o.push(girder([115, 276], side, hw, centre, 14, 2));
      // the middle face between the pillars from the first to the second floor (seen through)
      for (let i = 0; i < 5; i++) { const z0 = 57 + i * 11.6, z1 = z0 + 11.6; o.push(line(X(z0, -1, inner), Z(z0), X(z1, 1, inner), Z(z1), '#6a4329', 0.7, 'opacity="0.6"'), line(X(z0, 1, inner), Z(z0), X(z1, -1, inner), Z(z1), '#6a4329', 0.7, 'opacity="0.6"')); }
      // the great arch between the legs
      const ax0 = X(4, -1, inner), ax1 = X(4, 1, inner), atop = Z(50);
      o.push(`<path d="M${f(ax0)} ${f(Z(4))} C${f(ax0 + 8)} ${f(atop - 6)} ${f(ax1 - 8)} ${f(atop - 6)} ${f(ax1)} ${f(Z(4))}" stroke="${dark}" stroke-width="3.2" fill="none"/>`);
      o.push(`<path d="M${f(ax0 + 4)} ${f(Z(10))} C${f(ax0 + 14)} ${f(atop + 4)} ${f(ax1 - 14)} ${f(atop + 4)} ${f(ax1 - 4)} ${f(Z(10))}" stroke="#7a4f31" stroke-width="1.4" fill="none"/>`);
      // the lattice between the arch and the first floor
      o.push(`<path d="M${f(ax0)} ${f(Z(4))} C${f(ax0 + 8)} ${f(atop - 6)} ${f(ax1 - 8)} ${f(atop - 6)} ${f(ax1)} ${f(Z(4))} L${f(X(57, 1, inner))} ${f(Z(57))} L${f(X(57, -1, inner))} ${f(Z(57))} Z" fill="url(#${K}-lat)" opacity="0.55"/>`);
      // the floors: deep bands with a row of little arches (the first), railings, lights
      const floor = (z, half, hgt, arches) => {
        const y = Z(z + hgt), hh = hgt * k, x0 = cx - half * k, w = half * 2 * k;
        let g = rect(x0, y, w, hh, '#5b3a24') + rect(x0, y, w * 0.45, hh, '#a8703f', 'opacity="0.7"') + rect(x0 - 2, y - 2.5, w + 4, 2.5, '#f2c27f');
        if (arches) for (let i = 0; i < arches; i++) g += `<path d="M${f(x0 + (i + 0.15) * w / arches)} ${f(y + hh)} v${f(-hh * 0.45)} a${f(w / arches * 0.35)} ${f(w / arches * 0.3)} 0 0 1 ${f(w / arches * 0.7)} 0 v${f(hh * 0.45)} Z" fill="#2f1d12" opacity="0.6"/>`;
        for (let i = 0; i < Math.floor(w / 5); i++) g += circ(x0 + 2 + i * 5, y + hh * 0.3, 0.9, '#ffe0a0', 'opacity="0.8"');
        return g;
      };
      o.push(floor(57, 42, 7.5, 12), floor(115, 23.5, 4.5, 7), floor(276, 8.2, 3.5, 0));
      // the top: the campanile, the lantern and the antenna
      o.push(rect(cx - 5.2 * k, Z(292), 10.4 * k, 16 * k, '#5b3a24'), rect(cx - 5.2 * k, Z(292), 4.6 * k, 16 * k, '#b07848'));
      o.push(poly([[cx - 6 * k, Z(292)], [cx, Z(299)], [cx + 6 * k, Z(292)]], '#4a2e1c'), rect(cx - 2.6 * k, Z(306), 5.2 * k, 7 * k, '#6a4329'), line(cx, Z(306), cx, Z(330), '#4a2e1c', 1.6), line(cx - 1.5, Z(312), cx + 1.5, Z(312), '#4a2e1c', 1), circ(cx, Z(299), 2.2, '#fff1c0'));
      // the base: the feet on their stone piers
      for (const side of [-1, 1]) o.push(rect(X(0, side) - (side < 0 ? 4 : 30 * k - 4), base - 5, 30 * k + 8, 6, '#b49a7c'));
      return o.join('');
    };
    s += trees(r, 640, 1010, 792, 28, 52, '#3f4a2e', '#596538', '#7b8447');
    s += eiffel(862, 790, 620);
    s += rect(600, 772, 400, 20, '#4b5530', 'opacity="0.55"');
    s += rect(0, 0, 1000, 1000, u('haze'), 'opacity="0.15"');

    // the quay: a stone wall, bookstalls, lamps; the river with the sun's glitter, a bateau-mouche
    s += rect(0, 792, 1000, 22, u('quay')) + rect(0, 792, 1000, 3, '#f1dcb9');
    for (let k = 0; k < 10; k++) { const bx = 30 + k * 98 + r() * 20; s += rect(bx, 782, 34, 12, '#2f5d3a') + rect(bx, 780, 34, 3, '#3e7a4b'); }
    for (let k = 0; k < 8; k++) { const lx = 60 + k * 125; s += line(lx, 792, lx, 748, '#2b2420', 2.2) + line(lx - 7, 754, lx + 7, 754, '#2b2420', 1.4) + circ(lx - 7, 751, 3.6, '#ffe6a6') + circ(lx + 7, 751, 3.6, '#ffe6a6') + circ(lx, 746, 4.4, '#fff1c4') + circ(lx, 748, 10, '#ffd98a', 'opacity="0.25"'); }
    s += rect(0, 814, 1000, 186, u('river'));
    s += `<g opacity="0.35">${rect(808, 814, 110, 140, '#8a5a36', `filter="url(#${id('b8')})"`)}${rect(200, 814, 150, 60, '#e9d2b0', `filter="url(#${id('b8')})"`)}${rect(420, 814, 260, 50, '#f2c27f', `filter="url(#${id('b8')})"`)}</g>`;
    s += glitter(r, 0, 1000, 818, 1000, '#ffd59a', 150, 240, 420) + glitter(r, 0, 1000, 818, 1000, '#cdd6f0', 60);
    const boat = (bx, by) => `<g>${poly([[bx - 130, by], [bx + 120, by], [bx + 140, by - 12], [bx - 138, by - 12]], '#f4efe6')}${rect(bx - 120, by - 30, 220, 18, '#2c3a52')}${windows(bx - 116, by - 29, 212, 15, 18, 1, '#ffe0a0', 0.6, 0.7)}${rect(bx - 124, by - 33, 228, 4, '#f4efe6')}${poly([[bx - 130, by], [bx + 120, by], [bx + 116, by + 4], [bx - 126, by + 4]], '#1b2238')}</g>`;
    s += boat(520, 900) + ell(520, 912, 150, 6, '#0f152b', 'opacity="0.5"');
    return `<defs>${d}</defs>${s}`;
  }


  // lit windows on dark towers: a few patterns of lit and dark panes, so a skyline costs little to draw
  const winPatterns = (K, lit, dark, sizes = [[5, 7], [4, 6], [6, 8]]) => sizes.map(([w, h], k) => {
    const r = seeded(97 + k * 31); let cells = '';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) cells += rect(i * w + w * 0.2, j * h + h * 0.22, w * 0.6, h * 0.56, r() < 0.42 ? lit : dark, r() < 0.42 ? '' : '');
    return `<pattern id="${K}-win${k}" width="${w * 6}" height="${h * 6}" patternUnits="userSpaceOnUse">${cells}</pattern>`;
  }).join('');

  /* ---------------- New York: the Statue of Liberty, the Empire State and Chrysler buildings, One World Trade Center,
     the Brooklyn Bridge over the East River, yellow cabs; the blue hour, the city lighting up ---------------- */
  function newyork() {
    const K = 'bzAnewyork', r = seeded(1931), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    var d = lg(id('sky'), [[0, '#0e1838'], [0.35, '#27396b'], [0.6, '#7a5a8c'], [0.74, '#e0806a'], [0.8, '#f6a65e']])
      + lg(id('river'), [[0, '#3a3f66'], [0.4, '#1f2547'], [1, '#0b0f24']])
      + lg(id('haze'), [[0, '#f09a6a', 0], [1, '#f09a6a', 0.55]])
      + lg(id('tower'), [[0, '#3b4466'], [1, '#1c2140']], 0, 0, 1, 0)
      + lg(id('tower2'), [[0, '#566089'], [1, '#2c3456']], 0, 0, 1, 0)
      + lg(id('esb'), [[0, '#c9b9a3'], [0.5, '#8f8296'], [1, '#4a4766']], 0, 0, 1, 0)
      + lg(id('steel'), [[0, '#f4f1ea'], [0.5, '#b8bccb'], [1, '#5c6380']], 0, 0, 1, 0)
      + lg(id('copper'), [[0, '#9fdcc4'], [0.5, '#5ea88e'], [1, '#2e6b5b']], 0, 0, 1, 0)
      + lg(id('granite'), [[0, '#d9c7ae'], [1, '#8f7d6c']], 0, 0, 1, 0)
      + lg(id('bstone'), [[0, '#d8bfa0'], [1, '#8d7559']], 0, 0, 1, 0)
      + rg(id('sun'), [[0, '#ffd9a0', 0.9], [0.4, '#f6a65e', 0.35], [1, '#f6a65e', 0]])
      + rg(id('flame'), [[0, '#fff7cf'], [0.5, '#ffcf4a'], [1, '#ff9a1f', 0]])
      + blur(id('b3'), 3) + blur(id('b6'), 6)
      + winPatterns(K, '#ffd98a', '#26304f') + winPatterns(K + 'b', '#b9c6e8', '#3a456b', [[4, 5], [3, 5], [5, 6]]);
    let s = rect(0, 0, 1000, 1000, u('sky'));
    s += circ(520, 760, 420, u('sun'));
    for (let k = 0; k < 60; k++) s += circ(r() * 1000, r() * 330, 0.6 + r() * 1.2, '#fff', `opacity="${f(0.3 + r() * 0.6)}"`);
    s += `<g opacity="0.55">${cloud(800, 330, 1.4, '#c99aa6', '#6c5a84', id('b3'))}${cloud(300, 300, 1.1, '#b48aa0', '#5f4f7c', id('b3'))}</g>`;

    // the back row of towers, hazy blue, then the front row, dark with lit windows
    const row = (x0, x1, base, hMin, hMax, fill, pat, gap) => {
      let o = '';
      for (let x = x0; x < x1;) {
        const w = 22 + r() * 38, h = hMin + r() * (hMax - hMin), top = base - h;
        o += rect(x, top, w, h, fill) + rect(x + 2, top + 6, w - 4, h - 6, `url(#${pat}${Math.floor(r() * 3)})`, 'opacity="0.9"');
        if (r() < 0.35) o += rect(x + w * 0.2, top - h * 0.12, w * 0.6, h * 0.12, fill) + rect(x + w * 0.2 + 2, top - h * 0.12 + 4, w * 0.6 - 4, h * 0.12 - 4, `url(#${pat}0)`, 'opacity="0.8"');
        if (r() < 0.2) o += line(x + w / 2, top - (r() < 0.5 ? h * 0.12 : 0), x + w / 2, top - h * 0.25, fill, 2);
        x += w + gap;
      }
      return o;
    };
    s += row(150, 1000, 770, 60, 210, u('tower2'), K + 'b-win', 1);
    s += rect(0, 560, 1000, 220, u('haze'), 'opacity="0.6"');

    // One World Trade Center: a square tower whose chamfered corners make eight tall triangles; the spire on top
    const owtc = (cx, base, h) => {
      const w = h * 0.2, top = base - h, tw = w * 0.5;
      return poly([[cx - w / 2, base], [cx - tw / 2, top], [cx, top], [cx, base]], '#8fa3c9') + poly([[cx, base], [cx, top], [cx + tw / 2, top], [cx + w / 2, base]], '#4d5f8a')
        + poly([[cx - w / 2, base], [cx - tw / 2, top], [cx - w * 0.36, base]], '#b5c5e3', 'opacity="0.7"') + poly([[cx + w / 2, base], [cx + tw / 2, top], [cx + w * 0.36, base]], '#33416a', 'opacity="0.8"')
        + rect(cx - w / 2, base - h * 0.16, w, h * 0.16, '#2f3a5e') + rect(cx - tw / 2 - 2, top - 6, tw + 4, 6, '#6b7fa8')
        + line(cx, top - 6, cx, top - h * 0.38, '#c8d2e8', 2.2) + line(cx - 4, top - h * 0.08, cx + 4, top - h * 0.08, '#c8d2e8', 1.2) + circ(cx, top - h * 0.38, 2.4, '#ff6b6b');
    };
    s += owtc(262, 770, 330);

    // the Empire State Building: the wide base, the long shaft of limestone piers, the setbacks, the art-deco mast
    const esb = (cx, base, h) => {
      const o = [], W = h * 0.21, col = u('esb');
      const block = (y0, y1, w) => { o.push(rect(cx - w / 2, y1, w, y0 - y1, col)); o.push(rect(cx - w / 2 + 3, y1 + 4, w - 6, y0 - y1 - 8, `url(#${K}-win1)`, 'opacity="0.55"')); for (let i = 1; i < w / 7; i++) o.push(line(cx - w / 2 + i * 7, y1 + 2, cx - w / 2 + i * 7, y0, i * 7 < w * 0.45 ? '#e8dcc8' : '#56506e', 1.1, 'opacity="0.75"')); };
      block(base, base - h * 0.1, W * 1.7);
      block(base - h * 0.1, base - h * 0.16, W * 1.25);
      block(base - h * 0.16, base - h * 0.78, W);
      // the piers stand proud on the central bay
      o.push(rect(cx - W * 0.14, base - h * 0.8, W * 0.28, h * 0.64, '#d8cab3', 'opacity="0.35"'));
      block(base - h * 0.78, base - h * 0.84, W * 0.82);
      block(base - h * 0.84, base - h * 0.88, W * 0.62);
      // the crown: lit floors, the mast and the antenna
      o.push(rect(cx - W * 0.42, base - h * 0.93, W * 0.84, h * 0.05, '#fbe3a6'), rect(cx - W * 0.42, base - h * 0.93, W * 0.84, h * 0.05, `url(#${K}-win2)`, 'opacity="0.3"'));
      o.push(rect(cx - W * 0.3, base - h * 0.97, W * 0.6, h * 0.04, '#f6d27f'));
      o.push(`<path d="M${f(cx - W * 0.2)} ${f(base - h * 0.97)} L${f(cx - W * 0.16)} ${f(base - h * 1.08)} Q${f(cx)} ${f(base - h * 1.14)} ${f(cx + W * 0.16)} ${f(base - h * 1.08)} L${f(cx + W * 0.2)} ${f(base - h * 0.97)} Z" fill="#e9d7b0"/>`);
      o.push(`<path d="M${f(cx + 1)} ${f(base - h * 1.12)} Q${f(cx + W * 0.1)} ${f(base - h * 1.1)} ${f(cx + W * 0.16)} ${f(base - h * 1.08)} L${f(cx + W * 0.2)} ${f(base - h * 0.97)} H${f(cx + 1)} Z" fill="#a8946f"/>`);
      for (let i = 0; i < 5; i++) o.push(line(cx - W * 0.12 + i * W * 0.06, base - h * 0.975, cx - W * 0.1 + i * W * 0.05, base - h * 1.09, '#fff3d0', 0.8));
      o.push(rect(cx - W * 0.05, base - h * 1.18, W * 0.1, h * 0.06, '#d9c59a'), line(cx, base - h * 1.18, cx, base - h * 1.34, '#c9c3c0', 2.2), circ(cx, base - h * 1.34, 2.2, '#ff5a5a'));
      o.push(ell(cx, base - h * 0.95, W * 0.9, h * 0.07, '#ffd98a', `opacity="0.35" filter="url(#${K}-b6)"`));
      return o.join('');
    };
    // the Chrysler Building: setbacks, then the steel crown of seven arches with triangular windows, and the needle
    const chrysler = (cx, base, h) => {
      const o = [], W = h * 0.17;
      o.push(rect(cx - W * 0.9, base - h * 0.2, W * 1.8, h * 0.2, u('tower')), rect(cx - W * 0.9 + 3, base - h * 0.2 + 4, W * 1.8 - 6, h * 0.2 - 6, `url(#${K}-win0)`, 'opacity="0.8"'));
      o.push(rect(cx - W / 2, base - h * 0.74, W, h * 0.54, u('steel')), rect(cx - W / 2 + 2, base - h * 0.74 + 3, W - 4, h * 0.54 - 6, `url(#${K}-win1)`, 'opacity="0.55"'));
      for (let i = 1; i < 6; i++) o.push(line(cx - W / 2 + i * W / 6, base - h * 0.74, cx - W / 2 + i * W / 6, base - h * 0.2, '#e9ecf5', 0.8, 'opacity="0.6"'));
      o.push(rect(cx - W * 0.56, base - h * 0.62, W * 1.12, 3, '#f4f1ea'));                     // the eagle-gargoyle ledge
      // the crown: seven nested arches, each narrower and higher, steel with triangle windows lit warm
      for (let i = 0; i < 7; i++) {
        const t = i / 7, aw = W * (0.98 - t * 0.66), y0 = base - h * (0.74 + t * 0.12), ah = aw * 0.62;
        o.push(`<path d="M${f(cx - aw / 2)} ${f(y0)} V${f(y0 - ah * 0.25)} A${f(aw / 2)} ${f(ah * 0.75)} 0 0 1 ${f(cx + aw / 2)} ${f(y0 - ah * 0.25)} V${f(y0)} Z" fill="${u('steel')}" stroke="#7d8399" stroke-width="0.6"/>`);
        for (let j = 0; j < 7; j++) { const a = Math.PI * (0.1 + 0.8 * j / 6), rr = aw / 2 * 0.72, tx = cx - Math.cos(a) * rr, ty = y0 - ah * 0.25 - Math.sin(a) * ah * 0.55; o.push(poly([[tx - 1.6, ty + 2.2], [tx, ty - 3], [tx + 1.6, ty + 2.2]], '#fff1c2')); }
      }
      o.push(poly([[cx - 3.5, base - h * 0.9], [cx, base - h * 1.1], [cx + 3.5, base - h * 0.9]], u('steel')));
      return o.join('');
    };
    s += row(300, 720, 772, 90, 190, u('tower'), K + '-win', 2);
    s += esb(440, 772, 340) + chrysler(612, 772, 300);
    s += row(150, 1000, 772, 40, 120, '#1a1f3a', K + '-win', 1);
    // the waterfront drive with its cabs, a ribbon of headlights
    s += rect(0, 772, 1000, 12, '#1b1f36') + rect(0, 772, 1000, 2, '#ffd98a', 'opacity="0.7"');
    for (let k = 0; k < 34; k++) { const cx = r() * 1000; s += rect(cx, 775, 9, 5, '#f7c21b') + rect(cx + 2, 773.5, 5, 2, '#f7c21b') + circ(cx + (k % 2 ? 9.5 : -0.5), 778, 1.2, k % 2 ? '#fff6d8' : '#ff4040'); }

    // the river, with the city's lights stretched on the water
    s += rect(0, 784, 1000, 216, u('river'));
    for (let k = 0; k < 90; k++) { const x = 160 + r() * 840, y0 = 788 + r() * 20, len = 30 + r() * 130; s += line(x, y0, x, y0 + len, r() < 0.7 ? '#ffd98a' : '#b9c6e8', 1 + r() * 2.5, `opacity="${f(0.12 + r() * 0.25)}" stroke-dasharray="${f(3 + r() * 6)} ${f(2 + r() * 5)}"`); }
    s += glitter(r, 0, 1000, 790, 1000, '#ffcf8a', 110, 520, 500);

    // the Brooklyn Bridge: a granite tower with two pointed arches, the cables and the web of stays, the deck
    const bridge = (cx, water, h) => {
      const o = [], tw = h * 0.36, top = water - h, deck = water - h * 0.38, cab = '#d8d2c8';
      const mainL = x => { const x0 = cx - tw * 0.38, x1 = 120, t = (x0 - x) / (x0 - x1); return top + 18 + (deck - 8 - top - 18) * (2 * t - t * t); };
      const sideR = x => { const x0 = cx + tw * 0.38, t = (x - x0) / (1000 - x0); return top + 18 + (deck - 40 - top - 18) * (2 * t - t * t); };
      // the deck and the stays (drawn behind the tower)
      o.push(poly([[0, deck + 6], [1000, deck - 10], [1000, deck - 2], [0, deck + 16]], '#2b2f4a'), line(0, deck + 6, 1000, deck - 10, '#7f86a8', 1.5));
      const deckY = x => deck + 6 - 16 * x / 1000;
      for (let x = 130; x < cx - tw * 0.4; x += 9) o.push(line(x, mainL(x), x, deckY(x), cab, 0.7, 'opacity="0.75"'));
      for (let k = 1; k < 10; k++) { const x = cx - tw * 0.4 - k * 26; o.push(line(cx - tw * 0.3, top + 30, x, deckY(x), cab, 0.7, 'opacity="0.7"')); }
      for (let x = cx + tw * 0.4; x < 1000; x += 9) o.push(line(x, sideR(x), x, deckY(x), cab, 0.7, 'opacity="0.75"'));
      for (let k = 1; k < 6; k++) { const x = cx + tw * 0.4 + k * 26; o.push(line(cx + tw * 0.3, top + 30, x, deckY(x), cab, 0.7, 'opacity="0.7"')); }
      o.push(`<path d="M${f(cx - tw * 0.38)} ${f(top + 18)} ${[...Array(40)].map((_, k) => { const x = cx - tw * 0.38 - k * (cx - tw * 0.38 - 120) / 39; return `L${f(x)} ${f(mainL(x))}`; }).join(' ')}" stroke="${cab}" stroke-width="2.6" fill="none"/>`);
      o.push(`<path d="M${f(cx + tw * 0.38)} ${f(top + 18)} ${[...Array(30)].map((_, k) => { const x = cx + tw * 0.38 + k * (1000 - cx - tw * 0.38) / 29; return `L${f(x)} ${f(sideR(x))}`; }).join(' ')}" stroke="${cab}" stroke-width="2.6" fill="none"/>`);
      // cabs crossing
      for (let k = 0; k < 9; k++) { const x = 160 + k * 90 + r() * 30; if (Math.abs(x - cx) < tw * 0.6) continue; o.push(rect(x, deckY(x) - 4, 8, 4, '#f7c21b'), circ(x + 8.5, deckY(x) - 2, 1.1, '#fff6d8')); }
      // the tower: granite, lit from the left, cut through by two tall pointed arches (the deck and cables show through)
      const arch = (sd, grow = 0) => { const ax = cx + sd * tw * 0.22, aw = tw * 0.26 + grow * 2, ab = deck + 2, at = top + h * 0.2 - grow; return `M${f(ax - aw / 2)} ${f(ab)} V${f(at + aw * 0.7)} Q${f(ax - aw / 2)} ${f(at)} ${f(ax)} ${f(at - aw * 0.15)} Q${f(ax + aw / 2)} ${f(at)} ${f(ax + aw / 2)} ${f(at + aw * 0.7)} V${f(ab)}`; };
      const body = `M${f(cx - tw / 2)} ${f(top)} H${f(cx + tw / 2)} V${f(water)} H${f(cx - tw / 2)} Z ${arch(-1)} Z ${arch(1)} Z`;
      d += `<clipPath id="${K}-tclip"><rect x="${f(cx + tw * 0.12)}" y="${f(top - 10)}" width="${f(tw)}" height="${f(h + 20)}"/></clipPath>`;
      o.push(`<path d="${body}" fill="${u('bstone')}" fill-rule="evenodd"/>`);
      for (let k = 0; k < 26; k++) { const yy = top + 14 + k * (h - 14) / 26; o.push(line(cx - tw / 2, yy, cx + tw / 2, yy, '#8f7458', 0.6, 'opacity="0.4"')); }
      for (let k = 0; k < 60; k++) { const yy = top + 14 + Math.floor(r() * 25) * (h - 14) / 26, xx = cx - tw / 2 + r() * tw; o.push(line(xx, yy, xx, yy + (h - 14) / 26, '#8f7458', 0.5, 'opacity="0.4"')); }
      o.push(`<path d="${body}" fill="#3a2c22" fill-rule="evenodd" opacity="0.32" clip-path="url(#${K}-tclip)"/>`);
      [-1, 1].forEach(sd => o.push(`<path d="${arch(sd, 3)}" stroke="#ecd9bb" stroke-width="2.4" fill="none"/>`));
      o.push(rect(cx - tw / 2 - 4, top - 6, tw + 8, 8, '#e3cfb1'), rect(cx - tw / 2 - 2, top + h * 0.1, tw + 4, 4, '#cdb594'), rect(cx - tw / 2 - 2, deck + 2, tw + 4, 4, '#cdb594'));
      o.push(rect(cx - tw / 2 - 8, water - 18, tw + 16, 18, '#7d6a58'));
      return o.join('');
    };
    s += bridge(800, 860, 380);

    // the Statue of Liberty on her pedestal: green copper, the torch alight, the crown's seven rays
    const liberty = (cx, base, h) => {
      const o = [], ph = h * 0.42, pw = h * 0.2, sb = base - ph, sh = h - ph;
      o.push(poly([[cx - pw * 1.2, base], [cx + pw * 1.2, base], [cx + pw * 1.05, base - 16], [cx - pw * 1.05, base - 16]], '#6f6458'));
      o.push(poly([[cx - pw / 2 - 6, base - 16], [cx + pw / 2 + 6, base - 16], [cx + pw / 2, base - ph * 0.45], [cx - pw / 2, base - ph * 0.45]], u('granite')));
      o.push(rect(cx - pw / 2, sb, pw, ph * 0.55, u('granite')), rect(cx - pw / 2 - 4, sb, pw + 8, 5, '#e8d9c2'), rect(cx - pw / 2 - 3, base - ph * 0.45 - 4, pw + 6, 4, '#d8c6ab'));
      for (let k = 0; k < 3; k++) o.push(rect(cx - pw * 0.36 + k * pw * 0.26, sb + ph * 0.12, pw * 0.14, ph * 0.3, '#7d6e5e'));
      // the figure (heel to torch 46 m, to the crown 34 m): the robe and its folds, the stola across the chest, the raised
      // right arm in its falling sleeve, the torch with its gilded flame, the tablet on the left arm, the crown of seven rays
      const P = (uu, vv) => [cx + uu * sh, sb - vv * sh], Pm = (uu, vv) => P(uu, vv).map(f).join(' ');
      o.push(`<path d="M${Pm(-0.15, 0)} C${Pm(-0.14, 0.2)} ${Pm(-0.12, 0.45)} ${Pm(-0.095, 0.63)} L${Pm(-0.07, 0.665)} L${Pm(0.07, 0.665)} C${Pm(0.1, 0.6)} ${Pm(0.13, 0.35)} ${Pm(0.15, 0)} Z" fill="${u('copper')}"/>`);
      for (let k = 0; k < 9; k++) { const x0 = -0.13 + k * 0.032, x1 = -0.08 + k * 0.018; o.push(`<path d="M${Pm(x0, 0.01)} C${Pm(x0 + 0.01, 0.2)} ${Pm(x1 - 0.01, 0.4)} ${Pm(x1, 0.58)}" stroke="${k < 4 ? '#c6f0de' : '#24574a'}" stroke-width="${k % 2 ? 1.6 : 1}" fill="none" opacity="0.6"/>`); }
      o.push(`<path d="M${Pm(0.075, 0.66)} C${Pm(0.03, 0.56)} ${Pm(-0.05, 0.48)} ${Pm(-0.12, 0.42)} L${Pm(-0.125, 0.36)} C${Pm(-0.04, 0.42)} ${Pm(0.06, 0.5)} ${Pm(0.11, 0.56)} Z" fill="#78c3a8"/>`);
      o.push(`<path d="M${Pm(-0.125, 0.36)} C${Pm(-0.04, 0.42)} ${Pm(0.06, 0.5)} ${Pm(0.11, 0.56)}" stroke="#2c6555" stroke-width="1.6" fill="none"/>`);
      // the tablet, held against the left side, its top tilted out
      o.push(poly([P(0.06, 0.6), P(0.15, 0.58), P(0.17, 0.4), P(0.08, 0.41)], '#3f8670'), poly([P(0.15, 0.58), P(0.165, 0.575), P(0.185, 0.4), P(0.17, 0.4)], '#25594b'), line(...P(0.08, 0.5), ...P(0.16, 0.49), '#9fdcc4', 0.8));
      o.push(`<path d="M${Pm(0.07, 0.64)} C${Pm(0.12, 0.6)} ${Pm(0.13, 0.52)} ${Pm(0.1, 0.46)} L${Pm(0.07, 0.48)} Z" fill="#4f9a80"/>`);
      // the raised arm: the sleeve falls to the shoulder, the bare forearm rises to the hand
      o.push(`<path d="M${Pm(-0.095, 0.63)} C${Pm(-0.14, 0.7)} ${Pm(-0.14, 0.78)} ${Pm(-0.125, 0.84)} L${Pm(-0.085, 0.845)} C${Pm(-0.085, 0.78)} ${Pm(-0.06, 0.71)} ${Pm(-0.03, 0.66)} Z" fill="#6cb79c"/>`);
      o.push(`<path d="M${Pm(-0.122, 0.84)} L${Pm(-0.118, 0.94)} L${Pm(-0.097, 0.945)} L${Pm(-0.09, 0.845)} Z" fill="${u('copper')}"/>`, ell(...P(-0.108, 0.95), sh * 0.022, sh * 0.017, '#5ea88e'));
      // the torch and its gilded flame, glowing
      o.push(poly([P(-0.117, 0.955), P(-0.1, 0.955), P(-0.095, 0.985), P(-0.122, 0.985)], '#4f9a80'), rect(...P(-0.13, 0.997), sh * 0.042, sh * 0.012, '#7cc4aa'));
      o.push(circ(...P(-0.108, 1.03), sh * 0.11, u('flame')), `<path d="M${Pm(-0.126, 0.997)} C${Pm(-0.135, 1.03)} ${Pm(-0.11, 1.05)} ${Pm(-0.108, 1.075)} C${Pm(-0.1, 1.05)} ${Pm(-0.08, 1.03)} ${Pm(-0.09, 0.997)} Z" fill="#ffc23d"/>`, `<path d="M${Pm(-0.115, 0.997)} C${Pm(-0.118, 1.02)} ${Pm(-0.108, 1.035)} ${Pm(-0.106, 1.05)} C${Pm(-0.1, 1.03)} ${Pm(-0.097, 1.015)} ${Pm(-0.1, 0.997)} Z" fill="#fff4c2"/>`);
      // the head: the neck, the face lit from the left, the hair, the crown band and its rays
      o.push(rect(...P(-0.02, 0.69), sh * 0.04, sh * 0.03, '#4f9a80'), ell(...P(0, 0.725), sh * 0.04, sh * 0.05, u('copper')), ell(...P(0.014, 0.722), sh * 0.022, sh * 0.042, '#3e8470', 'opacity="0.55"'));
      o.push(`<path d="M${Pm(-0.044, 0.75)} Q${Pm(0, 0.79)} ${Pm(0.044, 0.75)} L${Pm(0.04, 0.765)} Q${Pm(0, 0.8)} ${Pm(-0.04, 0.765)} Z" fill="#8fd4ba"/>`);
      for (let k = 0; k < 7; k++) { const a = Math.PI * (0.1 + 0.8 * k / 6), [bx, by] = P(0, 0.775), L = sh * (k === 3 ? 0.085 : 0.075); o.push(poly([[bx - Math.cos(a - 0.08) * sh * 0.04, by - Math.sin(a - 0.08) * sh * 0.03], [bx - Math.cos(a) * L, by - Math.sin(a) * L], [bx - Math.cos(a + 0.08) * sh * 0.04, by - Math.sin(a + 0.08) * sh * 0.03]], k < 3 ? '#a7e3cb' : '#5ea88e')); }
      return o.join('');
    };
    s += poly([[0, 840], [40, 812], [250, 806], [300, 840]], '#2d3a32') + trees(r, 10, 270, 818, 10, 22, '#18261f', '#24362b', '#33493a');
    s += liberty(140, 812, 400);
    return `<defs>${d}</defs>${s}`;
  }


  // a palm tree: a curved trunk with rings and a crown of drooping fronds
  const palm = (x, base, h, lean, trunk, leaf, leafLite) => {
    const tx = x + lean, ty = base - h;
    let o = `<path d="M${f(x - 4)} ${f(base)} Q${f(x + lean * 0.2)} ${f(base - h * 0.55)} ${f(tx - 2)} ${f(ty)} L${f(tx + 2)} ${f(ty)} Q${f(x + lean * 0.2 + 5)} ${f(base - h * 0.55)} ${f(x + 4)} ${f(base)} Z" fill="${trunk}"/>`;
    for (let k = 1; k < 10; k++) { const t = k / 10, px = x + (tx - x) * t * t + lean * 0.2 * 2 * t * (1 - t), py = base - h * t; o += line(px - 3.5, py, px + 3.5, py + 1, '#00000044', 1); }
    [[-1, 0.2], [-0.8, -0.35], [-0.3, -0.7], [0.3, -0.75], [0.8, -0.3], [1, 0.25], [0.1, -0.9]].forEach(([dx, dy], k) => {
      const ex = tx + dx * h * 0.42, ey = ty + dy * h * 0.18 + h * 0.18, mx = tx + dx * h * 0.24, my = ty + dy * h * 0.3 - 6;
      o += `<path d="M${f(tx)} ${f(ty)} Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)} Q${f(mx + 2)} ${f(my + 9)} ${f(tx)} ${f(ty + 3)} Z" fill="${k % 2 ? leaf : leafLite}"/>`;
    });
    return o;
  };

  /* ---------------- Mumbai: the Gateway of India with the Taj Mahal Palace behind it, Chhatrapati Shivaji Terminus, the
     Bandra–Worli Sea Link on the horizon and the Queen's Necklace of Marine Drive; ferries, kaali-peeli taxis; sunset ---------------- */
  function mumbai() {
    const K = 'bzAmumbai', r = seeded(1924), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    let d = lg(id('sky'), [[0, '#2a1650'], [0.3, '#6b2a76'], [0.52, '#c4456e'], [0.64, '#f07f4f'], [0.68, '#ffb35c']])
      + lg(id('sea'), [[0, '#d0705e'], [0.15, '#7c3f6e'], [1, '#2a1a45']])
      + rg(id('sun'), [[0, '#fff3c4'], [0.25, '#ffd27a', 0.9], [0.6, '#ff9a4a', 0.3], [1, '#ff7a3a', 0]])
      + lg(id('basalt'), [[0, '#f3cf8e'], [0.55, '#d4a35f'], [1, '#8f6537']], 0, 0, 1, 0)
      + lg(id('basaltS'), [[0, '#a8783f'], [1, '#6e4a27']], 0, 0, 1, 0)
      + lg(id('taj'), [[0, '#f2dcc0'], [1, '#bb9a7a']], 0, 0, 1, 0)
      + lg(id('tajDome'), [[0, '#ff9b6a'], [0.5, '#d2522f'], [1, '#7c2a17']], 0, 0, 1, 0)
      + lg(id('cst'), [[0, '#f0c993'], [0.6, '#c58f55'], [1, '#7f5530']], 0, 0, 1, 0)
      + lg(id('cstDome'), [[0, '#e8b77d'], [0.5, '#a8672f'], [1, '#5c3418']], 0, 0, 1, 0)
      + lg(id('plaza'), [[0, '#8a6a58'], [1, '#4a3540']])
      + blur(id('b2'), 2) + blur(id('b6'), 6);
    let s = rect(0, 0, 1000, 1000, u('sky'));
    for (let k = 0; k < 30; k++) s += circ(r() * 1000, r() * 220, 0.6 + r(), '#fff', `opacity="${f(0.2 + r() * 0.5)}"`);
    s += `<g opacity="0.8">${cloud(260, 300, 1.8, '#e7798a', '#8b3c7a', id('b2'))}${cloud(760, 250, 1.4, '#ef8a86', '#8b3c7a', id('b2'))}${cloud(560, 420, 1.0, '#ff9f7a', '#b2507a', id('b2'))}</g>`;
    s += circ(560, 655, 300, u('sun')) + circ(560, 655, 38, '#ffe7a8');
    s += rect(0, 655, 1000, 345, u('sea'));
    // the sun's road on the water
    s += glitter(r, 0, 1000, 660, 820, '#ffd27a', 120, 560, 160) + glitter(r, 0, 1000, 660, 820, '#f6a0a0', 60);

    // far away: Malabar Hill and the lights of Marine Drive curving round the bay
    s += `<path d="M0 655 L0 628 Q40 612 90 616 Q140 606 190 622 L230 655 Z" fill="#5a2c63"/>`;
    for (let k = 0; k < 14; k++) s += rect(8 + k * 14, 620 - r() * 26, 10, 40, '#4c2459');
    for (let k = 0; k < 60; k++) { const t = k / 59, x = 10 + t * 320, y = 652 + Math.sin(t * Math.PI) * 14 - t * 6; s += circ(x, y, 1.4, '#ffe39a') + circ(x, y, 3.5, '#ffd27a', 'opacity="0.25"'); }
    // the Bandra–Worli Sea Link: two pylons shaped like an upside-down Y, fans of cables, the long curving deck
    const seaLink = (x0, x1, deck) => {
      let o = `<path d="M${x0} ${deck} Q${(x0 + x1) / 2} ${deck - 8} ${x1} ${deck + 2}" stroke="#7a4370" stroke-width="3" fill="none"/>`;
      for (const [px, ph] of [[x0 + (x1 - x0) * 0.42, 66], [x0 + (x1 - x0) * 0.66, 52]]) {
        const top = deck - ph;
        o += poly([[px - 6, deck + 2], [px - 1, top + ph * 0.38], [px - 1, top], [px + 1, top], [px + 1, top + ph * 0.38], [px + 6, deck + 2], [px + 4, deck + 2], [px, top + ph * 0.48], [px - 4, deck + 2]], '#80467a');
        for (let k = 1; k <= 8; k++) { const sp = k * 7; o += line(px, top + 4 + k * 1.6, px - sp, deck - 2, '#b06c98', 0.5, 'opacity="0.8"') + line(px, top + 4 + k * 1.6, px + sp, deck - 2, '#b06c98', 0.5, 'opacity="0.8"'); }
      }
      return o;
    };
    s += `<g opacity="0.85">${seaLink(400, 760, 652)}</g>`;

    // the Taj Mahal Palace hotel: rows of arched windows, the great red dome, the corner towers
    const taj = (x, base, w, h) => {
      let o = rect(x, base - h, w, h, u('taj'));
      for (let j = 0; j < 6; j++) for (let i = 0; i < 18; i++) { const wx = x + 8 + i * (w - 16) / 18, wy = base - h + 12 + j * (h - 18) / 6; o += `<path d="M${f(wx)} ${f(wy + 14)} v-8 a4 4 0 0 1 8 0 v8 Z" fill="${r() < 0.55 ? '#ffd889' : '#6a4a3e'}"/>`; }
      for (let j = 0; j < 6; j++) o += rect(x - 2, base - h + 8 + j * (h - 18) / 6, w + 4, 2, '#e9cfae');
      const cx = x + w / 2;
      o += rect(cx - 34, base - h - 30, 68, 32, u('taj')) + `<path d="M${cx - 40} ${base - h - 28} C${cx - 44} ${base - h - 86} ${cx - 8} ${base - h - 102} ${cx} ${base - h - 108} C${cx + 8} ${base - h - 102} ${cx + 44} ${base - h - 86} ${cx + 40} ${base - h - 28} Z" fill="${u('tajDome')}"/>`;
      for (let k = 0; k < 7; k++) o += `<path d="M${f(cx - 36 + k * 12)} ${base - h - 28} Q${f(cx - 26 + k * 8.6)} ${base - h - 82} ${cx} ${base - h - 106}" stroke="#7c2a17" stroke-width="0.8" fill="none" opacity="0.6"/>`;
      o += line(cx, base - h - 108, cx, base - h - 124, '#c9a24a', 2);
      for (const tx of [x + 6, x + w - 26]) o += rect(tx, base - h - 40, 20, 42, u('taj')) + `<path d="M${tx - 3} ${base - h - 38} C${tx - 3} ${base - h - 60} ${tx + 10} ${base - h - 66} ${tx + 10} ${base - h - 68} C${tx + 10} ${base - h - 66} ${tx + 23} ${base - h - 60} ${tx + 23} ${base - h - 38} Z" fill="${u('tajDome')}"/>`;
      return o;
    };
    s += taj(40, 770, 330, 120);

    // the Gateway of India: yellow basalt, the great central arch, jali screens, the four turrets with their domes
    const gateway = (cx, base, w, h) => {
      const o = [], c = u('basalt'), mid = w * 0.46, wing = (w - mid) / 2;
      const dome = (x, y, rw, hh) => `<path d="M${f(x - rw)} ${f(y)} C${f(x - rw)} ${f(y - hh * 0.8)} ${f(x - rw * 0.1)} ${f(y - hh * 0.95)} ${f(x)} ${f(y - hh)} C${f(x + rw * 0.1)} ${f(y - hh * 0.95)} ${f(x + rw)} ${f(y - hh * 0.8)} ${f(x + rw)} ${f(y)} Z" fill="${c}"/>` + line(x, y - hh, x, y - hh - 8, '#c9a24a', 1.4);
      // the wings
      for (const sd of [-1, 1]) {
        const x0 = sd < 0 ? cx - w / 2 : cx + mid / 2;
        o.push(rect(x0, base - h * 0.55, wing, h * 0.55, sd < 0 ? c : u('basaltS')));
        o.push(`<path d="M${f(x0 + wing * 0.2)} ${base} V${f(base - h * 0.3)} A${f(wing * 0.3)} ${f(wing * 0.3)} 0 0 1 ${f(x0 + wing * 0.8)} ${f(base - h * 0.3)} V${base} Z" fill="#3c2433"/>`);
        o.push(`<path d="M${f(x0 + wing * 0.25)} ${f(base - h * 0.37)} h${f(wing * 0.5)} v${f(-h * 0.08)} a${f(wing * 0.25)} ${f(wing * 0.2)} 0 0 0 ${f(-wing * 0.5)} 0 Z" fill="#5a3a3a" opacity="0.8"/>`);
        for (let k = 0; k < 5; k++) o.push(rect(x0 + wing * (0.27 + k * 0.1), base - h * 0.45, wing * 0.04, h * 0.08, '#e8c48a', 'opacity="0.6"'));
        o.push(rect(x0 - 2, base - h * 0.57, wing + 4, 4, '#f8dca4'));
        for (let k = 0; k < 6; k++) o.push(rect(x0 + k * wing / 6 + 2, base - h * 0.62, wing / 6 - 4, h * 0.05, sd < 0 ? '#e4bb79' : '#a8783f'));
        // the outer turret
        const tx = sd < 0 ? cx - w / 2 + wing * 0.12 : cx + w / 2 - wing * 0.12;
        o.push(rect(tx - 9, base - h * 0.72, 18, h * 0.17, c), dome(tx, base - h * 0.72, 11, 22));
      }
      // the centre: the great arch, the frieze, the inner turrets
      o.push(rect(cx - mid / 2, base - h * 0.86, mid, h * 0.86, c), rect(cx + mid * 0.12, base - h * 0.86, mid * 0.38, h * 0.86, '#6e4a27', 'opacity="0.28"'));
      const aw = mid * 0.56, ah = h * 0.66;
      o.push(`<path d="M${f(cx - aw / 2)} ${base} V${f(base - ah + aw / 2)} A${f(aw / 2)} ${f(aw / 2)} 0 0 1 ${f(cx + aw / 2)} ${f(base - ah + aw / 2)} V${base} Z" fill="#ff9f5a" opacity="0.92"/>`);
      o.push(`<path d="M${f(cx - aw / 2)} ${base} V${f(base - ah + aw / 2)} A${f(aw / 2)} ${f(aw / 2)} 0 0 1 ${f(cx)} ${f(base - ah)} V${base} Z" fill="#7c3f2e" opacity="0.5"/>`);
      o.push(`<path d="M${f(cx - aw / 2 - 5)} ${f(base - ah + aw / 2)} A${f(aw / 2 + 5)} ${f(aw / 2 + 5)} 0 0 1 ${f(cx + aw / 2 + 5)} ${f(base - ah + aw / 2)}" stroke="#f8dca4" stroke-width="3" fill="none"/>`);
      for (let k = 0; k < 9; k++) { const a = Math.PI * k / 8; o.push(line(cx - Math.cos(a) * (aw / 2 + 5), base - ah + aw / 2 - Math.sin(a) * (aw / 2 + 5), cx - Math.cos(a) * (aw / 2 + 14), base - ah + aw / 2 - Math.sin(a) * (aw / 2 + 14), '#b98a4f', 1.4)); }
      o.push(rect(cx - mid / 2 - 3, base - h * 0.86, mid + 6, 5, '#f8dca4'));
      for (let k = 0; k < 10; k++) o.push(rect(cx - mid / 2 + k * mid / 10 + 2, base - h * 0.92, mid / 10 - 4, h * 0.06, k < 6 ? '#e4bb79' : '#a8783f'));
      for (const sd of [-1, 1]) { const tx = cx + sd * (mid / 2 - 12); o.push(rect(tx - 12, base - h * 1.0, 24, h * 0.14, c), rect(tx - 12, base - h * 1.0, 24, 3, '#f8dca4'), dome(tx, base - h * 1.0, 14, 30)); for (let k = 0; k < 3; k++) o.push(`<path d="M${f(tx - 9 + k * 7)} ${f(base - h * 0.88)} v-8 a2.5 2.5 0 0 1 5 0 v8 Z" fill="#5a3a3a"/>`); }
      o.push(line(cx - w / 2, base - h * 0.55, cx - w / 2, base, '#ffe2a8', 1.5));
      return o.join('');
    };
    s += rect(0, 768, 600, 34, '#5b3e48') + rect(0, 768, 600, 3, '#c98f6a');
    s += gateway(330, 800, 330, 250);

    // Chhatrapati Shivaji Terminus: the ribbed dome with the statue of Progress, Gothic gables, turrets, lit windows
    const cst = (cx, base) => {
      const o = [], c = u('cst');
      for (const sd of [-1, 1]) {
        const x0 = sd < 0 ? cx - 190 : cx + 60;
        o.push(rect(x0, base - 150, 130, 150, sd < 0 ? c : u('cstDome')));
        for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) o.push(`<path d="M${f(x0 + 10 + i * 20)} ${f(base - 20 - j * 34)} v-16 l6 -8 l6 8 v16 Z" fill="${r() < 0.6 ? '#ffd889' : '#5a3a2e'}"/>`);
        for (let j = 0; j < 4; j++) o.push(rect(x0 - 2, base - 6 - j * 34, 134, 3, '#f2d4a4'));
        for (let k = 0; k < 3; k++) { const gx = x0 + 20 + k * 45; o.push(poly([[gx - 18, base - 150], [gx, base - 178], [gx + 18, base - 150]], sd < 0 ? '#e8bd84' : '#9a6a3c'), circ(gx, base - 158, 4, '#5a3a2e')); }
        for (const tx of [x0 + 2, x0 + 120]) o.push(rect(tx, base - 180, 10, 180, sd < 0 ? '#e8bd84' : '#8a5c32'), poly([[tx - 2, base - 180], [tx + 5, base - 204], [tx + 12, base - 180]], '#8a4a2a'));
      }
      o.push(rect(cx - 60, base - 190, 120, 190, c));
      for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) o.push(`<path d="M${f(cx - 46 + i * 26)} ${f(base - 20 - j * 34)} v-16 l7 -9 l7 9 v16 Z" fill="${r() < 0.7 ? '#ffe19a' : '#5a3a2e'}"/>`);
      o.push(circ(cx, base - 160, 16, '#f2e3c4'), circ(cx, base - 160, 12, '#c7b393'), line(cx, base - 160, cx, base - 169, '#3a2a20', 1.6), line(cx, base - 160, cx + 6, base - 160, '#3a2a20', 1.4));
      o.push(poly([[cx - 62, base - 190], [cx, base - 226], [cx + 62, base - 190]], '#e0b27a'));
      // the drum and the great dome
      o.push(rect(cx - 40, base - 262, 80, 40, c));
      for (let k = 0; k < 6; k++) o.push(`<path d="M${f(cx - 34 + k * 12)} ${f(base - 228)} v-24 a4 4 0 0 1 8 0 v24 Z" fill="#ffd889"/>`);
      o.push(`<path d="M${cx - 46} ${base - 262} C${cx - 50} ${base - 330} ${cx - 10} ${base - 356} ${cx} ${base - 360} C${cx + 10} ${base - 356} ${cx + 50} ${base - 330} ${cx + 46} ${base - 262} Z" fill="${u('cstDome')}"/>`);
      for (let k = 0; k < 9; k++) o.push(`<path d="M${f(cx - 44 + k * 11)} ${base - 262} Q${f(cx - 34 + k * 8.5)} ${base - 326} ${cx} ${base - 358}" stroke="#5c3418" stroke-width="1" fill="none" opacity="0.7"/>`);
      o.push(rect(cx - 6, base - 378, 12, 18, '#c49a5c'), `<path d="M${cx - 3} ${base - 378} L${cx - 2} ${base - 398} L${cx + 6} ${base - 404} L${cx + 2} ${base - 396} L${cx + 3} ${base - 378} Z" fill="#d8b46a"/>`);
      for (const sd of [-1, 1]) { const tx = cx + sd * 54; o.push(rect(tx - 7, base - 250, 14, 60, c), poly([[tx - 9, base - 250], [tx, base - 282], [tx + 9, base - 250]], '#8a4a2a')); }
      return o.join('');
    };
    s += palm(560, 800, 150, -14, '#4a2e2e', '#2e3a2e', '#465a3a');
    s += cst(790, 800);
    s += palm(990, 810, 170, -20, '#4a2e2e', '#2e3a2e', '#465a3a') + palm(620, 806, 120, 10, '#4a2e2e', '#2e3a2e', '#465a3a');

    // the waterfront: ferries bobbing at the Gateway, then the plaza with pigeons and a black-and-yellow taxi
    const ferry = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})">${poly([[-50, 0], [52, 0], [60, -14], [-56, -14]], '#f4e6d0')}${rect(-40, -30, 76, 16, '#2f6f8a')}${rect(-36, -28, 68, 9, '#ffe7b0')}${rect(-44, -34, 84, 4, '#f4e6d0')}${poly([[-50, 0], [52, 0], [48, 5], [-46, 5]], '#3b1f3a')}</g>`;
    s += ferry(110, 755, 0.6) + ferry(520, 760, 0.5);
    s += rect(0, 800, 1000, 200, u('plaza'));
    for (let k = 0; k < 14; k++) s += line(0, 806 + k * k * 1.1, 1000, 806 + k * k * 1.1, '#2e2030', 1, 'opacity="0.35"');
    for (let k = -10; k < 22; k++) s += line(500 + k * 18, 802, 500 + k * 70, 1000, '#2e2030', 1, 'opacity="0.25"');
    const taxi = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-46 0 V-14 Q-44 -20 -32 -21 L-22 -34 H22 L32 -21 Q44 -20 46 -14 V0 Z" fill="#141414"/><path d="M-46 -14 Q-44 -20 -32 -21 L-22 -34 H22 L32 -21 Q44 -20 46 -14 V-10 H-46 Z" fill="#141414"/><path d="M-20 -32 H-2 V-21 H-29 Z M2 -32 H20 L28 -21 H2 Z" fill="#9fc3d6"/><rect x="-48" y="-12" width="96" height="10" fill="#f7c21b"/><rect x="-22" y="-37" width="44" height="4" fill="#f7c21b"/><circle cx="-28" cy="0" r="8" fill="#111" stroke="#777" stroke-width="2"/><circle cx="28" cy="0" r="8" fill="#111" stroke="#777" stroke-width="2"/><circle cx="44" cy="-15" r="3" fill="#fff4c2"/></g>`;
    s += taxi(470, 872, 1.1) + taxi(600, 846, 0.7);
    for (let k = 0; k < 16; k++) { const px = 380 + r() * 260, py = 900 + r() * 80; s += ell(px, py, 5, 3, '#6f6a78') + circ(px + 4, py - 3, 2, '#5a5566'); }
    return `<defs>${d}</defs>${s}`;
  }


  // a mountain from a profile of points, with streaks of rock and a cloak of forest: returns its path too
  const ridge = (list, base) => `M${f(list[0][0])} ${base} ${list.map(([x, y]) => `L${f(x)} ${f(y)}`).join(' ')} L${f(list[list.length - 1][0])} ${base} Z`;
  const smooth = (list, step = 6) => { const c = curve(list), last = list[list.length - 1], out = []; for (let x = list[0][0]; x < last[0]; x += step) out.push([x, c(x)]); out.push(last); return out; };

  /* ---------------- Rio de Janeiro: Christ the Redeemer on Corcovado, Sugarloaf with its cable car, the white Lapa Arches
     with the yellow Santa Teresa tram, Copacabana's beach and the wave mosaic of its promenade; a bright afternoon ---------------- */
  // rainforest on a slope: many small crowns in close greens, lit on top, under a profile (list of points) down to y = bottom
  const canopy = (r, prof, bottom, n, skip) => {
    const c = curve(prof), x0 = prof[0][0], x1 = prof[prof.length - 1][0]; let o = '';
    for (let k = 0; k < n; k++) {
      const x = x0 + r() * (x1 - x0), top = c(x); if (skip && x > skip[0] && x < skip[1] && r() < 0.8) continue;
      const y = top + 6 + Math.pow(r(), 0.8) * (bottom - top - 6), rr = 2.5 + r() * 4.5;
      o += circ(x, y, rr, ['#285c2b', '#2f6a32', '#3b7a38', '#22512a'][k % 4], 'opacity="0.75"') + circ(x - rr * 0.3, y - rr * 0.35, rr * 0.45, '#5a9a4a', 'opacity="0.45"');
    }
    return o;
  };

  function rio() {
    const K = 'bzArio', r = seeded(1931 * 3), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    let d = lg(id('sky'), [[0, '#2f7fd0'], [0.45, '#7fbdf0'], [0.7, '#cfe8fb']])
      + lg(id('far'), [[0, '#8db3cf'], [1, '#a9c7dc']])
      + lg(id('forest'), [[0, '#3f7d3a'], [1, '#1f4d2a']])
      + lg(id('rock'), [[0, '#c9b7a0'], [0.5, '#8f7f6c'], [1, '#4e443a']], 0, 0, 1, 0)
      + lg(id('relief'), [[0, '#fff6c8', 0.18], [0.45, '#000', 0], [1, '#0b2a14', 0.45]], 0, 0, 1, 0)
      + lg(id('ocean'), [[0, '#1aa3c9'], [0.5, '#0e86b5'], [1, '#2bc0d4']])
      + lg(id('bay'), [[0, '#3c9fcf'], [1, '#1b6fa6']])
      + lg(id('sand'), [[0, '#f9e6c2'], [1, '#ecd09c']])
      + lg(id('statue'), [[0, '#fbf6ec'], [0.6, '#d9d2c4'], [1, '#a59c8d']], 0, 0, 1, 0)
      + blur(id('b3'), 3) + blur(id('b1'), 1.2)
      + `<pattern id="${id('waves')}" width="60" height="26" patternUnits="userSpaceOnUse"><rect width="60" height="26" fill="#f6f3ec"/><path d="M0 13 C10 3 20 3 30 13 S50 23 60 13 L60 26 L0 26 Z" fill="#1d1d1f"/><path d="M0 13 C10 3 20 3 30 13 S50 23 60 13" stroke="#1d1d1f" stroke-width="1" fill="none"/></pattern>`;
    let s = rect(0, 0, 1000, 1000, u('sky'));
    s += cloud(330, 260, 1.7, '#ffffff', '#c9dcec', id('b3')) + cloud(640, 200, 1.2, '#ffffff', '#c9dcec', id('b3')) + cloud(520, 430, 1.0, '#ffffff', '#d3e3f0', id('b3')) + cloud(900, 360, 0.9, '#ffffff', '#cfe0ee', id('b3'));
    // the far mountains of Tijuca, blue with distance
    s += `<path d="${ridge(smooth([[0, 560], [90, 520], [200, 540], [330, 500], [470, 560], [600, 540], [720, 580], [860, 560], [1000, 590]], 10), 760)}" fill="${u('far')}"/>`;
    // Corcovado: a steep granite tooth, the forest on its flanks, the statue at the very top
    const corc = smooth([[-20, 760], [30, 668], [80, 572], [116, 460], [138, 384], [160, 356], [176, 362], [190, 400], [202, 470], [240, 560], [320, 652], [420, 760]], 4);
    s += `<path d="${ridge(corc, 780)}" fill="${u('forest')}"/>`;
    s += `<path d="M140 376 L160 354 L182 368 L210 430 L196 470 L180 430 L168 470 L154 420 Z" fill="${u('rock')}" opacity="0.85"/>`;
    s += canopy(r, corc, 760, 520, [130, 200]) + `<path d="${ridge(corc, 780)}" fill="${u('relief')}"/>`;
    const christ = (cx, base, h) => {
      // 30 m tall with the pedestal, 28 m from hand to hand; soapstone, lit from the left
      const P = (uu, vv) => [cx + uu * h, base - vv * h], Pm = (uu, vv) => P(uu, vv).map(f).join(' ');
      let o = poly([P(-0.09, 0), P(0.09, 0), P(0.075, 0.26), P(-0.075, 0.26)], '#cfc6b6') + poly([P(0.01, 0), P(0.09, 0), P(0.075, 0.26), P(0.01, 0.26)], '#a69d8e');
      o += `<path d="M${Pm(-0.075, 0.26)} C${Pm(-0.085, 0.5)} ${Pm(-0.08, 0.66)} ${Pm(-0.1, 0.76)} C${Pm(-0.25, 0.77)} ${Pm(-0.38, 0.8)} ${Pm(-0.44, 0.815)} L${Pm(-0.47, 0.84)} L${Pm(-0.44, 0.875)} C${Pm(-0.3, 0.88)} ${Pm(-0.15, 0.9)} ${Pm(-0.06, 0.905)} L${Pm(-0.035, 0.93)} L${Pm(0.035, 0.93)} L${Pm(0.06, 0.905)} C${Pm(0.15, 0.9)} ${Pm(0.3, 0.88)} ${Pm(0.44, 0.875)} L${Pm(0.47, 0.84)} L${Pm(0.44, 0.815)} C${Pm(0.38, 0.8)} ${Pm(0.25, 0.77)} ${Pm(0.1, 0.76)} C${Pm(0.08, 0.66)} ${Pm(0.085, 0.5)} ${Pm(0.075, 0.26)} Z" fill="${u('statue')}"/>`;
      o += `<path d="M${Pm(0.1, 0.76)} C${Pm(0.25, 0.77)} ${Pm(0.38, 0.8)} ${Pm(0.44, 0.815)} L${Pm(0.46, 0.83)} C${Pm(0.3, 0.82)} ${Pm(0.18, 0.81)} ${Pm(0.06, 0.82)} Z" fill="#a69d8e"/>`;
      o += `<path d="M${Pm(-0.1, 0.76)} C${Pm(-0.25, 0.77)} ${Pm(-0.38, 0.8)} ${Pm(-0.44, 0.815)} L${Pm(-0.46, 0.83)} C${Pm(-0.3, 0.82)} ${Pm(-0.18, 0.81)} ${Pm(-0.06, 0.82)} Z" fill="#c6bdae"/>`;
      for (let k = 0; k < 4; k++) o += line(...P(-0.05 + k * 0.03, 0.27), ...P(-0.04 + k * 0.025, 0.74), k < 2 ? '#fffdf7' : '#9d9383', 0.9);
      o += circ(...P(0, 0.97), h * 0.04, u('statue')) + `<path d="M${Pm(0, 0.93)} L${Pm(0.01, 0.93)} L${Pm(0.01, 0.62)} L${Pm(0, 0.62)} Z" fill="#b5ad9f" opacity="0.5"/>`;
      return o;
    };
    s += christ(160, 358, 108);

    // Sugarloaf: bare granite, steep and rounded, with Urca hill in front and the cable car between them
    const sugar = smooth([[620, 720], [680, 600], [720, 470], [760, 400], [800, 380], [836, 396], [866, 470], [900, 600], [940, 720]], 4);
    s += `<path d="${ridge(sugar, 740)}" fill="${u('rock')}"/>`;
    for (let k = 0; k < 18; k++) { const x = 700 + r() * 190, top = curve(sugar)(x); s += line(x, top + 10, x + (r() - 0.5) * 10, top + 60 + r() * 120, '#5d5248', 1 + r() * 2, 'opacity="0.35"'); }
    s += `<path d="M770 392 Q800 372 836 394 Q812 392 790 400 Z" fill="#4f7d3c"/>` + `<path d="${ridge(smooth([[640, 740], [680, 690], [700, 650], [740, 640], [780, 690], [830, 740]], 6), 742)}" fill="${u('rock')}"/>`;
    const urca = smooth([[560, 760], [600, 700], [640, 640], [690, 620], [720, 640], [770, 720], [800, 760]], 5);
    s += `<path d="${ridge(urca, 770)}" fill="${u('forest')}"/>`;
    s += canopy(r, urca, 760, 260) + `<path d="${ridge(urca, 770)}" fill="${u('relief')}"/>`;
    s += line(692, 622, 800, 382, '#333', 1) + line(694, 624, 802, 384, '#333', 0.6) + `<g transform="translate(748 494)">${rect(-8, 0, 16, 11, '#e9e2d0')}${rect(-6, 2, 12, 5, '#7fb4d6')}${line(0, 0, 0, -6, '#333', 1)}</g>`;

    // the bay with sailing boats, the Lapa Arches and the yellow tram
    s += rect(0, 740, 1000, 40, u('bay'));
    for (let k = 0; k < 9; k++) { const bx = 420 + r() * 500, by = 752 + r() * 22; s += poly([[bx, by], [bx + 1, by - 16], [bx + 10, by]], '#fff') + rect(bx - 6, by, 18, 3, '#e9e2d0'); }
    const lapa = (x0, x1, base, h) => {
      let o = rect(x0, base - h, x1 - x0, h, '#f7f4ec') + rect(x0, base - h, x1 - x0, 4, '#ffffff');
      const n = 13, aw = (x1 - x0) / n;
      for (let i = 0; i < n; i++) { const ax = x0 + i * aw; o += `<path d="M${f(ax + aw * 0.14)} ${base} V${f(base - h * 0.32)} A${f(aw * 0.36)} ${f(aw * 0.36)} 0 0 1 ${f(ax + aw * 0.86)} ${f(base - h * 0.32)} V${base} Z" fill="#5d8fb8" opacity="0.85"/>`; o += `<path d="M${f(ax + aw * 0.2)} ${f(base - h * 0.58)} V${f(base - h * 0.74)} A${f(aw * 0.3)} ${f(aw * 0.3)} 0 0 1 ${f(ax + aw * 0.8)} ${f(base - h * 0.74)} V${f(base - h * 0.58)} Z" fill="#6a9cc4" opacity="0.85"/>`; }
      o += rect(x0, base - h * 0.56, x1 - x0, 3, '#dcd6c8') + rect(x0, base, x1 - x0, 3, '#c8c0ae');
      // the tram on top: yellow, open sides, a pole to its wire
      const tx = x0 + (x1 - x0) * 0.58;
      o += line(x0, base - h - 20, x1, base - h - 20, '#444', 0.6) + rect(tx, base - h - 14, 40, 13, '#f6c324') + rect(tx + 2, base - h - 12, 36, 5, '#5a4630', 'opacity="0.6"') + rect(tx - 1, base - h - 16, 42, 3, '#d9a514') + line(tx + 20, base - h - 16, tx + 26, base - h - 20, '#333', 1);
      return o;
    };
    s += trees(r, 180, 640, 742, 18, 34, '#2d5f2c', '#3f7d3a', '#5d9a4a');
    s += lapa(230, 560, 740, 62);

    // Copacabana: the white buildings along the beach, the ocean with its breakers, the sand, umbrellas, palms
    let bx = 0; while (bx < 1000) { const w = 22 + r() * 30, h = 30 + r() * 40; s += rect(bx, 780 - h, w, h, r() < 0.7 ? '#f3efe6' : '#e6d9c3') + windows(bx + 2, 784 - h, w - 4, h - 8, Math.max(2, Math.floor(w / 7)), Math.max(2, Math.floor(h / 9)), '#9fb7c9', 0.5, 0.5); bx += w + 1; }
    s += rect(0, 778, 1000, 8, '#3c4a57') + rect(0, 786, 1000, 14, u('waves'));
    s += rect(0, 800, 1000, 70, u('sand'));
    s += `<path d="M0 870 Q500 852 1000 870 L1000 1000 L0 1000 Z" fill="${u('ocean')}"/>`;
    for (let k = 0; k < 7; k++) { const y = 880 + k * 18; s += `<path d="M0 ${y} ${[...Array(20)].map((_, i) => `q25 ${-6 + (k % 2) * 2} 50 0`).join(' ')}" stroke="#ffffff" stroke-width="${f(2.5 - k * 0.25)}" fill="none" opacity="${f(0.85 - k * 0.1)}"/>`; }
    s += rect(0, 862, 1000, 10, '#fff', 'opacity="0.7"');
    const brolly = (x, y, c1, c2) => `<g>${line(x, y, x + 2, y + 26, '#6b5a48', 1.6)}<path d="M${x - 22} ${y + 4} Q${x} ${y - 16} ${x + 22} ${y + 4} Z" fill="${c1}"/><path d="M${x - 7} ${y + 2} Q${x} ${y - 15} ${x + 7} ${y + 2} Z" fill="${c2}"/>${ell(x + 6, y + 27, 18, 3, '#d4b380', 'opacity="0.7"')}</g>`;
    [[400, 820, '#ff4d6d', '#ffd166'], [470, 830, '#06d6a0', '#ffffff'], [540, 818, '#ffd166', '#ef476f'], [610, 828, '#118ab2', '#ffffff'], [330, 830, '#f78c6b', '#ffffff'], [680, 822, '#ef476f', '#ffd166']].forEach(([x, y, a, b]) => { s += brolly(x, y, a, b); });
    for (let k = 0; k < 14; k++) { const px = 300 + r() * 420, py = 846 + r() * 14; s += rect(px, py - 9, 3, 9, ['#8d5524', '#c68642', '#e0ac69'][k % 3]) + circ(px + 1.5, py - 11, 2.2, ['#8d5524', '#c68642', '#e0ac69'][k % 3]); }
    // the promenade's black-and-white waves, seen in perspective along the beach
    s += `<path d="M0 800 L1000 800 L1000 806 L0 806 Z" fill="${u('waves')}" opacity="0"/>`;
    s += palm(40, 820, 190, 26, '#7a5a3a', '#2f6a32', '#4d8d43') + palm(960, 830, 210, -30, '#7a5a3a', '#2f6a32', '#4d8d43') + palm(880, 826, 150, -10, '#7a5a3a', '#2f6a32', '#4d8d43');
    return `<defs>${d}</defs>${s}`;
  }


  // a snowy mountain range: a jagged ridge (peaks joined by midpoint displacement), shaded faces on the side away from the
  // light, snow down to a ragged snow line with gullies of rock showing through
  const alps = (r, peaks, base, snowY, rock, rockD, snow, snowD) => {
    let ridgePts = [];
    const split = (a, b, depth) => { if (depth === 0) return [a]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (r() - 0.5) * Math.abs(b[0] - a[0]) * 0.32]; return [...split(a, m, depth - 1), ...split(m, b, depth - 1)]; };
    for (let i = 0; i < peaks.length - 1; i++) { const a = peaks[i], b = peaks[i + 1], v = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 40 + r() * 50]; ridgePts.push(...split(a, v, 4), ...split(v, b, 4)); }
    ridgePts.push(peaks[peaks.length - 1]);
    let o = `<path d="M${f(ridgePts[0][0])} ${base} L${pts(ridgePts)} L${f(ridgePts[ridgePts.length - 1][0])} ${base} Z" fill="${rock}"/>`;
    // the faces turned away from the sun: from each descending stretch of ridge, a shadow falling to the valley
    for (let i = 0; i < ridgePts.length - 1; i++) { const [x1, y1] = ridgePts[i], [x2, y2] = ridgePts[i + 1]; if (y2 > y1) o += poly([[x1, y1], [x2, y2], [x2 - (y2 - y1) * 0.2, base], [x1 - (base - y1) * 0.35, base]], rockD, 'opacity="0.55"'); }
    // the snow: from the ridge down to the snow line, ragged, shaded on the same faces
    const low = ridgePts.map(([x, y]) => [x, y > snowY - 6 ? y : Math.min(base, Math.max(y + 8, snowY + (r() - 0.3) * 46))]);
    o += `<path d="M${pts(ridgePts)} L${pts(low.slice().reverse())} Z" fill="${snow}"/>`;
    for (let i = 0; i < ridgePts.length - 1; i++) { const [x1, y1] = ridgePts[i], [x2, y2] = ridgePts[i + 1]; if (y2 > y1 && y1 < snowY) o += poly([[x1, y1], [x2, y2], [low[i + 1][0] - 4, low[i + 1][1]], [low[i][0] - (low[i][1] - y1) * 0.3, low[i][1]]], snowD, 'opacity="0.85"'); }
    for (let k = 0; k < ridgePts.length; k += 3) { const [x, y] = ridgePts[k]; if (y < snowY - 20) o += line(x, y + 10, x - 6 - r() * 10, Math.min(low[k][1], y + 30 + r() * 40), rockD, 1.4, 'opacity="0.55"'); }
    return o;
  };

  /* ---------------- Zurich: the Alps over the lake, the twin towers of the Grossmünster, the green spire of the Fraumünster,
     St. Peter's great clock, guild houses on the Limmat, a paddle steamer, swans and a blue-and-white tram; a clear winter day ---------------- */
  function zurich() {
    const K = 'bzAzurich', r = seeded(1218), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    let d = lg(id('sky'), [[0, '#3d7cc4'], [0.4, '#86b7e6'], [0.62, '#dcebf8']])
      + lg(id('lake'), [[0, '#6aa6cf'], [1, '#2d6c9c']])
      + lg(id('river'), [[0, '#3f7aa6'], [1, '#183f63']])
      + lg(id('haze'), [[0, '#e6f1fb', 0], [1, '#e6f1fb', 0.85]])
      + lg(id('sand'), [[0, '#e3d6bf'], [1, '#a99a83']], 0, 0, 1, 0)
      + lg(id('grey'), [[0, '#e8e2d6'], [1, '#9c958a']], 0, 0, 1, 0)
      + lg(id('verd'), [[0, '#9ed7bf'], [0.5, '#4f9b80'], [1, '#22594a']], 0, 0, 1, 0)
      + lg(id('slate'), [[0, '#5d6470'], [1, '#2c313b']], 0, 0, 1, 0)
      + blur(id('b3'), 3) + blur(id('b1'), 1) + blur(id('b6'), 6);
    let s = rect(0, 0, 1000, 1000, u('sky'));
    s += cloud(250, 240, 1.4, '#ffffff', '#d3e2f0', id('b3')) + cloud(740, 300, 1.1, '#ffffff', '#d3e2f0', id('b3'));
    // the Alps: a far range, pale, then the near range, sharp
    s += `<g opacity="0.7">${alps(r, [[-20, 470], [120, 420], [260, 446], [420, 400], [600, 430], [760, 396], [900, 436], [1020, 420]], 620, 500, '#a9b8cc', '#7d8ea8', '#ffffff', '#c9d7ea')}</g>`;
    s += alps(r, [[-20, 520], [130, 470], [300, 500], [470, 452], [640, 492], [820, 456], [1020, 500]], 620, 548, '#7d8796', '#4c5464', '#ffffff', '#b3c4dc');
    s += rect(0, 470, 1000, 160, u('haze'), 'opacity="0.55"');
    // green hills on the far shore, villages, then the lake with a paddle steamer and sails
    s += `<path d="${ridge(smooth([[0, 612], [160, 596], [330, 608], [520, 592], [700, 606], [860, 594], [1000, 604]], 10), 640)}" fill="#6f8f6a"/>`;
    for (let k = 0; k < 40; k++) { const x = r() * 1000; s += rect(x, 600 + r() * 10, 5, 4, '#f2ece0') + poly([[x - 1, 600 + 0], [x + 2.5, 597], [x + 6, 600]], '#a0503a'); }
    s += rect(0, 618, 1000, 90, u('lake'));
    s += glitter(r, 0, 1000, 622, 700, '#eaf4fc', 80);
    const steamer = (x, y) => `<g>${poly([[x - 70, y], [x + 64, y], [x + 76, y - 10], [x - 76, y - 10]], '#f8f6f0')}${rect(x - 56, y - 22, 110, 12, '#f8f6f0')}${windows(x - 54, y - 21, 106, 10, 14, 1, '#4a6a8a', 0.6, 0.6)}${rect(x - 4, y - 38, 10, 16, '#e8b24a')}${rect(x - 4, y - 38, 10, 4, '#2a2a2a')}${ell(x - 30, y - 6, 12, 10, '#c8372d')}${poly([[x - 70, y], [x + 64, y], [x + 60, y + 4], [x - 66, y + 4]], '#26425e')}${line(x + 60, y - 10, x + 66, y - 30, '#333', 1)}${poly([[x + 66, y - 30], [x + 66, y - 22], [x + 78, y - 26]], '#d52b1e')}</g>`;
    s += steamer(780, 668);
    for (let k = 0; k < 6; k++) { const bx = 80 + r() * 560, by = 640 + r() * 40; s += poly([[bx, by], [bx + 1, by - 22], [bx + 13, by]], '#fff') + poly([[bx - 1, by - 2], [bx - 1, by - 16], [bx - 9, by - 2]], '#f1f1f1') + rect(bx - 8, by, 24, 3, '#2d3b4a'); }

    // the old town on the Limmat: guild houses with steep roofs and painted shutters
    const houses = (x0, x1, base) => {
      let o = '', x = x0;
      const cols = ['#f3e3c3', '#e9c9a8', '#f6efe1', '#d9b38c', '#e8d8b0', '#cfd8c8', '#f0d2c2'];
      while (x < x1) {
        const w = 30 + r() * 26, h = 60 + r() * 50, c = cols[Math.floor(r() * cols.length)];
        o += rect(x, base - h, w, h, c) + rect(x + w * 0.62, base - h, w * 0.38, h, '#000', 'opacity="0.08"');
        o += poly([[x - 3, base - h], [x + w / 2, base - h - w * 0.75], [x + w + 3, base - h]], '#7a3e2b') + poly([[x + w / 2, base - h - w * 0.75], [x + w + 3, base - h], [x + w / 2, base - h]], '#5a2b1f', 'opacity="0.6"');
        o += windows(x + 3, base - h + 8, w - 6, h - 22, Math.max(2, Math.floor(w / 12)), Math.max(2, Math.floor(h / 22)), '#4a5d72', 0.4, 0.5);
        if (r() < 0.5) o += rect(x + w * 0.35, base - h - w * 0.45, w * 0.3, w * 0.2, '#f6efe1');
        o += rect(x + w * 0.3, base - 16, w * 0.4, 16, '#5a4636');
        x += w;
      }
      return o;
    };
    s += houses(0, 1000, 800);

    // St. Peter: a plain tower with the largest church clock faces in Europe, and a tall dark spire
    const peter = (cx, base) => {
      let o = rect(cx - 30, base - 250, 60, 250, u('grey')) + rect(cx + 8, base - 250, 22, 250, '#000', 'opacity="0.1"');
      o += circ(cx - 2, base - 210, 25, '#111') + circ(cx - 2, base - 210, 25, 'none', 'stroke="#d8b14a" stroke-width="2.5"');
      for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; o += line(cx - 2 + Math.cos(a) * 18, base - 210 + Math.sin(a) * 18, cx - 2 + Math.cos(a) * 22, base - 210 + Math.sin(a) * 22, '#d8b14a', 2); }
      o += line(cx - 2, base - 210, cx - 2, base - 226, '#d8b14a', 2.2) + line(cx - 2, base - 210, cx + 9, base - 205, '#d8b14a', 2.2);
      o += poly([[cx + 28, base - 236], [cx + 34, base - 230], [cx + 34, base - 190], [cx + 28, base - 186]], '#222');
      o += poly([[cx - 34, base - 250], [cx, base - 400], [cx + 34, base - 250]], u('slate')) + poly([[cx, base - 400], [cx + 34, base - 250], [cx + 6, base - 250]], '#1f232a', 'opacity="0.6"');
      o += poly([[cx - 36, base - 250], [cx - 12, base - 274], [cx - 10, base - 250]], '#4a515c') + line(cx, base - 400, cx, base - 420, '#d8b14a', 1.6) + circ(cx, base - 422, 3, '#d8b14a');
      for (let k = 0; k < 3; k++) o += `<path d="M${cx - 18 + k * 14} ${base - 140} v-22 a5 5 0 0 1 10 0 v22 Z" fill="#3a3a3a"/>`;
      return o + rect(cx - 70, base - 90, 40, 90, '#f4efe4') + poly([[cx - 74, base - 90], [cx - 50, base - 112], [cx - 26, base - 90]], '#7a3e2b');
    };
    // the Fraumünster: the long nave with tall Gothic windows and the slender green spire with its clock
    const frau = (cx, base) => {
      let o = rect(cx - 150, base - 120, 140, 120, u('sand')) + poly([[cx - 156, base - 120], [cx - 80, base - 168], [cx - 4, base - 120]], '#8a4a35');
      for (let k = 0; k < 4; k++) o += `<path d="M${cx - 140 + k * 32} ${base - 30} v-56 q8 -14 16 0 v56 Z" fill="#40566e"/>`;
      o += rect(cx - 16, base - 260, 34, 260, u('sand')) + rect(cx + 4, base - 260, 14, 260, '#000', 'opacity="0.1"');
      o += circ(cx + 1, base - 228, 12, '#2a3a2e') + circ(cx + 1, base - 228, 12, 'none', 'stroke="#e4c25a" stroke-width="2"') + line(cx + 1, base - 228, cx + 1, base - 237, '#e4c25a', 1.6) + line(cx + 1, base - 228, cx + 7, base - 226, '#e4c25a', 1.6);
      o += rect(cx - 19, base - 266, 40, 8, '#cdbfa6');
      for (const dx of [-14, 16]) o += poly([[cx + dx - 6, base - 266], [cx + dx, base - 290], [cx + dx + 6, base - 266]], u('verd'));
      o += poly([[cx - 16, base - 266], [cx + 1, base - 470], [cx + 18, base - 266]], u('verd')) + poly([[cx + 1, base - 470], [cx + 18, base - 266], [cx + 4, base - 266]], '#1d4a3d', 'opacity="0.5"');
      o += line(cx + 1, base - 470, cx + 1, base - 488, '#e4c25a', 1.6) + circ(cx + 1, base - 490, 2.6, '#e4c25a');
      return o;
    };
    // the Grossmünster: the twin towers with their arched belfries and dark domed caps; the nave behind
    const gross = (cx, base) => {
      let o = rect(cx - 110, base - 150, 220, 150, u('grey')) + poly([[cx - 116, base - 150], [cx, base - 214], [cx + 116, base - 150]], '#5c4a40');
      for (let k = 0; k < 2; k++) o += circ(cx - 30 + k * 60, base - 110, 14, '#3e5470') + circ(cx - 30 + k * 60, base - 110, 14, 'none', 'stroke="#cfc6b6" stroke-width="2"');
      for (const sd of [-1, 1]) {
        const tx = cx + sd * 56, tw = 52;
        o += rect(tx - tw / 2, base - 300, tw, 300, u('grey')) + rect(tx + tw * 0.12, base - 300, tw * 0.38, 300, '#000', 'opacity="0.1"');
        for (let j = 0; j < 4; j++) o += rect(tx - tw / 2 - 2, base - 70 - j * 58, tw + 4, 4, '#d6cfc2');
        for (let k = 0; k < 2; k++) o += `<path d="M${tx - 16 + k * 18} ${base - 210} v-26 a7 7 0 0 1 14 0 v26 Z" fill="#30363f"/>` + `<path d="M${tx - 16 + k * 18} ${base - 268} v-22 a7 7 0 0 1 14 0 v22 Z" fill="#30363f"/>`;
        o += rect(tx - 4, base - 160, 8, 26, '#30363f');
        // the cap: an octagonal drum and a dark, faintly ribbed dome
        o += rect(tx - 22, base - 322, 44, 22, u('grey')) + `<path d="M${tx - 23} ${base - 322} C${tx - 24} ${base - 360} ${tx - 6} ${base - 372} ${tx} ${base - 374} C${tx + 6} ${base - 372} ${tx + 24} ${base - 360} ${tx + 23} ${base - 322} Z" fill="${u('slate')}"/>`;
        for (let k = 0; k < 4; k++) o += `<path d="M${tx - 18 + k * 12} ${base - 322} Q${tx - 12 + k * 8} ${base - 360} ${tx} ${base - 372}" stroke="#7d8594" stroke-width="0.9" fill="none"/>`;
        o += rect(tx - 4, base - 390, 8, 16, '#3a404b') + line(tx, base - 390, tx, base - 404, '#d8b14a', 1.6) + circ(tx, base - 406, 2.4, '#d8b14a');
      }
      return o;
    };
    s += peter(110, 790) + frau(380, 792) + gross(700, 794);
    // the quay with its tram, the river with swans and the bridge's railing in the light
    s += rect(0, 794, 1000, 26, '#8d8a85') + rect(0, 794, 1000, 3, '#d8d3c9');
    const tram = (x, y) => `<g>${rect(x, y - 36, 220, 32, '#ffffff')}${rect(x, y - 16, 220, 12, '#1f5ca8')}${rect(x, y - 36, 220, 5, '#1f5ca8')}${windows(x + 6, y - 30, 208, 12, 9, 1, '#5d7b96', 0.75, 0.9)}${rect(x + 100, y - 30, 16, 26, '#3f566c')}${circ(x + 30, y - 2, 5, '#222')}${circ(x + 190, y - 2, 5, '#222')}${line(x + 110, y - 36, x + 124, y - 50, '#333', 1.4)}${line(x + 124, y - 50, x + 96, y - 50, '#333', 1.4)}${rect(x + 4, y - 26, 14, 8, '#ffcc33')}</g>`;
    s += tram(390, 818);
    s += rect(0, 820, 1000, 180, u('river'));
    s += `<g opacity="0.22" filter="url(#${id('b6')})">${rect(80, 822, 60, 130, '#e8e2d6')}${rect(360, 822, 40, 170, '#e3d6bf')}${rect(630, 822, 140, 110, '#e8e2d6')}</g>`;
    s += glitter(r, 0, 1000, 824, 1000, '#ffffff', 90);
    const swan = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-22 0 Q-24 -12 -8 -12 Q4 -14 14 -8 Q20 -4 22 0 Z" fill="#ffffff"/><path d="M14 -8 Q22 -18 18 -30 Q16 -36 22 -36 Q26 -35 26 -32" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M26 -33 L33 -31 L26 -30 Z" fill="#f08a24"/><path d="M-16 -4 Q-4 -16 10 -6" stroke="#dfe7ee" stroke-width="2" fill="none"/>${ell(0, 2, 24, 3, '#0c2a45', 'opacity="0.4"')}</g>`;
    s += swan(470, 880, 1) + swan(540, 905, 0.8) + swan(600, 870, 0.7);
    return `<defs>${d}</defs>${s}`;
  }


  // a curved East-Asian roof: a wide eave that sweeps up at both ends
  const eave = (cx, y, w, h, fill, edge) => {
    const tipL = [cx - w / 2 - h * 0.5, y - h * 0.4], tipR = [cx + w / 2 + h * 0.5, y - h * 0.4];
    return `<path d="M${f(tipL[0])} ${f(tipL[1])} Q${f(cx - w / 2)} ${f(y + h * 0.12)} ${f(cx - w * 0.36)} ${f(y)} L${f(cx + w * 0.36)} ${f(y)} Q${f(cx + w / 2)} ${f(y + h * 0.12)} ${f(tipR[0])} ${f(tipR[1])} Q${f(cx + w * 0.4)} ${f(y - h * 0.5)} ${f(cx + w * 0.26)} ${f(y - h)} L${f(cx - w * 0.26)} ${f(y - h)} Q${f(cx - w * 0.4)} ${f(y - h * 0.5)} ${f(tipL[0])} ${f(tipL[1])} Z" fill="${fill}"/>`
      + `<path d="M${f(cx + w * 0.05)} ${f(y - h)} L${f(cx + w * 0.26)} ${f(y - h)} Q${f(cx + w * 0.4)} ${f(y - h * 0.5)} ${f(tipR[0])} ${f(tipR[1])} Q${f(cx + w / 2)} ${f(y + h * 0.12)} ${f(cx + w * 0.36)} ${f(y)} L${f(cx + w * 0.05)} ${f(y)} Z" fill="#000" opacity="0.3"/>`
      + `<path d="M${f(tipL[0])} ${f(tipL[1])} Q${f(cx - w / 2)} ${f(y + h * 0.12)} ${f(cx - w * 0.36)} ${f(y)} L${f(cx + w * 0.36)} ${f(y)} Q${f(cx + w / 2)} ${f(y + h * 0.12)} ${f(tipR[0])} ${f(tipR[1])}" stroke="${edge}" stroke-width="2" fill="none"/>`;
  };

  /* ---------------- Tokyo: the Skytree in blue light, Tokyo Tower glowing orange, Sensō-ji's five-storey pagoda and the great
     red lantern of the Kaminarimon, a Shinkansen on its viaduct, neon towers, cherry blossom and the Shibuya crossing; night ---------------- */
  function tokyo() {
    const K = 'bzAtokyo', r = seeded(2012), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    let d = lg(id('sky'), [[0, '#05031a'], [0.4, '#1a0d45'], [0.7, '#4a1a6e'], [0.82, '#a03a8a']])
      + rg(id('glowB'), [[0, '#7fd8ff', 0.7], [1, '#7fd8ff', 0]]) + rg(id('glowO'), [[0, '#ffb24a', 0.75], [1, '#ff7a1a', 0]]) + rg(id('glowP'), [[0, '#ff4fd8', 0.6], [1, '#ff4fd8', 0]])
      + lg(id('st'), [[0, '#e8f6ff'], [0.5, '#9fc8e8'], [1, '#4a6c9a']], 0, 0, 1, 0)
      + lg(id('red'), [[0, '#ff6a3d'], [0.5, '#e8401c'], [1, '#8a1f0e']], 0, 0, 1, 0)
      + lg(id('lantern'), [[0, '#ff5a4a'], [0.45, '#d91f1f'], [1, '#6a0a0a']], 0, 0, 1, 0)
      + lg(id('road'), [[0, '#1a1430'], [1, '#0a0818']])
      + blur(id('b2'), 2) + blur(id('b6'), 6) + blur(id('b14'), 14)
      + winPatterns(K, '#ffe9b0', '#1a1638') + winPatterns(K + 'c', '#7fe9ff', '#141238', [[4, 6], [5, 7], [3, 5]]);
    let s = rect(0, 0, 1000, 1000, u('sky'));
    for (let k = 0; k < 90; k++) s += circ(r() * 1000, r() * 520, 0.5 + r() * 1.3, r() < 0.2 ? '#9be7ff' : '#fff', `opacity="${f(0.3 + r() * 0.7)}"`);
    s += circ(110, 120, 46, '#fdf6e3') + circ(124, 112, 42, '#1a0d45', 'opacity="0.0"') + circ(110, 120, 80, '#fdf6e3', `opacity="0.18" filter="url(#${id('b14')})"`);
    // light trails of the sci-fi city across the sky
    for (let k = 0; k < 3; k++) s += `<path d="M-20 ${360 + k * 40} Q500 ${300 + k * 30} 1020 ${380 + k * 36}" stroke="${['#00e5ff', '#ff4fd8', '#7b2ff7'][k]}" stroke-width="1.4" fill="none" opacity="0.3" stroke-dasharray="80 24 10 24"/>`;

    // the far towers, then the near ones, every window and sign lit
    const city = (x0, x1, base, hMin, hMax, fill, pat, neon) => {
      let o = '';
      for (let x = x0; x < x1;) {
        const w = 26 + r() * 40, h = hMin + r() * (hMax - hMin), top = base - h, c = ['#00e5ff', '#ff4fd8', '#ffd23f', '#7b2ff7', '#39ff88'][Math.floor(r() * 5)];
        o += rect(x, top, w, h, fill) + rect(x + 2, top + 4, w - 4, h - 4, `url(#${pat}${Math.floor(r() * 3)})`, 'opacity="0.85"');
        if (neon) { o += rect(x, top, w, 2, c) + line(x, top, x, base, c, 1, 'opacity="0.6"'); if (r() < 0.5) o += rect(x + w * 0.3, top + h * 0.1, w * 0.4, h * 0.3, c, 'opacity="0.85"') + rect(x + w * 0.3 + 2, top + h * 0.1 + 2, w * 0.4 - 4, h * 0.3 - 4, '#ffffff', 'opacity="0.35"'); }
        x += w + 2;
      }
      return o;
    };
    s += city(0, 1000, 760, 80, 260, '#1b1440', K + 'c-win', false);

    // Tokyo Skytree: 634 m, a triangle at the foot turning round as it rises, two observation decks, the mast
    const skytree = (cx, base, H) => {
      const k = H / 634, Z = z => base - z * k, hw = curve([[0, 34], [120, 22], [250, 16], [340, 13.5], [350, 18], [360, 13], [440, 10.5], [450, 12.5], [460, 9], [495, 6], [634, 1.2]]);
      let o = circ(cx, Z(330), 140, u('glowB'), 'opacity="0.6"');
      const L = [], R = []; for (let z = 0; z <= 495; z += 15) { L.push([cx - hw(z) * k, Z(z)]); R.push([cx + hw(z) * k, Z(z)]); }
      o += `<path d="M${pts(L)} L${pts(R.reverse())} Z" fill="#203a6a"/>`;
      for (let z = 0; z < 495; z += 11) { const a = hw(z) * k, b = hw(z + 11) * k; o += line(cx - a, Z(z), cx + b, Z(z + 11), '#9fe3ff', 0.7, 'opacity="0.8"') + line(cx + a, Z(z), cx - b, Z(z + 11), '#9fe3ff', 0.7, 'opacity="0.8"'); }
      o += `<path d="M${pts(L.map(([x, y]) => [x, y]))}" stroke="#dff6ff" stroke-width="1.6" fill="none"/>`;
      for (const [z, h, wd] of [[350, 14, 21], [450, 10, 14]]) o += rect(cx - wd * k, Z(z + h / 2), wd * 2 * k, h * k, '#d8f2ff') + rect(cx - wd * k, Z(z + h / 2) + h * k * 0.35, wd * 2 * k, h * k * 0.3, '#3aa7e8');
      o += rect(cx - 5 * k, Z(634), 10 * k, (634 - 495) * k, u('st')) + line(cx, Z(634), cx, Z(660), '#dff6ff', 1.2) + circ(cx, Z(634), 2.6, '#ff4040');
      return o;
    };
    s += skytree(880, 770, 620);

    // Tokyo Tower: a red-and-white lattice tower lit gold, two observation decks
    const tTower = (cx, base, H) => {
      const k = H / 333, Z = z => base - z * k, hw = curve([[0, 40], [40, 24], [80, 15], [125, 10.5], [150, 9], [223, 5.5], [250, 3.4], [333, 0.6]]);
      let o = circ(cx, Z(120), 120, u('glowO'), 'opacity="0.7"');
      for (const sd of [-1, 1]) {
        for (let z = 0; z < 250; z += 9) { const a = hw(z) * k * sd, b = hw(z + 9) * k * sd, band = Math.floor(z / 28) % 2; o += line(cx + a, Z(z), cx + b * 0.2, Z(z + 9), band ? '#fff3e0' : '#ff7a2a', 0.8) + line(cx + a * 0.2, Z(z), cx + b, Z(z + 9), band ? '#fff3e0' : '#ff7a2a', 0.8); }
        const P = []; for (let z = 0; z <= 250; z += 6) P.push([cx + hw(z) * k * sd, Z(z)]);
        o += `<path d="M${pts(P)}" stroke="#ffb35c" stroke-width="2.4" fill="none"/>`;
      }
      o += `<path d="M${f(cx - 26 * k)} ${f(Z(2))} Q${f(cx)} ${f(Z(48))} ${f(cx + 26 * k)} ${f(Z(2))}" stroke="#ffb35c" stroke-width="2" fill="none"/>`;
      for (const [z, w] of [[150, 14], [223, 8]]) o += rect(cx - w * k, Z(z + 5), w * 2 * k, 9 * k, '#ffe1a0') + rect(cx - w * k, Z(z + 5) + 4 * k, w * 2 * k, 3 * k, '#ff7a2a');
      o += rect(cx - 2.6 * k, Z(333), 5.2 * k, 83 * k, '#ff9a4a') + circ(cx, Z(333), 2.2, '#ff4040');
      return o;
    };
    s += tTower(640, 760, 360);
    s += city(0, 1000, 790, 50, 170, '#130e30', K + '-win', true);

    // the Shinkansen on its viaduct: long white nose, the blue stripe, a streak of light
    s += rect(0, 700, 1000, 10, '#2a2450') + rect(0, 710, 1000, 4, '#00e5ff', 'opacity="0.7"');
    for (let k = 0; k < 10; k++) s += rect(40 + k * 105, 714, 12, 80, '#1d1840');
    s += `<path d="M180 699 H700 Q760 699 800 690 Q770 676 720 674 H180 Z" fill="#f4f6fa"/>` + rect(180, 690, 560, 4, '#1f4fb8') + windows(190, 678, 520, 9, 34, 1, '#2a3a5a', 0.7, 0.7) + `<path d="M720 676 Q752 678 770 686 L740 686 Z" fill="#2a3a5a"/>` + rect(120, 693, 60, 3, '#7fe9ff', `opacity="0.6" filter="url(#${id('b2')})"`);

    // Sensō-ji's five-storey pagoda: red posts, dark curved roofs stacked and narrowing, the golden finial
    const pagoda = (cx, base, h) => {
      let o = rect(cx - 50, base - 16, 100, 16, '#5a3a3a');
      const story = h / 7.2;
      for (let i = 0; i < 5; i++) {
        const y = base - 16 - i * story * 1.18, w = 74 - i * 9;
        o += rect(cx - w / 2 + 10, y - story * 0.75, w - 20, story * 0.75, u('red')) + windows(cx - w / 2 + 12, y - story * 0.62, w - 24, story * 0.4, 3, 1, '#ffcc66', 0.45, 0.8);
        o += eave(cx, y - story * 0.72, w + 8, story * 0.62, '#26263a', '#c9a24a');
      }
      const top = base - 16 - 5 * story * 1.18 + story * 0.2;
      o += rect(cx - 2.5, top - story * 1.8, 5, story * 1.8, '#d8b14a');
      for (let k = 0; k < 9; k++) o += ell(cx, top - 6 - k * story * 0.16, 7 - k * 0.3, 1.6, '#e9c25a');
      return o;
    };
    s += pagoda(130, 800, 360);

    // the Kaminarimon: the red gate with its dark roof and the giant red lantern
    const gate = (cx, base) => {
      let o = rect(cx - 120, base - 110, 240, 110, u('red'));
      o += `<path d="M${cx - 70} ${base} V${base - 80} H${cx + 70} V${base} Z" fill="#2a0e0e"/>`;
      o += eave(cx, base - 108, 280, 46, '#24242e', '#c9a24a') + rect(cx - 130, base - 112, 260, 6, '#3a1a1a');
      for (const dx of [-110, -70, 66, 106]) o += rect(cx + dx, base - 108, 8, 108, '#a8200f');
      o += ell(cx, base - 54, 44, 54, u('lantern')) + rect(cx - 30, base - 112, 60, 10, '#1a1a1a') + rect(cx - 30, base - 6, 60, 10, '#1a1a1a');
      for (let k = 0; k < 9; k++) o += `<path d="M${cx - 44 + k * 11} ${base - 100} Q${cx - 50 + k * 12.5} ${base - 54} ${cx - 44 + k * 11} ${base - 8}" stroke="#7a0a0a" stroke-width="0.8" fill="none" opacity="0.6"/>`;
      o += `<text x="${cx}" y="${base - 40}" font-size="34" font-weight="900" text-anchor="middle" fill="#111" font-family="serif">雷門</text>`;
      return o + ell(cx, base - 54, 70, 80, u('glowO'), 'opacity="0.35"');
    };
    s += gate(360, 810);

    // the Shibuya crossing: zebra stripes fanning out, people with umbrellas, the glow of the big screens on the street
    s += rect(0, 800, 1000, 200, u('road'));
    for (let k = 0; k < 12; k++) s += poly([[430 + k * 22, 820], [442 + k * 22, 820], [300 + k * 52 + 26, 1000], [300 + k * 52, 1000]], '#e9e6f2', 'opacity="0.85"');
    for (let k = 0; k < 7; k++) s += poly([[380, 836 + k * 22], [380, 846 + k * 22], [200 - k * 20, 852 + k * 26], [200 - k * 20, 840 + k * 26]], '#e9e6f2', 'opacity="0.6"');
    s += rect(0, 800, 1000, 30, u('glowP'), 'opacity="0.4"');
    for (let k = 0; k < 60; k++) { const px = 260 + r() * 520, py = 828 + r() * 160, sc = 0.6 + (py - 828) / 200; s += rect(px, py - 12 * sc, 4 * sc, 12 * sc, '#0a0814') + circ(px + 2 * sc, py - 14 * sc, 2.4 * sc, '#0a0814'); if (r() < 0.3) s += `<path d="M${f(px - 7 * sc)} ${f(py - 16 * sc)} Q${f(px + 2 * sc)} ${f(py - 26 * sc)} ${f(px + 11 * sc)} ${f(py - 16 * sc)} Z" fill="${['#00e5ff', '#ff4fd8', '#ffd23f', '#ffffff'][k % 4]}" opacity="0.85"/>`; }
    // cherry blossom at the edges
    const blossom = (x, y, ang, len) => {
      let o = `<path d="M${x} ${y} q${len * 0.4 * Math.cos(ang)} ${len * 0.1} ${len * Math.cos(ang)} ${len * Math.sin(ang)}" stroke="#3a1f2a" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      for (let k = 0; k < 70; k++) { const t = r(), bx = x + len * Math.cos(ang) * t + (r() - 0.5) * 60, by = y + len * Math.sin(ang) * t + (r() - 0.5) * 50; o += circ(bx, by, 3 + r() * 5, ['#ffc2dc', '#ff9cc6', '#ffe0ec'][k % 3], `opacity="${f(0.7 + r() * 0.3)}"`); }
      return o;
    };
    s += blossom(-10, 330, -0.35, 190) + blossom(1010, 600, Math.PI + 0.3, 170);
    return `<defs>${d}</defs>${s}`;
  }


  // battlements along the top of a wall from x0 to x1 at y
  const crenel = (x0, x1, y, h, fill, step = 12) => { let o = ''; for (let x = x0; x < x1 - 1; x += step) o += rect(x, y - h, step * 0.55, h, fill); return o; };

  /* ---------------- Dublin: the Record Tower of Dublin Castle, Christ Church Cathedral, a Georgian terrace with its painted
     doors and fanlights, a red pub front, the Ha'penny Bridge over the Liffey with its lamps; an old-kingdom dusk ---------------- */
  function dublin() {
    const K = 'bzAdublin', r = seeded(1204), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    let d = lg(id('sky'), [[0, '#1f2f55'], [0.35, '#4a5f8a'], [0.6, '#c99a8a'], [0.76, '#f2c58a']])
      + lg(id('river'), [[0, '#55607e'], [1, '#1d243b']])
      + lg(id('stone'), [[0, '#b9b4a8'], [0.5, '#8a8678'], [1, '#55524a']], 0, 0, 1, 0)
      + lg(id('stoneW'), [[0, '#cfc6b2'], [1, '#8d8370']], 0, 0, 1, 0)
      + lg(id('brick'), [[0, '#a9533a'], [1, '#6d3022']], 0, 0, 1, 0)
      + lg(id('iron'), [[0, '#ffffff'], [1, '#c9ccd4']])
      + rg(id('lamp'), [[0, '#fff2c0', 0.9], [1, '#ffd27a', 0]])
      + blur(id('b3'), 3) + blur(id('b8'), 8);
    let s = rect(0, 0, 1000, 1000, u('sky'));
    s += `<g opacity="0.85">${cloud(220, 260, 1.8, '#d9b6b0', '#6d6f93', id('b3'))}${cloud(640, 220, 1.5, '#e2bfb0', '#6d6f93', id('b3'))}${cloud(860, 380, 1.1, '#f0c9a8', '#8d7f9a', id('b3'))}${cloud(420, 420, 0.9, '#f3cfa8', '#9a8aa0', id('b3'))}</g>`;
    // a faint rainbow over the old town
    s += `<g opacity="0.16" fill="none" stroke-width="10">${['#ff5a5a', '#ffb347', '#fff07a', '#6fe39a', '#6ab8ff', '#9a7bff'].map((c, k) => `<path d="M260 760 A300 300 0 0 1 860 760" stroke="${c}" transform="translate(0 ${k * 10}) scale(1 ${f(1 - k * 0.02)})"/>`).join('')}</g>`;
    s += `<path d="${ridge(smooth([[0, 640], [180, 610], [360, 630], [520, 600], [700, 625], [860, 604], [1000, 630]], 10), 760)}" fill="#6a6f8a"/>`;
    // the roofs of the city, the dome of the Custom House far off
    for (let x = 0; x < 1000;) { const w = 20 + r() * 34, h = 30 + r() * 40; s += rect(x, 720 - h, w, h + 40, '#4e5470') + poly([[x, 720 - h], [x + w / 2, 708 - h], [x + w, 720 - h]], '#454a63'); x += w; }
    s += ell(860, 690, 26, 30, '#5d6382') + rect(830, 690, 60, 40, '#565c7a') + line(860, 660, 860, 646, '#5d6382', 3);

    // Christ Church Cathedral: the square tower with pinnacles, the Gothic nave, its flying buttresses
    const church = (cx, base) => {
      let o = rect(cx - 170, base - 130, 300, 130, u('stone')) + poly([[cx - 176, base - 130], [cx - 20, base - 196], [cx + 136, base - 130]], '#4a4e5a');
      for (let k = 0; k < 6; k++) { const x = cx - 156 + k * 48; o += `<path d="M${x} ${base - 30} v-56 q10 -18 20 0 v56 Z" fill="#3c4660"/>` + `<path d="M${x + 3} ${base - 34} v-46 q7 -12 14 0 v46 Z" fill="#e8b860" opacity="0.6"/>`; o += poly([[x - 10, base], [x - 10, base - 110], [x - 4, base - 120], [x + 2, base - 110], [x + 2, base]], '#7a766a'); }
      o += rect(cx + 20, base - 290, 90, 290, u('stone')) + rect(cx + 70, base - 290, 40, 290, '#000', 'opacity="0.18"');
      for (let k = 0; k < 2; k++) o += `<path d="M${cx + 36 + k * 30} ${base - 190} v-46 q9 -16 18 0 v46 Z" fill="#2f3648"/>`;
      o += circ(cx + 65, base - 128, 18, '#3c4660') + circ(cx + 65, base - 128, 18, 'none', 'stroke="#cfc6b2" stroke-width="2.5"');
      o += crenel(cx + 18, cx + 112, base - 290, 10, '#9a968a', 11);
      for (const dx of [16, 104]) o += rect(cx + dx, base - 320, 10, 32, '#a8a498') + poly([[cx + dx - 2, base - 320], [cx + dx + 5, base - 344], [cx + dx + 12, base - 320]], '#8a8678');
      o += line(cx + 20, base - 290, cx + 20, base, '#e8e2d2', 1.4, 'opacity="0.7"');
      return o;
    };
    s += church(470, 780);

    // Dublin Castle: the round Record Tower with battlements, the curtain wall, the Chapel Royal's pinnacles
    const castle = (cx, base) => {
      let o = rect(cx - 10, base - 120, 260, 120, u('stoneW')) + crenel(cx - 10, cx + 250, base - 120, 10, '#b0a690');
      for (let k = 0; k < 5; k++) o += `<path d="M${cx + 30 + k * 44} ${base - 40} v-40 q9 -14 18 0 v40 Z" fill="#3a3f52"/>`;
      o += rect(cx - 80, base - 280, 130, 280, u('stone')) + `<rect x="${cx - 80}" y="${base - 280}" width="130" height="280" fill="url(#${K}-round)"/>`;
      for (let j = 0; j < 14; j++) o += line(cx - 80, base - 20 - j * 19, cx + 50, base - 20 - j * 19, '#5a574e', 0.8, 'opacity="0.5"');
      for (let j = 0; j < 4; j++) o += rect(cx - 22, base - 70 - j * 54, 12, 22, '#2a2e3c');
      o += rect(cx - 86, base - 292, 142, 14, '#9a968a') + crenel(cx - 86, cx + 56, base - 292, 14, '#9a968a', 14);
      o += line(cx - 30, base - 306, cx - 30, base - 346, '#3a3a3a', 2) + `<path d="M${cx - 30} ${base - 346} q14 4 26 0 v14 q-12 4 -26 0 Z" fill="#169b62"/>`;
      return o;
    };
    d += lg(id('round'), [[0, '#ffffff', 0.25], [0.35, '#ffffff', 0], [0.75, '#000', 0.25], [1, '#000', 0.45]], 0, 0, 1, 0);
    s += castle(110, 790);

    // the Georgian terrace: red brick, tall sash windows lit, painted doors with fanlights, a red pub front with flower baskets
    const terrace = (x0, x1, base) => {
      let o = rect(x0, base - 210, x1 - x0, 210, u('brick')) + rect(x0, base - 214, x1 - x0, 6, '#d8cdb8');
      const doors = ['#1f6f4a', '#c8202f', '#f2c12e', '#2a4f9e', '#7b3fa0', '#e86a2a'];
      const n = Math.floor((x1 - x0) / 62);
      for (let i = 0; i < n; i++) {
        const x = x0 + i * (x1 - x0) / n, w = (x1 - x0) / n;
        for (let j = 0; j < 3; j++) o += rect(x + w * 0.2, base - 196 + j * 46, w * 0.24, 34, r() < 0.6 ? '#ffd889' : '#3a3550') + rect(x + w * 0.56, base - 196 + j * 46, w * 0.24, 34, r() < 0.6 ? '#ffd889' : '#3a3550') + rect(x + w * 0.18, base - 162 + j * 46, w * 0.64, 3, '#e9dfc9');
        if (i === n - 2) { o += rect(x - 2, base - 62, w + 4, 62, '#b3121f') + rect(x, base - 62, w, 14, '#1c1c1c') + `<text x="${f(x + w / 2)}" y="${base - 51}" font-size="10" font-weight="700" text-anchor="middle" fill="#f2c94c" font-family="serif">PUB</text>` + rect(x + 6, base - 44, w - 12, 30, '#ffcf7a', 'opacity="0.9"') + windows(x + 6, base - 44, w - 12, 30, 4, 2, '#b3121f', 0.15, 0.15); for (const bx of [x + 6, x + w - 6]) o += circ(bx, base - 66, 7, '#e85a8a') + circ(bx - 3, base - 69, 3, '#ffd23f') + circ(bx + 3, base - 66, 3, '#7fd36a'); continue; }
        const dx = x + w * 0.34, dw = w * 0.32, col = doors[i % doors.length];
        o += rect(dx - 5, base - 62, dw + 10, 62, '#efe6d2') + rect(dx, base - 48, dw, 48, col) + `<path d="M${f(dx)} ${base - 48} a${f(dw / 2)} ${f(dw / 2)} 0 0 1 ${f(dw)} 0 Z" fill="#ffe4a0"/>`;
        for (let k = 1; k < 5; k++) o += line(dx + dw / 2, base - 48, dx + dw / 2 + Math.cos(Math.PI * k / 5) * dw / 2, base - 48 - Math.sin(Math.PI * k / 5) * dw / 2, '#efe6d2', 0.8);
        o += rect(dx + dw * 0.2, base - 40, dw * 0.24, 14, '#000', 'opacity="0.18"') + rect(dx + dw * 0.56, base - 40, dw * 0.24, 14, '#000', 'opacity="0.18"') + circ(dx + dw * 0.8, base - 24, 1.6, '#f2c94c');
        o += line(x, base - 210, x, base, '#5a2618', 1.2);
      }
      return o;
    };
    s += terrace(640, 1000, 792);
    // the quay wall, then the Liffey with the lamps' reflections
    s += rect(0, 792, 1000, 18, '#6f6a5e') + rect(0, 792, 1000, 3, '#a59f8f');
    s += rect(0, 810, 1000, 190, u('river'));
    s += glitter(r, 0, 1000, 814, 1000, '#ffd59a', 90) + glitter(r, 0, 1000, 814, 1000, '#c8cbe8', 50);
    // the Ha'penny Bridge: one low elliptical arch of white cast iron, lattice railings, three lamps on iron arches
    const hapenny = (x0, x1, base, rise) => {
      const mid = (x0 + x1) / 2, half = (x1 - x0) / 2, Y = x => base - rise * Math.sqrt(Math.max(0, 1 - Math.pow((x - mid) / half, 2)));
      const P = (dy) => { const a = []; for (let k = 0; k <= 40; k++) { const x = x0 + (x1 - x0) * k / 40; a.push([x, Y(x) - dy]); } return a; };
      // the river runs on under the arch to the far bank; stone abutments carry the ends
      let o = `<path d="M${pts(P(-2))} L${x1} ${base + 12} L${x0} ${base + 12} Z" fill="url(#${K}-river)"/>` + rect(x0 + 20, base - rise * 0.62, x1 - x0 - 40, 4, '#6f6a5e', 'opacity="0.9"');
      for (let k = 0; k < 30; k++) { const gx = x0 + 40 + r() * (x1 - x0 - 80), gy = base - rise * 0.5 + r() * rise * 0.5; o += line(gx, gy, gx + 8 + r() * 16, gy, '#ffd59a', 1, 'opacity="0.5"'); }
      for (const [ax, sd] of [[x0, -1], [x1, 1]]) o += poly([[ax - sd * 4, base - 6], [ax + sd * 30, base - 6], [ax + sd * 34, base + 12], [ax - sd * 8, base + 12]], '#7d776a') + rect(Math.min(ax - sd * 4, ax + sd * 30), base - 8, 34, 3, '#a59f8f');
      // the reflection under the bridge
      o += `<path d="M${pts(P(0))} L${x1} ${base + 2} Q${mid} ${base + rise * 0.9} ${x0} ${base + 2} Z" fill="#ffffff" opacity="0.08"/>`;
      o += `<path d="M${pts(P(0))}" stroke="${u('iron')}" stroke-width="5" fill="none"/><path d="M${pts(P(30))}" stroke="#ffffff" stroke-width="3" fill="none"/><path d="M${pts(P(44))}" stroke="#ffffff" stroke-width="2.4" fill="none"/>`;
      for (let k = 1; k < 40; k++) { const x = x0 + (x1 - x0) * k / 40, xn = x0 + (x1 - x0) * (k + 1) / 40; o += line(x, Y(x), x, Y(x) - 30, '#ffffff', 1.2) + line(x, Y(x) - 30, xn, Y(xn) - 44, '#f0f2f6', 0.9) + line(x, Y(x) - 44, xn, Y(xn) - 30, '#f0f2f6', 0.9); }
      for (let k = 0; k < 18; k++) { const x = x0 + 10 + k * (x1 - x0 - 20) / 17; o += circ(x, Y(x) - 15, 4, 'none', 'stroke="#ffffff" stroke-width="1.2"'); }
      for (const t of [0.22, 0.5, 0.78]) {
        const x = x0 + (x1 - x0) * t, y = Y(x) - 44;
        o += `<path d="M${f(x - 22)} ${f(y)} Q${f(x)} ${f(y - 40)} ${f(x + 22)} ${f(y)}" stroke="#ffffff" stroke-width="2.2" fill="none"/>` + line(x, y - 30, x, y - 44, '#ffffff', 2) + circ(x, y - 50, 22, u('lamp')) + rect(x - 4, y - 56, 8, 10, '#fff4cc') + poly([[x - 6, y - 56], [x, y - 62], [x + 6, y - 56]], '#e9ecf2');
        o += rect(x - 2, base + 6, 4, 60, '#ffe7a8', `opacity="0.4" filter="url(#${K}-b3)"`);
      }
      return o;
    };
    s += hapenny(240, 760, 800, 46);
    // gulls
    for (let k = 0; k < 5; k++) { const gx = 300 + r() * 500, gy = 480 + r() * 120; s += `<path d="M${f(gx - 9)} ${f(gy)} q5 -6 9 0 q4 -6 9 0" stroke="#f4f0e8" stroke-width="1.6" fill="none"/>`; }
    return `<defs>${d}</defs>${s}`;
  }


  // a Doric colonnade: n fluted columns between x0 and x1 standing on y = base, height h; lit from the left
  const doric = (x0, x1, base, h, n, lit, shade, broken) => {
    let o = '';
    const step = (x1 - x0) / (n - 1), cw = Math.min(step * 0.62, h * 0.16);
    for (let i = 0; i < n; i++) {
      if (broken && broken.includes(i)) continue;
      const x = x0 + i * step, top = base - h;
      o += poly([[x - cw / 2, base], [x - cw * 0.42, top + 4], [x + cw * 0.42, top + 4], [x + cw / 2, base]], lit) + poly([[x + cw * 0.05, base], [x + cw * 0.05, top + 4], [x + cw * 0.42, top + 4], [x + cw / 2, base]], shade);
      o += line(x - cw * 0.2, base, x - cw * 0.17, top + 4, '#000', 0.6, 'opacity="0.12"') + rect(x - cw * 0.6, top, cw * 1.2, 5, lit) + rect(x - cw * 0.5, top + 4, cw, 3, shade, 'opacity="0.6"');
    }
    return o;
  };

  /* ---------------- Ancient Greece: the Parthenon on the Acropolis, the Temple of Poseidon on the cliffs of Sounion, the theatre
     of Epidaurus, a trireme under sail, Mount Olympus in its clouds, olive trees and cypresses; a golden evening on the Aegean ---------------- */
  function greece() {
    const K = 'bzAgreece', r = seeded(432), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    let d = lg(id('sky'), [[0, '#2b4a86'], [0.35, '#6d8cc0'], [0.6, '#f0b98a'], [0.72, '#ffcf7a']])
      + lg(id('sea'), [[0, '#3d6fa6'], [0.5, '#1f4f86'], [1, '#0d2c55']])
      + rg(id('sun'), [[0, '#fff3cc'], [0.3, '#ffd27a', 0.8], [1, '#ffb35c', 0]])
      + lg(id('rock'), [[0, '#d9b98a'], [0.5, '#a9845a'], [1, '#6e5038']], 0, 0, 1, 0)
      + lg(id('marble'), [[0, '#fff4dc'], [1, '#e9cfa2']], 0, 0, 1, 0)
      + lg(id('olymp'), [[0, '#a9a8c4'], [1, '#7e7fa2']], 0, 0, 1, 0)
      + lg(id('relief'), [[0, '#fff2c8', 0.2], [0.5, '#000', 0], [1, '#2a1a10', 0.4]], 0, 0, 1, 0)
      + blur(id('b3'), 3) + blur(id('b8'), 8);
    let s = rect(0, 0, 1000, 1000, u('sky'));
    s += circ(820, 600, 300, u('sun')) + circ(820, 610, 34, '#fff1c4');
    // Mount Olympus, far off, its summit in cloud
    s += alps(r, [[-30, 540], [60, 500], [150, 456], [240, 420], [320, 452], [420, 500], [540, 560]], 620, 470, '#a4a3c0', '#7e7fa2', '#fbf4ee', '#cfcbe0');
    s += cloud(250, 400, 1.6, '#fff1e6', '#d8c6cf', id('b3')) + cloud(160, 430, 1.1, '#ffeede', '#d8c6cf', id('b3')) + cloud(620, 300, 1.3, '#ffe2c4', '#cfb0b6', id('b3'));
    // the sea and its golden road
    s += rect(0, 620, 1000, 380, u('sea'));
    s += glitter(r, 0, 1000, 624, 1000, '#ffd98a', 160, 820, 260) + glitter(r, 0, 1000, 624, 1000, '#9fc0e6', 60);
    // Sounion: a cliff falling to the sea, the white temple of Poseidon on top, some columns fallen
    const cliff = smooth([[600, 760], [660, 690], [720, 640], [790, 626], [880, 622], [960, 640], [1010, 660]], 5);
    s += `<path d="${ridge(cliff, 820)}" fill="${u('rock')}"/>` + `<path d="M600 760 L660 690 L700 820 Z" fill="#6e5038" opacity="0.4"/>`;
    s += trees(r, 650, 1000, 650, 6, 14, '#5b6a34', '#728244', '#93a35a');
    s += rect(756, 612, 168, 8, u('marble')) + rect(762, 606, 156, 6, '#f4e2c0');
    s += doric(770, 910, 606, 70, 9, '#fff4dc', '#cdb08a', [6]) + rect(764, 532, 96, 8, u('marble')) + rect(764, 528, 96, 4, '#f4e2c0');
    // the theatre of Epidaurus on the hillside: rows of stone seats in a fan around the round orchestra
    const hill = smooth([[-20, 820], [40, 700], [140, 640], [240, 610], [300, 600], [460, 596], [600, 610], [680, 650], [740, 820]], 5);
    s += `<path d="${ridge(hill, 840)}" fill="${u('rock')}"/>`;
    for (let k = 0; k < 26; k++) { const x = 10 + r() * 700, y = curve(hill)(x) + 30 + r() * 160; if (y < 830) s += line(x, y, x + 30 + r() * 60, y + (r() - 0.5) * 6, '#6e5038', 1.2, 'opacity="0.35"'); }
    s += canopy(r, hill, 830, 70, [230, 650]).replace(/#285c2b|#2f6a32|#3b7a38|#22512a/g, m => ({ '#285c2b': '#56653a', '#2f6a32': '#66744a', '#3b7a38': '#7a8a52', '#22512a': '#4d5a32' })[m]);
    s += trees(r, 0, 120, 720, 14, 26, '#4b5a2c', '#647438', '#86964c');
    for (let k = 0; k < 12; k++) s += `<path d="M${30 + k * 4} ${790 - k * 7} A${120 - k * 6} ${40 - k * 1.5} 0 0 1 ${270 - k * 4} ${790 - k * 7}" stroke="${k % 2 ? '#e4cfa8' : '#c9ad84'}" stroke-width="5" fill="none"/>`;
    s += ell(150, 800, 44, 10, '#d9c39a');
    // the Acropolis: the rock with its walls, and the Parthenon, three-quarter view, the sun on its front
    // the sheer rock of the Acropolis under its walls
    s += `<path d="M232 600 L648 600 L668 660 Q560 676 440 668 Q320 676 214 660 Z" fill="#a07a52"/>`;
    for (let k = 0; k < 40; k++) { const x = 226 + r() * 430; s += line(x, 602, x + (r() - 0.5) * 8, 630 + r() * 36, k % 3 ? '#6e5038' : '#e3c79c', 1 + r() * 1.5, 'opacity="0.5"'); }
    s += `<path d="${ridge(hill, 840)}" fill="url(#${K}-relief)"/>`;
    s += rect(240, 586, 400, 16, '#b8946a') + rect(240, 584, 400, 4, '#d9b98a');
    for (let k = 0; k < 20; k++) s += rect(240 + k * 20, 580, 12, 6, '#c9a678');
    const parth = (x0, base, w, h) => {
      let o = '';
      const side = w * 0.55, sd = 26;
      // the long side, receding to the right, darker
      o += poly([[x0 + w, base], [x0 + w + side, base - sd], [x0 + w + side, base - sd - 10], [x0 + w, base - 10]], '#c9ad84');
      o += doric(x0 + w + 8, x0 + w + side - 4, base - 10, h - 4, 12, '#ead2a6', '#b59670');
      // (the roof is long gone: only the entablature runs along the side)
      o += poly([[x0 + w, base - h - 6], [x0 + w + side, base - sd - h - 6], [x0 + w + side, base - sd - h + 8], [x0 + w, base - h + 8]], '#d8bd92');
      o += poly([[x0 + w, base - h - 18], [x0 + w + side * 0.55, base - sd * 0.55 - h - 18], [x0 + w + side * 0.55, base - sd * 0.55 - h - 6], [x0 + w, base - h - 6]], '#e2c597');
      // the front: steps, eight columns, architrave, triglyph frieze, pediment
      o += rect(x0 - 10, base - 4, w + 20, 8, u('marble')) + rect(x0 - 6, base - 10, w + 12, 7, '#f4e2c0');
      o += doric(x0 + 8, x0 + w - 8, base - 10, h - 10, 8, '#fff4dc', '#d9bb8e');
      o += rect(x0 - 2, base - h - 6, w + 4, 10, u('marble')) + rect(x0 - 2, base - h + 4, w + 4, 2, '#cdb08a');
      for (let k = 0; k < 16; k++) o += rect(x0 + 2 + k * (w / 16), base - h - 14, w / 32, 8, '#cdb08a');
      o += rect(x0 - 4, base - h - 18, w + 8, 4, '#fff4dc');
      o += poly([[x0 - 6, base - h - 18], [x0 + w / 2, base - h - 46], [x0 + w + 6, base - h - 18]], u('marble')) + poly([[x0 + 8, base - h - 20], [x0 + w / 2, base - h - 40], [x0 + w - 8, base - h - 20]], '#e2c597');
      for (let k = 0; k < 7; k++) o += circ(x0 + w * 0.2 + k * w * 0.1, base - h - 25 - (k < 4 ? k : 6 - k) * 2.5, 3, '#cdb08a');
      return o;
    };
    s += parth(300, 584, 180, 92);
    // a trireme under sail: the long low hull, the eye at the bow, banks of oars, the square sail
    const trireme = (x, y) => {
      let o = `<path d="M${x - 110} ${y - 10} Q${x - 120} ${y - 30} ${x - 106} ${y - 40} Q${x - 100} ${y - 18} ${x - 90} ${y - 12} L${x + 90} ${y - 12} Q${x + 110} ${y - 14} ${x + 122} ${y - 4} L${x + 100} ${y + 6} L${x - 96} ${y + 6} Z" fill="#7a3e22"/>`;
      o += rect(x - 92, y - 16, 182, 5, '#c98a3a') + rect(x - 92, y - 6, 182, 3, '#2a1a10') + circ(x + 98, y - 6, 3, '#fff') + circ(x + 98, y - 6, 1.4, '#111');
      for (let k = 0; k < 22; k++) o += line(x - 84 + k * 8, y - 4, x - 92 + k * 8, y + 18, '#4a2a16', 1.2);
      o += line(x - 4, y - 14, x - 4, y - 110, '#3a2414', 3) + line(x - 50, y - 104, x + 42, y - 104, '#3a2414', 2.4);
      o += `<path d="M${x - 48} ${y - 102} L${x + 40} ${y - 102} Q${x + 46} ${y - 64} ${x + 38} ${y - 28} L${x - 46} ${y - 28} Q${x - 54} ${y - 64} ${x - 48} ${y - 102} Z" fill="#f4e7cc"/>`;
      for (let k = 0; k < 4; k++) o += line(x - 40 + k * 26, y - 100, x - 40 + k * 26, y - 30, '#c9b48a', 1.2);
      o += `<path d="M${x - 30} ${y - 80} Q${x - 4} ${y - 96} ${x + 22} ${y - 80} Q${x - 4} ${y - 52} ${x - 30} ${y - 80} Z" fill="#b5442a" opacity="0.8"/>`;
      return o + ell(x, y + 10, 130, 6, '#0d2c55', 'opacity="0.5"');
    };
    s += trireme(520, 930);
    // the foreground: olive trees with silver leaves, dark cypresses, a broken column and an amphora
    const cypress = (x, base, h) => `<path d="M${x} ${base} C${x - h * 0.13} ${base - h * 0.3} ${x - h * 0.08} ${base - h * 0.8} ${x} ${base - h} C${x + h * 0.08} ${base - h * 0.8} ${x + h * 0.13} ${base - h * 0.3} ${x} ${base} Z" fill="#2a3a22"/><path d="M${x} ${base} C${x - h * 0.13} ${base - h * 0.3} ${x - h * 0.08} ${base - h * 0.8} ${x} ${base - h} Z" fill="#3e5230"/>`;
    s += cypress(250, 600, 90) + cypress(268, 600, 70) + cypress(640, 612, 80);
    return `<defs>${d}</defs>${s}`;
  }


  /* ---------------- Cairo: the pyramids of Giza and the Great Sphinx, the Muhammad Ali Mosque on the Citadel with its domes and
     pencil minarets, the lattice Cairo Tower, feluccas on the Nile, palms and a camel caravan; the desert at golden hour ---------------- */
  function cairo() {
    const K = 'bzAcairo', r = seeded(2560), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    let d = lg(id('sky'), [[0, '#3c6fb0'], [0.35, '#86b2d8'], [0.62, '#f2cf96'], [0.72, '#f7b56a']])
      + rg(id('sun'), [[0, '#fff6d8'], [0.3, '#ffe0a0', 0.8], [1, '#ffc070', 0]])
      + lg(id('pyrL'), [[0, '#f4d29a'], [1, '#d6a565']], 0, 0, 1, 1) + lg(id('pyrR'), [[0, '#b98448'], [1, '#7d5228']], 0, 0, 1, 1)
      + lg(id('sand'), [[0, '#efc884'], [1, '#c9954f']])
      + lg(id('nile'), [[0, '#4f8fbf'], [1, '#1f4f7a']])
      + lg(id('alab'), [[0, '#f6ead6'], [0.6, '#d9c3a2'], [1, '#9c8466']], 0, 0, 1, 0)
      + lg(id('domeG'), [[0, '#c8d0d6'], [0.5, '#8d98a2'], [1, '#4f5862']], 0, 0, 1, 0)
      + lg(id('tower'), [[0, '#e6c79a'], [0.5, '#b8915e'], [1, '#6e5233']], 0, 0, 1, 0)
      + blur(id('b3'), 3) + blur(id('b8'), 8)
      + `<pattern id="${id('lat')}" width="12" height="16" patternUnits="userSpaceOnUse"><path d="M0 0 L6 8 L0 16 M12 0 L6 8 L12 16" stroke="#5a4028" stroke-width="2.2" fill="none"/></pattern>`;
    let s = rect(0, 0, 1000, 1000, u('sky'));
    s += circ(760, 560, 280, u('sun')) + circ(760, 560, 30, '#fff4d0');
    s += `<g opacity="0.7">${cloud(260, 260, 1.6, '#fff4e6', '#d9c3b6', id('b3'))}${cloud(640, 320, 1.0, '#fff1de', '#d9c3b6', id('b3'))}</g>`;
    // the Giza plateau: three pyramids with their lit and shaded faces and courses of stone, the small queens' pyramids
    s += `<path d="${ridge(smooth([[0, 640], [200, 628], [420, 636], [640, 624], [860, 634], [1000, 628]], 10), 700)}" fill="#e2b678"/>`;
    const pyramid = (cx, base, w, h, capped) => {
      const ax = cx + w * 0.06, apex = [ax, base - h];
      let o = poly([[cx - w / 2, base], apex, [ax + w * 0.08, base]], u('pyrL')) + poly([[ax + w * 0.08, base], apex, [cx + w / 2, base]], u('pyrR'));
      for (let k = 1; k < 26; k++) { const t = k / 26, y = base - h * t, xl = cx - w / 2 + (ax - (cx - w / 2)) * t, xm = ax + w * 0.08 * (1 - t), xr = cx + w / 2 + (ax - (cx + w / 2)) * t; o += line(xl, y, xm, y, '#b88a50', 0.7, 'opacity="0.55"') + line(xm, y, xr, y, '#4f3418', 0.7, 'opacity="0.45"'); }
      if (capped) o += poly([[apex[0] - w * 0.06, base - h * 0.88], apex, [apex[0] + w * 0.045, base - h * 0.88]], '#fbe8c4');
      return o;
    };
    s += pyramid(150, 690, 260, 170) + pyramid(390, 690, 340, 240, true) + pyramid(640, 690, 220, 150);
    for (let k = 0; k < 3; k++) s += pyramid(560 + k * 46, 694, 40, 26);
    // camels crossing the dunes
    const camel = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})" fill="#5a3a22"><path d="M-22 -18 Q-20 -30 -10 -28 Q-4 -40 4 -28 Q12 -34 16 -24 L22 -30 Q26 -38 32 -34 L34 -28 Q30 -24 28 -20 L24 -14 Q20 -10 14 -12 L-16 -12 Q-24 -12 -22 -18 Z"/><rect x="-16" y="-14" width="3" height="16"/><rect x="-10" y="-14" width="3" height="16"/><rect x="10" y="-14" width="3" height="16"/><rect x="16" y="-14" width="3" height="16"/><rect x="-6" y="-36" width="3" height="10"/><circle cx="-4.5" cy="-38" r="2.4"/></g>`;
    s += camel(330, 712, 0.75) + camel(372, 714, 0.75) + camel(414, 712, 0.75);
    // the Great Sphinx: the lion's body lying down, the head with its nemes headdress, weathered
    const sphinx = (x, base, sc) => `<g transform="translate(${x} ${base}) scale(${sc})"><path d="M-140 0 V-22 Q-136 -40 -110 -42 L20 -44 Q40 -46 46 -60 L48 -96 Q54 -112 74 -112 Q94 -112 98 -96 L100 -60 Q104 -44 120 -40 L140 -36 V0 Z" fill="#d8a964"/><path d="M48 -96 Q54 -112 74 -112 Q94 -112 98 -96 L104 -60 L92 -54 L92 -86 Q74 -92 56 -86 L56 -54 L44 -60 Z" fill="#c4914e"/><path d="M58 -84 Q74 -90 90 -84 L90 -56 Q74 -48 58 -56 Z" fill="#e2b876"/><ellipse cx="66" cy="-75" rx="5" ry="2.6" fill="#7a5028"/><ellipse cx="83" cy="-75" rx="5" ry="2.6" fill="#7a5028"/><path d="M74 -72 l-3 10 h6 Z" fill="#a87a42"/><path d="M68 -60 q6 3 12 0" stroke="#7a5028" stroke-width="1.6" fill="none"/><path d="M-140 0 V-22 Q-136 -40 -110 -42 L-100 -42 L-100 0 Z" fill="#b98448"/><path d="M110 -8 h40 v8 h-40 Z M108 -16 h36" fill="#c4914e"/>${[...Array(6)].map((_, k) => `<path d="M${-120 + k * 30} -38 q8 10 0 30" stroke="#a87a42" stroke-width="1.4" fill="none" opacity="0.6"/>`).join('')}</g>`;
    s += `<path d="${ridge(smooth([[0, 760], [200, 730], [420, 742], [640, 728], [860, 746], [1000, 734]], 10), 800)}" fill="${u('sand')}"/>`;
    s += sphinx(200, 770, 0.95);

    // the Citadel and the Muhammad Ali Mosque: the great grey dome among half-domes, two slender pencil minarets
    const mosque = (cx, base) => {
      let o = rect(cx - 150, base - 30, 300, 30, '#b89a72') + crenel(cx - 150, cx + 150, base - 30, 6, '#a8875e', 10);
      o += rect(cx - 110, base - 110, 220, 82, u('alab'));
      for (let k = 0; k < 8; k++) o += `<path d="M${cx - 100 + k * 26} ${base - 40} v-30 a7 7 0 0 1 14 0 v30 Z" fill="#6e5a44"/>`;
      const dome = (x, y, rw, hh, fill) => `<path d="M${f(x - rw)} ${f(y)} C${f(x - rw)} ${f(y - hh * 1.2)} ${f(x + rw)} ${f(y - hh * 1.2)} ${f(x + rw)} ${f(y)} Z" fill="${fill}"/>`;
      for (const dx of [-80, -40, 40, 80]) o += dome(cx + dx, base - 110, 22, 22, u('domeG')) + line(cx + dx, base - 136, cx + dx, base - 144, '#c9a24a', 1.4);
      o += rect(cx - 52, base - 150, 104, 40, u('alab')) + dome(cx, base - 150, 60, 62, u('domeG'));
      for (let k = 0; k < 8; k++) o += rect(cx - 46 + k * 12, base - 146, 5, 16, '#6e5a44');
      o += rect(cx - 6, base - 232, 12, 12, '#d8c3a2') + line(cx, base - 232, cx, base - 252, '#c9a24a', 2) + `<path d="M${cx - 5} ${base - 250} a6 6 0 1 0 10 -4 a5 5 0 1 1 -10 4 Z" fill="#c9a24a"/>`;
      for (const mx of [cx - 140, cx + 140]) {
        o += rect(mx - 7, base - 300, 14, 270, u('alab')) + rect(mx - 10, base - 210, 20, 6, '#cbb08a') + rect(mx - 10, base - 268, 20, 6, '#cbb08a');
        o += poly([[mx - 8, base - 300], [mx, base - 346], [mx + 8, base - 300]], u('domeG')) + line(mx, base - 346, mx, base - 356, '#c9a24a', 1.4);
      }
      return o;
    };
    s += mosque(700, 760);
    // the Cairo Tower: a tall cylinder in a lattice of concrete, like a lotus stem, the flower at the top
    const ctower = (cx, base, h) => {
      const w = h * 0.075;
      let o = rect(cx - w * 1.6, base - 30, w * 3.2, 30, '#8a6e52');
      o += `<path d="M${f(cx - w * 0.75)} ${base - 30} L${f(cx - w * 0.5)} ${f(base - h * 0.86)} L${f(cx + w * 0.5)} ${f(base - h * 0.86)} L${f(cx + w * 0.75)} ${base - 30} Z" fill="${u('tower')}"/>`;
      o += `<path d="M${f(cx - w * 0.75)} ${base - 30} L${f(cx - w * 0.5)} ${f(base - h * 0.86)} L${f(cx + w * 0.5)} ${f(base - h * 0.86)} L${f(cx + w * 0.75)} ${base - 30} Z" fill="url(#${K}-lat)" opacity="0.65"/>`;
      o += `<path d="M${f(cx - w * 0.5)} ${f(base - h * 0.86)} Q${f(cx - w * 0.9)} ${f(base - h * 0.93)} ${f(cx - w * 0.7)} ${f(base - h * 0.95)} L${f(cx + w * 0.7)} ${f(base - h * 0.95)} Q${f(cx + w * 0.9)} ${f(base - h * 0.93)} ${f(cx + w * 0.5)} ${f(base - h * 0.86)} Z" fill="#c9a77a"/>`;
      o += rect(cx - w * 0.62, base - h * 0.98, w * 1.24, h * 0.03, '#a8875e') + windows(cx - w * 0.6, base - h * 0.975, w * 1.2, h * 0.02, 6, 1, '#ffe7a8', 0.6, 0.7);
      o += rect(cx - w * 0.2, base - h * 1.02, w * 0.4, h * 0.04, '#b8915e') + line(cx, base - h * 1.02, cx, base - h * 1.1, '#6e5233', 2);
      return o;
    };
    s += ctower(930, 790, 440);

    // the Nile with feluccas and their white lateen sails, palms on the bank
    s += rect(0, 790, 1000, 210, u('nile'));
    s += glitter(r, 0, 1000, 794, 1000, '#ffe0a0', 120, 760, 300);
    s += palm(470, 800, 130, 12, '#6e4a2a', '#2f5a2a', '#4f7d3a') + palm(530, 804, 110, -8, '#6e4a2a', '#2f5a2a', '#4f7d3a') + palm(860, 806, 120, -14, '#6e4a2a', '#2f5a2a', '#4f7d3a');
    const felucca = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-46 0 Q0 10 50 -2 L44 -10 L-40 -10 Z" fill="#6e3e22"/><rect x="-40" y="-12" width="84" height="3" fill="#c98a3a"/><path d="M-2 -10 L-6 -96" stroke="#3a2414" stroke-width="2.4"/><path d="M-34 -4 L18 -118 Q30 -60 4 -12 Z" fill="#fbf6ea"/><path d="M-34 -4 L18 -118" stroke="#6e4a2a" stroke-width="2"/><path d="M18 -118 Q30 -60 4 -12" stroke="#d9cfb8" stroke-width="1.4" fill="none"/>${ell(0, 4, 54, 4, '#123a5a', 'opacity="0.45"')}</g>`;
    s += felucca(420, 900, 0.9) + felucca(600, 930, 1.05);
    return `<defs>${d}</defs>${s}`;
  }


  /* ---------------- Sydney: the Opera House's white sails, the steel arch of the Harbour Bridge with its granite pylons, the
     golden turret of Sydney Tower over the city, a green-and-gold ferry, yachts, and Bondi's ocean pool; a clear afternoon ---------------- */
  function sydney() {
    const K = 'bzAsydney', r = seeded(1973), id = n => `${K}-${n}`, u = n => `url(#${K}-${n})`;
    let d = lg(id('sky'), [[0, '#1f6fd1'], [0.45, '#6fb2ee'], [0.68, '#d6ecfb']])
      + lg(id('harbour'), [[0, '#2b86c4'], [0.5, '#1567a6'], [1, '#0b3f73']])
      + lg(id('shell'), [[0, '#ffffff'], [0.6, '#eef0ec'], [1, '#c9cbc2']], 0, 0, 1, 0)
      + lg(id('shellS'), [[0, '#d9dbd2'], [1, '#a8aa9f']], 0, 0, 1, 0)
      + lg(id('podium'), [[0, '#e6c79a'], [1, '#b8915e']])
      + lg(id('steel'), [[0, '#8f9aa6'], [1, '#4f5a66']])
      + lg(id('granite'), [[0, '#e8d6b8'], [1, '#a68e6c']], 0, 0, 1, 0)
      + lg(id('gold'), [[0, '#fff0b0'], [0.5, '#e0b54a'], [1, '#9a7420']], 0, 0, 1, 0)
      + lg(id('pool'), [[0, '#5fd6e6'], [1, '#1aa0c8']])
      + blur(id('b3'), 3)
      + winPatterns(K, '#dbe9f6', '#7f9ab8', [[4, 6], [5, 6], [3, 5]]);
    let s = rect(0, 0, 1000, 1000, u('sky'));
    s += cloud(240, 250, 1.5, '#ffffff', '#cfe0f0', id('b3')) + cloud(700, 210, 1.1, '#ffffff', '#cfe0f0', id('b3')) + cloud(860, 420, 0.8, '#ffffff', '#d6e5f2', id('b3'));
    // the city: towers, and Sydney Tower with its golden turret
    for (let x = 160; x < 1000;) { const w = 22 + r() * 34, h = 60 + r() * 150; s += rect(x, 650 - h, w, h, ['#9db4cc', '#b7c7d8', '#8aa3bd'][Math.floor(r() * 3)]) + rect(x + 2, 654 - h, w - 4, h - 6, `url(#${K}-win${Math.floor(r() * 3)})`, 'opacity="0.7"'); x += w + 2; }
    const stower = (cx, base, h) => `${rect(cx - 3, base - h * 0.8, 6, h * 0.8, '#c9ccd0')}${[...Array(10)].map((_, k) => line(cx - 9, base - k * h * 0.08, cx, base - h * 0.8, '#9aa0a8', 0.6)).join('')}<path d="M${cx - 16} ${base - h * 0.8} Q${cx - 20} ${base - h * 0.86} ${cx - 16} ${base - h * 0.92} L${cx + 16} ${base - h * 0.92} Q${cx + 20} ${base - h * 0.86} ${cx + 16} ${base - h * 0.8} Z" fill="${u('gold')}"/>${[...Array(5)].map((_, k) => line(cx - 18, base - h * (0.81 + k * 0.022), cx + 18, base - h * (0.81 + k * 0.022), '#7a5a18', 0.8)).join('')}${rect(cx - 10, base - h * 0.95, 20, h * 0.03, '#d9c27a')}${line(cx, base - h * 0.95, cx, base - h * 1.06, '#c9ccd0', 2)}`;
    s += stower(560, 650, 380);

    // the Harbour Bridge: the steel arch (top and bottom chords with the truss between), the deck hung beneath, granite pylons
    const bridge = (x0, x1, deck, rise) => {
      const mid = (x0 + x1) / 2, half = (x1 - x0) / 2, top = x => deck + 20 - rise * (1 - Math.pow((x - mid) / half, 2)), bot = x => deck + 30 - (rise - 40) * (1 - Math.pow((x - mid) / half, 2));
      let o = '';
      const T = [], B = []; for (let k = 0; k <= 40; k++) { const x = x0 + (x1 - x0) * k / 40; T.push([x, top(x)]); B.push([x, bot(x)]); }
      o += `<path d="M${pts(T)} L${pts(B.slice().reverse())} Z" fill="${u('steel')}" opacity="0.35"/>`;
      for (let k = 0; k < 40; k++) { const xa = x0 + (x1 - x0) * k / 40, xb = x0 + (x1 - x0) * (k + 1) / 40; o += line(xa, top(xa), xb, bot(xb), '#56616d', 1.2) + line(xa, top(xa), xa, bot(xa), '#56616d', 1.2); }
      o += `<path d="M${pts(T)}" stroke="#4f5a66" stroke-width="4" fill="none"/><path d="M${pts(B)}" stroke="#4f5a66" stroke-width="3.4" fill="none"/>`;
      for (let k = 2; k < 39; k++) { const x = x0 + (x1 - x0) * k / 40; if (bot(x) < deck) o += line(x, bot(x), x, deck, '#5d6874', 1.4); }
      o += rect(x0 - 160, deck, x1 - x0 + 330, 10, '#4f5a66') + rect(x0 - 160, deck + 10, x1 - x0 + 330, 4, '#3a434d') + line(x0 - 160, deck + 2, x1 + 170, deck + 2, '#9aa6b2', 1.2);
      for (let k = 0; k < 8; k++) o += rect(x0 - 150 + k * 22, deck + 14, 6, 60, '#7f8a96');
      for (const px of [x0 - 34, x0 - 2, x1 + 2, x1 + 34]) { o += rect(px - 16, deck - 92, 32, 182, u('granite')) + rect(px - 18, deck - 96, 36, 8, '#f0e2c8') + rect(px - 10, deck - 70, 20, 30, '#6f5a42', 'opacity="0.5"'); for (let j = 0; j < 12; j++) o += line(px - 16, deck - 80 + j * 14, px + 16, deck - 80 + j * 14, '#9a8264', 0.6, 'opacity="0.5"'); }
      o += line(mid, top(mid), mid, top(mid) - 18, '#4f5a66', 1.4) + `<path d="M${mid} ${top(mid) - 18} h12 v8 h-12 Z" fill="#012169"/>`;
      return o;
    };
    s += bridge(560, 960, 640, 170);

    // the harbour, and the Opera House on Bennelong Point: a granite podium, sail-shells of white tiles, glass walls, steps
    s += rect(0, 650, 1000, 350, u('harbour'));
    s += glitter(r, 0, 1000, 654, 1000, '#ffffff', 140);
    const opera = (x, base) => {
      // the podium of Sydney granite, the broad steps at its landward end
      let o = rect(x - 30, base - 46, 520, 50, u('podium')) + rect(x - 30, base - 46, 520, 4, '#f4e2c0');
      for (let k = 0; k < 9; k++) o += rect(x - 70 + k * 4.4, base - 46 + k * 5.5, 44 - k * 4.4, 5.5, k % 2 ? '#d9b98a' : '#c9a87a');
      for (let k = 0; k < 14; k++) o += rect(x - 20 + k * 36, base - 30, 20, 12, '#7a6a52', 'opacity="0.45"');
      // one shell (a slice of a sphere): the smooth tiled back rising to a sharp tip, a concave front edge, bronze glass in its mouth
      const shell = (sx, sy, w, h, lean = 0) => {
        const tip = [sx + w * 0.72 + lean, sy - h];
        let g = `<path d="M${f(sx)} ${f(sy)} C${f(sx + w * 0.1)} ${f(sy - h * 0.7)} ${f(sx + w * 0.4)} ${f(sy - h * 0.98)} ${f(tip[0])} ${f(tip[1])} C${f(sx + w * 0.8)} ${f(sy - h * 0.6)} ${f(sx + w * 0.9)} ${f(sy - h * 0.25)} ${f(sx + w)} ${f(sy)} Z" fill="${u('shell')}"/>`;
        g += `<path d="M${f(tip[0])} ${f(tip[1])} C${f(sx + w * 0.8)} ${f(sy - h * 0.6)} ${f(sx + w * 0.9)} ${f(sy - h * 0.25)} ${f(sx + w)} ${f(sy)} L${f(sx + w * 0.8)} ${f(sy)} C${f(sx + w * 0.74)} ${f(sy - h * 0.3)} ${f(sx + w * 0.72)} ${f(sy - h * 0.6)} ${f(tip[0])} ${f(tip[1])} Z" fill="${u('shellS')}"/>`;
        g += `<path d="M${f(sx + w * 0.8)} ${f(sy)} C${f(sx + w * 0.82)} ${f(sy - h * 0.2)} ${f(sx + w * 0.86)} ${f(sy - h * 0.3)} ${f(sx + w * 0.9)} ${f(sy - h * 0.34)} C${f(sx + w * 0.95)} ${f(sy - h * 0.2)} ${f(sx + w * 0.98)} ${f(sy - h * 0.1)} ${f(sx + w)} ${f(sy)} Z" fill="#a8916a" opacity="0.8"/>`;
        for (let k = 1; k < 4; k++) g += line(sx + w * (0.8 + k * 0.05), sy, sx + w * (0.8 + k * 0.05), sy - h * (0.3 - k * 0.04), '#e9dcc0', 0.8);
        for (let k = 1; k < 7; k++) { const t = k / 7; g += `<path d="M${f(sx + w * 0.8 * t)} ${f(sy)} C${f(sx + w * (0.1 + 0.6 * t))} ${f(sy - h * 0.6)} ${f(sx + w * (0.4 + 0.3 * t))} ${f(sy - h * 0.92)} ${f(tip[0])} ${f(tip[1])}" stroke="#d3d5cb" stroke-width="0.8" fill="none"/>`; }
        return g;
      };
      const sy = base - 46;
      // the Concert Hall's shells, back to front, then the Joan Sutherland Theatre's, then the little restaurant's
      o += shell(x + 290, sy, 120, 74, 8) + shell(x + 230, sy, 150, 128, 6) + shell(x + 172, sy, 150, 176, 2) + shell(x + 118, sy, 130, 118, -4);
      o += shell(x + 60, sy, 110, 112, 4) + shell(x + 18, sy, 112, 150, 0) + shell(x - 12, sy, 92, 92, -4);
      o += shell(x + 420, sy, 60, 46) + shell(x + 396, sy, 54, 34);
      return o;
    };
    s += opera(120, 720);
    // a green-and-gold ferry, yachts with white sails
    const ferry = (x, y) => `<g>${poly([[x - 70, y], [x + 70, y], [x + 80, y - 12], [x - 80, y - 12]], '#1f6a3a')}${rect(x - 60, y - 30, 120, 18, '#f2e2a8')}${windows(x - 58, y - 28, 116, 12, 14, 1, '#3a4a5a', 0.65, 0.7)}${rect(x - 40, y - 42, 80, 12, '#f2e2a8')}${rect(x - 64, y - 33, 128, 3, '#1f6a3a')}${rect(x - 6, y - 52, 12, 10, '#1f6a3a')}${ell(x, y + 4, 90, 5, '#ffffff', 'opacity="0.6"')}</g>`;
    s += ferry(700, 800);
    for (let k = 0; k < 7; k++) { const bx = 380 + r() * 560, by = 740 + r() * 40; s += poly([[bx, by], [bx + 1, by - 26], [bx + 14, by]], '#fff') + poly([[bx - 1, by - 3], [bx - 1, by - 18], [bx - 10, by - 3]], '#f1f1f1') + rect(bx - 8, by, 26, 3, '#ffffff'); }
    // Bondi's ocean pool: lanes in turquoise, the rock shelf, the surf breaking white over its wall
    s += `<path d="M300 1000 L320 870 L690 870 L710 1000 Z" fill="#b8a48a"/>` + `<path d="M330 990 L344 884 L666 884 L680 990 Z" fill="${u('pool')}"/>`;
    for (let k = 1; k < 8; k++) s += line(344 + (330 - 344) * 0 + k * 40 - 2, 886, 330 + k * 43.8, 988, '#ffffff', 1.4, 'stroke-dasharray="6 5" opacity="0.8"');
    for (let k = 0; k < 18; k++) s += ell(316 + k * 22, 872 + r() * 4, 14 + r() * 10, 5 + r() * 3, '#ffffff', 'opacity="0.85"');
    for (let k = 0; k < 5; k++) { const sx = 360 + r() * 280, sy = 900 + r() * 70; s += circ(sx, sy, 3, '#f0c8a0') + line(sx - 6, sy + 2, sx + 6, sy + 2, '#ffffff', 1.4, 'opacity="0.7"'); }
    return `<defs>${d}</defs>${s}`;
  }

  const ART = { paris, newyork, mumbai, rio, zurich, tokyo, dublin, greece, cairo, sydney };
  const api = { draw: key => (ART[key] ? ART[key]() : '') };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.BUSINESS_ART = api;
})();
