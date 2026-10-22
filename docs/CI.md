# Checks, pipeline and releases

Every change goes through the same checks before it can reach `main` or a release: on your Mac before a push, and on
GitHub after it.

| Step | Command | What fails it | Time |
|---|---|---|---|
| 1. Build check | `npm run check` | A JS file that doesn't parse; a page linking a missing file; a file missing from (or extra in) the offline cache list; a party game not registered everywhere it must be; `public/` changed but the cache `VERSION` in `sw.js` wasn't bumped | seconds |
| 2. Unit tests + coverage gate | `npm run coverage` | A failing unit test; a file below 80% of its lines run by the unit tests, or the whole project below 85% (`coverage-thresholds.json`); a tested file that stops being tested | ~10 s |
| 3. End-to-end tests | `npm run test:e2e` | Any of the browser tests (real games, simulated phones) | ~5 min |
| 4. Package | `npm run package` | The release zip is missing something or holds what it shouldn't (tests, CI files), or, unpacked somewhere new, it doesn't install, start and serve the main pages | ~15 s |

`npm run ci` (`scripts/ci.js`) runs them in order (unit tests and coverage as two stages) and stops at the first failure.
Each stage starts with a big banner and ends with a green ✓ or red ✗ line (each end-to-end test gets its own); at the end a
summary lists every stage with its result and time, green "safe to push" or red "not safe to push". The pre-push hook
runs the same thing. The zip goes to `dist/` (`npm run package -- v1.2.0`
names it after a version; it packs the last commit, so commit first).

## Progress counters

Each test is numbered as it finishes, against the total for that run: `[ 37/167] ✓ …` for unit tests, `[ 3/28] ✓ …` for
end-to-end tests (and `[1/2]` in a retry round, counting the tests being retried). The totals are never written down:

- **Unit tests:** just before the run, Node lists every test without running any (about 0.2 s) and the count is passed
  to the progress reporter (`scripts/unit-reporter.js`).
- **End-to-end tests:** the runner finds them fresh each run: every script in `test/e2e/` except the runner itself and
  the shared modules (the files that export something: `helpers.js`, `party-setup.js`). A new test file runs, and
  counts, without being listed anywhere.

## Retries

Two kinds, the same locally (`npm run ci`, the pre-push hook) and on GitHub (every stage runs through `scripts/stage.js`):

1. **Failed tests, retried at the end.** A test stage runs every test first; then only the tests that failed run again,
   after a pause, up to 3 more times. Unit tests are retried one by one by name; end-to-end tests by test, keeping the
   usual rules (3 at a time, the voice tests apart, `update-bar` alone). Each attempt's log is kept (`<test>.retry1.log`).
2. **The whole stage, run again.** If the unit tests or the end-to-end tests still fail after that, the whole stage
   runs again (with its own test retries), after a pause, up to 3 more times. Build check, coverage and package give
   the same answer every time for the same code, so they fail straight away.

Anything that passes only on a retry counts as passed (safe to push) but is shown in **yellow as flaky**: on its own
line (`⚠ party-gofish … passed on retry 1: flaky`), in the stage's result, and listed at the end of the summary. A flaky
test is a real timing problem to fix, not noise.

| Setting | Default | |
|---|---|---|
| `TEST_RETRIES` | 3 | retries of each failed test (4 runs at most); `0` turns them off |
| `STAGE_RETRIES` | 3 | reruns of a failed test stage (unit, e2e); `0` turns them off |
| `RETRY_DELAY` | 10 | seconds before each retry |

For example `TEST_RETRIES=0 STAGE_RETRIES=0 npm run ci` shows every failure at once, with no retries. On GitHub the
end-to-end stage may take up to 75 minutes when it has to retry (about 11 normally).

## Coverage minimums

In the pipeline the tests and the gate are separate stages (2 and 3) on the same test run: `coverage.js --tests-only`
keeps the coverage data in `coverage/raw`, `coverage.js --gate-only` judges it. Locally `npm run coverage` does both.

The rule (`coverage-thresholds.json`): **every file at least 80%** of its lines run by the unit tests, and **the whole
project at least 85%**. Coverage is measured afresh on every run; these are the bars it's compared with. The report is
in `coverage/summary.txt` after each run (`*` marks an exception).

- **Exceptions:** files below 80% today keep their own minimum until their tests improve (`exceptions`; currently
  `admin-lock.js` 61, `leaderboard.js` 63, `server.js` 70: mostly code only a browser or macOS runs, which the
  end-to-end tests cover). After improving one, run `npm run coverage -- --update` and commit the file: an exception
  rises with the coverage (never falls), and leaves the list once its file reaches 80%.
- **Tested files** (`files`): every file the unit tests run. A file on the list that stops being tested at all fails the
  gate, even if the total still looks fine. `--update` refreshes the list.
- **A new file** must reach 80% like any other: no setup needed beyond writing its tests (then `--update` to add it to
  the list).

## Before every push (your Mac)

Once per clone: `npm run setup-hooks` (sets `git config core.hooksPath scripts/hooks`; undo with
`git config --unset core.hooksPath`). Then every `git push` runs `scripts/hooks/pre-push`:

- It refuses to run with uncommitted changes (the checks test the files on disk, which must be what you push).
- It runs the build check (with the cache-version check against what the remote already has), the unit tests with the
  coverage gate, the end-to-end tests and the package stage. If anything fails, nothing is pushed.
- `git push --no-verify` skips it (the GitHub pipeline still runs).

The same command installs `scripts/hooks/prepare-commit-msg`: every commit shows which release version it leads to
(`scripts/release-hint.js`). When git opens the editor, a short guide sits under your message as `#` comment lines, which
git removes; with `git commit -m`, one line in the terminal says the version and how to amend for `[minor]` / `[major]`.
It never blocks a commit. When every stage passes, the summary at the end of `npm run ci` (and of the pre-push
hook) adds the same reminder: the next version and the commands to release it; a successful `npm run test:e2e` run on
its own ends with it too. (They read the tags your copy knows; `git fetch --tags` brings in releases made on GitHub.)

## On GitHub: the pipeline (`.github/workflows/pipeline.yml`)

One workflow, in stages; each starts only if the one before it passed. GitHub draws it as a graph on each run's page.

```
1 · Build ─▶ 2 · Unit tests ─▶ 3 · Coverage ─▶ 4 · End-to-end (macOS) ─▶ 5 · Package
```

| Stage | Runs on | What |
|---|---|---|
| 1 · Build | Linux | `npm run check`, with the cache-version check against the previous commit (for a version tag: also that it looks like `v1.0.1` and is on `main`) |
| 2 · Unit tests | Linux | every unit test (`coverage.js --tests-only`), recording which lines ran and handing that data to stage 3 |
| 3 · Coverage | Linux | the coverage gate on stage 2's data (`coverage.js --gate-only`; the tests aren't run again). A drop fails this stage on its own, with the file and the numbers; the table is shown on the run's summary page |
| 4 · End-to-end (macOS) | macOS (Chrome preinstalled) | `npm run test:e2e`, 2 at a time; logs and screenshots kept as a download |
| 5 · Package | Linux | `npm run package`: the zip and its smoke test; the zip is kept as a download for 2 weeks |

It runs on every push to any branch, every pull request into `main` and every version tag. Free for a public
repository, macOS included. A newer push to the same branch cancels a run still in progress.

## On GitHub: releases (`.github/workflows/release.yml`)

A separate **Release** workflow (so the pipeline's own runs stay green). Every release is a commit on `main` that has
passed the pipeline, and every release waits for you:

```
Version ─▶ Approve vX.Y.Z (waits for you) ─▶ Publish vX.Y.Z
```

1. **Version** works out the number (`scripts/next-version.js`) and shows it on the run's summary page.
2. **Approve vX.Y.Z** waits until you open the run and click **Review deployments**, tick `release`, then
   **Approve and deploy** (or **Reject**: that release is skipped). Not answering also skips it; GitHub gives up after
   30 days.
3. **Publish vX.Y.Z** packages the zip (smoke-tested), creates the tag and publishes the GitHub release with the zip
   and notes generated from the changes since the last release. The only job allowed to publish.

**Three ways a release starts:**

| Way | How | Version |
|---|---|---|
| **Automatic candidate** | After every green pipeline run on `main` | The next **patch** after the latest release, or the next **minor** / **major** if a commit since then says `[minor]` / `[major]` |
| **Manual release** | **Actions → Release → Run workflow** (from `main`); optionally say what's in it (the run's title and the first line of the release notes) | Pick **patch / minor / major**, or type an exact version (`1.5.0`) |
| **Tag from your Mac** | `git tag v1.5.0 && git push origin v1.5.0`; released once the pipeline passes for it | Exactly that tag |

- **Versions** are `MAJOR.MINOR.PATCH`: patch for fixes and tweaks (`1.4.3 → 1.4.4`), minor for a new feature in a
  game (`→ 1.5.0`), major for a new game or a big change (`→ 2.0.0`). The first release is `v1.0.0`. The next version
  always follows the latest release, however it was made.
- **Bumping in a commit:** put `[minor]` or `[major]` anywhere in a commit message (title or description); the next
  candidate after it uses that bump. Major is rare, so it's always a deliberate word or a choice in a manual release.
- **Candidates are skipped freely:** a newer candidate replaces one still waiting, and a rejected or ignored one never
  blocks anything. A commit with nothing new since the last release (or already released) makes no candidate.
- A manual release checks that the latest `main` has passed the pipeline; an exact version must be new and higher than the
  latest release. Mistakes fail in seconds, with the reason on the run's page.

## Setting up GitHub (once)

The repository is [rishigoswamy/game-night](https://github.com/rishigoswamy/game-night). The pipeline starts running as
soon as a commit containing `.github/workflows/pipeline.yml` is pushed: see each run under the repository's **Actions** tab.

**The approval step:** in the repository, **Settings → Environments → New environment**, name it `release`, tick
**Required reviewers** and add yourself, and leave **Prevent self-review** off (you approve your own releases). Under
**Deployment branches and tags**, either leave **No restriction** or choose **Selected branches and tags** and add the
**branch** `main`: every release runs from `main`, so a rule allowing only tags would block them all. Without this
environment, releases publish without waiting for you.

**`main` and the release tags are protected by rulesets** (Settings → Rules → Rulesets; created with `gh api`, October 2026):

| Ruleset | Rules | Who may bypass |
|---|---|---|
| **Protect main's history** | Block force pushes; restrict deletions | Nobody, not even the owner: `main`'s history can't be rewritten or deleted |
| **Changes go through checks** | Require a pull request (approvals: 0), Require review from Code Owners, Require status checks: **1 · Build**, **2 · Unit tests**, **3 · Coverage**, **4 · End-to-end tests (macOS)**, **5 · Package** | **Repository admin** (the owner) |
| **Release tags are permanent** (tags `v*`) | Restrict deletions; restrict updates; block force pushes | Nobody: a published version can never be deleted or moved to another commit |

Tags can still be *created* by anyone with write access (today only the owner): GitHub only lets an organisation's
repositories trust the Release workflow with a creation rule. That's safe: a tag isn't a release until the Release
workflow publishes it after your Approve, and version numbers count only **published GitHub Releases**, so a stray tag
changes nothing. Because tags are permanent, a mistaken one stays: it isn't released, and you use the next version
(the Release workflow never publishes onto an existing tag that points at another commit, or reuses a stray tag's
version).

As the only collaborator you keep both ways of working: push straight to `main` (GitHub notes "bypassed rule
violations"), or a branch and a pull request, merged with **Merge without waiting for requirements to be met (bypass
rules)** when it touches protected files (GitHub never lets you approve your own pull request). The pipeline still runs
on every push, and releases still wait for your Approve.

**When you add a collaborator:**
1. In **Changes go through checks**, set **Required approvals** to **1**: every change of theirs then reaches `main`
   only once you approve it (and protected files need you as code owner anyway). They can't push to `main` directly,
   rewrite it, or release.
2. Keep the `release` environment's required reviewer as you only.
3. Optional: remove **Repository admin** from the bypass list if you want your own changes to go through pull requests
   and checks too (you'd lose direct pushes to `main`).

## Protected files

Some files decide whether code is accepted, released or run on someone's computer, so only the owner may change them.
They are listed in [`.github/CODEOWNERS`](../.github/CODEOWNERS):

| Group | Files |
|---|---|
| The protection list, the pipeline and releases | `.github/` (`CODEOWNERS`, `workflows/`) |
| The quality gate | `coverage-thresholds.json`, `scripts/`, `test/e2e/run.js`, the shared test helpers (`test/unit/helpers.js`, `test/e2e/helpers.js`, `test/e2e/party-setup.js`), this file (`docs/CI.md`) |
| Dependencies | `package.json`, `package-lock.json` |
| Runs on the host's computer / security | `server/`, `Start Game Night.command`, `public/js/lib/admin-lock.js`, `public/sw.js` |

Games, pages, styles, other docs and individual tests stay open: that's ordinary development, and the coverage rules
(protected) catch a weakened test.

**Two locks:**

1. **Review:** with branch protection's **Require review from Code Owners**, a pull request that touches a protected file
   can't be merged until the owner approves it. Other pull requests merge as usual.
2. **The pipeline** (`scripts/protected.js`, in stage 1, reading the same `CODEOWNERS`): if a protected file reaches
   `main` or a release tag through anyone but its owner, stage 1 fails, so it can't be released. On a pull request or
   another branch it lists the protected files touched, as needing the owner's review.

**Adding yourself as an owner doesn't work:** `CODEOWNERS` is on its own list (so changing it needs the owner's review),
GitHub reads it from `main` rather than from the pull request (an edit can't decide its own reviewers), and GitHub ignores
owners without write access to the repository.

## Day to day

```sh
git switch -c tambola-sounds          # work on a branch
# … commit …
git push -u origin tambola-sounds     # pre-push checks on your Mac, then the pipeline on GitHub
gh pr create --fill                   # a pull request into main
gh pr merge --auto --merge            # merges by itself as soon as the pipeline is green
```

A release: approve the waiting candidate on the latest **Release** run (Actions → Release), or start one yourself
with a manual release or a tag (see [Releases](#on-github-releases-githubworkflowsreleaseyml)):

```sh
git switch main && git pull
git tag v1.0.1 && git push origin v1.0.1     # once the pipeline passes, open the Release run and click Approve
```

## If the end-to-end tests fail only on GitHub

Download the **e2e-logs-and-screenshots** artifact from the run: each test has a `.log` and its screenshots. Two
things are specific to CI machines:

- The tests simulate phones through the machine's network address. If a runner has none, set `PHONE_HOST` for that
  step in `pipeline.yml`.
- They are slower than a desktop Mac; `E2E_WORKERS` (2 in CI) sets how many run at a time.
