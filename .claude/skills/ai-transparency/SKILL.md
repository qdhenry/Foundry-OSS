---
name: ai-transparency
description: "No Black Boxes" enforcement skill. Audits and fixes AI operations that lack proper UI state coverage — missing loading states, streaming progress, activity logs, error handling, or real-time subscriptions. Use when adding AI features, after editing AI action files, or to audit existing code for transparency gaps.
version: 1.0.0
tags: [ai, transparency, audit, ui, enforcement, governance]
---

# AI Transparency — "No Black Boxes"

Every AI operation in Foundry **must** have visible UI covering its full lifecycle: initiation, progress, streaming results, completion, and failure. Users should never wonder "is something happening?" or "did that work?"

This skill audits a target area of the codebase for AI operations lacking proper transparency, reports findings by severity, and fixes them using proven patterns already established in the codebase.

## Invocation

```
/ai-transparency                           # Audit entire codebase
/ai-transparency convex/                   # Audit all backend AI operations
/ai-transparency packages/ui/src/risks/    # Audit a specific UI domain
/ai-transparency convex/healthScoringActions.ts  # Audit a single file
```

---

<objective>
Enforce the "No Black Boxes" policy: find every AI operation that runs without adequate UI transparency and fix it so users always see what AI is doing, how far along it is, and whether it succeeded or failed.
</objective>

<process>

<step_1>
**Scan for AI operations in the target area**

Search the target path (or full codebase if none specified) for AI operation entry points:

1. **Backend AI actions** — Grep for these patterns in `convex/`:
   - `client.messages.create` or `client.messages.stream` (Anthropic SDK calls)
   - `new Anthropic(` (SDK instantiation)
   - `scheduler.runAfter` or `scheduler.runAt` paired with action names containing "ai", "analyze", "generate", "score", "assess", "decompose", "refine", "recommend", "evaluate"
   - `internalAction` definitions that import from `@anthropic-ai/sdk`

2. **Cron-triggered AI** — Read `convex/crons.ts` for scheduled jobs that invoke AI actions

3. **UI trigger points** — Grep for these patterns in `packages/ui/src/`:
   - `useMutation` or `useAction` calls referencing AI-related Convex functions
   - Button onClick handlers that call AI mutations/actions
   - Components that render AI-generated content without showing generation state

Build a list of every AI operation found, noting its:
- **Trigger**: How it starts (user action, cron, webhook, scheduled)
- **Backend file**: Where the AI call lives
- **UI file**: Where the trigger/display lives (if any)
</step_1>

<step_2>
**Audit each operation against the six transparency rules**

For each AI operation found, check all six rules. Use `Read` and `Grep` to verify.

### Rule A: Status Tracking (CRITICAL)

Every AI action must update a status field through its lifecycle.

**Check**: Does the Convex action/mutation update a `status` field on a document through at least these transitions?
- `"processing"` (or `"running"`, `"analyzing"`) — set when work begins
- `"completed"` (or `"ready"`, `"done"`) — set on success
- `"failed"` (or `"error"`) — set on failure

**Fail if**: Action runs AI work but never patches a `status` field, or only sets status at the end (not at the start).

**Good example** — `convex/taskDecomposition.ts:252`:
```typescript
// Status set to "processing" BEFORE AI work begins
await ctx.db.insert("taskDecompositions", {
  status: "processing",
  generationProgress: "Analyzing requirement context...",
  // ...
});
```

---

### Rule B: UI Status Subscription (CRITICAL)

Every AI operation visible to users must have a reactive `useQuery` watching its status.

**Check**: Is there a `useQuery` call in `packages/ui/src/` that:
- Subscribes to the status/progress of this specific AI operation?
- Uses a Convex query (not just local `useState`) to track backend state?

**Fail if**: The UI triggers AI work via `useMutation`/`useAction` but only tracks completion via local state (`useState`), or has no query watching the operation's progress at all.

**Good example** — `packages/ui/src/discovery/DiscoveryDocumentZone.tsx`:
```typescript
// Reactive subscription to backend AI status
const activityLogs = useQuery(api.documentAnalysis.getActivityLogs, { programId });
const batchProgress = useQuery(api.documentAnalysis.getBatchProgress, { programId });
```

---

### Rule C: Activity Logging (BLOCKING)

Every AI action that takes more than ~2 seconds must log activity at each phase.

**Check**: Does the Convex action call `logActivity`, `logAuditEvent`, or equivalent at multiple points during execution (not just start/end)?

**Fail if**: Action calls Anthropic SDK but has zero `logActivity`/`logAuditEvent` calls, or only logs at the very end.

**Good example** — `convex/documentAnalysisActions.ts:263-320`:
```typescript
const SECTION_MARKERS = [
  { key: '"requirements"', step: "ai_requirements", message: "Extracting requirements..." },
  { key: '"risks"',        step: "ai_risks",        message: "Identifying risks..." },
  { key: '"integrations"', step: "ai_integrations",  message: "Mapping integrations..." },
];

// During streaming, log activity as each section is reached
for (const marker of SECTION_MARKERS) {
  if (fullText.includes(marker.key) && !completedSections.has(marker.key)) {
    await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
      analysisId, step: marker.step, message: marker.message,
    });
    completedSections.add(marker.key);
  }
}
```

---

### Rule D: Fire-and-Forget UI (BLOCKING)

UI components must not trigger AI work and then immediately dismiss or hide the operation.

**Check**: When a component calls `useMutation`/`useAction` for AI work:
- Does it show a persistent progress indicator (not just a button spinner)?
- Does it subscribe to backend progress (not just local `isLoading`)?
- Does it show incremental/streaming results as they arrive?

**Fail if**: Component sets `setLoading(true)`, calls mutation, sets `setLoading(false)`, and that's the entire feedback. The user sees a brief spinner then nothing until results magically appear (or don't).

**Good example** — `packages/ui/src/workstreams/pipeline/TaskDecompositionPanel.tsx`:
```typescript
// Banner tells user what to expect
<div>Tasks will appear below as they are generated</div>

// Reactive query streams in tasks as they're created
const decomposition = useQuery(api.taskDecomposition.getLatest, { requirementId });
// decomposition.tasks grows incrementally, decomposition.generationProgress updates live
```

---

### Rule E: Silent Cron AI (WARNING)

Cron-triggered AI operations should have a notification or status indicator.

**Check**: For each cron job in `convex/crons.ts` that triggers AI work:
- Is there a UI component that shows when the operation last ran?
- Is there a query that exposes the cron's last execution time/result?
- Does the cron action log activity that users can see?

**Fail if**: Cron triggers AI work (scoring, detection, reconciliation) and the user has no way to know it ran, what it found, or if it failed.

---

### Rule F: Missing Error States (WARNING)

Every UI component displaying AI results must handle the failure case.

**Check**: Does the component that shows AI results also:
- Check for `status === "failed"` or `status === "error"`?
- Display an error message with context?
- Offer a retry action?

**Fail if**: Component shows a loading spinner while AI runs and shows results on success, but renders nothing (or crashes) on failure.

</step_2>

<step_3>
**Report findings**

Produce a structured report grouped by severity:

```markdown
## AI Transparency Audit Report

### CRITICAL (must fix — users have zero visibility)
- [file:line] **[Operation Name]** — [Rule violated]. [What's missing].

### BLOCKING (must fix — users have inadequate visibility)
- [file:line] **[Operation Name]** — [Rule violated]. [What's missing].

### WARNING (should fix — users have partial visibility)
- [file:line] **[Operation Name]** — [Rule violated]. [What's missing].

### PASS (transparent operations)
- **[Operation Name]** — Activity logs, status tracking, UI subscription, error handling all present.

**Score: X/Y operations fully transparent**
```
</step_3>

<step_4>
**Fix each finding using proven patterns**

Apply fixes starting with CRITICAL, then BLOCKING, then WARNING. For each fix, follow the established patterns below.

### Fix Pattern: Add Activity Logging to a Convex Action

Reference: `convex/documentAnalysisActions.ts`

1. Define `SECTION_MARKERS` array mapping AI output sections to log messages
2. During streaming, check for markers and call `logActivity` with throttling (2s minimum between logs)
3. Log at minimum: start, each major phase, completion, and failure
4. Store logs in a queryable table (e.g., `analysisActivityLogs`)

```typescript
// Template for adding activity logging
const SECTION_MARKERS = [
  { key: "marker_in_output", step: "step_id", message: "Human-readable progress..." },
];

// At start of AI work:
await ctx.runMutation(internalApi.MODULE.logActivity, {
  entityId, step: "ai_start", message: "Starting analysis...",
});

// During streaming (with throttle):
let lastLogTime = 0;
for (const marker of SECTION_MARKERS) {
  if (fullText.includes(marker.key) && !completed.has(marker.key)) {
    const now = Date.now();
    if (now - lastLogTime > 2000) {
      await ctx.runMutation(internalApi.MODULE.logActivity, {
        entityId, step: marker.step, message: marker.message,
      });
      lastLogTime = now;
    }
    completed.add(marker.key);
  }
}

// On completion:
await ctx.runMutation(internalApi.MODULE.logActivity, {
  entityId, step: "ai_complete", message: "Analysis complete.",
});

// On failure (in catch block):
await ctx.runMutation(internalApi.MODULE.logActivity, {
  entityId, step: "ai_error", message: `Analysis failed: ${error.message}`,
});
```

### Fix Pattern: Add Status Tracking to a Convex Action

Reference: `convex/taskDecomposition.ts`

1. Patch the target document with `status: "processing"` before AI work
2. Update `generationProgress` string during streaming (for UI to display)
3. Patch `status: "completed"` on success, `status: "failed"` on error
4. Ensure the schema has these fields (update `convex/schema.ts` if needed)

```typescript
// Before AI work:
await ctx.db.patch(docId, {
  status: "processing",
  generationProgress: "Initializing...",
});

// During streaming:
await ctx.db.patch(docId, {
  generationProgress: `Processed ${count} items...`,
});

// On success:
await ctx.db.patch(docId, {
  status: "completed",
  generationProgress: undefined,
});

// On failure:
await ctx.db.patch(docId, {
  status: "failed",
  error: error.message,
  generationProgress: undefined,
});
```

### Fix Pattern: Add UI Status Subscription

Reference: `packages/ui/src/discovery/DiscoveryDocumentZone.tsx`, `packages/ui/src/workstreams/pipeline/TaskDecompositionPanel.tsx`

1. Add a `useQuery` subscribing to the operation's status/activity logs
2. Render distinct UI states for: idle, processing, streaming results, completed, failed
3. Show a progress indicator during processing (not just a button spinner)
4. Display incremental results as they arrive

```tsx
// Subscribe to backend status
const operationStatus = useQuery(api.module.getStatus, { entityId });
const activityLogs = useQuery(api.module.getActivityLogs, { entityId });

// Render based on status
{operationStatus?.status === "processing" && (
  <div className="flex items-center gap-2 text-sm text-[--text-tertiary]">
    <Spinner size="sm" />
    <span>{operationStatus.generationProgress ?? "Processing..."}</span>
  </div>
)}

{operationStatus?.status === "failed" && (
  <div className="flex items-center gap-2 text-sm text-[--text-error]">
    <AlertCircle size={16} />
    <span>Failed: {operationStatus.error}</span>
    <button onClick={handleRetry}>Retry</button>
  </div>
)}

{/* Activity log feed */}
{activityLogs?.map((log) => (
  <div key={log._id} className="text-xs text-[--text-tertiary]">
    {log.message}
  </div>
))}
```

### Fix Pattern: Add Error State to Existing UI

1. Find the component's existing loading/success rendering
2. Add a branch for `status === "failed"` or `status === "error"`
3. Show error message + retry button
4. Ensure the error state doesn't break the layout

### Fix Pattern: Add Cron Visibility

1. Add a query that exposes the cron's last execution time and result
2. Show "Last updated: [time]" in the relevant UI component
3. If the cron found issues, surface them as notifications or badges

</step_4>

</process>

<success_criteria>
- Every AI operation in the scanned area has been evaluated against all 6 rules
- All CRITICAL and BLOCKING findings have been fixed
- WARNING findings have been reported with recommended fixes
- Each fix follows the established patterns from the reference files
- No new AI operations introduced without full transparency coverage
- Report includes a transparency score (X/Y operations fully transparent)
</success_criteria>
