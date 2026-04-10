// @ts-nocheck
"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action, internalAction } from "../../_generated/server";
import { getProvider } from "../factory";
import type { GitHubProvider } from "../providers/github";

/**
 * Parent issue management actions — provider-calling layer.
 *
 * Creates/updates parent tracking issues per workstream/sprint with
 * GitHub task list syntax that renders as progress bars.
 */

// ---------------------------------------------------------------------------
// Helper: get authenticated provider
// ---------------------------------------------------------------------------

async function getAuthedProvider(ctx: any, repositoryId: string) {
  const { repo, installation } = await ctx.runQuery(
    internal.sourceControl.mcp.queries.getRepoWithInstallation,
    { repositoryId },
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
  return { provider, repo };
}

// ---------------------------------------------------------------------------
// createParentIssue — create a parent tracking issue for a sprint/workstream
// ---------------------------------------------------------------------------

export const createParentIssue = action({
  args: {
    workstreamId: v.id("workstreams"),
    sprintId: v.id("sprints"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    // 1. Load context
    const { workstream, sprint } = await ctx.runQuery(
      internal.sourceControl.tasks.dependencySync.getSprintWorkstreamContext,
      { workstreamId: args.workstreamId, sprintId: args.sprintId },
    );

    // 2. Check if parent issue already exists
    const existing = await ctx.runQuery(
      internal.sourceControl.tasks.dependencySync.getParentIssueRef,
      { workstreamId: args.workstreamId, sprintId: args.sprintId },
    );
    if (existing) {
      return {
        issueNumber: existing.issueNumber,
        issueUrl: existing.issueUrl,
        alreadyExisted: true,
      };
    }

    // 3. Get child issue mappings
    const childMappings = await ctx.runQuery(
      internal.sourceControl.tasks.dependencySync.getChildIssueMappings,
      {
        workstreamId: args.workstreamId,
        sprintId: args.sprintId,
        repositoryId: args.repositoryId,
      },
    );

    // 4. Get authenticated provider
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    // 5. Build title and task list body
    const title = `[${sprint.name}] ${workstream.name} Task Tracker`;
    const childIssueNumbers = childMappings.map((cm: any) => cm.mapping.issueNumber as number);

    // Create the parent issue with task list
    const issue = await provider.createTaskListIssue(repo.repoFullName, title, childIssueNumbers);

    // 6. Store the parent issue reference
    await ctx.runMutation(internal.sourceControl.tasks.dependencySync.storeParentIssueRef, {
      orgId: workstream.orgId,
      repositoryId: args.repositoryId,
      workstreamId: args.workstreamId,
      sprintId: args.sprintId,
      issueNumber: issue.number,
      issueUrl: issue.url,
    });

    return {
      issueNumber: issue.number,
      issueUrl: issue.url,
      alreadyExisted: false,
    };
  },
});

// ---------------------------------------------------------------------------
// updateParentIssueProgress — rebuild task list when child issues change
// ---------------------------------------------------------------------------

export const updateParentIssueProgress = internalAction({
  args: {
    workstreamId: v.id("workstreams"),
    sprintId: v.id("sprints"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    // 1. Get parent issue reference
    const parentRef = await ctx.runQuery(
      internal.sourceControl.tasks.dependencySync.getParentIssueRef,
      { workstreamId: args.workstreamId, sprintId: args.sprintId },
    );
    if (!parentRef) return;

    // 2. Get current child mappings with task statuses
    const childMappings = await ctx.runQuery(
      internal.sourceControl.tasks.dependencySync.getChildIssueMappings,
      {
        workstreamId: args.workstreamId,
        sprintId: args.sprintId,
        repositoryId: args.repositoryId,
      },
    );

    // 3. Rebuild task list body
    const taskListLines = childMappings.map((cm: any) => {
      const checked = cm.task.status === "done" ? "x" : " ";
      return `- [${checked}] #${cm.mapping.issueNumber} — ${cm.task.title}`;
    });

    const body = taskListLines.join("\n");

    // 4. Update the parent issue on GitHub
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    await provider.updateIssue(repo.repoFullName, parentRef.issueNumber, { body });
  },
});
