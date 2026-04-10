# Handoff: Foundry Design System Token Migration — Phase 06-02 Remaining

**Created:** 2026-02-22 10:45
**Branch:** `update-design-system`
**Continuation:** A new Claude session will be spawned automatically

---

## Summary

Migrating the entire Foundry app UI from hardcoded Tailwind color classes to a semantic design token system. Phases 01-04 were done in prior sessions. This session executed phases 05-01 through 06-01, completing all secondary pages and sandbox HUD components. **One plan remains: 06-02 (final cleanup/layout polish).**

---

## Work Completed

### This Session's Commits (oldest to newest)

- [x] `edec4c3` — `feat(05-secondary-pages-01)`: Risks, Gates, Integrations (9 pages)
- [x] `d48fd4d` — `feat(05-secondary-pages-02)`: Playbooks, Sprints, Documents, Videos (8 pages, 2 skipped as redirect stubs)
- [x] `3014245` — `feat(05-secondary-pages-03)`: Activity, Audit, Settings, Patterns, Pipeline Lab, Programs + shared components (8 files + 5 previously uncommitted phase 04 files)
- [x] `442c365` — `feat(06-sandbox-polish-01)`: Sandbox HUD components (10 files, 3 skipped as already migrated)

### Visual Verification (Checkpoint from 04-03)

All 11 core pages were visually verified in both light and dark mode via Chrome browser automation. Passed — blue accents, no amber on primary actions, proper dark mode surfaces, forms/tables/buttons all correctly styled.

---

## Files Affected

### Uncommitted Changes (IMPORTANT)

Three sandbox component files show as modified but were NOT committed by 06-01 (the subagent skipped them as "already migrated" but they have unstaged changes from a prior phase):

- `src/components/sandbox/SandboxConfigPanel.tsx` — modified, unstaged
- `src/components/sandbox/SandboxManagerPage.tsx` — modified, unstaged
- `src/components/sandbox/SandboxSettingsPage.tsx` — modified, unstaged

**These need to be reviewed and either committed or discarded before proceeding.**

---

## Technical Context

### Design Token System

- Tokens defined in `design-system/foundry-tokens/` (dark.json, light.json)
- CSS variables set in `src/app/globals.css` via `@theme` block
- Utility classes: `btn-primary`, `btn-secondary`, `btn-ghost`, `card`, `card-interactive`, `input`, `select`, `textarea`, `form-label`, `badge-*`, `table-header`, `table-cell`, `table-row-hover`, `modal`, `modal-overlay`
- Terminal components use `comp-terminal-*` classes (always dark, no `dark:` prefix)
- Semantic text: `text-text-primary`, `text-text-secondary`, `text-text-muted`
- Status: `bg-status-{success|warning|error|info}-bg text-status-{type}-fg`
- Destructive buttons keep `bg-red-600` intentionally

### Build Note

Pre-existing TypeScript error in `agent-service/src/mcp/convex-mcp-server.ts:60:11` (spread types). This is NOT caused by the migration — confirmed across multiple commits. `bun run build` compiles the Next.js app successfully; only `tsc` on agent-service fails.

---

## Next Steps

### Immediate (Start Here)

1. **Review and handle the 3 uncommitted sandbox files** — check `git diff src/components/sandbox/SandboxConfigPanel.tsx src/components/sandbox/SandboxManagerPage.tsx src/components/sandbox/SandboxSettingsPage.tsx` to see what changed. If they contain token migrations, commit them. If not, investigate.

2. **Execute plan 06-02** — the last remaining plan:
   - Read `.planning/phases/06-sandbox-polish/06-02-PLAN.md`
   - Check if SUMMARY exists: `.planning/phases/06-sandbox-polish/06-02-SUMMARY.md`
   - Execute using the `/taches-cc-resources:run-plan` pattern or spawn a subagent
   - This plan likely covers layout components (`src/components/layout/`) and final cleanup

3. **After 06-02 completes**, do a full-codebase grep to verify no hardcoded color classes remain:
   ```bash
   grep -r "slate-\|amber-\|gray-\|green-\|red-\|yellow-\|emerald-\|blue-" src/ --include="*.tsx" -l
   ```
   (Expect only `bg-red-600` on destructive buttons)

### Subsequent

- Update `.planning/ROADMAP.md` to mark phases 05 and 06 as complete
- Consider a final visual verification pass across all pages in both themes
- Merge `update-design-system` branch to `main` when satisfied

---

## Commands to Run

```bash
# Check uncommitted sandbox files
git diff src/components/sandbox/SandboxConfigPanel.tsx
git diff src/components/sandbox/SandboxManagerPage.tsx
git diff src/components/sandbox/SandboxSettingsPage.tsx

# Execute the final plan
# Use /taches-cc-resources:run-plan .planning/phases/06-sandbox-polish/06-02-PLAN.md

# Verify no hardcoded colors remain after all plans
grep -r "slate-\|amber-\|gray-\|green-\|red-\|yellow-\|emerald-" src/ --include="*.tsx" -l

# Build verification
bun run build
```

---

_This handoff was generated at context window capacity. A new Claude session is being spawned to continue._
