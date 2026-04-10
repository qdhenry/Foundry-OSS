import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const subtaskStatusValidator = v.union(
  v.literal("pending"),
  v.literal("executing"),
  v.literal("retrying"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("skipped"),
);

// ── Queries ──────────────────────────────────────────────────────────

/** List all subtasks for a given task, ordered by insertion. */
export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    return await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

/** Retrieve a single subtask by ID. */
export const get = query({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new ConvexError("Subtask not found");
    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new ConvexError("Parent task not found");
    await assertOrgAccess(ctx, task.orgId);
    return subtask;
  },
});

// ── Internal Queries (for orchestrator use) ──────────────────────────

export const getInternal = internalQuery({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.subtaskId);
  },
});

export const listByTaskInternal = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

// ── Mutations ────────────────────────────────────────────────────────

/**
 * Create a new subtask under a parent task. Automatically determines order
 * and updates the parent task's subtask count.
 * @param taskId - Parent task
 * @param title - Subtask title
 */
export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.string(),
    description: v.optional(v.string()),
    prompt: v.optional(v.string()),
    estimatedFiles: v.optional(v.number()),
    complexityScore: v.optional(v.number()),
    estimatedDurationMs: v.optional(v.number()),
    allowedFiles: v.optional(v.array(v.string())),
    isPausePoint: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    // Determine next order
    const existing = await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    const nextOrder = existing.length;

    const subtaskId = await ctx.db.insert("subtasks", {
      orgId: task.orgId,
      taskId: args.taskId,
      programId: task.programId,
      title: args.title,
      description: args.description ?? "",
      prompt: args.prompt ?? "",
      estimatedFiles: args.estimatedFiles ?? 1,
      complexityScore: args.complexityScore ?? 1,
      estimatedDurationMs: args.estimatedDurationMs ?? 180000,
      allowedFiles: args.allowedFiles,
      order: nextOrder,
      isPausePoint: args.isPausePoint ?? false,
      status: "pending",
      retryCount: 0,
    });

    // Update parent task
    await ctx.db.patch(args.taskId, {
      hasSubtasks: true,
      subtaskCount: nextOrder + 1,
    });

    await logAuditEvent(ctx, {
      orgId: task.orgId,
      programId: task.programId as string,
      entityType: "subtask",
      entityId: subtaskId as string,
      action: "create",
      description: `Created subtask "${args.title}" for task "${task.title}"`,
    });

    return subtaskId;
  },
});

/**
 * Update subtask fields (title, description, prompt, complexity, etc.).
 * @param subtaskId - The subtask to update
 */
export const update = mutation({
  args: {
    subtaskId: v.id("subtasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    prompt: v.optional(v.string()),
    estimatedFiles: v.optional(v.number()),
    complexityScore: v.optional(v.number()),
    estimatedDurationMs: v.optional(v.number()),
    allowedFiles: v.optional(v.array(v.string())),
    isPausePoint: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new ConvexError("Subtask not found");
    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new ConvexError("Parent task not found");
    await assertOrgAccess(ctx, task.orgId);

    const { subtaskId: _, ...updates } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.subtaskId, patch);
    }
  },
});

/**
 * Transition a subtask to a new status. Rolls up counts to the parent task.
 * @param subtaskId - The subtask to update
 * @param status - New status (pending, executing, retrying, completed, failed, skipped)
 */
export const updateStatus = mutation({
  args: {
    subtaskId: v.id("subtasks"),
    status: subtaskStatusValidator,
  },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new ConvexError("Subtask not found");
    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new ConvexError("Parent task not found");
    await assertOrgAccess(ctx, task.orgId);

    await ctx.db.patch(args.subtaskId, { status: args.status });

    // Rollup counts to parent
    await rollupCounts(ctx, subtask.taskId);
  },
});

/**
 * Reorder subtasks within a task by providing the new ID sequence.
 * @param taskId - Parent task
 * @param subtaskIds - Ordered array of subtask IDs
 */
export const reorder = mutation({
  args: {
    taskId: v.id("tasks"),
    subtaskIds: v.array(v.id("subtasks")),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    for (let i = 0; i < args.subtaskIds.length; i++) {
      await ctx.db.patch(args.subtaskIds[i], { order: i });
    }
  },
});

/**
 * Delete a subtask and recompute the parent task's subtask count.
 * @param subtaskId - The subtask to delete
 */
export const remove = mutation({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new ConvexError("Subtask not found");
    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new ConvexError("Parent task not found");
    await assertOrgAccess(ctx, task.orgId);

    await ctx.db.delete(args.subtaskId);

    // Reorder remaining subtasks
    const remaining = await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", subtask.taskId))
      .collect();

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i) {
        await ctx.db.patch(remaining[i]._id, { order: i });
      }
    }

    // Update parent task counts
    const hasSubtasks = remaining.length > 0;
    await ctx.db.patch(subtask.taskId, {
      hasSubtasks,
      subtaskCount: remaining.length,
      subtasksCompleted: remaining.filter((s) => s.status === "completed").length,
      subtasksFailed: remaining.filter((s) => s.status === "failed").length,
    });

    await logAuditEvent(ctx, {
      orgId: task.orgId,
      programId: task.programId as string,
      entityType: "subtask",
      entityId: args.subtaskId as string,
      action: "delete",
      description: `Deleted subtask "${subtask.title}" from task "${task.title}"`,
    });
  },
});

// ── Internal Mutations ───────────────────────────────────────────────

export const bulkCreate = internalMutation({
  args: {
    taskId: v.id("tasks"),
    subtasks: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        prompt: v.string(),
        estimatedFiles: v.number(),
        complexityScore: v.number(),
        estimatedDurationMs: v.number(),
        allowedFiles: v.optional(v.array(v.string())),
        isPausePoint: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    // Delete any existing subtasks for this task (regeneration case)
    const existing = await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    for (const sub of existing) {
      await ctx.db.delete(sub._id);
    }

    // Insert new subtasks
    for (let i = 0; i < args.subtasks.length; i++) {
      const s = args.subtasks[i];
      await ctx.db.insert("subtasks", {
        orgId: task.orgId,
        taskId: args.taskId,
        programId: task.programId,
        title: s.title,
        description: s.description,
        prompt: s.prompt,
        estimatedFiles: s.estimatedFiles,
        complexityScore: s.complexityScore,
        estimatedDurationMs: s.estimatedDurationMs,
        allowedFiles: s.allowedFiles,
        order: i,
        isPausePoint: s.isPausePoint,
        status: "pending",
        retryCount: 0,
      });
    }

    // Update parent task
    await ctx.db.patch(args.taskId, {
      hasSubtasks: true,
      subtaskCount: args.subtasks.length,
      subtasksCompleted: 0,
      subtasksFailed: 0,
      lastSubtaskActivity: `Generated ${args.subtasks.length} subtasks`,
    });
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    subtaskId: v.id("subtasks"),
    status: subtaskStatusValidator,
    commitSha: v.optional(v.string()),
    filesChanged: v.optional(v.array(v.string())),
    executionDurationMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    scopeViolations: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) return;

    const patch: Record<string, unknown> = { status: args.status };
    if (args.commitSha !== undefined) patch.commitSha = args.commitSha;
    if (args.filesChanged !== undefined) patch.filesChanged = args.filesChanged;
    if (args.executionDurationMs !== undefined)
      patch.executionDurationMs = args.executionDurationMs;
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.scopeViolations !== undefined) patch.scopeViolations = args.scopeViolations;

    // Increment retryCount when moving to retrying
    if (args.status === "retrying") {
      patch.retryCount = subtask.retryCount + 1;
    }
    // Reset retry count when manually set back to pending
    if (args.status === "pending") {
      patch.retryCount = 0;
    }

    await ctx.db.patch(args.subtaskId, patch);
  },
});

export const markSubtasksSkipped = internalMutation({
  args: {
    taskId: v.id("tasks"),
    excludeIds: v.array(v.id("subtasks")),
  },
  handler: async (ctx, args) => {
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    for (const sub of subtasks) {
      if (sub.status === "pending" && !args.excludeIds.includes(sub._id)) {
        await ctx.db.patch(sub._id, { status: "skipped" });
      }
    }
  },
});

export const rollupToParentTask = internalMutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await rollupCounts(ctx, args.taskId);
  },
});

// ── Helpers ──────────────────────────────────────────────────────────

async function rollupCounts(ctx: any, taskId: any) {
  const subtasks = await ctx.db
    .query("subtasks")
    .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
    .collect();

  const completed = subtasks.filter((s: any) => s.status === "completed").length;
  const failed = subtasks.filter((s: any) => s.status === "failed").length;

  await ctx.db.patch(taskId, {
    hasSubtasks: subtasks.length > 0,
    subtaskCount: subtasks.length,
    subtasksCompleted: completed,
    subtasksFailed: failed,
    lastSubtaskActivity: `${completed}/${subtasks.length} completed${failed > 0 ? `, ${failed} failed` : ""}`,
  });
}
