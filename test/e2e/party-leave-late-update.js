// A phone that taps Leave mustn't be seated again by itself (regression tests for races found on GitHub's CI, October 2026):
//   1. by an update the table sent a moment before it knew (on a slow machine that update arrives just after the tap);
//   2. by another phone's state: the server used to replay the last state it relayed to any phone that connected, and
//      in a party game that's one seated player's own state (their seat, their cards or role)
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
  // 2. Ana's page is closed while the table updates the seated phones, so the last state the server relayed is Bob's.
  // Opening the page again must show the join form, not Bob's seat.
  const url = ana.url();
  await ana.goto('about:blank'); await ana.waitForTimeout(1500);
  await mac.evaluate(() => pushNow()); await ana.waitForTimeout(500);
  await ana.goto(url); await ana.waitForTimeout(2500);
  const seen = await ana.evaluate(() => ST && ST.me);
  console.log('page closed while Bob got an update, then reopened → Mac:', await seats(), '| join form visible:', await ana.isVisible('#nameForm'), '| seat the phone thinks it has:', seen);
  if ((await seats()).includes('Ana')) console.log('BAD Ana was seated again by another phone\'s state');
  if (seen != null) console.log('BAD the phone was sent another player\'s state');
  console.log('errors: none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
