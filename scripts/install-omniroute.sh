#!/bin/bash
# Install/check prerequisites for the OmniRoute keyless gateway.
echo "[omniroute] checking node..."
if command -v node >/dev/null 2>&1; then
  echo "[omniroute] node $(node --version) found — ready."
else
  echo "[omniroute] node not found. Install Node.js (e.g. pkg install nodejs in Termux) first."
  exit 1
fi
echo "[omniroute] run: bash $(dirname "$0")/start-omniroute.sh"
