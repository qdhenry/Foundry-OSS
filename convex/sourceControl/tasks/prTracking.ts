import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

/**
 * PR state tracking mutations/queries.
 *
 * Called from the webhook processor when pull_request, pull_request_review,
 * and workflow_run events arrive. Creates/updates sourceControlPullRequests records.
 */

// ---------------------------------------------------------------------------
// upsertPR — create or update a PR from a webhook event
// ---------------------------------------------------------------------------

export const upsertPR = internalMutation({
  args: {
    orgId: v.string(),
    repoFullName: v.string(),
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
    // Find the repository record
    const repo = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
    if (!repo) {
      console.log(`[pr-tracking] No repo binding found for ${args.repoFullName}, skipping`);
      return null;
    }

    // Check for existing PR record
    const existing = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo_pr", (q) => q.eq("repositoryId", repo._id).eq("prNumber", args.prNumber))
      .first();

    if (existing) {
      // Update existing PR
      await ctx.db.patch(existing._id, {
        title: args.title,
        body: args.body,
        state: args.state,
        isDraft: args.isDraft,
        commitCount: args.commitCount,
        filesChanged: args.filesChanged,
        additions: args.additions,
        deletions: args.deletions,
        updatedAt: args.updatedAt,
        mergedAt: args.mergedAt,
      });
      return existing._id;
    }

    // Create new PR record
    const prId = await ctx.db.insert("sourceControlPullRequests", {
      orgId: args.orgId,
      repositoryId: repo._id,
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

    return prId;
  },
});

// ---------------------------------------------------------------------------
// updateReviewState — update PR review state from pull_request_review event
// ---------------------------------------------------------------------------

export const updateReviewState = internalMutation({
  args: {
    orgId: v.string(),
    repoFullName: v.string(),
    prNumber: v.number(),
    reviewState: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("changes_requested"),
    ),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
    if (!repo) return;

    const pr = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo_pr", (q) => q.eq("repositoryId", repo._id).eq("prNumber", args.prNumber))
      .first();

    if (pr) {
      await ctx.db.patch(pr._id, { reviewState: args.reviewState });
    }
  },
});

// ---------------------------------------------------------------------------
// updateCIStatus — update CI status from workflow_run event
// ---------------------------------------------------------------------------

export const updateCIStatus = internalMutation({
  args: {
    orgId: v.string(),
    repoFullName: v.string(),
    branch: v.string(),
    ciStatus: v.union(
      v.literal("none"),
      v.literal("passing"),
      v.literal("failing"),
      v.literal("pending"),
    ),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
    if (!repo) return;

    // Find open PRs from this branch and update their CI status
    const openPRs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo_state_branch", (q) =>
        q.eq("repositoryId", repo._id).eq("state", "open").eq("sourceBranch", args.branch),
      )
      .collect();

    for (const pr of openPRs) {
      await ctx.db.patch(pr._id, { ciStatus: args.ciStatus });
    }
  },
});

// ---------------------------------------------------------------------------
// getPRByRepoAndNumber — find a PR by repo + number
// ---------------------------------------------------------------------------

export const getPRByRepoAndNumber = internalQuery({
  args: {
    repoFullName: v.string(),
    prNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
    if (!repo) return null;

    return await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo_pr", (q) => q.eq("repositoryId", repo._id).eq("prNumber", args.prNumber))
      .first();
  },
});

// ---------------------------------------------------------------------------
// getTasksByProgram — get tasks for a program (for PR linking)
// ---------------------------------------------------------------------------

export const getTasksByProgram = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// getPRsByTask — get all PRs linked to a task
// ---------------------------------------------------------------------------

export const getPRsByTask = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// listByTask — get PRs and issue mapping for a task (public, auth-checked)
// ---------------------------------------------------------------------------

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    await assertOrgAccess(ctx, task.orgId);

    const prs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    const issueMapping = await ctx.db
      .query("sourceControlIssueMappings")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .unique();

    // Get reviews for each PR
    const prsWithReviews = await Promise.all(
      prs.map(async (pr) => {
        const reviews = await ctx.db
          .query("sourceControlReviews")
          .withIndex("by_pr", (q) => q.eq("prId", pr._id))
          .collect();
        return { ...pr, reviews };
      }),
    );

    return { prs: prsWithReviews, issueMapping };
  },
});

// ---------------------------------------------------------------------------
// advanceTaskOnMerge — auto-advance linked task to "done" when a PR merges
// ---------------------------------------------------------------------------

export const advanceTaskOnMerge = internalMutation({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr?.taskId) return;

    const task = await ctx.db.get(pr.taskId);
    if (!task || task.status === "done") return;

    // Only auto-advance if this is the primary (non-stacked) or final-in-stack PR.
    // A PR is "final" when no other open PR in the same task has a higher stackOrder.
    if (pr.stackOrder !== undefined) {
      const siblingPRs = await ctx.db
        .query("sourceControlPullRequests")
        .withIndex("by_task", (q) => q.eq("taskId", pr.taskId!))
        .collect();

      const hasOpenHigherStack = siblingPRs.some(
        (sibling) =>
          sibling._id !== pr._id &&
          sibling.state === "open" &&
          sibling.stackOrder !== undefined &&
          sibling.stackOrder > (pr.stackOrder ?? -1),
      );

      if (hasOpenHigherStack) {
        console.log(
          `[pr-tracking] advanceTaskOnMerge — PR ${args.prId} merged but not final in stack, skipping task advance`,
        );
        return;
      }
    }

    await ctx.db.patch(pr.taskId, { status: "done" });
    console.log(
      `[pr-tracking] advanceTaskOnMerge — task ${pr.taskId} advanced to "done" via PR ${args.prId}`,
    );
  },
});

// ---------------------------------------------------------------------------
// syncConflictState — update conflictState + conflictFiles from webhook payload
// ---------------------------------------------------------------------------

export const syncConflictState = internalMutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
    mergeableState: v.string(),
    conflictFiles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    let conflictState: "clean" | "conflicted" | "unknown";
    if (args.mergeableState === "clean" || args.mergeableState === "unstable") {
      conflictState = "clean";
    } else if (args.mergeableState === "dirty") {
      conflictState = "conflicted";
    } else {
      conflictState = "unknown";
    }

    await ctx.db.patch(args.prId, {
      conflictState,
      conflictFiles: args.conflictFiles ?? [],
    });
  },
});

// ---------------------------------------------------------------------------
// getPRById — fetch a single PR record by ID (for activity event lookups)
// ---------------------------------------------------------------------------

export const getPRById = internalQuery({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.prId);
  },
});

// ---------------------------------------------------------------------------
// getPRsByRepoBranch — find open PRs by repository + source branch
// ---------------------------------------------------------------------------

export const getPRsByRepoBranch = internalQuery({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    sourceBranch: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo_state_branch", (q) =>
        q
          .eq("repositoryId", args.repositoryId)
          .eq("state", "open")
          .eq("sourceBranch", args.sourceBranch),
      )
      .collect();
  },
});

// ---------------------------------------------------------------------------
// getImplementationProgress — compute completion % for a task based on PR state
// ---------------------------------------------------------------------------

export const getImplementationProgress = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const prs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    if (prs.length === 0) {
      return { estimatedCompletionPercent: 0, prCount: 0, signals: {} };
    }

    // Use the best PR state for scoring
    // PR state scoring: merged=100, approved=80, open=60, draft=40, none=0
    let bestPRScore = 0;
    let bestReviewScore = 0;
    let bestCIScore = 0;
    const hasTests = false;

    for (const pr of prs) {
      // PR state score
      const stateScore =
        pr.state === "merged"
          ? 100
          : pr.reviewState === "approved"
            ? 80
            : pr.state === "open" && !pr.isDraft
              ? 60
              : pr.isDraft
                ? 40
                : 0;
      bestPRScore = Math.max(bestPRScore, stateScore);

      // Review score
      const reviewScore =
        pr.reviewState === "approved"
          ? 100
          : pr.reviewState === "pending"
            ? 50
            : pr.reviewState === "changes_requested"
              ? 25
              : 0;
      bestReviewScore = Math.max(bestReviewScore, reviewScore);

      // CI score
      const ciScore =
        pr.ciStatus === "passing"
          ? 100
          : pr.ciStatus === "pending"
            ? 50
            : pr.ciStatus === "failing"
              ? 0
              : 0;
      bestCIScore = Math.max(bestCIScore, ciScore);
    }

    // Implementation score formula from spec:
    // codeExistence * 0.30 + prCompletion * 0.25 + testCoverage * 0.20 +
    // reviewCompletion * 0.15 + ciPassing * 0.10
    const codeExistence = 100; // Has linked code/PR
    const testCoverage = hasTests ? 100 : 0;

    const estimatedCompletionPercent = Math.round(
      codeExistence * 0.3 +
        bestPRScore * 0.25 +
        testCoverage * 0.2 +
        bestReviewScore * 0.15 +
        bestCIScore * 0.1,
    );

    return {
      estimatedCompletionPercent,
      prCount: prs.length,
      signals: {
        codeExistence,
        prCompletion: bestPRScore,
        testCoverage,
        reviewCompletion: bestReviewScore,
        ciPassing: bestCIScore,
      },
    };
  },
});
