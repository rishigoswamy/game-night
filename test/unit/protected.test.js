// Protected files (scripts/protected.js reading .github/CODEOWNERS): which files only the owner may change, and what
// the pipeline does when someone else changes them
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseOwners, matches, protectedChanges, decide } = require('../../scripts/protected');

const REAL = parseOwners(fs.readFileSync(path.resolve(__dirname, '..', '..', '.github', 'CODEOWNERS'), 'utf8'));

test('patterns: from the top of the repo, whole folders, wildcards', () => {
  assert.ok(matches('/scripts/', 'scripts/coverage.js'));
  assert.ok(matches('/scripts/', 'scripts/hooks/pre-push'), 'a folder includes its subfolders');
  assert.ok(!matches('/scripts/', 'test/scripts/x.js'), '"/" anchors it to the top');
  assert.ok(!matches('/scripts/', 'scripts.js'));
  assert.ok(matches('/package.json', 'package.json'));
  assert.ok(!matches('/package.json', 'node_modules/x/package.json'));
  assert.ok(matches('package.json', 'node_modules/x/package.json'), 'without "/", a name anywhere');
  assert.ok(matches('/Start*.command', 'Start Game Night.command'), 'a wildcard covers the spaces in the name');
  assert.ok(matches('/docs/**/*.md', 'docs/a/b/c.md'));
  assert.ok(!matches('/public/sw.js', 'public/sw.json'));
});

test('the real CODEOWNERS: the agreed files are protected; games, pages, docs and tests are open', () => {
  const owned = f => protectedChanges([f], REAL).length === 1;
  for (const f of ['.github/CODEOWNERS', '.github/workflows/pipeline.yml', '.github/workflows/release.yml', 'coverage-thresholds.json',
    'scripts/coverage.js', 'scripts/check.js', 'scripts/hooks/pre-push', 'scripts/protected.js', 'test/e2e/run.js', 'test/e2e/helpers.js',
    'test/e2e/party-setup.js', 'test/unit/helpers.js', 'docs/CI.md', 'package.json', 'package-lock.json', 'server/server.js',
    'Start Game Night.command', 'public/js/lib/admin-lock.js', 'public/sw.js']) assert.ok(owned(f), `${f} is protected`);
  for (const f of ['public/games/party/tambola.js', 'public/party.html', 'public/css/pages/party.css', 'public/js/lib/leaderboard.js',
    'docs/ARCHITECTURE.md', 'README.md', 'test/unit/party-tambola.test.js', 'test/e2e/party-gofish.js']) assert.ok(!owned(f), `${f} is open`);
  assert.deepEqual([...new Set(REAL.flatMap(r => r.owners))], ['rishigoswamy'], 'one owner');
  for (const f of fs.readFileSync(path.resolve(__dirname, '..', '..', '.github', 'CODEOWNERS'), 'utf8').split('\n')
    .map(l => l.replace(/#.*/, '').trim().split(/\s+/)[0]).filter(Boolean)) {
    const target = path.join(__dirname, '..', '..', f.replace(/\*.*$/, ''));
    assert.ok(f.includes('*') || fs.existsSync(target), `${f} exists (a typo would protect nothing)`);
  }
});

const rules = parseOwners('/scripts/ @owner\n/coverage-thresholds.json @owner\n');
test('someone else pushing a protected file to main or a release tag fails; to a branch or in a pull request it asks for review', () => {
  const changed = ['public/games/party/bluff.js', 'coverage-thresholds.json'];
  let d = decide({ changed, rules, actor: 'mallory', event: 'push', ref: 'refs/heads/main' });
  assert.equal(d.fail, true);
  assert.match(d.message, /on main by @mallory, who doesn't own them:\n  coverage-thresholds.json  \(@owner\)/);
  assert.equal(decide({ changed, rules, actor: 'mallory', event: 'push', ref: 'refs/tags/v1.2.0' }).fail, true, 'a release tag too');
  d = decide({ changed, rules, actor: 'mallory', event: 'pull_request', ref: 'refs/pull/7/merge' });
  assert.equal(d.fail, false); assert.equal(d.warn, true);
  assert.match(d.message, /needs @owner's review before it reaches main/);
  d = decide({ changed, rules, actor: 'mallory', event: 'push', ref: 'refs/heads/her-branch' });
  assert.equal(d.fail, false, 'on her own branch it\'s only a note: the review happens on the pull request');
});

test('the owner changing protected files passes; changes to open files need nothing', () => {
  let d = decide({ changed: ['scripts/ci.js'], rules, actor: 'owner', event: 'push', ref: 'refs/heads/main' });
  assert.equal(d.fail, false); assert.match(d.message, /changed by their owner @owner/);
  d = decide({ changed: ['public/party.html', 'README.md'], rules, actor: 'mallory', event: 'push', ref: 'refs/heads/main' });
  assert.equal(d.fail, false); assert.equal(d.message, 'No protected files changed.');
});

test('adding yourself as an owner doesn\'t help: the list itself is protected', () => {
  const d = decide({ changed: ['.github/CODEOWNERS'], rules: REAL, actor: 'mallory', event: 'push', ref: 'refs/heads/main' });
  assert.equal(d.fail, true);
  assert.match(d.message, /\.github\/CODEOWNERS  \(@rishigoswamy\)/);
});
