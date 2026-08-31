#!/usr/bin/env bash
# Install NEXUS autofarm CLI on Termux (no bun needed).
# Bun-compiled binaries don't run on Termux (musl/glibc mismatch),
# so we use Node.js with --experimental-strip-types to run the
# TypeScript source directly.
#
# Usage:
#   bash scripts/install-autofarm-termux.sh

set -euo pipefail

NEXUS_HOME="${NEXUS_HOME:-/data/data/com.termux/files/home}"
BIN_DIR="$NEXUS_HOME/.nexus/bin"
PREFIX_BIN="${PREFIX:-/data/data/com.termux/files/usr}/bin"
NEXUS_SRC="$NEXUS_HOME/nexus/packages/assistant/src/plugins/autofarm/cli.ts"
WRAPPER="$BIN_DIR/nexus-autofarm"
NODE="${NODE:-$(command -v node)}"

if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  echo "ERROR: node not found. Install with: pkg install nodejs" >&2
  exit 1
fi

if [ ! -f "$NEXUS_SRC" ]; then
  echo "ERROR: autofarm CLI not found at $NEXUS_SRC" >&2
  echo "  Make sure you have the NEXUS source cloned at $NEXUS_HOME/nexus" >&2
  exit 1
fi

mkdir -p "$BIN_DIR"

cat > "$WRAPPER" <<WRAP
#!/data/data/com.termux/files/usr/bin/bash
# Wrapper: runs the autofarm CLI via Node.js (which is installed on Termux).
exec $NODE --experimental-strip-types \\
  $NEXUS_SRC \\
  "\$@"
WRAP
chmod +x "$WRAPPER"

if [ -d "$PREFIX_BIN" ]; then
  ln -sf "$WRAPPER" "$PREFIX_BIN/nexus-autofarm"
  echo "✓ symlink: $PREFIX_BIN/nexus-autofarm"
fi

echo ""
echo "✓ installed: $WRAPPER"
echo ""
echo "Test it:"
echo "  nexus-autofarm version"
echo "  nexus-autofarm status"
echo "  nexus-autofarm health"
echo "  nexus-autofarm help"
