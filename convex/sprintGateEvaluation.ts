import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// 1. storeEvaluation — internalMutation
// ---------------------------------------------------------------------------
export const storeEvaluation = internalMutation({
  args: {
    orgId: v.string(),
    sprintId: v.id("sprints"),
    programId: v.id("programs"),
    evaluation: v.any(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sprintGateEvaluations", {
      orgId: args.orgId,
      sprintId: args.sprintId,
      programId: args.programId,
      evaluation: args.evaluation,
      status: "completed",
      createdAt: Date.now(),
      totalTokensUsed: args.totalTokensUsed,
    });
  },
});

// ---------------------------------------------------------------------------
// 2. getLatestEvaluation — query (reactive)
// ---------------------------------------------------------------------------
export const getLatestEvaluation = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    const evaluations = await ctx.db
      .query("sprintGateEvaluations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();

    return evaluations.length > 0 ? evaluations[evaluations.length - 1] : null;
  },
});

// ---------------------------------------------------------------------------
// 3. requestGateEvaluation — public mutation (trigger)
// ---------------------------------------------------------------------------
export const requestGateEvaluation = mutation({
  args: {
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    await logAuditEvent(ctx, {
      orgId: sprint.orgId,
      programId: sprint.programId as string,
      entityType: "sprint",
      entityId: args.sprintId as string,
      action: "create",
      description: `Requested AI gate evaluation for sprint "${sprint.name}"`,
    });

    await ctx.scheduler.runAfter(0, internalApi.sprintGateEvaluationActions.evaluateSprintGate, {
      orgId: sprint.orgId,
      sprintId: args.sprintId,
      programId: sprint.programId,
    });
  },
});
