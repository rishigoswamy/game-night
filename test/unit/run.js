#!/usr/bin/env node
// Unit test runner (fast, no browser). Run them before you commit (docs/CI.md, "Before you commit"):
//   npm test                                   all unit tests
//   npm test -- party-catan party-cards        only those files (test/unit/<name>.test.js)
//   npm test -- --grep "bluff"                 only the tests whose name matches (in all files, or in the files named)
//   npm test -- --list                         the test files there are
// Same look as the pipeline's unit stage: the banner, each test numbered as it finishes ([ 37/253] ✓ …,
// scripts/unit-reporter.js), then a green or red summary. (The browser tests are separate: npm run test:e2e)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const B = require('../../scripts/banner');

const ROOT = path.resolve(__dirname, '..', '..');
const FILES = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).map(f => f.slice(0, -'.test.js'.length)).sort();
const args = process.argv.slice(2), names = [];
let grep = null;
for (let k = 0; k < args.length; k++) {
  if (args[k] === '--list') { console.log(FILES.join('\n')); process.exit(0); }
  if (args[k] === '--grep') { grep = args[++k]; if (!grep) { console.error('--grep needs a pattern, e.g. npm test -- --grep "bluff"'); process.exit(2); } continue; }
  names.push(args[k].replace(/^test\/unit\//, '').replace(/\.test\.js$/, ''));
}
const unknown = names.filter(n => !FILES.includes(n));
if (unknown.length) { B.fail(`Unknown unit test file(s): ${unknown.join(', ')}`); console.error(`Available: ${FILES.join(', ')}`); process.exit(2); }
const picked = names.length ? names : FILES, files = picked.map(n => path.join('test/unit', `${n}.test.js`));

// How many tests will run, counted first (Node lists them as skipped without running any, ~0.2 s). With --grep the
// count isn't known in advance: the lines show [n/?] and the summary gives the real number.
const count = grep ? 0 : +(String(spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=(?!)', ...files], { cwd: ROOT, encoding: 'utf8' }).stdout)
  .match(/^# tests (\d+)/m) || [])[1] || 0;
const which = names.length ? picked.join(', ') : `${files.length} files`;
B.banner('UNIT TESTS', 'Unit tests', grep ? `the tests matching "${grep}" in ${which}` : `${count} tests in ${which}`);

// One run: numbered lines on screen, and a TAP copy for the summary (how many passed, which failed)
const t0 = Date.now(), tap = path.join(os.tmpdir(), `gn-unit-${process.pid}.tap`);
const r = spawnSync(process.execPath, ['--test', `--test-reporter=${path.join(ROOT, 'scripts/unit-reporter.js')}`, '--test-reporter-destination=stdout',
  '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...(grep ? [`--test-name-pattern=${grep}`] : []), ...files],
{ cwd: ROOT, stdio: 'inherit', env: { ...process.env, UNIT_TOTAL: String(count) } });
let out = ''; try { out = fs.readFileSync(tap, 'utf8'); } catch {}
fs.rmSync(tap, { force: true });
const n = k => +(out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] || 0;
const pass = n('pass'), fail = n('fail'), ran = pass + fail, ms = Date.now() - t0;
const failed = require(path.join(ROOT, 'scripts/unit-reporter')).failedTests(out, ROOT).map(f => `${f.name}  (${f.file})`);
// Node's own totals, as its plain output ends (ℹ tests 253 · ℹ pass 253 · …)
console.log('\n' + ['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo', 'duration_ms']
  .map(k => B.dim(`ℹ ${k} ${(out.match(new RegExp(`^# ${k} ([\\d.]+)`, 'm')) || [])[1] ?? 0}`)).join('\n') + '\n');
if (r.status !== 0 || fail) {
  B.fail(`Unit tests failed: ${fail ? `${fail} of ${ran}` : 'see above'}  (${B.secs(ms)})`);
  failed.forEach(f => console.error(B.red(`   ✗ ${f}`)));
  process.exit(r.status || 1);
}
if (!ran) { B.fail(`No unit tests ran${grep ? ` (nothing matches "${grep}")` : ''}`); process.exit(1); }
B.ok(`Unit tests passed: ${pass} of ${ran}  (${B.secs(ms)})`);
