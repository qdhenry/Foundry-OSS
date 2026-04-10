---
name: release-notes
description: Generate release notes from git history between tags, commits, or date ranges
---

# Release Notes Generator

Generate structured release notes from git commit history, organized by category and impact.

## Arguments

- `since` — Starting point: git tag, commit SHA, or relative date (e.g., `v0.1.0`, `abc1234`, `2 weeks ago`). Defaults to latest tag or last 2 weeks.
- `until` — Ending point. Defaults to HEAD.
- `format` — Output format: `markdown` (default), `slack`, `linkedin`.

## Process

1. Determine the commit range:
   ```bash
   # If no `since` provided, find latest tag
   git describe --tags --abbrev=0 2>/dev/null || echo "No tags found"
   # Get commits in range
   git log --oneline --no-merges ${since}..${until:-HEAD}
   ```

2. Parse commits by conventional commit prefix:
   - `feat:` / `feat(scope):` → New Features
   - `fix:` → Bug Fixes
   - `refactor:` → Improvements
   - `perf:` → Performance
   - `docs:` → Documentation
   - `chore:` / `ci:` / `build:` → Internal (omit from public notes)

3. For each feature/fix, read the changed files to understand the user-facing impact:
   ```bash
   git diff --stat ${commit}^..${commit}
   ```

4. Group by domain (detect from file paths):
   - `convex/` → Backend
   - `packages/ui/src/` → UI
   - `apps/web/` → Web App
   - `apps/desktop/` → Desktop App
   - `agent-service/` or `agent-worker/` → AI/Agent System
   - `sandbox-worker/` → Sandbox

5. Generate release notes in requested format.

## Output Templates

### Markdown (default)
```markdown
# Release Notes — [version or date range]

## New Features
- **[Domain]**: Description of feature ([scope])

## Bug Fixes
- **[Domain]**: Description of fix

## Improvements
- **[Domain]**: Description of improvement

---
*N commits by N contributors over N days*
```

### LinkedIn format
Focus on 2-3 headline features, business impact framing, no technical jargon. Keep under 1300 characters.

### Slack format
Compact bullet list with emoji prefixes. Link to PR numbers.
