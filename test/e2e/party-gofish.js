const H = require('./helpers');
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const PORT = H.PORT;
(async () => {
  const srv = spawn('node', [H.SERVER, String(PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  const mc = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await mc.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem('gn-party-voice', 'off'); });
  const mac = await mc.newPage(); mac.on('pageerror', e => errs.push('mac: ' + e.message)); mac.on('console', m => { if (m.type() === 'error') errs.push('mac console: ' + H.consoleText(m)); });
  await mac.goto(`http://localhost:${PORT}/party.html`);
  console.log('party lobby cards:', (await mac.$$eval('a.game h2', h => h.map(x => x.textContent))).join(', '), '| QR shown:', await mac.isVisible('#qrJoin img'), '| leaderboard:', await mac.isVisible('#leaderboard'));
  await mac.click('a.game[href="party-table.html?g=gofish"]');
  await mac.waitForFunction(() => sharing(), null, { timeout: 5000 });
  console.log('Mac Go Fish lobby: QR', await mac.isVisible('#qr'), '| join', await mac.textContent('#joinUrl'), '| start:', await mac.textContent('#startNote'));
  const phones = [];
  for (const name of ['Ana', 'Bob', 'Cy']) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await c.addInitScript(() => { speechSynthesis.speak = () => {}; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(`http://${H.PHONE_HOST}:${PORT}/party.html`);
    await p.click('a.game:has(h2:text("Go Fish"))');
    await p.waitForURL(/party-remote\.html\?g=gofish/);
    await p.waitForSelector('#nameForm', { state: 'visible' });
    await p.fill('#nameIn', name); await p.click('#nameForm button');
    await p.waitForSelector('#lobbyPanel:not([hidden])');
    phones.push({ name, p });
  }
  console.log('Mac seats:', await mac.textContent('#seats'), '|', await mac.textContent('#startNote'));
  await mac.click('#startBtn');
  await mac.waitForTimeout(2500); console.log('DEBUG', JSON.stringify(await mac.evaluate(() => ({ phase: P.phase, st: !!P.ctx?.state, stage: document.querySelector('#stage').textContent.slice(0,80) }))), errs, await phones[0].p.evaluate(() => JSON.stringify({ phase: ST?.phase, me: ST?.me, view: !!ST?.view })));
  await phones[0].p.waitForSelector('#viewPanel:not([hidden])');
  const hands = await Promise.all(phones.map(x => x.p.$$eval('#view .fan .pcard', cs => cs.length)));
  console.log('cards in each phone hand:', hands.join(', '));
  await phones[0].p.screenshot({ path: 'shots/gofish-phone.png', fullPage: true });
  await mac.screenshot({ path: 'shots/gofish-mac.png' });
  // play: whoever's turn it is picks their first rank and the first player with cards
  let moves = 0;
  while (!(await mac.isVisible('#endModal')) && moves < 1500) {
    let acted = false;
    for (const { p } of phones) {
      if (!(await p.isVisible('#view [data-act="ask"]').catch(() => false))) continue;
      // The screen may be a moment behind (the last move is still on its way): pick from what is shown when clicking,
      // give up quickly if the turn has moved on, and wait for each move to be processed before looking again
      const before = await p.evaluate(() => JSON.stringify(ST?.view));
      const pick = async sel => {
        const l = p.locator(sel), n = await l.count();
        return n > 0 && l.nth(Math.floor(Math.random() * n)).click({ timeout: 3000 }).then(() => true, () => false);
      };
      if (!(await pick('#view [data-local="rank"]')) || !(await pick('#view [data-local="target"]:not([disabled])'))) break;
      if (!(await p.click('#view [data-act="ask"]', { timeout: 3000 }).then(() => true, () => false))) break;
      moves++; acted = true;
      await p.waitForFunction(b => JSON.stringify(ST?.view) !== b, before, { timeout: 5000 }).catch(() => {});
      break;
    }
    if (!acted) await mac.waitForTimeout(150);
  }
  console.log('state:', await mac.evaluate(() => JSON.stringify({ deck: P.ctx?.state?.deck.length, books: P.ctx?.state?.books.map(b => b.length), turn: P.ctx?.state?.turn }))); console.log('moves played:', moves, '| end:', await mac.textContent('#endTitle'), '|', (await mac.textContent('#endBody')).replace(/\s+/g, ' ').trim());
  await phones[1].p.waitForSelector('#endPanel:not([hidden])');
  console.log('phone end:', (await phones[1].p.textContent('#endTitle')));
  await mac.click('#toLobbyBtn');
  console.log('Mac leaderboard:', (await mac.textContent('#leaderboard tbody')).replace(/\s+/g, ' ').trim());
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
