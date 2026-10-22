const H = require('./helpers');
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
(async () => {
  const srv = spawn('node', [H.SERVER, String(H.PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const c = await b.newContext(); await c.addInitScript(() => { speechSynthesis.speak = () => {}; });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  // a fresh admin PIN created the old way, plus old-named data
  await p.goto(`http://localhost:${H.PORT}/admin.html`);
  await p.fill('#newPin', '1357'); await p.fill('#newPin2', '1357'); await p.uncheck('#setupBioChk').catch(() => {}); await p.click('#setupForm button[type=submit]');
  await p.evaluate(() => {
    localStorage.setItem('dc-admin', localStorage.getItem('gn-admin')); localStorage.removeItem('gn-admin');
    localStorage.setItem('dc-leaderboard', JSON.stringify([{ game: 'roulette', name: 'Old Ana', net: 250, final: 1250, rounds: 4, best: 175, at: Date.now() }]));
    localStorage.setItem('rd-spins', JSON.stringify([7, 0, 37, 17]));
    localStorage.setItem('gn-voice', 'off'); localStorage.setItem('dc-device', 'dabc123def456');
  });
  console.log('before:', await p.evaluate(() => Object.keys(localStorage).sort().join(' ')));
  await p.goto(`http://localhost:${H.PORT}/roulette.html`);
  console.log('after:', await p.evaluate(() => Object.keys(localStorage).sort().join(' ')));
  console.log('roulette page:', await p.title(), '|', await p.textContent('h1'), '| recent numbers kept:', await p.evaluate(() => spinLog.join(',')), '| voice setting kept:', await p.textContent('#voiceBtn'));
  console.log('setup-screen leaderboard:', (await p.textContent('#leaderboardMini tbody')).replace(/\s+/g, ' ').trim());
  console.log('admin PIN still works:', await p.evaluate(() => AdminLock.checkPin('1357').ok), '| phone id kept:', await p.evaluate(() => localStorage.getItem('gn-device')));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})();
