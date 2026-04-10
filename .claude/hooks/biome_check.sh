#!/bin/bash
# PostToolUse hook: Auto-fix formatting + report lint issues via Biome
# Runs biome check --write (silent fix), then biome check (diagnostic report)

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only trigger on file-modifying tools
case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Only check TypeScript/TSX/JS/JSX/CSS/JSON files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.css|*.json) ;;
  *) exit 0 ;;
esac

# Skip files outside target workspaces
case "$FILE_PATH" in
  */apps/web/*|apps/web/*) ;;
  */apps/docs/*|apps/docs/*) ;;
  */packages/ui/*|packages/ui/*) ;;
  */convex/*|convex/*) ;;
  */agent-service/*|agent-service/*) ;;
  */agent-worker/*|agent-worker/*) ;;
  */sandbox-worker/*|sandbox-worker/*) ;;
  *) exit 0 ;;
esac

# Skip generated files
case "$FILE_PATH" in
  */convex/_generated/*|convex/_generated/*) exit 0 ;;
  */_generated/*) exit 0 ;;
  */.next/*) exit 0 ;;
  */.astro/*) exit 0 ;;
  */apps/docs/dist/*) exit 0 ;;
  */apps/docs/public/screenshots/generated/*) exit 0 ;;
  */apps/docs/src/content/docs/reference/generated/*) exit 0 ;;
  */dist/*) exit 0 ;;
  */node_modules/*) exit 0 ;;
esac

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Resolve to absolute path if relative
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="$PROJECT_ROOT/$FILE_PATH"
fi

# Check file exists
[ -f "$FILE_PATH" ] || exit 0

# Step 1: Auto-fix formatting + safe lint fixes (silent)
cd "$PROJECT_ROOT"
bunx biome check --write "$FILE_PATH" 2>/dev/null || true

# Step 2: Diagnostic check for remaining issues
BIOME_OUTPUT=$(bunx biome check "$FILE_PATH" 2>&1 || true)

# Extract diagnostic header lines (file:line:col rule/category/name ━━━)
ISSUES=$(echo "$BIOME_OUTPUT" | grep '━━━' | grep -v '^Checked' | grep -v '^check ' | head -15 || true)
if [ -n "$ISSUES" ]; then
  BASENAME=$(basename "$FILE_PATH")
  MESSAGE="[Biome] Issues in $BASENAME after auto-fix:

$ISSUES

Run \`bun run check:fix\` to attempt auto-fix, or address manually."
  jq -n --arg msg "$MESSAGE" '{"systemMessage": $msg}'
fi

exit 0
