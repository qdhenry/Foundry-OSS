import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// 1. storeRecommendation — internalMutation
// ---------------------------------------------------------------------------
export const storeRecommendation = internalMutation({
  args: {
    orgId: v.string(),
    sprintId: v.id("sprints"),
    programId: v.id("programs"),
    recommendation: v.any(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sprintPlanningRecommendations", {
      orgId: args.orgId,
      sprintId: args.sprintId,
      programId: args.programId,
      recommendation: args.recommendation,
      status: "pending",
      createdAt: Date.now(),
      totalTokensUsed: args.totalTokensUsed,
    });
  },
});

// ---------------------------------------------------------------------------
// 2. appendRecommendedTask — internalMutation (streaming)
// ---------------------------------------------------------------------------
export const appendRecommendedTask = internalMutation({
  args: {
    placeholderId: v.id("sprintPlanningRecommendations"),
    task: v.any(),
    taskIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.placeholderId);
    if (!record) return;
    const existing = (record.recommendation as any) ?? {};
    const tasks = existing.recommended_existing_tasks ?? [];
    tasks.push(args.task);
    await ctx.db.patch(args.placeholderId, {
      recommendation: { ...existing, recommended_existing_tasks: tasks },
      generationProgress: `Generated ${tasks.length} recommended task${tasks.length !== 1 ? "s" : ""}...`,
    });
  },
});

// ---------------------------------------------------------------------------
// 3. updateRecommendationProgress — internalMutation (streaming)
// ---------------------------------------------------------------------------
export const updateRecommendationProgress = internalMutation({
  args: {
    placeholderId: v.id("sprintPlanningRecommendations"),
    progress: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, { generationProgress: args.progress });
  },
});

// ---------------------------------------------------------------------------
// 4. finalizeRecommendation — internalMutation (streaming)
// ---------------------------------------------------------------------------
export const finalizeRecommendation = internalMutation({
  args: {
    placeholderId: v.id("sprintPlanningRecommendations"),
    recommendation: v.any(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, {
      recommendation: args.recommendation,
      status: "pending",
      totalTokensUsed: args.totalTokensUsed,
      generationProgress: undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// 5. markRecommendationError — internalMutation (streaming)
// ---------------------------------------------------------------------------
export const markRecommendationError = internalMutation({
  args: {
    placeholderId: v.id("sprintPlanningRecommendations"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, {
      status: "error",
      error: args.error,
    });
  },
});

// ---------------------------------------------------------------------------
// 6. getRecommendation — query (reactive)
// ---------------------------------------------------------------------------
export const getRecommendation = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    const recommendations = await ctx.db
      .query("sprintPlanningRecommendations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();

    return recommendations.length > 0 ? recommendations[recommendations.length - 1] : null;
  },
});

// ---------------------------------------------------------------------------
// 3. requestSprintPlan — public mutation (trigger)
// ---------------------------------------------------------------------------
export const requestSprintPlan = mutation({
  args: {
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    const existingProcessing = await ctx.db
      .query("sprintPlanningRecommendations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();
    const alreadyProcessing = existingProcessing.some(
      (r) => r.status === "processing" && r.recommendationType === "sprint_plan",
    );
    if (alreadyProcessing) {
      throw new ConvexError("A sprint plan is already being generated");
    }

    const placeholderId = await ctx.db.insert("sprintPlanningRecommendations", {
      orgId: sprint.orgId,
      sprintId: args.sprintId,
      programId: sprint.programId,
      status: "processing",
      recommendationType: "sprint_plan",
      createdAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      orgId: sprint.orgId,
      programId: sprint.programId as string,
      entityType: "sprint",
      entityId: args.sprintId as string,
      action: "create",
      description: `Requested AI sprint plan for "${sprint.name}"`,
    });

    await ctx.scheduler.runAfter(0, internalApi.sprintPlanningActions.suggestSprintComposition, {
      orgId: sprint.orgId,
      sprintId: args.sprintId,
      programId: sprint.programId,
      placeholderId,
    });
  },
});
