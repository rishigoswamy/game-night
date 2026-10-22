#!/usr/bin/env node
// Runs one pipeline stage (used by `npm run ci` and by each step of the GitHub pipeline):
//   node scripts/stage.js build|unit|coverage|e2e|package [arguments for the stage]
// A test stage that still fails after its own test retries (unit, e2e) runs again as a whole, after a pause, up to
// STAGE_RETRIES times (default 3). Build check, coverage and package give the same answer every time, so they don't.
const path = require('path');
const { spawnSync } = require('child_process');
const B = require('./banner');

const ROOT = path.resolve(__dirname, '..');
const STAGES = {
  build: { name: 'Build check', script: ['scripts/check.js'], retry: false },
  unit: { name: 'Unit tests', script: ['scripts/coverage.js', '--tests-only'], retry: true },
  coverage: { name: 'Coverage', script: ['scripts/coverage.js', '--gate-only'], retry: false },
  e2e: { name: 'End-to-end tests', script: ['test/e2e/run.js'], retry: true },
  package: { name: 'Package', script: ['scripts/package.js'], retry: false },
};

// Returns { passed, attempts }
function runStage(key, args = [], env = {}) {
  const st = STAGES[key];
  if (!st) throw new Error(`unknown stage "${key}" (${Object.keys(STAGES).join(', ')})`);
  const attempts = st.retry ? 1 + B.retries.stage : 1;
  for (let a = 1; a <= attempts; a++) {
    const r = spawnSync(process.execPath, [...st.script, ...args], { cwd: ROOT, stdio: 'inherit',
      env: { ...process.env, ...env, STAGE_ATTEMPT: String(a), STAGE_ATTEMPTS: String(attempts) } });
    if (r.status === 0) {
      if (a > 1) B.warn(`⚠ ${st.name} passed on stage attempt ${a} of ${attempts}: flaky`);
      return { passed: true, attempts: a };
    }
    if (a < attempts) {
      console.log('');
      B.warn(`⟳ ${st.name} failed: running the whole stage again in ${B.retries.delay} s (stage retry ${a} of ${attempts - 1})`);
      B.sleepSync(B.retries.delay);
    }
  }
  return { passed: false, attempts };
}

module.exports = { runStage, STAGES };
if (require.main === module) {
  const [key, ...args] = process.argv.slice(2);
  try { process.exit(runStage(key, args).passed ? 0 : 1); } catch (e) { B.fail(e.message); process.exit(2); }
}
