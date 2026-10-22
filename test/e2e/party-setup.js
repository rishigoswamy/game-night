const H = require('./helpers');
// Shared setup for party-game tests: a test server, a muted Mac and N phones joined to the game
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const PORT = H.PORT;
exports.setup = async (game, names, { macSize = { width: 1280, height: 900 } } = {}) => {
  const srv = spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  const mc = await b.newContext({ viewport: macSize });
  await mc.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('gn-party-voice', 'off'); });
  const mac = await mc.newPage(); mac.on('pageerror', e => errs.push('mac: ' + e.message)); mac.on('console', m => { if (m.type() === 'error') errs.push('mac console: ' + m.text()); });
  await mac.goto(`http://localhost:${PORT}/party-table.html?g=${game}`);
  await mac.waitForFunction(() => sharing(), null, { timeout: 5000 });
  const phones = [];
  for (const name of names) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(`http://${H.PHONE_HOST}:${PORT}/remote.html`);
    await p.waitForURL(new RegExp(`party-remote\\.html\\?g=${game}`));
    await p.waitForSelector('#nameForm', { state: 'visible' });
    await p.fill('#nameIn', name); await p.click('#nameForm button');
    await p.waitForSelector('#lobbyPanel:not([hidden])');
    phones.push({ name, p });
  }
  return { b, srv, mac, phones, errs, close: async () => { await b.close(); srv.kill(); } };
};
