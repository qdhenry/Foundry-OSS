// @ts-nocheck
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * Daily reconciliation mutations/queries.
 *
 * The daily cron action lives in reconciliationActions.ts (Node.js runtime).
 * It compares platform state with GitHub API state and auto-corrects drift.
 */

// ---------------------------------------------------------------------------
// getActiveRepositories — all active repos for reconciliation
// ---------------------------------------------------------------------------

export const getActiveRepositories = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sourceControlRepositories").collect();
  },
});

// ---------------------------------------------------------------------------
// getSyncState — get or create sync state for a repo
// ---------------------------------------------------------------------------

export const getSyncState = internalQuery({
  args: { repositoryId: v.id("sourceControlRepositories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlSyncState")
      .withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId))
      .unique();
  },
});

// ---------------------------------------------------------------------------
// updateReconciliationResult — record reconciliation completion
// ---------------------------------------------------------------------------

export const updateReconciliationResult = internalMutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    orgId: v.string(),
    correctionsCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sourceControlSyncState")
      .withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastReconciliationAt: Date.now(),
        reconciliationCorrections: args.correctionsCount,
        status: "healthy",
      });
    } else {
      await ctx.db.insert("sourceControlSyncState", {
        orgId: args.orgId,
        repositoryId: args.repositoryId,
        lastReconciliationAt: Date.now(),
        reconciliationCorrections: args.correctionsCount,
        status: "healthy",
      });
    }
  },
});

// ---------------------------------------------------------------------------
// getRepoInstallation — get installation details for a repo
// ---------------------------------------------------------------------------

export const getRepoInstallation = internalQuery({
  args: { installationId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();
  },
});

// ---------------------------------------------------------------------------
// getPRsByRepo — get open PRs for a repository
// ---------------------------------------------------------------------------

export const getPRsByRepo = internalQuery({
  args: { repositoryId: v.id("sourceControlRepositories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId).eq("state", "open"))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// upsertPRFromReconciliation — create or update a PR record during reconciliation
// ---------------------------------------------------------------------------

export const upsertPRFromReconciliation = internalMutation({
  args: {
    orgId: v.string(),
    repositoryId: v.id("sourceControlRepositories"),
    prNumber: v.number(),
    title: v.string(),
    body: v.optional(v.string()),
    state: v.union(v.literal("open"), v.literal("closed"), v.literal("merged")),
    isDraft: v.boolean(),
    authorLogin: v.string(),
    sourceBranch: v.string(),
    targetBranch: v.string(),
    reviewState: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("changes_requested"),
    ),
    ciStatus: v.union(
      v.literal("none"),
      v.literal("passing"),
      v.literal("failing"),
      v.literal("pending"),
    ),
    commitCount: v.number(),
    filesChanged: v.number(),
    additions: v.number(),
    deletions: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    mergedAt: v.optional(v.number()),
    providerUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if PR already exists
    const existing = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId).eq("state", args.state))
      .filter((q) => q.eq(q.field("prNumber"), args.prNumber))
      .first();

    if (existing) {
      // Update existing PR with latest state
      await ctx.db.patch(existing._id, {
        title: args.title,
        body: args.body,
        state: args.state,
        isDraft: args.isDraft,
        reviewState: args.reviewState,
        ciStatus: args.ciStatus,
        commitCount: args.commitCount,
        filesChanged: args.filesChanged,
        additions: args.additions,
        deletions: args.deletions,
        updatedAt: args.updatedAt,
        mergedAt: args.mergedAt,
      });
      return { created: false, id: existing._id };
    }

    // Also check across other states (PR may have changed state)
    const existingAnyState = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) =>
        q.and(
          q.eq(q.field("repositoryId"), args.repositoryId),
          q.eq(q.field("prNumber"), args.prNumber),
        ),
      )
      .first();

    if (existingAnyState) {
      await ctx.db.patch(existingAnyState._id, {
        title: args.title,
        body: args.body,
        state: args.state,
        isDraft: args.isDraft,
        reviewState: args.reviewState,
        ciStatus: args.ciStatus,
        commitCount: args.commitCount,
        filesChanged: args.filesChanged,
        additions: args.additions,
        deletions: args.deletions,
        updatedAt: args.updatedAt,
        mergedAt: args.mergedAt,
      });
      return { created: false, id: existingAnyState._id };
    }

    // Create new PR record
    const id = await ctx.db.insert("sourceControlPullRequests", {
      orgId: args.orgId,
      repositoryId: args.repositoryId,
      prNumber: args.prNumber,
      title: args.title,
      body: args.body,
      state: args.state,
      isDraft: args.isDraft,
      authorLogin: args.authorLogin,
      sourceBranch: args.sourceBranch,
      targetBranch: args.targetBranch,
      reviewState: args.reviewState,
      ciStatus: args.ciStatus,
      commitCount: args.commitCount,
      filesChanged: args.filesChanged,
      additions: args.additions,
      deletions: args.deletions,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      mergedAt: args.mergedAt,
      providerUrl: args.providerUrl,
    });
    return { created: true, id };
  },
});
