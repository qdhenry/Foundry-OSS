#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh [patch|minor|major]
# Defaults to "patch" if no argument given.
#
# What it does:
#   1. Bumps version in all workspace package.json files + Tauri config
#   2. Generates/appends CHANGELOG.md from conventional commits since last tag
#   3. Commits the version bump + changelog
#   4. Tags with v<new-version>

BUMP_TYPE="${1:-patch}"

if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

# Get current version from root package.json
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/')
echo "Current version: $CURRENT_VERSION"

# Calculate new version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "New version: $NEW_VERSION"

# Confirm
read -p "Bump $CURRENT_VERSION -> $NEW_VERSION? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# All package.json files to update (lockstep versioning)
PACKAGE_FILES=(
  package.json
  apps/web/package.json
  apps/desktop/package.json
  apps/docs/package.json
  packages/ui/package.json
  packages/types/package.json
  agent-service/package.json
  agent-worker/package.json
  sandbox-worker/package.json
  verification-worker/package.json
)

# Bump version in each package.json
for f in "${PACKAGE_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$f"
    echo "  Updated $f"
  fi
done

# Bump Tauri config version
TAURI_CONF="apps/desktop/src-tauri/tauri.conf.json"
if [[ -f "$TAURI_CONF" ]]; then
  sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$TAURI_CONF"
  echo "  Updated $TAURI_CONF"
fi

# Generate changelog entry from conventional commits
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -n "$LAST_TAG" ]]; then
  RANGE="${LAST_TAG}..HEAD"
else
  RANGE="HEAD"
fi

CHANGELOG_ENTRY="## v${NEW_VERSION} ($(date +%Y-%m-%d))"$'\n\n'

# Group commits by type
for TYPE in feat fix docs refactor perf test build ci chore style revert; do
  COMMITS=$(git log "$RANGE" --pretty=format:"%s" --grep="^${TYPE}" 2>/dev/null || true)
  if [[ -n "$COMMITS" ]]; then
    case "$TYPE" in
      feat)     LABEL="Features" ;;
      fix)      LABEL="Bug Fixes" ;;
      docs)     LABEL="Documentation" ;;
      refactor) LABEL="Refactoring" ;;
      perf)     LABEL="Performance" ;;
      test)     LABEL="Tests" ;;
      build)    LABEL="Build" ;;
      ci)       LABEL="CI/CD" ;;
      chore)    LABEL="Chores" ;;
      style)    LABEL="Styling" ;;
      revert)   LABEL="Reverts" ;;
    esac
    CHANGELOG_ENTRY+="### ${LABEL}"$'\n'
    while IFS= read -r line; do
      CHANGELOG_ENTRY+="- ${line}"$'\n'
    done <<< "$COMMITS"
    CHANGELOG_ENTRY+=$'\n'
  fi
done

# Prepend to CHANGELOG.md
if [[ -f CHANGELOG.md ]]; then
  EXISTING=$(cat CHANGELOG.md)
  printf '%s\n\n%s' "$CHANGELOG_ENTRY" "$EXISTING" > CHANGELOG.md
else
  printf '# Changelog\n\n%s' "$CHANGELOG_ENTRY" > CHANGELOG.md
fi
echo "  Updated CHANGELOG.md"

# Stage, commit, and tag
git add -A
git commit -m "$(cat <<EOF
chore: release v${NEW_VERSION}
EOF
)"
git tag -a "v${NEW_VERSION}" -m "v${NEW_VERSION}"

echo ""
echo "Done! Version bumped to v${NEW_VERSION}"
echo "Run 'git push && git push --tags' to publish."
