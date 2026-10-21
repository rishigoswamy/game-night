// Casino crowd sounds, synthesized with Web Audio (no sound files). Shared by the master table and the phones.
// Each build*(audioContext, destination, startTime, seconds) schedules a sound and returns { master, nodes }.

// A room for the crowd to be in: generated reverb (decaying stereo noise)
function roomVerb(ac, seconds = 2.4) {
  const len = Math.ceil(ac.sampleRate * seconds), ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3.2);
  }
  const c = ac.createConvolver(); c.buffer = ir;
  return c;
}
// Soft, voice-like tone: harmonics fall away faster than a sawtooth's, so it sounds human rather than buzzy
function voiceWave(ac) {
  const N = 28, re = new Float32Array(N), im = new Float32Array(N);
  for (let h = 1; h < N; h++) im[h] = (h === 2 ? 1.25 : 1) / Math.pow(h, 1.55);
  return ac.createPeriodicWave(re, im);
}
const pan = (ac, v) => { if (!ac.createStereoPanner) return ac.createGain(); const p = ac.createStereoPanner(); p.pan.value = v; return p; };

// The table's long, disappointed groan: a sharp "oh!" that opens into a long, falling "awwww"
function buildGroan(ac, out, t0, dur = 4.8) {
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.85, t0 + 0.16);           // "oh!"
  master.gain.exponentialRampToValueAtTime(0.6, t0 + 0.42);
  master.gain.exponentialRampToValueAtTime(1, t0 + 0.95);              // swells into "awww"
  master.gain.setValueAtTime(1, t0 + dur * 0.45);
  master.gain.linearRampToValueAtTime(0.45, t0 + dur * 0.78);          // a long, audible trail off…
  master.gain.exponentialRampToValueAtTime(0.001, t0 + dur);           // …to silence
  const comp = ac.createDynamicsCompressor();
  const dry = ac.createGain(); dry.gain.value = .85;
  const wet = ac.createGain(); wet.gain.value = .5;
  master.connect(dry).connect(comp);
  master.connect(roomVerb(ac)).connect(wet).connect(comp);
  comp.connect(out);

  // Vowel "oh" → "aw" → darkening "uh", through three formant bands
  const voices = ac.createGain();
  const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3600;
  tone.connect(master);
  const OH = [450, 800, 2600], AW = [690, 1060, 2650], UH = [560, 980, 2450];
  [[5, 1], [7, .8], [10, .22]].forEach(([q, level], i) => {
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(OH[i], t0);
    bp.frequency.linearRampToValueAtTime(AW[i], t0 + .75);
    bp.frequency.linearRampToValueAtTime(UH[i], t0 + dur);
    const g = ac.createGain(); g.gain.value = level;
    voices.connect(bp).connect(g).connect(tone);
  });
  const wave = voiceWave(ac), nodes = [];
  // 26 people: lower and higher voices, spread across the room, each starting and fading a little differently
  for (let k = 0; k < 26; k++) {
    const low = k % 2 === 0, base = low ? 95 + Math.random() * 70 : 175 + Math.random() * 125;
    const start = t0 + Math.random() * .35, end = t0 + dur * (.82 + Math.random() * .18);
    const o = ac.createOscillator(); o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(base * .97, start);
    o.frequency.exponentialRampToValueAtTime(base * 1.13, start + .22);          // "oh!"
    o.frequency.exponentialRampToValueAtTime(base * 1.03, t0 + .95);
    o.frequency.exponentialRampToValueAtTime(base * (.58 + Math.random() * .1), end);  // the long fall
    const lfo = ac.createOscillator(); lfo.frequency.value = 4.5 + Math.random() * 1.5;
    const depth = ac.createGain();                                                // vibrato creeps in late, like a sigh
    depth.gain.setValueAtTime(0, start); depth.gain.linearRampToValueAtTime(base * .03, t0 + 1.6);
    lfo.connect(depth).connect(o.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(.2, start + .14);
    g.gain.setValueAtTime(.2, end - .9);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(pan(ac, Math.random() * 1.6 - .8)).connect(voices);
    o.start(start); lfo.start(start); o.stop(end + .05); lfo.stop(end + .05);
    nodes.push(o, lfo);
  }
  // Breath through the same vowel, so it's airy rather than a pure tone
  const len = Math.ceil(ac.sampleRate * (dur + .1)), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
  const breath = ac.createBufferSource(); breath.buffer = buf;
  const bg = ac.createGain(); bg.gain.value = .1;
  breath.connect(bg).connect(voices);
  breath.start(t0); breath.stop(t0 + dur + .1);
  nodes.push(breath);
  return { master, nodes };
}

// ---- shared crowd pieces ----
// A finger whistle ("wheeeet", held with a trill) or a wolf whistle ("whee-whew")
function whistle(ac, out, start, kind = 'finger', level = .16) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine';
  const f = o.frequency;
  let end;
  if (kind === 'wolf') {
    end = start + 1.15;
    f.setValueAtTime(1250, start); f.exponentialRampToValueAtTime(2900, start + .28);
    f.setValueAtTime(1450, start + .44); f.exponentialRampToValueAtTime(2750, start + .66); f.exponentialRampToValueAtTime(1050, end);
  } else {
    const hold = 1.1 + Math.random() * .8;
    end = start + hold;
    f.setValueAtTime(2100, start); f.exponentialRampToValueAtTime(3150, start + .14);
    f.setValueAtTime(3150, start + hold * .7); f.exponentialRampToValueAtTime(2500, end);
    const tr = ac.createOscillator(), td = ac.createGain();                 // the trill
    tr.frequency.value = 7 + Math.random() * 3; td.gain.value = 55;
    tr.connect(td).connect(f); tr.start(start); tr.stop(end + .05);
  }
  o.connect(g);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(level, start + .05);
  g.gain.setValueAtTime(level, end - .2);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(pan(ac, Math.random() * 1.4 - .7)).connect(out);
  o.start(start); o.stop(end + .05);
  return [o];
}
// Money sounds. A bell-like "ching": slightly inharmonic partials with a long ring
function bell(ac, out, t, f, level, decay = 1.3) {
  const nodes = [];
  [[1, 1], [2, .45], [2.76, .32], [3.52, .18], [5.4, .1]].forEach(([ratio, amp]) => {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * ratio;
    const g = ac.createGain(), end = t + decay / Math.pow(ratio, .35);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level * amp, t + .004); g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(out); o.start(t); o.stop(end + .05);
    nodes.push(o);
  });
  return nodes;
}
// Cash register "ka-ching!": key clunk + drawer rattle ("ka-"), then two bright bells ("-ching!")
function cashRegister(ac, out, t, level = .5) {
  const sr = ac.sampleRate, len = Math.ceil(sr * .3), buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) {
    const tt = k / sr;
    let v = tt < .05 ? (Math.random() * 2 - 1) * Math.exp(-tt / .012) : 0;                                   // clunk
    if (tt > .04 && tt < .22) v += (Math.random() * 2 - 1) * .35 * (Math.sin(tt * 2 * Math.PI * 38) > .6 ? 1 : .15) * Math.exp(-(tt - .04) / .08);   // drawer rattle
    d[k] = v;
  }
  const src = ac.createBufferSource(); src.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
  const g = ac.createGain(); g.gain.value = level * .9;
  src.connect(lp).connect(g).connect(out); src.start(t); src.stop(t + .32);
  return [src, ...bell(ac, out, t + .11, 2349, level * .42, 1.5), ...bell(ac, out, t + .13, 3520, level * .26, 1.2)];
}
// A shower of coins: many quick metallic clinks (rendered into one buffer so it stays light)
function coinShower(ac, out, t0, dur, perSec = 16, level = .4) {
  const sr = ac.sampleRate, len = Math.ceil(sr * (dur + .6)), buf = ac.createBuffer(2, len, sr);
  const L = buf.getChannelData(0), R = buf.getChannelData(1), TAU = Math.PI * 2;
  const count = Math.floor(perSec * dur);
  for (let c = 0; c < count; c++) {
    const at = Math.floor(Math.pow(Math.random(), 1.25) * dur * sr);       // denser at the start, like a payout pouring out
    const f = 2500 + Math.random() * 2900, dec = .05 + Math.random() * .14, amp = .25 + Math.random() * .75;
    const p = Math.random(), gl = Math.cos(p * Math.PI / 2), gr = Math.sin(p * Math.PI / 2);
    const n = Math.min(len - at, Math.floor(dec * sr * 3.5));
    for (let k = 0; k < n; k++) {
      const env = Math.exp(-k / (dec * sr)), ph = TAU * f * k / sr;
      let v = Math.sin(ph) + .6 * Math.sin(ph * 1.48) + .4 * Math.sin(ph * 2.09) + .25 * Math.sin(ph * 2.61);
      if (k < 60) v += (Math.random() * 2 - 1) * 1.5 * (1 - k / 60);       // the tap of coin on coin
      v *= env * amp * .25;
      L[at + k] += v * gl; R[at + k] += v * gr;
    }
  }
  const src = ac.createBufferSource(); src.buffer = buf;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
  const g = ac.createGain();
  g.gain.setValueAtTime(level, t0); g.gain.setValueAtTime(level, t0 + dur * .6); g.gain.linearRampToValueAtTime(0.0001, t0 + dur + .5);
  src.connect(hp).connect(g).connect(out); src.start(t0); src.stop(t0 + dur + .6);
  return [src];
}
// A crowd of voices through a vowel. contour(freqParam, base, start, end) shapes each voice's pitch.
function crowdVoices(ac, out, t0, { count, dur, vowels, contour, level = .18, onset = .3 }) {
  const voices = ac.createGain();
  const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 4200;
  tone.connect(out);
  [[5, 1], [7, .85], [10, .3]].forEach(([q, lv], i) => {
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    vowels.forEach(([at, fs], k) => k === 0 ? bp.frequency.setValueAtTime(fs[i], t0 + at) : bp.frequency.linearRampToValueAtTime(fs[i], t0 + at));
    const g = ac.createGain(); g.gain.value = lv;
    voices.connect(bp).connect(g).connect(tone);
  });
  const wave = voiceWave(ac), nodes = [];
  for (let k = 0; k < count; k++) {
    const low = k % 2 === 0, base = low ? 110 + Math.random() * 80 : 200 + Math.random() * 140;
    const start = t0 + Math.random() * onset, end = t0 + dur * (.85 + Math.random() * .15);
    const o = ac.createOscillator(); o.setPeriodicWave(wave);
    contour(o.frequency, base, start, end);
    const lfo = ac.createOscillator(); lfo.frequency.value = 5 + Math.random() * 2.5;
    const depth = ac.createGain(); depth.gain.setValueAtTime(base * .01, start); depth.gain.linearRampToValueAtTime(base * .04, start + 1);
    lfo.connect(depth).connect(o.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(level, start + .1);
    g.gain.setValueAtTime(level, end - 1); g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(pan(ac, Math.random() * 1.6 - .8)).connect(voices);
    o.start(start); lfo.start(start); o.stop(end + .05); lfo.stop(end + .05);
    nodes.push(o, lfo);
  }
  return nodes;
}
// Shared output stage: envelope → dry + room reverb → compressor
function crowdBus(ac, out, t0, dur, shape) {
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  shape(master.gain);
  master.gain.setValueAtTime(1, t0 + dur * .58);
  master.gain.linearRampToValueAtTime(.45, t0 + dur * .85);
  master.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  const comp = ac.createDynamicsCompressor();
  const dry = ac.createGain(); dry.gain.value = .85;
  const wet = ac.createGain(); wet.gain.value = .45;
  master.connect(dry).connect(comp);
  master.connect(roomVerb(ac, 2.6)).connect(wet).connect(comp);
  comp.connect(out);
  return master;
}

// Crowd "roar": breathy noise shaped into a vowel, the body of a cheering room
function crowdRoar(ac, out, t0, dur, vowel, level = .3) {
  const len = Math.ceil(ac.sampleRate * (dur + .1)), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1; }
  const src = ac.createBufferSource(); src.buffer = buf;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(level, t0 + .15);
  g.gain.setValueAtTime(level, t0 + dur * .55); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  vowel.forEach(([f, q, lv]) => {
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const lg = ac.createGain(); lg.gain.value = lv;
    src.connect(bp).connect(lg).connect(g);
  });
  g.connect(out);
  src.start(t0); src.stop(t0 + dur + .1);
  return [src];
}

// Hot number: a big celebration (~6 s; with the dealer's call it matches a 0/00): an instant "YEAH!" roar, a second wave of "WOOO!",
// single shouts popping out, whistles, a cash-register "ka-ching!" and jingling coins
function buildCheer(ac, out, t0, dur = 6) {
  const master = crowdBus(ac, out, t0, dur, g => g.exponentialRampToValueAtTime(1, t0 + .12));
  const nodes = [];
  // The whole table: "yeah!" that swells again when the second wave hits
  nodes.push(...crowdVoices(ac, master, t0, {
    count: 26, dur, level: .14, onset: .2,
    vowels: [[0, [600, 1900, 2700]], [.5, [760, 1720, 2600]], [2.4, [740, 1650, 2550]], [dur, [680, 1500, 2450]]],
    contour: (f, b, s, e) => {
      f.setValueAtTime(b * .9, s); f.exponentialRampToValueAtTime(b * 1.42, s + .3);
      f.exponentialRampToValueAtTime(b * 1.28, s + 1.7);
      f.exponentialRampToValueAtTime(b * 1.46, t0 + 2.3);       // second swell
      f.exponentialRampToValueAtTime(b * 1.3, t0 + 4);
      f.exponentialRampToValueAtTime(b * 1.1, e);
    },
  }));
  // Second wave joins: "WOOO!"
  nodes.push(...crowdVoices(ac, master, t0 + 1.9, {
    count: 16, dur: dur - 2.4, level: .12, onset: .25,
    vowels: [[0, [360, 850, 2400]], [.7, [560, 1150, 2450]], [dur - 2.4, [520, 1100, 2400]]],
    contour: (f, b, s, e) => { f.setValueAtTime(b * 1.15, s); f.exponentialRampToValueAtTime(b * 1.75, s + .45); f.exponentialRampToValueAtTime(b * 1.3, e); },
  }));
  // Single shouts popping out of the crowd
  for (let k = 0; k < 10; k++) {
    const at = .4 + Math.random() * 3.8, len = .6 + Math.random() * .5;
    nodes.push(...crowdVoices(ac, master, t0 + at, {
      count: 1, dur: len, level: .3, onset: 0,
      vowels: k % 2 ? [[0, [380, 900, 2400]], [len, [620, 1200, 2500]]] : [[0, [620, 1900, 2700]], [len, [760, 1700, 2600]]],   // "woo!" / "yeah!"
      contour: (f, b, s, e) => { f.setValueAtTime(b * 1.3, s); f.exponentialRampToValueAtTime(b * 1.9, s + .18); f.exponentialRampToValueAtTime(b * 1.25, e); },
    }));
  }
  // Breathy body of the room
  nodes.push(...crowdRoar(ac, master, t0, dur * .8, [[700, 3, 1], [1250, 4, .7], [2600, 6, .3]], .22));
  // Money: "ka-ching!" as it hits, then coins jingling under the cheering
  nodes.push(...cashRegister(ac, master, t0 + .02, .55));
  nodes.push(...coinShower(ac, master, t0 + .25, dur * .8, 14, .38));
  // Whistles all through
  [[.3, 'finger'], [1.0, 'wolf'], [1.7, 'finger'], [2.4, 'wolf'], [3.1, 'finger'], [3.8, 'wolf']]
    .forEach(([at, kind]) => nodes.push(...whistle(ac, master, t0 + at + Math.random() * .25, kind, .15)));
  return { master, nodes };
}

// Big win: a long "hoo-RAAAAAY!", then more of the table joins in, with whistles, ka-chings and a jackpot coin pour (~7 s)
function buildHurray(ac, out, t0, dur = 7) {
  const master = crowdBus(ac, out, t0, dur, g => {
    g.exponentialRampToValueAtTime(.55, t0 + .12);       // "hoo"
    g.exponentialRampToValueAtTime(.3, t0 + .42);
    g.exponentialRampToValueAtTime(1, t0 + .7);          // "RAAAY"
  });
  const nodes = crowdVoices(ac, master, t0, {
    count: 28, dur, level: .17, onset: .12,
    vowels: [[0, [320, 800, 2400]], [.4, [330, 820, 2400]], [.62, [660, 1850, 2650]], [dur, [600, 2050, 2800]]],   // "oo" → "ay"
    contour: (f, b, s, e) => {
      f.setValueAtTime(b * .82, s); f.setValueAtTime(b * .82, s + .3);           // hoo…
      f.exponentialRampToValueAtTime(b * 1.5, s + .62); f.exponentialRampToValueAtTime(b * 1.62, s + 1.4);   // …RAAAY, still rising
      f.exponentialRampToValueAtTime(b * 1.45, e);
    },
  });
  nodes.push(...crowdVoices(ac, master, t0 + 2.2, {                               // a second wave joins: "wooo!"
    count: 14, dur: dur - 2.2, level: .12,
    vowels: [[0, [380, 900, 2400]], [1, [600, 1300, 2500]], [dur - 2.2, [560, 1200, 2450]]],
    contour: (f, b, s, e) => { f.setValueAtTime(b * 1.2, s); f.exponentialRampToValueAtTime(b * 1.7, s + .5); f.exponentialRampToValueAtTime(b * 1.3, e); },
  }));
  nodes.push(...cashRegister(ac, master, t0 + .05, .6));               // ka-ching!
  nodes.push(...cashRegister(ac, master, t0 + .95, .5));               // ka-ching!
  nodes.push(...coinShower(ac, master, t0 + .3, dur * .85, 26, .45));  // the jackpot pouring out
  [[.5, 'finger'], [1.2, 'wolf'], [1.8, 'finger'], [2.6, 'finger'], [3.3, 'wolf'], [4.1, 'finger'], [4.9, 'wolf']]
    .forEach(([at, kind]) => nodes.push(...whistle(ac, master, t0 + at + Math.random() * .2, kind)));
  return { master, nodes };
}

// ---- Dice: a shake in the cup, then the dice clattering across the felt ----
function buildDice(ac, out, t0, dur = 1.4) {
  const master = ac.createGain(); master.gain.value = .55; master.connect(out);
  const nodes = [];
  const click = (t, level, freq) => {                 // one die knocking: a short, bright noise tick through a band-pass
    const len = Math.floor(ac.sampleRate * .035), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    const src = ac.createBufferSource(); src.buffer = buf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
    const g = ac.createGain(); g.gain.value = level;
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t);
    nodes.push(src);
  };
  const shake = dur * .45;
  for (let t = 0; t < shake; t += .045 + Math.random() * .03) click(t0 + t, .35 + Math.random() * .25, 1800 + Math.random() * 1200);
  let t = t0 + shake + .08, gap = .05, level = .9;     // the throw: hits that bounce, slow down and fade
  while (level > .08) { for (let k = 0; k < 3; k++) click(t + k * .012 * Math.random(), level * (.6 + Math.random() * .4), 2600 + Math.random() * 2400); t += gap; gap *= 1.28; level *= .72; }
  return { master, nodes };
}

// ---- A small sound player for pages without their own (the phone join page) ----
// enabled(): is sound switched on; returns { play(build, dur), stop(), hold(on) }. Unlocks audio on the first tap.
function createSfxPlayer(enabled) {
  let ac = null, playing = [];
  const get = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) { ac = new AC(); try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {} }
    if (ac.state !== 'running') ac.resume().catch(() => {});
    return ac;
  };
  const kinds = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
  const unlock = () => {
    const c = get(); if (!c) return;
    const blip = c.createBufferSource(); blip.buffer = c.createBuffer(1, 1, 22050); blip.connect(c.destination); blip.start(0);
    if (c.state === 'running') kinds.forEach(t => document.removeEventListener(t, unlock, true));
  };
  kinds.forEach(t => document.addEventListener(t, unlock, true));
  return {
    async play(build, dur) {
      if (!enabled()) return;
      const c = get(); if (!c) return;
      if (c.state !== 'running') { try { await c.resume(); } catch {} }
      playing = playing.filter(o => o.endAt > c.currentTime);
      playing.push({ ...build(c, c.destination, c.currentTime + .05, dur), endAt: c.currentTime + dur + 3 });
    },
    stop() { playing.forEach(o => { o.nodes.forEach(n => { try { n.stop(); } catch {} }); o.master.disconnect(); }); playing = []; },
    hold(on) { if (ac) on ? ac.suspend() : ac.resume(); },
    context: get,                                   // the (unlocked) audio context, for other clips such as the dealer's voice
  };
}
