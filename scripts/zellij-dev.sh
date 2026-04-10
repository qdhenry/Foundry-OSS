#!/usr/bin/env bash
set -euo pipefail

if ! command -v zellij >/dev/null 2>&1; then
  echo "zellij is required but was not found in PATH."
  echo "Install with: brew install zellij"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAYOUT_FILE="$ROOT_DIR/zellij/dev.kdl"

if [[ ! -f "$LAYOUT_FILE" ]]; then
  echo "Missing zellij layout file: $LAYOUT_FILE"
  exit 1
fi

cd "$ROOT_DIR"
exec zellij --new-session-with-layout "$LAYOUT_FILE"
