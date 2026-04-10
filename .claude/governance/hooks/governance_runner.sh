#!/bin/bash
# Governance Runner — PostToolUse hook orchestrator
# Routes modified files to domain-specific enforcement hooks
# Exit 0 = pass, non-zero = block (violation found)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only trigger on file-modifying tools
case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Skip if no file path
[ -z "$FILE_PATH" ] && exit 0

# Collect violations from domain hooks
VIOLATIONS=""
HAS_BLOCK=0

run_hook() {
  local hook_script="$1"
  local result
  if [ -f "$hook_script" ]; then
    result=$(echo "$INPUT" | bash "$hook_script" 2>&1) || true
    if [ -n "$result" ]; then
      VIOLATIONS="${VIOLATIONS}${result}
"
      if echo "$result" | grep -q "\[GOVERNANCE:BLOCK\]"; then
        HAS_BLOCK=1
      fi
    fi
  fi
}

# Route to domain hooks based on file path
case "$FILE_PATH" in
  */convex/_generated/*|convex/_generated/*)
    # Skip generated files entirely
    ;;
  */convex/*.ts|convex/*.ts|*/convex/**/*.ts|convex/**/*.ts)
    run_hook "$SCRIPT_DIR/enforce_security.sh"
    run_hook "$SCRIPT_DIR/enforce_convex_patterns.sh"
    ;;
esac

case "$FILE_PATH" in
  */src/**/*.tsx|src/**/*.tsx)
    run_hook "$SCRIPT_DIR/enforce_design_system.sh"
    run_hook "$SCRIPT_DIR/enforce_architecture.sh"
    ;;
  */src/**/*.css|src/**/*.css)
    run_hook "$SCRIPT_DIR/enforce_design_system.sh"
    ;;
esac

# Output violations as system message if any found
if [ -n "$VIOLATIONS" ]; then
  jq -n --arg msg "$VIOLATIONS" '{"systemMessage": $msg}'
fi

# Block if any BLOCK violations
if [ "$HAS_BLOCK" -eq 1 ]; then
  exit 1
fi

exit 0
