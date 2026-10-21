#!/bin/sh
# Start Game Night: serves the games and lets phones on the same Wi-Fi join a shared table.
# Usage: scripts/serve.sh [port]   (default 8080)
cd "$(dirname "$0")/.." || exit 1
exec node server/server.js "${1:-8080}"
