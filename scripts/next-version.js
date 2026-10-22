#!/usr/bin/env node
// Works out which version a release gets (used by .github/workflows/release.yml; docs/CI.md):
//   - an automatic release candidate: the next PATCH after the latest release, or the next MINOR / MAJOR if a commit
//     since that release says [minor] / [major];
//   - the Release button: the bump chosen in its dropdown (patch / minor / major), or an exact version typed in;
//   - a tag pushed from a Mac: that tag.
// The first release is v1.0.0. A version must be new and higher than the latest release.
const { spawnSync } = require('child_process');

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;
const parse = v => { const m = String(v || '').trim().match(SEMVER); return m ? [+m[1], +m[2], +m[3]] : null; };
const fmt = ([a, b, c]) => `v${a}.${b}.${c}`;
const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
// The newest vX.Y.Z among these tags (other tags are ignored), or null
const latest = tags => tags.map(parse).filter(Boolean).sort(cmp).at(-1) || null;
// Which part to bump, from the commit messages since the last release: [major] beats [minor] beats a patch
const bumpFrom = messages => (messages.some(m => /\[major\]/i.test(m)) ? 'major' : messages.some(m => /\[minor\]/i.test(m)) ? 'minor' : 'patch');
function bump(v, part) {
  if (!v) return [1, 0, 0];                                       // the first release
  const [a, b, c] = v;
  return part === 'major' ? [a + 1, 0, 0] : part === 'minor' ? [a, b + 1, 0] : [a, b, c + 1];
}

// The decision, from plain inputs (unit-tested in test/unit/release-version.test.js).
// Returns { tag, why } for a release, { skip: why } when there's nothing to release, or { error } for a mistake.
function decide({ tags = [], messages = [], bump: chosen = '', exact = '', pushedTag = '', alreadyTagged = false }) {
  const last = latest(tags);
  if (pushedTag) {                                                 // a tag pushed from a Mac: release exactly that
    const v = parse(pushedTag);
    if (!v || !pushedTag.startsWith('v')) return { error: `Release tags look like v1.0.1 (got ${pushedTag}).` };
    return { tag: fmt(v), why: `the tag ${pushedTag} pushed from a Mac` };
  }
  if (exact) {                                                     // an exact version typed on the Release button
    const v = parse(exact);
    if (!v) return { error: `Type an exact version as 1.0.1 (three numbers). Got: ${exact}` };
    if (tags.includes(fmt(v))) return { error: `${fmt(v)} already exists: pick a new version.` };
    if (last && cmp(v, last) <= 0) return { error: `${fmt(v)} isn't higher than the latest release ${fmt(last)}.` };
    return { tag: fmt(v), why: `the exact version typed on the Release button` };
  }
  if (chosen) {                                                    // the Release button's dropdown
    if (!['patch', 'minor', 'major'].includes(chosen)) return { error: `Unknown bump "${chosen}" (patch, minor or major).` };
    return { tag: fmt(bump(last, chosen)), why: `${chosen} chosen on the Release button${last ? ` (latest release ${fmt(last)})` : ' (first release)'}` };
  }
  // an automatic release candidate after a green push to main
  if (alreadyTagged) return { skip: 'this commit is already released' };
  if (last && !messages.length) return { skip: `nothing new since ${fmt(last)}` };
  const part = bumpFrom(messages);
  return { tag: fmt(bump(last, part)), why: last ? `${part}${part === 'patch' ? ' (the default)' : ` ([${part}] in a commit message)`} after ${fmt(last)}` : 'the first release' };
}

module.exports = { decide, parse, bumpFrom, latest: tags => (latest(tags) ? fmt(latest(tags)) : null) };

// In the Release workflow: reads git, prints the decision, writes it for the next steps (GITHUB_OUTPUT) and the run's
// summary page (GITHUB_STEP_SUMMARY). Inputs come from the environment: SHA, BUMP, EXACT, PUSHED_TAG.
if (require.main === module) {
  const git = (...a) => spawnSync('git', a, { encoding: 'utf8' }).stdout.trim();
  const env = process.env, sha = env.SHA || git('rev-parse', 'HEAD');
  const tags = git('tag', '--list', 'v*').split('\n').filter(Boolean);
  const last = module.exports.latest(tags);
  const range = last ? `${last}..${sha}` : sha;
  const messages = git('log', '--format=%B%x00', range).split('\0').map(m => m.trim()).filter(Boolean);
  const alreadyTagged = git('tag', '--points-at', sha).split('\n').some(t => parse(t));
  const d = decide({ tags, messages, bump: env.BUMP, exact: env.EXACT, pushedTag: env.PUSHED_TAG, alreadyTagged });
  const out = (k, v) => env.GITHUB_OUTPUT && require('fs').appendFileSync(env.GITHUB_OUTPUT, `${k}=${v}\n`);
  const summary = t => env.GITHUB_STEP_SUMMARY && require('fs').appendFileSync(env.GITHUB_STEP_SUMMARY, t + '\n');
  if (d.error) { console.error(`✗ ${d.error}`); summary(`### ✗ No release\n${d.error}`); process.exit(1); }
  if (d.skip) { console.log(`Nothing to release: ${d.skip}.`); summary(`### Nothing to release\n${d.skip}.`); out('skip', 'true'); process.exit(0); }
  console.log(`Release ${d.tag}: ${d.why}. Commit ${sha.slice(0, 7)}.`);
  summary(`### Release ${d.tag}\n${d.why}, commit \`${sha.slice(0, 7)}\`.\n\nApprove it below (**Review deployments**) to publish, or reject it to skip this one.`);
  out('tag', d.tag); out('skip', 'false');
}
