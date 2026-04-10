#!/bin/bash
# PostToolUse hook: AI Transparency Check
# Enforces "No Black Boxes" policy after edits to AI-related files.
# Warns when Convex actions calling Anthropic SDK lack activity logging,
# or when UI components trigger AI work without status subscriptions.

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only trigger on file-modifying tools
case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Determine if this is an AI-related file
IS_AI_BACKEND=false
IS_AI_UI=false

case "$FILE_PATH" in
  *convex/*[Aa]ction*.ts) IS_AI_BACKEND=true ;;
  *convex/ai.ts)          IS_AI_BACKEND=true ;;
  *convex/*[Aa]gent*.ts)  IS_AI_BACKEND=true ;;
  *convex/*[Ss]cor*.ts)   IS_AI_BACKEND=true ;;
esac

case "$FILE_PATH" in
  *packages/ui/src/*.tsx) IS_AI_UI=true ;;
esac

# Skip if not an AI-related file
if [ "$IS_AI_BACKEND" = false ] && [ "$IS_AI_UI" = false ]; then
  exit 0
fi

WARNINGS=""

# --- Backend AI Transparency Checks ---
if [ "$IS_AI_BACKEND" = true ] && [ -f "$FILE_PATH" ]; then
  FILE_CONTENT=$(cat "$FILE_PATH")

  # Check: File calls Anthropic SDK but has no activity logging
  HAS_ANTHROPIC=$(echo "$FILE_CONTENT" | grep -cE 'client\.messages\.(create|stream)|new Anthropic\(' || true)
  HAS_LOG_ACTIVITY=$(echo "$FILE_CONTENT" | grep -cE 'logActivity|logAuditEvent' || true)
  HAS_STATUS_PATCH=$(echo "$FILE_CONTENT" | grep -cE 'status:.*"(processing|completed|failed|error|running|ready)"' || true)

  if [ "$HAS_ANTHROPIC" -gt 0 ] && [ "$HAS_LOG_ACTIVITY" -eq 0 ]; then
    WARNINGS="${WARNINGS}
- CRITICAL: $(basename "$FILE_PATH") calls Anthropic SDK but has NO logActivity/logAuditEvent calls. AI operations must log progress at each phase (see convex/documentAnalysisActions.ts for the SECTION_MARKERS pattern)."
  fi

  if [ "$HAS_ANTHROPIC" -gt 0 ] && [ "$HAS_STATUS_PATCH" -eq 0 ]; then
    WARNINGS="${WARNINGS}
- BLOCKING: $(basename "$FILE_PATH") calls Anthropic SDK but never sets a status field (processing/completed/failed). AI operations must track status for UI subscriptions (see convex/taskDecomposition.ts for the pattern)."
  fi
fi

# --- UI AI Transparency Checks ---
if [ "$IS_AI_UI" = true ] && [ -f "$FILE_PATH" ]; then
  FILE_CONTENT=$(cat "$FILE_PATH")

  # Check: Component triggers AI via mutation/action but has no status query
  HAS_AI_TRIGGER=$(echo "$FILE_CONTENT" | grep -cE 'use(Mutation|Action)\(.*\b(ai|analy|generat|decompos|scor|assess|refin|recommend|evaluat)' || true)
  HAS_STATUS_QUERY=$(echo "$FILE_CONTENT" | grep -cE 'useQuery\(.*\b(status|progress|activity|log)' || true)

  if [ "$HAS_AI_TRIGGER" -gt 0 ] && [ "$HAS_STATUS_QUERY" -eq 0 ]; then
    WARNINGS="${WARNINGS}
- BLOCKING: $(basename "$FILE_PATH") triggers AI work via useMutation/useAction but has no useQuery subscription for status/progress/activity. Users need real-time visibility into AI operations (see packages/ui/src/discovery/DiscoveryDocumentZone.tsx for the pattern)."
  fi

  # Check: Component has AI loading state but no error state
  HAS_LOADING=$(echo "$FILE_CONTENT" | grep -cE 'isLoading|isProcessing|isExecuting|isAnalyzing|isGenerating' || true)
  HAS_ERROR_STATE=$(echo "$FILE_CONTENT" | grep -cE 'status.*===.*"(failed|error)"|isError|error\s*&&|\.error\b' || true)

  if [ "$HAS_LOADING" -gt 0 ] && [ "$HAS_ERROR_STATE" -eq 0 ]; then
    WARNINGS="${WARNINGS}
- WARNING: $(basename "$FILE_PATH") has AI loading states but no error/failure UI branch. Add handling for status === \"failed\" with an error message and retry action."
  fi
fi

# --- Output warnings as systemMessage ---
if [ -n "$WARNINGS" ]; then
  MESSAGE="[AI Transparency] \"No Black Boxes\" policy violations in $(basename "$FILE_PATH"):
${WARNINGS}

Run /ai-transparency $(basename "$FILE_PATH") for detailed audit and fixes."
  jq -n --arg msg "$MESSAGE" '{"systemMessage": $msg}'
fi

exit 0
