// How a release's version is chosen (scripts/next-version.js, used by .github/workflows/release.yml)
const test = require('node:test');
const assert = require('node:assert/strict');
const { decide, bumpFrom, latest } = require('../../scripts/next-version');

test('release candidates: the next patch by default; [minor] / [major] in a commit since the last release bump more', () => {
  const tags = ['v1.4.3', 'v1.4.2', 'v1.0.0'];
  assert.equal(decide({ tags, messages: ['Fix Tambola ball shine'] }).tag, 'v1.4.4');
  assert.equal(decide({ tags, messages: ['Tweak colours', 'Add Uno party game [minor]'] }).tag, 'v1.5.0');
  assert.equal(decide({ tags, messages: ['New look [MAJOR]', 'Add a game [minor]'] }).tag, 'v2.0.0', '[major] wins, any case');
  assert.match(decide({ tags, messages: ['x'] }).why, /patch \(the default\) after v1\.4\.3/);
});

test('release candidates: the first release is v1.0.0; nothing new or already released is skipped', () => {
  assert.equal(decide({ tags: [], messages: ['Initial commit'] }).tag, 'v1.0.0');
  assert.equal(decide({ tags: [], messages: ['Big start [major]'] }).tag, 'v1.0.0', 'the first release is 1.0.0 whatever the keyword');
  assert.match(decide({ tags: ['v1.0.0'], messages: [] }).skip, /nothing new since v1\.0\.0/);
  assert.match(decide({ tags: ['v1.0.0'], messages: ['x'], alreadyTagged: true }).skip, /already released/);
});

test('the latest release is the highest vX.Y.Z (not the newest in the list, not other tags)', () => {
  assert.equal(latest(['v1.9.0', 'v1.10.0', 'v1.2.0', 'nightly', 'v2.0.0-beta']), 'v1.10.0');
  assert.equal(latest(['nightly']), null);
  assert.equal(decide({ tags: ['v1.9.0', 'v1.10.0'], messages: ['x'] }).tag, 'v1.10.1', '1.10 is higher than 1.9');
});

test('a manual release: the chosen bump raises patch, minor or major; an exact version must be new and higher', () => {
  const tags = ['v1.4.3'];
  assert.equal(decide({ tags, bump: 'patch' }).tag, 'v1.4.4');
  assert.equal(decide({ tags, bump: 'minor' }).tag, 'v1.5.0');
  assert.equal(decide({ tags, bump: 'major' }).tag, 'v2.0.0');
  assert.equal(decide({ tags: [], bump: 'minor' }).tag, 'v1.0.0', 'first release');
  assert.equal(decide({ tags, bump: 'patch', messages: [] }).tag, 'v1.4.4', 'the button releases even with nothing new');
  assert.equal(decide({ tags, exact: '1.6.0', bump: 'patch' }).tag, 'v1.6.0', 'an exact version overrides the dropdown');
  assert.equal(decide({ tags, exact: 'v1.6.0' }).tag, 'v1.6.0', 'with or without the v');
  assert.match(decide({ tags, exact: '1.4.3' }).error, /already exists/);
  assert.match(decide({ tags, exact: '1.4.0' }).error, /isn't higher than the latest release v1\.4\.3/);
  assert.match(decide({ tags, exact: '1.6' }).error, /three numbers/);
  assert.match(decide({ tags, bump: 'huge' }).error, /Unknown bump/);
});

test('a tag pushed from a Mac releases exactly that tag; it must look like v1.0.1', () => {
  assert.equal(decide({ tags: ['v1.4.3', 'v1.5.0'], pushedTag: 'v1.5.0' }).tag, 'v1.5.0');
  assert.match(decide({ pushedTag: '1.5.0' }).error, /look like v1\.0\.1/);
  assert.match(decide({ pushedTag: 'v1.5' }).error, /look like v1\.0\.1/);
});

test('bump keywords: only [minor] / [major] in brackets count', () => {
  assert.equal(bumpFrom(['minor fix', 'a major cleanup']), 'patch', 'the plain words don\'t count');
  assert.equal(bumpFrom(['Add a game\n\nDetails… [minor]']), 'minor', 'anywhere in the message');
});

test('only published releases count: a stray tag can\'t change the numbers, and a release can\'t land on it', () => {
  const released = ['v1.0.2', 'v2.0.0'];
  // someone pushed a tag v9.9.9 that was never released: the next candidate still follows v2.0.0
  assert.equal(decide({ tags: released, taken: [...released, 'v9.9.9'], messages: ['x'] }).tag, 'v2.0.1');
  // a stray tag sits exactly where the next version would go: stop, rather than publish onto it
  assert.match(decide({ tags: released, taken: [...released, 'v2.0.1'], messages: ['x'] }).error, /v2\.0\.1 is already taken by a tag that was never released/);
  assert.match(decide({ tags: released, taken: [...released, 'v2.1.0'], bump: 'minor' }).error, /already taken/);
  assert.match(decide({ tags: released, taken: [...released, 'v3.0.0'], exact: '3.0.0' }).error, /already exists/);
  assert.equal(decide({ tags: released, taken: [...released, 'v3.0.0'], exact: '3.1.0' }).tag, 'v3.1.0', 'an exact version steps past it');
  assert.equal(decide({ tags: released, taken: [...released, 'v2.0.1'], pushedTag: 'v2.0.1' }).tag, 'v2.0.1', 'a tag pushed to be released is fine');
});
