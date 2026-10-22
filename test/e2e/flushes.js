const H = require('./helpers');
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const PORT = H.PORT;
(async () => {
  const srv = spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(() => { speechSynthesis.speak = () => {}; });
  const errs = [];
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  const base = `http://localhost:${PORT}`;
  // Admin lock + seeded data
  await p.goto(base + '/admin.html');
  await p.fill('#newPin', '2468'); await p.fill('#newPin2', '2468'); await p.uncheck('#setupBioChk').catch(() => {}); await p.click('#setupForm button[type=submit]');
  await p.evaluate(() => {
    const at = Date.now(), e = (game, name, net) => ({ game, name, net, final: 1000 + net, rounds: 3, best: Math.max(0, net), at });
    localStorage.setItem('gn-leaderboard', JSON.stringify([e('roulette', 'Ana', 300), e('roulette', 'Bob', -50), e('sicbo', 'Cy', 120), e('blackjack', 'Dee', 80),
      { game: 'gofish', name: 'Eli', won: true, points: 5, at }, { game: 'catan', name: 'Fay', won: true, points: 10, at }]));
    localStorage.setItem('gn-spins', JSON.stringify([1, 2, 3, 17]));
    localStorage.setItem('gn-log-sicbo', JSON.stringify([{ text: '9', cls: 'tok-blue', group: 'Small' }]));
  });
  await p.reload();
  console.log('admin status:', (await p.textContent('#stSpins')), '|', await p.textContent('#stBoards'));
  // 1) per-game leaderboard flush from the Sic Bo page (PIN in the dialog)
  await p.goto(base + '/table.html?g=sicbo');
  console.log('Sic Bo setup screen board:', (await p.textContent('#leaderboardMini tbody')).replace(/\s+/g, ' ').trim());
  await p.screenshot({ path: 'shots/setup-board.png' });
  await p.click('#leaderboardMini .lb-flush');
  await p.fill('.lb-modal #lbPin', '2468'); await p.click('.lb-modal button[type=submit]');
  console.log('Sic Bo boards after flush: setup', (await p.textContent('#leaderboardMini')).includes('No one on the board yet'), '| page', (await p.textContent('#leaderboard')).includes('No one on the board yet'));
  // 2) lobby: flush all casino boards; party boards stay
  await p.goto(base + '/casino.html');
  await p.click('#leaderboard .lb-flush');
  await p.fill('.lb-modal #lbPin', '1111'); await p.click('.lb-modal button[type=submit]');
  console.log('wrong PIN →', await p.textContent('.lb-modal .err'));
  await p.fill('.lb-modal #lbPin', '2468'); await p.click('.lb-modal button[type=submit]');
  console.log('after casino flush, entries left:', await p.evaluate(() => JSON.parse(localStorage.getItem('gn-leaderboard')).map(e => e.game + ':' + e.name).join(' ')));
  // 3) admin page: per-game recent results, then master flush
  await p.goto(base + '/admin.html');
  await p.fill('#pin', '2468'); await p.click('#unlockForm button[type=submit]');
  console.log('recent-results choices:', (await p.$$eval('#rrGame option', o => o.map(x => x.textContent))).join(' | '));
  await p.selectOption('#rrGame', 'sicbo'); await p.click('#rrFlushBtn'); await p.click('#rrFlushBtn');
  console.log('→', await p.textContent('#manageMsg'), '| roulette spins kept:', await p.evaluate(() => JSON.parse(localStorage.getItem('gn-spins')).length));
  await p.click('#masterFlushBtn'); await p.click('#masterFlushBtn');
  console.log('master →', await p.textContent('#manageMsg'));
  console.log('left after master flush: leaderboard', await p.evaluate(() => JSON.parse(localStorage.getItem('gn-leaderboard')).length), '| spins', await p.evaluate(() => JSON.parse(localStorage.getItem('gn-spins')).length), '| admin lock kept:', await p.evaluate(() => AdminLock.hasLock()));
  await p.screenshot({ path: 'shots/admin-flush.png', fullPage: true });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
