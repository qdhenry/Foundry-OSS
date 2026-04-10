import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { logAuditEvent } from "../model/audit";
import {
  orchestrationBranchStrategyValidator,
  orchestrationRunStatusValidator,
  orchestrationScopeTypeValidator,
} from "./schema";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["previewing"],
  previewing: ["running", "cancelled"],
  running: ["paused", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled"],
};

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"];

async function getRunOrThrow(ctx: MutationCtx, runId: Id<"orchestrationRuns">) {
  const run = await ctx.db.get(runId);
  if (!run) throw new ConvexError("Orchestration run not found");
  return run;
}

function assertValidTransition(currentStatus: string, newStatus: string) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed?.includes(newStatus)) {
    throw new ConvexError(`Invalid status transition from "${currentStatus}" to "${newStatus}"`);
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Retrieve a single orchestration run by ID. */
export const get = query({
  args: { runId: v.id("orchestrationRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);
    return run;
  },
});

/** List orchestration runs for a program, newest first (max 50). */
export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("orchestrationRuns")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .take(50);
  },
});

/** List currently active (running or paused) orchestration runs for a program. */
export const listActive = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const runs = await ctx.db
      .query("orchestrationRuns")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return runs.filter((r) => r.status === "running" || r.status === "paused");
  },
});

export const getResumableRun = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const runs = await ctx.db
      .query("orchestrationRuns")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .take(50);

    const cutoff = Date.now() - 86400000; // 24 hours ago
    const resumable = runs.find(
      (r) => (r.status === "draft" || r.status === "previewing") && r._creationTime >= cutoff,
    );

    return resumable ?? null;
  },
});

// ── Internal Queries ────────────────────────────────────────────────────────

export const getInternal = internalQuery({
  args: { runId: v.id("orchestrationRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

// ── Public Mutations ─────────────────────────────────────────────────────────

/**
 * Create a new orchestration run with scope, repository, and branch configuration.
 * @param orgId - Organization ID
 * @param programId - Target program
 * @param name - Run display name
 * @param scopeType - Scope (sprint, workstream, or custom task selection)
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    scopeType: orchestrationScopeTypeValidator,
    sprintId: v.optional(v.id("sprints")),
    workstreamId: v.optional(v.id("workstreams")),
    taskIds: v.optional(v.array(v.id("tasks"))),
    repositoryIds: v.array(v.id("sourceControlRepositories")),
    branchStrategy: orchestrationBranchStrategyValidator,
    branchPattern: v.optional(v.string()),
    targetBranch: v.string(),
    maxConcurrency: v.number(),
    tokenBudget: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await assertOrgAccess(ctx, args.orgId);

    const runId = await ctx.db.insert("orchestrationRuns", {
      orgId: args.orgId,
      programId: args.programId,
      name: args.name,
      scopeType: args.scopeType,
      sprintId: args.sprintId,
      workstreamId: args.workstreamId,
      taskIds: args.taskIds,
      repositoryIds: args.repositoryIds,
      branchStrategy: args.branchStrategy,
      branchPattern: args.branchPattern,
      targetBranch: args.targetBranch,
      maxConcurrency: args.maxConcurrency,
      tokenBudget: args.tokenBudget,
      tokensUsed: 0,
      totalCost: 0,
      status: "draft",
      startedBy: user._id,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "orchestrationRun",
      entityId: runId as string,
      action: "create",
      description: `Created orchestration run "${args.name}"`,
    });

    return runId;
  },
});

export const updateExecutionPlan = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    executionPlan: v.any(),
  },
  handler: async (ctx, args) => {
    const run = await getRunOrThrow(ctx, args.runId);
    await assertOrgAccess(ctx, run.orgId);

    if (run.status !== "draft") {
      throw new ConvexError(`Cannot update execution plan when run is in "${run.status}" status`);
    }

    await ctx.db.patch(args.runId, {
      executionPlan: args.executionPlan,
      status: "previewing",
    });

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationRun",
      entityId: args.runId as string,
      action: "update",
      description: `Updated execution plan for run "${run.name}", status set to previewing`,
    });
  },
});

/**
 * Transition an orchestration run to a new status with state machine validation.
 * @param runId - The run to update
 * @param status - Target status
 */
export const updateStatus = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    status: orchestrationRunStatusValidator,
  },
  handler: async (ctx, args) => {
    const run = await getRunOrThrow(ctx, args.runId);
    await assertOrgAccess(ctx, run.orgId);

    assertValidTransition(run.status, args.status);

    const update: Record<string, unknown> = { status: args.status };
    if (TERMINAL_STATUSES.includes(args.status)) {
      update.completedAt = Date.now();
    }
    if (args.status === "running" && !run.startedAt) {
      update.startedAt = Date.now();
    }

    await ctx.db.patch(args.runId, update);

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationRun",
      entityId: args.runId as string,
      action: "status_change",
      description: `Changed orchestration run "${run.name}" status from "${run.status}" to "${args.status}"`,
    });
  },
});

export const updateUsage = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    tokensUsed: v.number(),
    totalCost: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await getRunOrThrow(ctx, args.runId);
    await assertOrgAccess(ctx, run.orgId);

    await ctx.db.patch(args.runId, {
      tokensUsed: args.tokensUsed,
      totalCost: args.totalCost,
    });
  },
});

// ── Internal Mutations (for Convex Workflow) ─────────────────────────────────

export const updateStatusInternal = internalMutation({
  args: {
    runId: v.id("orchestrationRuns"),
    status: orchestrationRunStatusValidator,
  },
  handler: async (ctx, args) => {
    const run = await getRunOrThrow(ctx, args.runId);

    assertValidTransition(run.status, args.status);

    const update: Record<string, unknown> = { status: args.status };
    if (TERMINAL_STATUSES.includes(args.status)) {
      update.completedAt = Date.now();
    }
    if (args.status === "running" && !run.startedAt) {
      update.startedAt = Date.now();
    }

    await ctx.db.patch(args.runId, update);
  },
});

export const updateUsageInternal = internalMutation({
  args: {
    runId: v.id("orchestrationRuns"),
    tokensUsed: v.number(),
    totalCost: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      tokensUsed: args.tokensUsed,
      totalCost: args.totalCost,
    });
  },
});

/**
 * Atomic increment for usage updates. Takes delta values instead of absolute
 * values, eliminating the read-then-write race condition when multiple tasks
 * complete concurrently within the same wave.
 */
export const incrementUsageInternal = internalMutation({
  args: {
    runId: v.id("orchestrationRuns"),
    tokensDelta: v.number(),
    costDelta: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");

    await ctx.db.patch(args.runId, {
      tokensUsed: (run.tokensUsed ?? 0) + args.tokensDelta,
      totalCost: (run.totalCost ?? 0) + args.costDelta,
    });
  },
});

export const setReport = internalMutation({
  args: {
    runId: v.id("orchestrationRuns"),
    report: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, { report: args.report });
  },
});

export const setWorkflowId = internalMutation({
  args: {
    runId: v.id("orchestrationRuns"),
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, { workflowId: args.workflowId });
  },
});
