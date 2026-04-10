import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// 1. storeSubtaskGeneration — internalMutation (stores AI results)
// ---------------------------------------------------------------------------
export const storeSubtaskGeneration = internalMutation({
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
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    // Bulk insert subtasks
    await ctx.runMutation(internalApi.subtasks.bulkCreate, {
      taskId: args.taskId,
      subtasks: args.subtasks,
    });

    // Update generation status
    await ctx.db.patch(args.taskId, { subtaskGenerationStatus: "completed" });
  },
});

// ---------------------------------------------------------------------------
// 2. markSubtaskGenerationError — internalMutation
// ---------------------------------------------------------------------------
export const markSubtaskGenerationError = internalMutation({
  args: {
    taskId: v.id("tasks"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      subtaskGenerationStatus: "error",
      subtaskGenerationError: args.error,
    });
  },
});

// ---------------------------------------------------------------------------
// 2b. updateProgress — internalMutation (streaming progress updates)
// ---------------------------------------------------------------------------
export const updateProgress = internalMutation({
  args: { taskId: v.id("tasks"), progress: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { subtaskGenerationProgress: args.progress });
  },
});

// ---------------------------------------------------------------------------
// 2c. insertOneSubtask — internalMutation (streaming: insert single subtask)
// ---------------------------------------------------------------------------
export const insertOneSubtask = internalMutation({
  args: {
    taskId: v.id("tasks"),
    subtask: v.object({
      title: v.string(),
      description: v.string(),
      prompt: v.string(),
      estimatedFiles: v.number(),
      complexityScore: v.number(),
      estimatedDurationMs: v.number(),
      allowedFiles: v.optional(v.array(v.string())),
      isPausePoint: v.boolean(),
    }),
    order: v.number(),
    isFirst: v.boolean(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    // If this is the first subtask of a generation, delete existing subtasks
    if (args.isFirst) {
      const existing = await ctx.db
        .query("subtasks")
        .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
        .collect();
      for (const sub of existing) {
        await ctx.db.delete(sub._id);
      }
    }

    await ctx.db.insert("subtasks", {
      orgId: task.orgId,
      taskId: args.taskId,
      programId: task.programId,
      ...args.subtask,
      order: args.order,
      status: "pending",
      retryCount: 0,
    });

    // Update parent task counts
    const currentCount = args.isFirst ? 1 : (task.subtaskCount ?? 0) + 1;
    await ctx.db.patch(args.taskId, {
      hasSubtasks: true,
      subtaskCount: currentCount,
      subtasksCompleted: 0,
      subtasksFailed: 0,
      subtaskGenerationProgress: `Generated ${currentCount} subtask${currentCount !== 1 ? "s" : ""}...`,
    });
  },
});

// ---------------------------------------------------------------------------
// 2d. finalizeGeneration — internalMutation (mark streaming generation complete)
// ---------------------------------------------------------------------------
export const finalizeGeneration = internalMutation({
  args: {
    taskId: v.id("tasks"),
    totalSubtasks: v.number(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      subtaskGenerationStatus: "completed",
      subtaskGenerationProgress: undefined,
      subtaskCount: args.totalSubtasks,
      subtasksCompleted: 0,
      subtasksFailed: 0,
    });
  },
});

// ---------------------------------------------------------------------------
// 3. getGenerationStatus — query (reactive)
// ---------------------------------------------------------------------------
export const getGenerationStatus = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);
    return {
      status: task.subtaskGenerationStatus ?? "idle",
      error: task.subtaskGenerationError,
      progress: task.subtaskGenerationProgress,
    };
  },
});

// ---------------------------------------------------------------------------
// 4. requestSubtaskGeneration — public mutation (trigger)
// ---------------------------------------------------------------------------
export const requestSubtaskGeneration = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    // Prevent duplicate processing
    if (task.subtaskGenerationStatus === "processing") {
      throw new ConvexError("Subtask generation already in progress");
    }

    // Mark task as generating
    await ctx.db.patch(args.taskId, {
      subtaskGenerationStatus: "processing",
      subtaskGenerationError: undefined,
    });

    await logAuditEvent(ctx, {
      orgId: task.orgId,
      programId: task.programId as string,
      entityType: "task",
      entityId: args.taskId as string,
      action: "create",
      description: `Requested AI subtask generation for "${task.title}"`,
    });

    // Schedule the AI action
    await ctx.scheduler.runAfter(0, internalApi.subtaskGenerationActions.generateSubtasks, {
      orgId: task.orgId,
      taskId: args.taskId,
      programId: task.programId,
    });
  },
});
