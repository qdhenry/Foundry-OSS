// @ts-nocheck
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * Internal queries/mutations used by the MCP tool actions.
 * These run in Convex's V8 runtime (no "use node" needed).
 */

// ---------------------------------------------------------------------------
// Repository + installation lookup
// ---------------------------------------------------------------------------

export const getRepoWithInstallation = internalQuery({
  args: { repositoryId: v.id("sourceControlRepositories") },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) throw new ConvexError("Repository not found");

    const installation = await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", repo.installationId))
      .unique();
    if (!installation || installation.status !== "active") {
      throw new ConvexError("Installation not active or not found");
    }

    return { repo, installation };
  },
});

// ---------------------------------------------------------------------------
// Token cache management
// ---------------------------------------------------------------------------

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export const getCachedToken = internalQuery({
  args: { installationId: v.string() },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("sourceControlTokenCache")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();

    if (!cached) return null;
    if (cached.expiresAt - TOKEN_EXPIRY_BUFFER_MS < Date.now()) return null;
    return cached.token;
  },
});

export const upsertToken = internalMutation({
  args: {
    installationId: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sourceControlTokenCache")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        token: args.token,
        expiresAt: args.expiresAt,
      });
    } else {
      await ctx.db.insert("sourceControlTokenCache", {
        installationId: args.installationId,
        token: args.token,
        expiresAt: args.expiresAt,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Task implementation status (DB-only)
// ---------------------------------------------------------------------------

export const getTaskImplementationData = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");

    const prs = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    const commits = await ctx.db
      .query("sourceControlCommits")
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .collect();

    const issueMapping = await ctx.db
      .query("sourceControlIssueMappings")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .unique();

    const reviews = [];
    for (const pr of prs) {
      const prReviews = await ctx.db
        .query("sourceControlReviews")
        .withIndex("by_pr", (q) => q.eq("prId", pr._id))
        .collect();
      reviews.push(...prReviews);
    }

    return { task, prs, commits, issueMapping, reviews };
  },
});

// ---------------------------------------------------------------------------
// Sprint code evidence (DB-only aggregate)
// ---------------------------------------------------------------------------

export const getSprintCodeEvidence = internalQuery({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) throw new ConvexError("Sprint not found");

    // Get all tasks in this sprint
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();

    const _taskIds = new Set(tasks.map((t) => t._id));

    // Get all PRs linked to sprint tasks
    const allPRs = [];
    for (const task of tasks) {
      const prs = await ctx.db
        .query("sourceControlPullRequests")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();
      allPRs.push(...prs);
    }

    // Get repos for the program to query commits
    const repos = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", sprint.programId))
      .collect();

    // Aggregate commits in sprint window
    const sprintStart = sprint.startDate ?? 0;
    const sprintEnd = sprint.endDate ?? Date.now();
    let totalCommits = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;
    const authorCommitCounts: Record<string, number> = {};

    for (const repo of repos) {
      const commits = await ctx.db
        .query("sourceControlCommits")
        .withIndex("by_repo_date", (q) =>
          q.eq("repositoryId", repo._id).gte("committedAt", sprintStart),
        )
        .collect();

      for (const commit of commits) {
        if (commit.committedAt > sprintEnd) continue;
        totalCommits++;
        totalAdditions += commit.additions;
        totalDeletions += commit.deletions;
        authorCommitCounts[commit.authorLogin] = (authorCommitCounts[commit.authorLogin] ?? 0) + 1;
      }
    }

    // PR stats
    const merged = allPRs.filter((p) => p.state === "merged").length;
    const open = allPRs.filter((p) => p.state === "open").length;
    const totalPRs = allPRs.length;

    // Review stats
    let reviewedPRs = 0;
    const _unresolvedComments = 0;
    for (const pr of allPRs) {
      const reviews = await ctx.db
        .query("sourceControlReviews")
        .withIndex("by_pr", (q) => q.eq("prId", pr._id))
        .collect();
      if (reviews.length > 0) reviewedPRs++;
    }

    // CI status from latest PRs
    const ciStatuses = allPRs.map((p) => p.ciStatus);
    const ciPassing = ciStatuses.filter((s) => s === "passing").length;
    const ciFailing = ciStatuses.filter((s) => s === "failing").length;

    return {
      sprint: { name: sprint.name, startDate: sprintStart, endDate: sprintEnd },
      taskCount: tasks.length,
      prMergePercent: totalPRs > 0 ? Math.round((merged / totalPRs) * 100) : 0,
      prsOpen: open,
      prsMerged: merged,
      prsTotal: totalPRs,
      reviewCoveragePercent: totalPRs > 0 ? Math.round((reviewedPRs / totalPRs) * 100) : 0,
      ciPassRate: ciStatuses.length > 0 ? Math.round((ciPassing / ciStatuses.length) * 100) : 0,
      ciFailing,
      commits: totalCommits,
      additions: totalAdditions,
      deletions: totalDeletions,
      authorBreakdown: authorCommitCounts,
    };
  },
});

// ---------------------------------------------------------------------------
// Code snippets search (DB-only)
// ---------------------------------------------------------------------------

export const searchSnippets = internalQuery({
  args: {
    requirementCategory: v.optional(v.string()),
    targetPlatform: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    let snippets;

    if (args.requirementCategory) {
      snippets = await ctx.db
        .query("codeSnippets")
        .withIndex("by_category", (q) => q.eq("requirementCategory", args.requirementCategory!))
        .take(limit);
    } else if (args.targetPlatform) {
      snippets = await ctx.db
        .query("codeSnippets")
        .withIndex("by_platform", (q) =>
          q.eq(
            "targetPlatform",
            args.targetPlatform as "salesforce_b2b" | "bigcommerce_b2b" | "platform_agnostic",
          ),
        )
        .take(limit);
    } else {
      snippets = await ctx.db.query("codeSnippets").take(limit);
    }

    return snippets.map((s) => ({
      id: s._id,
      title: s.title,
      description: s.description,
      code: s.code,
      annotations: s.annotations,
      requirementCategory: s.requirementCategory,
      targetPlatform: s.targetPlatform,
      language: s.language,
      successRating: s.successRating,
      upvotes: s.upvotes,
    }));
  },
});

// ---------------------------------------------------------------------------
// PR migration context (DB-side data assembly)
// ---------------------------------------------------------------------------

export const getPRMigrationContextData = internalQuery({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");

    const repo = await ctx.db.get(pr.repositoryId);
    if (!repo) throw new ConvexError("Repository not found");

    const program = await ctx.db.get(repo.programId);

    // Get linked task + requirement context
    let task = null;
    let requirement = null;
    if (pr.taskId) {
      task = await ctx.db.get(pr.taskId);
      if (task?.requirementId) {
        requirement = await ctx.db.get(task.requirementId);
      }
    }

    // Get related requirements in same workstream
    let relatedRequirements: any[] = [];
    if (task?.workstreamId) {
      relatedRequirements = await ctx.db
        .query("requirements")
        .withIndex("by_workstream", (q) => q.eq("workstreamId", task?.workstreamId!))
        .collect();
      // Exclude the current requirement
      if (requirement) {
        relatedRequirements = relatedRequirements.filter((r) => r._id !== requirement?._id);
      }
    }

    // Get relevant code snippets
    const snippets = requirement
      ? await ctx.db
          .query("codeSnippets")
          .withIndex("by_platform", (q) =>
            q.eq("targetPlatform", program?.targetPlatform ?? "platform_agnostic"),
          )
          .take(5)
      : [];

    // Past reviews on this PR
    const pastReviews = await ctx.db
      .query("sourceControlReviews")
      .withIndex("by_pr", (q) => q.eq("prId", args.prId))
      .collect();

    return {
      pr,
      repo,
      program,
      task,
      requirement,
      relatedRequirements: relatedRequirements.slice(0, 10),
      snippets,
      pastReviews,
    };
  },
});
