#!/bin/bash
# PreToolUse hook: Block edits to .env files
# Prevents accidental modification of environment files containing secrets

FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"$//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

if echo "$BASENAME" | grep -qE '^\.(env|env\.local|env\.example|env\.production|env\.development)$'; then
  echo "BLOCKED: Cannot edit $BASENAME — environment files contain secrets and should be edited manually." >&2
  exit 2
fi

exit 0
