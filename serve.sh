#!/bin/sh
# Start Game Night: serves the games and lets phones on the same Wi-Fi join a shared table.
cd "$(dirname "$0")"
exec node server.js "${1:-8080}"
