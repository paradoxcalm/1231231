#!/bin/sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRPC_BIN="${FRPC_BIN:-frpc}"
"$FRPC_BIN" -c "$SCRIPT_DIR/frpc.ini"
