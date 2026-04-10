import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * Bi-directional task-to-GitHub-Issue synchronization — DB layer.
 *
 * Platform → GitHub sync logic lives in issueSyncActions.ts ("use node").
 * GitHub → Platform sync is handled here via internal mutations called
 * from the webhook processor.
 */

const CONFLICT_WINDOW_MS = 60 * 1000; // 60 seconds

// ---------------------------------------------------------------------------
// Internal queries — data loading for sync operations
// ---------------------------------------------------------------------------

export const getTaskSyncContext = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");

    const program = await ctx.db.get(task.programId);

    let requirement = null;
    if (task.requirementId) {
      requirement = await ctx.db.get(task.requirementId);
    }

    let workstream = null;
    if (task.workstreamId) {
      workstream = await ctx.db.get(task.workstreamId);
    }

    let sprint = null;
    if (task.sprintId) {
      sprint = await ctx.db.get(task.sprintId);
    }

    // Load dependency task titles for the issue body
    const blockedByTasks = [];
    if (task.blockedBy && task.blockedBy.length > 0) {
      for (const depId of task.blockedBy) {
        const dep = await ctx.db.get(depId);
        if (dep) {
          // Check if dep has a GitHub issue mapping
          const depMapping = await ctx.db
            .query("sourceControlIssueMappings")
            .withIndex("by_task", (q) => q.eq("taskId", depId))
            .first();
          blockedByTasks.push({
            _id: dep._id,
            title: dep.title,
            status: dep.status,
            issueNumber: depMapping?.issueNumber ?? null,
          });
        }
      }
    }

    return { task, program, requirement, workstream, sprint, blockedByTasks };
  },
});

export const getIssueMappingByIssue = internalQuery({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    issueNumber: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sourceControlIssueMappings")
      .withIndex("by_issue", (q) =>
        q.eq("repositoryId", args.repositoryId).eq("issueNumber", args.issueNumber),
      )
      .unique();
  },
});

export const getIssueMappingByTask = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sourceControlIssueMappings")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .first();
  },
});

export const getRepoByFullName = internalQuery({
  args: { repoFullName: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
  },
});

// ---------------------------------------------------------------------------
// storeIssueMapping — create the task↔issue mapping after GitHub issue creation
// ---------------------------------------------------------------------------

export const storeIssueMapping = internalMutation({
  args: {
    orgId: v.string(),
    taskId: v.id("tasks"),
    repositoryId: v.id("sourceControlRepositories"),
    issueNumber: v.number(),
    issueUrl: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("sourceControlIssueMappings", {
      orgId: args.orgId,
      taskId: args.taskId,
      repositoryId: args.repositoryId,
      issueNumber: args.issueNumber,
      issueUrl: args.issueUrl,
      syncStatus: "synced",
      lastSyncedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// updateTaskFromIssueEvent — GitHub → Platform sync (called by webhook processor)
// ---------------------------------------------------------------------------

export const updateTaskFromIssueEvent = internalMutation({
  args: {
    repoFullName: v.string(),
    issueNumber: v.number(),
    action: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    // Find the repo binding
    const repo = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
    if (!repo) return;

    // Find the issue mapping
    const mapping = await ctx.db
      .query("sourceControlIssueMappings")
      .withIndex("by_issue", (q) =>
        q.eq("repositoryId", repo._id).eq("issueNumber", args.issueNumber),
      )
      .unique();
    if (!mapping) return; // Not a platform-tracked issue

    const task = await ctx.db.get(mapping.taskId);
    if (!task) return;

    const p = args.payload;

    switch (args.action) {
      case "closed": {
        await ctx.db.patch(task._id, { status: "done" });

        // Check if dependencies are met
        if (task.blockedBy && task.blockedBy.length > 0) {
          const unmetDeps = [];
          for (const depId of task.blockedBy) {
            const dep = await ctx.db.get(depId);
            if (dep && dep.status !== "done") {
              unmetDeps.push(dep);
            }
          }

          if (unmetDeps.length > 0) {
            // Auto-generate risk entry
            const depNames = unmetDeps.map((d) => d.title).join(", ");
            await ctx.db.insert("risks", {
              orgId: task.orgId,
              programId: task.programId,
              title: `Dependency bypass: ${task.title}`,
              description: `Task "${task.title}" was completed before dependencies were met: ${depNames}. This may indicate out-of-order delivery.`,
              severity: "medium",
              probability: "likely",
              mitigation: "Review the completion order and verify no integration issues exist.",
              status: "open",
            });
          }
        }

        await ctx.db.patch(mapping._id, {
          syncStatus: "synced",
          lastSyncedAt: Date.now(),
        });
        break;
      }

      case "reopened": {
        await ctx.db.patch(task._id, { status: "in_progress" });
        await ctx.db.patch(mapping._id, {
          syncStatus: "synced",
          lastSyncedAt: Date.now(),
        });
        break;
      }

      case "assigned": {
        const assigneeLogin: string | null = p.assignee?.login ?? null;
        if (assigneeLogin) {
          // Try to find the platform user by matching GitHub login
          // For V1, GitHub login matching is best-effort
          const users = await ctx.db.query("users").collect();
          const matched = users.find(
            (u) =>
              u.name.toLowerCase() === assigneeLogin.toLowerCase() ||
              u.email.toLowerCase().startsWith(assigneeLogin.toLowerCase()),
          );
          if (matched) {
            await ctx.db.patch(task._id, { assigneeId: matched._id });
          }
        }
        await ctx.db.patch(mapping._id, {
          syncStatus: "synced",
          lastSyncedAt: Date.now(),
        });
        break;
      }

      case "labeled": {
        const labelName: string = p.label?.name ?? "";
        if (labelName.toLowerCase() === "blocked") {
          // Note: task schema doesn't have a "blocked" status
          // but the spec says to set it. For now, keep in_progress
          // and create a risk entry.
          await ctx.db.insert("risks", {
            orgId: task.orgId,
            programId: task.programId,
            title: `Task blocked: ${task.title}`,
            description: `Task "${task.title}" was labeled as blocked in GitHub.`,
            severity: "medium",
            probability: "very_likely",
            status: "open",
          });
          await ctx.db.patch(mapping._id, {
            syncStatus: "synced",
            lastSyncedAt: Date.now(),
          });
        }
        break;
      }

      case "edited": {
        const changes = p.changes ?? {};
        if (changes.body) {
          const newBody: string = p.issue?.body ?? "";
          const now = Date.now();

          // Conflict detection: if platform also edited within 60s, platform wins
          const lastPlatformEdit = mapping.lastSyncedAt ?? 0;
          const isConflict = now - lastPlatformEdit < CONFLICT_WINDOW_MS;

          if (isConflict) {
            // Platform wins — mark conflict, don't update task
            await ctx.db.patch(mapping._id, {
              syncStatus: "conflict",
              lastExternalEditAt: now,
            });
            // The action layer will handle posting a conflict comment to GitHub
            // and reverting the GitHub body to the platform version
          } else {
            // No conflict — sync body to platform task
            await ctx.db.patch(task._id, { description: newBody });
            await ctx.db.patch(mapping._id, {
              syncStatus: "synced",
              lastSyncedAt: now,
              lastExternalEditAt: now,
            });
          }
        }
        break;
      }

      default:
        // No-op for unhandled actions
        break;
    }
  },
});

// ---------------------------------------------------------------------------
// handleIssueComment — check for /migration-review command
// ---------------------------------------------------------------------------

export const handleIssueComment = internalMutation({
  args: {
    repoFullName: v.string(),
    issueNumber: v.number(),
    commentBody: v.string(),
    commentAuthor: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for /migration-review command
    if (!args.commentBody.trim().startsWith("/migration-review")) {
      return { shouldTriggerReview: false };
    }

    // Find the repo and issue mapping
    const repo = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
    if (!repo) return { shouldTriggerReview: false };

    const mapping = await ctx.db
      .query("sourceControlIssueMappings")
      .withIndex("by_issue", (q) =>
        q.eq("repositoryId", repo._id).eq("issueNumber", args.issueNumber),
      )
      .unique();
    if (!mapping) return { shouldTriggerReview: false };

    // Find linked PR for this task
    const pr = await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", mapping.taskId))
      .first();

    return {
      shouldTriggerReview: true,
      taskId: mapping.taskId,
      prId: pr?._id ?? null,
      repositoryId: repo._id,
    };
  },
});

// ---------------------------------------------------------------------------
// markMappingSynced — update sync status after platform→GitHub push
// ---------------------------------------------------------------------------

export const markMappingSynced = internalMutation({
  args: {
    taskId: v.id("tasks"),
    syncStatus: v.union(
      v.literal("synced"),
      v.literal("pending"),
      v.literal("conflict"),
      v.literal("error"),
    ),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query("sourceControlIssueMappings")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .first();
    if (!mapping) return;

    await ctx.db.patch(mapping._id, {
      syncStatus: args.syncStatus,
      lastSyncedAt: Date.now(),
    });
  },
});
