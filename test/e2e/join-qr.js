const H = require('./helpers');
// The join QR code can be shown mid-game (without going back to the lobby) at every casino table and in party games
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const PORT = H.PORT;
(async () => {
  const srv = spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  const mc = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await mc.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('gn-voice', 'off'); localStorage.setItem('gn-party-voice', 'off'); });
  const mac = await mc.newPage(); mac.on('pageerror', e => errs.push(e.message));
  const qrLoaded = () => mac.evaluate(sel => new Promise(res => { const i = document.querySelector(sel); const ok = () => res(i.complete && i.naturalWidth > 0); i.complete ? ok() : (i.onload = ok, i.onerror = () => res(false)); }), '#shareQr');
  for (const page of ['roulette.html', 'blackjack.html', 'table.html?g=sicbo']) {
    await mac.goto(`http://localhost:${PORT}/${page}`);
    await mac.click('#openTableBtn');
    await mac.waitForSelector('#shareBtn:not([hidden])', { timeout: 8000 });
    const label = await mac.textContent('#shareBtn');
    await mac.click('#shareBtn');
    console.log(`${page}: button "${label}" → window "${await mac.textContent('#shareModal h2')}", QR shown: ${await qrLoaded()}, address: ${await mac.textContent('#shareUrls')}, game still running: ${await mac.evaluate(() => !!S && document.querySelector('#setup').hidden)}`);
    if (page === 'roulette.html') await mac.screenshot({ path: 'shots/join-qr-roulette.png' });
    await mac.click('#shareClose');
  }
  // party game: the Join button appears once a game is running
  await mac.goto(`http://localhost:${PORT}/party-table.html?g=gofish`);
  await mac.waitForFunction(() => sharing(), null, { timeout: 5000 });
  console.log('party lobby: Join button hidden (QR already on screen):', await mac.isHidden('#joinBtn'));
  await mac.evaluate(() => { addSeat('Ana', 'dtest1'); addSeat('Bob', 'dtest2'); render(); });
  await mac.click('#startBtn');
  await mac.waitForSelector('#joinBtn:not([hidden])');
  await mac.click('#joinBtn');
  const partyQr = await mac.evaluate(() => new Promise(res => { const i = document.querySelector('#joinQr'); const ok = () => res(i.naturalWidth > 0); i.complete ? ok() : (i.onload = ok, i.onerror = () => res(false)); }));
  console.log(`party game: window "${await mac.textContent('#joinModal h2')}", QR shown: ${partyQr}, address: ${await mac.textContent('#joinUrl2')}, still in game: ${await mac.evaluate(() => P.phase === 'game')}`);
  await mac.screenshot({ path: 'shots/join-qr-party.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
