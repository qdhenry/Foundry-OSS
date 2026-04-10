// @ts-nocheck
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * Internal queries and mutations for pattern mining — used by patternMiningActions.ts.
 */

// ---------------------------------------------------------------------------
// getProgramContext
// ---------------------------------------------------------------------------

export const getProgramContext = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.programId);
  },
});

// ---------------------------------------------------------------------------
// getReposForProgram
// ---------------------------------------------------------------------------

export const getReposForProgram = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// getCompletedRequirements
// ---------------------------------------------------------------------------

export const getCompletedRequirements = internalQuery({
  args: {
    programId: v.id("programs"),
    sprintId: v.optional(v.id("sprints")),
  },
  handler: async (ctx, args) => {
    if (args.sprintId) {
      // Get tasks in this sprint, then their requirements
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId!))
        .collect();

      const reqIds = new Set<string>();
      const reqs = [];
      for (const task of tasks) {
        if (task.requirementId && !reqIds.has(task.requirementId)) {
          reqIds.add(task.requirementId);
          const req = await ctx.db.get(task.requirementId as Id<"requirements">);
          if (req && req.status === "complete") {
            reqs.push(req);
          }
        }
      }
      return reqs;
    }

    // All completed requirements for the program
    const allReqs = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    return allReqs.filter((r) => r.status === "complete");
  },
});

// ---------------------------------------------------------------------------
// getMergedPRsForRequirement
// ---------------------------------------------------------------------------

export const getMergedPRsForRequirement = internalQuery({
  args: {
    requirementId: v.id("requirements"),
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    // Get tasks for this requirement
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const reqTasks = tasks.filter((t) => t.requirementId === args.requirementId);

    // Get merged PRs for these tasks
    const mergedPRs = [];
    for (const task of reqTasks) {
      const prs = await ctx.db
        .query("sourceControlPullRequests")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();
      for (const pr of prs) {
        if (pr.state === "merged") {
          mergedPRs.push(pr);
        }
      }
    }

    return mergedPRs;
  },
});

// ---------------------------------------------------------------------------
// insertSnippet — store anonymized snippet in codeSnippets table
// ---------------------------------------------------------------------------

export const insertSnippet = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    title: v.string(),
    description: v.string(),
    code: v.string(),
    annotations: v.optional(v.string()),
    requirementCategory: v.string(),
    targetPlatform: v.union(
      v.literal("salesforce_b2b"),
      v.literal("bigcommerce_b2b"),
      v.literal("sitecore"),
      v.literal("wordpress"),
      v.literal("none"),
      v.literal("platform_agnostic"),
    ),
    language: v.string(),
    successRating: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    complexity: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("codeSnippets", {
      orgId: args.orgId,
      programId: args.programId,
      title: args.title,
      description: args.description,
      code: args.code,
      annotations: args.annotations,
      requirementCategory: args.requirementCategory,
      targetPlatform: args.targetPlatform,
      language: args.language,
      successRating: args.successRating,
      complexity: args.complexity,
      upvotes: 0,
      flagCount: 0,
      createdAt: Date.now(),
    });
  },
});
