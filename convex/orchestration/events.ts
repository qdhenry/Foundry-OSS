import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { logAuditEvent } from "../model/audit";
import { orchestrationEventTypeValidator } from "./schema";

// ── Queries ──────────────────────────────────────────────────────────────────

export const listByRun = query({
  args: { runId: v.id("orchestrationRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);

    return await ctx.db
      .query("orchestrationEvents")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(100);
  },
});

// ── Internal Mutations ───────────────────────────────────────────────────────

export const createInternal = internalMutation({
  args: {
    orgId: v.string(),
    runId: v.id("orchestrationRuns"),
    type: orchestrationEventTypeValidator,
    agentId: v.optional(v.id("programAgents")),
    taskId: v.optional(v.id("tasks")),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("orchestrationEvents", {
      orgId: args.orgId,
      runId: args.runId,
      type: args.type,
      agentId: args.agentId,
      taskId: args.taskId,
      message: args.message,
      metadata: args.metadata,
    });
  },
});

// ── Public Mutations ─────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    runId: v.id("orchestrationRuns"),
    type: orchestrationEventTypeValidator,
    agentId: v.optional(v.id("programAgents")),
    taskId: v.optional(v.id("tasks")),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Orchestration run not found");
    await assertOrgAccess(ctx, run.orgId);

    await ctx.db.insert("orchestrationEvents", {
      orgId: run.orgId,
      runId: args.runId,
      type: args.type,
      agentId: args.agentId,
      taskId: args.taskId,
      message: args.message,
      metadata: args.metadata,
    });

    await logAuditEvent(ctx, {
      orgId: run.orgId,
      programId: run.programId as string,
      entityType: "orchestrationEvent",
      entityId: args.runId as string,
      action: "create",
      description: `Logged orchestration event "${args.type}": ${args.message}`,
    });
  },
});
