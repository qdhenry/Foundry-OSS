// @ts-nocheck
"use node";

import type Anthropic from "@anthropic-ai/sdk";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../../_generated/api";
import { action, internalAction } from "../../_generated/server";
import { getAnthropicClient } from "../../lib/aiClient";
import { getProvider } from "../factory";
import type { GitHubProvider } from "../providers/github";

/**
 * PR lifecycle actions — "use node" layer for GitHub API calls and AI.
 *
 * Internal actions are scheduled from mutations in prActions.ts.
 * Public actions are called directly from the client (lazy loads, AI triggers).
 */

// ---------------------------------------------------------------------------
// Helper — get authenticated provider scoped to a PR
// ---------------------------------------------------------------------------

async function getAuthedProviderForPR(ctx: any, prId: string) {
  const { pr, repo } = await ctx.runQuery(internal.sourceControl.tasks.prActions.getPRWithRepo, {
    prId,
  });

  const { installation } = await ctx.runQuery(
    internal.sourceControl.mcp.queries.getRepoWithInstallation,
    { repositoryId: repo._id },
  );

  const provider = getProvider(repo.providerType);

  let token = await ctx.runQuery(internal.sourceControl.mcp.queries.getCachedToken, {
    installationId: installation.installationId,
  });

  if (!token) {
    const tokenResult = await provider.getInstallationToken(installation.installationId);
    token = tokenResult.token;
    await ctx.runMutation(internal.sourceControl.mcp.queries.upsertToken, {
      installationId: installation.installationId,
      token: tokenResult.token,
      expiresAt: tokenResult.expiresAt,
    });
  }

  (provider as GitHubProvider).setToken(token);
  return { provider, pr, repo };
}

function isNoCommitsBetweenValidationError(error: unknown) {
  const status = typeof (error as any)?.status === "number" ? (error as any).status : undefined;
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (status !== 422 && !message.includes("422")) return false;
  return /No commits between/i.test(message);
}

function toErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Unknown source control error";
}

function isRemoteBranchMissingError(error: unknown): boolean {
  const status = typeof (error as any)?.status === "number" ? (error as any).status : undefined;
  const message = toErrorMessage(error);
  if (status !== 404 && !message.includes("404")) {
    return false;
  }
  return /list-commits|\/commits|Not Found/i.test(message);
}

// ---------------------------------------------------------------------------
// Internal actions — scheduled by mutations in prActions.ts
// ---------------------------------------------------------------------------

export const doPromoteToReady = internalAction({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    await provider.updatePullRequest(repo.repoFullName, pr.prNumber, {
      draft: false,
    });

    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: args.prId,
      patch: { isDraft: false, updatedAt: Date.now() },
    });

    await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
      orgId: pr.orgId,
      taskId: pr.taskId,
      prId: args.prId,
      eventType: "pr_ready_for_review",
      actorLogin: pr.authorLogin,
      summary: `PR #${pr.prNumber} promoted to ready for review`,
      occurredAt: Date.now(),
    });
  },
});

export const doEditDescription = internalAction({
  args: {
    prId: v.id("sourceControlPullRequests"),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    await provider.updatePullRequest(repo.repoFullName, pr.prNumber, {
      body: args.description,
    });

    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: args.prId,
      patch: { body: args.description, updatedAt: Date.now() },
    });

    await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
      orgId: pr.orgId,
      taskId: pr.taskId,
      prId: args.prId,
      eventType: "description_updated",
      actorLogin: pr.authorLogin,
      summary: `PR #${pr.prNumber} description updated`,
      occurredAt: Date.now(),
    });
  },
});

export const doRequestReview = internalAction({
  args: {
    prId: v.id("sourceControlPullRequests"),
    reviewerLogins: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    await provider.requestReviewers(repo.repoFullName, pr.prNumber, args.reviewerLogins);

    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: args.prId,
      patch: { reviewState: "pending", updatedAt: Date.now() },
    });

    await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
      orgId: pr.orgId,
      taskId: pr.taskId,
      prId: args.prId,
      eventType: "review_requested",
      actorLogin: pr.authorLogin,
      summary: `Review requested from ${args.reviewerLogins.join(", ")} on PR #${pr.prNumber}`,
      metadata: { reviewers: args.reviewerLogins },
      occurredAt: Date.now(),
    });
  },
});

export const doMerge = internalAction({
  args: {
    prId: v.id("sourceControlPullRequests"),
    strategy: v.union(v.literal("merge"), v.literal("squash"), v.literal("rebase")),
  },
  handler: async (ctx, args) => {
    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    // Auto-promote draft PRs before merging (GitHub returns 405 on draft merge)
    if (pr.isDraft) {
      await provider.updatePullRequest(repo.repoFullName, pr.prNumber, {
        draft: false,
      });
      await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
        prId: args.prId,
        patch: { isDraft: false, updatedAt: Date.now() },
      });
    }

    await provider.mergePullRequest(repo.repoFullName, pr.prNumber, args.strategy);

    const now = Date.now();

    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: args.prId,
      patch: {
        state: "merged",
        mergeStrategy: args.strategy,
        mergedAt: now,
        updatedAt: now,
      },
    });

    if (pr.taskId) {
      await ctx.runMutation(internal.sourceControl.tasks.prActions.advanceTaskToDone, {
        taskId: pr.taskId,
      });
    }

    await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
      orgId: pr.orgId,
      taskId: pr.taskId,
      prId: args.prId,
      eventType: "pr_merged",
      actorLogin: pr.authorLogin,
      summary: `PR #${pr.prNumber} merged via ${args.strategy}`,
      metadata: { strategy: args.strategy },
      occurredAt: now,
    });
  },
});

export const doClose = internalAction({
  args: {
    prId: v.id("sourceControlPullRequests"),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    await provider.updatePullRequest(repo.repoFullName, pr.prNumber, {
      state: "closed",
    });

    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: args.prId,
      patch: { state: "closed", updatedAt: Date.now() },
    });

    await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
      orgId: pr.orgId,
      taskId: pr.taskId,
      prId: args.prId,
      eventType: "pr_closed",
      actorLogin: pr.authorLogin,
      summary: `PR #${pr.prNumber} closed`,
      metadata: args.comment ? { comment: args.comment } : undefined,
      occurredAt: Date.now(),
    });
  },
});

export const doReopen = internalAction({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    await provider.updatePullRequest(repo.repoFullName, pr.prNumber, {
      state: "open",
    });

    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: args.prId,
      patch: { state: "open", updatedAt: Date.now() },
    });

    await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
      orgId: pr.orgId,
      taskId: pr.taskId,
      prId: args.prId,
      eventType: "pr_reopened",
      actorLogin: pr.authorLogin,
      summary: `PR #${pr.prNumber} reopened`,
      occurredAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// createDraftPR — called by webhook processor on first push to a task branch
// ---------------------------------------------------------------------------

export const createDraftPR = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const { task, repo, requirement, sprint, program } = await ctx.runQuery(
      internal.sourceControl.tasks.prActions.getTaskWithContext,
      { taskId: args.taskId },
    );

    if (!repo) {
      console.log(`[pr-actions] No repo found for task ${args.taskId}, skipping draft PR creation`);
      return null;
    }

    // Head branch — use task's worktree branch if set, else derive from task ID
    const headBranch = task.worktreeBranch ?? `task/${args.taskId}`;

    // Target branch — derive from sprint name per spec, fallback to repo default
    const targetBranch = sprint
      ? `release/${sprint.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}`
      : repo.defaultBranch;

    // Use task description as-is — AI description can be generated on-demand via regenerateDescription
    const prBody = task.description ?? "";

    // Get authenticated GitHub provider
    const { installation } = await ctx.runQuery(
      internal.sourceControl.mcp.queries.getRepoWithInstallation,
      { repositoryId: repo._id },
    );

    const provider = getProvider(repo.providerType);
    let token = await ctx.runQuery(internal.sourceControl.mcp.queries.getCachedToken, {
      installationId: installation.installationId,
    });

    if (!token) {
      const tokenResult = await provider.getInstallationToken(installation.installationId);
      token = tokenResult.token;
      await ctx.runMutation(internal.sourceControl.mcp.queries.upsertToken, {
        installationId: installation.installationId,
        token: tokenResult.token,
        expiresAt: tokenResult.expiresAt,
      });
    }
    (provider as GitHubProvider).setToken(token);

    // Verify target branch exists on remote; fall back to default branch
    let resolvedTarget = targetBranch;
    try {
      const branchExists = await provider.branchExists(repo.repoFullName, targetBranch);
      if (!branchExists) {
        console.log(
          `[pr-actions] Target branch "${targetBranch}" not found on remote, falling back to "${repo.defaultBranch}"`,
        );
        resolvedTarget = repo.defaultBranch;
      }
    } catch {
      console.log(
        `[pr-actions] Could not verify target branch "${targetBranch}", falling back to "${repo.defaultBranch}"`,
      );
      resolvedTarget = repo.defaultBranch;
    }

    // Create draft PR on GitHub. If the head branch has no divergence from base,
    // GitHub returns 422 ("No commits between ..."), which should be a no-op.
    let ghPR;
    try {
      ghPR = await provider.createPullRequest(
        repo.repoFullName,
        headBranch,
        resolvedTarget,
        task.title,
        prBody,
        true, // draft
      );
    } catch (error) {
      if (isNoCommitsBetweenValidationError(error)) {
        console.log(
          `[pr-actions] Skipping draft PR for task ${args.taskId}: no commits between "${resolvedTarget}" and "${headBranch}"`,
        );
        return null;
      }
      throw error;
    }

    // Persist to Convex
    const prId = await ctx.runMutation(internal.sourceControl.tasks.prActions.storePR, {
      orgId: task.orgId,
      repositoryId: repo._id,
      taskId: args.taskId,
      prNumber: ghPR.number,
      title: ghPR.title,
      body: ghPR.body ?? undefined,
      sourceBranch: ghPR.sourceBranch,
      targetBranch: ghPR.targetBranch,
      authorLogin: ghPR.authorLogin,
      providerUrl: ghPR.providerUrl,
      isDraft: true,
      aiDescriptionEnabled: false,
    });

    // Backfill prId on any commits that were stored before the PR was created
    if (prId) {
      await ctx.runMutation(internal.sourceControl.sync.initialSync.linkCommitsToPR, {
        repositoryId: repo._id,
        prId,
        sourceBranch: headBranch,
      });
    }

    await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
      orgId: task.orgId,
      taskId: args.taskId,
      prId,
      eventType: "pr_created",
      actorLogin: ghPR.authorLogin,
      summary: `Draft PR #${ghPR.number} created: ${task.title}`,
      occurredAt: Date.now(),
    });

    return prId;
  },
});

// ---------------------------------------------------------------------------
// Public actions — client-callable
// ---------------------------------------------------------------------------

export const refreshFromGitHub = action({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const prs = await ctx.runQuery(internal.sourceControl.tasks.prTracking.getPRsByTask, {
      taskId: args.taskId,
    });

    if (prs.length === 0) return { synced: 0 };

    // Sync the most recent open PR (fall back to first)
    const pr = prs.find((p) => p.state === "open") ?? prs[0];

    const { repo, installation } = await ctx.runQuery(
      internal.sourceControl.mcp.queries.getRepoWithInstallation,
      { repositoryId: pr.repositoryId },
    );

    const provider = getProvider(repo.providerType);
    let token = await ctx.runQuery(internal.sourceControl.mcp.queries.getCachedToken, {
      installationId: installation.installationId,
    });

    if (!token) {
      const tokenResult = await provider.getInstallationToken(installation.installationId);
      token = tokenResult.token;
      await ctx.runMutation(internal.sourceControl.mcp.queries.upsertToken, {
        installationId: installation.installationId,
        token: tokenResult.token,
        expiresAt: tokenResult.expiresAt,
      });
    }
    (provider as GitHubProvider).setToken(token);

    const ghPR = await provider.getPullRequest(repo.repoFullName, pr.prNumber);

    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: pr._id,
      patch: {
        title: ghPR.title,
        body: ghPR.body ?? undefined,
        state: ghPR.state,
        isDraft: ghPR.isDraft,
        reviewState: ghPR.reviewState,
        ciStatus: ghPR.ciStatus,
        commitCount: ghPR.commitCount,
        filesChanged: ghPR.filesChanged,
        additions: ghPR.additions,
        deletions: ghPR.deletions,
        updatedAt: ghPR.updatedAt,
        mergedAt: ghPR.mergedAt ?? undefined,
      },
    });

    return { synced: 1 };
  },
});

export const fetchFileDiff = action({
  args: {
    prId: v.id("sourceControlPullRequests"),
    filePath: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    const files = await provider.getPullRequestFiles(repo.repoFullName, pr.prNumber);
    const file = files.find((f) => f.filename === args.filePath);

    if (!file) {
      throw new ConvexError(`File "${args.filePath}" not found in PR #${pr.prNumber}`);
    }

    // Return diff data without storing (lazy fetch pattern)
    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch ?? null,
    };
  },
});

export const triggerAIReview = action({
  args: {
    prId: v.id("sourceControlPullRequests"),
    requestedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return await ctx.runAction(
      api.sourceControl.reviews.migrationReviewActions.requestMigrationReview,
      {
        prId: args.prId,
        requestedBy: args.requestedBy,
        triggerMethod: "platform_button",
      },
    );
  },
});

export const resolveConflicts = action({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // Mark conflict state as unknown while resolution is queued
    // Future: launch sandbox session with conflict resolution prompt
    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: args.prId,
      patch: { conflictState: "unknown" },
    });

    console.log(`[pr-actions] Conflict resolution queued for PR ${args.prId}`);

    return { status: "queued", prId: args.prId };
  },
});

// ---------------------------------------------------------------------------
// internalRegenerateDescription — called from webhook context (no auth needed)
// ---------------------------------------------------------------------------

export const internalRegenerateDescription = internalAction({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    if (!pr.taskId) {
      console.log(`[pr-actions] PR ${args.prId} not linked to a task, skipping description regen`);
      return null;
    }

    const { task, requirement, program } = await ctx.runQuery(
      internal.sourceControl.tasks.prActions.getTaskWithContext,
      { taskId: pr.taskId },
    );

    const contextLines = [
      `Task: ${task.title}`,
      task.description ? `Description: ${task.description}` : "",
      requirement ? `Requirement: ${requirement.title}` : "",
      program
        ? `Program: ${program.name} (${program.sourcePlatform} → ${program.targetPlatform})`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content:
            `Write a concise pull request description for the following migration task. ` +
            `Be specific and actionable. Return only the description text, no preamble.\n\n${contextLines}`,
        },
      ],
    });

    const newDescription = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!newDescription) {
      console.error("[pr-actions] AI failed to generate a description");
      return null;
    }

    await provider.updatePullRequest(repo.repoFullName, pr.prNumber, {
      body: newDescription,
    });

    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: args.prId,
      patch: { body: newDescription, updatedAt: Date.now() },
    });

    await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
      orgId: pr.orgId,
      taskId: pr.taskId,
      prId: args.prId,
      eventType: "description_updated",
      actorLogin: "ai",
      summary: `PR #${pr.prNumber} description regenerated by AI`,
      occurredAt: Date.now(),
    });

    return { description: newDescription };
  },
});

export const regenerateDescription = action({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    if (!pr.taskId) {
      throw new ConvexError("PR must be linked to a task to regenerate description");
    }

    const { task, requirement, program } = await ctx.runQuery(
      internal.sourceControl.tasks.prActions.getTaskWithContext,
      { taskId: pr.taskId },
    );

    const contextLines = [
      `Task: ${task.title}`,
      task.description ? `Description: ${task.description}` : "",
      requirement ? `Requirement: ${requirement.title}` : "",
      program
        ? `Program: ${program.name} (${program.sourcePlatform} → ${program.targetPlatform})`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content:
            `Write a concise pull request description for the following migration task. ` +
            `Be specific and actionable. Return only the description text, no preamble.\n\n${contextLines}`,
        },
      ],
    });

    const newDescription = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!newDescription) {
      throw new ConvexError("AI failed to generate a description");
    }

    // Push updated description to GitHub
    await provider.updatePullRequest(repo.repoFullName, pr.prNumber, {
      body: newDescription,
    });

    await ctx.runMutation(internal.sourceControl.tasks.prActions.patchPR, {
      prId: args.prId,
      patch: { body: newDescription, updatedAt: Date.now() },
    });

    await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
      orgId: pr.orgId,
      taskId: pr.taskId,
      prId: args.prId,
      eventType: "description_updated",
      actorLogin: "ai",
      summary: `PR #${pr.prNumber} description regenerated by AI`,
      occurredAt: Date.now(),
    });

    return { description: newDescription };
  },
});

// ---------------------------------------------------------------------------
// listPRFiles — fetch all files changed in a PR from GitHub
// ---------------------------------------------------------------------------

export const listPRFiles = action({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    const files = await provider.getPullRequestFiles(repo.repoFullName, pr.prNumber);

    return files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch ?? null,
    }));
  },
});

// ---------------------------------------------------------------------------
// listBranchFiles — compare a task's branch against default branch (no PR needed)
// ---------------------------------------------------------------------------

export const listBranchFiles = action({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const { task, repo } = await ctx.runQuery(
      internal.sourceControl.tasks.prActions.getTaskWithContext,
      { taskId: args.taskId },
    );

    if (!repo) throw new ConvexError("No repository linked");

    // Determine the branch
    let branchName = task.worktreeBranch;
    if (!branchName) {
      branchName = await ctx.runQuery(internal.sandbox.sessions.getLatestBranchForTask, {
        taskId: args.taskId,
      });
    }
    if (!branchName) return [];

    // Get authenticated provider
    const { installation } = await ctx.runQuery(
      internal.sourceControl.mcp.queries.getRepoWithInstallation,
      { repositoryId: repo._id },
    );

    const provider = getProvider(repo.providerType);
    let token = await ctx.runQuery(internal.sourceControl.mcp.queries.getCachedToken, {
      installationId: installation.installationId,
    });
    if (!token) {
      const tokenResult = await provider.getInstallationToken(installation.installationId);
      token = tokenResult.token;
      await ctx.runMutation(internal.sourceControl.mcp.queries.upsertToken, {
        installationId: installation.installationId,
        token: tokenResult.token,
        expiresAt: tokenResult.expiresAt,
      });
    }
    (provider as GitHubProvider).setToken(token);

    // Compare branch against repo default branch
    const comparison = await provider.compareBranches(
      repo.repoFullName,
      repo.defaultBranch,
      branchName,
    );

    return comparison.files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: null as string | null,
    }));
  },
});

// ---------------------------------------------------------------------------
// getReviewerCandidates — merge GitHub collaborators with program team members
// ---------------------------------------------------------------------------

export const getReviewerCandidates = action({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const { provider, pr, repo } = await getAuthedProviderForPR(ctx, args.prId);

    // 1. GitHub collaborators for this repo
    const collaborators = await provider.getRepoCollaborators(repo.repoFullName);

    // 2. Program team members (Clerk users synced to Convex)
    let teamMembers: Array<{ name: string; email: string; role: string }> = [];
    if (pr.taskId) {
      const context = await ctx.runQuery(
        internal.sourceControl.tasks.prActions.getTaskWithContext,
        { taskId: pr.taskId },
      );
      if (context.program) {
        const members = await ctx.runQuery(
          internal.sourceControl.tasks.prActions.getProgramTeamMembers,
          { programId: context.program._id },
        );
        teamMembers = (members as any[]).map((m) => ({
          name: m.name,
          email: m.email,
          role: m.role,
        }));
      }
    }

    // 3. Return merged list — GitHub collaborators who can be assigned as reviewers
    return {
      githubCollaborators: collaborators
        .filter((c) => c.permissions.push || c.permissions.admin)
        .filter((c) => c.login !== pr.authorLogin) // exclude PR author
        .map((c) => ({ login: c.login, avatarUrl: c.avatarUrl })),
      teamMembers,
    };
  },
});

// ---------------------------------------------------------------------------
// syncBranchActivity — force-scan a task's branch for commits and create a
// draft PR if one doesn't exist. Called from the UI "Sync Branch" button.
// ---------------------------------------------------------------------------

export const syncBranchActivity = action({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const { task, repo } = await ctx.runQuery(
      internal.sourceControl.tasks.prActions.getTaskWithContext,
      { taskId: args.taskId },
    );

    if (!repo) {
      throw new ConvexError("No repository linked to this program");
    }

    // Determine the branch — check task field then sandbox sessions
    let branchName = task.worktreeBranch;
    if (!branchName) {
      branchName = await ctx.runQuery(internal.sandbox.sessions.getLatestBranchForTask, {
        taskId: args.taskId,
      });
    }

    if (!branchName) {
      return { status: "no_branch", synced: 0, message: "No branch found for this task" };
    }

    // Get authenticated provider
    const { installation } = await ctx.runQuery(
      internal.sourceControl.mcp.queries.getRepoWithInstallation,
      { repositoryId: repo._id },
    );

    const provider = getProvider(repo.providerType);
    let token = await ctx.runQuery(internal.sourceControl.mcp.queries.getCachedToken, {
      installationId: installation.installationId,
    });

    if (!token) {
      const tokenResult = await provider.getInstallationToken(installation.installationId);
      token = tokenResult.token;
      await ctx.runMutation(internal.sourceControl.mcp.queries.upsertToken, {
        installationId: installation.installationId,
        token: tokenResult.token,
        expiresAt: tokenResult.expiresAt,
      });
    }
    (provider as GitHubProvider).setToken(token);

    // Fetch commits from the branch. Local runtime branches may not exist on
    // GitHub until users push; treat that as a non-fatal sync result.
    let commits;
    try {
      commits = await provider.getCommitHistory(repo.repoFullName, {
        branch: branchName,
        limit: 100,
      });
    } catch (error) {
      if (isRemoteBranchMissingError(error)) {
        return {
          status: "branch_not_found",
          synced: 0,
          branch: branchName,
          message: `Branch "${branchName}" is not on GitHub yet. Push local commits, then sync again.`,
        };
      }
      throw error;
    }

    // Check if PR already exists for this branch
    const existingPRs = await ctx.runQuery(
      internal.sourceControl.tasks.prTracking.getPRsByRepoBranch,
      { repositoryId: repo._id, sourceBranch: branchName },
    );

    let prId: string | undefined;
    if (existingPRs.length > 0) {
      prId = existingPRs[0]._id;
    }

    // Store each commit
    let stored = 0;
    for (const commit of commits) {
      await ctx.runMutation(internal.sourceControl.sync.initialSync.storeCommit, {
        orgId: task.orgId,
        repositoryId: repo._id,
        sha: commit.sha,
        prId: prId as any,
        authorLogin: commit.authorLogin ?? "unknown",
        message: (commit.message ?? "").slice(0, 500),
        filesChanged: commit.filesChanged ?? 0,
        additions: commit.additions ?? 0,
        deletions: commit.deletions ?? 0,
        committedAt: commit.committedAt ?? Date.now(),
      });
      stored++;
    }

    // If no PR exists and we found commits, trigger draft PR creation
    if (!prId && commits.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.sourceControl.tasks.prActionsInternal.createDraftPR,
        { taskId: args.taskId },
      );
    }

    // If PR exists, also backfill any unlinked commits
    if (prId) {
      await ctx.runMutation(internal.sourceControl.sync.initialSync.linkCommitsToPR, {
        repositoryId: repo._id,
        prId: prId as any,
        sourceBranch: branchName,
      });
    }

    return {
      status: "synced",
      synced: stored,
      branch: branchName,
      prExists: !!prId,
      prScheduled: !prId && commits.length > 0,
    };
  },
});
