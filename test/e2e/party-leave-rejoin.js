const H = require('./helpers');
const { setup } = require('./party-setup');
(async () => {
  const T = await setup('werewolf', ['Ana', 'Bob', 'Cy', 'Dee']);
  const { mac, phones, errs } = T;
  const seats = () => mac.evaluate(() => P.seats.map(s => s.name + (s.leaving ? '(leaving)' : '')).join(', '));
  const panels = p => p.evaluate(() => ['namePanel', 'lobbyPanel', 'leavePanel', 'viewPanel'].filter(id => !document.getElementById(id).hidden).join('+'));
  const [ana, bob, cy] = phones.map(x => x.p);
  console.log('1. seated:', await seats());
  await ana.click('#leaveBtn'); await ana.waitForTimeout(1200);
  console.log('2. Ana taps Leave → Mac:', await seats(), '| Ana\'s phone shows:', await panels(ana));
  await ana.reload(); await ana.waitForTimeout(2500);
  console.log('3. Ana reopens the page → Mac:', await seats(), '| phone shows:', await panels(ana), '| name box:', await ana.inputValue('#nameIn'));
  await ana.fill('#nameIn', 'Anaya'); await ana.click('#nameForm button'); await ana.waitForTimeout(1000);
  console.log('4. joins as a new name → Mac:', await seats());
  await bob.click('#renameBtn'); await bob.fill('#nameIn', 'Cy'); await bob.click('#nameForm button'); await bob.waitForTimeout(800);
  console.log('5. Bob tries to rename to "Cy" →', await bob.textContent('#toast'), '| Mac:', await seats());
  await bob.click('#renameBtn'); await bob.fill('#nameIn', 'Bobby'); await bob.click('#nameForm button'); await bob.waitForTimeout(800);
  console.log('6. Bob renames to Bobby → Mac:', await seats());
  // during a game
  await mac.click('#startBtn'); await mac.waitForFunction(() => P.ctx?.state);
  await cy.waitForSelector('#leavePanel:not([hidden])');
  console.log('7. game started; Cy sees:', await panels(cy), '|', await cy.textContent('#leaveLaterBtn'));
  await cy.click('#leaveLaterBtn'); await cy.waitForTimeout(800);
  console.log('8. Cy taps it → Mac:', await seats(), '| Cy\'s button now:', await cy.textContent('#leaveLaterBtn'));
  await bob.click('#leaveLaterBtn'); await bob.waitForTimeout(500); await bob.click('#leaveLaterBtn'); await bob.waitForTimeout(800);
  console.log('9. Bobby taps leave then stay → Mac:', await seats());
  await mac.click('#endBtn'); await mac.click('#confirmYes'); await mac.waitForTimeout(1500);
  console.log('10. game ends → Mac:', await seats(), '| Cy\'s phone shows:', await panels(cy), '| toast:', await cy.textContent('#toast'));
  // the Mac reloads: seated phones come back by themselves
  await mac.reload(); await mac.waitForFunction(() => sharing(), null, { timeout: 8000 }); await mac.waitForTimeout(6000);
  console.log('11. Mac reloaded → seats:', await seats(), '(Cy left, so stays out)');
  console.log('errors:', errs.length ? errs : 'none');
  await T.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
