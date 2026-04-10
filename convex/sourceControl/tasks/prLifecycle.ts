// @ts-nocheck
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

/**
 * PR lifecycle queries — hero card, stacked PRs, activity feed.
 *
 * All queries use assertOrgAccess for row-level security and
 * withIndex (never .filter()) per CLAUDE.md rules.
 */

// ---------------------------------------------------------------------------
// getActiveHeroPR — returns the current active (open/draft) PR for a task
// ---------------------------------------------------------------------------

export const getActiveHeroPR = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    await assertOrgAccess(ctx, task.orgId);

    const prs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    // Find the most recent open or draft PR
    const activePRs = prs
      .filter((pr) => pr.state === "open")
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (activePRs.length === 0) return null;

    const pr = activePRs[0];

    // Fetch associated reviews
    const reviews = await ctx.db
      .query("sourceControlReviews")
      .withIndex("by_pr", (q) => q.eq("prId", pr._id))
      .collect();

    // Fetch parent PR if stacked
    const parentPR = pr.parentPrId ? await ctx.db.get(pr.parentPrId) : null;

    // Fetch commits linked to this PR
    const commits = await ctx.db
      .query("sourceControlCommits")
      .withIndex("by_pr", (q) => q.eq("prId", pr._id))
      .collect();

    // Sort commits newest-first
    commits.sort((a, b) => b.committedAt - a.committedAt);

    return { ...pr, reviews, parentPR, commits };
  },
});

// ---------------------------------------------------------------------------
// getStackedPRs — returns ALL PRs for a task ordered by stackOrder
// ---------------------------------------------------------------------------

export const getStackedPRs = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return [];
    await assertOrgAccess(ctx, task.orgId);

    const prs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    // Sort by stackOrder ascending (undefined stackOrder goes last)
    prs.sort((a, b) => {
      const aOrder = a.stackOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.stackOrder ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });

    // Attach child count for each PR (PRs that depend on this one)
    return await Promise.all(
      prs.map(async (pr) => {
        const children = await ctx.db
          .query("sourceControlPullRequests")
          .withIndex("by_parent_pr", (q) => q.eq("parentPrId", pr._id))
          .collect();
        return { ...pr, childPrCount: children.length };
      }),
    );
  },
});

// ---------------------------------------------------------------------------
// getActivityFeed — returns chronological PR/task activity events
// ---------------------------------------------------------------------------

export const getActivityFeed = query({
  args: {
    taskId: v.id("tasks"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return [];
    await assertOrgAccess(ctx, task.orgId);

    const pageSize = args.limit ?? 50;

    const events = await ctx.db
      .query("sourceControlActivityEvents")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .take(pageSize);

    return events;
  },
});
