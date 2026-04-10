# Convex Background Job Management — LLM Reference Guide

This guide provides patterns for implementing background jobs in Convex. Use it when you need to run long-running tasks, track progress, handle retries, or manage async workflows.

## Core Concept

Convex has no traditional job queue. Instead, background jobs are implemented by combining two primitives:

1. **A tracking table** — stores job status, progress, and results
2. **`ctx.scheduler.runAfter()` / `ctx.scheduler.runAt()`** — schedules functions to run asynchronously

The client calls a mutation that inserts a job record and schedules the work, then subscribes to the job record reactively. As the background work progresses, it updates the record, and all subscribed clients see changes in real time.

## Pattern Overview

```
Client                    Convex Mutation              Convex Action/Mutation
  |                           |                              |
  |-- call mutation --------->|                              |
  |                           |-- insert job (status: pending)
  |                           |-- scheduler.runAfter(0, ...) |
  |<-- return jobId ----------|                              |
  |                           |                              |
  |-- useQuery(job, {jobId})->|                              |
  |   (reactive subscription) |                              |
  |                           |          scheduled fn runs --|
  |                           |          update job status --|
  |<-- re-render (progress) --|                              |
  |                           |          update job (done) --|
  |<-- re-render (complete) --|                              |
```

## Step 1: Define the Job Tracking Table

Define a table in `schema.ts` with a discriminated union for status. Each status variant carries different data.

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  backgroundJobs: defineTable({
    type: v.string(),           // job type identifier
    orgId: v.string(),          // tenant scoping (if multi-tenant)
    args: v.any(),              // serialized job arguments
    result: v.union(
      v.object({
        status: v.literal("pending"),
        details: v.string(),
      }),
      v.object({
        status: v.literal("running"),
        details: v.string(),
        progress: v.optional(v.number()), // 0-100
      }),
      v.object({
        status: v.literal("completed"),
        output: v.any(),
        elapsedMs: v.number(),
      }),
      v.object({
        status: v.literal("failed"),
        reason: v.string(),
        elapsedMs: v.number(),
      }),
      v.object({
        status: v.literal("canceled"),
      })
    ),
    scheduledFnId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_orgId", ["orgId"])
    .index("by_type_and_status", ["type", "result.status"]),
});
```

**Key design decisions:**
- Use `v.union()` with `v.literal()` for status — this gives you type-safe discrimination
- Store `scheduledFnId` to enable cancellation
- Add indexes for every query pattern you'll need (never use `.filter()`)

## Step 2: Start a Job (Mutation)

The client calls a mutation that creates the job record and schedules work immediately.

```typescript
// convex/backgroundJobs.ts
import { mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const start = mutation({
  args: {
    type: v.string(),
    jobArgs: v.any(),
  },
  handler: async (ctx, { type, jobArgs }) => {
    // Insert the job record
    const jobId = await ctx.db.insert("backgroundJobs", {
      type,
      orgId: "org_xxx", // get from auth in real code
      args: jobArgs,
      result: {
        status: "pending",
        details: "Queued...",
      },
    });

    // Schedule the work to run immediately (0ms delay)
    const scheduledFnId = await ctx.scheduler.runAfter(
      0,
      internal.backgroundJobs.execute,
      { jobId }
    );

    // Store the scheduled function ID for cancellation
    await ctx.db.patch(jobId, { scheduledFnId });

    // Also schedule a timeout check
    await ctx.scheduler.runAfter(
      5 * 60 * 1000, // 5 minute timeout
      internal.backgroundJobs.checkTimeout,
      { jobId }
    );

    // Return the ID so the client can subscribe
    return jobId;
  },
});
```

**Important:** Mutations are transactional. The job insert + schedule happen atomically. If either fails, both are rolled back.

## Step 3: Execute the Job (Action)

Actions can call external APIs, run long computations, and perform side effects. They update the job record via mutations.

```typescript
// convex/backgroundJobs.ts
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const execute = internalAction({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, { jobId }) => {
    const startTime = Date.now();

    // Update status to running
    await ctx.runMutation(internal.backgroundJobs.updateStatus, {
      jobId,
      result: { status: "running", details: "Starting...", progress: 0 },
    });

    try {
      // --- Do the actual work here ---
      // Example: call an external API
      const response = await fetch("https://api.example.com/process", {
        method: "POST",
        body: JSON.stringify({ /* ... */ }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      // Update progress incrementally
      await ctx.runMutation(internal.backgroundJobs.updateStatus, {
        jobId,
        result: { status: "running", details: "Processing results...", progress: 50 },
      });

      const data = await response.json();

      // Mark as completed
      const elapsedMs = Date.now() - startTime;
      await ctx.runMutation(internal.backgroundJobs.updateStatus, {
        jobId,
        result: { status: "completed", output: data, elapsedMs },
      });
    } catch (error: any) {
      const elapsedMs = Date.now() - startTime;
      await ctx.runMutation(internal.backgroundJobs.updateStatus, {
        jobId,
        result: {
          status: "failed",
          reason: error.message ?? "Unknown error",
          elapsedMs,
        },
      });
    }
  },
});
```

**Critical rule:** Actions update the database by calling `ctx.runMutation()`, never by writing to `ctx.db` directly (actions don't have `ctx.db`).

## Step 4: Update Status (Internal Mutation)

A simple internal mutation that patches the job record:

```typescript
// convex/backgroundJobs.ts
export const updateStatus = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
    result: v.any(), // matches the union type from schema
  },
  handler: async (ctx, { jobId, result }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    // Don't overwrite terminal states
    if (job.result.status === "completed" ||
        job.result.status === "failed" ||
        job.result.status === "canceled") {
      return;
    }

    await ctx.db.patch(jobId, { result });
  },
});
```

**Guard against terminal states.** A timeout or cancellation may fire after the job completes. Always check before patching.

## Step 5: Subscribe from the Client (React)

The client uses `useQuery` to reactively subscribe to job status. Convex re-runs the query whenever the underlying data changes.

```typescript
// convex/backgroundJobs.ts
export const get = query({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});
```

```tsx
// React component
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function JobStatus({ jobId }: { jobId: Id<"backgroundJobs"> }) {
  const job = useQuery(api.backgroundJobs.get, { jobId });

  if (!job) return <p>Loading...</p>;

  switch (job.result.status) {
    case "pending":
      return <p>Queued: {job.result.details}</p>;
    case "running":
      return (
        <div>
          <p>{job.result.details}</p>
          {job.result.progress !== undefined && (
            <progress value={job.result.progress} max={100} />
          )}
        </div>
      );
    case "completed":
      return <p>Done in {job.result.elapsedMs / 1000}s</p>;
    case "failed":
      return <p>Failed: {job.result.reason}</p>;
    case "canceled":
      return <p>Canceled</p>;
  }
}
```

**Any client with the `jobId` can subscribe** — this enables multi-client observation of the same job.

## Step 6: Cancel a Job

Cancellation is transactional. Because mutations have serializable isolation, either the cancel sees the job hasn't started, or the job sees it was canceled — never both.

```typescript
export const cancel = mutation({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found");

    // Only cancel if not in a terminal state
    if (job.result.status === "completed" || job.result.status === "failed") {
      return { canceled: false, reason: "Job already finished" };
    }

    // Cancel the scheduled function if we have its ID
    if (job.scheduledFnId) {
      await ctx.scheduler.cancel(job.scheduledFnId);
    }

    await ctx.db.patch(jobId, {
      result: { status: "canceled" },
    });

    return { canceled: true };
  },
});
```

**Race condition safety:** Inside the action, check job status before committing results:

```typescript
// Inside the action, before saving results:
const currentJob = await ctx.runQuery(internal.backgroundJobs.get, { jobId });
if (currentJob.result.status === "canceled") {
  return; // Don't save results for canceled jobs
}
```

## Step 7: Monitor Timeouts

Schedule a follow-up mutation when you schedule the job. It fires after the timeout period and marks the job as failed if it's still running.

```typescript
export const checkTimeout = internalMutation({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    // Only timeout jobs that are still pending or running
    if (job.result.status === "pending" || job.result.status === "running") {
      await ctx.db.patch(jobId, {
        result: {
          status: "failed",
          reason: "Job timed out",
          elapsedMs: Date.now() - job._creationTime,
        },
      });
    }
  },
});
```

## Step 8: Implement Retries

Convex automatically retries **mutations** (exactly-once guarantee) but does **not** retry **actions** (at-most-once). For actions that call external services, implement retry logic manually.

### Manual Retry Pattern

```typescript
export const executeWithRetry = internalAction({
  args: {
    jobId: v.id("backgroundJobs"),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, { jobId, attempt = 1 }) => {
    const MAX_ATTEMPTS = 5;

    try {
      const response = await fetch("https://api.example.com/work");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      await ctx.runMutation(internal.backgroundJobs.updateStatus, {
        jobId,
        result: { status: "completed", output: data, elapsedMs: 0 },
      });
    } catch (error: any) {
      if (attempt < MAX_ATTEMPTS) {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        await ctx.scheduler.runAfter(
          delay,
          internal.backgroundJobs.executeWithRetry,
          { jobId, attempt: attempt + 1 }
        );

        await ctx.runMutation(internal.backgroundJobs.updateStatus, {
          jobId,
          result: {
            status: "running",
            details: `Retry ${attempt}/${MAX_ATTEMPTS} in ${Math.round(delay / 1000)}s...`,
          },
        });
      } else {
        await ctx.runMutation(internal.backgroundJobs.updateStatus, {
          jobId,
          result: {
            status: "failed",
            reason: `Failed after ${MAX_ATTEMPTS} attempts: ${error.message}`,
            elapsedMs: 0,
          },
        });
      }
    }
  },
});
```

**Always use backoff + jitter** to avoid thundering herd problems.

### Using the Workpool Component (Recommended for Production)

For production workloads, use the `@convex-dev/workpool` component instead of hand-rolling retry logic. It provides controlled parallelism, configurable retries, and completion callbacks.

**Install:**
```bash
npm install @convex-dev/workpool
```

**Configure in `convex.config.ts`:**
```typescript
import { defineApp } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config";

const app = defineApp();
app.use(workpool, { name: "emailWorkpool" });
export default app;
```

**Create a pool instance:**
```typescript
import { Workpool } from "@convex-dev/workpool";
import { components } from "./_generated/api";

const pool = new Workpool(components.emailWorkpool, {
  maxParallelism: 10,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 5,
    initialBackoffMs: 250,
    base: 2, // exponential: 250ms, 500ms, 1s, 2s
  },
});
```

**Enqueue work:**
```typescript
export const sendEmail = mutation({
  args: { userId: v.id("users"), subject: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const workId = await pool.enqueueAction(
      ctx,
      internal.email.sendEmailAction,
      args,
      {
        onComplete: internal.email.onEmailSent,
        retry: true,
      }
    );
    return workId;
  },
});
```

## Cron Jobs (Recurring Background Work)

For recurring tasks, define cron jobs in `convex/crons.ts`:

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every 5 minutes
crons.interval(
  "health check",
  { minutes: 5 },
  internal.monitoring.checkHealth,
);

// Run at specific time (cron syntax)
crons.cron(
  "daily digest",
  "0 9 * * *", // 9:00 AM UTC daily
  internal.digests.sendDailyDigest,
);

// Monthly on the 1st
crons.monthly(
  "monthly report",
  { day: 1, hourUTC: 14, minuteUTC: 0 },
  internal.reports.generateMonthlyReport,
);

export default crons;
```

**Cron functions must be `internal` or `public`.** They cannot take dynamic arguments.

## Scheduler API Reference

| Method | Description |
|--------|-------------|
| `ctx.scheduler.runAfter(delayMs, fnRef, args)` | Schedule function after a delay (ms). 0 = immediately after current transaction. |
| `ctx.scheduler.runAt(timestamp, fnRef, args)` | Schedule function at a specific Unix timestamp (ms). |
| `ctx.scheduler.cancel(scheduledFnId)` | Cancel a scheduled function by its `Id<"_scheduled_functions">`. |

**Guarantees:**
- **Scheduled mutations** — exactly once execution. Convex retries on internal errors.
- **Scheduled actions** — at most once execution. Not retried automatically (side effects may not be idempotent).

## Common Pitfalls

1. **Don't use `.filter()` on job queries.** Always define indexes in the schema and use `.withIndex()`. Filter causes full table scans.

2. **Don't call external APIs from mutations.** Mutations are transactional and retry on conflicts. Side effects in mutations will execute multiple times. Use actions for external calls.

3. **Don't forget terminal state guards.** Always check if a job is already completed/failed/canceled before updating it. Multiple scheduled functions (timeout, retry, main work) may race.

4. **Don't skip backoff on retries.** Retrying immediately in a loop will overwhelm external services. Always use exponential backoff with jitter.

5. **Don't store large results inline.** If a job produces large output (images, files), use Convex file storage and store the `storageId` in the job record instead.

6. **Don't block the mutation.** The start mutation should insert + schedule + return. Never `await` the action itself from a mutation — that defeats the purpose.

7. **Actions cannot write to `ctx.db` directly.** They must call `ctx.runMutation()` to persist data.

## Multi-Stage Job Pattern

For jobs with multiple stages, update progress as each stage completes:

```typescript
export const multiStageJob = internalAction({
  args: { jobId: v.id("backgroundJobs") },
  handler: async (ctx, { jobId }) => {
    const stages = ["Fetching data", "Processing", "Saving results"];

    for (let i = 0; i < stages.length; i++) {
      // Check for cancellation before each stage
      const job = await ctx.runQuery(internal.backgroundJobs.getInternal, { jobId });
      if (job?.result.status === "canceled") return;

      await ctx.runMutation(internal.backgroundJobs.updateStatus, {
        jobId,
        result: {
          status: "running",
          details: stages[i],
          progress: Math.round(((i + 1) / stages.length) * 100),
        },
      });

      // Do the actual work for this stage
      await doStageWork(i);
    }

    await ctx.runMutation(internal.backgroundJobs.updateStatus, {
      jobId,
      result: { status: "completed", output: { /* ... */ }, elapsedMs: 0 },
    });
  },
});
```

## Health Monitoring Query

Expose aggregate job health for dashboards:

```typescript
export const jobHealth = query({
  args: { type: v.string() },
  handler: async (ctx, { type }) => {
    const recentJobs = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_type_and_status")
      .order("desc")
      .take(20);

    const completed = recentJobs.filter(j => j.result.status === "completed");
    const failed = recentJobs.filter(j => j.result.status === "failed");

    const avgTime = completed.length > 0
      ? completed.reduce((sum, j) =>
          sum + (j.result.status === "completed" ? j.result.elapsedMs : 0), 0
        ) / completed.length
      : 0;

    return {
      total: recentJobs.length,
      successRate: recentJobs.length > 0
        ? completed.length / recentJobs.length
        : 0,
      avgCompletionMs: avgTime,
      failedCount: failed.length,
    };
  },
});
```

## Summary Checklist

- [ ] Define a job table with discriminated union status in `schema.ts`
- [ ] Add indexes for all query patterns (by org, by type, by status)
- [ ] Start mutation: insert record + `scheduler.runAfter(0, ...)` + return ID
- [ ] Action: try/catch with `runMutation` to update status on success/failure
- [ ] Guard terminal states in the update mutation (don't overwrite completed/failed/canceled)
- [ ] Schedule a timeout mutation alongside the job
- [ ] Implement cancellation with `scheduler.cancel()` + status check
- [ ] Add retry logic with exponential backoff + jitter (or use `@convex-dev/workpool`)
- [ ] Client subscribes via `useQuery` for real-time updates
- [ ] Never use `.filter()` — always `.withIndex()`
