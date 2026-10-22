# Checks, pipeline and releases

Every change goes through the same checks before it can reach `main` or a release: on your Mac before a push, and on
GitHub after it.

| Step | Command | What fails it | Time |
|---|---|---|---|
| 1. Build check | `npm run check` | A JS file that doesn't parse; a page linking a missing file; a file missing from (or extra in) the offline cache list; a party game not registered everywhere it must be; `public/` changed but the cache `VERSION` in `sw.js` wasn't bumped | seconds |
| 2. Unit tests + coverage gate | `npm run coverage` | A failing unit test; a file whose share of lines run by the unit tests drops below its minimum in `coverage-thresholds.json`; a new file with no minimum | ~10 s |
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

`coverage-thresholds.json` holds each file's minimum (whole percentages, rounded down from the coverage when it was last
raised). The report is in `coverage/summary.txt` after each run.

- After adding tests, raise the minimums: `npm run coverage -- --update` (it never lowers them), and commit the file.
- A new file needs a minimum before the gate passes: write its tests, then `--update`.
- Some files are mostly screen code that only a browser runs (`roulette-view.js` draws the wheel, `admin-lock.js` uses
  Touch ID / passkeys, `leaderboard.js` draws its dialogs). Their minimums are low on purpose: the end-to-end tests cover
  them. The game rules (`games/`) are at 90–100%.

## Before every push (your Mac)

Once per clone: `npm run setup-hooks` (sets `git config core.hooksPath scripts/hooks`; undo with
`git config --unset core.hooksPath`). Then every `git push` runs `scripts/hooks/pre-push`:

- It refuses to run with uncommitted changes (the checks test the files on disk, which must be what you push).
- It runs the build check (with the cache-version check against what the remote already has), the unit tests with the
  coverage gate, the end-to-end tests and the package stage. If anything fails, nothing is pushed.
- `git push --no-verify` skips it (the GitHub pipeline still runs).

## On GitHub: the pipeline (`.github/workflows/pipeline.yml`)

One workflow, in stages; each starts only if the one before it passed. GitHub draws it as a graph on each run's page.

```
1 · Build ─▶ 2 · Unit tests ─▶ 3 · Coverage ─▶ 4 · End-to-end (macOS) ─▶ 5 · Package ─▶ 6 · Approve ─▶ 7 · Release
```

| Stage | Runs on | When | What |
|---|---|---|---|
| 1 · Build | Linux | every push and pull request | `npm run check`, with the cache-version check against the previous commit |
| 2 · Unit tests | Linux | ″ | every unit test (`coverage.js --tests-only`), recording which lines ran and handing that data to stage 3 |
| 3 · Coverage | Linux | ″ | the coverage gate on stage 2's data (`coverage.js --gate-only`; the tests aren't run again). A drop fails this stage on its own, with the file and the numbers; the table is shown on the run's summary page |
| 4 · End-to-end (macOS) | macOS (Chrome preinstalled) | ″ | `npm run test:e2e`, 2 at a time; logs and screenshots kept as a download |
| 5 · Package | Linux | ″ | `npm run package`: the zip and its smoke test; the zip is kept as a download for 2 weeks |
| 6 · Approve | — | releases only (Release button or version tag) | waits until you click **Approve** on the run (the `release` environment) |
| 7 · Release | Linux | releases only, after approval | checks the commit is on `main`, creates the tag (Release button), then publishes the GitHub release with the zip and generated notes. The only stage allowed to publish |

Free for a public repository, macOS included. A newer push to the same branch cancels a run still in progress (a
release run always finishes).

## Setting up GitHub (once)

The repository is [rishigoswamy/game-night](https://github.com/rishigoswamy/game-night). The pipeline starts running as
soon as a commit containing `.github/workflows/pipeline.yml` is pushed: see each run under the repository's **Actions** tab.

**The approval stage:** in the repository, **Settings → Environments → New environment**, name it `release`, tick
**Required reviewers** and add yourself (optionally **Prevent self-review** off, since you work alone; and under
**Deployment branches and tags**, allow only tags `v*`). Without this environment, stage 6 doesn't wait.

Then protect `main` so that only changes that passed the pipeline can reach it. In the repository on GitHub:
**Settings → Branches → Add branch protection rule** (or **Rules → Rulesets**), branch `main`:

- **Require a pull request before merging** (no approvals needed if you work alone).
- **Require status checks to pass**, and pick **1 · Build**, **2 · Unit tests**, **3 · Coverage**, **4 · End-to-end
  tests (macOS)** and **5 · Package** (they appear in the list after the pipeline has run once). Tick **Require branches to be
  up to date**.
- **Do not allow bypassing the above settings**, so it applies to you as the owner too.

The checks only show up in that list once they have run, so do the first push before adding the rule.

With this rule, `git push` straight to `main` is refused: changes go in through a branch and a pull request (below).

## Day to day

```sh
git switch -c tambola-sounds          # work on a branch
# … commit …
git push -u origin tambola-sounds     # pre-push checks on your Mac, then the pipeline on GitHub
gh pr create --fill                   # a pull request into main
gh pr merge --auto --merge            # merges by itself as soon as the pipeline is green
```

A release (only when you want one; everyday pushes need nothing extra). Either way it releases a commit on `main`,
runs all seven stages on it, and waits at stage 6 for you to click **Review deployments → Approve and deploy**.

**Option 1: the Release button** (no terminal). On GitHub, **Actions → Pipeline → Run workflow**, leave **Use workflow
from** on `main`, type the version (`1.0.1`, no "v") and click **Run workflow**. Stage 1 first checks the version (three
numbers, not used before) and the branch, so a typo fails in seconds; stage 7 creates the `v1.0.1` tag and publishes the
release.

**Or option 2: a tag from your Mac.** From an up-to-date `main`:

```sh
git switch main && git pull
git tag v1.0.1 && git push origin v1.0.1     # all seven stages: when stage 6 asks, open the run and click Approve
```

Both release the same way; use whichever is handier. Version numbers: `v1.0.1` for fixes, `v1.1.0` for new features,
`v2.0.0` for big changes.

## If the end-to-end tests fail only on GitHub

Download the **e2e-logs-and-screenshots** artifact from the run: each test has a `.log` and its screenshots. Two
things are specific to CI machines:

- The tests simulate phones through the machine's network address. If a runner has none, set `PHONE_HOST` for that
  step in `pipeline.yml`.
- They are slower than a desktop Mac; `E2E_WORKERS` (2 in CI) sets how many run at a time.
