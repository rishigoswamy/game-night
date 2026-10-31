#!/bin/sh
# Double-click this file on a Mac to start Game Night. A Terminal window opens and keeps the game running.
# To stop the game: close that Terminal window (or press Control+C in it).
cd "$(dirname "$0")" || exit 1
PORT="${1:-8080}"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Get the LTS version from https://nodejs.org, install it, then double-click this file again."
  read -r _ ; exit 1
fi
if [ ! -d node_modules ]; then
  echo "First run: installing the one small package Game Night needs (for the join QR code)..."
  npm install --no-fund --no-audit || echo "Could not install it (no internet?). The games still work; only the QR code will be missing."
fi
echo "Starting Game Night. Keep this window open while you play; close it to stop the game."
node server/server.js "$PORT" &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT HUP INT TERM     # closing this window stops the game
# Reuse a Game Night tab that's already open (it reconnects by itself); open the home page only if there isn't one.
open_tab=yes
for _ in 1 2 3 4 5 6; do
  sleep 0.5
  if curl -s --max-time 1 "http://localhost:$PORT/api/master-open" | grep -q '"open":true'; then open_tab=no; break; fi
done
if [ "$open_tab" = yes ]; then open "http://localhost:$PORT"; else echo "A Game Night tab is already open in your browser; it has reconnected."; fi
wait $SERVER
