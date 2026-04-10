#!/bin/bash
# PostToolUse hook: Run related Convex tests when Convex files are edited
# Async hook — runs in background, output shown as notification

FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"$//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only trigger for convex/ source files (not tests, not _generated)
if ! echo "$FILE_PATH" | grep -q '/convex/'; then
  exit 0
fi
if echo "$FILE_PATH" | grep -qE '(__tests__|_generated|\.test\.)'; then
  exit 0
fi

# Extract the base module name
BASENAME=$(basename "$FILE_PATH" .ts)

# Check if a corresponding test file exists
TEST_FILE="convex/__tests__/${BASENAME}.test.ts"
if [ ! -f "$TEST_FILE" ]; then
  exit 0
fi

# Run the test
bunx vitest run "$TEST_FILE" --reporter=dot 2>&1 | tail -10
