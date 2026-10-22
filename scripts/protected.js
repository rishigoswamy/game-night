#!/usr/bin/env node
// Protected files (docs/CI.md): the files listed in .github/CODEOWNERS may only reach main or a release tag through
// their owner. Run by the pipeline's stage 1:
//   - a push to main or a version tag by someone else, changing a protected file: fails (so it can't be released);
//   - a pull request or a push to another branch: lists the protected files it changes, as needing the owner's review
//     (GitHub's "Require review from Code Owners" enforces that review on the pull request).
//   node scripts/protected.js --base <commit>     compares <commit> with HEAD; who pushed comes from GITHUB_ACTOR
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// CODEOWNERS lines → [{ pattern, owners }]; owners are written @name
function parseOwners(text) {
  return text.split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean)
    .map(l => { const [pattern, ...owners] = l.split(/\s+/); return { pattern, owners: owners.map(o => o.replace(/^@/, '')) }; });
}
// CODEOWNERS / .gitignore-style patterns: "/x" from the top of the repo, "x/" a whole folder, "*" and "?" within a name,
// "**" across folders; a pattern without "/" matches that name anywhere
function matches(pattern, file) {
  const anchored = pattern.startsWith('/'), dir = pattern.endsWith('/');
  let p = pattern.replace(/^\//, '').replace(/\/$/, '');
  const re = p.split('**').map(part => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')).join('.*');
  const prefix = anchored || p.includes('/') ? '^' : '(^|/)';
  return new RegExp(`${prefix}${re}${dir ? '/' : '(/|$)'}`).test(file);
}
// For each changed file, its owners (the last matching line wins, as on GitHub); files nobody owns are left out
function protectedChanges(changed, rules) {
  return changed.map(file => {
    const rule = [...rules].reverse().find(r => matches(r.pattern, file));
    return rule && rule.owners.length ? { file, owners: rule.owners } : null;
  }).filter(Boolean);
}
// The decision: { fail, message, files }. `ref` is what was pushed (refs/heads/main, refs/tags/v1.0.0, a branch, or a
// pull request's merge ref); `actor` is who pushed it.
function decide({ changed, rules, actor, event, ref }) {
  const files = protectedChanges(changed, rules);
  if (!files.length) return { fail: false, files, message: 'No protected files changed.' };
  const owners = [...new Set(files.flatMap(f => f.owners))];
  const list = files.map(f => `  ${f.file}  (${f.owners.map(o => '@' + o).join(', ')})`).join('\n');
  const intoMain = event === 'push' && (ref === 'refs/heads/main' || /^refs\/tags\/v/.test(ref || ''));
  const byOwner = files.every(f => f.owners.includes(actor));
  if (intoMain && !byOwner) {
    return { fail: true, files, message: `Protected files changed on ${ref.replace(/^refs\/(heads|tags)\//, '')} by @${actor}, who doesn't own them:\n${list}\nOnly their owner may change these (.github/CODEOWNERS). Revert the change, or send it as a pull request for ${owners.map(o => '@' + o).join(', ')} to review.` };
  }
  if (byOwner) return { fail: false, files, message: `Protected files changed by their owner @${actor}:\n${list}` };
  return { fail: false, files, warn: true, message: `This changes protected files, so it needs ${owners.map(o => '@' + o).join(', ')}'s review before it reaches main:\n${list}` };
}

module.exports = { parseOwners, matches, protectedChanges, decide };

if (require.main === module) {
  const i = process.argv.indexOf('--base'), base = i > 0 ? process.argv[i + 1] : '';
  const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  if (!base || /^0+$/.test(base) || git('cat-file', '-e', `${base}^{commit}`).status !== 0) {
    console.log(`Protected files: nothing to compare with${base ? ` (${base.slice(0, 7)} isn't a commit here)` : ''}.`);
    process.exit(0);
  }
  const rules = parseOwners(fs.readFileSync(path.join(ROOT, '.github/CODEOWNERS'), 'utf8'));
  const changed = git('diff', '--name-only', base, 'HEAD').stdout.split('\n').filter(Boolean);
  const env = process.env;
  const d = decide({ changed, rules, actor: env.GITHUB_ACTOR || '', event: env.GITHUB_EVENT_NAME || '', ref: env.GITHUB_REF || '' });
  if (d.fail) { console.error(`✗ ${d.message}`); if (env.GITHUB_ACTIONS) console.log(`::error title=Protected files::${d.message.split('\n')[0]}`); process.exit(1); }
  console.log(`✓ ${d.message}`);
  if (d.warn && env.GITHUB_ACTIONS) console.log(`::warning title=Protected files::${d.message.split('\n')[0]}`);
}
