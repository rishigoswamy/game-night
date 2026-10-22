// Mafia: the town against the family, night after night (rules: docs/2026-10-mafia.md). The Mac is the moderator and
// narrates; every player uses their own phone. 4–16 players.
window.PARTY_GAME = (() => {
  const esc = PartyKit.esc;
  // team: town / mafia / neutral; tier: 1 beginner, 2 intermediate, 3 advanced; act: what the night screen asks for;
  // weight: how much the role helps the town (+) or the mafia and neutrals (−), for the lobby's balance meter (our
  // own estimates, docs/2026-10-mafia.md)
  const ROLES = {
    villager: { name: 'Villager', icon: '🧑', team: 'town', tier: 1, weight: 1, act: 'hunch', text: 'No night power. Talk, listen and vote the mafia out.' },
    detective: { name: 'Detective', icon: '🔍', team: 'town', tier: 1, weight: 7, act: 'target', text: 'Each night, investigate a player: Suspicious or Not suspicious.' },
    doctor: { name: 'Doctor', icon: '🩺', team: 'town', tier: 1, weight: 5, act: 'target', text: 'Each night, protect a player from being killed.' },
    mafioso: { name: 'Mafioso', icon: '🕴️', team: 'mafia', tier: 1, weight: -6, act: 'kill', text: 'Each night, pick a victim with the family. Win when the mafia outnumber the rest.' },
    godfather: { name: 'Godfather', icon: '🎩', team: 'mafia', tier: 2, weight: -8, act: 'kill', text: 'Head of the family: you break the family\'s ties, and the Detective sees you as Not suspicious.' },
    consort: { name: 'Consort', icon: '💋', team: 'mafia', tier: 2, weight: -7, act: 'target', text: 'Each night, keep a player busy: their night action doesn\'t happen. You also vote on the kill.' },
    escort: { name: 'Escort', icon: '🍸', team: 'town', tier: 2, weight: 3, act: 'target', text: 'Each night, keep a player busy: their night action doesn\'t happen.' },
    bodyguard: { name: 'Bodyguard', icon: '🛡️', team: 'town', tier: 2, weight: 4, act: 'target', text: 'Each night, guard a player: if they are attacked, you die instead and take the attacker with you.' },
    vigilante: { name: 'Vigilante', icon: '🔫', team: 'town', tier: 2, weight: 4, act: 'target', text: 'A few bullets for the whole game (not on the first night). Shoot a player you think is guilty.' },
    mason: { name: 'Mason', icon: '🧱', team: 'town', tier: 2, weight: 2, act: 'hunch', text: 'Two Masons know each other from the start: two people the town can trust.' },
    mayor: { name: 'Mayor', icon: '🏛️', team: 'town', tier: 2, weight: 3, act: 'hunch', text: 'Once, by day, reveal yourself: from then on your votes count three times (but the Doctor can\'t protect you).' },
    lookout: { name: 'Lookout', icon: '👁️', team: 'town', tier: 2, weight: 4, act: 'target', text: 'Each night, watch a player\'s house and see who visits them.' },
    tracker: { name: 'Tracker', icon: '👣', team: 'town', tier: 2, weight: 4, act: 'target', text: 'Each night, follow a player and see whom they visit.' },
    medium: { name: 'Medium', icon: '🕯️', team: 'town', tier: 2, weight: 2, act: 'medium', text: 'Once a game, from the second night, learn the role of a player who has died.' },
    jester: { name: 'Jester', icon: '🃏', team: 'neutral', tier: 2, weight: -2, act: 'hunch', text: 'You win if the town votes you out at a trial. Act suspicious!' },
    survivor: { name: 'Survivor', icon: '🦺', team: 'neutral', tier: 2, weight: 0, act: 'vest', text: 'You win if you are alive at the end. A couple of bulletproof vests for the nights you need them.' },
    framer: { name: 'Framer', icon: '🖼️', team: 'mafia', tier: 3, weight: -7, act: 'target', text: 'Each night, frame a player: they look Suspicious to the Detective tonight. You also vote on the kill.' },
    janitor: { name: 'Janitor', icon: '🧹', team: 'mafia', tier: 3, weight: -7, act: 'clean', text: 'A few times a game, clean up after the family\'s kill: nobody learns the victim\'s role, except you.' },
    consigliere: { name: 'Consigliere', icon: '📒', team: 'mafia', tier: 3, weight: -8, act: 'target', text: 'Each night, learn a player\'s exact role. You also vote on the kill.' },
    veteran: { name: 'Veteran', icon: '🎖️', team: 'town', tier: 3, weight: 3, act: 'alert', text: 'A few nights a game, stay on alert: you can\'t be killed, and you shoot everyone who visits you.' },
    executioner: { name: 'Executioner', icon: '⚖️', team: 'neutral', tier: 3, weight: -2, act: 'hunch', text: 'You are given a target in the town. You win if the town votes them out at a trial.' },
    serialkiller: { name: 'Serial Killer', icon: '🔪', team: 'neutral', tier: 3, weight: -6, act: 'target', text: 'Each night, kill a player. You win if you outlast everyone. Whoever tries to block you dies instead.' },
  };
  const R = r => ROLES[r];
  const label = r => `${R(r).icon} ${R(r).name}`;
  const TIERS = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };
  const TEAM = { town: 'Town', mafia: 'Mafia', neutral: 'Neutral (on their own)' };
  // The optional roles, by kind, in the order they're given places (the most advanced are left out first)
  const MAFIA_SPECIAL = ['godfather', 'consort', 'framer', 'janitor', 'consigliere'];
  const TOWN_SPECIAL = ['detective', 'doctor', 'escort', 'bodyguard', 'vigilante', 'mason', 'mayor', 'lookout', 'tracker', 'medium', 'veteran'];
  const NEUTRAL = ['jester', 'survivor', 'executioner', 'serialkiller'];
  const PASSIVE = new Set(['survivor', 'jester', 'executioner']);   // neutrals who never kill: they don't stop a Serial Killer's win
  const TARGETS = new Set(['detective', 'doctor', 'escort', 'consort', 'bodyguard', 'vigilante', 'framer', 'consigliere', 'lookout', 'tracker', 'serialkiller']);
  const isMafia = r => R(r).team === 'mafia';

  // Full rules for the lobby's hover cards
  const DETAIL = {
    villager: { night: 'Pick a hunch (who you suspect). Private: it only shows in the end-of-game statistics.', does: 'Your power is your voice and your vote.' },
    detective: { night: 'Investigate one other player.', does: 'At dawn you learn whether they are 🔴 Suspicious or 🟢 Not suspicious.', notes: 'Suspicious: every mafia member except the Godfather, anyone framed by the Framer tonight, and the Serial Killer.' },
    doctor: { night: 'Protect one player.', does: 'If they are attacked tonight, they survive (every attack on them fails). You learn if your patient was attacked.', notes: 'Saving yourself and protecting the same player two nights running depend on the game setup. A revealed Mayor can\'t be protected.' },
    mafioso: { night: 'Vote on the family\'s victim with the other mafia; you see each other\'s picks live.', does: 'The family kills one player a night (how the vote is decided is a setup option). One of you carries out the hit.', win: 'When the mafia equal or outnumber everyone else (and the Serial Killer is dead).' },
    godfather: { night: 'Vote on the victim with the family.', does: 'Your pick breaks the family\'s ties (in "leader decides" mode, you choose alone).', win: 'With the mafia.', notes: 'The Detective sees you as 🟢 Not suspicious. If you die, the next mafia member takes over as leader.' },
    consort: { night: 'Pick a player to keep busy, and vote on the family\'s victim.', does: 'Their night action doesn\'t happen tonight (and they are told).', win: 'With the mafia.', notes: 'Blocking a Veteran on alert fails, and he shoots you. Blocking the Serial Killer fails, and you become his victim.' },
    escort: { night: 'Pick a player to keep busy.', does: 'Their night action doesn\'t happen tonight (and they are told). Block a mafia member and they can\'t carry out the hit.', notes: 'Blocking a Veteran on alert fails, and he shoots you. Blocking the Serial Killer fails, and you become his victim.' },
    bodyguard: { night: 'Guard another player.', does: 'The first attack on them tonight hits you instead: you die, and so does the attacker (a Doctor\'s protection can save either of you).', notes: 'A Veteran\'s shots can\'t be stopped by a Bodyguard.' },
    vigilante: { night: 'Shoot a player, or hold your fire.', does: 'Your shot is an attack (a Doctor or a vest can stop it). Bullets for the whole game: a setup option (2).', notes: 'No shooting on the first night. Guilt (setup option, on): if you kill a member of the town, you die of guilt the next night.' },
    mason: { night: 'Pick a hunch.', does: 'There are always two Masons, and they know each other from the start.', notes: 'Only in games of 7 or more players.' },
    mayor: { night: 'Pick a hunch.', does: 'Once, by day, tap "Reveal as Mayor": everyone learns you are the Mayor, and from then on your nominations and verdict votes count 3.', notes: 'Once revealed, the Doctor can\'t protect you, so the mafia will come for you.' },
    lookout: { night: 'Watch another player.', does: 'At dawn you learn who visited them tonight (any action aimed at them, including the family\'s hit).' },
    tracker: { night: 'Follow another player.', does: 'At dawn you learn whom they visited tonight (a blocked player stays home).' },
    medium: { night: 'From the second night, once a game: pick a dead player.', does: 'At dawn you learn their exact role.', notes: 'Only when roles are hidden until the end (when roles are revealed on death, everyone knows them already).' },
    jester: { night: 'Pick a hunch.', does: 'Make the town suspect you.', win: 'If you are voted out at a trial (not killed at night). The game goes on for everyone else.' },
    survivor: { night: 'Put on a bulletproof vest, or don\'t (vests for the whole game: a setup option, 2).', does: 'A vest stops every attack on you tonight.', win: 'If you are alive when the game ends, whoever else wins.' },
    framer: { night: 'Frame a player, and vote on the family\'s victim.', does: 'Tonight the Detective sees them as 🔴 Suspicious.', win: 'With the mafia.' },
    janitor: { night: 'Choose whether to clean up after tonight\'s hit, and vote on the family\'s victim.', does: 'If the hit succeeds, nobody learns the victim\'s role at dawn (you do). Cleanings for the whole game: a setup option (2).', win: 'With the mafia.', notes: 'Only when roles are revealed on death.' },
    consigliere: { night: 'Investigate a player, and vote on the family\'s victim.', does: 'At dawn you learn their exact role.', win: 'With the mafia.' },
    veteran: { night: 'Go on alert, or rest (alerts for the whole game: a setup option, 2).', does: 'On alert you can\'t be killed, and you shoot everyone who visits you tonight: friend or foe, even a Doctor.', notes: 'Can\'t be blocked. Your shots can\'t be stopped by a Bodyguard.' },
    executioner: { night: 'Pick a hunch.', does: 'You know your target (a member of the town) from the start.', win: 'If your target is voted out at a trial. If they die at night instead, you become a Jester.' },
    serialkiller: { night: 'Kill a player.', does: 'Your kill is an attack (a Doctor or a vest can stop it). Anyone who tries to block you becomes your victim instead.', win: 'If you outlast everyone: you are alive with at most one other player (Survivors, Jesters and Executioners don\'t count).', notes: 'The Detective sees you as 🔴 Suspicious.' },
  };
  const WIN = { town: 'When every mafia member (and any Serial Killer) is gone.', mafia: 'When the mafia equal or outnumber everyone else (and the Serial Killer is dead).' };
  const detailHTML = r => {
    const d = DETAIL[r], x = R(r);
    return `<div class="tip-head"><span class="tip-ic">${x.icon}</span><b>${x.name}</b></div>
      <div class="tip-tags"><span>${TIERS[x.tier]}</span><span>${TEAM[x.team]}</span></div>
      <p><b>Night:</b> ${d.night}</p><p><b>What you do:</b> ${d.does}</p><p><b>Winning:</b> ${d.win || WIN[x.team]}</p>${d.notes ? `<p class="tip-note">${d.notes}</p>` : ''}`;
  };

  /* ---------- Setup: how many mafia, which roles ---------- */
  const suggestMafia = n => Math.max(1, Math.round(n / 4));
  const maxMafia = n => Math.max(1, Math.floor((n - 1) / 2));          // fewer than half, or the mafia win at once
  const mafiaCount = (n, v) => Math.min(maxMafia(n), v === 'auto' || v == null || v === '' ? suggestMafia(n) : Math.max(1, +v));
  // The roles for n players: the mafia (specials first, then Mafiosi), the neutrals (at most n/5), the town specials,
  // then Villagers. Roles that can't be used are listed in `left` with the reason.
  function buildRoles(n, picked = [], o = {}) {
    const want = r => picked.includes(r), left = [], m = mafiaCount(n, o.mafia), hidden = o.reveal === 'hidden';
    const mafia = [];
    for (const r of MAFIA_SPECIAL.filter(want)) {
      if (r === 'janitor' && hidden) left.push([r, 'only when roles are revealed on death']);
      else if (mafia.length < m) mafia.push(r);
      else left.push([r, `only ${m} mafia`]);
    }
    while (mafia.length < m) mafia.push('mafioso');
    const cap = Math.floor(n / 5), neutrals = [];
    for (const r of NEUTRAL.filter(want)) {
      if (neutrals.length < cap) neutrals.push(r);
      else left.push([r, cap ? `at most ${cap} neutral${cap === 1 ? '' : 's'} for ${n} players` : 'neutrals need 5 players']);
    }
    const room = n - m - neutrals.length, town = [];
    for (const r of TOWN_SPECIAL.filter(want)) {
      const k = r === 'mason' ? 2 : 1;
      if (r === 'medium' && !hidden) left.push([r, 'only when roles are hidden until the end']);
      else if (r === 'mason' && n < 7) left.push([r, 'Masons need 7 players']);
      else if (town.length + k <= room) town.push(...Array(k).fill(r));
      else left.push([r, 'no place left']);
    }
    while (town.length < room) town.push('villager');
    return { roles: [...mafia, ...town, ...neutrals], left, mafia: m };
  }
  const balance = roles => roles.reduce((a, r) => a + R(r).weight, 0);
  const balanceText = b => b > 4 ? 'Town favoured' : b < -4 ? 'Mafia favoured' : 'Balanced';

  /* ---------- Helpers ---------- */
  const players = ctx => ctx.players.map((_, k) => k);
  const nm = (ctx, k) => ctx.players[k].name;
  const note = (ctx, i, text) => ctx.state.notes[i].push(ctx.state.night ? `Night ${ctx.state.night}: ${text}` : text);
  const living = ctx => players(ctx).filter(k => ctx.state.alive[k]);
  const leader = ctx => {
    const fam = living(ctx).filter(k => isMafia(ctx.state.roles[k]));
    return fam.find(k => ctx.state.roles[k] === 'godfather') ?? fam[0] ?? null;
  };
  const weightOf = (ctx, k) => (ctx.state.mayor === k ? 3 : 1);           // a revealed Mayor's votes count 3
  const need = ctx => Math.floor(living(ctx).reduce((a, k) => a + weightOf(ctx, k), 0) / 2) + 1;
  const names = (ctx, ks) => ks.map(k => nm(ctx, k)).join(', ');
  const usesOf = (o, r) => ({ vigilante: { shots: +o.vigShots || 2 }, veteran: { alerts: +o.vetAlerts || 2 }, janitor: { cleans: +o.cleans || 2 },
    survivor: { vests: +o.vests || 2 }, doctor: { selfSaves: o.docSelf === 'never' ? 0 : o.docSelf === 'any' ? Infinity : 1 }, medium: { looks: 1 } }[r] || {});

  // The noir stories for a death at night (the victim's name first)
  const STORIES = [
    'was found at the docks at first light.',
    'never made it home from the jazz club.',
    'was found slumped in a booth at the all-night diner.',
    'was last seen getting into a long black sedan.',
    'was found in the alley behind the speakeasy.',
    'was found under the street lamp on Fifth, hat still on.',
    'was fished out of the river by the morning shift.',
  ];
  // What the town learns about a dead player's role (setup: revealed on death, or hidden until the end)
  function revealLine(ctx, k) {
    const st = ctx.state;
    if (ctx.opts.reveal === 'hidden') return `What ${nm(ctx, k)} was stays a secret.`;
    if (st.cleaned[k]) return `Someone cleaned up: what ${nm(ctx, k)} was, nobody can tell.`;
    return `${nm(ctx, k)} was the ${R(st.roles[k]).name}.`;
  }
  function die(ctx, k, cause) {
    const st = ctx.state;
    st.alive[k] = false;
    st.deaths.push({ k, cause, when: cause === 'trial' ? `voted out on day ${st.day}` : `died on night ${st.night}` });
    if (ctx.opts.reveal !== 'hidden') st.revealed[k] = st.cleaned[k] ? 'cleaned' : st.roles[k];
  }

  /* ---------- The night ---------- */
  // The family's kill: { t, carrier } (the mafia member who carries it out), or null
  function mafiaKill(ctx, blocked) {
    const st = ctx.state, o = ctx.opts;
    if (st.night === 1 && o.firstNight === 'meet') return null;
    const fam = living(ctx).filter(k => isMafia(st.roles[k]));
    if (!fam.length) return null;
    const lead = leader(ctx), picked = fam.filter(k => st.picks[k] != null);
    let t = null;
    if (o.killMode === 'leader') t = st.picks[lead] ?? null;
    else if (o.killMode === 'unanimous') t = picked.length === fam.length && picked.every(k => st.picks[k] === st.picks[fam[0]]) ? st.picks[fam[0]] : null;
    else {
      const tally = {};
      picked.forEach(k => { tally[st.picks[k]] = (tally[st.picks[k]] || 0) + 1; });
      const top = Math.max(0, ...Object.values(tally)), tied = Object.keys(tally).filter(x => tally[x] === top).map(Number);
      t = !tied.length ? null : tied.length === 1 ? tied[0] : tied.includes(st.picks[lead]) ? st.picks[lead] : tied[ctx.rand(tied.length)];
    }
    if (t == null || !st.alive[t] || isMafia(st.roles[t])) return null;
    const pool = o.killMode === 'leader' ? [lead] : fam.filter(k => st.picks[k] === t);
    let carriers = pool.filter(k => !blocked.has(k));
    if (!carriers.length && o.killMode === 'leader') carriers = fam.filter(k => !blocked.has(k));
    if (!carriers.length) { fam.forEach(k => note(ctx, k, `The hit on ${nm(ctx, t)} never happened: whoever was meant to do it was kept busy.`)); return null; }
    return { t, carrier: carriers[ctx.rand(carriers.length)] };
  }
  // Resolves the night (docs/2026-10-mafia.md, "Night order"): returns [[player, cause], …] for the deaths, and leaves
  // each player's private results in their notes. Uses up bullets, alerts, vests, cleanings and self-saves.
  function resolveNight(ctx) {
    const st = ctx.state, o = ctx.opts, A = st.acts;
    const role = k => st.roles[k], tgt = k => A[k]?.t ?? null;
    const actors = living(ctx), deaths = new Map(), told = new Set();
    const kill = (k, cause) => { if (!deaths.has(k)) deaths.set(k, cause); };
    const log = t => st.nightLog.push(`Night ${st.night}: ${t}`);
    // 0. last night's guilt
    st.guilt.forEach(k => { if (st.alive[k]) { kill(k, 'guilt'); log(`${nm(ctx, k)} died of guilt.`); } });
    st.guilt = [];
    // 1. the Veteran's alert
    const alert = new Set(actors.filter(k => role(k) === 'veteran' && A[k]?.alert && st.uses[k].alerts > 0));
    alert.forEach(k => { st.uses[k].alerts--; log(`Veteran ${nm(ctx, k)} stayed on alert.`); });
    // 2. blocks (all at once); the Serial Killer and a Veteran on alert can't be blocked
    const blocked = new Set(), visits = [];
    let skBlocker = null;
    actors.filter(k => (role(k) === 'escort' || role(k) === 'consort') && tgt(k) != null).forEach(k => {
      const t = tgt(k);
      visits.push([k, t]);
      if (role(t) === 'serialkiller') skBlocker ??= k;
      else if (!alert.has(t)) blocked.add(t);
      log(`${R(role(k)).name} ${nm(ctx, k)} tried to keep ${nm(ctx, t)} busy.`);
    });
    blocked.forEach(k => note(ctx, k, 'Someone kept you busy tonight: your night action didn\'t happen.'));
    const free = k => !blocked.has(k);
    // 3. the family's kill
    const hit = mafiaKill(ctx, blocked);
    if (hit) log(`The family sent ${nm(ctx, hit.carrier)} after ${nm(ctx, hit.t)}.`);
    // 4. protection and deception
    const healed = new Map(), guards = new Map(), vested = new Set(), framed = new Set();
    for (const k of actors) {
      const r = role(k), t = tgt(k);
      if (r === 'survivor' && A[k]?.vest && st.uses[k].vests > 0) { st.uses[k].vests--; vested.add(k); log(`Survivor ${nm(ctx, k)} wore a vest.`); }
      if (t == null || !free(k) || r === 'escort' || r === 'consort') continue;
      if (r === 'doctor') { healed.set(t, k); st.docLast[k] = t; if (t === k) st.uses[k].selfSaves--; log(`Doctor ${nm(ctx, k)} protected ${t === k ? 'themselves' : nm(ctx, t)}.`); }
      else if (r === 'bodyguard') { if (!guards.has(t)) guards.set(t, k); log(`Bodyguard ${nm(ctx, k)} guarded ${nm(ctx, t)}.`); }
      else if (r === 'framer') { framed.add(t); log(`Framer ${nm(ctx, k)} framed ${nm(ctx, t)}.`); }
      if (r !== 'vigilante' && r !== 'serialkiller') visits.push([k, t]);
    }
    // 5. attacks (all at once)
    const attacks = [];
    if (hit) { attacks.push([hit.carrier, hit.t, 'mafia']); visits.push([hit.carrier, hit.t]); }
    for (const k of actors) {
      const r = role(k), t = tgt(k);
      if (r === 'vigilante' && t != null && free(k) && st.uses[k].shots > 0 && st.night > 1) { st.uses[k].shots--; attacks.push([k, t, 'vigilante']); visits.push([k, t]); log(`Vigilante ${nm(ctx, k)} shot at ${nm(ctx, t)}.`); }
      if (r === 'serialkiller') {
        const v = skBlocker ?? t;
        if (v != null) { attacks.push([k, v, 'serialkiller']); visits.push([k, v]); log(`Serial Killer ${nm(ctx, k)} went after ${nm(ctx, v)}${skBlocker != null ? ', who had tried to block them' : ''}.`); }
      }
    }
    visits.filter(([k, t]) => alert.has(t) && k !== t).forEach(([k, t]) => attacks.push([t, k, 'veteran']));
    const safe = k => healed.has(k) || vested.has(k) || alert.has(k);
    const saved = k => {
      if (told.has(k)) return;
      told.add(k);
      if (alert.has(k)) note(ctx, k, 'Someone came for you tonight, and you were ready.');
      else if (vested.has(k)) note(ctx, k, 'You were attacked tonight. Your vest saved you.');
      else { note(ctx, k, 'You were attacked tonight, but someone saved you.'); note(ctx, healed.get(k), `${nm(ctx, k)} was attacked tonight, and you saved them.`); }
    };
    const usedGuard = new Set();
    for (const [by, t, src] of attacks) {
      if (src !== 'veteran' && guards.has(t) && !usedGuard.has(t)) {        // the Bodyguard steps in
        const bg = guards.get(t);
        usedGuard.add(t);
        if (safe(bg)) saved(bg); else kill(bg, 'bodyguard');
        if (by !== bg) { if (safe(by)) saved(by); else kill(by, 'bodyguard'); }
        log(`Bodyguard ${nm(ctx, bg)} stepped in front of ${nm(ctx, by)}'s attack on ${nm(ctx, t)}.`);
        continue;
      }
      if (safe(t)) saved(t); else kill(t, src);
      if (src === 'veteran') log(`Veteran ${nm(ctx, by)} shot ${nm(ctx, t)}, who came to visit.`);
    }
    // 6. information (for whoever wasn't blocked)
    const suspicious = t => (isMafia(role(t)) && role(t) !== 'godfather') || framed.has(t) || role(t) === 'serialkiller';
    for (const k of actors) {
      const r = role(k), t = tgt(k);
      if (r === 'medium' && A[k]?.dead != null && st.uses[k].looks > 0) { st.uses[k].looks--; note(ctx, k, `The spirits whisper: ${nm(ctx, A[k].dead)} was the ${label(role(A[k].dead))}.`); }
      if (t == null || !free(k)) continue;
      if (r === 'detective') note(ctx, k, `${nm(ctx, t)} is ${suspicious(t) ? '🔴 Suspicious' : '🟢 Not suspicious'}.`);
      if (r === 'consigliere') note(ctx, k, `${nm(ctx, t)} is the ${label(role(t))}.`);
      if (r === 'lookout') { const v = [...new Set(visits.filter(x => x[1] === t && x[0] !== k).map(x => x[0]))]; note(ctx, k, v.length ? `${names(ctx, v)} visited ${nm(ctx, t)} tonight.` : `Nobody visited ${nm(ctx, t)} tonight.`); }
      if (r === 'tracker') { const v = [...new Set(visits.filter(x => x[0] === t).map(x => x[1]))]; note(ctx, k, v.length ? `${nm(ctx, t)} visited ${names(ctx, v)} tonight.` : `${nm(ctx, t)} stayed home tonight.`); }
    }
    // 7. afterwards
    if (hit) {
      const fam = living(ctx).filter(k => isMafia(role(k)));
      fam.forEach(k => note(ctx, k, deaths.get(hit.t) === 'mafia' ? `The family's hit on ${nm(ctx, hit.t)} went through.` : `${nm(ctx, hit.t)} survived the family's hit.`));
      const jan = fam.find(k => role(k) === 'janitor' && free(k) && A[k]?.clean && st.uses[k].cleans > 0);
      if (jan != null && deaths.get(hit.t) === 'mafia') {
        st.uses[jan].cleans--; st.cleaned[hit.t] = true;
        note(ctx, jan, `You cleaned up after ${nm(ctx, hit.t)}: they were the ${label(role(hit.t))}.`);
        log(`Janitor ${nm(ctx, jan)} cleaned up after ${nm(ctx, hit.t)}.`);
      }
    }
    for (const [by, t, src] of attacks) if (src === 'vigilante' && deaths.get(t) === 'vigilante' && R(role(t)).team === 'town' && o.guilt !== 'off') st.guilt.push(by);
    actors.filter(k => role(k) === 'executioner' && deaths.has(st.exec[k]) && !deaths.has(k)).forEach(k => {
      st.roles[k] = 'jester';
      note(ctx, k, `Your target ${nm(ctx, st.exec[k])} died tonight. You are a Jester now: get yourself voted out!`);
    });
    return [...deaths];
  }

  /* ---------- Winning ---------- */
  function checkWin(ctx) {
    const st = ctx.state, al = living(ctx), role = k => st.roles[k];
    if (!al.length) return 'draw';
    const maf = al.filter(k => isMafia(role(k))).length, sk = al.some(k => role(k) === 'serialkiller');
    if (!maf && !sk) return 'town';
    if (sk && !maf && al.filter(k => role(k) !== 'serialkiller' && !PASSIVE.has(role(k))).length <= 1) return 'serialkiller';
    if (!sk && maf >= al.length - maf) return 'mafia';
    if (st.quiet >= 3) return 'draw';
    return null;
  }
  const HEADLINE = {
    town: 'The town wins! The family is finished.',
    mafia: 'The mafia wins! The city belongs to the family now.',
    serialkiller: 'The Serial Killer wins! Nobody was safe.',
    draw: 'A draw. The city goes quiet.',
  };
  function finish(ctx, side) {
    const st = ctx.state;
    const won = k => {
      const r = st.roles[k];
      if (r === 'survivor') return st.alive[k];
      if (r === 'jester' || r === 'executioner') return !!st.wins[k];
      if (r === 'serialkiller') return side === 'serialkiller';
      return R(r).team === side;
    };
    const fate = k => st.deaths.find(d => d.k === k)?.when || 'survived';
    const hunchStats = [...new Set(st.hunches.map(h => h.night))].map(night => {
      const tally = {};
      st.hunches.filter(h => h.night === night).forEach(h => { tally[h.t] = (tally[h.t] || 0) + 1; });
      const [t, c] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      return `Night ${night}: ${c} suspected ${esc(nm(ctx, +t))} (${R(st.roles[+t]).name})`;
    });
    const html = `<div class="mf-head">${HEADLINE[side]}</div>
      <table class="mf-table"><thead><tr><th>Player</th><th>Role</th><th>Fate</th><th></th></tr></thead><tbody>
      ${players(ctx).map(k => `<tr><td><b>${esc(nm(ctx, k))}</b></td><td>${label(st.start[k])}${st.roles[k] !== st.start[k] ? ` → ${label(st.roles[k])}` : ''}</td><td>${fate(k)}</td><td>${won(k) ? '🏆' : ''}</td></tr>`).join('')}
      </tbody></table>
      <div class="sec-title">What happened at night</div><div class="note">${st.nightLog.map(esc).join('<br>') || 'A quiet game.'}</div>
      ${hunchStats.length ? `<div class="sec-title">The town's hunches</div><div class="note">${hunchStats.join('<br>')}</div>` : ''}`;
    ctx.log(`🏁 ${HEADLINE[side]}`);
    ctx.say(HEADLINE[side], 'wave');
    ctx.end(players(ctx).map(k => ({ name: nm(ctx, k), won: won(k), points: st.alive[k] ? 1 : 0, note: `${R(st.roles[k]).name}${st.alive[k] ? '' : ' · died'}` })), html);
    st.over = true;
  }
  function over(ctx) {
    const side = checkWin(ctx);
    if (side) finish(ctx, side);
    return !!side;
  }

  /* ---------- A round ---------- */
  async function night(ctx) {
    const st = ctx.state;
    st.night++;
    st.phase = 'night'; st.acts = {}; st.picks = {}; st.hunch = {}; st.done = new Set(); st.roundStart = st.deaths.length;
    ctx.log(`🌙 Night ${st.night}.`);
    ctx.update();
    await ctx.say(st.night === 1 ? 'Night falls on the city. Heads down, look only at your own phone, and make your choice quietly. Everyone has something to choose.' : 'Night falls on the city again. Phones out, quietly now.', 'sweep');
    await ctx.countdown(st.nightTime, 'Night');
    players(ctx).forEach(k => { if (st.alive[k] && st.hunch[k] != null) st.hunches.push({ night: st.night, i: k, t: st.hunch[k] }); });
    const deaths = resolveNight(ctx);
    st.phase = 'dawn';
    deaths.forEach(([k, cause]) => die(ctx, k, cause));
    ctx.log(deaths.length ? `☠️ ${names(ctx, deaths.map(d => d[0]))} died in the night.` : '🌅 Nobody died in the night.');
    ctx.update();
    if (!deaths.length) await ctx.say('The sun comes up over the city. Nobody died tonight.', 'welcome');
    for (const [k, cause] of deaths) {
      await ctx.say(cause === 'guilt' ? `${nm(ctx, k)} couldn't live with what they had done, and was found at dawn. ${revealLine(ctx, k)}`
        : `${nm(ctx, k)} ${STORIES[ctx.rand(STORIES.length)]} ${revealLine(ctx, k)}`, 'shake');
    }
  }
  const talkTime = (ctx, day) => { const base = +ctx.opts.talk || 240; return ctx.opts.shrink === 'off' ? base : Math.max(120, base - 60 * (day - 1)); };
  async function day(ctx) {
    const st = ctx.state;
    st.day++;
    st.phase = 'day'; st.ready = new Set(); st.lastVerdict = null;
    const talk = talkTime(ctx, st.day);
    ctx.log(`☀️ Day ${st.day}.`);
    ctx.update();
    await ctx.say(`Day ${st.day}. You have ${talk / 60} minutes to find the mafia. Tap ready on your phone when you want to vote.`, 'welcome');
    await ctx.countdown(talk, 'Discussion');
    await trials(ctx);
    st.quiet = st.deaths.length > st.roundStart ? 0 : st.quiet + 1;
  }
  // The player nominations put on trial when time runs out: the most nominations (at least 2), the tie rule for a tie
  function fromNominations(ctx) {
    const st = ctx.state, tally = {};
    Object.entries(st.noms).forEach(([k, t]) => { if (t != null) tally[t] = (tally[t] || 0) + weightOf(ctx, +k); });
    const top = Math.max(0, ...Object.values(tally));
    if (top < 2) return { t: null };
    const tied = Object.keys(tally).filter(t => tally[t] === top).map(Number);
    if (tied.length === 1) return { t: tied[0] };
    return { t: ctx.opts.ties === 'random' ? tied[ctx.rand(tied.length)] : null, tied };
  }
  async function trials(ctx) {
    const st = ctx.state;
    st.trialsLeft = +ctx.opts.trials || 2;
    let time = 60;
    while (st.trialsLeft > 0) {
      st.phase = 'nominate'; st.noms = {}; st.accused = null;
      ctx.update();
      await ctx.say(`Name your suspect. Nominate on your phone: ${need(ctx)} votes put someone on trial.`, 'point');
      await ctx.countdown(time, 'Nominations');
      let t = st.accused;
      if (t == null) {
        const r = fromNominations(ctx);
        if (r.tied && r.t == null) { ctx.log(`⚖️ A tie between ${names(ctx, r.tied)}: nobody goes on trial.`); await ctx.say(`A tie between ${names(ctx, r.tied)}. Nobody goes on trial today.`, 'shake'); return; }
        if (r.tied) ctx.log(`⚖️ A tie between ${names(ctx, r.tied)}: ${nm(ctx, r.t)} was drawn.`);
        t = r.t;
      }
      if (t == null) { ctx.log('Nobody was put on trial.'); await ctx.say('Nobody goes on trial today.', 'shake'); return; }
      st.trialsLeft--;
      st.accused = t; st.phase = 'defense';
      ctx.log(`⚖️ ${nm(ctx, t)} is on trial.`);
      ctx.update();
      await ctx.say(`${nm(ctx, t)}, you stand accused. You have 30 seconds to plead your case.`, 'point');
      await ctx.countdown(30, `${nm(ctx, t)}'s defense`);
      st.phase = 'verdict'; st.verdict = {};
      ctx.update();
      await ctx.say(`Guilty or innocent? Vote on your phone.`, 'point');
      await ctx.countdown(20, 'Verdict');
      const g = Object.entries(st.verdict).filter(([, v]) => v === 'g').reduce((a, [k]) => a + weightOf(ctx, +k), 0);
      const inn = Object.entries(st.verdict).filter(([, v]) => v === 'i').reduce((a, [k]) => a + weightOf(ctx, +k), 0);
      st.lastVerdict = { t, guilty: g, innocent: inn, votes: players(ctx).filter(k => k !== t && st.alive[k]).map(k => [k, st.verdict[k] || 'a']) };
      ctx.log(`🗳️ ${nm(ctx, t)}: ${g} guilty, ${inn} innocent.`);
      if (g > inn) { await eliminate(ctx, t); return; }                 // a tie acquits
      st.phase = 'acquitted';
      ctx.update();
      await ctx.say(`${nm(ctx, t)} is found not guilty, ${g} to ${inn}.${st.trialsLeft ? '' : ' That was the last trial today.'}`, 'wave');
      time = 45;
    }
  }
  async function eliminate(ctx, t) {
    const st = ctx.state, r = st.roles[t];
    die(ctx, t, 'trial');
    if (r === 'jester') st.wins[t] = true;
    players(ctx).filter(k => st.roles[k] === 'executioner' && st.exec[k] === t).forEach(k => { st.wins[k] = true; });
    st.phase = 'executed';
    ctx.update();
    const jesterLine = r === 'jester' && ctx.opts.reveal !== 'hidden' ? ' And the Jester laughs all the way out of town: that was exactly what they wanted!' : '';
    await ctx.say(`The town has spoken, ${st.lastVerdict.guilty} to ${st.lastVerdict.innocent}. ${nm(ctx, t)} is run out of town. ${revealLine(ctx, t)}${jesterLine}`, 'shake');
  }

  /* ---------- What each phone may see ---------- */
  // A role this viewer may see: revealed ones, their own family or fellow Mason, and everything once they're dead
  function shownRole(ctx, viewer, k) {
    const st = ctx.state, me = st.roles[viewer];
    if (k === viewer || !st.alive[viewer] || st.over) return st.roles[k];
    if (st.revealed[k]) return st.revealed[k] === 'cleaned' ? null : st.revealed[k];
    if (isMafia(me) && isMafia(st.roles[k])) return st.roles[k];
    if (st.start[viewer] === 'mason' && st.start[k] === 'mason') return 'mason';
    return null;
  }
  const VERB = { detective: 'investigates', doctor: 'protects', escort: 'keeps busy', consort: 'keeps busy', bodyguard: 'guards', vigilante: 'shoots', framer: 'frames', consigliere: 'checks', lookout: 'watches', tracker: 'follows', serialkiller: 'goes after' };
  // The night as a spectator sees it: everyone's choices so far
  function liveNight(ctx) {
    const st = ctx.state, out = [];
    living(ctx).forEach(k => {
      const r = st.roles[k], a = st.acts[k] || {};
      const bits = [];
      if (st.picks[k] != null) bits.push(`hit on ${nm(ctx, st.picks[k])}`);
      if (a.t != null) bits.push(`${VERB[r] || 'targets'} ${a.t === k ? 'themselves' : nm(ctx, a.t)}`);
      if (a.alert) bits.push('on alert'); if (a.vest) bits.push('vest on'); if (a.clean) bits.push('will clean'); if (a.dead != null) bits.push(`asks about ${nm(ctx, a.dead)}`);
      if (st.hunch[k] != null) bits.push(`hunch: ${nm(ctx, st.hunch[k])}`);
      out.push(`${nm(ctx, k)} (${R(r).name}): ${bits.join(', ') || '…'}${st.done.has(k) ? ' ✓' : ''}`);
    });
    return out;
  }

  // Deals the roles (dealt[k] = player k's role) and tells the mafia, the Masons and the Executioner what they know
  function deal(ctx, dealt) {
    const n = ctx.players.length, o = ctx.opts;
    const st = ctx.state = { roles: dealt, start: dealt.slice(), alive: Array(n).fill(true), phase: 'deal', day: 0, night: 0, notes: [...Array(n)].map(() => []),
      acts: {}, picks: {}, hunch: {}, done: new Set(), ready: new Set(), noms: {}, verdict: {}, accused: null, trialsLeft: 0, lastVerdict: null,
      uses: dealt.map(r => usesOf(o, r)), docLast: {}, guilt: [], mayor: null, exec: {}, revealed: {}, cleaned: {}, wins: {},
      deaths: [], roundStart: 0, quiet: 0, nightLog: [], hunches: [], nightTime: +o.night || 30, mafiaCount: dealt.filter(isMafia).length, inGame: [...new Set(dealt)], over: false };
    const fam = players(ctx).filter(k => isMafia(dealt[k]));
    fam.forEach(k => note(ctx, k, fam.length > 1 ? `Your family: ${fam.filter(x => x !== k).map(x => `${nm(ctx, x)} (${R(dealt[x]).name})`).join(', ')}.` : 'You are the only member of the family. Good luck.'));
    const masons = players(ctx).filter(k => dealt[k] === 'mason');
    masons.forEach(k => note(ctx, k, `The other Mason: ${names(ctx, masons.filter(x => x !== k))}. You can trust each other.`));
    players(ctx).filter(k => dealt[k] === 'executioner').forEach(k => {
      const pool = players(ctx).filter(x => x !== k && R(dealt[x]).team === 'town' && dealt[x] !== 'mayor');
      if (!pool.length) { st.roles[k] = 'jester'; note(ctx, k, 'There was nobody to be your target, so you are a Jester.'); return; }
      st.exec[k] = pool[ctx.rand(pool.length)];
      note(ctx, k, `Your target: ${nm(ctx, st.exec[k])}. Get them voted out at a trial.`);
    });
    return st;
  }

  const OPTIONAL = [...TOWN_SPECIAL, ...MAFIA_SPECIAL, ...NEUTRAL];
  const tierChoices = t => OPTIONAL.filter(r => R(r).tier === t).map(r => [r, `${label(r)}${r === 'mason' ? ' ×2' : ''}`, R(r).text, detailHTML(r)]);
  const has = (o, r) => (o.roles || []).includes(r);
  const roleGuide = t => Object.keys(ROLES).filter(r => R(r).tier === t).map(r => `${R(r).icon} <b>${R(r).name}</b>: ${R(r).text}`).join('<br>');

  return {
    _test: { ROLES, deal, night, day, buildRoles, suggestMafia, mafiaCount, maxMafia, balance, balanceText, resolveNight, mafiaKill, checkWin, fromNominations, shownRole, talkTime, need },   // internals, for the unit tests only (test/unit)
    id: 'mafia', name: 'Mafia', min: 4, max: 16, macRole: 'moderator', pointsLabel: null,   // "Survived" is a leaderboard column; the end screen says who died
    blurb: 'The town against the family, night after night. Secret roles on every phone; the Mac narrates, runs the trials and counts the votes. 4–16 players.',
    options: [
      { key: 'roles', type: 'checks', def: ['detective', 'doctor'], label: 'Roles (hover over a role for its full rules)',
        groups: [
          { title: 'Beginner', note: 'Mafiosi fill the mafia\'s places, Villagers the town\'s.', choices: [['mafioso', label('mafioso'), R('mafioso').text, detailHTML('mafioso')], ['villager', label('villager'), R('villager').text, detailHTML('villager')]], fixed: true },
          { title: 'Beginner roles', choices: tierChoices(1) },
          { title: 'Intermediate', note: 'Add a few at a time.', choices: tierChoices(2) },
          { title: 'Advanced', note: 'For groups who know the others. Roles that don\'t fit are left out, most advanced first.', choices: tierChoices(3) },
        ] },
      { key: 'mafia', label: 'Number of mafia', def: 'auto', choices: [['auto', 'Suggested for the players present'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']] },
      { key: 'reveal', label: 'Roles on death', def: 'reveal', choices: [['reveal', 'Revealed'], ['hidden', 'Hidden until the end']] },
      { key: 'ties', label: 'A tie in the nominations', def: 'none', choices: [['none', 'Nobody goes on trial'], ['random', 'One of the tied at random']] },
      { key: 'killMode', label: 'The mafia\'s kill', def: 'vote', choices: [['vote', 'Live votes, the leader breaks ties'], ['unanimous', 'Must be unanimous'], ['leader', 'The leader decides']] },
      { key: 'firstNight', label: 'First night', def: 'kill', choices: [['kill', 'A kill'], ['meet', 'The mafia only meet']] },
      { key: 'docSelf', label: 'Doctor saving themselves', def: 'once', choices: [['once', 'Once a game'], ['never', 'Never'], ['any', 'Any time']], showIf: o => has(o, 'doctor') },
      { key: 'docRepeat', label: 'Doctor: same player two nights running', def: 'no', choices: [['no', 'Not allowed'], ['yes', 'Allowed']], showIf: o => has(o, 'doctor') },
      { key: 'vigShots', label: 'Vigilante\'s bullets', def: 2, choices: [[1, '1'], [2, '2'], [3, '3']], showIf: o => has(o, 'vigilante') },
      { key: 'guilt', label: 'Vigilante who kills the town', def: 'on', choices: [['on', 'Dies of guilt the next night'], ['off', 'Carries on']], showIf: o => has(o, 'vigilante') },
      { key: 'vetAlerts', label: 'Veteran\'s alerts', def: 2, choices: [[1, '1'], [2, '2'], [3, '3']], showIf: o => has(o, 'veteran') },
      { key: 'cleans', label: 'Janitor\'s cleanings', def: 2, choices: [[1, '1'], [2, '2'], [3, '3']], showIf: o => has(o, 'janitor') && o.reveal !== 'hidden' },
      { key: 'vests', label: 'Survivor\'s vests', def: 2, choices: [[1, '1'], [2, '2'], [3, '3']], showIf: o => has(o, 'survivor') },
      { key: 'talk', label: 'Discussion on day 1', def: 240, choices: [[180, '3 minutes'], [240, '4 minutes'], [300, '5 minutes'], [420, '7 minutes']] },
      { key: 'shrink', label: 'Later days', def: 'on', choices: [['on', '1 minute shorter each day (at least 2)'], ['off', 'The same length']] },
      { key: 'trials', label: 'Trials per day', def: 2, choices: [[1, '1'], [2, '2'], [3, '3']] },
      { key: 'night', label: 'Night', def: 30, choices: [[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds'], [60, '1 minute']] },
    ],
    rules: [
      '<b>Setup:</b> everyone gets a secret role on their phone (tap the card to peek). The mafia know each other; the town doesn\'t know anyone. The Mac lists the roles in the game, never who has them.',
      '<b>Night:</b> heads down, everyone looks only at their own phone and makes a choice: the mafia pick a victim together, roles with powers use them, and everyone else picks a hunch (who they suspect). Everyone taps, so tapping gives nothing away. The night ends when everyone taps Done, or the time runs out.',
      '<b>Dawn:</b> the Mac tells who died, and (depending on the setup) what they were. Saves aren\'t announced. Private results appear on the phones that earned them.',
      '<b>Day:</b> talk! Then nominate on your phone: the first player nominated by a majority goes on trial (when time runs out, the most nominations, at least 2; a tie follows the setup). The accused has 30 seconds to plead; then everyone else votes Guilty, Innocent or Abstain. More Guilty than Innocent: they are out. A tie acquits. The Mac shows who voted what.',
      '<b>Out of the game:</b> your phone shows every role and the night as it happens. Watch, but stay silent!',
      '<b>Winning:</b> the town wins when the mafia (and any Serial Killer) are gone. The mafia win when they equal or outnumber everyone else. Neutrals have goals of their own (a Jester who is voted out wins, and the game goes on). Three rounds in a row without a death end the game in a draw.',
      `<b>Beginner roles:</b><br>${roleGuide(1)}`,
      `<b>Intermediate roles:</b><br>${roleGuide(2)}`,
      `<b>Advanced roles:</b><br>${roleGuide(3)}`,
    ],
    canStart(n, o) {
      if (o.mafia !== 'auto' && +o.mafia > maxMafia(n)) return `With ${n} players there can be at most ${maxMafia(n)} mafia.`;
      return null;
    },
    // Shown in the lobby: the roles the game would deal, the balance meter and the roles that don't fit
    lobbyHTML(n, o) {
      const players = Math.max(n, 4), { roles, left, mafia } = buildRoles(players, o.roles || [], o), b = balance(roles);
      const count = {};
      roles.forEach(r => { count[r] = (count[r] || 0) + 1; });
      const pills = Object.entries(count).map(([r, c]) => `<span class="p">${label(r)}${c > 1 ? ` ×${c}` : ''}</span>`).join('');
      return `<div class="sec-title">Roles for ${players} players${n < 4 ? ' (at least 4)' : ''}: ${mafia} mafia${o.mafia === 'auto' ? ' (suggested)' : ''}</div><div class="pills">${pills}</div>
        <div class="mf-meter"><span class="mf-bar" style="--b:${Math.max(-20, Math.min(20, b))}"></span><b>${balanceText(b)}</b> <span class="note">(score ${b > 0 ? '+' : ''}${b}; near 0 is even)</span></div>
        ${left.length ? `<div class="note mf-left">Left out: ${left.map(([r, why]) => `${label(r)} (${why})`).join(', ')}.</div>` : ''}`;
    },
    async start(ctx) {
      const { roles, mafia } = buildRoles(ctx.players.length, ctx.opts.roles || [], ctx.opts);
      const st = deal(ctx, ctx.shuffle(roles.slice()));
      ctx.log(`Roles: ${[...st.inGame].map(r => R(r).name).join(', ')}.`);
      ctx.update();
      await ctx.say(`Welcome to the city. ${mafia === 1 ? 'One member' : `${mafia} members`} of the family walk among you. Look at your phone, and keep your role to yourself.`, 'welcome');
      await ctx.countdown(20, 'Look at your role');
      while (!st.over) {
        await night(ctx);
        if (over(ctx)) return;
        await day(ctx);
        if (over(ctx)) return;
      }
    },
    act(ctx, i, m) {
      const st = ctx.state, n = ctx.players.length, o = ctx.opts, r = st.roles[i];
      if (!st.alive[i]) return 'You are out of the game: watch, but stay silent.';
      const t = m.p == null || m.p === '' || m.p === 'none' ? null : +m.p;
      const valid = k => k != null && k >= 0 && k < n;
      const allIn = set => living(ctx).every(k => set.has(k));
      const dayPhase = ['day', 'nominate', 'defense', 'verdict', 'acquitted', 'executed'].includes(st.phase);
      switch (m.act) {
        case 'ready':
          if (st.phase !== 'day') return 'Not now.';
          st.ready.has(i) ? st.ready.delete(i) : st.ready.add(i);
          if (allIn(st.ready)) { ctx.log('Everyone is ready to vote.'); ctx.skip(); }
          return;
        case 'mayor':
          if (r !== 'mayor' || st.mayor != null || !dayPhase) return 'Not now.';
          st.mayor = i;
          ctx.log(`🏛️ ${nm(ctx, i)} revealed: the Mayor.`);
          ctx.say(`${nm(ctx, i)} stands up: ${nm(ctx, i)} is the Mayor! From now on, their votes count three times.`, 'pay');
          return;
        case 'nominate': {
          if (st.phase !== 'nominate' || st.accused != null) return 'Nominations are closed.';
          if (t != null && (!valid(t) || !st.alive[t] || t === i)) return 'Nominate another living player.';
          st.noms[i] = t;
          const tally = Object.entries(st.noms).filter(([, x]) => x === t).reduce((a, [k]) => a + weightOf(ctx, +k), 0);
          if (t != null && tally >= need(ctx)) { st.accused = t; ctx.skip(); }
          return;
        }
        case 'verdict':
          if (st.phase !== 'verdict') return 'Voting is not open.';
          if (i === st.accused) return 'You are the accused: you don\'t vote.';
          if (!['g', 'i', 'a'].includes(m.v)) return 'Guilty, Innocent or Abstain.';
          st.verdict[i] = m.v;
          if (living(ctx).every(k => k === st.accused || st.verdict[k])) ctx.skip();
          return;
      }
      if (st.phase !== 'night') return 'Not now.';
      const a = st.acts[i] ||= {};
      switch (m.act) {
        case 'done':
          st.done.has(i) ? st.done.delete(i) : st.done.add(i);
          if (allIn(st.done)) ctx.skip();
          return;
        case 'hunch':
          if (t != null && (!valid(t) || !st.alive[t] || t === i)) return 'Pick another living player.';
          st.hunch[i] = t;
          return;
        case 'kill':
          if (!isMafia(r)) return 'Not your job.';
          if (st.night === 1 && o.firstNight === 'meet') return 'Tonight the family only meets.';
          if (t != null && (!valid(t) || !st.alive[t] || isMafia(st.roles[t]))) return 'Pick a living player outside the family.';
          st.picks[i] = t;
          return;
        case 'alert':
          if (r !== 'veteran') return 'Not your job.';
          if (m.on === '1' && !st.uses[i].alerts) return 'No alerts left.';
          a.alert = m.on === '1';
          return;
        case 'vest':
          if (r !== 'survivor') return 'Not your job.';
          if (m.on === '1' && !st.uses[i].vests) return 'No vests left.';
          a.vest = m.on === '1';
          return;
        case 'clean':
          if (r !== 'janitor') return 'Not your job.';
          if (m.on === '1' && !st.uses[i].cleans) return 'No cleanings left.';
          a.clean = m.on === '1';
          return;
        case 'medium':
          if (r !== 'medium') return 'Not your job.';
          if (st.night === 1 || !st.uses[i].looks) return 'Not tonight.';
          if (t != null && (!valid(t) || st.alive[t])) return 'Pick a player who has died.';
          a.dead = t;
          return;
        case 'act':
          if (!TARGETS.has(r)) return 'Your role has no night action.';
          if (t == null) { a.t = null; return; }
          if (!valid(t) || !st.alive[t]) return 'Pick a living player.';
          if (r === 'doctor') {
            if (t === i && !(st.uses[i].selfSaves > 0)) return o.docSelf === 'never' ? 'You can\'t protect yourself.' : 'You have already saved yourself once.';
            if (o.docRepeat !== 'yes' && st.docLast[i] === t) return 'Not the same player two nights running.';
            if (st.mayor === t) return 'The revealed Mayor can\'t be protected.';
          } else if (t === i) return 'Pick another player.';
          if (r === 'vigilante' && st.night === 1) return 'No shooting on the first night.';
          if (r === 'vigilante' && !st.uses[i].shots) return 'No bullets left.';
          a.t = t;
          return;
      }
      return 'Not now.';
    },
    hostAct(ctx, d) {
      const ph = ctx.state.phase;
      if ((d.host === 'vote' && ph === 'day') || (d.host === 'verdict' && ph === 'defense') || (d.host === 'dawn' && ph === 'night')) ctx.skip();
    },
    status(ctx) {
      const st = ctx.state;
      return { deal: 'Look at your role', night: `🌙 Night ${st.night}`, dawn: '🌅 Dawn', day: `☀️ Day ${st.day}: discussion`, nominate: `☀️ Day ${st.day}: nominations`,
        defense: `⚖️ ${st.accused != null ? nm(ctx, st.accused) : ''} on trial`, verdict: '🗳️ Verdict', acquitted: '⚖️ Not guilty', executed: '⚖️ Guilty' }[st.phase] || 'Mafia';
    },
    view(ctx, i) {
      const st = ctx.state, r = st.roles[i], me = R(r), alive = st.alive[i];
      const v = { phase: st.phase, alive, role: r, roleName: me.name, icon: me.icon, text: me.text, team: TEAM[me.team], tier: TIERS[me.tier], notes: st.notes[i],
        day: st.day, night: st.night, mayor: st.mayor, accused: st.accused,
        players: players(ctx).map(k => { const s = shownRole(ctx, i, k); return { i: k, name: nm(ctx, k), alive: st.alive[k], role: s && label(s), cleaned: st.revealed[k] === 'cleaned', mayor: st.mayor === k, me: k === i }; }),
        inGame: st.inGame.map(label), uses: st.uses[i] };
      v.title = { deal: 'Your secret role', night: `🌙 Night ${st.night}`, dawn: '🌅 Dawn', day: `☀️ Day ${st.day}`, nominate: '☀️ Nominations', defense: '⚖️ The trial', verdict: '🗳️ Verdict', acquitted: '⚖️ Not guilty', executed: '⚖️ Guilty' }[st.phase];
      if (isMafia(r)) v.family = players(ctx).filter(k => isMafia(st.roles[k])).map(k => ({ name: nm(ctx, k), role: label(st.roles[k]), alive: st.alive[k], me: k === i, leader: k === leader(ctx) }));
      if (r === 'executioner') v.execTarget = nm(ctx, st.exec[i]);
      if (st.lastVerdict && ['acquitted', 'executed', 'nominate', 'dawn'].includes(st.phase)) v.lastVerdict = { name: nm(ctx, st.lastVerdict.t), guilty: st.lastVerdict.guilty, innocent: st.lastVerdict.innocent, votes: st.lastVerdict.votes.map(([k, x]) => [nm(ctx, k), x]) };
      if (!alive) { v.live = st.phase === 'night' ? liveNight(ctx) : null; return v; }
      if (st.phase === 'night') {
        const a = st.acts[i] || {}, meet = st.night === 1 && ctx.opts.firstNight === 'meet';
        v.done = st.done.has(i); v.doneCount = st.done.size; v.total = living(ctx).length;
        v.others = living(ctx).filter(k => k !== i).map(k => ({ i: k, name: nm(ctx, k) }));
        v.kind = me.act === 'medium' && (st.night === 1 || !st.uses[i].looks) ? 'hunch' : me.act;
        if (isMafia(r)) {
          v.meet = meet;
          v.victims = living(ctx).filter(k => !isMafia(st.roles[k])).map(k => ({ i: k, name: nm(ctx, k), by: living(ctx).filter(x => isMafia(st.roles[x]) && st.picks[x] === k).map(x => nm(ctx, x)) }));
          v.myPick = st.picks[i] ?? null; v.mode = ctx.opts.killMode || 'vote'; v.lead = leader(ctx) === i;
        }
        v.target = a.t ?? null; v.alert = !!a.alert; v.vest = !!a.vest; v.clean = !!a.clean; v.dead = a.dead ?? null; v.hunch = st.hunch[i] ?? null;
        if (v.kind === 'medium') v.graves = players(ctx).filter(k => !st.alive[k]).map(k => ({ i: k, name: nm(ctx, k) }));
        if (r === 'vigilante') v.noShoot = st.night === 1 || !st.uses[i].shots;
        if (r === 'doctor') v.blockedT = [st.mayor, ctx.opts.docRepeat !== 'yes' ? st.docLast[i] : null, st.uses[i].selfSaves > 0 ? null : i].filter(x => x != null);
      }
      if (st.phase === 'day') { v.ready = st.ready.has(i); v.readyCount = st.ready.size; v.total = living(ctx).length; }
      if (st.phase === 'day' || st.phase === 'nominate' || st.phase === 'defense') v.canMayor = r === 'mayor' && st.mayor == null;
      if (st.phase === 'nominate') {
        v.need = need(ctx); v.myNom = st.noms[i] ?? null;
        v.noms = living(ctx).filter(k => k !== i).map(k => ({ i: k, name: nm(ctx, k), votes: Object.entries(st.noms).filter(([, x]) => x === k).reduce((a, [x]) => a + weightOf(ctx, +x), 0) }));
      }
      if (st.phase === 'verdict') { v.myVerdict = st.verdict[i] || null; v.isAccused = i === st.accused; v.accusedName = nm(ctx, st.accused); }
      if (st.phase === 'defense') v.accusedName = nm(ctx, st.accused);
      return v;
    },
    hostHTML(ctx, H) {
      const st = ctx.state;
      const tally = st.phase === 'nominate' ? Object.entries(st.noms).reduce((a, [k, t]) => { if (t != null) a[t] = (a[t] || 0) + weightOf(ctx, +k); return a; }, {}) : {};
      const tiles = players(ctx).map(k => {
        const rv = st.revealed[k], dead = !st.alive[k];
        const shown = dead ? (rv === 'cleaned' ? '🧹 Cleaned' : rv ? label(rv) : '❔ Unknown') : st.mayor === k ? label('mayor') : '';
        return `<div class="mf-tile${dead ? ' dead' : ''}${st.accused === k && ['defense', 'verdict'].includes(st.phase) ? ' accused' : ''}" style="--pc:${ctx.players[k].color}">
          <i></i><b>${H.esc(nm(ctx, k))}</b><span>${dead ? '💀 ' : ''}${shown}</span>${tally[k] ? `<em>${tally[k]}</em>` : ''}</div>`;
      }).join('');
      const verdict = st.lastVerdict && ['acquitted', 'executed', 'nominate', 'dawn'].includes(st.phase)
        ? `<div class="sec-title">Last verdict: ${H.esc(nm(ctx, st.lastVerdict.t))}, ${st.lastVerdict.guilty} guilty · ${st.lastVerdict.innocent} innocent</div>
           <div class="pills">${st.lastVerdict.votes.map(([k, x]) => `<span class="p mf-v ${x}">${H.esc(nm(ctx, k))}: ${{ g: 'Guilty', i: 'Innocent', a: 'Abstain' }[x]}</span>`).join('')}</div>` : '';
      const roles = `<div class="sec-title">Roles in this game (${st.mafiaCount} mafia)</div><div class="pills">${st.inGame.map(r => `<span class="p">${label(r)}${st.start.filter(x => x === r).length > 1 ? ` ×${st.start.filter(x => x === r).length}` : ''}</span>`).join('')}</div>`;
      const sky = (cls, big, line, extra = '') => `<div class="mf-sky ${cls}"><div class="mf-big">${big}</div><div class="big-line">${line}</div>${extra}</div>`;
      const btn = (host, text) => `<div style="text-align:center;margin-top:10px"><button class="btn primary" type="button" data-host="${host}">${text}</button></div>`;
      const accused = st.accused != null ? H.esc(nm(ctx, st.accused)) : '';
      const top = {
        deal: () => sky('night', '🎩', 'Look at your secret role on your phone. Keep it to yourself.'),
        night: () => sky('night', '🌙', 'Heads down. Everyone is choosing on their phone…', `<div class="note" style="text-align:center">${st.done.size} of ${living(ctx).length} done</div>${btn('dawn', 'End the night now')}`),
        dawn: () => sky('dawn', '🌅', 'Dawn over the city.'),
        day: () => sky('day', '☀️', 'Who is in the family? Discuss!', `<div class="note" style="text-align:center">Ready to vote: ${st.ready.size} of ${living(ctx).length}</div>${btn('vote', 'Start the nominations now')}`),
        nominate: () => sky('day', '👉', `Nominate on your phone: ${need(ctx)} votes put someone on trial.`),
        defense: () => sky('trial', '⚖️', `${accused}, plead your case!`, btn('verdict', 'Go to the verdict now')),
        verdict: () => sky('trial', '🗳️', `${accused}: guilty or innocent?`, `<div class="note" style="text-align:center">${Object.keys(st.verdict).length} of ${living(ctx).length - 1} votes in</div>`),
        acquitted: () => sky('day', '🕊️', `${accused} is not guilty.`),
        executed: () => sky('trial', '🚪', `${accused} is run out of town.`),
      }[st.phase]?.() || '';
      return `${top}<div class="mf-tiles">${tiles}</div>${verdict}${roles}`;
    },
    phoneNotify: (b, v) => v && b && b.phase !== v.phase && ['nominate', 'verdict', 'dawn'].includes(v.phase),
    phoneLocal(d, v, local) { if (d.local === 'flip') local.shown = !local.shown; },
    phoneHTML(v, local, H) {
      if (local.phase !== v.phase) { local.phase = v.phase; local.shown = false; }   // the card closes by itself at every new phase
      const card = `<button type="button" class="mf-card${local.shown ? '' : ' hidden'}" data-local="flip">
          <span class="ic">${local.shown ? v.icon : '🂠'}</span><b>${local.shown ? v.roleName : 'Tap to see your role'}</b>${local.shown ? `<small>${H.esc(v.text)}</small><em class="mf-tier">${v.team} · ${v.tier}</em>` : ''}</button>`;
      const notes = v.notes.length ? `<div class="sec-title">Your notebook</div><div class="mf-notes">${v.notes.map(t => `<div>${H.esc(t)}</div>`).join('')}</div>` : '';
      const family = v.family && local.shown ? `<div class="sec-title">The family</div><div class="pills">${v.family.map(f => `<span class="p">${f.alive ? '' : '💀 '}${H.esc(f.name)}${f.me ? ' (you)' : ''}: ${f.role}${f.leader ? ' · leader' : ''}</span>`).join('')}</div>` : '';
      const target = v.execTarget && local.shown ? `<p class="note">⚖️ Your target: <b>${H.esc(v.execTarget)}</b></p>` : '';
      const people = `<div class="sec-title">The town</div><div class="mf-people">${v.players.map(p => `<span class="${p.alive ? '' : 'dead'}${p.me ? ' me' : ''}">${p.alive ? '' : '💀 '}${H.esc(p.name)}${p.role ? ` · ${p.role}` : p.cleaned ? ' · 🧹' : ''}${p.mayor ? ' 🏛️' : ''}</span>`).join('')}</div>`;
      const pick = (act, list, on, extra = '') => `<div class="choice">${list.map(p => `<button type="button" data-act="${act}" data-p="${p.i}" ${extra}class="${on === p.i ? 'on' : ''}"${p.off ? ' disabled' : ''}>${H.esc(p.name)}${p.by?.length ? ` <small>(${p.by.map(H.esc).join(', ')})</small>` : ''}</button>`).join('')}</div>`;
      const verdictBox = v.lastVerdict ? `<div class="sec-title">Verdict on ${H.esc(v.lastVerdict.name)}: ${v.lastVerdict.guilty} guilty · ${v.lastVerdict.innocent} innocent</div><div class="pills">${v.lastVerdict.votes.map(([n, x]) => `<span class="p mf-v ${x}">${H.esc(n)}: ${{ g: 'Guilty', i: 'Innocent', a: 'Abstain' }[x]}</span>`).join('')}</div>` : '';
      if (!v.alive) {
        return `<div class="mf-ghost">👻 <b>You are out of the game</b><small>Watch everything, but stay silent!</small></div>${verdictBox}
          ${v.live ? `<div class="sec-title">Tonight, as it happens</div><div class="mf-notes">${v.live.map(t => `<div>${H.esc(t)}</div>`).join('')}</div>` : ''}${people}`;
      }
      const mayorBtn = v.canMayor ? '<button class="go" type="button" data-act="mayor">🏛️ Reveal as Mayor</button>' : '';
      if (v.phase === 'deal') return `<p class="note">Tap to peek at your role, then tap again to hide it.</p>${card}${family}${target}${notes}`;
      if (v.phase === 'night') {
        let ui = '';
        const k = v.kind;
        if (v.family) {
          ui += v.meet ? '<p class="note">Tonight the family only meets: no hit.</p>'
            : `<div class="sec-title">The family's hit${v.mode === 'leader' ? (v.lead ? ' (you decide)' : ' (the leader decides; suggest)') : v.mode === 'unanimous' ? ' (all must agree)' : ' (majority; the leader breaks ties)'}</div>${pick('kill', v.victims, v.myPick)}`;
        }
        const others = v.others.map(p => ({ ...p, off: false }));
        if (k === 'target') {
          const what = { detective: 'Investigate', doctor: 'Protect', escort: 'Keep busy', consort: 'Keep busy', bodyguard: 'Guard', vigilante: 'Shoot', framer: 'Frame', consigliere: 'Learn the role of', lookout: 'Watch', tracker: 'Follow', serialkiller: 'Kill' }[v.role];
          const list = v.role === 'doctor' ? [{ i: v.players.find(p => p.me).i, name: 'Yourself' }, ...others] : others;
          if (v.role === 'doctor') list.forEach(p => { p.off = v.blockedT.includes(p.i); });
          ui += v.role === 'vigilante' && v.noShoot ? `<p class="note">${v.night === 1 ? 'No shooting on the first night.' : 'No bullets left.'}</p>`
            : `<div class="sec-title">${what}${v.role === 'vigilante' ? ` (${v.uses.shots} left)` : ''}</div>${pick('act', list, v.target)}<div class="choice"><button type="button" data-act="act" data-p="none" class="${v.target == null ? 'on' : ''}">✋ Nobody</button></div>`;
        }
        if (v.role === 'janitor') ui += `<div class="choice"><button type="button" data-act="clean" data-on="${v.clean ? '0' : '1'}" class="${v.clean ? 'on' : ''}"${!v.uses.cleans && !v.clean ? ' disabled' : ''}>🧹 Clean up after tonight's hit (${v.uses.cleans} left)</button></div>`;
        if (k === 'alert') ui += `<div class="choice"><button type="button" data-act="alert" data-on="1" class="${v.alert ? 'on' : ''}"${v.uses.alerts ? '' : ' disabled'}>🎖️ On alert (${v.uses.alerts} left)</button><button type="button" data-act="alert" data-on="0" class="${v.alert ? '' : 'on'}">😴 Rest</button></div>`;
        if (k === 'vest') ui += `<div class="choice"><button type="button" data-act="vest" data-on="1" class="${v.vest ? 'on' : ''}"${v.uses.vests ? '' : ' disabled'}>🦺 Wear a vest (${v.uses.vests} left)</button><button type="button" data-act="vest" data-on="0" class="${v.vest ? '' : 'on'}">No vest</button></div>`;
        if (k === 'medium') ui += v.graves.length ? `<div class="sec-title">Ask the spirits about (once a game)</div>${pick('medium', v.graves, v.dead)}<div class="choice"><button type="button" data-act="medium" data-p="none" class="${v.dead == null ? 'on' : ''}">✋ Not tonight</button></div>` : '<p class="note">Nobody has died yet.</p>';
        if (k === 'hunch' || k === 'alert' || k === 'vest' || (k === 'medium' && !v.graves.length)) ui += `<div class="sec-title">Your hunch: who do you suspect?</div>${pick('hunch', others, v.hunch)}`;
        return `${card}${ui}<button class="go${v.done ? ' red' : ''}" type="button" data-act="done">${v.done ? 'Not done yet' : 'Done'}</button><p class="note">${v.doneCount} of ${v.total} done</p>${family}${notes}`;
      }
      if (v.phase === 'nominate') return `<div class="sec-title">Nominate a suspect (${v.need} votes put them on trial)</div>
        <div class="choice">${v.noms.map(p => `<button type="button" data-act="nominate" data-p="${p.i}" class="${v.myNom === p.i ? 'on' : ''}">${H.esc(p.name)}${p.votes ? ` <small>(${p.votes})</small>` : ''}</button>`).join('')}</div>
        <div class="choice"><button type="button" data-act="nominate" data-p="none" class="${v.myNom == null ? 'on' : ''}">✋ Nobody</button></div>${mayorBtn}${verdictBox}${notes}`;
      if (v.phase === 'defense') return `<div class="mf-sky trial"><div class="mf-big">⚖️</div><div class="big-line">${H.esc(v.accusedName)} pleads their case</div></div>${mayorBtn}${notes}`;
      if (v.phase === 'verdict') return v.isAccused ? '<div class="mf-sky trial"><div class="mf-big">⚖️</div><div class="big-line">The town is deciding your fate…</div></div>'
        : `<div class="sec-title">${H.esc(v.accusedName)}: guilty or innocent?</div><div class="choice mf-verdict">${[['g', '👎 Guilty'], ['i', '👍 Innocent'], ['a', '🤐 Abstain']].map(([x, t]) => `<button type="button" data-act="verdict" data-v="${x}" class="${v.myVerdict === x ? 'on' : ''}">${t}</button>`).join('')}</div>
          <p class="note">${v.myVerdict ? 'Vote saved. You can change it until time runs out.' : 'Your vote is shown to everyone afterwards.'}</p>`;
      const day = v.phase === 'day' ? `<button class="go${v.ready ? ' red' : ''}" type="button" data-act="ready">${v.ready ? 'Not ready yet' : 'Ready to vote'}</button><p class="note">${v.readyCount} of ${v.total} ready</p>` : '';
      return `${card}${day}${mayorBtn}${verdictBox}${family}${target}${notes}${people}<div class="sec-title">Roles in this game</div><div class="pills">${v.inGame.map(r => `<span class="p">${r}</span>`).join('')}</div>`;
    },
    css: `
      .mf-card { display: grid; justify-items: center; gap: 6px; width: 100%; padding: 22px 14px; border-radius: 16px; border: 2px solid #c9a227;
        background: linear-gradient(#26222b, #0d0b10); color: #f4ead2; font: inherit; cursor: pointer; text-align: center; box-shadow: inset 0 0 40px rgba(201,162,39,.12); }
      .mf-card .ic { font-size: 3.4rem; } .mf-card b { font-size: 1.4rem; font-family: Georgia, serif; } .mf-card small { color: #d8cfb8; line-height: 1.4; }
      .mf-card .mf-tier { font-style: normal; font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; color: #c9a227; }
      .mf-notes { display: grid; gap: 6px; } .mf-notes div { background: rgba(0,0,0,.35); border-left: 3px solid #c9a227; padding: 8px 10px; border-radius: 6px; }
      .mf-ghost { display: grid; justify-items: center; gap: 4px; padding: 24px 10px; font-size: 2.4rem; text-align: center; }
      .mf-ghost b { font-size: 1.2rem; } .mf-ghost small { font-size: .9rem; color: var(--muted, #b9c4bc); }
      .mf-people { display: flex; flex-wrap: wrap; gap: 6px; } .mf-people span { padding: 3px 9px; border-radius: 99px; background: rgba(0,0,0,.3); font-size: .82rem; }
      .mf-people .dead { opacity: .55; text-decoration: line-through; } .mf-people .me { outline: 1px solid #c9a227; }
      .mf-sky { border-radius: 16px; padding: 18px; text-align: center; margin-bottom: 14px; }
      .mf-sky.night { background: radial-gradient(circle at 50% 15%, #3a3350, #0b0a12 70%); }
      .mf-sky.dawn { background: radial-gradient(circle at 50% 100%, rgba(240,140,70,.45), #15121c 70%); }
      .mf-sky.day { background: radial-gradient(circle at 50% 20%, rgba(201,162,39,.32), rgba(0,0,0,.25) 70%); }
      .mf-sky.trial { background: radial-gradient(circle at 50% 30%, rgba(180,40,40,.4), #120b0b 75%); }
      .mf-big { font-size: 4.4rem; line-height: 1.1; }
      .mf-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 8px; }
      .mf-tile { position: relative; display: grid; gap: 2px; padding: 10px 12px; border-radius: 12px; background: rgba(0,0,0,.35); border-left: 5px solid var(--pc); }
      .mf-tile i { display: none; } .mf-tile b { font-size: 1.05rem; } .mf-tile span { font-size: .82rem; color: #d8cfb8; min-height: 1.1em; }
      .mf-tile.dead { opacity: .5; } .mf-tile.accused { outline: 3px solid #e0565c; box-shadow: 0 0 22px rgba(224,86,92,.55); }
      .mf-tile em { position: absolute; top: 8px; right: 10px; font-style: normal; font-weight: 900; background: #c9a227; color: #1b1500; border-radius: 99px; padding: 1px 9px; }
      .mf-v.g { background: rgba(224,86,92,.35); } .mf-v.i { background: rgba(80,180,110,.35); }
      .mf-verdict button { flex: 1; font-size: 1.05rem; }
      .mf-head { font-family: Georgia, serif; font-size: 1.6rem; color: #c9a227; text-align: center; margin-bottom: 10px; }
      .mf-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: .9rem; }
      .mf-table th, .mf-table td { text-align: left; padding: 6px; border-bottom: 1px solid rgba(255,255,255,.12); }
      .mf-table th { color: #c9a227; font-size: .72rem; text-transform: uppercase; }
      .mf-meter { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
      .mf-bar { position: relative; width: 160px; height: 10px; border-radius: 99px; background: linear-gradient(90deg, #b3262d, #c9a227 50%, #2f8f4e); }
      .mf-bar::after { content: ''; position: absolute; top: -4px; left: calc(50% + var(--b) * 4px - 3px); width: 6px; height: 18px; border-radius: 3px; background: #fff; box-shadow: 0 0 4px #000; }
      .mf-left { color: #ffb4a8; }`,
  };
})();
