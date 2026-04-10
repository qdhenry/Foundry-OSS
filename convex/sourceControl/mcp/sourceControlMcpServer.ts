// @ts-nocheck
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import { getProvider } from "../factory";
import type { GitHubProvider } from "../providers/github";
import type { SourceControlProvider } from "../types";

/**
 * Source Control MCP Tools for the Agent SDK (Phase 6J).
 *
 * All tools call provider methods through the abstraction layer — no direct
 * GitHub API calls. Each action handles token management internally.
 */

// ---------------------------------------------------------------------------
// Helper: get an authenticated provider for a repository
// ---------------------------------------------------------------------------

async function getAuthedProvider(
  ctx: any,
  repositoryId: string,
): Promise<{ provider: SourceControlProvider; repo: any }> {
  const { repo, installation } = await ctx.runQuery(
    internal.sourceControl.mcp.queries.getRepoWithInstallation,
    { repositoryId },
  );

  const provider = getProvider(repo.providerType);

  // Check token cache first
  let token = await ctx.runQuery(internal.sourceControl.mcp.queries.getCachedToken, {
    installationId: installation.installationId,
  });

  if (!token) {
    // Generate a fresh installation token
    const tokenResult = await provider.getInstallationToken(installation.installationId);
    token = tokenResult.token;

    // Cache it
    await ctx.runMutation(internal.sourceControl.mcp.queries.upsertToken, {
      installationId: installation.installationId,
      token: tokenResult.token,
      expiresAt: tokenResult.expiresAt,
    });
  }

  // Set the token on the provider instance
  (provider as GitHubProvider).setToken(token);

  return { provider, repo };
}

// Paths to auto-exclude from repo structure results
const EXCLUDED_DIRS = new Set([
  "node_modules",
  "vendor",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".cache",
  "coverage",
  ".turbo",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".zip",
  ".tar",
  ".gz",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
]);

// ---------------------------------------------------------------------------
// 1. get_repo_structure
// ---------------------------------------------------------------------------

export const getRepoStructure = action({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    const tree = await provider.getRepoStructure(repo.repoFullName, args.path);

    // Filter out excluded directories and binary files
    return tree.filter((node) => {
      if (node.type === "directory" && EXCLUDED_DIRS.has(node.name)) {
        return false;
      }
      if (node.type === "file") {
        const ext = node.name.substring(node.name.lastIndexOf(".")).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) return false;
      }
      return true;
    });
  },
});

// ---------------------------------------------------------------------------
// 2. get_file_contents
// ---------------------------------------------------------------------------

export const getFileContents = action({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    path: v.string(),
    ref: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Skip binary files
    const ext = args.path.substring(args.path.lastIndexOf(".")).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      throw new ConvexError(`Cannot read binary file: ${args.path}`);
    }

    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    return provider.getFileContents(repo.repoFullName, args.path, args.ref);
  },
});

// ---------------------------------------------------------------------------
// 3. get_pr_diff
// ---------------------------------------------------------------------------

const MAX_DIFF_LINES = 10_000;

export const getPRDiff = action({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    prNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    const diff = await provider.getPullRequestDiff(repo.repoFullName, args.prNumber);

    // Cap at 10,000 lines
    const lines = diff.split("\n");
    if (lines.length > MAX_DIFF_LINES) {
      return {
        diff: lines.slice(0, MAX_DIFF_LINES).join("\n"),
        truncated: true,
        totalLines: lines.length,
        message: `Diff truncated from ${lines.length} to ${MAX_DIFF_LINES} lines.`,
      };
    }

    return { diff, truncated: false, totalLines: lines.length };
  },
});

// ---------------------------------------------------------------------------
// 4. get_pr_comments
// ---------------------------------------------------------------------------

export const getPRComments = action({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    prNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    const comments = await provider.getPullRequestComments(repo.repoFullName, args.prNumber);

    // Limit to 100 most recent
    return comments.slice(-100);
  },
});

// ---------------------------------------------------------------------------
// 5. get_commit_history
// ---------------------------------------------------------------------------

export const getCommitHistory = action({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    branch: v.optional(v.string()),
    path: v.optional(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    return provider.getCommitHistory(repo.repoFullName, {
      branch: args.branch,
      path: args.path,
      since: args.since,
      until: args.until,
      limit: Math.min(args.limit ?? 50, 100),
    });
  },
});

// ---------------------------------------------------------------------------
// 6. get_ci_status
// ---------------------------------------------------------------------------

export const getCIStatus = action({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    ref: v.string(),
  },
  handler: async (ctx, args) => {
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    return provider.getCIStatus(repo.repoFullName, args.ref);
  },
});

// ---------------------------------------------------------------------------
// 7. get_branch_comparison
// ---------------------------------------------------------------------------

export const getBranchComparison = action({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    base: v.string(),
    head: v.string(),
  },
  handler: async (ctx, args) => {
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    return provider.compareBranches(repo.repoFullName, args.base, args.head);
  },
});

// ---------------------------------------------------------------------------
// 8. search_code
// ---------------------------------------------------------------------------

export const searchCode = action({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    const results = await provider.searchCode(repo.repoFullName, args.query);

    // Max 100 results
    return results.slice(0, 100);
  },
});

// ---------------------------------------------------------------------------
// 9. get_sprint_code_evidence (DB-only — no provider calls)
// ---------------------------------------------------------------------------

export const getSprintCodeEvidence = action({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    return ctx.runQuery(internal.sourceControl.mcp.queries.getSprintCodeEvidence, {
      sprintId: args.sprintId,
    });
  },
});

// ---------------------------------------------------------------------------
// 10. get_task_implementation_status (DB-only — no provider calls)
// ---------------------------------------------------------------------------

export const getTaskImplementationStatus = action({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.sourceControl.mcp.queries.getTaskImplementationData, {
      taskId: args.taskId,
    });

    // Compute implementation score per spec formula
    const { task, prs, commits, issueMapping, reviews } = data;

    const hasCode = prs.length > 0 || commits.length > 0;
    const codeExistence = hasCode ? 100 : 0;

    // Best PR state
    let prCompletion = 0;
    if (prs.some((p: any) => p.state === "merged")) prCompletion = 100;
    else if (prs.some((p: any) => p.reviewState === "approved")) prCompletion = 80;
    else if (prs.some((p: any) => p.state === "open" && !p.isDraft)) prCompletion = 60;
    else if (prs.some((p: any) => p.isDraft)) prCompletion = 40;

    // Test coverage heuristic: any PR with test files?
    const hasTests = prs.some((p: any) => (p.title ?? "").toLowerCase().includes("test"));
    const testCoverage = hasTests ? 50 : 0;

    // Review state
    let reviewCompletion = 0;
    if (prs.some((p: any) => p.reviewState === "approved")) reviewCompletion = 100;
    else if (prs.some((p: any) => p.reviewState === "pending")) reviewCompletion = 50;
    else if (prs.some((p: any) => p.reviewState === "changes_requested")) reviewCompletion = 25;

    // CI
    let ciScore = 0;
    if (prs.some((p: any) => p.ciStatus === "passing")) ciScore = 100;
    else if (prs.some((p: any) => p.ciStatus === "pending")) ciScore = 50;

    const implementationScore = Math.round(
      codeExistence * 0.3 +
        prCompletion * 0.25 +
        testCoverage * 0.2 +
        reviewCompletion * 0.15 +
        ciScore * 0.1,
    );

    return {
      taskId: task._id,
      taskTitle: task.title,
      taskStatus: task.status,
      implementationScore,
      scoreBreakdown: {
        codeExistence,
        prCompletion,
        testCoverage,
        reviewCompletion,
        ciPassing: ciScore,
      },
      pullRequests: prs.map((p: any) => ({
        prNumber: p.prNumber,
        state: p.state,
        isDraft: p.isDraft,
        reviewState: p.reviewState,
        ciStatus: p.ciStatus,
        commitCount: p.commitCount,
        filesChanged: p.filesChanged,
        additions: p.additions,
        deletions: p.deletions,
        providerUrl: p.providerUrl,
      })),
      commitCount: commits.length,
      githubIssue: issueMapping
        ? {
            issueNumber: issueMapping.issueNumber,
            issueUrl: issueMapping.issueUrl,
            syncStatus: issueMapping.syncStatus,
          }
        : null,
      reviewCount: reviews.length,
    };
  },
});

// ---------------------------------------------------------------------------
// 11. get_relevant_snippets (DB-only — no provider calls)
// ---------------------------------------------------------------------------

export const getRelevantSnippets = action({
  args: {
    requirementCategory: v.optional(v.string()),
    targetPlatform: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.runQuery(internal.sourceControl.mcp.queries.searchSnippets, {
      requirementCategory: args.requirementCategory,
      targetPlatform: args.targetPlatform,
      limit: Math.min(args.limit ?? 10, 20),
    });
  },
});

// ---------------------------------------------------------------------------
// 12. get_pr_migration_context
// ---------------------------------------------------------------------------

export const getPRMigrationContext = action({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.sourceControl.mcp.queries.getPRMigrationContextData, {
      prId: args.prId,
    });

    const { pr, repo, program, task, requirement, relatedRequirements, snippets, pastReviews } =
      data;

    // Fetch the live PR diff via the provider
    let diff: string | null = null;
    try {
      const { provider } = await getAuthedProvider(ctx, pr.repositoryId);
      const rawDiff = await provider.getPullRequestDiff(repo.repoFullName, pr.prNumber);
      // Cap at 10,000 lines
      const lines = rawDiff.split("\n");
      diff = lines.length > MAX_DIFF_LINES ? lines.slice(0, MAX_DIFF_LINES).join("\n") : rawDiff;
    } catch {
      // If diff fetch fails, proceed without it
      diff = null;
    }

    return {
      pullRequest: {
        number: pr.prNumber,
        title: pr.title,
        state: pr.state,
        sourceBranch: pr.sourceBranch,
        targetBranch: pr.targetBranch,
        authorLogin: pr.authorLogin,
        filesChanged: pr.filesChanged,
        additions: pr.additions,
        deletions: pr.deletions,
        providerUrl: pr.providerUrl,
      },
      diff,
      program: program
        ? {
            name: program.name,
            sourcePlatform: program.sourcePlatform,
            targetPlatform: program.targetPlatform,
          }
        : null,
      task: task
        ? {
            id: task._id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
          }
        : null,
      requirement: requirement
        ? {
            id: requirement._id,
            refId: requirement.refId,
            title: requirement.title,
            description: requirement.description,
            fitGap: requirement.fitGap,
            priority: requirement.priority,
          }
        : null,
      relatedRequirements: relatedRequirements.map((r: any) => ({
        refId: r.refId,
        title: r.title,
        fitGap: r.fitGap,
      })),
      codeSnippets: snippets.map((s: any) => ({
        title: s.title,
        description: s.description,
        code: s.code,
        annotations: s.annotations,
        successRating: s.successRating,
      })),
      pastReviewCount: pastReviews.length,
      repository: {
        repoFullName: repo.repoFullName,
        role: repo.role,
        defaultBranch: repo.defaultBranch,
      },
    };
  },
});
