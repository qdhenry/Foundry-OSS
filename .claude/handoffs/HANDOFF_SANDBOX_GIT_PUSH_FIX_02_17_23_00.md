# Handoff: Sandbox Git Push Failures & Finalize Race Condition Fix

**Created:** 2026-02-17
**Branch:** `main-integrations`
**Status:** Implementation complete, needs deployment & testing

---

## Summary

Fixed two root causes preventing sandbox agent code from being pushed to remote branches after the first subtask: (1) non-fast-forward push rejections because new sandbox sessions started from the default branch HEAD instead of the remote worktree branch, and (2) missing upstream tracking causing "no upstream branch" push failures. Also fixed a runtime crash in `TaskAuditTrail` caused by an unrecognized `subtask_started` event type.

---

## Work Completed

### Changes Made

- [x] `setupWorkspace()` now fetches the remote branch and checks out from it if it exists (fixes non-fast-forward push rejection)
- [x] New branches get an immediate `git push --set-upstream` during setup to establish remote tracking
- [x] `autoCommitAndPush()` uses `--set-upstream` on push
- [x] `handleFinalize()` uses `--set-upstream` on push
- [x] `EventIcon` component gets fallback for unknown event types (fixes "Cannot read properties of undefined" crash)
- [ ] NOT changed: finalize retry logic — was already implemented (lines 1169-1196 in orchestrator.ts)

### Key Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Push immediately on new branch creation in `setupWorkspace` | Establishes upstream tracking before any execution, so all subsequent pushes work with plain `git push` | Could rely solely on `--set-upstream` flags on later pushes, but this is more robust |
| Fallback to `sandbox_started` config for unknown event types | Matches existing pattern at line 234 of TaskAuditTrail.tsx | Could add `subtask_started` as a new entry in EVENT_CONFIG, but there may be other unknown types |

---

## Files Affected

### Modified

- **`sandbox-worker/src/session-store.ts`** — 3 changes:
  - `setupWorkspace()` (lines 798-828): Replaced blind `git checkout -B` with fetch → check remote → conditional checkout. New branches also get an immediate push to set upstream.
  - `autoCommitAndPush()` (line ~1180): Added `--set-upstream` to `git push`
  - `handleFinalize()` (line ~431): Added `--set-upstream` to `git push`

- **`src/components/audit/TaskAuditTrail.tsx`** (line 73):
  - Added `?? EVENT_CONFIG.sandbox_started` fallback in `EventIcon` component to handle unknown event types like `subtask_started`

### Read (Reference)

- `convex/sandbox/orchestrator.ts` — Confirmed finalize retry logic already exists (lines 1169-1196), found `subtask_started` event type cast (line 1693)

---

## Technical Context

### Root Cause Analysis

**Push failures:** The sandbox worker's `setupWorkspace()` ran `git checkout -B {branch}` which force-creates the local branch from current HEAD (the default branch). For subtask 2+, the remote `{branch}` already had commits from subtask 1, so the local branch was behind the remote, causing non-fast-forward rejection.

**EventIcon crash:** The orchestrator records `subtask_started` audit events (cast via `as AuditEventType`), but the frontend `EVENT_CONFIG` map only has 7 entries. `EVENT_CONFIG["subtask_started"]` returns `undefined`, and accessing `.bg` on `undefined` throws.

### The Finalize Race Condition

The plan called for adding retry logic on HTTP 409 ("still executing"), but this was **already implemented** at lines 1169-1196 of `orchestrator.ts` with:
- 5 retries (`FINALIZE_RETRY_LIMIT`)
- 5-second delay (`FINALIZE_RETRY_DELAY_MS`)
- Pattern matching: `/still executing/i`, `/object to be reset/i`, `/internal error/i`

---

## Current State

### What's Working

- TypeScript compiles cleanly (`npx tsc --noEmit` passes in sandbox-worker)
- All changes are in working tree (unstaged)

### What's Not Working

- Changes are **not deployed** — sandbox worker needs `npx wrangler deploy`, Convex picks up changes via `npx convex dev`

---

## Next Steps

### Immediate (Start Here)

1. **Deploy sandbox worker:** `cd sandbox-worker && npx wrangler deploy`
2. **Verify Convex dev is running** (picks up TaskAuditTrail fix automatically)
3. **Test with a multi-subtask sandbox execution:**
   - Run "Execute All Subtasks" on a task
   - Verify subtask 1 pushes and sets upstream
   - Verify subtask 2+ starts from the remote branch (not behind)
   - Check GitHub branch for accumulating linear commits
4. **Verify TaskAuditTrail** no longer crashes on pages with `subtask_started` audit events

### Subsequent

- Consider adding `subtask_started` (and potentially other future event types) as a proper entry in `EVENT_CONFIG` instead of just using the fallback
- Monitor Convex dashboard for `sandboxSessions` — should no longer show "still executing" failures

---

## Commands to Run

```bash
# Deploy sandbox worker
cd sandbox-worker && npx wrangler deploy

# Convex dev (should already be running)
npx convex dev

# Next.js dev
npm run dev

# Check for remaining issues
grep -r "subtask_started" convex/ --include="*.ts"
```

### Search Queries

- `git push origin` in `session-store.ts` — finds all push commands (verify all have --set-upstream)
- `EVENT_CONFIG` in `TaskAuditTrail.tsx` — finds event type configuration
- `as AuditEventType` in orchestrator — finds cast event types that may not be in frontend config

---

## Open Questions

- [ ] Are there other event types being cast via `as AuditEventType` that could cause similar crashes?
- [ ] Should the initial `git push --set-upstream` in `setupWorkspace` for new branches fail gracefully if the network is temporarily unavailable?

---

_This handoff was generated at context window capacity. Start a new session and use this document as your initial context._
