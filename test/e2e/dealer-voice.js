const H = require('./helpers');
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const PORT = H.PORT;
(async () => {
  const srv = spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  // Chrome's own speech is stubbed out entirely: if the dealer is heard, it's the server voice
  await ctx.addInitScript(() => { window.__browserSpoke = 0; speechSynthesis.speak = () => window.__browserSpoke++; localStorage.setItem('gn-voice', 'on'); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const tts = []; pg.on('request', r => { if (r.url().includes('/api/tts')) tts.push(decodeURIComponent(r.url().split('text=')[1])); });
  await pg.goto(`http://localhost:${PORT}/roulette.html`);
  await pg.waitForTimeout(500);
  console.log('server voice available:', await pg.evaluate(() => NET.tts));
  await pg.selectOption('#timeLimit', 'custom'); await pg.fill('#customTime', '5'); await pg.click('#openTableBtn');
  await pg.waitForFunction(() => voiceSrc !== null, null, { timeout: 8000 });
  const t0 = Date.now();
  console.log('welcome line playing as audio from the server:', JSON.stringify(tts[0]), '| clip length:', (await pg.evaluate(() => voiceSrc.buffer.duration)).toFixed(1) + 's');
  await pg.waitForFunction(() => voiceSrc === null, null, { timeout: 15000 });
  console.log(`line finished after ${((Date.now() - t0) / 1000).toFixed(1)}s | Chrome's own speech used: ${await pg.evaluate(() => window.__browserSpoke)} times | no-sound bar: ${await pg.isVisible('#soundBar')}`);
  await pg.waitForSelector('#roundModal:not([hidden])', { timeout: 40000 });
  console.log('lines voiced by the server this round:', JSON.stringify(tts));
  const t1 = Date.now(); await pg.evaluate(() => ttsClip('No more bets!')); console.log(`repeat line from cache: ${Date.now() - t1} ms`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
