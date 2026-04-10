// @ts-nocheck
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";
import type { BranchStrategyRecommendation } from "../types";

/**
 * Branch deviation detection.
 *
 * When a PR is linked to a task, checks if the PR's target branch matches
 * the recommended branch for that task. Mismatches produce persistent
 * warning badges until acknowledged by the developer.
 */

// ---------------------------------------------------------------------------
// checkBranchDeviation — detect if a PR targets the wrong branch
// ---------------------------------------------------------------------------

export const checkBranchDeviation = query({
  args: {
    prId: v.id("sourceControlPullRequests"),
  },
  handler: async (ctx, args) => {
    // 1. Load PR
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new Error("PR not found");
    await assertOrgAccess(ctx, pr.orgId);

    // If PR isn't linked to a task, no deviation to check
    if (!pr.taskId) {
      return {
        hasDeviation: false,
        prTargetBranch: pr.targetBranch,
        recommendedBranch: null,
        acknowledged: false,
        taskId: null,
      };
    }

    // 2. Load the task to find its sprint and workstream
    const task = await ctx.db.get(pr.taskId);
    if (!task?.sprintId) {
      return {
        hasDeviation: false,
        prTargetBranch: pr.targetBranch,
        recommendedBranch: null,
        acknowledged: false,
        taskId: pr.taskId,
      };
    }

    // 3. Find the latest branch strategy recommendation for this sprint
    const recommendations = await ctx.db
      .query("sprintPlanningRecommendations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", task.sprintId!))
      .order("desc")
      .collect();

    let strategy: BranchStrategyRecommendation | null = null;
    let acknowledgedDeviations: string[] = [];

    for (const rec of recommendations) {
      const data = rec.recommendation as Record<string, any> | null;
      if (data?.branchStrategy) {
        strategy = data.branchStrategy as BranchStrategyRecommendation;
        acknowledgedDeviations = data.acknowledgedDeviations ?? [];
        break;
      }
    }

    // No strategy recommendation exists — no deviation to report
    if (!strategy) {
      return {
        hasDeviation: false,
        prTargetBranch: pr.targetBranch,
        recommendedBranch: null,
        acknowledged: false,
        taskId: pr.taskId,
      };
    }

    // 4. Find the recommended branch for this task
    const recommendedBranch = findRecommendedBranch(strategy, pr.taskId, task.workstreamId ?? null);

    // No specific branch recommended for this task
    if (!recommendedBranch) {
      return {
        hasDeviation: false,
        prTargetBranch: pr.targetBranch,
        recommendedBranch: null,
        acknowledged: false,
        taskId: pr.taskId,
      };
    }

    // 5. Compare PR target branch vs recommended branch
    const hasDeviation = pr.targetBranch.toLowerCase() !== recommendedBranch.toLowerCase();
    const acknowledged = acknowledgedDeviations.includes(args.prId);

    return {
      hasDeviation,
      prTargetBranch: pr.targetBranch,
      recommendedBranch,
      acknowledged,
      taskId: pr.taskId,
    };
  },
});

// ---------------------------------------------------------------------------
// checkDeviationsForTask — check all PRs linked to a task for deviations
// ---------------------------------------------------------------------------

export const checkDeviationsForTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    // Get all PRs linked to this task
    const prs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    if (prs.length === 0 || !task.sprintId) {
      return { deviations: [], hasAnyDeviation: false };
    }

    // Load strategy recommendation
    const recommendations = await ctx.db
      .query("sprintPlanningRecommendations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", task.sprintId!))
      .order("desc")
      .collect();

    let strategy: BranchStrategyRecommendation | null = null;
    let acknowledgedDeviations: string[] = [];

    for (const rec of recommendations) {
      const data = rec.recommendation as Record<string, any> | null;
      if (data?.branchStrategy) {
        strategy = data.branchStrategy as BranchStrategyRecommendation;
        acknowledgedDeviations = data.acknowledgedDeviations ?? [];
        break;
      }
    }

    if (!strategy) {
      return { deviations: [], hasAnyDeviation: false };
    }

    const recommendedBranch = findRecommendedBranch(
      strategy,
      args.taskId,
      task.workstreamId ?? null,
    );

    const deviations = prs
      .filter((pr) => pr.state === "open") // Only check open PRs
      .map((pr) => {
        const hasDeviation = recommendedBranch
          ? pr.targetBranch.toLowerCase() !== recommendedBranch.toLowerCase()
          : false;
        return {
          prId: pr._id,
          prNumber: pr.prNumber,
          prTargetBranch: pr.targetBranch,
          recommendedBranch,
          hasDeviation,
          acknowledged: acknowledgedDeviations.includes(pr._id),
        };
      })
      .filter((d) => d.hasDeviation);

    return {
      deviations,
      hasAnyDeviation: deviations.some((d) => !d.acknowledged),
    };
  },
});

// ---------------------------------------------------------------------------
// getDeviationNoteForReview — get deviation note string for code reviews
// ---------------------------------------------------------------------------

export const getDeviationNoteForReview = query({
  args: {
    prId: v.id("sourceControlPullRequests"),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr?.taskId) return null;

    const task = await ctx.db.get(pr.taskId);
    if (!task?.sprintId) return null;

    const recommendations = await ctx.db
      .query("sprintPlanningRecommendations")
      .withIndex("by_sprint", (q) => q.eq("sprintId", task.sprintId!))
      .order("desc")
      .collect();

    let strategy: BranchStrategyRecommendation | null = null;

    for (const rec of recommendations) {
      const data = rec.recommendation as Record<string, any> | null;
      if (data?.branchStrategy) {
        strategy = data.branchStrategy as BranchStrategyRecommendation;
        break;
      }
    }

    if (!strategy) return null;

    const recommendedBranch = findRecommendedBranch(strategy, pr.taskId, task.workstreamId ?? null);

    if (!recommendedBranch) return null;

    const hasDeviation = pr.targetBranch.toLowerCase() !== recommendedBranch.toLowerCase();

    if (!hasDeviation) return null;

    return `Branch deviation detected: PR targets \`${pr.targetBranch}\`, but the recommended branch for this task is \`${recommendedBranch}\`. This may increase merge conflict risk with other workstreams.`;
  },
});

// ---------------------------------------------------------------------------
// Helper: find the recommended branch for a task ID or workstream
// ---------------------------------------------------------------------------

function findRecommendedBranch(
  strategy: BranchStrategyRecommendation,
  taskId: string,
  workstreamId: string | null,
): string | null {
  // First try to match by task ID
  for (const branch of strategy.recommended_branches) {
    if (branch.tasks?.includes(taskId)) {
      return branch.branch_name;
    }
  }

  // Fall back to matching by workstream
  if (workstreamId) {
    for (const branch of strategy.recommended_branches) {
      if (branch.workstreams?.includes(workstreamId)) {
        return branch.branch_name;
      }
    }
  }

  // No match found — check if there's a default integration branch
  for (const branch of strategy.recommended_branches) {
    if (
      branch.purpose?.toLowerCase().includes("integration") ||
      branch.purpose?.toLowerCase().includes("default")
    ) {
      return branch.branch_name;
    }
  }

  return null;
}
