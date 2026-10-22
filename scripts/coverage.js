#!/usr/bin/env node
// Unit tests with a coverage gate (npm run coverage). Runs the unit tests once with V8 coverage on (the browser files run
// inside the tests' sandbox, the server as a child process), then compares each file's line coverage with
// coverage-thresholds.json. It fails if a test fails, if a file drops below its minimum, or if a new file has none.
//   npm run coverage                      tests + gate; report in coverage/summary.txt (and .json)
//   npm run coverage -- --update          raise the minimums to today's coverage (they never go down this way)
// The pipeline runs the two halves as separate stages, so a coverage drop shows as its own failed stage:
//   node scripts/coverage.js --tests-only  the unit tests, keeping their coverage data in coverage/raw (no gate)
//   node scripts/coverage.js --gate-only   the gate, from coverage/raw (the tests aren't run again)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const B = require('./banner');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'coverage');
const LIMITS = path.join(ROOT, 'coverage-thresholds.json');
const testsOnly = process.argv.includes('--tests-only'), gateOnly = process.argv.includes('--gate-only');
const KEPT = path.join(OUT, 'raw');                   // the coverage data handed from the tests stage to the gate stage
const raw = testsOnly || gateOnly ? KEPT : fs.mkdtempSync(path.join(os.tmpdir(), 'gn-cov-'));
const tests = fs.readdirSync(path.join(ROOT, 'test/unit')).filter(f => f.endsWith('.test.js')).map(f => path.join('test/unit', f));

// 1. The unit tests, with coverage
if (gateOnly) {
  if (!fs.existsSync(raw) || !fs.readdirSync(raw).length) { B.fail(`no coverage data in ${path.relative(ROOT, raw)}: run --tests-only first`); process.exit(1); }
} else {
  B.banner('UNIT TESTS', 'Unit tests', `${tests.length} test files: game rules, leaderboards, admin lock, server`);
  const t0 = Date.now();
  fs.rmSync(raw, { recursive: true, force: true }); fs.mkdirSync(raw, { recursive: true });
  // One run of `node --test`: the usual output on screen, and a TAP copy to count the tests and find the failed ones
  // (by name and file). Every run adds its coverage data to the same folder, so retries count too.
  const nodeTest = args => {
    const tap = path.join(os.tmpdir(), `gn-unit-${process.pid}-${Date.now()}.tap`);
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...args],
      { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_V8_COVERAGE: raw } });
    let out = ''; try { out = fs.readFileSync(tap, 'utf8'); } catch {}
    fs.rmSync(tap, { force: true });
    const count = k => +(out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] || 0;
    const failed = [...out.matchAll(/^not ok \d+ - (.*)\n(?:(?!(?:not )?ok ).*\n)*?\s+location: '(.+?):\d+:\d+'/gm)]
      .map(m => ({ name: m[1].replace(/\\#/g, '#'), file: path.relative(ROOT, m[2]) }));
    return { status: r.status, pass: count('pass'), fail: count('fail'), failed };
  };
  const escapeRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let res = nodeTest(tests);
  const total = res.pass + res.fail;
  let failing = res.failed, flaky = [];
  // Retries at the end: only the tests that failed, by name, after a pause (a crash we can't pin down reruns everything)
  for (let r = 1; r <= B.retries.test && res.status !== 0; r++) {
    console.log('');
    B.warn(`⟳ Retrying ${failing.length ? `${failing.length} failed unit test${failing.length === 1 ? '' : 's'}` : 'the unit tests'} in ${B.retries.delay} s (retry ${r} of ${B.retries.test})${failing.length ? `: ${failing.map(f => f.name).join(', ')}` : ''}`);
    B.sleepSync(B.retries.delay);
    const before = failing;
    res = failing.length ? nodeTest([...failing.map(f => `--test-name-pattern=^${escapeRe(f.name)}$`), ...new Set(failing.map(f => f.file))]) : nodeTest(tests);
    if (before.length) {
      flaky.push(...before.filter(f => !res.failed.some(x => x.name === f.name && x.file === f.file)).map(f => ({ ...f, retry: r })));
      failing = res.failed;
    } else failing = res.failed;
  }
  const passed = res.status === 0, ms = Date.now() - t0;
  const flakyNote = flaky.length ? ` · ${flaky.length} flaky` : '';
  B.record('unit', passed, passed ? `${total} tests${flakyNote}` : `${failing.length || '?'} of ${total} failed`, ms, flaky.map(f => `${f.name} (retry ${f.retry})`));
  if (!passed) { B.fail(`Unit tests failed: ${failing.length ? `${failing.length} of ${total}` : 'see above'}${B.retries.test ? ` after ${B.retries.test} ${B.retries.test === 1 ? 'retry' : 'retries'}` : ''}  (${B.secs(ms)})`); failing.forEach(f => console.error(B.red(`   ✗ ${f.name}  (${f.file})`))); process.exit(1); }
  B.ok(`Unit tests passed: ${total} of ${total}${flakyNote}  (${B.secs(ms)})`);
  flaky.forEach(f => B.warn(`   ⚠ flaky: ${f.name}  (${f.file}) passed on retry ${f.retry}`));
  if (testsOnly) { console.log(B.dim(`coverage data kept in ${path.relative(ROOT, raw)} for the coverage stage`)); process.exit(0); }
}
B.banner('COVERAGE', 'Coverage', 'each file against its minimum in coverage-thresholds.json', gateOnly ? 0 : 1);
const gateStarted = Date.now();

// 2. Merge the coverage of every test process: a character counts as run if any process ran it
const files = {};
for (const f of fs.readdirSync(raw)) {
  for (const s of JSON.parse(fs.readFileSync(path.join(raw, f), 'utf8')).result) {
    // sandboxed browser files are named by their path in public/; others by their full path, which may come from another
    // checkout of the project (the pipeline's tests stage), so match them by their path inside the project
    let rel = s.url.startsWith('file://') ? path.relative(ROOT, decodeURIComponent(s.url.slice(7))) : 'public/' + s.url;
    if (rel.startsWith('..')) { const m = decodeURIComponent(s.url).match(/\/((?:public|server)\/(?:(?!\/(?:public|server)\/).)*)$/); rel = m ? m[1] : rel; }
    if (!/^(public|server)\//.test(rel) || !fs.existsSync(path.join(ROOT, rel))) continue;
    const src = (files[rel] ||= { src: fs.readFileSync(path.join(ROOT, rel), 'utf8') }).src;
    const hit = files[rel].hit ||= new Uint8Array(src.length);
    const count = new Int32Array(src.length).fill(-1);
    for (const fn of s.functions) for (const r of fn.ranges) count.fill(r.count, r.startOffset, Math.min(r.endOffset, src.length));
    for (let k = 0; k < src.length; k++) if (count[k] > 0) hit[k] = 1;
  }
}
if (!gateOnly && !testsOnly) fs.rmSync(raw, { recursive: true, force: true });

// 3. Line coverage: a line of code counts as run if any of its code ran (comments, blank lines and lone brackets don't count)
const report = Object.entries(files).map(([rel, { src, hit }]) => {
  let off = 0, total = 0;
  const missed = [];
  src.split('\n').forEach((line, n) => {
    const code = line.trim();
    if (code && !code.startsWith('//') && !/^[})\]]+[;,)]*$/.test(code)) {
      total++;
      let ran = false;
      for (let k = off; k < off + line.length && !ran; k++) ran = hit[k] && !/\s/.test(src[k]);
      if (!ran) missed.push(n + 1);
    }
    off += line.length + 1;
  });
  return { file: rel, lines: total, missed: missed.length, pct: Math.floor((1 - missed.length / total) * 1000) / 10, missedLines: missed };
}).sort((a, b) => a.file.localeCompare(b.file));
const total = report.reduce((a, r) => ({ lines: a.lines + r.lines, missed: a.missed + r.missed }), { lines: 0, missed: 0 });
const totalPct = Math.floor((1 - total.missed / total.lines) * 1000) / 10;

// 4. The gate
const limits = fs.existsSync(LIMITS) ? JSON.parse(fs.readFileSync(LIMITS, 'utf8')) : { total: 0, files: {} };
const problems = [];
for (const r of report) {
  const min = limits.files[r.file];
  if (min == null) problems.push(`${r.file}: new file with no minimum yet (${r.pct}%). Add tests, then run npm run coverage -- --update`);
  else if (r.pct < min) problems.push(`${r.file}: ${r.pct}% of lines run by the unit tests, below its minimum ${min}%`);
}
for (const f of Object.keys(limits.files)) if (!report.some(r => r.file === f) && fs.existsSync(path.join(ROOT, f))) problems.push(`${f}: no longer run by any unit test (minimum ${limits.files[f]}%)`);
if (totalPct < limits.total) problems.push(`total: ${totalPct}%, below the minimum ${limits.total}%`);

const lines = report.map(r => `${String(r.pct).padStart(5)}%  (min ${String(limits.files[r.file] ?? '—').padStart(4)})  ${r.file}  ${r.missed ? `${r.missed} of ${r.lines} lines not run` : `all ${r.lines} lines run`}`);
const summary = `Unit test coverage (lines)\n${lines.join('\n')}\n${String(totalPct).padStart(5)}%  (min ${String(limits.total).padStart(4)})  TOTAL  ${total.lines - total.missed} of ${total.lines} lines\n`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'summary.txt'), summary);
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ total: totalPct, files: report }, null, 1));
console.log(summary);

if (process.argv.includes('--update')) {
  // whole percentages, rounded down: a little slack for a new line or two, but a real drop fails
  const files = Object.fromEntries(report.map(r => [r.file, Math.max(Math.floor(r.pct), limits.files[r.file] ?? 0)]));
  fs.writeFileSync(LIMITS, JSON.stringify({ total: Math.max(Math.floor(totalPct), limits.total), files }, null, 2) + '\n');
  console.log(`minimums updated in ${path.relative(ROOT, LIMITS)}`);
  process.exit(0);
}
B.record('coverage', !problems.length, `${totalPct}%${problems.length ? ' (dropped)' : ''}`, Date.now() - gateStarted);
if (problems.length) { B.fail(`Coverage dropped: ${problems.length} problem${problems.length === 1 ? '' : 's'}  (total ${totalPct}%)`); console.error(`- ${problems.join('\n- ')}`); process.exit(1); }
B.ok(`Coverage passed: every file at or above its minimum  (total ${totalPct}%, minimum ${limits.total}%)`);
