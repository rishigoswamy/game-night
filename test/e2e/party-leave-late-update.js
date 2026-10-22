// A phone that taps Leave mustn't be seated again by an update the table sent a moment before it knew (on a slow machine
// that update arrives just after the tap). Regression test for the race found on GitHub's CI, October 2026.
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('gofish', ['Ana', 'Bob']);
  const { mac, phones } = T; const ana = phones[0].p;
  const seats = () => mac.evaluate(() => P.seats.map(s => s.name).join(', '));
  // Ana taps Leave, and an update sent just before the Mac handled it arrives just after (as on a slow machine)
  const stale = await ana.evaluate(() => JSON.stringify(ST));
  await ana.click('#leaveBtn');
  await ana.evaluate(s => onMessage(JSON.parse(s)), stale);
  await ana.waitForTimeout(1200);
  console.log('after Leave (+ a late update) → Mac:', await seats());
  await ana.reload(); await ana.waitForTimeout(2500);
  const back = (await seats()).includes('Ana');
  console.log('Ana reloads → Mac:', await seats(), '| join form visible:', await ana.isVisible('#nameForm'));
  if (back) console.log('BAD Ana was seated again by herself after leaving');
  console.log('errors: none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
