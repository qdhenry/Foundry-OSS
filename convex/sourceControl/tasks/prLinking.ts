// @ts-nocheck
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation, internalQuery, mutation, query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

/**
 * PR-to-task linking logic.
 *
 * Supports 5 linking methods: branch_name, body_reference,
 * commit_message, ai_inference, manual. AI-inferred links include
 * a confidence score (0-100).
 */

// ---------------------------------------------------------------------------
// linkPRToTask — manually link a PR to a task
// ---------------------------------------------------------------------------

export const linkPRToTask = mutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new Error("PR not found");
    await assertOrgAccess(ctx, pr.orgId);

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    // Verify same org
    if (pr.orgId !== task.orgId) {
      throw new Error("PR and task must belong to the same organization");
    }

    await ctx.db.patch(args.prId, {
      taskId: args.taskId,
      linkMethod: "manual",
      linkConfidence: 100,
    });
  },
});

// ---------------------------------------------------------------------------
// unlinkPR — remove a PR-to-task link
// ---------------------------------------------------------------------------

export const unlinkPR = mutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new Error("PR not found");
    await assertOrgAccess(ctx, pr.orgId);

    await ctx.db.patch(args.prId, {
      taskId: undefined,
      linkMethod: undefined,
      linkConfidence: undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// getPRsForTask — get all PRs linked to a task (public query)
// ---------------------------------------------------------------------------

export const getPRsForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    return await ctx.db
      .query("sourceControlPullRequests")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// getUnlinkedPRs — get PRs without task links for a program's repos
// ---------------------------------------------------------------------------

export const getUnlinkedPRs = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const repos = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const unlinked = [];
    for (const repo of repos) {
      const prs = await ctx.db
        .query("sourceControlPullRequests")
        .withIndex("by_repo", (q) => q.eq("repositoryId", repo._id).eq("state", "open"))
        .collect();

      for (const pr of prs) {
        if (!pr.taskId) {
          unlinked.push(pr);
        }
      }
    }

    return unlinked;
  },
});

// ---------------------------------------------------------------------------
// applyInferredLink — internal mutation to set inferred link on PR
// ---------------------------------------------------------------------------

export const applyInferredLink = internalMutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
    taskId: v.id("tasks"),
    linkMethod: v.union(
      v.literal("branch_name"),
      v.literal("body_reference"),
      v.literal("commit_message"),
      v.literal("ai_inference"),
    ),
    linkConfidence: v.number(),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) return;

    // Only auto-link if no existing link, or if this link has higher confidence
    if (pr.taskId && (pr.linkConfidence ?? 0) >= args.linkConfidence) {
      return;
    }

    await ctx.db.patch(args.prId, {
      taskId: args.taskId,
      linkMethod: args.linkMethod,
      linkConfidence: args.linkConfidence,
    });
  },
});

// ---------------------------------------------------------------------------
// tryDeterministicLink — attempt to link a PR using deterministic methods
// Called internally after PR creation/update
// ---------------------------------------------------------------------------

export const tryDeterministicLink = internalMutation({
  args: {
    prId: v.id("sourceControlPullRequests"),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr || pr.taskId) return; // Already linked

    // Get the repo to find the program
    const repo = await ctx.db.get(pr.repositoryId);
    if (!repo) return;

    // Get all tasks for the program
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", repo.programId))
      .collect();

    if (tasks.length === 0) return;

    // Method 1: Branch name parsing
    // Patterns: TASK-123-feature, task/123-feature, TASK_123, 123-feature
    const branchMatch = tryBranchNameMatch(pr.sourceBranch, tasks);
    if (branchMatch) {
      await ctx.db.patch(args.prId, {
        taskId: branchMatch.taskId,
        linkMethod: "branch_name",
        linkConfidence: 95,
      });
      return;
    }

    // Method 2: PR body reference
    // Patterns: "Closes TASK-123", "Fixes #123", "task:TASK-123", task URL
    if (pr.body) {
      const bodyMatch = tryBodyReferenceMatch(pr.body, tasks);
      if (bodyMatch) {
        await ctx.db.patch(args.prId, {
          taskId: bodyMatch.taskId,
          linkMethod: "body_reference",
          linkConfidence: 90,
        });
        return;
      }
    }

    // Method 3: Title reference
    // Patterns: "[TASK-123]", "TASK-123:", task title substring
    const titleMatch = tryTitleMatch(pr.title, tasks);
    if (titleMatch) {
      await ctx.db.patch(args.prId, {
        taskId: titleMatch.taskId,
        linkMethod: "body_reference",
        linkConfidence: 85,
      });
      return;
    }

    // If no deterministic match found, schedule AI inference
    await ctx.scheduler.runAfter(0, internal.sourceControl.tasks.prLinkingActions.inferTaskLink, {
      prId: args.prId,
      programId: repo.programId,
    });
  },
});

// ---------------------------------------------------------------------------
// getPRWithLinks — get a PR with its linked task info (internal)
// ---------------------------------------------------------------------------

export const getPRWithLinks = internalQuery({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) return null;

    let task = null;
    if (pr.taskId) {
      task = await ctx.db.get(pr.taskId);
    }

    return { ...pr, task };
  },
});

// ---------------------------------------------------------------------------
// Deterministic matching helpers (pure functions)
// ---------------------------------------------------------------------------

interface TaskRecord {
  _id: any;
  title: string;
  description?: string | null;
}

function tryBranchNameMatch(branchName: string, tasks: TaskRecord[]): { taskId: any } | null {
  const normalized = branchName.toLowerCase();

  for (const task of tasks) {
    const taskId = task._id.toString();
    const shortId = taskId.slice(-8); // Last 8 chars of Convex ID

    // Pattern: TASK-{id}, task/{id}, task_{id}
    if (
      normalized.includes(`task-${shortId}`) ||
      normalized.includes(`task/${shortId}`) ||
      normalized.includes(`task_${shortId}`)
    ) {
      return { taskId: task._id };
    }

    // Pattern: task title words in branch name (heuristic)
    const titleWords = task.title
      .toLowerCase()
      .split(/[\s\-_/]+/)
      .filter((w) => w.length > 3);
    if (titleWords.length >= 2) {
      const matchCount = titleWords.filter((w) => normalized.includes(w)).length;
      if (matchCount >= Math.ceil(titleWords.length * 0.6)) {
        return { taskId: task._id };
      }
    }
  }

  return null;
}

function tryBodyReferenceMatch(body: string, tasks: TaskRecord[]): { taskId: any } | null {
  const normalized = body.toLowerCase();

  for (const task of tasks) {
    const taskId = task._id.toString();
    const shortId = taskId.slice(-8);

    // Pattern: "Closes TASK-{id}", "Fixes TASK-{id}", "Resolves TASK-{id}"
    const closePatterns = [
      `closes task-${shortId}`,
      `fixes task-${shortId}`,
      `resolves task-${shortId}`,
      `task:${shortId}`,
      `task-${shortId}`,
    ];

    for (const pattern of closePatterns) {
      if (normalized.includes(pattern)) {
        return { taskId: task._id };
      }
    }

    // Pattern: Convex ID reference in body
    if (body.includes(taskId)) {
      return { taskId: task._id };
    }
  }

  return null;
}

function tryTitleMatch(title: string, tasks: TaskRecord[]): { taskId: any } | null {
  const normalized = title.toLowerCase();

  for (const task of tasks) {
    const taskId = task._id.toString();
    const shortId = taskId.slice(-8);

    // Pattern: "[TASK-{id}]", "TASK-{id}:"
    if (
      normalized.includes(`[task-${shortId}]`) ||
      normalized.includes(`task-${shortId}:`) ||
      normalized.includes(`task-${shortId} `)
    ) {
      return { taskId: task._id };
    }
  }

  return null;
}
