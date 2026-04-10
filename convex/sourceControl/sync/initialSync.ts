// @ts-nocheck
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * Initial sync mutations/queries for the 90-day historical data pull.
 *
 * The sync action lives in initialSyncActions.ts (Node.js runtime).
 * Triggered when a repo is first connected to a program.
 */

// ---------------------------------------------------------------------------
// storePullRequest — insert a PR record from initial sync
// ---------------------------------------------------------------------------

export const storePullRequest = internalMutation({
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
    // Check for existing PR (avoid duplicates)
    const existing = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) =>
        q.and(
          q.eq(q.field("repositoryId"), args.repositoryId),
          q.eq(q.field("prNumber"), args.prNumber),
        ),
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("sourceControlPullRequests", {
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
      reviewState: "none",
      ciStatus: "none",
      commitCount: args.commitCount,
      filesChanged: args.filesChanged,
      additions: args.additions,
      deletions: args.deletions,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      mergedAt: args.mergedAt,
      providerUrl: args.providerUrl,
    });
  },
});

// ---------------------------------------------------------------------------
// storeCommit — insert a commit record from initial sync
// ---------------------------------------------------------------------------

export const storeCommit = internalMutation({
  args: {
    orgId: v.string(),
    repositoryId: v.id("sourceControlRepositories"),
    sha: v.string(),
    prId: v.optional(v.id("sourceControlPullRequests")),
    authorLogin: v.string(),
    message: v.string(),
    filesChanged: v.number(),
    additions: v.number(),
    deletions: v.number(),
    committedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for existing commit by SHA (avoid duplicates)
    const existing = await ctx.db
      .query("sourceControlCommits")
      .withIndex("by_sha", (q) => q.eq("sha", args.sha))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("sourceControlCommits", {
      orgId: args.orgId,
      repositoryId: args.repositoryId,
      sha: args.sha,
      prId: args.prId,
      authorLogin: args.authorLogin,
      message: args.message,
      filesChanged: args.filesChanged,
      additions: args.additions,
      deletions: args.deletions,
      committedAt: args.committedAt,
    });
  },
});

// ---------------------------------------------------------------------------
// updateSyncStateAfterInitialSync — mark sync state as healthy after sync
// ---------------------------------------------------------------------------

export const updateSyncStateAfterInitialSync = internalMutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    const syncState = await ctx.db
      .query("sourceControlSyncState")
      .withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId))
      .unique();

    if (syncState) {
      await ctx.db.patch(syncState._id, {
        status: "healthy",
        lastWebhookAt: Date.now(),
      });
    }
  },
});

// ---------------------------------------------------------------------------
// getExistingPRCount — count existing PRs for a repo (for progress tracking)
// ---------------------------------------------------------------------------

export const getExistingPRCount = internalQuery({
  args: { repositoryId: v.id("sourceControlRepositories") },
  handler: async (ctx, args) => {
    const prs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId))
      .collect();
    return prs.length;
  },
});

// ---------------------------------------------------------------------------
// linkCommitsToPR — backfill prId on commits that arrived before the PR was created
// ---------------------------------------------------------------------------

export const linkCommitsToPR = internalMutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    prId: v.id("sourceControlPullRequests"),
    sourceBranch: v.string(),
  },
  handler: async (ctx, args) => {
    // Find all commits for this repo that have no prId set.
    // We use by_repo_date index and filter for missing prId.
    const unlinkedCommits = await ctx.db
      .query("sourceControlCommits")
      .withIndex("by_repo_date", (q) => q.eq("repositoryId", args.repositoryId))
      .filter((q) => q.eq(q.field("prId"), undefined))
      .collect();

    let linked = 0;
    for (const commit of unlinkedCommits) {
      await ctx.db.patch(commit._id, { prId: args.prId });
      linked++;
    }

    if (linked > 0) {
      console.log(
        `[initial-sync] Backfilled prId on ${linked} commits for PR ${args.prId} on branch ${args.sourceBranch}`,
      );
    }

    return linked;
  },
});
