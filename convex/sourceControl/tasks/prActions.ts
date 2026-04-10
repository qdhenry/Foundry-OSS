// @ts-nocheck
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation, internalQuery, mutation } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

/**
 * PR lifecycle mutations — public client-callable mutations + internal DB helpers.
 *
 * Public mutations are thin wrappers: validate, assertOrgAccess, then schedule
 * an internal action via ctx.scheduler.runAfter(0, ...) for the GitHub API call.
 *
 * Internal helpers are used by prActionsInternal.ts (the "use node" layer).
 */

// ---------------------------------------------------------------------------
// Internal helpers — DB layer for prActionsInternal.ts
// ---------------------------------------------------------------------------

export const getPRWithRepo = internalQuery({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");

    const repo = await ctx.db.get(pr.repositoryId);
    if (!repo) throw new ConvexError("Repository not found");

    return { pr, repo };
  },
});

export const getTaskWithContext = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");

    // Primary repo for this program
    const repo = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", task.programId))
      .first();

    const requirement = task.requirementId ? await ctx.db.get(task.requirementId) : null;

    const sprint = task.sprintId ? await ctx.db.get(task.sprintId) : null;
    const program = await ctx.db.get(task.programId);

    return { task, repo, requirement, sprint, program };
  },
});

export const patchPR = internalMutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.prId, args.patch);
  },
});

export const advanceTaskToDone = internalMutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;
    if (task.status === "in_progress" || task.status === "review") {
      await ctx.db.patch(args.taskId, { status: "done" });
    }
  },
});

export const storePR = internalMutation({
  args: {
    orgId: v.string(),
    repositoryId: v.id("sourceControlRepositories"),
    taskId: v.optional(v.id("tasks")),
    prNumber: v.number(),
    title: v.string(),
    body: v.optional(v.string()),
    sourceBranch: v.string(),
    targetBranch: v.string(),
    authorLogin: v.string(),
    providerUrl: v.string(),
    isDraft: v.boolean(),
    aiDescriptionEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Idempotent — return existing if already tracked
    const existing = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_repo_pr", (q) =>
        q.eq("repositoryId", args.repositoryId).eq("prNumber", args.prNumber),
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("sourceControlPullRequests", {
      orgId: args.orgId,
      repositoryId: args.repositoryId,
      taskId: args.taskId,
      prNumber: args.prNumber,
      title: args.title,
      body: args.body,
      state: "open",
      isDraft: args.isDraft,
      authorLogin: args.authorLogin,
      sourceBranch: args.sourceBranch,
      targetBranch: args.targetBranch,
      reviewState: "none",
      ciStatus: "none",
      commitCount: 0,
      filesChanged: 0,
      additions: 0,
      deletions: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      providerUrl: args.providerUrl,
      linkMethod: "branch_name",
      aiDescriptionEnabled: args.aiDescriptionEnabled,
    });
  },
});

// ---------------------------------------------------------------------------
// Public mutations — thin wrappers that schedule GitHub actions
// ---------------------------------------------------------------------------

export const promoteToReady = mutation({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");
    await assertOrgAccess(ctx, pr.orgId);
    if (!pr.isDraft) throw new ConvexError("PR is already ready for review");

    await ctx.scheduler.runAfter(
      0,
      internal.sourceControl.tasks.prActionsInternal.doPromoteToReady,
      { prId: args.prId },
    );
  },
});

export const editDescription = mutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");
    await assertOrgAccess(ctx, pr.orgId);

    await ctx.scheduler.runAfter(
      0,
      internal.sourceControl.tasks.prActionsInternal.doEditDescription,
      { prId: args.prId, description: args.description },
    );
  },
});

export const requestReview = mutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
    reviewerLogins: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");
    await assertOrgAccess(ctx, pr.orgId);
    if (args.reviewerLogins.length === 0) {
      throw new ConvexError("At least one reviewer is required");
    }

    await ctx.scheduler.runAfter(
      0,
      internal.sourceControl.tasks.prActionsInternal.doRequestReview,
      { prId: args.prId, reviewerLogins: args.reviewerLogins },
    );
  },
});

export const merge = mutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
    strategy: v.union(v.literal("merge"), v.literal("squash"), v.literal("rebase")),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");
    await assertOrgAccess(ctx, pr.orgId);
    if (pr.state !== "open") throw new ConvexError("Only open PRs can be merged");
    if (pr.isDraft) {
      throw new ConvexError("Draft PRs cannot be merged. Promote to ready first.");
    }

    // Enforce stacked PR merge ordering — parent PR must be merged first
    if (pr.parentPrId) {
      const parentPR = await ctx.db.get(pr.parentPrId);
      if (parentPR && parentPR.state !== "merged") {
        throw new ConvexError(
          `Parent PR #${parentPR.prNumber} must be merged before this PR can be merged`,
        );
      }
    }

    await ctx.scheduler.runAfter(0, internal.sourceControl.tasks.prActionsInternal.doMerge, {
      prId: args.prId,
      strategy: args.strategy,
    });
  },
});

export const close = mutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");
    await assertOrgAccess(ctx, pr.orgId);
    if (pr.state !== "open") throw new ConvexError("PR is not open");

    await ctx.scheduler.runAfter(0, internal.sourceControl.tasks.prActionsInternal.doClose, {
      prId: args.prId,
      comment: args.comment,
    });
  },
});

export const reopen = mutation({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");
    await assertOrgAccess(ctx, pr.orgId);
    if (pr.state !== "closed") {
      throw new ConvexError("Only closed PRs can be reopened");
    }

    await ctx.scheduler.runAfter(0, internal.sourceControl.tasks.prActionsInternal.doReopen, {
      prId: args.prId,
    });
  },
});

export const getProgramTeamMembers = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user ? { ...user, role: m.role } : null;
      }),
    ).then((results) => results.filter(Boolean));
  },
});

export const createFollowUp = mutation({
  args: {
    taskId: v.id("tasks"),
    prId: v.id("sourceControlPullRequests"),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");
    await assertOrgAccess(ctx, pr.orgId);

    // Find the current highest stackOrder among task-linked PRs
    const taskPRs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    let maxOrder = 0;
    let parentId: (typeof taskPRs)[0]["_id"] | undefined;
    for (const p of taskPRs) {
      const order = p.stackOrder ?? 0;
      if (order >= maxOrder) {
        maxOrder = order;
        parentId = p._id;
      }
    }

    await ctx.db.patch(args.prId, {
      taskId: args.taskId,
      parentPrId: parentId,
      stackOrder: maxOrder + 1,
      linkMethod: "manual",
    });

    return args.prId;
  },
});
