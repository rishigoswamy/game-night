# Game Night

A local multi-player game night that runs on one computer (the "master" screen, e.g. a Mac on the TV) while
everyone else plays from their own phone on the same Wi-Fi. No accounts, no internet needed, pretend chips only.

## Games

**Casino** (`casino.html`): a talking dealer, chips and a betting window; everyone bets from their phone.
Roulette, Blackjack, Baccarat, Dragon Tiger, Sic Bo, Craps.

**Party Games** (`party.html`): the computer runs the game, nobody plays on it.
One Night Werewolf (the computer narrates the night), Catan (board and scoreboard on the big screen),
Go Fish, Bluff.

Every game has a leaderboard. Recent results and leaderboards can be flushed from the Admin page
(`admin.html`) behind an admin PIN or Touch ID.

## Running it

Needs [Node.js](https://nodejs.org) 18 or newer.

```sh
npm install      # one small package: qrcode (the "scan to join" QR code)
./serve.sh       # or: npm start   (serves on port 8080; ./serve.sh 9000 for another port)
```

Open `http://localhost:8080` on the host computer. Phones scan the QR code on the home page
(or open the address the server prints, e.g. `http://192.168.1.20:8080`) and join whatever game is running.

On macOS the dealer and moderator speak with the system voice (`say`); elsewhere the browser's own speech is used.

## How it's put together

- `server.js`: plain Node HTTP server. Serves the pages, relays messages between the master screen and the
  phones (Server-Sent Events + small POSTs), renders the dealer's voice (`/api/tts`) and the join QR code (`/api/qr.svg`).
  Only the host computer can run a table; one table at a time.
- Casino: `roulette.html`, `blackjack.html`, and `table.html?g=…` with the rules of each table game in `games/`.
  Phone pages: `remote.html` (roulette), `bj-remote.html` (blackjack), `table-remote.html` (the rest).
- Party games: `party-table.html?g=…` on the master screen, `party-remote.html?g=…` on phones, rules in `party/`.
- Shared: `leaderboard.js`, `admin-lock.js`, `casino-sounds.js` (synthesized crowd sounds), `roulette-view.js`,
  `storage-migrate.js` (moves saved data from the project's old names), `sw.js` (offline cache; bump `VERSION` after changes).

Saved data (leaderboards, recent results, settings) lives in each browser's local storage under `gn-…` keys.
