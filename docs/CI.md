# Checks, pipeline and releases

Every change goes through the same checks before it can reach `main` or a release: on your Mac before a push, and on
GitHub after it.

| Step | Command | What fails it | Time |
|---|---|---|---|
| 1. Build check | `npm run check` | A JS file that doesn't parse; a page linking a missing file; a file missing from (or extra in) the offline cache list; a party game not registered everywhere it must be; `public/` changed but the cache `VERSION` in `sw.js` wasn't bumped | seconds |
| 2. Unit tests + coverage gate | `npm run coverage` | A failing unit test; a file whose share of lines run by the unit tests drops below its minimum in `coverage-thresholds.json`; a new file with no minimum | ~10 s |
| 3. End-to-end tests | `npm run test:e2e` | Any of the browser tests (real games, simulated phones) | ~5 min |
| 4. Package | `npm run package` | The release zip is missing something or holds what it shouldn't (tests, CI files), or, unpacked somewhere new, it doesn't install, start and serve the main pages | ~15 s |

`npm run ci` runs all four in order and stops at the first failure. The zip goes to `dist/` (`npm run package -- v1.2.0`
names it after a version; it packs the last commit, so commit first).

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
| 6 · Approve | — | version tags only | waits until you click **Approve** on the run (the `release` environment) |
| 7 · Release | Linux | version tags only, after approval | checks the tag is on `main`, then publishes the GitHub release with the zip and generated notes. The only stage allowed to publish |

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

A release, from an up-to-date `main`:

```sh
git switch main && git pull
git tag v1.0.0 && git push origin v1.0.0     # all seven stages: when stage 6 asks, open the run and click Approve
```

## If the end-to-end tests fail only on GitHub

Download the **e2e-logs-and-screenshots** artifact from the run: each test has a `.log` and its screenshots. Two
things are specific to CI machines:

- The tests simulate phones through the machine's network address. If a runner has none, set `PHONE_HOST` for that
  step in `pipeline.yml`.
- They are slower than a desktop Mac; `E2E_WORKERS` (2 in CI) sets how many run at a time.
