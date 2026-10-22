// How the pipeline's stages look in a terminal (and in GitHub's logs): a big banner when a stage starts, and a green ✓ or
// red ✗ line when it ends. Used by check.js, coverage.js, package.js and the end-to-end runner.
// The stage number comes from CI_STAGE ("2/5"), set by `npm run ci` and by the GitHub pipeline; without it, no number.
// Colours only on a real terminal or in GitHub Actions (NO_COLOR turns them off; FORCE_COLOR turns them on).

// A 5-row block font, just the letters the stage names use
const FONT = {
  A: [' ██ ', '█  █', '████', '█  █', '█  █'], B: ['███ ', '█  █', '███ ', '█  █', '███ '], C: [' ███', '█   ', '█   ', '█   ', ' ███'],
  D: ['███ ', '█  █', '█  █', '█  █', '███ '], E: ['████', '█   ', '███ ', '█   ', '████'], G: [' ███', '█   ', '█ ██', '█  █', ' ███'],
  I: ['███', ' █ ', ' █ ', ' █ ', '███'], K: ['█  █', '█ █ ', '██  ', '█ █ ', '█  █'], L: ['█   ', '█   ', '█   ', '█   ', '████'],
  N: ['█  █', '██ █', '█ ██', '█  █', '█  █'], O: [' ██ ', '█  █', '█  █', '█  █', ' ██ '], P: ['███ ', '█  █', '███ ', '█   ', '█   '],
  R: ['███ ', '█  █', '███ ', '█ █ ', '█  █'], S: [' ███', '█   ', ' ██ ', '   █', '███ '], T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  U: ['█  █', '█  █', '█  █', '█  █', ' ██ '], V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '], 2: ['███ ', '   █', ' ██ ', '█   ', '████'],
  ' ': ['  ', '  ', '  ', '  ', '  '],
};
const color = !process.env.NO_COLOR && (!!process.env.FORCE_COLOR || !!process.env.GITHUB_ACTIONS || process.stdout.isTTY);
const paint = code => text => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
const gold = paint('1;33'), green = paint('1;32'), red = paint('1;31'), dim = paint('2');

const letters = word => [0, 1, 2, 3, 4].map(r => [...word.toUpperCase()].map(c => (FONT[c] || FONT[' '])[r]).join(' ').trimEnd()).join('\n');
// The stage this script is: CI_STAGE "2/5" → { n: 2, of: 5 }; `offset` for a script that runs two stages (unit tests, then coverage)
function stageNo(offset = 0) {
  const m = String(process.env.CI_STAGE || '').match(/^(\d+)\/(\d+)$/);
  return m ? { n: +m[1] + offset, of: +m[2] } : null;
}
// The banner at the start of a stage: big letters, then "Stage n of m · title · what it does"
function banner(word, title, about, offset = 0) {
  const s = stageNo(offset), rule = '─'.repeat(72);
  console.log(`\n${gold(letters(word))}\n${dim(rule)}\n ${s ? `Stage ${s.n} of ${s.of} · ` : ''}${title}${about ? ` · ${about}` : ''}\n${dim(rule)}`);
}
const secs = ms => (ms >= 90000 ? `${(ms / 60000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`);
const ok = text => console.log(green(`✓ ${text}`));
const fail = text => console.error(red(`✗ ${text}`));

// A stage's result for the summary at the end of `npm run ci` (scripts/ci.js sets CI_RESULTS to a file it reads back)
function record(stage, passed, detail, ms) {
  if (!process.env.CI_RESULTS) return;
  require('fs').appendFileSync(process.env.CI_RESULTS, JSON.stringify({ stage, passed, detail, ms }) + '\n');
}

module.exports = { banner, ok, fail, green, red, gold, dim, secs, letters, record };
