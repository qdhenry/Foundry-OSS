#!/bin/bash
# Security Enforcement Hook
# Checks: assertOrgAccess usage, withIndex usage, no raw ctx.auth
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

# Skip non-function files
case "$FILE_PATH" in
  */convex/_generated/*|*schema.ts|*tsconfig*|*.test.ts) exit 0 ;;
esac

# Read the file content
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

CONTENT=$(cat "$FILE_PATH")

# SEC-001/SEC-002: Check that query/mutation handlers call assertOrgAccess or getAuthUser
if echo "$CONTENT" | grep -qE '(query|mutation)\(\{'; then
  if ! echo "$CONTENT" | grep -qE '(assertOrgAccess|getAuthUser)'; then
    BASENAME=$(basename "$FILE_PATH")
    case "$BASENAME" in
      http.ts|crons.ts) ;; # System files don't need org access
      *)
        LINE=$(echo "$CONTENT" | grep -nE '(query|mutation)\(\{' | head -1 | cut -d: -f1)
        echo "[GOVERNANCE:BLOCK] SEC-001: Missing assertOrgAccess/getAuthUser in query/mutation handler ($FILE_PATH:$LINE)"
        ;;
    esac
  fi
fi

# SEC-003: Check for .filter() without .withIndex()
if echo "$CONTENT" | grep -qE '\.filter\('; then
  echo "$CONTENT" | grep -nE '\.filter\(' | while IFS=: read -r LINE_NUM LINE_CONTENT; do
    START=$((LINE_NUM > 10 ? LINE_NUM - 10 : 1))
    CONTEXT=$(echo "$CONTENT" | sed -n "${START},${LINE_NUM}p")
    if ! echo "$CONTEXT" | grep -qE '\.withIndex\('; then
      echo "[GOVERNANCE:BLOCK] SEC-003: .filter() without .withIndex() — use index-driven queries ($FILE_PATH:$LINE_NUM)"
    fi
  done
fi

# SEC-004: No direct ctx.auth.getUserIdentity() — use helpers
if echo "$CONTENT" | grep -qE 'ctx\.auth\.getUserIdentity\(\)'; then
  case "$FILE_PATH" in
    */model/access.ts|model/access.ts) ;; # This is the helper file
    *)
      LINE=$(echo "$CONTENT" | grep -nE 'ctx\.auth\.getUserIdentity\(\)' | head -1 | cut -d: -f1)
      echo "[GOVERNANCE:BLOCK] SEC-004: Direct ctx.auth.getUserIdentity() — use assertOrgAccess/getAuthUser from model/access.ts ($FILE_PATH:$LINE)"
      ;;
  esac
fi

exit 0
