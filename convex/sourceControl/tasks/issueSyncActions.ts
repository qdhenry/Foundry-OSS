// @ts-nocheck
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { action, internalAction } from "../../_generated/server";
import { getProvider } from "../factory";
import type { GitHubProvider } from "../providers/github";

/**
 * Task-to-GitHub-Issue sync actions — provider-calling layer.
 *
 * These actions need "use node" because the GitHub provider uses node:crypto.
 * DB operations are delegated to internal queries/mutations in issueSync.ts.
 */

// ---------------------------------------------------------------------------
// Helper: get authenticated provider (same pattern as MCP tools)
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
// Label color palette
// ---------------------------------------------------------------------------

const LABEL_COLORS: Record<string, string> = {
  // Priority
  critical: "B60205",
  high: "D93F0B",
  medium: "FBCA04",
  low: "0E8A16",
  // Workstream (neutral blue spectrum)
  workstream: "1D76DB",
  // Requirement
  requirement: "5319E7",
  // Sprint
  sprint: "006B75",
  // Story points
  "story-points": "BFD4F2",
};

// ---------------------------------------------------------------------------
// syncTaskToGitHub — create a GitHub Issue from a platform task
// ---------------------------------------------------------------------------

export const syncTaskToGitHub = action({
  args: {
    taskId: v.id("tasks"),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    // 1. Load task context
    const context = await ctx.runQuery(internal.sourceControl.tasks.issueSync.getTaskSyncContext, {
      taskId: args.taskId,
    });

    const { task, program, requirement, workstream, sprint, blockedByTasks } = context;
    if (!program) throw new ConvexError("Program not found");

    // 2. Get authenticated provider
    const { provider, repo } = await getAuthedProvider(ctx, args.repositoryId);

    // 3. Ensure labels exist
    const labels: string[] = [];

    if (workstream) {
      const wsLabel = `ws:${workstream.shortCode}`;
      await provider.ensureLabel(
        repo.repoFullName,
        wsLabel,
        LABEL_COLORS.workstream,
        workstream.name,
      );
      labels.push(wsLabel);
    }

    // Priority label
    const priorityLabel = `priority:${task.priority}`;
    await provider.ensureLabel(
      repo.repoFullName,
      priorityLabel,
      LABEL_COLORS[task.priority] ?? LABEL_COLORS.medium,
    );
    labels.push(priorityLabel);

    // Requirement label
    if (requirement) {
      const reqLabel = `req:${requirement.refId}`;
      await provider.ensureLabel(
        repo.repoFullName,
        reqLabel,
        LABEL_COLORS.requirement,
        requirement.title,
      );
      labels.push(reqLabel);
    }

    // Sprint label
    if (sprint) {
      const sprintLabel = `sprint:${sprint.name}`;
      await provider.ensureLabel(
        repo.repoFullName,
        sprintLabel,
        LABEL_COLORS.sprint,
        `Sprint: ${sprint.name}`,
      );
      labels.push(sprintLabel);
    }

    // 4. Build issue body
    const body = buildIssueBody({
      task,
      requirement,
      workstream,
      sprint,
      program,
      blockedByTasks,
    });

    // 5. Create GitHub Issue
    const issue = await provider.createIssue(repo.repoFullName, {
      title: task.title,
      body,
      labels,
    });

    // 6. Store mapping
    await ctx.runMutation(internal.sourceControl.tasks.issueSync.storeIssueMapping, {
      orgId: task.orgId,
      taskId: args.taskId,
      repositoryId: args.repositoryId,
      issueNumber: issue.number,
      issueUrl: issue.url,
    });

    return { issueNumber: issue.number, issueUrl: issue.url };
  },
});

// ---------------------------------------------------------------------------
// syncTaskBodyToGitHub — push platform task description changes to GitHub
// ---------------------------------------------------------------------------

export const syncTaskBodyToGitHub = internalAction({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.runQuery(
      internal.sourceControl.tasks.issueSync.getIssueMappingByTask,
      { taskId: args.taskId },
    );
    if (!mapping) return;

    const context = await ctx.runQuery(internal.sourceControl.tasks.issueSync.getTaskSyncContext, {
      taskId: args.taskId,
    });

    const { provider, repo } = await getAuthedProvider(ctx, mapping.repositoryId);

    // Rebuild the full body with current task data
    const body = buildIssueBody({
      task: context.task,
      requirement: context.requirement,
      workstream: context.workstream,
      sprint: context.sprint,
      program: context.program,
      blockedByTasks: context.blockedByTasks,
    });

    await provider.updateIssue(repo.repoFullName, mapping.issueNumber, {
      body,
    });

    await ctx.runMutation(internal.sourceControl.tasks.issueSync.markMappingSynced, {
      taskId: args.taskId,
      syncStatus: "synced",
    });
  },
});

// ---------------------------------------------------------------------------
// resolveConflict — platform wins: revert GitHub body + post notification
// ---------------------------------------------------------------------------

export const resolveConflict = internalAction({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.runQuery(
      internal.sourceControl.tasks.issueSync.getIssueMappingByTask,
      { taskId: args.taskId },
    );
    if (!mapping || mapping.syncStatus !== "conflict") return;

    const context = await ctx.runQuery(internal.sourceControl.tasks.issueSync.getTaskSyncContext, {
      taskId: args.taskId,
    });

    const { provider, repo } = await getAuthedProvider(ctx, mapping.repositoryId);

    // Rebuild body from platform source of truth
    const body = buildIssueBody({
      task: context.task,
      requirement: context.requirement,
      workstream: context.workstream,
      sprint: context.sprint,
      program: context.program,
      blockedByTasks: context.blockedByTasks,
    });

    // Overwrite GitHub body with platform version
    await provider.updateIssue(repo.repoFullName, mapping.issueNumber, {
      body,
    });

    // Post conflict notification comment on the GitHub issue
    try {
      const [owner, repoName] = repo.repoFullName.split("/");
      const commentUrl = `https://api.github.com/repos/${owner}/${repoName}/issues/${mapping.issueNumber}/comments`;
      const res = await fetch(commentUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${(provider as GitHubProvider).getToken()}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: "⚠️ **Sync conflict detected** — the platform version of this issue has been preserved. A concurrent edit was made on GitHub within the sync window. Please verify the current state matches your intent.",
        }),
      });
      if (!res.ok) {
        console.log(
          `[issue-sync] Failed to post conflict comment on #${mapping.issueNumber}: ${res.status}`,
        );
      }
    } catch (error) {
      // Non-critical — the body overwrite is the primary resolution mechanism
      console.log(
        `[issue-sync] Could not post conflict comment: ${error instanceof Error ? error.message : error}`,
      );
    }

    await ctx.runMutation(internal.sourceControl.tasks.issueSync.markMappingSynced, {
      taskId: args.taskId,
      syncStatus: "synced",
    });
  },
});

// ---------------------------------------------------------------------------
// updateSprintLabel — move sprint label when task changes sprints
// ---------------------------------------------------------------------------

export const updateSprintLabel = internalAction({
  args: {
    taskId: v.id("tasks"),
    oldSprintName: v.optional(v.string()),
    newSprintName: v.string(),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.runQuery(
      internal.sourceControl.tasks.issueSync.getIssueMappingByTask,
      { taskId: args.taskId },
    );
    if (!mapping) return;

    const { provider, repo } = await getAuthedProvider(ctx, mapping.repositoryId);

    // Get current issue to read labels
    const issue = await provider.getIssue(repo.repoFullName, mapping.issueNumber);

    // Remove old sprint label, add new one
    const labels = issue.labels.filter((l) => !l.startsWith("sprint:"));

    const newLabel = `sprint:${args.newSprintName}`;
    await provider.ensureLabel(
      repo.repoFullName,
      newLabel,
      LABEL_COLORS.sprint,
      `Sprint: ${args.newSprintName}`,
    );
    labels.push(newLabel);

    await provider.updateIssue(repo.repoFullName, mapping.issueNumber, {
      labels,
    });
  },
});

// ---------------------------------------------------------------------------
// Issue body template builder
// ---------------------------------------------------------------------------

function buildIssueBody(ctx: {
  task: any;
  requirement: any;
  workstream: any;
  sprint: any;
  program: any;
  blockedByTasks: Array<{
    _id: string;
    title: string;
    status: string;
    issueNumber: number | null;
  }>;
}): string {
  const { task, requirement, workstream, sprint, program, blockedByTasks } = ctx;

  const sections: string[] = [];

  // Header
  sections.push(
    `> Auto-generated by Migration Platform — [${program.name}](# "Migration Program")`,
  );
  sections.push("");

  // Task description
  if (task.description) {
    sections.push("## Description");
    sections.push(task.description);
    sections.push("");
  }

  // Requirement context
  if (requirement) {
    sections.push("## Requirement Context");
    sections.push(`**Ref:** ${requirement.refId}`);
    sections.push(`**Title:** ${requirement.title}`);
    if (requirement.description) {
      sections.push(`**Description:** ${requirement.description}`);
    }
    sections.push(`**Fit/Gap:** ${requirement.fitGap}`);
    sections.push(`**Priority:** ${requirement.priority}`);
    sections.push("");
  }

  // Migration context
  sections.push("## Migration Context");
  sections.push(`**Corridor:** ${program.sourcePlatform} → ${program.targetPlatform}`);
  if (workstream) {
    sections.push(`**Workstream:** ${workstream.name} (${workstream.shortCode})`);
  }
  if (sprint) {
    sections.push(`**Sprint:** ${sprint.name}`);
  }
  sections.push(`**Priority:** ${task.priority}`);
  sections.push("");

  // Dependencies
  if (blockedByTasks.length > 0) {
    sections.push("## Dependencies");
    sections.push("This task is blocked by the following tasks:");
    for (const dep of blockedByTasks) {
      const ref = dep.issueNumber ? `#${dep.issueNumber}` : dep.title;
      const status = dep.status === "done" ? " ✅" : "";
      sections.push(`- ${ref} — ${dep.title}${status}`);
    }
    sections.push("");
  }

  // Footer
  sections.push("---");
  sections.push(`*Managed by Migration Platform. Edits sync bi-directionally.*`);

  return sections.join("\n");
}
