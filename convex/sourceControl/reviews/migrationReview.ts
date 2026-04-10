// @ts-nocheck
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * Migration-context code review — DB layer.
 *
 * Stores and manages review records in sourceControlReviews.
 * The action orchestration lives in migrationReviewActions.ts ("use node").
 */

// ---------------------------------------------------------------------------
// Create a pending review record
// ---------------------------------------------------------------------------

export const createReview = internalMutation({
  args: {
    orgId: v.string(),
    prId: v.id("sourceControlPullRequests"),
    taskId: v.optional(v.id("tasks")),
    requestedBy: v.string(),
    triggerMethod: v.union(
      v.literal("platform_button"),
      v.literal("github_comment"),
      v.literal("bulk_review"),
    ),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("sourceControlReviews", {
      orgId: args.orgId,
      prId: args.prId,
      taskId: args.taskId,
      requestedBy: args.requestedBy,
      triggerMethod: args.triggerMethod,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Update review to in_progress
// ---------------------------------------------------------------------------

export const markReviewInProgress = internalMutation({
  args: { reviewId: v.id("sourceControlReviews") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reviewId, { status: "in_progress" });
  },
});

// ---------------------------------------------------------------------------
// Complete a review with result
// ---------------------------------------------------------------------------

export const completeReview = internalMutation({
  args: {
    reviewId: v.id("sourceControlReviews"),
    result: v.any(),
    githubReviewId: v.optional(v.number()),
    tokenUsage: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reviewId, {
      status: "completed",
      result: args.result,
      githubReviewId: args.githubReviewId,
      tokenUsage: args.tokenUsage,
      completedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Fail a review
// ---------------------------------------------------------------------------

export const failReview = internalMutation({
  args: {
    reviewId: v.id("sourceControlReviews"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reviewId, {
      status: "failed",
      result: { error: args.error },
      completedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Get PR data for review validation
// ---------------------------------------------------------------------------

export const getPRForReview = internalQuery({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");

    const repo = await ctx.db.get(pr.repositoryId);
    if (!repo) throw new ConvexError("Repository not found");

    const program = await ctx.db.get(repo.programId);

    return { pr, repo, program };
  },
});
