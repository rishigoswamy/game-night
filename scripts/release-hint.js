#!/usr/bin/env node
// Reminders about versions and releases, from the same rules as the Release workflow (scripts/next-version.js):
//   - require('./release-hint').lines(): what the next release would be, and how to release (the end of the e2e run)
// It reads the tags this copy of the repo knows. Releases are made on GitHub (their tags don't come back with a push), so
// it fetches tags first (for a few seconds at most) before saying what the next version is.
const { spawnSync } = require('child_process');
const { parse, bumpFrom } = require('./next-version');

const git = (...a) => spawnSync('git', a, { encoding: 'utf8' }).stdout?.trim() || '';
const fmt = ([a, b, c]) => `v${a}.${b}.${c}`;
const up = (v, part) => (!v ? [1, 0, 0] : part === 'major' ? [v[0] + 1, 0, 0] : part === 'minor' ? [v[0], v[1] + 1, 0] : [v[0], v[1], v[2] + 1]);

// Where versions stand: the latest release, the bump the commits since then already ask for, and each possible next one
function state(extraMessage = '') {
  const tags = git('tag', '--list', 'v*').split('\n').map(parse).filter(Boolean);
  const last = tags.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]).at(-1) || null;
  const since = git('log', '--format=%B%x00', last ? `${fmt(last)}..HEAD` : 'HEAD').split('\0').map(m => m.trim()).filter(Boolean);
  const asked = bumpFrom([...since, extraMessage].filter(Boolean));
  return { last: last && fmt(last), asked, next: fmt(up(last, asked)), patch: fmt(up(last, 'patch')), minor: fmt(up(last, 'minor')), major: fmt(up(last, 'major')) };
}

// For the end of a successful run (the ci summary, or e2e on its own): the next release and how to make it
// Bring in tags made on GitHub. wait: block up to a few seconds (the summary); otherwise run in the background
function refreshTags(wait) {
  const args = ['fetch', '--quiet', '--tags', 'origin'];
  if (wait) { spawnSync('git', args, { timeout: 5000, stdio: 'ignore' }); return; }
  try { require('child_process').spawn('git', args, { detached: true, stdio: 'ignore' }).unref(); } catch {}
}

function lines() {
  refreshTags(true);
  const s = state();
  if (!s.last) return [
    'Next release: v1.0.0, the first release.',
    'To release: push to main and approve the release candidate on GitHub (Actions → Release),',
    '  or tag it yourself:  git tag v1.0.0 && git push origin v1.0.0',
  ];
  return [
    `Next release: ${s.next} (${s.asked === 'patch' ? `patch; latest release ${s.last}` : `${s.asked}, as a commit since ${s.last} asks`}).`,
    'To release: push to main and approve the release candidate on GitHub (Actions → Release),',
    `  or tag it yourself:  git tag ${s.next} && git push origin ${s.next}`,
  ];
}

module.exports = { lines, state, refreshTags };
