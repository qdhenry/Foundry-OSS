#!/bin/bash
# Convex Patterns Enforcement Hook
# Checks: table naming, function naming, validator patterns
# Input: JSON from PostToolUse hook (stdin)
# Output: violation messages to stdout

set -uo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only check convex TypeScript files
case "$FILE_PATH" in
  */convex/*.ts|convex/*.ts|*/convex/**/*.ts|convex/**/*.ts) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  */convex/_generated/*|*.test.ts) exit 0 ;;
esac

if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

CONTENT=$(cat "$FILE_PATH")
BASENAME=$(basename "$FILE_PATH")

# CVX-001: Table names must be camelCase (only in schema.ts)
if [ "$BASENAME" = "schema.ts" ]; then
  echo "$CONTENT" | grep -nE '[a-zA-Z_]+:[[:space:]]*defineTable\(' | while IFS=: read -r LINE_NUM LINE_CONTENT; do
    TABLE_NAME=$(echo "$LINE_CONTENT" | sed -E 's/^[[:space:]]*//' | cut -d: -f1 | tr -d ' "')
    if echo "$TABLE_NAME" | grep -qE '(^[A-Z]|_|-)'; then
      echo "[GOVERNANCE:BLOCK] CVX-001: Table name '$TABLE_NAME' must be camelCase plural ($FILE_PATH:$LINE_NUM)"
    fi
  done
fi

# CVX-002: Exported function names must be camelCase
echo "$CONTENT" | grep -nE 'export[[:space:]]+const[[:space:]]+[a-zA-Z]+[[:space:]]*=' | while IFS=: read -r LINE_NUM LINE_CONTENT; do
  FUNC_NAME=$(echo "$LINE_CONTENT" | sed -E 's/.*export[[:space:]]+const[[:space:]]+([a-zA-Z_]+)[[:space:]]*=.*/\1/')
  if echo "$LINE_CONTENT" | grep -qE '(query|mutation|action|internalQuery|internalMutation|internalAction)\('; then
    if echo "$FUNC_NAME" | grep -qE '(^[A-Z]|_)'; then
      echo "[GOVERNANCE:BLOCK] CVX-002: Function name '$FUNC_NAME' must be camelCase ($FILE_PATH:$LINE_NUM)"
    fi
  fi
done

# CVX-003: Status/type/priority fields should use v.union(v.literal()) not v.string()
if [ "$BASENAME" = "schema.ts" ]; then
  echo "$CONTENT" | grep -nE '(status|type|priority|phase|severity|category):[[:space:]]*v\.string\(\)' | while IFS=: read -r LINE_NUM LINE_CONTENT; do
    FIELD_NAME=$(echo "$LINE_CONTENT" | sed -E 's/.*([a-zA-Z]+):[[:space:]]*v\.string.*/\1/' | tr -d ' ')
    echo "[GOVERNANCE:BLOCK] CVX-003: Field '$FIELD_NAME' should use v.union(v.literal()) not v.string() ($FILE_PATH:$LINE_NUM)"
  done
fi

exit 0
