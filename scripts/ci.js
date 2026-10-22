#!/usr/bin/env node
// All the checks in order, as in the GitHub pipeline (npm run ci; also what the pre-push hook runs), then a summary:
// green "safe to push" if every stage passed, red "not safe to push" if one failed (the stages after it don't run);
// anything that passed only on a retry is listed in yellow as flaky. Retries: scripts/stage.js and docs/CI.md.
//   npm run ci                       the five stages
//   node scripts/ci.js --base <ref>  the build check also checks the cache version against <ref> (the hook passes it)
const fs = require('fs');
const os = require('os');
const path = require('path');
const B = require('./banner');

const ROOT = path.resolve(__dirname, '..');
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : ''; };
const base = arg('--base'), label = arg('--label') || 'npm run ci';
const { runStage } = require('./stage');
const STAGES = [                                   // [key, name, arguments for the stage]
  ['build', 'Build check', base ? ['--base', base] : []],
  ['unit', 'Unit tests', []],
  ['coverage', 'Coverage', []],
  ['e2e', 'End-to-end tests', []],
  ['package', 'Package', []],
];
const results = path.join(os.tmpdir(), `gn-ci-${process.pid}.jsonl`);
fs.writeFileSync(results, '');
const started = Date.now();
for (const [i, [key, , args]] of STAGES.entries()) {
  if (!runStage(key, args, { CI_STAGE: `${i + 1}/${STAGES.length}`, CI_RESULTS: results }).passed) break;   // later stages don't run
}
// each stage's last result (a stage that ran again keeps its final attempt)
const got = {};
for (const l of fs.readFileSync(results, 'utf8').split('\n').filter(Boolean)) { const x = JSON.parse(l); got[x.stage] = x; }
fs.rmSync(results, { force: true });

// The summary: every stage with its result and time; green when all passed, red as soon as one didn't
const failedAt = STAGES.findIndex(([key]) => !got[key]?.passed);
const safe = failedAt < 0, paint = safe ? B.green : B.red, W = 64;
const rule = paint('─'.repeat(W));
const total = B.secs(Date.now() - started);
const rows = STAGES.map(([key, name], i) => {
  const g = got[key], no = String(i + 1);
  if (!g) return B.dim(` – ${no} ${name.padEnd(22)} ${'not run'.padEnd(22)}`);
  const shaky = g.passed && (g.flaky?.length || g.attempt > 1);              // passed, but only thanks to a retry
  const detail = g.attempt > 1 ? `${g.detail} (attempt ${g.attempt})` : g.detail;
  const text = ` ${!g.passed ? '✗' : shaky ? '⚠' : '✓'} ${no} ${name.padEnd(22)} ${String(detail).padEnd(22)} ${g.ms != null ? B.secs(g.ms).padStart(9) : ''}`;
  return !g.passed ? B.red(text) : shaky ? B.yellow(text) : B.green(text);
});
const flaky = STAGES.flatMap(([key, name]) => [
  ...(got[key]?.flaky || []).map(f => `${name}: ${f}`),
  ...(got[key]?.passed && got[key].attempt > 1 ? [`${name}: the whole stage passed on attempt ${got[key].attempt}`] : []),
]);
console.log(`\n${rule}\n${paint(` GAME NIGHT · ${label}`.padEnd(W - total.length - 1) + total)}\n${rule}\n${rows.join('\n')}\n${rule}`);
console.log(paint(safe ? ' ✓ ALL STAGES PASSED: safe to push' : ` ✗ STAGE ${failedAt + 1} (${STAGES[failedAt][1].toUpperCase()}) FAILED: not safe to push`));
if (flaky.length) console.log(B.yellow(` ⚠ ${flaky.length} flaky (passed only on a retry; worth fixing):\n${flaky.map(f => `   - ${f}`).join('\n')}`));
console.log(rule);
// Safe to push: how to release it (the next version from the tags this copy knows; scripts/release-hint.js)
if (safe) { try { console.log(require('./release-hint').lines().map(l => B.dim(` ${l}`)).join('\n') + '\n' + B.dim('─'.repeat(W))); } catch {} }
process.exit(safe ? 0 : 1);
