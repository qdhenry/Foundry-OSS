import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { assertOrgAccess, getAuthUser } from "../model/access";

export const sandboxQueueStatusValidator = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
);

function isTerminalQueueStatus(status: "queued" | "processing" | "completed" | "failed"): boolean {
  return status === "completed" || status === "failed";
}

export const listByOrg = query({
  args: {
    orgId: v.string(),
    status: v.optional(sandboxQueueStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const db = ctx.db as any;

    let entries = args.status
      ? await db
          .query("sandboxQueue")
          .withIndex("by_org_status", (q: any) =>
            q.eq("orgId", args.orgId).eq("status", args.status),
          )
          .collect()
      : await db
          .query("sandboxQueue")
          .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
          .collect();

    entries.sort((a: { queuedAt: number }, b: { queuedAt: number }) => b.queuedAt - a.queuedAt);
    if (args.limit !== undefined) {
      const limit = Math.max(1, Math.min(args.limit, 500));
      entries = entries.slice(0, limit);
    }
    return entries;
  },
});

export const get = query({
  args: { queueId: v.id("sandboxQueue") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.queueId);
    if (!entry) throw new ConvexError("Sandbox queue item not found");
    await assertOrgAccess(ctx, entry.orgId);
    return entry;
  },
});

export const enqueue = mutation({
  args: {
    orgId: v.string(),
    taskId: v.id("tasks"),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user.orgIds.includes(args.orgId)) throw new ConvexError("Access denied");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    if (task.orgId !== args.orgId) {
      throw new ConvexError("Task does not belong to this organization");
    }

    const db = ctx.db as any;
    return await db.insert("sandboxQueue", {
      orgId: args.orgId,
      taskId: args.taskId,
      config: args.config,
      queuedAt: Date.now(),
      queuedBy: user._id,
      status: "queued",
    });
  },
});

export const updateStatus = mutation({
  args: {
    queueId: v.id("sandboxQueue"),
    status: sandboxQueueStatusValidator,
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const db = ctx.db as any;
    const entry = await db.get(args.queueId);
    if (!entry) throw new ConvexError("Sandbox queue item not found");
    if (!user.orgIds.includes(entry.orgId)) throw new ConvexError("Access denied");

    await db.patch(args.queueId, {
      status: args.status,
      error: args.error,
      processedAt: isTerminalQueueStatus(args.status) ? Date.now() : undefined,
    });

    return args.queueId;
  },
});

export const remove = mutation({
  args: { queueId: v.id("sandboxQueue") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const entry = await ctx.db.get(args.queueId);
    if (!entry) throw new ConvexError("Sandbox queue item not found");
    if (!user.orgIds.includes(entry.orgId)) throw new ConvexError("Access denied");

    await ctx.db.delete(args.queueId);
    return args.queueId;
  },
});

export const dequeueNextInternal = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const next = await db
      .query("sandboxQueue")
      .withIndex("by_org_status", (q: any) => q.eq("orgId", args.orgId).eq("status", "queued"))
      .first();
    if (!next) return null;

    await db.patch(next._id, {
      status: "processing",
      error: undefined,
    });

    return next._id;
  },
});

export const markInternal = internalMutation({
  args: {
    queueId: v.id("sandboxQueue"),
    status: sandboxQueueStatusValidator,
    error: v.optional(v.string()),
    processedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const entry = await db.get(args.queueId);
    if (!entry) return null;

    await db.patch(args.queueId, {
      status: args.status,
      error: args.error,
      processedAt: isTerminalQueueStatus(args.status)
        ? (args.processedAt ?? Date.now())
        : undefined,
    });

    return args.queueId;
  },
});

export const getInternal = internalQuery({
  args: { queueId: v.id("sandboxQueue") },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    return await db.get(args.queueId);
  },
});

export const listQueuedInternal = internalQuery({
  args: {
    orgId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const rows = await db
      .query("sandboxQueue")
      .withIndex("by_org_status", (q: any) => q.eq("orgId", args.orgId).eq("status", "queued"))
      .collect();

    rows.sort((a: { queuedAt: number }, b: { queuedAt: number }) => a.queuedAt - b.queuedAt);
    if (args.limit === undefined) return rows;
    return rows.slice(0, Math.max(1, Math.min(args.limit, 500)));
  },
});
