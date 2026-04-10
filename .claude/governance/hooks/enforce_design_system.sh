#!/bin/bash
# Design System Enforcement Hook
# Checks: arbitrary colors, purple, CSS tokens, component classes, dark: prefix
# Input: JSON from PostToolUse hook (stdin)
# Output: violation messages to stdout

set -uo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only check src files
case "$FILE_PATH" in
  */src/**/*.tsx|src/**/*.tsx|*/src/**/*.css|src/**/*.css) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.test.tsx|*.test.ts) exit 0 ;;
esac

if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

CONTENT=$(cat "$FILE_PATH")

# DS-001: No arbitrary color values in Tailwind classes
echo "$CONTENT" | grep -nE '(text|bg|border|ring|outline|shadow|fill|stroke)-\[#[0-9a-fA-F]+\]' | while IFS=: read -r LINE_NUM LINE_CONTENT; do
  MATCH=$(echo "$LINE_CONTENT" | grep -oE '(text|bg|border|ring|outline|shadow|fill|stroke)-\[#[0-9a-fA-F]+\]' | head -1)
  echo "[GOVERNANCE:BLOCK] DS-001: Arbitrary color '$MATCH' — use CSS custom property or design token ($FILE_PATH:$LINE_NUM)"
done

# DS-002: No purple/violet colors
echo "$CONTENT" | grep -niE '(purple|violet|#7c3aed|#8b5cf6|#a78bfa|#6d28d9|#5b21b6|#4c1d95)' | while IFS=: read -r LINE_NUM LINE_CONTENT; do
  TRIMMED=$(echo "$LINE_CONTENT" | sed 's/^[[:space:]]*//')
  case "$TRIMMED" in
    //*|*\*/*) ;; # Skip JS/CSS comments
    *)
      echo "[GOVERNANCE:BLOCK] DS-002: Purple/violet color detected — use blue/slate palette per UI rules ($FILE_PATH:$LINE_NUM)"
      ;;
  esac
done

# DS-009: No dark: prefix in className (Tailwind 3 pattern, we use CSS-first dark mode)
echo "$CONTENT" | grep -nE 'className="[^"]*dark:' | while IFS=: read -r LINE_NUM LINE_CONTENT; do
  echo "[GOVERNANCE:BLOCK] DS-009: dark: prefix in className — use .dark CSS selector instead (Tailwind 4 CSS-first) ($FILE_PATH:$LINE_NUM)"
done
echo "$CONTENT" | grep -nE 'className=\{[^}]*dark:' | while IFS=: read -r LINE_NUM LINE_CONTENT; do
  echo "[GOVERNANCE:BLOCK] DS-009: dark: prefix in className — use .dark CSS selector instead (Tailwind 4 CSS-first) ($FILE_PATH:$LINE_NUM)"
done

# DS-005: Warn about complex button styling that could use .btn-*
case "$FILE_PATH" in
  *.tsx)
    if echo "$CONTENT" | grep -qE 'className="[^"]*rounded[^"]*bg-[^"]*px-[^"]*py-[^"]*font-'; then
      LINE=$(echo "$CONTENT" | grep -nE 'className="[^"]*rounded[^"]*bg-[^"]*px-[^"]*py-[^"]*font-' | head -1 | cut -d: -f1)
      echo "[GOVERNANCE:WARN] DS-005: Consider using .btn-primary/.btn-secondary/.btn-ghost utility class ($FILE_PATH:$LINE)"
    fi
    ;;
esac

exit 0
