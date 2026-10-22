const H = require('./helpers');
// The party games page: each game's icon animates while hovered, and stays still with reduced motion
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
(async () => {
  const srv = spawn('node', [H.SERVER, String(H.PORT)], { env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const b = await chromium.launch({ executablePath: H.CHROME, args: ['--mute-audio'] });
  const errs = [];
  for (const motion of ['no-preference', 'reduce']) {
    const c = await b.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: motion });
    await c.addInitScript(() => { speechSynthesis.speak = () => {}; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`http://localhost:${H.PORT}/party.html`);
    const icons = await p.$$eval('.game .party-icon', s => s.length);
    console.log(`${motion}: icons`, icons); if (icons !== 5) console.log('BAD expected 5 icons');
    const parts = { werewolf: '.pw-howl', catan: '.pc-d1', gofish: '.pg-fish', bluff: '.pb-mid', tambola: '.pt-ball' };
    for (const [g, sel] of Object.entries(parts)) {
      const card = `.game[href*="g=${g}"]`;
      const anim = s => p.$eval(`${card} ${s}`, e => getComputedStyle(e).animationName);
      const before = await anim(sel);
      await p.hover(card); await p.waitForTimeout(300);
      const during = await anim(sel);
      console.log(`   ${g}: at rest ${before}, hovered ${during}`);
      if (before !== 'none') console.log('BAD', g, 'animates without hover');
      if (motion === 'reduce' ? during !== 'none' : during === 'none') console.log('BAD', g, motion === 'reduce' ? 'animates with reduced motion' : 'does not animate on hover');
      await p.mouse.move(0, 0);
    }
    await c.close();
  }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.kill();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
