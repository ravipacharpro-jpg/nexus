#!/bin/bash
# Start the OmniRoute keyless gateway (background).
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$HOME/.nexus/omniroute.log"
mkdir -p "$(dirname "$LOG")"
echo "[omniroute] starting gateway..."
nohup node "$SCRIPT_DIR/omniroute-server.mjs" > "$LOG" 2>&1 &
echo "[omniroute] started pid $! (log: $LOG)"
sleep 1
curl -s --max-time 5 http://127.0.0.1:20128/v1/models >/dev/null && \
  echo "[omniroute] OK — gateway reachable at http://127.0.0.1:20128/v1" || \
  echo "[omniroute] WARN — gateway not reachable yet, see $LOG"
