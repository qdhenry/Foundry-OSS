#!/bin/bash
# Architecture Enforcement Hook
# Checks: component naming, route naming, Next.js 15 async params
# Input: JSON from PostToolUse hook (stdin)
# Output: violation messages to stdout

set -uo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only check src files
case "$FILE_PATH" in
  */src/**/*|src/**/*) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.test.tsx|*.test.ts) exit 0 ;;
esac

if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")
DIRNAME=$(dirname "$FILE_PATH")

# ARCH-001: Component files must be PascalCase
case "$FILE_PATH" in
  */src/components/**/*.tsx|src/components/**/*.tsx)
    case "$BASENAME" in
      index.tsx|index.ts) ;; # index files are fine
      *)
        FIRST_CHAR=$(echo "$BASENAME" | cut -c1)
        if echo "$FIRST_CHAR" | grep -qE '[a-z]'; then
          echo "[GOVERNANCE:BLOCK] ARCH-001: Component file '$BASENAME' must be PascalCase (e.g., MyComponent.tsx) ($FILE_PATH)"
        fi
        ;;
    esac
    ;;
esac

# ARCH-002: Route directories must be kebab-case
case "$FILE_PATH" in
  */src/app/*/page.tsx|src/app/*/page.tsx|*/src/app/*/layout.tsx|src/app/*/layout.tsx)
    ROUTE_DIR=$(basename "$DIRNAME")
    case "$ROUTE_DIR" in
      \[*\]|\(*\)) ;; # Dynamic routes and groups are fine
      *)
        if echo "$ROUTE_DIR" | grep -qE '([A-Z]|_)'; then
          echo "[GOVERNANCE:BLOCK] ARCH-002: Route directory '$ROUTE_DIR' must be kebab-case ($DIRNAME)"
        fi
        ;;
    esac
    ;;
esac

# ARCH-003: Next.js 15 async params
case "$BASENAME" in
  page.tsx|layout.tsx)
    CONTENT=$(cat "$FILE_PATH")
    if echo "$CONTENT" | grep -qE 'params\.' ; then
      if ! echo "$CONTENT" | grep -qE 'await[[:space:]]+.*params'; then
        if ! echo "$CONTENT" | grep -qE 'const[[:space:]]+\{.*\}[[:space:]]*=[[:space:]]*await'; then
          LINE=$(echo "$CONTENT" | grep -nE 'params\.' | head -1 | cut -d: -f1)
          echo "[GOVERNANCE:BLOCK] ARCH-003: params must be awaited in Next.js 15 — use 'const { id } = await params' ($FILE_PATH:$LINE)"
        fi
      fi
    fi
    ;;
esac

# ARCH-004: Test co-location warning
case "$FILE_PATH" in
  */src/components/**/*.tsx|src/components/**/*.tsx)
    case "$BASENAME" in
      index.tsx|*.test.tsx|*.stories.tsx) ;;
      *)
        TEST_FILE="${FILE_PATH%.tsx}.test.tsx"
        if [ ! -f "$TEST_FILE" ]; then
          echo "[GOVERNANCE:WARN] ARCH-004: No test file found — consider creating $(basename "$TEST_FILE") ($FILE_PATH)"
        fi
        ;;
    esac
    ;;
esac

exit 0
