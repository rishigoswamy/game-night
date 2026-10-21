# Game Night

Casino tables and party games for a room full of people. One computer is the **master**: it runs the
game and shows the table, ideally on a TV. Everyone else plays on **their own phone**. Phones join by
scanning a QR code, and every phone must be on the **same Wi-Fi** as the master.

No accounts, no app to install, no internet needed once it's set up. Chips are pretend; no real money is involved.

| Casino | Party games |
|---|---|
| Roulette, Blackjack, Baccarat, Dragon Tiger, Sic Bo, Craps | One Night Werewolf, Catan, Go Fish, Bluff |
| A talking dealer opens a betting window; everyone bets from their phone. | The master screen runs the game (and narrates Werewolf); everyone plays on their phone. |

**Contents:** [Set up once](#1-set-up-once) · [Start the game](#2-start-the-game-become-the-master) ·
[Stop the game](#3-stop-the-game) · [Hosting guide](#hosting-a-game-night) · [Players' guide](#for-players) ·
[Troubleshooting](#troubleshooting) · [For developers](#for-developers)

---

## 1. Set up once

You need a computer for the master screen. A Mac works best: the dealer then speaks with the Mac's own voice.
Windows and Linux work too (the dealer uses the browser's voice there).

1. **Install Node.js.** Go to [nodejs.org](https://nodejs.org), download the **LTS** version and install it like any other
   app. (Version 18 or newer.)
2. **Get Game Night onto the computer.** Any of these:
   - someone gives you the `game-night` folder: put it somewhere easy to find, such as your home folder;
   - from GitHub (if the project is published there): click **Code → Download ZIP** and double-click the ZIP to unpack it;
   - with git: `git clone <repository address> game-night`.
3. **Allow phones to connect, once.** The first time you start the game (next step), the computer may ask whether
   **node** may accept incoming network connections:
   - Mac: *"Do you want the application node to accept incoming network connections?"* → **Allow**
   - Windows: *"Windows Defender Firewall has blocked some features"* → tick **Private networks** → **Allow access**

   If you miss or refuse it, phones won't be able to join; see [Troubleshooting](#troubleshooting).

That's it. Game Night uses one small package (for the "scan to join" QR code). The Mac starter below installs it
by itself the first time; with the Terminal you run `npm install` once. Either way this needs internet once.

## 2. Start the game (become the master)

**On a Mac, the easy way:** open the `game-night` folder and double-click **`Start Game Night.command`**.
A Terminal window opens and the home page opens in your browser.

> If macOS refuses to open it the first time ("unidentified developer" / "Apple could not verify…"), click **Done**,
> then open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to
> *Start Game Night.command*. (On older macOS: right-click the file → **Open** → **Open**.) You only do this once.

**Any computer, with the Terminal.** The Terminal is a window where you type commands
(Mac: Applications → Utilities → **Terminal**; Windows: Start menu → **PowerShell**). Type each line and press Enter:

```sh
cd path/to/game-night     # e.g.  cd ~/game-night   (or drag the folder onto the Terminal window after typing "cd ")
npm install               # first time only
npm start                 # on Mac/Linux you can also run  ./serve.sh
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

Only if something else already uses 8080: start on another number with `./serve.sh 9000` (Mac/Linux) or
`node server.js 9000` (any computer), and use `:9000` instead of `:8080` in the addresses.

## 3. Stop the game

- **Close the Terminal window**, or click into it and press **Control + C**. The game stops for everyone.
  (If you started it with `caffeinate`, close that window too.)
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
- Stop the computer from sleeping during the evening: on a Mac, run `caffeinate -d` in a spare Terminal window
  (it keeps the screen awake until you close that window), or change System Settings → Lock Screen.
- Optional: set an **admin PIN** on the Admin page (the **Table admin** link at the bottom of the home page).
  You need it to erase leaderboards or recent results. On a Mac you can also unlock with Touch ID.
- Keep the join address handy for late arrivals: it's under the QR code (for example `http://192.168.1.20:8080`).
  The QR code is on the home page and the lobbies; during a casino game, the **📱** button at the top shows the address.

**Casino tables** (home page → **Enter the Casino** → pick a table)
1. Choose the starting chips, number of rounds and the betting window. For Roulette and Blackjack keep
   **Table style: Casino** (the default); phones can only join a Casino-style table. Then:
   - **Start** with named players, or
   - **Open the table now (players join later)** to let people come and go all evening.
2. Guests scan the QR code, tap **+ Add player**, type a name and bet from their phone. Each phone can bring up to 6
   players (6 seats at the table in total), and only that phone can bet for them. At Blackjack each phone also plays
   its own hands (Hit, Stand, Double, Split). You can add players on the master screen too, for people without a phone.
3. When the betting window closes, the dealer plays the round; 5 seconds after the result the next window opens.
   (With phones at the table the window always has a timer; nobody can cut it short.)
4. **Cash out** (during betting) takes a player's chips off the table and puts them on the leaderboard.
5. **Pause** / **Exit** are at the top of the master screen.

**Party games** (home page → **Play party games** → pick a game)
1. Players scan the QR code on the game's lobby screen and type their name. They appear on the master screen.
   Werewolf needs 3–10 players, Catan 2–4, Go Fish 2–6, Bluff 3–8. Someone who arrives mid-game is seated for the next one.
2. Pick the options (for example Werewolf's extra roles or Catan's points to win) and click **Start**.
3. Nobody plays on the master screen. It shows the table, and in Werewolf it narrates the night out loud.
4. At the end: **Play again** (same players) or **Change players**. **End game** stops a game early (nothing is recorded).

**Leaderboards** are on every game's page (and on the lobbies). Each has a 🔒 **Flush** button that asks for the admin PIN.
The Admin page also has a **Master flush** that erases every leaderboard and all recent results at once.

## For players

1. Join the **same Wi-Fi** as the master computer.
2. **Scan the QR code** on the master screen with your phone's camera and open the link.
   (No QR code on screen? Ask the host for the address and type it into your browser, e.g. `http://192.168.1.20:8080`.)
3. Type your name and tap **Join** (at a casino table: **+ Add player**, then **Join the table**).
   Your phone shows only your own cards, role or chips, so keep it to yourself.
- The page joins whatever game is running and follows along when the host switches games.
- Lost connection, or closed the page? Scan the QR code again. Your seat is kept.
- Want to stop? **Cash out** (casino) or **Leave** (party games; during a game it becomes **Leave after this game**).
- At casino tables your phone can play the dealer's voice too: tap 🔊 / 🔈 to switch it on or off.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| Phones can't open the page | Check they're on the **same Wi-Fi** (not a guest network; those often block devices from seeing each other). Check the firewall allows **node**: Mac: System Settings → Network → Firewall → Options; Windows: allow it on *Private networks*. |
| The phone address stopped working | The computer's Wi-Fi address can change. Look at the address under the QR code (or in the Terminal) and use the new one. |
| No QR code on the home page | Run `npm install` in the game folder once (needs internet), then restart. Phones can still type the address. |
| No sound on the master | Click the page once, then **Sound check**. Check the tab isn't muted, the volume is up and **Dealer voice** (casino) or **Moderator voice** (party games) is On. |
| "address already in use" when starting | Game Night (or something else) is already running on that port. Use the open window, stop the old one (see [Stop the game](#3-stop-the-game)), or start on another port. |
| Blue bar: "A new version of the game is ready" | Click **Reload** on the master. Phones update by themselves between rounds. |
| The master asks to "take over" the table | Another browser tab is already running a game; only one runs at a time. Take it over (its phones move to this one), or close the other tab. |
| Leaderboard or PIN seems to have vanished | They're saved per browser. Use the same browser as before, not a private window. |

---

## For developers

**Stack:** plain HTML, CSS and JavaScript with no build step, plus a small Node server (`server.js`, no framework).
The only package is [`qrcode`](https://www.npmjs.com/package/qrcode); without it the server falls back to Python's
[`segno`](https://segno.readthedocs.io) (if installed) or simply shows no QR code.

**How it works**
- The master page runs the whole game in the browser. Phones send it actions; the master sends back each phone's view.
- `server.js` serves the files and relays those messages: phones and master hold a Server-Sent Events stream
  (`/api/stream`) and send small POSTs (`/api/send`). Every sender is checked (the master with a host key, each phone with a session token).
- Only the computer running the server can be a master (requests from other devices are refused); there's one table at a time.
- Other endpoints: `/api/tts` (the dealer's voice, rendered with macOS `say`), `/api/qr.svg` (join QR code),
  `/api/info`, `/api/tables`, `/api/version` (pages notice new files and offer a reload).

**Files**

| Where | What |
|---|---|
| `index.html`, `casino.html`, `party.html` | Home page and the two lobbies |
| `roulette.html`, `blackjack.html` | Roulette and Blackjack master screens |
| `table.html?g=…` + `games/*.js` + `table-games.css` | Baccarat, Dragon Tiger, Sic Bo, Craps (one engine; each game's rules in its own module) |
| `remote.html`, `bj-remote.html`, `table-remote.html` | Phone pages for the casino tables |
| `party-table.html?g=…`, `party-remote.html?g=…` + `party/*.js` + `party.css` | Party games: master screen, phone page, and one module per game |
| `leaderboard.js`, `admin.html`, `admin-lock.js` | Leaderboards, the Admin page, PIN / passkey lock |
| `casino-sounds.js`, `roulette-view.js` | Synthesized crowd sounds; the roulette wheel and charts shared with phones |
| `storage-migrate.js` | Moves saved data from the project's older names (`rd-…`, `dc-…`) to `gn-…` |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app and offline cache. **Bump `VERSION` in `sw.js` when files change.** |

**Adding a game:** copy one of the modules in `games/` (casino table) or `party/` (party game). A module defines the
bets or rules, how a round plays and how each screen draws itself; the shared pages handle players, phones, voice and
leaderboards. Then register the new id:
- `GAME_IDS` in `table.html` and `table-remote.html` (casino), or `PARTY_IDS` in `party-table.html` and `party-remote.html` (party);
- `PAGE_FOR` in the phone pages (`remote.html`, `bj-remote.html`, `table-remote.html`, `party-remote.html`) so phones are routed to it;
- `CASINO` / `PARTY` names in `leaderboard.js`; for casino tables also `RECENT` in `admin.html`;
- a card in `casino.html` or `party.html`, and the new files in `FILES` in `sw.js` (then bump `VERSION`).

**Saved data** lives in each browser's `localStorage` under `gn-…` keys (leaderboard: `gn-leaderboard`).

**Testing tips:** run a second server on another port (`node server.js 8091`) so tests never touch a real game night.
Set `DC_LOOPBACK_ONLY=1` to let a browser on the same computer act as a phone. Mute automated browsers
(e.g. Chrome's `--mute-audio`) so the dealer doesn't talk through your speakers.
