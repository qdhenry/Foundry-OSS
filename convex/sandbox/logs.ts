import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

export const sandboxLogLevelValidator = v.union(
  v.literal("info"),
  v.literal("stdout"),
  v.literal("stderr"),
  v.literal("system"),
  v.literal("error"),
);

const logEntryValidator = v.object({
  timestamp: v.optional(v.number()),
  level: sandboxLogLevelValidator,
  message: v.string(),
  metadata: v.optional(v.any()),
});

async function appendEntries(
  db: any,
  args: {
    orgId: string;
    sessionId: string;
    taskId?: string;
    entries: Array<{
      timestamp?: number;
      level: "info" | "stdout" | "stderr" | "system" | "error";
      message: string;
      metadata?: any;
    }>;
  },
) {
  for (const entry of args.entries) {
    await db.insert("sandboxLogs", {
      orgId: args.orgId,
      sessionId: args.sessionId,
      taskId: args.taskId,
      timestamp: entry.timestamp ?? Date.now(),
      level: entry.level,
      message: entry.message,
      metadata: entry.metadata,
    });
  }
}

/** List sandbox logs for a session in chronological order, with optional pagination. */
export const listBySession = query({
  args: {
    sessionId: v.id("sandboxSessions"),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    await assertOrgAccess(ctx, session.orgId);

    const queryBuilder = db
      .query("sandboxLogs")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .order("asc");

    if (args.paginationOpts) {
      return await queryBuilder.paginate(args.paginationOpts);
    }

    return await queryBuilder.collect();
  },
});

export const append = internalMutation({
  args: {
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    taskId: v.optional(v.id("tasks")),
    timestamp: v.optional(v.number()),
    level: sandboxLogLevelValidator,
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    if (session.orgId !== args.orgId) {
      throw new ConvexError("Sandbox session does not belong to the provided organization");
    }

    return await db.insert("sandboxLogs", {
      orgId: args.orgId,
      sessionId: args.sessionId,
      taskId: args.taskId,
      timestamp: args.timestamp ?? Date.now(),
      level: args.level,
      message: args.message,
      metadata: args.metadata,
    });
  },
});

export const appendFromHook = internalMutation({
  args: {
    sessionId: v.string(),
    hookEventType: v.string(),
    toolName: v.optional(v.string()),
    message: v.string(),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    // Look up session by sandboxId (sessionId from hooks is actually the sandboxId string)
    const sessions = await db
      .query("sandboxSessions")
      .filter((q: any) => q.eq(q.field("sandboxId"), args.sessionId))
      .collect();
    const session = sessions[0];
    if (!session) return;

    await db.insert("sandboxLogs", {
      orgId: session.orgId,
      sessionId: session._id,
      taskId: session.taskId,
      timestamp: args.timestamp,
      level: "system" as const,
      message: args.message,
      metadata: {
        source: "hook",
        hookEventType: args.hookEventType,
        ...(args.toolName ? { toolName: args.toolName } : {}),
        ...(args.metadata ? { payload: args.metadata } : {}),
      },
    });
  },
});

export const appendBatch = internalMutation({
  args: {
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    taskId: v.optional(v.id("tasks")),
    entries: v.array(logEntryValidator),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    if (session.orgId !== args.orgId) {
      throw new ConvexError("Sandbox session does not belong to the provided organization");
    }

    await appendEntries(db, args as any);

    return { inserted: args.entries.length };
  },
});

export const appendBatchFromDesktop = mutation({
  args: {
    sessionId: v.id("sandboxSessions"),
    localDeviceId: v.optional(v.string()),
    entries: v.array(logEntryValidator),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    await assertOrgAccess(ctx, session.orgId);

    if ((session.runtime ?? "cloud") !== "local") {
      throw new ConvexError("appendBatchFromDesktop is only supported for local runtime sessions");
    }
    if (
      args.localDeviceId &&
      session.localDeviceId &&
      args.localDeviceId !== session.localDeviceId
    ) {
      throw new ConvexError("Local device mismatch for sandbox session");
    }

    await appendEntries(db, {
      orgId: session.orgId,
      sessionId: args.sessionId,
      taskId: session.taskId,
      entries: args.entries as any,
    });

    return { inserted: args.entries.length };
  },
});

/** List sandbox logs aggregated across all sessions for a given task. */
export const listByTask = query({
  args: {
    taskId: v.id("tasks"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const task = await db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const maxEntries = args.limit ?? 500;
    return await db
      .query("sandboxLogs")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .order("asc")
      .take(maxEntries);
  },
});

export const listBySubtask = query({
  args: {
    subtaskId: v.id("subtasks"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const subtask = await db.get(args.subtaskId);
    if (!subtask) throw new ConvexError("Subtask not found");
    const task = await db.get(subtask.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const maxEntries = args.limit ?? 200;

    // Use the by_subtask index
    const directLogs = await db
      .query("sandboxLogs")
      .withIndex("by_subtask", (q: any) => q.eq("subtaskId", args.subtaskId))
      .order("asc")
      .take(maxEntries);

    if (directLogs.length > 0) return directLogs;

    // Fallback: filter by metadata.subtaskId for logs written before index migration
    const allLogs = await db
      .query("sandboxLogs")
      .withIndex("by_task", (q: any) => q.eq("taskId", subtask.taskId))
      .order("asc")
      .collect();

    return allLogs
      .filter(
        (log: any) =>
          log.subtaskId === args.subtaskId ||
          log.metadata?.subtaskId === args.subtaskId ||
          String(log.metadata?.subtaskId) === String(args.subtaskId),
      )
      .slice(0, maxEntries);
  },
});

export const summaryByTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const task = await db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const logs = await db
      .query("sandboxLogs")
      .withIndex("by_task", (q: any) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();

    const levelCounts: Record<string, number> = {};
    for (const log of logs) {
      levelCounts[log.level] = (levelCounts[log.level] ?? 0) + 1;
    }

    const recentLogs = logs.slice(-5);

    return {
      totalCount: logs.length,
      levelCounts,
      recentLogs,
    };
  },
});
