# Repository reorganization (October 2026)

Until now every file sat in the repository root: the Node server next to the web pages, shared modules next to
page files, and each page carried its whole program and stylesheet inline (Roulette's page alone was 2,700 lines,
of which 1,800 JavaScript and 570 CSS). This change gives the project a conventional layout without changing what
the games do. Every page's web address stays the same.

## What changed, and why

| Change | Why |
|---|---|
| **Web files moved into `public/`**; the server serves only that folder. | Separates what browsers load from what runs on the host. Before, the server needed a deny-list to avoid serving its own source, `package.json` and `node_modules/`; now those are simply outside the web root. |
| **Server moved to `server/server.js`**, start script to `scripts/serve.sh`. | Server code in its own place; the root keeps only what a newcomer needs (README, starter, package files). `npm start` / `npm test` are the entry points. |
| **Each page's inline `<script>` moved to `public/js/pages/<page>.js`** (byte-for-byte, same position at the end of `<body>`). | Code can be read, diffed, searched and syntax-checked as JavaScript; HTML files are now just markup (Roulette 2,703 → 318 lines, Blackjack 2,225 → 306, the card/dice tables 2,160 → 299, party master 1,152 → 142). Behaviour is identical: an external classic script at the same spot runs at the same moment as the inline one did. |
| **Each page's inline `<style>` moved to `public/css/pages/<page>.css`**. | Same reasons as for scripts. |
| **Two copied stylesheets became shared files**: `css/base-table.css` (Roulette's sheet, which `table.html` and `party-table.html` contained verbatim) and `css/base-phone.css` (the Roulette phone sheet, contained verbatim in the other three phone pages). | One place to change the look; 1,782 duplicated lines removed. Only exact, character-for-character copies were shared, and each page loads the shared file at the point where its copy used to be, so the cascade order is unchanged. |
| **Shared modules grouped in `public/js/lib/`**, game modules in `public/games/casino/` and `public/games/party/`, shared stylesheets in `public/css/`. | Shows at a glance what is shared, what belongs to one page and what is a game's rules. |
| **`/api/version` now watches every file under `public/`** (it used to look at three fixed folders). | Needed because files now live in nested folders; editing any of them still shows "A new version is ready". |
| **Offline cache (`sw.js`) lists every file in `public/`**; version bumped. | The new stylesheet and script files must be cached too; the list is now generated from the folder so it can't drift. |
| **End-to-end tests added to the repo** (`test/e2e/`, run with `npm test`). | The regression suite used during development lived outside the repo. Now anyone can run it before and after a change. It needs Google Chrome (or `CHROME_PATH`) and the `playwright-core` dev dependency. |
| **`docs/ARCHITECTURE.md`** and this file. | A map of the code for the next developer. |

| **Server bug fix: a malformed request address (e.g. `//`) no longer crashes the server.** It now gets a "400 Bad request" reply. | Found while verifying this change: the server read every request address with `new URL(...)` and an invalid one threw an error nothing caught, stopping the whole game night. The old server crashed the same way (reproduced). This is the only behaviour change here. |

## What did not change

- **Page addresses** (`/roulette.html`, `/table.html?g=sicbo`, `/party-remote.html?g=werewolf`, …), the QR code target
  (`/remote.html`) and the phones' routing between pages.
- **Game behaviour and look**: no game logic was edited; moved code is identical. (The one change is the server crash fix above.)
- **Saved data** (`gn-…` keys in each browser) and the admin PIN.
- **How to start the game**: double-click `Start Game Night.command`, or `npm start`.

## How it was verified

1. **Baseline**: the end-to-end suite was run on the old layout before anything moved: 21 of 21 pass. Getting
   there needed fixes to six *tests* (none to the game): three still opened the old home page, which no longer
   holds the casino cards (they moved to `casino.html`), and one of those also used the storage names from before the
   `gn-` rename; one expected a server to be running already and was grouped wrongly; and two had timing bugs in the
   test script itself (a click on an element the page had just redrawn, and a wait left running after the browser closed).
2. **Byte-for-byte check**: for every page, the original file was rebuilt from the new pieces (stylesheets put back
   into `<style>`, page script back inline, new paths swapped back to old) and compared with the committed original.
   All 12 pages were identical.
3. **Reference check**: every `src` / `href` in every page, every game module and every entry in the offline cache
   resolves to an existing file; every JavaScript file passes `node --check`.
4. **Server check**: all files are served; the server's own code, `package.json`, `node_modules/` and dotfiles are
   refused (including `../` tricks); editing a nested file changes `/api/version`; `scripts/serve.sh` starts it.
5. **After**: the same end-to-end suite on the new layout. Results: see the table below.

| Test | What it plays | Before | After |
|---|---|---|---|
| `casino-tables-round` | Baccarat, Dragon Tiger, Sic Bo and Craps each play a round; payouts checked | ✅ | ✅ |
| `casino-phone-sicbo` | a phone joins Sic Bo, bets, cashes out, reaches the leaderboard; follows the master to Roulette | ✅ | ✅ |
| `blackjack-phone` | Blackjack with a phone: bets, split from the phone, dealer, cash out | ✅ | ✅ |
| `roulette-two-phones` | two phones and the master bet at one Roulette table; who may bet for whom | ✅ | ✅ |
| `roulette-master-only` | only the host computer can run a table; phones are sent to the join page | ✅ | ✅ |
| `roulette-phone-locks` | a phone cannot act for another phone's players | ✅ | ✅ |
| `roulette-phone-view` | the phone shows the wheel, recent numbers, payouts, rules, win/loss | ✅ | ✅ |
| `roulette-phone-landing` | the landed number stays on the phone for 3 seconds | ✅ | ✅ |
| `update-bar` | changed files show the update bar; a server restart is recovered | ✅ | ✅ |
| `dealer-voice` | the dealer speaks with the server voice | ✅ | ✅ |
| `phone-voice` | phones play the dealer's lines | ✅ | ✅ |
| `storage-migration` | old saved data moves to the new names | ✅ | ✅ |
| `flushes` | per-game, lobby, recent-results and master flushes behind the PIN | ✅ | ✅ |
| `party-gofish` | a full Go Fish game with three phones | ✅ | ✅ |
| `party-bluff-ending` | Bluff: no-call, call and winning last card | ✅ | ✅ |
| `party-werewolf-rules` | Werewolf endings: Hunter, Tanner, no werewolves, Minion | ✅ | ✅ |
| `party-werewolf-robber` | the Robber's choices | ✅ | ✅ |
| `party-catan-rules` | Catan rules: city, development cards, Largest Army, bank trade, winning | ✅ | ✅ |
| `party-leave-rejoin` | leave, rejoin, rename, leave after the game | ✅ | ✅ |
| `party-werewolf-game` | a full Werewolf game with five phones | ✅ | ✅ |
| `party-catan-game` | a full Catan game; resources always add up | ✅ | ✅ |

**21 of 21 pass before and after.** Re-run any time with `npm test`.


## Possible next steps (not done here, to keep this change behaviour-free)

- The master pages still share copied *code* (phone sharing, dealer voice, celebrations) between `roulette.js`,
  `blackjack.js` and `table.js`. Moving those into `js/lib/` would remove a lot of duplication but touches running
  logic, so it deserves its own change with the e2e suite as a safety net.
- `blackjack.css` and the lobby stylesheets (`index.css`, `casino.css`, `party.css`) overlap partly but not verbatim;
  merging them needs a visual check.
- The e2e tests are scenario scripts that print what they checked. Turning their checks into assertions would make
  failures easier to read.
