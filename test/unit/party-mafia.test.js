// Mafia rules (public/games/party/mafia.js; docs/2026-10-mafia.md)
const test = require('node:test');
const { describe } = test;
const assert = require('node:assert/strict');
const { loadScripts, plain, partyCtx, flush } = require('./helpers');

const load = () => loadScripts(['games/party/common.js', 'games/party/mafia.js']).PARTY_GAME;
// A game dealt with exactly these roles (player k gets roles[k]), at the start of night 2 unless told otherwise
function game(roles, opts = {}) {
  const G = load(), ctx = partyCtx(roles.length, { opts: { reveal: 'reveal', ...opts } }), T = G._test;
  const st = T.deal(ctx, roles.slice());
  return { G, ctx, st, T };
}
function atNight(g, night = 2) {
  Object.assign(g.st, { phase: 'night', night, acts: {}, picks: {}, hunch: {}, done: new Set() });
  return g;
}
const act = (g, i, m) => g.G.act(g.ctx, i, m);
const notes = (g, i) => g.st.notes[i].join(' ');
const dead = deaths => plain(deaths).map(([k]) => k).sort();

/* ---------------- Setup ---------------- */
describe('Setup', () => {
  test('mafia count: about one in four, at least one, always fewer than half', () => {
    const { suggestMafia, maxMafia, mafiaCount } = load()._test;
    assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(suggestMafia), [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4]);
    assert.equal(maxMafia(4), 1); assert.equal(maxMafia(7), 3); assert.equal(maxMafia(16), 7);
    assert.equal(mafiaCount(10, 'auto'), 3);
    assert.equal(mafiaCount(12, 5), 5, 'the host may choose');
    assert.equal(mafiaCount(5, 4), 2, 'but never half the players or more');
  });

  test('roles: the mafia (specials first), the neutrals, the town specials, then Villagers', () => {
    const { buildRoles } = load()._test;
    for (let n = 4; n <= 16; n++) {
      const all = ['detective', 'doctor', 'escort', 'bodyguard', 'vigilante', 'mason', 'mayor', 'lookout', 'tracker', 'veteran', 'godfather', 'consort', 'framer', 'janitor', 'consigliere', 'jester', 'survivor', 'executioner', 'serialkiller'];
      const { roles, mafia } = buildRoles(n, all, { mafia: 'auto' });
      assert.equal(roles.length, n, `${n} players`);
      assert.equal(roles.filter(r => ['mafioso', 'godfather', 'consort', 'framer', 'janitor', 'consigliere'].includes(r)).length, mafia);
      assert.ok(roles.filter(r => ['jester', 'survivor', 'executioner', 'serialkiller'].includes(r)).length <= Math.floor(n / 5), 'neutrals: at most n/5');
      assert.ok([0, 2].includes(roles.filter(r => r === 'mason').length), 'Masons come in pairs');
    }
    assert.deepEqual(plain(buildRoles(6, ['detective', 'doctor'], {}).roles), ['mafioso', 'mafioso', 'detective', 'doctor', 'villager', 'villager']);
    assert.deepEqual(plain(buildRoles(8, ['godfather'], {}).roles.slice(0, 2)), ['godfather', 'mafioso'], 'a mafia special takes a Mafioso\'s place');
  });

  test('roles that can\'t be used are left out, with the reason', () => {
    const { buildRoles } = load()._test;
    const why = (n, picked, o = {}) => Object.fromEntries(plain(buildRoles(n, picked, o).left));
    assert.match(why(6, ['mason']).mason, /7 players/);
    assert.ok(!why(7, ['mason']).mason);
    assert.match(why(8, ['medium']).medium, /hidden/, 'the Medium only when roles are hidden');
    assert.ok(!why(8, ['medium'], { reveal: 'hidden' }).medium);
    assert.match(why(8, ['janitor'], { reveal: 'hidden' }).janitor, /revealed/, 'the Janitor only when roles are revealed');
    assert.match(why(4, ['jester']).jester, /5 players/);
    assert.match(why(9, ['jester', 'survivor']).survivor, /at most 1 neutral/);
    assert.match(why(4, ['godfather', 'consort']).consort, /only 1 mafia/);
    assert.match(why(4, ['detective', 'doctor', 'escort', 'bodyguard']).bodyguard, /no place left/, 'the most advanced town roles go first');
  });

  test('balance meter: the roles\' weights add up; near 0 is even', () => {
    const { buildRoles, balance, balanceText } = load()._test;
    assert.equal(balance(plain(buildRoles(6, ['detective', 'doctor'], {}).roles)), 2);
    assert.equal(balanceText(2), 'Balanced');
    assert.equal(balanceText(7), 'Town favoured');
    assert.equal(balanceText(-9), 'Mafia favoured');
  });

  test('the family\'s kill: a majority, the leader breaks a tie, the Godfather leads', () => {
    const g = atNight(game(['godfather', 'mafioso', 'mafioso', 'villager', 'villager', 'villager', 'villager']));
    act(g, 0, { act: 'kill', p: 3 }); act(g, 1, { act: 'kill', p: 4 }); act(g, 2, { act: 'kill', p: 4 });
    assert.equal(g.T.mafiaKill(g.ctx, new Set()).t, 4, 'two votes beat the Godfather\'s one');
    act(g, 2, { act: 'kill', p: 3 });
    act(g, 1, { act: 'kill', p: 5 });
    assert.equal(g.T.mafiaKill(g.ctx, new Set()).t, 3);
    act(g, 2, { act: 'kill', p: 4 });
    for (let k = 0; k < 5; k++) assert.equal(g.T.mafiaKill(g.ctx, new Set()).t, 3, 'a three-way tie goes to the leader\'s pick');
    assert.match(act(g, 0, { act: 'kill', p: 1 }), /outside the family/);
    assert.match(act(g, 3, { act: 'kill', p: 1 }), /Not your job/);
  });

  test('the family\'s kill: unanimous, the leader decides, the first night "only meet"', () => {
    let g = atNight(game(['mafioso', 'mafioso', 'villager', 'villager', 'villager'], { killMode: 'unanimous' }));
    act(g, 0, { act: 'kill', p: 2 }); act(g, 1, { act: 'kill', p: 3 });
    assert.equal(g.T.mafiaKill(g.ctx, new Set()), null, 'not unanimous: no kill');
    act(g, 1, { act: 'kill', p: 2 });
    assert.equal(g.T.mafiaKill(g.ctx, new Set()).t, 2);
    g = atNight(game(['mafioso', 'godfather', 'villager', 'villager', 'villager'], { killMode: 'leader' }));
    act(g, 0, { act: 'kill', p: 2 }); act(g, 1, { act: 'kill', p: 3 });
    const hit = g.T.mafiaKill(g.ctx, new Set());
    assert.deepEqual([hit.t, hit.carrier], [3, 1], 'the Godfather decides and carries it out');
    assert.equal(g.T.mafiaKill(g.ctx, new Set([1])).carrier, 0, 'a blocked leader: another family member does it');
    g = atNight(game(['mafioso', 'villager', 'villager', 'villager'], { firstNight: 'meet' }), 1);
    assert.match(act(g, 0, { act: 'kill', p: 2 }), /only meets/);
    assert.equal(g.T.mafiaKill(g.ctx, new Set()), null);
  });
});

/* ---------------- Nights ---------------- */
describe('Nights', () => {
  test('night: the hit lands; the Doctor saves; a blocked Doctor doesn\'t', () => {
    let g = atNight(game(['mafioso', 'doctor', 'villager', 'villager', 'villager']));
    act(g, 0, { act: 'kill', p: 2 });
    assert.deepEqual(dead(g.T.resolveNight(g.ctx)), [2]);
    g = atNight(game(['mafioso', 'doctor', 'villager', 'villager', 'villager']));
    act(g, 0, { act: 'kill', p: 2 }); act(g, 1, { act: 'act', p: 2 });
    assert.deepEqual(dead(g.T.resolveNight(g.ctx)), []);
    assert.match(notes(g, 2), /attacked tonight, but someone saved you/);
    assert.match(notes(g, 1), /Cy was attacked tonight, and you saved them/);
    assert.match(notes(g, 0), /Cy survived the family's hit/);
    g = atNight(game(['mafioso', 'consort', 'doctor', 'villager', 'villager', 'villager', 'villager']));
    act(g, 0, { act: 'kill', p: 3 }); act(g, 1, { act: 'kill', p: 3 }); act(g, 1, { act: 'act', p: 2 }); act(g, 2, { act: 'act', p: 3 });
    assert.deepEqual(dead(g.T.resolveNight(g.ctx)), [3], 'the Consort kept the Doctor busy');
    assert.match(notes(g, 2), /kept you busy/);
  });

  test('night: blocking the family\'s only killer stops the hit', () => {
    const g = atNight(game(['mafioso', 'escort', 'villager', 'villager', 'villager']));
    act(g, 0, { act: 'kill', p: 2 }); act(g, 1, { act: 'act', p: 0 });
    assert.deepEqual(dead(g.T.resolveNight(g.ctx)), []);
    assert.match(notes(g, 0), /never happened/);
  });

  test('night: the Bodyguard dies instead, and takes the attacker', () => {
    const g = atNight(game(['mafioso', 'mafioso', 'bodyguard', 'villager', 'villager', 'villager', 'villager']));
    act(g, 0, { act: 'kill', p: 3 }); act(g, 1, { act: 'kill', p: 3 }); act(g, 2, { act: 'act', p: 3 });
    const d = dead(g.T.resolveNight(g.ctx));
    assert.equal(d.length, 2);
    assert.ok(d.includes(2), 'the Bodyguard died');
    assert.ok(d.includes(0) || d.includes(1), 'and so did whoever carried out the hit');
    assert.ok(!d.includes(3));
  });

  test('night: a Veteran on alert can\'t be killed and shoots every visitor, even the Doctor', () => {
    const g = atNight(game(['mafioso', 'veteran', 'doctor', 'villager', 'villager']));
    act(g, 0, { act: 'kill', p: 1 }); act(g, 1, { act: 'alert', on: '1' }); act(g, 2, { act: 'act', p: 1 });
    assert.deepEqual(dead(g.T.resolveNight(g.ctx)), [0, 2]);
    assert.equal(g.st.uses[1].alerts, 1);
    assert.match(notes(g, 1), /you were ready/);
  });

  test('night: the Serial Killer can\'t be blocked, and kills whoever tries', () => {
    const g = atNight(game(['mafioso', 'serialkiller', 'escort', 'villager', 'villager', 'villager']));
    act(g, 1, { act: 'act', p: 3 }); act(g, 2, { act: 'act', p: 1 });
    assert.deepEqual(dead(g.T.resolveNight(g.ctx)), [2]);
  });

  test('night: the Detective sees Suspicious / Not suspicious; the Godfather passes, a framed player doesn\'t', () => {
    const g = atNight(game(['godfather', 'framer', 'detective', 'villager', 'villager', 'serialkiller', 'villager', 'villager', 'villager', 'villager']));
    act(g, 2, { act: 'act', p: 0 });
    g.T.resolveNight(g.ctx);
    assert.match(notes(g, 2), /Ana is 🟢 Not suspicious/);
    atNight(g, 3); act(g, 2, { act: 'act', p: 1 }); g.T.resolveNight(g.ctx);
    assert.match(notes(g, 2), /Bob is 🔴 Suspicious/);
    atNight(g, 4); act(g, 1, { act: 'act', p: 3 }); act(g, 2, { act: 'act', p: 3 }); g.T.resolveNight(g.ctx);
    assert.match(notes(g, 2), /Dee is 🔴 Suspicious/, 'framed');
    atNight(g, 5); act(g, 2, { act: 'act', p: 5 }); g.T.resolveNight(g.ctx);
    assert.match(notes(g, 2), /Fay is 🔴 Suspicious/, 'the Serial Killer');
  });

  test('night: the Consigliere learns the exact role; the Lookout and the Tracker see visits', () => {
    const g = atNight(game(['mafioso', 'consigliere', 'lookout', 'tracker', 'doctor', 'villager', 'villager']));
    act(g, 0, { act: 'kill', p: 5 }); act(g, 1, { act: 'kill', p: 5 });
    act(g, 1, { act: 'act', p: 4 }); act(g, 2, { act: 'act', p: 5 }); act(g, 3, { act: 'act', p: 4 }); act(g, 4, { act: 'act', p: 6 });
    g.T.resolveNight(g.ctx);
    assert.match(notes(g, 1), /Eli is the 🩺 Doctor/);
    assert.match(notes(g, 2), /(Ana|Bob) visited Fay tonight/, 'whoever carried out the hit');
    assert.match(notes(g, 3), /Eli visited Gus tonight/);
    atNight(g, 3); act(g, 3, { act: 'act', p: 6 }); g.T.resolveNight(g.ctx);
    assert.match(notes(g, 3), /Gus stayed home/);
  });

  test('night: the Janitor hides the victim\'s role from the town (not from himself), a limited number of times', () => {
    const g = atNight(game(['mafioso', 'janitor', 'villager', 'doctor', 'villager', 'villager', 'villager'], { cleans: 1 }));
    act(g, 0, { act: 'kill', p: 3 }); act(g, 1, { act: 'kill', p: 3 }); act(g, 1, { act: 'clean', on: '1' });
    const deaths = g.T.resolveNight(g.ctx);
    assert.equal(g.st.cleaned[3], true);
    assert.match(notes(g, 1), /Dee: they were the 🩺 Doctor/);
    g.st.phase = 'dawn';
    plain(deaths).forEach(([k]) => { g.st.alive[k] = false; });
    assert.equal(g.T.shownRole(g.ctx, 2, 3), null, 'hidden from the town');
    assert.match(act(atNight(g, 3), 1, { act: 'clean', on: '1' }), /No cleanings left/);
  });

  test('night: Vigilante (not on night 1; guilt for shooting the town), Survivor\'s vest, Executioner, Medium', () => {
    let g = atNight(game(['mafioso', 'vigilante', 'villager', 'villager', 'villager', 'villager']), 1);
    assert.match(act(g, 1, { act: 'act', p: 2 }), /first night/);
    atNight(g, 2); act(g, 1, { act: 'act', p: 2 });
    assert.deepEqual(dead(g.T.resolveNight(g.ctx)), [2]);
    g.st.alive[2] = false;
    assert.deepEqual(plain(g.st.guilt), [1]);
    atNight(g, 3);
    assert.deepEqual(dead(g.T.resolveNight(g.ctx)), [1], 'dies of guilt the next night');
    g = atNight(game(['mafioso', 'survivor', 'villager', 'villager', 'villager']));
    act(g, 0, { act: 'kill', p: 1 }); act(g, 1, { act: 'vest', on: '1' });
    assert.deepEqual(dead(g.T.resolveNight(g.ctx)), []);
    assert.match(notes(g, 1), /vest saved you/);
    g = atNight(game(['mafioso', 'executioner', 'villager', 'villager', 'villager']));
    const target = g.st.exec[1];
    assert.ok([2, 3, 4].includes(target));
    act(g, 0, { act: 'kill', p: target });
    g.T.resolveNight(g.ctx);
    assert.equal(g.st.roles[1], 'jester', 'the target died at night: a Jester now');
    g = atNight(game(['mafioso', 'medium', 'villager', 'doctor', 'villager', 'villager'], { reveal: 'hidden' }));
    g.st.alive[3] = false;
    assert.match(act(g, 1, { act: 'medium', p: 2 }), /has died/);
    act(g, 1, { act: 'medium', p: 3 });
    g.T.resolveNight(g.ctx);
    assert.match(notes(g, 1), /Dee was the 🩺 Doctor/);
    assert.match(act(atNight(g, 3), 1, { act: 'medium', p: 3 }), /Not tonight/, 'once a game');
  });

  test('the Doctor\'s rules: saving yourself (once / never / any time), not the same player twice running', () => {
    let g = atNight(game(['mafioso', 'doctor', 'villager', 'villager', 'villager']));
    assert.equal(act(g, 1, { act: 'act', p: 1 }), undefined);
    g.T.resolveNight(g.ctx);
    assert.match(act(atNight(g, 3), 1, { act: 'act', p: 1 }), /already saved yourself/);
    assert.equal(act(g, 1, { act: 'act', p: 2 }), undefined, 'protecting someone else is fine');
    g = atNight(game(['mafioso', 'doctor', 'villager', 'villager', 'villager'], { docSelf: 'never' }));
    assert.match(act(g, 1, { act: 'act', p: 1 }), /can't protect yourself/);
    g = atNight(game(['mafioso', 'doctor', 'villager', 'villager', 'villager'], { docSelf: 'any' }));
    act(g, 1, { act: 'act', p: 1 }); g.T.resolveNight(g.ctx);
    act(atNight(g, 3), 1, { act: 'act', p: 2 }); g.T.resolveNight(g.ctx);
    assert.equal(act(atNight(g, 4), 1, { act: 'act', p: 1 }), undefined, 'any time');
    g = atNight(game(['mafioso', 'doctor', 'villager', 'villager', 'villager']));
    act(g, 1, { act: 'act', p: 2 }); g.T.resolveNight(g.ctx);
    assert.match(act(atNight(g, 3), 1, { act: 'act', p: 2 }), /two nights running/);
    g = atNight(game(['mafioso', 'doctor', 'villager', 'villager', 'villager'], { docRepeat: 'yes' }));
    act(g, 1, { act: 'act', p: 2 }); g.T.resolveNight(g.ctx);
    assert.equal(act(atNight(g, 3), 1, { act: 'act', p: 2 }), undefined);
  });
});

/* ---------------- Winning, days and trials ---------------- */

// Plays a whole game through the real loop (countdowns resolved by hand)
async function playGame(roles, opts, script) {
  const G = load(), ctx = partyCtx(roles.length, { opts: { reveal: 'reveal', ...opts }, shuffle: a => a });
  ctx.opts.roles = opts.roles || [];
  const done = G.start(ctx);
  await flush();
  assert.deepEqual(plain(ctx.state.roles), roles, 'the roles this test is written for');
  return { G, ctx, done, step: async fn => { fn && fn(); await flush(); } };
}
describe('Winning, days and trials', () => {
  test('winning: the town, the mafia at parity, the Serial Killer, draws', () => {
    const g = game(['mafioso', 'mafioso', 'villager', 'villager', 'villager', 'serialkiller']);
    const w = alive => { g.st.alive = alive; return g.T.checkWin(g.ctx); };
    assert.equal(w([true, true, true, true, true, true]), null);
    assert.equal(w([false, false, true, true, true, false]), 'town');
    assert.equal(w([true, true, true, true, false, false]), 'mafia', 'mafia equal the rest');
    assert.equal(w([true, true, true, true, false, true]), null, 'not while the Serial Killer lives');
    assert.equal(w([false, false, true, false, false, true]), 'serialkiller', 'one on one with the Serial Killer');
    assert.equal(w([false, false, false, false, false, false]), 'draw');
    g.st.alive = [true, true, true, true, true, true]; g.st.quiet = 3;
    assert.equal(g.T.checkWin(g.ctx), 'draw', 'three quiet rounds');
  });

  test('only the living act, and only now: a dead player watches', () => {
    const g = atNight(game(['mafioso', 'detective', 'villager', 'villager', 'villager']));
    g.st.alive[2] = false;
    assert.match(act(g, 2, { act: 'hunch', p: 3 }), /out of the game/);
    assert.match(act(g, 1, { act: 'act', p: 2 }), /living player/);
    assert.match(act(g, 1, { act: 'act', p: 1 }), /another player/);
    assert.match(act(g, 3, { act: 'act', p: 1 }), /no night action/);
    assert.match(act(g, 3, { act: 'nominate', p: 1 }), /closed/);
    assert.match(act(g, 3, { act: 'ready' }), /Not now/);
    assert.match(act(g, 3, { act: 'alert', on: '1' }), /Not your job/);
    g.st.phase = 'day';
    assert.match(act(g, 1, { act: 'act', p: 3 }), /Not now/);
  });

  test('a whole game: night kill, discussion, a majority nominates, defense, guilty: the town wins', async () => {
    const { G, ctx, step } = await playGame(['mafioso', 'detective', 'doctor', 'villager', 'villager'], { roles: ['detective', 'doctor'] });
    const st = ctx.state;
    assert.deepEqual(plain(st.roles), ['mafioso', 'detective', 'doctor', 'villager', 'villager']);
    await step(() => ctx.expire());                                   // the deal
    assert.equal(st.phase, 'night');
    G.act(ctx, 0, { act: 'kill', p: 3 }); G.act(ctx, 1, { act: 'act', p: 0 }); G.act(ctx, 4, { act: 'hunch', p: 0 });
    [0, 1, 2, 3, 4].forEach(k => G.act(ctx, k, { act: 'done' }));     // everyone done: the night ends at once
    await step();
    assert.equal(st.phase, 'day');
    assert.equal(st.alive[3], false);
    assert.match(ctx.said.join(' '), /Dee .* Dee was the Villager/);
    assert.match(st.notes[1].join(' '), /Ana is 🔴 Suspicious/);
    [0, 1, 2, 4].forEach(k => G.act(ctx, k, { act: 'ready' }));
    await step();
    assert.equal(st.phase, 'nominate');
    assert.equal(G._test.need(ctx), 3);
    G.act(ctx, 1, { act: 'nominate', p: 0 }); G.act(ctx, 2, { act: 'nominate', p: 0 });
    assert.equal(st.accused, null);
    G.act(ctx, 4, { act: 'nominate', p: 0 });
    await step();
    assert.equal(st.phase, 'defense'); assert.equal(st.accused, 0);
    await step(() => ctx.skip());
    assert.equal(st.phase, 'verdict');
    assert.match(G.act(ctx, 0, { act: 'verdict', v: 'i' }), /accused/);
    G.act(ctx, 1, { act: 'verdict', v: 'g' }); G.act(ctx, 2, { act: 'verdict', v: 'g' }); G.act(ctx, 4, { act: 'verdict', v: 'i' });
    await step();
    assert.ok(ctx.ended, 'the game is over');
    assert.match(ctx.ended.html, /The town wins/);
    assert.deepEqual(plain(ctx.ended.results.map(r => [r.name, r.won, r.points])),
      [['Ana', false, 0], ['Bob', true, 1], ['Cy', true, 1], ['Dee', true, 0], ['Eli', true, 1]], 'a win for the whole town, dead or alive');
    assert.match(ctx.ended.html, /Night 1: 1 suspected Ana/, 'hunch statistics');
  });

  test('nominations: when time runs out, the most (at least 2); a tie follows the setup', async () => {
    for (const ties of ['none', 'random']) {
      const { G, ctx, step } = await playGame(['mafioso', 'mafioso', 'villager', 'villager', 'villager', 'villager', 'villager'], { ties, trials: 1 });
      const st = ctx.state;
      await step(() => ctx.expire());
      await step(() => ctx.expire());                                 // a night with no hit
      assert.equal(st.phase, 'day');
      await step(() => ctx.expire());
      G.act(ctx, 0, { act: 'nominate', p: 1 }); G.act(ctx, 2, { act: 'nominate', p: 1 });
      G.act(ctx, 3, { act: 'nominate', p: 4 }); G.act(ctx, 5, { act: 'nominate', p: 4 });
      await step(() => ctx.expire());
      if (ties === 'none') { assert.equal(st.phase, 'night', 'a tie: nobody goes on trial'); assert.match(ctx.said.join(' '), /A tie between Bob, Eli/); }
      else { assert.equal(st.phase, 'defense'); assert.ok([1, 4].includes(st.accused)); }
    }
  });

  test('a tied verdict acquits; the next trial is shorter; the Mayor\'s votes count 3; a Jester voted out wins and the game goes on', async () => {
    const { G, ctx, step } = await playGame(['mafioso', 'mayor', 'villager', 'villager', 'villager', 'villager', 'jester'], { roles: ['mayor', 'jester'], mafia: 1, trials: 2 });
    const st = ctx.state;
    await step(() => ctx.expire());
    await step(() => ctx.expire());
    G.act(ctx, 1, { act: 'mayor' });
    assert.equal(st.mayor, 1);
    assert.match(ctx.said.join(' '), /Bob is the Mayor/);
    assert.match(G.act(ctx, 1, { act: 'mayor' }), /Not now/, 'once');
    await step(() => ctx.expire());
    assert.equal(G._test.need(ctx), 5, '9 votes in all (the Mayor\'s count 3): 5 is a majority');
    G.act(ctx, 1, { act: 'nominate', p: 3 }); G.act(ctx, 0, { act: 'nominate', p: 3 });
    assert.equal(st.accused, null, 'the Mayor (3) and Ana: 4, one short');
    G.act(ctx, 2, { act: 'nominate', p: 3 });
    await step();
    assert.equal(st.accused, 3, '5: on trial');
    await step(() => ctx.skip());
    G.act(ctx, 1, { act: 'verdict', v: 'i' }); G.act(ctx, 0, { act: 'verdict', v: 'g' }); G.act(ctx, 2, { act: 'verdict', v: 'g' }); G.act(ctx, 4, { act: 'verdict', v: 'g' });
    // (Cy, Eli and Ana: 3 guilty; the Mayor alone: 3 innocent)
    await step(() => ctx.expire());
    assert.equal(st.alive[3], true, '3 guilty against the Mayor\'s 3 innocent: a tie acquits');
    assert.equal(st.phase, 'nominate');
    [0, 1, 2].forEach(k => G.act(ctx, k, { act: 'nominate', p: 6 }));
    await step();
    await step(() => ctx.skip());
    G.act(ctx, 1, { act: 'verdict', v: 'g' });
    await step(() => ctx.expire());
    assert.equal(st.alive[6], false);
    assert.equal(st.wins[6], true, 'the Jester got their wish');
    assert.match(ctx.said.join(' '), /Jester laughs/);
    assert.equal(ctx.ended, null, 'the game goes on');
    assert.equal(st.phase, 'night');
  });

  test('roles hidden until the end: nothing is revealed at death, and the end shows everything', async () => {
    const { G, ctx, step } = await playGame(['mafioso', 'villager', 'villager', 'villager', 'villager'], { reveal: 'hidden' });
    const st = ctx.state;
    await step(() => ctx.expire());
    G.act(ctx, 0, { act: 'kill', p: 2 });
    await step(() => ctx.expire());
    assert.match(ctx.said.join(' '), /What Cy was stays a secret/);
    assert.deepEqual(plain(st.revealed), {});
    assert.equal(G._test.shownRole(ctx, 1, 2), null);
    assert.equal(G._test.shownRole(ctx, 2, 1), 'villager', 'but the dead see every role');
  });

  test('three rounds in a row without a death: a draw', async () => {
    const { ctx, step } = await playGame(['mafioso', 'villager', 'villager', 'villager', 'villager'], {});
    await step(() => ctx.expire());
    for (let r = 0; r < 3; r++) { await step(() => ctx.expire()); await step(() => ctx.expire()); await step(() => ctx.expire()); }
    assert.ok(ctx.ended);
    assert.match(ctx.ended.html, /A draw/);
  });

  test('days get shorter: 4 minutes, then 1 less each day, at least 2', () => {
    const { talkTime } = load()._test;
    const ctx = { opts: { talk: 240 } };
    assert.deepEqual([1, 2, 3, 4].map(d => talkTime(ctx, d)), [240, 180, 120, 120]);
    assert.equal(talkTime({ opts: { talk: 300, shrink: 'off' } }, 4), 300);
  });
});

/* ---------------- Screens ---------------- */
describe('Screens', () => {
  test('each phone sees only what it may: its own role, its family, the revealed dead; spectators see all', () => {
    const g = atNight(game(['mafioso', 'consort', 'detective', 'mason', 'mason', 'villager', 'villager']));
    const view = i => plain(g.G.view(g.ctx, i));
    const roleOf = (v, k) => v.players.find(p => p.i === k).role;
    assert.equal(roleOf(view(2), 0), null, 'the Detective can\'t see the mafia');
    assert.match(roleOf(view(1), 0), /Mafioso/, 'the family sees each other');
    assert.match(roleOf(view(3), 4), /Mason/, 'Masons see each other');
    assert.equal(view(2).family, undefined);
    assert.deepEqual(view(0).family.map(f => f.name), ['Ana', 'Bob']);
    act(g, 0, { act: 'kill', p: 5 });
    assert.deepEqual(view(1).victims.find(v => v.i === 5).by, ['Ana'], 'the family sees each other\'s picks live');
    g.st.alive[6] = false;
    const ghost = view(6);
    assert.match(roleOf(ghost, 0), /Mafioso/, 'a spectator sees every role');
    assert.ok(ghost.live.some(l => /Ana \(Mafioso\): hit on Fay/.test(l)), 'and the night as it happens');
    assert.equal(ghost.victims, undefined);
  });

  test('every screen renders on the Mac and the phones, in every phase', () => {
    const g = game(['godfather', 'janitor', 'doctor', 'vigilante', 'veteran', 'survivor', 'medium', 'mayor', 'executioner', 'villager'], { reveal: 'reveal' });
    const H = { esc: s => String(s) };
    const local = { shown: true };
    for (const phase of ['deal', 'night', 'dawn', 'day', 'nominate', 'defense', 'verdict', 'acquitted', 'executed']) {
      Object.assign(g.st, { phase, night: 2, day: 1, accused: 3, lastVerdict: { t: 4, guilty: 2, innocent: 1, votes: [[0, 'g'], [1, 'i'], [2, 'a']] } });
      if (phase === 'nominate') g.st.noms = { 0: 3, 1: 3 };
      g.st.alive[9] = phase !== 'night';
      assert.ok(g.G.hostHTML(g.ctx, H).length > 100, `Mac: ${phase}`);
      assert.ok(g.G.status(g.ctx));
      for (let i = 0; i < 10; i++) {
        const html = g.G.phoneHTML(plain(g.G.view(g.ctx, i)), local, H);
        assert.ok(html.length > 50, `phone ${i}: ${phase}`);
      }
    }
    g.st.phase = 'night'; g.st.alive.fill(true);
    const vigil = g.G.phoneHTML(plain(g.G.view(g.ctx, 3)), local, H);
    assert.match(vigil, /Shoot \(2 left\)/);
    assert.match(g.G.phoneHTML(plain(g.G.view(g.ctx, 1)), local, H), /Clean up after tonight's hit/);
    assert.match(g.G.phoneHTML(plain(g.G.view(g.ctx, 9)), {}, H), /Tap to see your role/, 'the role stays hidden until tapped');
  });

  test('lobby: the roles for the players present, the balance meter, what\'s left out; the start check', () => {
    const G = load();
    const html = G.lobbyHTML(6, { roles: ['detective', 'doctor', 'mason'], mafia: 'auto', reveal: 'reveal' });
    assert.match(html, /Roles for 6 players: 2 mafia \(suggested\)/);
    assert.match(html, /Balanced/);
    assert.match(html, /Mason \(Masons need 7 players\)/);
    assert.match(G.lobbyHTML(2, { roles: [], mafia: 'auto' }), /at least 4/);
    assert.match(G.canStart(6, { mafia: 3 }), /at most 2 mafia/);
    assert.equal(G.canStart(6, { mafia: 'auto' }), null);
    const doctorOpt = G.options.find(o => o.key === 'docSelf');
    assert.equal(doctorOpt.showIf({ roles: ['doctor'] }), true);
    assert.equal(doctorOpt.showIf({ roles: [] }), false, 'the Doctor\'s options only with the Doctor');
  });
});
