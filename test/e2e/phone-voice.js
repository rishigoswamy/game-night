const H = require('./helpers');
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const PORT = 8091;
(async () => {
  const srv = spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const mc = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await mc.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('gn-voice', 'off'); });
  const mac = await mc.newPage();
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await pc.addInitScript(() => { window.__browserSpoke = 0; speechSynthesis.speak = () => window.__browserSpoke++; });   // a fresh phone: no saved setting
  const phone = await pc.newPage(); const errs = []; phone.on('pageerror', e => errs.push(e.message));
  const tts = []; phone.on('request', r => { if (r.url().includes('/api/tts')) tts.push(decodeURIComponent(r.url().split('text=')[1])); });
  await mac.goto(`http://localhost:${PORT}/roulette.html`); await mac.selectOption('#timeLimit', 'custom'); await mac.fill('#customTime', '60'); await mac.click('#openTableBtn');
  await mac.waitForFunction(() => sharing());
  await phone.goto(`http://${H.PHONE_HOST}:${PORT}/remote.html`); await phone.waitForSelector('#tableView:not([hidden])');
  console.log('phone voice default:', await phone.getAttribute('#voiceBtn', 'aria-label'));
  await phone.fill('#nameIn', 'Ana'); await phone.tap('#addForm button[type=submit]');
  await phone.waitForFunction(() => voiceSrc !== null, null, { timeout: 8000 });
  console.log('phone played the dealer line with the server voice:', JSON.stringify(tts.slice(-1)[0]), '| clip', (await phone.evaluate(() => voiceSrc.buffer.duration)).toFixed(1) + 's', '| browser speech used:', await phone.evaluate(() => window.__browserSpoke));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
