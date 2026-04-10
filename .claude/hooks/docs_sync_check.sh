#!/bin/bash
# PostToolUse hook: Nudge docs updates when source-of-truth files change.
#
# Fires a non-blocking reminder when the agent edits a file that has a
# paired docs page in `apps/docs/src/content/docs/`. Never blocks the
# edit. Safe in CI (exits 0 non-interactively).
#
# Paired files:
#   - convex/schema.ts                    → /reference/generated/schema/
#   - public convex/*.ts functions        → /reference/generated/functions/
#   - packages/ui/src/<domain>/index.ts   → /features/<domain>/
#   - README.md                           → /getting-started/
#   - CONTRIBUTING.md                     → /contributing/
#   - DEPLOYMENT.md                       → /deployment/
#   - CLAUDE.md                           → /architecture/ + /getting-started/env-vars/

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only trigger on file-modifying tools
case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Normalize to the path relative to the project root for matching
REL_PATH="$FILE_PATH"
case "$REL_PATH" in
  /*)
    PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
    REL_PATH="${REL_PATH#"$PROJECT_ROOT"/}"
    ;;
esac

# Match against source-of-truth paths and emit a targeted nudge.
TARGET=""
case "$REL_PATH" in
  convex/schema.ts)
    TARGET="apps/docs/src/content/docs/reference/generated/schema/ — regenerate via \`bun run --cwd apps/docs reference:gen\`"
    ;;
  convex/_generated/*)
    # Generated files — never nudge
    exit 0
    ;;
  convex/*/*.test.ts|convex/*.test.ts|convex/__tests__/*)
    # Test files — never nudge
    exit 0
    ;;
  convex/*.ts|convex/*/*.ts)
    TARGET="apps/docs/src/content/docs/reference/generated/functions/ — if this function is in \`apps/docs/scripts/reference-scope.json\`, regenerate via \`bun run --cwd apps/docs reference:gen\`"
    ;;
  packages/ui/src/*/index.ts|packages/ui/src/*/index.tsx)
    DOMAIN=$(echo "$REL_PATH" | sed -E 's|packages/ui/src/([^/]+)/.*|\1|')
    TARGET="apps/docs/src/content/docs/features/${DOMAIN}.mdx — feature walkthrough may need an update or screenshot refresh"
    ;;
  README.md)
    TARGET="apps/docs/src/content/docs/index.mdx + getting-started/ — README is mirrored at the docs home and quickstart"
    ;;
  CONTRIBUTING.md)
    TARGET="apps/docs/src/content/docs/contributing/ — root CONTRIBUTING is a stub pointing at this section"
    ;;
  DEPLOYMENT.md)
    TARGET="apps/docs/src/content/docs/deployment/production-setup.mdx — production setup page is ported from this file"
    ;;
  CLAUDE.md)
    TARGET="apps/docs/src/content/docs/architecture/ + getting-started/environment-variables.mdx — CLAUDE.md seeds the architecture and env vars sections"
    ;;
  *)
    exit 0
    ;;
esac

if [ -n "$TARGET" ]; then
  MESSAGE="[docs sync] You edited $(basename "$FILE_PATH"). Consider updating:
$TARGET"
  jq -n --arg msg "$MESSAGE" '{"systemMessage": $msg}'
fi

exit 0
