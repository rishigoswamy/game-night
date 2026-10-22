# Game Night

[![Pipeline](https://github.com/rishigoswamy/game-night/actions/workflows/pipeline.yml/badge.svg)](https://github.com/rishigoswamy/game-night/actions/workflows/pipeline.yml)

Casino tables and party games for a room full of people. One computer is the **master**: it runs the
game and shows the table, ideally on a TV. Everyone else plays on **their own phone**. Phones join by
scanning a QR code, and every phone must be on the **same Wi-Fi** as the master.

No accounts, no app to install, no internet needed once it's set up. Chips are pretend; no real money is involved.

| Casino | Party games |
|---|---|
| Roulette, Blackjack, Baccarat, Dragon Tiger, Sic Bo, Craps | One Night Werewolf, Mafia, Catan, Go Fish, Bluff, Tambola |
| A talking dealer opens a betting window; everyone bets from their phone. | The master screen runs the game (narrates Werewolf and Mafia, calls the Tambola numbers); everyone plays on their phone. |

**Contents:** [Set up once](#1-set-up-once) · [Start the game](#2-start-the-game-become-the-master) ·
[Stop the game](#3-stop-the-game) · [Hosting guide](#hosting-a-game-night) · [Players' guide](#for-players) ·
[Troubleshooting](#troubleshooting) · [For developers](#for-developers)

---

## 1. Set up once

You need a computer for the master screen. A Mac works best: the dealer then speaks with the Mac's own voice.
Windows and Linux work too (the dealer uses the browser's voice there).

1. **Install Node.js.** Go to [nodejs.org](https://nodejs.org), download the **LTS** version and install it like any other
   app. (Any version from 18 up runs the game; it is tested on 20.)
2. **Get Game Night onto the computer.** Any of these:
   - **Download a release** (simplest, once one has been published): on the
     [Releases page](https://github.com/rishigoswamy/game-night/releases), download `game-night-v….zip` from the latest
     release and double-click it to unpack. It holds just what's needed to play.
   - **Download the code:** on the [project page](https://github.com/rishigoswamy/game-night) click **Code → Download ZIP**
     and unpack it.
   - **With git:** `git clone https://github.com/rishigoswamy/game-night.git`
   - Or someone gives you the `game-night` folder.

   Put the folder somewhere easy to find, such as your home folder.
3. **Allow phones to connect, once.** The first time you start the game (next step), the computer may ask whether
   **node** may accept incoming network connections:
   - Mac: *"Do you want the application node to accept incoming network connections?"* → **Allow**
   - Windows: *"Windows Defender Firewall has blocked some features"* → tick **Private networks** → **Allow access**

   If you miss or refuse it, phones won't be able to join; see [Troubleshooting](#troubleshooting).

That's it. Game Night uses one small package (for the "scan to join" QR code). The Mac starter below installs it
by itself the first time; with the Terminal you run `npm install` once. Either way this needs internet once.

## 2. Start the game (become the master)

**On a Mac, the easy way:** open the `game-night` folder and double-click **`Start Game Night.command`**.
A Terminal window opens and the home page opens in your browser. (If a Game Night tab is already open, no new tab
opens; that tab reconnects by itself.)

> If macOS refuses to open it the first time ("unidentified developer" / "Apple could not verify…"), click **Done**,
> then open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to
> *Start Game Night.command*. (On older macOS: right-click the file → **Open** → **Open**.) You only do this once.

**Any computer, with the Terminal.** The Terminal is a window where you type commands
(Mac: Applications → Utilities → **Terminal**; Windows: Start menu → **PowerShell**). Type each line and press Enter:

```sh
cd path/to/game-night     # e.g.  cd ~/game-night   (or drag the folder onto the Terminal window after typing "cd ")
npm install               # first time only
npm start
```

The Terminal then shows something like:

```
Game Night running on port 8080
  This computer:  http://localhost:8080
  Phones on Wi-Fi: http://192.168.1.20:8080
```

- Open **http://localhost:8080** in a browser on the master computer (Chrome or Safari). This screen is the master.
- Phones scan the **QR code** on the home page, or type the "Phones on Wi-Fi" address into their browser.
- **Keep the Terminal window open** for as long as you play. It is the game's engine. Don't close the laptop lid either.

Only if something else already uses 8080: start on another number with `npm start -- 9000`
and use `:9000` instead of `:8080` in the addresses.

## 3. Stop the game

- **Close the Terminal window**, or click into it and press **Control + C**. The game stops for everyone.
- Your leaderboards, recent results and settings are saved in the master computer's browser, so they're still there
  next time, as long as you use the same browser (not a private window).
- **Lost the Terminal window but the game is still running?**
  - Mac/Linux: open a new Terminal and run `lsof -ti tcp:8080 | xargs kill`
  - Windows: open Task Manager, find **Node.js JavaScript Runtime** and click **End task**

  Then start it again as usual.

---

## Hosting a game night

**Before guests arrive**
- Start the game (above) and put the master screen on the TV if you can. Turn the volume up: the dealer talks.
- Click anywhere on the page once. Browsers only allow sound after a click; if you see an orange **Sound check** bar, click it.
- Stop the computer from sleeping during the evening: on a Mac, open a spare Terminal window and run `caffeinate -d`
  (it keeps the screen awake until you close that window), or change System Settings → Lock Screen.
- Optional: set an **admin PIN** on the Admin page (the **Table admin** link at the bottom of the home page).
  You need it to erase leaderboards or recent results. On a Mac you can also unlock with Touch ID.
- Late arrivals: the QR code is on the home page and the lobbies, and during a game the **📱 Join** button at the
  top of the master screen shows it (plus the address, e.g. `http://192.168.1.20:8080`) without stopping the game.

**Casino tables** (home page → **Enter the Casino** → pick a table)
1. Choose the starting chips, number of rounds and the betting window. For Roulette and Blackjack keep
   **Table style: Casino** (the default); phones can only join a Casino-style table. Then:
   - **Start** with named players, or
   - **Open the table now (players join later)** to let people come and go all evening.
2. Guests scan the QR code, tap **+ Add player**, type a name and bet from their phone. A table has 6 seats in all, and
   a phone can bring several players; only that phone can bet for them. At Blackjack each phone also plays its own
   hands (Hit, Stand, Double, Split). You can add players on the master screen too, for people without a phone.
3. When the betting window closes, the dealer plays the round; 5 seconds after the result the next window opens.
   (With phones at the table the window always has a timer; nobody can cut it short.)
4. **Cash out** (during betting) takes a player's chips off the table and puts them on the leaderboard.
5. **Pause** / **Exit** are at the top of the master screen.

**Party games** (home page → **Play party games** → pick a game)
1. Players scan the QR code on the game's lobby screen and type their name. They appear on the master screen.
   Someone who arrives mid-game is seated for the next one.

   | Game | Players | Notes |
   |---|---|---|
   | One Night Werewolf | 3–10 | 22 roles grouped Beginner / Intermediate / Advanced; hover a role in the lobby for its full rules ([details](docs/2026-10-werewolf-roles.md)) |
   | Mafia | 4–16 | Nights and days until one side wins: 22 roles, trials and verdicts, the dead watch as spectators ([rules](docs/2026-10-mafia.md)) |
   | Catan | 2–4 | Choose the points to win |
   | Go Fish | 2–6 | |
   | Bluff | 3–8 | |
   | Tambola (Housie) | 2–10 | Traditional calls; prizes from Early Five to Full House ([details](docs/2026-10-tambola.md)) |
2. Pick the options and click **Start**.
3. Nobody plays on the master screen. It shows the table; in Werewolf and Mafia it narrates out loud (Mafia's trials too), and in Tambola it is
   the caller (the board of numbers called, **Pause** and **Next number now**).
4. At the end: **Play again** (same players) or **Change players**. **End game** stops a game early (nothing is recorded).

**Leaderboards** are on every game's page (and on the lobbies). Each has a 🔒 **Flush** button that asks for the admin PIN.
The Admin page also has a **Master flush** that erases every leaderboard and all recent results at once.

## For players

1. Join the **same Wi-Fi** as the master computer.
2. **Scan the QR code** on the master screen with your phone's camera and open the link.
   (No QR code on screen? Ask the host to tap **📱 Join** at the top of the master screen, or type the address,
   e.g. `http://192.168.1.20:8080`.)
3. Type your name and tap **Join** (at a casino table: **+ Add player**, then **Join the table**).
   Your phone shows only your own cards, role, tickets or chips, so keep it to yourself.
- The page joins whatever game is running and follows along when the host switches games.
- Lost connection, or closed the page? Scan the QR code again. Your seat is kept.
- Want to stop? **Cash out** (casino) or **Leave** (party games; during a game it becomes **Leave after this game**).
- At casino tables your phone can play the dealer's voice too: tap 🔊 / 🔈 to switch it on or off.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| Phones can't open the page | Check they're on the **same Wi-Fi** (not a guest network; those often block devices from seeing each other). Check the firewall allows **node**: Mac: System Settings → Network → Firewall → Options; Windows: allow it on *Private networks*. |
| A phone stays on "Waiting for the table…" / "Waiting for the game…" | Nothing is running on the master yet. Open a casino table or a party game's lobby there; the phone joins by itself. |
| The phone address stopped working | The computer's Wi-Fi address can change. Look at the address under the QR code (or in the Terminal) and use the new one. |
| No QR code on the home page | Run `npm install` in the game folder once (needs internet), then restart. Phones can still type the address. |
| No sound on the master | Click the page once, then **Sound check**. Check the tab isn't muted, the volume is up and **Dealer voice** (casino) or **Moderator voice** (party games) is On. |
| "address already in use" when starting | Game Night (or something else) is already running on that port. Use the open window, stop the old one (see [Stop the game](#3-stop-the-game)), or start on another port. |
| Red bar: "Game Night isn't running" | The page is showing the browser's saved copy, but the game isn't running (its Terminal window was closed). Start it again; the bar disappears by itself (game pages show a **Reload** button). |
| Blue bar: "A new version of the game is ready" | Click **Reload** on the master. Phones update by themselves between rounds. |
| The master asks to "take over" the table | Another browser tab is already running a game; only one runs at a time. Take it over (its phones move to this one), or close the other tab. |
| Leaderboard or PIN seems to have vanished | They're saved per browser. Use the same browser as before, not a private window. |

---

## For developers

**Stack:** plain HTML, CSS and JavaScript with no build step, plus a small Node server (no framework).
The only runtime package is [`qrcode`](https://www.npmjs.com/package/qrcode) (the join QR code); without it the server
falls back to Python's [`segno`](https://segno.readthedocs.io) if installed, or simply shows no QR code.
The tests and the pipeline use Node 20 and [`playwright-core`](https://www.npmjs.com/package/playwright-core) (a dev
dependency; it drives the Chrome you already have and downloads no browsers).

```
server/server.js         the Node server: serves public/, relays messages between the master and the phones
public/                  everything browsers load (pages, css/, js/lib/, js/pages/, games/casino/, games/party/)
test/unit/               unit tests (Node's built-in test runner): game rules, leaderboards, admin lock, server
test/e2e/                end-to-end tests: real games in a muted Chrome with simulated phones (runner: run.js)
scripts/                 the pipeline's stages (check, coverage, package, stage, ci), the pre-push hook, serve.sh
.github/workflows/       the GitHub pipeline (pipeline.yml)
coverage-thresholds.json the coverage rule: every file ≥ 80%, the whole project ≥ 85% (and the exceptions)
docs/                    ARCHITECTURE.md (how it all fits together), CI.md (checks, pipeline, releases), change notes
```

`npm run …` writes two folders git ignores: `coverage/` (the coverage report) and `dist/` (release zips).

**Running and testing**

| Command | What it does | Time |
|---|---|---|
| `npm start` | Runs the game on port 8080 (`npm start -- 9000` for another port; or `scripts/serve.sh [port]`) | |
| `npm test` | All unit tests | seconds |
| `npm run test:e2e` | All end-to-end tests, 3 at a time on test ports 8091–8093; `npm run test:e2e -- party-gofish blackjack-phone` runs only those | ~5 min |
| `npm run check` | Build check: every file parses, links resolve, the offline cache is complete, games are registered everywhere, the cache version was bumped | seconds |
| `npm run coverage` | Unit tests plus the coverage gate (report in `coverage/summary.txt`) | seconds |
| `npm run package` | The release zip in `dist/`, then a smoke test of it (unpack, install, start, load pages) | seconds |
| **`npm run ci`** | **All five stages in order**, Build → Unit tests → Coverage → End-to-end → Package, then a summary: green "safe to push" or red "not safe to push" | ~6 min |

- **End-to-end tests** need Google Chrome (set `CHROME_PATH` if it isn't in Applications) and a Wi-Fi/LAN connection: they
  act as phones through the computer's network address (or set `PHONE_HOST`). They never touch the game's port 8080.
  `E2E_WORKERS=1` runs them one at a time.
- **Retries:** failed tests are retried at the end of their stage, then a failing test stage reruns as a whole (3 times
  each, 10 s apart). Anything that passes only on a retry is flagged yellow as flaky. `TEST_RETRIES=0 STAGE_RETRIES=0`
  turns retries off.
- **Adding tests:** a new file in `test/unit/` or `test/e2e/` is picked up and counted automatically. A new source file
  must reach 80% unit-test coverage (the whole project 85%); after adding tests, `npm run coverage -- --update`.

**Before you push:** `npm run setup-hooks` (once per clone) installs two git hooks: every `git push` runs `npm run ci`
first and refuses the push if a stage fails (`git push --no-verify` skips it), and every commit shows which release
version it leads to and how to ask for more (`[minor]` / `[major]`, below). On GitHub the [pipeline](https://github.com/rishigoswamy/game-night/actions)
runs the same stages on every push and pull request; protecting `main` makes it a hard gate.

**Protected files:** the files that decide what's accepted, released or run on a host (the pipeline, the checks and
coverage rules, dependencies, the server) are listed in `.github/CODEOWNERS`: only the owner may change them
([docs/CI.md](docs/CI.md), "Protected files").

**Releases** (versions `MAJOR.MINOR.PATCH`; every release waits for your **Approve** on GitHub, then is published with
its zip):
- **Automatically:** after every green push to `main` a release candidate waits under **Actions → Release**. It's the
  next patch (fixes, `1.4.3 → 1.4.4`), or the next minor / major if a commit since the last release says **`[minor]`** (a
  new feature in a game, `→ 1.5.0`) or **`[major]`** (a new game, `→ 2.0.0`). Approve it to publish, or ignore / reject it to skip.
- **Manual release:** **Actions → Release → Run workflow**, choose patch / minor / major (or type an exact version), and
  optionally what's in it: it becomes the run's title and the first line of the release notes.
- **From your Mac:** `git tag v1.5.0 && git push origin v1.5.0`; released once the pipeline passes.

**Changing the game:** read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the page/module map, how phones and the
master talk, the game-module interfaces, saved data and how to add a game. When you change files under `public/`, bump
`VERSION` in `public/sw.js` so installed copies refresh (the build check fails until you do). The full pipeline,
retries and release setup are in [docs/CI.md](docs/CI.md).
