#!/usr/bin/env node
// Reminders about versions and releases, from the same rules as the Release workflow (scripts/next-version.js):
//   - require('./release-hint').lines(): what the next release would be, and how to release (the end of the e2e run)
//   - as git's prepare-commit-msg hook (scripts/hooks/prepare-commit-msg): when git opens the editor for a commit
//     message, a short guide to [minor] / [major] is added as # comment lines, which git removes from the message;
//     with `git commit -m`, the same is printed in the terminal instead (comment lines would stay in a -m message).
// It reads the tags this copy of the repo knows; `git fetch --tags` brings in releases made on GitHub.
const fs = require('fs');
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

// For the end of a successful run (the ci summary, or e2e on its own): the next release and how to make it. Not how to
// ask for a bigger bump: the commits are already made by then (the commit-time hint covers that)
function lines() {
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

module.exports = { lines, state };

// prepare-commit-msg <message file> [source]: source is empty when git opens the editor; "message" for -m / -F;
// "template", "merge", "squash" or "commit" (amend) otherwise
if (require.main === module && process.argv[2] === 'commit-msg') {
  const [, , , file, source = ''] = process.argv;
  if (source === 'merge' || source === 'squash') process.exit(0);
  try {
    const typed = fs.readFileSync(file, 'utf8');
    const s = state(typed.split('\n').filter(l => !l.startsWith('#')).join('\n'));
    if (!s.last) {                                               // nothing released yet: the next release is simply v1.0.0
      if (!source || source === 'template') fs.appendFileSync(file, '#\n# Release version: the first release will be v1.0.0. After that, [minor] / [major] in a message bumps more.\n');
      process.exit(0);
    }
    if (!source || source === 'template') {                      // the editor opens: a guide as comments, removed by git
      fs.appendFileSync(file, [
        '#',
        '# ── Release version ──────────────────────────────────────────────────',
        `# This commit goes into ${s.next} (${s.asked}; latest release ${s.last}).`,
        `#   patch  ${s.patch.padEnd(8)} fixes and tweaks: nothing to add (the default)`,
        `#   minor  ${s.minor.padEnd(8)} a new feature in a game: add [minor] to the message`,
        `#   major  ${s.major.padEnd(8)} a new game (or a big change): add [major] to the message`,
        '# Releases wait for your Approve on GitHub (Actions → Release).',
        '',
      ].join('\n'));
    } else {                                                     // -m / -F / amend: the message is set; say it in the terminal
      const hint = s.asked === 'patch'
        ? `This commit goes into ${s.next} (patch). A feature in a game? git commit --amend and add [minor] (→ ${s.minor}); a new game: [major] (→ ${s.major}).`
        : `This commit goes into ${s.next} (${s.asked}, as [${s.asked}] asks).`;
      process.stderr.write(`\x1b[2mℹ ${hint}\x1b[0m\n`);
    }
  } catch { /* never block a commit over a hint */ }
}
