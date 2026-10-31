# Project knowledge base

Reviewed locally on 2026-10-31 at commit `851e214`. This is a navigation and maintenance reference, not a runtime audit. Recheck source when implementing changes.

## Product and stack

Game Night is a local multiplayer game collection: one host computer displays the table, and phones on the same Wi-Fi provide player controls and private information. No accounts; casino chips are pretend money.

- Casino: Roulette, Blackjack, Baccarat, Dragon Tiger, Sic Bo, Craps. Six seats per table; a phone can own several players.
- Party: One Night Werewolf (3–10), Mafia (4–16), Catan (2–4), Go Fish (2–6), Bluff (3–8), Tambola (2–10), Business Beta (2–8). One seat per phone.
- Plain HTML/CSS/classic JavaScript; no frontend framework or build step. Scripts expose globals and depend on HTML load order.
- Node's built-in HTTP server; `qrcode` is the sole runtime dependency. `playwright-core` drives installed Chrome for browser tests.
- Start with `npm start`; default port 8080. The macOS starter is `LaunchGame.command`.

## Authority, networking, and privacy

`server/server.js` serves only `public/`. The master browser owns game rules, state, timers, rendering, and leaderboard recording. The server relays messages; it does not validate game moves itself.

1. Master calls `POST /api/host`, receiving a four-letter table code and secret host key. Hosting is restricted to requests from the host machine. An existing live table requires takeover.
2. Master and phones open `/api/stream` SSE connections. Each phone receives a fresh session token for its device ID.
3. Both send messages through `POST /api/send`. The server checks host keys or phone session tokens and overwrites the remote message's device with the verified sender.
4. Phones discover the active table through `/api/tables` and route to the matching remote page when games change.

Only broadcast `state` messages are retained for reconnecting phones. Targeted private views must stay targeted. Party master computes each seat's view with `G.view(ctx, playerIndex)`; never broadcast the raw game state or secret roles/cards.

Server tables are memory-only. A disconnected host has a ten-minute grace period; that is not a saved-game checkpoint. Browser localStorage holds leaderboards/settings/history; it is separate from live game state.

## Where changes belong

| Concern | Files |
|---|---|
| Home, game selection, admin | `public/{index,casino,party,admin}.html` and corresponding `js/pages/` / `css/pages/` files |
| Roulette | `js/pages/roulette.js`, `games/casino/roulette-rules.js`, phone `js/pages/remote.js` |
| Blackjack | `js/pages/blackjack.js`, `games/casino/blackjack-rules.js`, phone `js/pages/bj-remote.js` |
| Other casino tables | Shared `js/pages/table.js` and `table-remote.js`; game selected by `?g=` from `games/casino/` |
| Party framework | `js/pages/party-table.js`, `party-remote.js`; HTML loaders select `games/party/<game>.js` |
| Shared UI and storage | `js/lib/`: leaderboard, admin lock, migration, status, casino sounds, roulette view |
| Shared styles | `css/base-table.css`, `base-phone.css`, `party.css`, `table-games.css` |
| Offline/update behavior | `public/sw.js`, `js/lib/server-status.js`, page version polling |

Paths in this table are relative to `public/` unless explicitly prefixed.

Casino modules expose `window.GAME`: bet definitions, async `play(ctx)`, settlement, announcements, and stage rendering. Roulette and Blackjack have separate pure rule globals. Roulette uses an American wheel with pocket 37 representing 00. Blackjack stands on all 17s, pays natural blackjack 3:2, permits one split, and gives split Aces one card each.

Party modules expose `window.PARTY_GAME`: `start`, `act`, `view`, `hostHTML`, `phoneHTML`, plus optional hooks. Context supplies players/options, random/shuffle, narration, logs, countdowns, updates, and end results. Framework handles seats, late arrivals, leave-after-game, and recording. `playerLeft` enables immediate departure; leavers are excluded from leaderboard records. Phone rendering defers updates during touches to avoid lost Safari taps.

## Game-specific pointers

- Werewolf: one-night role sequence, swaps and final-role outcomes; 22 roles. See `2026-10-werewolf-roles.md`.
- Mafia: repeated nights, discussion, nominations, defense and verdict; dead spectators and neutral win conditions. See `2026-10-mafia.md`.
- Catan: island setup, turn order, building, bank/player trades and counter-offers, immediate departures.
- Bluff: Indian-style rank rounds, add/pass and challenges; not a generic unrestricted discard implementation.
- Tambola: caller, ticket generation/marking and prize claims; see `2026-10-tambola.md`.
- Business: twelve city themes share standard internal money units; display currencies scale amounts. Open-table board voting, auctions, trading, debt, jail, building and speed die. Art lives in `games/party/art/boards/`. See `2026-10-business.md`; its lobby-options table still says “ten” despite twelve boards. Listed gaps include trade counter-offers and scarce-building auctions.

## Persistence and audio

Storage keys use `gn-`; migration handles older `rd-` / `dc-` keys. Main keys include `gn-leaderboard`, `gn-spins`, `gn-log-<game>`, `gn-admin`, `gn-device`, voice preferences, and `gn-party-name`. Party phone sessionStorage tracks whether that tab was seated for automatic lobby rejoining.

Admin PIN uses salted SHA-256, with optional passkey/Touch ID. Data belongs to the browser, not an account or server database.

macOS narration uses `/api/tts` and `say`, with cached WAV clips; browser speech is the fallback. Audio requires a user interaction. `/api/qr.svg` joins through `/remote.html`; `qrcode` can fall back to Python `segno`.

## Maintenance and verification

- `npm test`: Node unit runner; VM helpers load browser globals, seeded random makes rule tests repeatable.
- `npm run check`: parsing, links, cache completeness, game registration and service-worker version bump checks.
- `npm run test:e2e -- <test names>`: installed Chrome and simulated phones; test ports 8091–8093, never 8080.
- `npm run coverage`: default per-file 80%, total 85%, with explicit exceptions in `coverage-thresholds.json`.
- `npm run ci`: build, unit, coverage, browser tests, package. Required before a PR; shared changes warrant the full pipeline.
- Any `public/` change requires a `VERSION` bump in `public/sw.js` (reviewed value: `gamenight-v74`) and cache-list updates for new assets.
- Adding a party game requires loaders, remote routing, leaderboard registration, lobby card, cache entries, and tests. Consult `ARCHITECTURE.md` for the full contract.
- Protected ownership is declared in `.github/CODEOWNERS`; includes server, dependencies, CI/check infrastructure, service worker, and admin lock. See `CI.md` for release approvals and validation rules.

Review scope: README, architecture/CI and game notes, complete server, shared party lifecycle/networking and phone handling, service worker, rule modules, test helpers, and indexed game/page entry points. No runtime tests or browser playthroughs were performed for this documentation task. Existing untracked `launcher.command` was left untouched.
