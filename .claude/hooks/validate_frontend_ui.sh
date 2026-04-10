#!/bin/bash
# Async PostToolUse hook: When frontend files are modified, instruct the agent
# to spawn a browser-automation-inspector subagent to validate the UI.
#
# This hook runs in the background (async: true) so it never blocks the main agent.
# It detects frontend file changes, maps them to likely routes, and returns a
# systemMessage that triggers the agent to visually validate the page in Chrome.

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only trigger on file-modifying tools
case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Only trigger on frontend files (.tsx, .ts, .css in src/)
case "$FILE_PATH" in
  */src/app/*.tsx|*/src/app/*.ts|*/src/components/*.tsx|*/src/components/*.ts|*/src/app/*.css|*/src/components/*.css) ;;
  *) exit 0 ;;
esac

# Skip non-visual files (hooks, utils, types, constants, lib)
BASENAME=$(basename "$FILE_PATH")
case "$BASENAME" in
  *.test.*|*.spec.*|*.d.ts) exit 0 ;;
esac
case "$FILE_PATH" in
  */hooks/*|*/utils/*|*/types/*|*/constants/*|*/lib/*|*/helpers/*) exit 0 ;;
esac

# --- Route mapping ---
# Map changed file to the most likely page route for validation

ROUTE=""
DESCRIPTION=""

# Direct page.tsx edits — extract route from file path
if [[ "$BASENAME" == "page.tsx" ]]; then
  # Strip everything up to src/app/ and the trailing /page.tsx
  ROUTE_PATH=$(echo "$FILE_PATH" | sed -E 's|.*/src/app/||' | sed 's|/page\.tsx$||')
  # Remove route groups like (dashboard)
  ROUTE_PATH=$(echo "$ROUTE_PATH" | sed -E 's|\([^)]+\)/||g')
  ROUTE="/$ROUTE_PATH"
  DESCRIPTION="page file"
fi

# Component edits — map component directory to likely route
if [[ -z "$ROUTE" ]]; then
  case "$FILE_PATH" in
    */components/layout/*)
      ROUTE="/programs"
      DESCRIPTION="layout component (${BASENAME})"
      ;;
    */components/dashboard/*)
      ROUTE="/{programId}"
      DESCRIPTION="dashboard component (${BASENAME})"
      ;;
    */components/discovery/*)
      ROUTE="/{programId}/discovery"
      DESCRIPTION="discovery component (${BASENAME})"
      ;;
    */components/documents/*)
      ROUTE="/{programId}/documents"
      DESCRIPTION="documents component (${BASENAME})"
      ;;
    */components/skills/*)
      ROUTE="/{programId}/skills"
      DESCRIPTION="skills component (${BASENAME})"
      ;;
    */components/risks/*)
      ROUTE="/{programId}/risks"
      DESCRIPTION="risks component (${BASENAME})"
      ;;
    */components/gates/*)
      ROUTE="/{programId}/gates"
      DESCRIPTION="gates component (${BASENAME})"
      ;;
    */components/integrations/*)
      ROUTE="/{programId}/integrations"
      DESCRIPTION="integrations component (${BASENAME})"
      ;;
    */components/sprints/*)
      ROUTE="/{programId}/sprints"
      DESCRIPTION="sprints component (${BASENAME})"
      ;;
    */components/tasks/*)
      ROUTE="/{programId}/tasks"
      DESCRIPTION="tasks component (${BASENAME})"
      ;;
    */components/playbooks/*)
      ROUTE="/{programId}/playbooks"
      DESCRIPTION="playbooks component (${BASENAME})"
      ;;
    */components/audit/*)
      ROUTE="/{programId}/audit"
      DESCRIPTION="audit component (${BASENAME})"
      ;;
    */components/coordination/*)
      ROUTE="/{programId}/workstreams"
      DESCRIPTION="coordination component (${BASENAME})"
      ;;
    */components/programs/*)
      ROUTE="/programs"
      DESCRIPTION="programs component (${BASENAME})"
      ;;
    */components/search/*)
      ROUTE="/programs"
      DESCRIPTION="search component (${BASENAME})"
      ;;
    */components/comments/*)
      ROUTE="/{programId}/discovery"
      DESCRIPTION="comments component (${BASENAME})"
      ;;
    */components/ai/*)
      ROUTE="/{programId}/activity"
      DESCRIPTION="AI component (${BASENAME})"
      ;;
    *)
      ROUTE="/programs"
      DESCRIPTION="component (${BASENAME})"
      ;;
  esac
fi

# Build the systemMessage that will be delivered to the agent on the next turn
MESSAGE="[UI Validation Trigger] Frontend ${DESCRIPTION} was modified: ${BASENAME}

The file \`${FILE_PATH}\` was just changed. To validate this change visually:

1. Use the Task tool with subagent_type=\"browser-automation-inspector\" to inspect the affected page
2. The likely route is: ${ROUTE}
3. The app runs at http://localhost:3000
4. If the page requires authentication, the subagent should check if already signed in first
5. The subagent should: take a screenshot, check for console errors, verify the modified component renders correctly

If you are in the middle of a multi-file change, you may defer validation until the logical change is complete."

# Output JSON with systemMessage for delivery on next turn
jq -n --arg msg "$MESSAGE" '{"systemMessage": $msg}'
