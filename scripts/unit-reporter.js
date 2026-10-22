// A `node --test` reporter (used by scripts/coverage.js): one line per test as it finishes, numbered against the total,
//   [ 37/167] ✓ go fish: asks are refused when they break the rules  (2 ms)
// The total comes from UNIT_TOTAL, counted fresh just before the run (coverage.js lists the tests without running them),
// so it grows by itself as tests are added. A failed test also shows why and where.
const B = require('./banner');

module.exports = async function* progress(source) {
  const total = +process.env.UNIT_TOTAL || 0, width = String(total || 0).length;
  let done = 0;
  const tag = () => `[${String(++done).padStart(width)}/${total || '?'}]`;
  for await (const event of source) {
    const d = event.data || {};
    if ((event.type !== 'test:pass' && event.type !== 'test:fail') || d.nesting !== 0 || d.skip) continue;   // top-level tests only
    const ms = d.details?.duration_ms != null ? B.dim(`  (${Math.round(d.details.duration_ms)} ms)`) : '';
    if (event.type === 'test:pass') { yield `${B.dim(tag())} ${B.green('✓')} ${d.name}${ms}\n`; continue; }
    const err = d.details?.error, cause = err?.cause || err;
    const why = String(cause?.message || err?.message || 'failed').split('\n').slice(0, 8).map(l => `        ${l}`).join('\n');
    const where = d.file ? `        at ${require('path').relative(process.cwd(), d.file)}${d.line ? `:${d.line}` : ''}` : '';
    yield `${B.dim(tag())} ${B.red(`✗ ${d.name}`)}${ms}\n${B.red(why)}\n${where ? B.dim(where) + '\n' : ''}`;
  }
};
