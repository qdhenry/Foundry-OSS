// @ts-nocheck
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation, internalQuery, mutation, query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

/**
 * Branch strategy recommendation — queries, mutations, and context assembly.
 *
 * The AI action lives in strategyRecommendationActions.ts (Node.js runtime).
 *
 * Stores recommendations in sprintPlanningRecommendations with
 * recommendation.branchStrategy holding the BranchStrategyRecommendation.
 */

// ---------------------------------------------------------------------------
// getStrategyForSprint — public query to fetch the latest branch strategy
// ---------------------------------------------------------------------------

export const getStrategyForSprint = query({
  args: {
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new Error("Sprint not found");
    await assertOrgAccess(ctx, sprint.orgId);

    // Find the latest recommendation for this sprint that has a branch strategy
    const recommendations = await ctx.db
      .query("sprintPlanningRecommendations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .order("desc")
      .collect();

    // Check for in-progress generation first
    for (const rec of recommendations) {
      if (rec.status === "processing" && rec.recommendationType === "branch_strategy") {
        const data = rec.recommendation as Record<string, any> | null;
        return {
          _id: rec._id,
          sprintId: rec.sprintId,
          branchStrategy: data?.branchStrategy ?? null,
          status: "processing" as const,
          generationProgress: rec.generationProgress,
          createdAt: rec.createdAt,
          tokensUsed: rec.totalTokensUsed,
        };
      }
      if (rec.status === "error" && rec.recommendationType === "branch_strategy") {
        return {
          _id: rec._id,
          sprintId: rec.sprintId,
          branchStrategy: null,
          status: "error" as const,
          error: rec.error,
          createdAt: rec.createdAt,
          tokensUsed: rec.totalTokensUsed,
        };
      }
    }

    // Look for completed branch strategy recs (filter by recommendationType to
    // avoid false matches from sprint plan recs that lack branchStrategy)
    for (const rec of recommendations) {
      if (rec.recommendationType !== "branch_strategy") continue;
      const data = rec.recommendation as Record<string, any> | null;
      if (data?.branchStrategy) {
        return {
          _id: rec._id,
          sprintId: rec.sprintId,
          branchStrategy: data.branchStrategy,
          status: rec.status,
          createdAt: rec.createdAt,
          tokensUsed: rec.totalTokensUsed,
        };
      }
    }

    // Fallback: check any rec that has branchStrategy data (legacy records
    // may not have recommendationType set)
    for (const rec of recommendations) {
      const data = rec.recommendation as Record<string, any> | null;
      if (data?.branchStrategy) {
        return {
          _id: rec._id,
          sprintId: rec.sprintId,
          branchStrategy: data.branchStrategy,
          status: rec.status,
          createdAt: rec.createdAt,
          tokensUsed: rec.totalTokensUsed,
        };
      }
    }

    return null;
  },
});

// ---------------------------------------------------------------------------
// requestStrategy — public mutation to trigger branch strategy generation
// ---------------------------------------------------------------------------

export const requestStrategy = mutation({
  args: {
    programId: v.id("programs"),
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new Error("Sprint not found");
    if (sprint.programId !== args.programId) {
      throw new Error("Sprint does not belong to this program");
    }

    const existingRecs = await ctx.db
      .query("sprintPlanningRecommendations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();
    const alreadyProcessing = existingRecs.some(
      (r) => r.status === "processing" && r.recommendationType === "branch_strategy",
    );
    if (alreadyProcessing) {
      throw new Error("A branch strategy is already being generated");
    }

    const placeholderId = await ctx.db.insert("sprintPlanningRecommendations", {
      orgId: program.orgId,
      sprintId: args.sprintId,
      programId: args.programId,
      status: "processing",
      recommendationType: "branch_strategy",
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.sourceControl.branching.strategyRecommendationActions.generateBranchStrategy,
      { programId: args.programId, sprintId: args.sprintId, placeholderId },
    );

    return { scheduled: true };
  },
});

// ---------------------------------------------------------------------------
// acknowledgeDeviation — mark a branch deviation as acknowledged by developer
// ---------------------------------------------------------------------------

export const acknowledgeDeviation = mutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new Error("PR not found");
    await assertOrgAccess(ctx, pr.orgId);

    // Store acknowledgment on the PR record via a patch
    // We use a lightweight approach: store acknowledged deviation flag
    // Since the schema doesn't have a dedicated field, we track this in
    // a separate lightweight approach — check if linkMethod or similar
    // can carry this. For now, we'll note it and the UI reads from the
    // deviation query which checks this mutation's effect.
    // The simplest approach: store it in the PR's body or as a separate record.
    // Actually, since we don't want to modify schema, we'll track acknowledged
    // deviations in the sprintPlanningRecommendations record itself.

    // Find the task and its sprint
    if (!pr.taskId) throw new Error("PR not linked to a task");
    const task = await ctx.db.get(pr.taskId);
    if (!task?.sprintId) throw new Error("Task has no sprint");

    const recommendations = await ctx.db
      .query("sprintPlanningRecommendations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", task.sprintId!))
      .order("desc")
      .collect();

    for (const rec of recommendations) {
      const data = rec.recommendation as Record<string, any> | null;
      if (data?.branchStrategy) {
        // Add this PR to the acknowledged deviations list
        const acknowledged: string[] = data.acknowledgedDeviations ?? [];
        if (!acknowledged.includes(args.prId)) {
          acknowledged.push(args.prId);
          await ctx.db.patch(rec._id, {
            recommendation: {
              ...data,
              acknowledgedDeviations: acknowledged,
            },
          });
        }
        return { acknowledged: true };
      }
    }

    return { acknowledged: false };
  },
});

// ---------------------------------------------------------------------------
// getStrategyContext — internal query to assemble AI context for strategy
// ---------------------------------------------------------------------------

export const getStrategyContext = internalQuery({
  args: {
    programId: v.id("programs"),
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) return null;

    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) return null;

    // 1. Workstreams and their dependencies
    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const dependencies = await ctx.db
      .query("workstreamDependencies")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // 2. Tasks for this sprint with decompositions
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();

    const taskDecompositions = [];
    for (const task of tasks) {
      if (!task.requirementId) continue;
      const decomp = await ctx.db
        .query("taskDecompositions")
        .withIndex("by_requirement", (q) => q.eq("requirementId", task.requirementId!))
        .order("desc")
        .first();
      if (decomp && decomp.status === "accepted") {
        taskDecompositions.push({
          taskId: task._id,
          taskTitle: task.title,
          workstreamId: task.workstreamId,
          decomposition: decomp.decomposition,
        });
      }
    }

    // 3. Team assignments
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // 4. Connected repositories
    const repos = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // 5. Other sprints that overlap this sprint's timeline
    const allSprints = await ctx.db
      .query("sprints")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const overlappingSprints = allSprints.filter((s) => {
      if (s._id === args.sprintId) return false;
      if (s.status === "cancelled" || s.status === "completed") return false;
      if (!sprint.startDate || !sprint.endDate) return false;
      if (!s.startDate || !s.endDate) return false;
      return s.startDate < sprint.endDate && s.endDate > sprint.startDate;
    });

    return {
      program,
      sprint,
      workstreams,
      dependencies,
      tasks,
      taskDecompositions,
      teamMembers,
      repos,
      overlappingSprints,
    };
  },
});

// ---------------------------------------------------------------------------
// storeRecommendation — internal mutation to save AI-generated strategy
// ---------------------------------------------------------------------------

export const storeRecommendation = internalMutation({
  args: {
    orgId: v.string(),
    sprintId: v.id("sprints"),
    programId: v.id("programs"),
    branchStrategy: v.any(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sprintPlanningRecommendations", {
      orgId: args.orgId,
      sprintId: args.sprintId,
      programId: args.programId,
      recommendation: {
        branchStrategy: args.branchStrategy,
        acknowledgedDeviations: [],
      },
      status: "pending",
      createdAt: Date.now(),
      totalTokensUsed: args.totalTokensUsed,
    });
  },
});

// ---------------------------------------------------------------------------
// appendRecommendedBranch — streaming: append one branch to partial strategy
// ---------------------------------------------------------------------------

export const appendRecommendedBranch = internalMutation({
  args: {
    placeholderId: v.id("sprintPlanningRecommendations"),
    branch: v.any(),
    branchIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.placeholderId);
    if (!record) return;
    const existing = (record.recommendation as any) ?? {};
    const strategy = existing.branchStrategy ?? {};
    const branches = strategy.recommended_branches ?? [];
    branches.push(args.branch);
    await ctx.db.patch(args.placeholderId, {
      recommendation: {
        ...existing,
        branchStrategy: { ...strategy, recommended_branches: branches },
        acknowledgedDeviations: existing.acknowledgedDeviations ?? [],
      },
      generationProgress: `Generated ${branches.length} branch${branches.length !== 1 ? "es" : ""}...`,
    });
  },
});

// ---------------------------------------------------------------------------
// updateStrategyProgress — streaming: update progress text
// ---------------------------------------------------------------------------

export const updateStrategyProgress = internalMutation({
  args: {
    placeholderId: v.id("sprintPlanningRecommendations"),
    progress: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, { generationProgress: args.progress });
  },
});

// ---------------------------------------------------------------------------
// finalizeStrategy — streaming: finalize the strategy when complete
// ---------------------------------------------------------------------------

export const finalizeStrategy = internalMutation({
  args: {
    placeholderId: v.id("sprintPlanningRecommendations"),
    branchStrategy: v.any(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeholderId, {
      recommendation: {
        branchStrategy: args.branchStrategy,
        acknowledgedDeviations: [],
      },
      status: "pending",
      totalTokensUsed: args.totalTokensUsed,
      generationProgress: undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// markStrategyError — streaming: mark generation as failed
// ---------------------------------------------------------------------------

export const markStrategyError = internalMutation({
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
// getRecommendationForDeviation — internal query for deviation detection
// ---------------------------------------------------------------------------

export const getRecommendationForDeviation = internalQuery({
  args: {
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    const recommendations = await ctx.db
      .query("sprintPlanningRecommendations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .order("desc")
      .collect();

    for (const rec of recommendations) {
      const data = rec.recommendation as Record<string, any> | null;
      if (data?.branchStrategy) {
        return {
          branchStrategy: data.branchStrategy,
          acknowledgedDeviations: data.acknowledgedDeviations ?? [],
        };
      }
    }

    return null;
  },
});
