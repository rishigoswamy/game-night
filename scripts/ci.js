#!/usr/bin/env node
// All the checks in order, as in the GitHub pipeline (npm run ci; also what the pre-push hook runs), then a summary:
// green "safe to push" if every stage passed, red "not safe to push" if one failed (the stages after it don't run).
//   npm run ci                       the five stages
//   node scripts/ci.js --base <ref>  the build check also checks the cache version against <ref> (the hook passes it)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const B = require('./banner');

const ROOT = path.resolve(__dirname, '..');
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : ''; };
const base = arg('--base'), label = arg('--label') || 'npm run ci';
const STAGES = [                                   // [key, name, script and its arguments, CI_STAGE]
  ['build', 'Build check', ['scripts/check.js', ...(base ? ['--base', base] : [])], '1/5'],
  ['unit', 'Unit tests', ['scripts/coverage.js'], '2/5'],          // coverage.js runs stages 2 and 3
  ['coverage', 'Coverage', null, null],
  ['e2e', 'End-to-end tests', ['test/e2e/run.js'], '4/5'],
  ['package', 'Package', ['scripts/package.js'], '5/5'],
];
const results = path.join(os.tmpdir(), `gn-ci-${process.pid}.jsonl`);
fs.writeFileSync(results, '');
const started = Date.now();
let stopped = false;
for (const [, , script, stage] of STAGES) {
  if (!script || stopped) continue;
  const r = spawnSync(process.execPath, script, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CI_STAGE: stage, CI_RESULTS: results } });
  if (r.status !== 0) stopped = true;
}
const got = Object.fromEntries(fs.readFileSync(results, 'utf8').split('\n').filter(Boolean).map(l => { const x = JSON.parse(l); return [x.stage, x]; }));
fs.rmSync(results, { force: true });

// The summary: every stage with its result and time; green when all passed, red as soon as one didn't
const failedAt = STAGES.findIndex(([key]) => !got[key]?.passed);
const safe = failedAt < 0, paint = safe ? B.green : B.red, W = 56;
const rule = paint('─'.repeat(W));
const total = B.secs(Date.now() - started);
const rows = STAGES.map(([key, name], i) => {
  const g = got[key], no = String(i + 1);
  if (!g) return B.dim(` – ${no} ${name.padEnd(22)} ${'not run'.padEnd(14)}`);
  const text = ` ${g.passed ? '✓' : '✗'} ${no} ${name.padEnd(22)} ${String(g.detail).padEnd(14)} ${g.ms != null ? B.secs(g.ms).padStart(9) : ''}`;
  return g.passed ? B.green(text) : B.red(text);
});
console.log(`\n${rule}\n${paint(` GAME NIGHT · ${label}`.padEnd(W - total.length - 1) + total)}\n${rule}\n${rows.join('\n')}\n${rule}`);
console.log(paint(safe ? ' ✓ ALL STAGES PASSED: safe to push' : ` ✗ STAGE ${failedAt + 1} (${STAGES[failedAt][1].toUpperCase()}) FAILED: not safe to push`));
console.log(rule);
process.exit(safe ? 0 : 1);
