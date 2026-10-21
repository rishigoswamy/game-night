const H = require('./helpers');
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const PORT = 8091;
(async () => {
  const srv = spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  for (const g of ['baccarat', 'dragontiger', 'sicbo', 'craps']) {
    const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await c.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('gn-voice', 'off'); });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(g + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(g + ' console: ' + m.text()); });
    await p.goto(`http://localhost:${PORT}/table.html?g=${g}`);
    await p.selectOption('#timeLimit', 'custom'); await p.fill('#customTime', '6');
    await p.click('#setupForm button[type=submit]');
    const keys = await p.$$eval('.b-cell', cs => cs.map(c => c.dataset.key));
    await p.click('.chip[data-v="100"]');
    await p.click(`.b-cell[data-key="${keys[0]}"]`); await p.click(`.b-cell[data-key="${keys[keys.length - 1]}"]`);
    await p.click('#order button.pill:has-text("Player 2")'); await p.click('.chip[data-v="50"]'); await p.click(`.b-cell[data-key="${keys[1]}"]`);
    await p.waitForSelector('#roundModal:not([hidden])', { timeout: 60000 });
    const res = await p.evaluate(() => ({ text: $('#rmText').textContent, rows: $('#rmRows').textContent.replace(/\s+/g, ' ').trim(), bal: S.players.map(p => p.name + ':' + p.bal).join(' '), log: resultLog.length, stage: $('#stage').textContent.replace(/\s+/g, ' ').trim().slice(0, 60) }));
    console.log(`${g.padEnd(12)} ${res.text} | ${res.rows} | ${res.bal} | stage: ${res.stage}`);
    await p.screenshot({ path: `shots/tg-${g}.png` });
    await p.waitForFunction(() => S.round === 2 && S.phase === 'bet', null, { timeout: 15000 });
    await c.close();
  }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
