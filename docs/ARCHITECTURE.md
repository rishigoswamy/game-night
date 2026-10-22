# Architecture

Game Night is a set of static web pages plus a small Node server. There is no build step: what's in `public/`
is exactly what browsers load.

```
            ┌────────────────────────────┐
            │  Master screen (a browser  │   runs the whole game: rules, timers, dealer voice,
            │  on the host computer)     │   leaderboards. The source of truth.
            └─────────────┬──────────────┘
          SSE stream ▲    │ POST /api/send (state, private views, dealer lines)
                     │    ▼
            ┌────────────────────────────┐
            │  server/server.js (Node)   │   serves public/, relays messages, renders the
            │                            │   dealer's voice (macOS say), draws the join QR code
            └─────────────┬──────────────┘
          SSE stream ▲    │ POST /api/send (bets, moves, join / leave)
                     │    ▼
            ┌────────────────────────────┐
            │  Phones (browsers on the   │   show the table and the player's private view,
            │  same Wi-Fi)               │   send the player's actions
            └────────────────────────────┘
```

## Directory layout

```
game-night/
├── server/server.js          Node server (no framework). Web root = public/
├── scripts/serve.sh          start the server (same as `npm start`)
├── Start Game Night.command  double-click starter for macOS
├── public/                   everything browsers load (served at /)
│   ├── *.html                the pages: markup only, URLs unchanged since the start of the project
│   ├── css/
│   │   ├── base-table.css    look of the master screens (Roulette, the card/dice tables, party master)
│   │   ├── base-phone.css    look of the phone pages
│   │   ├── table-games.css   board, cards and dice for Baccarat / Dragon Tiger / Sic Bo / Craps
│   │   ├── party.css         cards and controls for the party games
│   │   └── pages/<page>.css  styles used by one page only
│   ├── js/
│   │   ├── lib/              modules shared by several pages (see below)
│   │   └── pages/<page>.js   the code of one page (loaded at the end of that page's <body>)
│   ├── games/
│   │   ├── casino/*.js       rules of the casino tables: one module per table game (bets, how a round plays,
│   │   │                     payouts, drawing) + roulette-rules.js and blackjack-rules.js (rules only)
│   │   └── party/*.js        one module per party game (+ common.js: card helpers)
│   ├── sw.js                 offline cache (bump VERSION when files change)
│   ├── manifest.webmanifest  installable app
│   └── icons/
├── test/e2e/                 end-to-end tests (real games in a muted Chrome)
└── docs/                     this file and the change notes
```

## Pages

| Page | Who sees it | What it does |
|---|---|---|
| `index.html` | everyone | Home: choose Casino or Party Games; join QR code |
| `casino.html`, `party.html` | everyone | Lobbies with the game cards, QR code and leaderboards |
| `admin.html` | host | Admin PIN / Touch ID, flushes (per game and master) |
| `roulette.html`, `blackjack.html` | master | Roulette / Blackjack tables |
| `table.html?g=baccarat\|dragontiger\|sicbo\|craps` | master | One engine for the four simpler tables; the game module is chosen by `?g=` |
| `remote.html`, `bj-remote.html`, `table-remote.html?g=…` | phones | Phone pages for the casino tables |
| `party-table.html?g=werewolf\|catan\|gofish\|bluff\|tambola` | master | Party game screen (moderator / caller) |
| `party-remote.html?g=…` | phones | Party game phone page |

Every page is a thin HTML file (markup), its own stylesheet(s) in `css/`, and its code in `js/pages/<page>.js`.
The pages that pick a game module (`table*.html`, `party*.html`) keep a three-line loader in `<head>` that writes
the module's `<script>` tag before the page code runs.

Phone pages route themselves: each knows which page serves which game (`PAGE_FOR`) and moves to the right one when
the master switches games.

## Shared modules (`public/js/lib/`)

| File | Global | Purpose |
|---|---|---|
| `storage-migrate.js` | none | Runs first on every page; moves saved data from the project's older key names (`rd-…`, `dc-…`) to `gn-…` |
| `server-status.js` | `ServerStatus` | On Mac pages: a bar when the server isn't running (the offline cache can still open pages); lobbies reload themselves when it's back |
| `admin-lock.js` | `AdminLock` | Admin PIN (salted SHA-256) and optional passkey / Touch ID |
| `leaderboard.js` | `Leaderboard` | Recording, ranking, drawing and flushing leaderboards (casino by winnings, party by wins) |
| `casino-sounds.js` | sound builders, `createSfxPlayer` | Synthesized crowd sounds (groan, cheer, hurray, dice) with Web Audio |
| `roulette-view.js` | `RouletteView` | Roulette wheel, recent-numbers chart, win/loss chart (shared by master and phones) |

They are classic scripts (not ES modules) that define globals, loaded with `<script src>` before the page code.

## Game modules

**Roulette and Blackjack rules** (`games/casino/roulette-rules.js`, `blackjack-rules.js`) set `window.RouletteRules` /
`window.BlackjackRules`: pure rules with no screen code (wheel, colours, bets and payouts, `settle`; card values, totals,
blackjack, when Double / Split are allowed, the dealer's peek and drawing, each hand's result and payout). `roulette.js` and
`blackjack.js` keep the screen, animation, voice and the order of play, and call these.


**Casino table modules** (`games/casino/*.js`) set `window.GAME` with: `bets` (the betting board), `play(ctx)`
(deals cards / rolls dice through `ctx.setStage`, `ctx.wait`, `ctx.say`), `settle(betKey, amount, outcome)` (chips
returned), `announce`, `token` (recent-results bead), `stageHTML`, payout table and rules. `table.html` handles
everything else: players, betting window, phones, voice, celebrations, leaderboards.

**Party game modules** (`games/party/*.js`) set `window.PARTY_GAME` with: `start(ctx)`, `act(ctx, player, msg)` (a
phone's move; return an error string to refuse it), `view(ctx, player)` (that player's private view, the only thing
sent to their phone), `hostHTML` (master screen), `phoneHTML` (+ optional `phoneLocal` / `phoneAct` for choices made
on the phone before sending). Optional: `options` (shown in the lobby; a choice may carry a hover card with full rules), `canStart`,
`lobbyHTML` (extra lobby info, e.g. Werewolf's night order), `hostAct` (buttons on the master screen, e.g. Tambola's Pause),
`phoneNotify` (vibrate the phone). `party-table.html` handles seats, timers (`ctx.countdown`), narration and leaderboards.
Adding a game: the module, its id in `PARTY_IDS` (`party-table.html`, `party-remote.html`), the phone routing (`PAGE_FOR` in
`remote.js`, `table-remote.js`, `bj-remote.js`), `leaderboard.js` (`PARTY`, `POINTS`), `sw.js`, the card in `party.html`, tests.

## Server (`server/server.js`)

- Static files from `public/` only (dotfiles refused; nothing outside `public/` is reachable).
- `/api/host`: a master opens the one shared table (only from the host computer itself; a second screen must take over).
- `/api/stream`: Server-Sent Events for the master (`role=host` + host key) and phones (`role=remote` + device id; the
  first event is a session token).
- `/api/send`: messages; the master proves itself with its host key, each phone with its session token.
- `/api/tts`: the dealer's voice via macOS `say` (cached in memory); `/api/qr.svg`: join QR code (npm `qrcode`,
  or Python `segno` as a fallback); `/api/info`, `/api/tables`, `/api/version` (newest file time under `public/`,
  so open pages can offer a reload).

## Saved data

Browsers keep everything in `localStorage`, per device: `gn-leaderboard`, `gn-spins` (Roulette's Recent Numbers),
`gn-log-<game>` (other tables' recent results), `gn-admin` (PIN / passkey), `gn-device` (a phone's id),
`gn-voice` / `gn-phone-voice` / `gn-party-voice` (sound switches), `gn-party-name`. The server keeps tables in
memory only.

## Tests

| | Unit tests (`npm test`) | End-to-end tests (`npm run test:e2e`) |
|---|---|---|
| Where | `test/unit/*.test.js` | `test/e2e/*.js`, found by the runner (`run.js`); files that export something are shared modules, not tests |
| How | Node's built-in test runner; browser files run in a sandbox (`helpers.js`: fake `window` and storage, seeded random, a stand-in for the party page) | Real games in a muted Chrome (`playwright-core`); phones simulated through the computer's Wi-Fi address; 3 tests at a time, each with its own test server and port (`E2E_PORT`), longest first; `update-bar` (it touches a game file) runs alone; the two voice tests (`dealer-voice`, `phone-voice`) never run at the same time, since they share the Mac's speech engine |
| Covers | Every casino payout and drawing rule (all six tables, incl. Roulette and Blackjack); Werewolf, Catan, Go Fish, Bluff and Tambola rules; leaderboard, admin lock, storage migration; server security and relay | Whole games end to end: pages, phones, timers, voice, leaderboards |
| Time | a few seconds | about 5 minutes (about 15 one at a time) |

Game modules expose a few internals for the unit tests as `_test` (e.g. Catan's `longest`, Baccarat's `bankerDraws`); pages
never use them. Tests use ports 8091–8093 (`helpers.js` refuses 8080); never point them at a real game night.

The build check (`scripts/check.js`), the coverage gate (`scripts/coverage.js`, `coverage-thresholds.json`), the package
stage (`scripts/package.js`), the pre-push hook (`scripts/hooks/`) and the GitHub pipeline (`.github/workflows/pipeline.yml`)
are described in [CI.md](CI.md).
