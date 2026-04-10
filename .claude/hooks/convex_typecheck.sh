#!/bin/bash
# PostToolUse hook: Run Convex typecheck after modifying convex/ files
# Catches schema drift, wrong index names, and validator mismatches immediately
# Runs alongside convex_auto_push.sh (which disables typecheck for speed)

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only trigger on file-modifying tools
case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Check if file is in the convex/ directory
case "$FILE_PATH" in
  */convex/*|convex/*) ;;
  *) exit 0 ;;
esac

# Skip generated files
case "$FILE_PATH" in
  */convex/_generated/*|convex/_generated/*) exit 0 ;;
esac

# Skip non-TypeScript files
case "$FILE_PATH" in
  *.ts) ;;
  *) exit 0 ;;
esac

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Run typecheck and capture output
TYPECHECK_OUTPUT=$(cd "$PROJECT_ROOT" && bunx convex typecheck 2>&1) || true
EXIT_CODE=${PIPESTATUS[0]:-$?}

if [ "$EXIT_CODE" -ne 0 ]; then
  # Extract just the error lines (skip noise)
  ERRORS=$(echo "$TYPECHECK_OUTPUT" | grep -E "(error TS|Error:)" | head -10)
  if [ -n "$ERRORS" ]; then
    MESSAGE="[Convex Typecheck] Errors found after editing $(basename "$FILE_PATH"):

$ERRORS

Fix these before deploying."
    jq -n --arg msg "$MESSAGE" '{"systemMessage": $msg}'
  fi
fi

exit 0
