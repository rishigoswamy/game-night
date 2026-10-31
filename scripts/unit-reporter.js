// A `node --test` reporter (used by scripts/coverage.js and test/unit/run.js): each suite (describe) as a heading, its
// tests indented under it, each numbered against the total as it finishes:
//            Bluff
//   [ 37/253]   ✓ calling a lie → the liar takes the pile, the caller leads  (2 ms)
// The total comes from UNIT_TOTAL, counted fresh just before the run (the tests are listed without running them),
// so it grows by itself as tests are added. A failed test also shows why and where.
// Test files run in parallel, so a suite is printed whole once it has finished: its lines never mix with another file's.
// The file's name goes above its first suite.
const path = require('path');
const B = require('./banner');

module.exports = async function* progress(source) {
  const total = +process.env.UNIT_TOTAL || 0, width = String(total || 0).length;
  const pad = ' '.repeat(width * 2 + 3);                          // as wide as "[ 37/253]"
  let done = 0;
  const tag = () => `[${String(++done).padStart(width)}/${total || '?'}]`;
  const pending = new Map();                                        // per file: finished lines waiting for their suite to end
  let lastFile = null;                                              // the file name heads its first suite (and again if files take turns)
  const fileHead = key => { if (key === lastFile) return ''; lastFile = key; return key ? `\n${B.dim(path.relative(process.cwd(), key))}\n` : ''; };
  // A finished test or suite as a function, so the numbers are given out in the order lines are printed
  const testLine = (d, failed) => () => {
    const ms = d.details?.duration_ms != null ? B.dim(`  (${Math.round(d.details.duration_ms)} ms)`) : '';
    const indent = '  '.repeat(d.nesting);
    if (!failed) return `${B.dim(tag())} ${indent}${B.green('✓')} ${d.name}${ms}\n`;
    const err = d.details?.error, cause = err?.cause || err;
    const why = String(cause?.message || err?.message || 'failed').split('\n').slice(0, 8).map(l => `        ${indent}${l}`).join('\n');
    const where = d.file ? `        ${indent}at ${path.relative(process.cwd(), d.file)}${d.line ? `:${d.line}` : ''}` : '';
    return `${B.dim(tag())} ${indent}${B.red(`✗ ${d.name}`)}${ms}\n${B.red(why)}\n${where ? B.dim(where) + '\n' : ''}`;
  };
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const d = event.data || {}, failed = event.type === 'test:fail', key = d.file || '';
    const list = pending.get(key) || [];
    pending.set(key, list);
    if (d.details?.type === 'suite') {
      // its tests (and inner suites) are the lines collected since it started: deeper than the suite itself
      let k = list.length;
      while (k > 0 && list[k - 1].nesting > d.nesting) k--;
      const inside = list.splice(k);
      if (!inside.length) continue;                                 // everything in it was filtered out (--grep)
      const heading = () => `${pad} ${'  '.repeat(d.nesting)}${failed ? B.red(`✗ ${d.name}`) : B.gold(d.name)}\n`;
      const lines = [heading, ...inside.flatMap(x => x.lines)];
      if (d.nesting === 0) { yield fileHead(key) + lines.map(f => f()).join(''); continue; }
      list.push({ nesting: d.nesting, lines });
      continue;
    }
    if (d.skip) continue;                                           // filtered out by --grep
    if (d.nesting === 0) { yield fileHead(key) + testLine(d, failed)(); continue; }   // a test outside any suite: straight away
    list.push({ nesting: d.nesting, lines: [testLine(d, failed)] });
  }
};

// The failed tests in a TAP report as { name, file }, suites left out (a suite fails when a test in it does). Each
// `not ok` line, at any depth, with the location and type from the block indented under it.
module.exports.failedTests = (tap, root) => {
  const lines = String(tap).split('\n'), out = [];
  lines.forEach((line, k) => {
    const m = line.match(/^(\s*)not ok \d+ - (.*)$/);
    if (!m) return;
    let file = null, suite = false;
    for (let j = k + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t && lines[j].length - lines[j].trimStart().length <= m[1].length) break;
      if (t === "type: 'suite'") suite = true;
      const loc = t.match(/^location: '(.+?):\d+:\d+'$/);
      if (loc && !file) file = path.relative(root, loc[1]);
    }
    if (!suite) out.push({ name: m[2].replace(/ # (TODO|SKIP)\b.*$/, '').replace(/\\#/g, '#'), file });
  });
  return out;
};
