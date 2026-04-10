import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

// Save or update a checkpoint for a long-running AI operation
export const saveCheckpoint = mutation({
  args: {
    orgId: v.string(),
    operationId: v.string(),
    operationType: v.string(),
    entityId: v.string(),
    entityTable: v.string(),
    stage: v.string(),
    progress: v.number(),
    intermediateData: v.optional(v.any()),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("abandoned"),
    ),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const now = Date.now();
    const ttl = 24 * 60 * 60 * 1000; // 24 hours

    // Check for existing checkpoint by operationId
    const existing = await ctx.db
      .query("aiOperationCheckpoints")
      .withIndex("by_org_operation", (q) =>
        q.eq("orgId", args.orgId).eq("operationId", args.operationId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stage: args.stage,
        progress: args.progress,
        intermediateData: args.intermediateData,
        status: args.status,
        updatedAt: now,
        expiresAt: now + ttl,
      });
      return existing._id;
    }

    return await ctx.db.insert("aiOperationCheckpoints", {
      orgId: args.orgId,
      operationId: args.operationId,
      operationType: args.operationType,
      entityId: args.entityId,
      entityTable: args.entityTable,
      stage: args.stage,
      progress: args.progress,
      intermediateData: args.intermediateData,
      status: args.status,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ttl,
    });
  },
});

// Get checkpoint for an operation (used for resume after failure)
export const getCheckpoint = query({
  args: {
    orgId: v.string(),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("aiOperationCheckpoints")
      .withIndex("by_org_operation", (q) =>
        q.eq("orgId", args.orgId).eq("operationId", args.operationId),
      )
      .unique();
  },
});

// Clean up expired checkpoints — called by cron (no auth context).
// EXCEPTION: Uses .filter() because we need a less-than comparison on expiresAt.
// The by_expires index provides ordering but Convex index queries only support
// equality prefixes, not range scans. This is acceptable for a background cleanup
// job that runs daily and processes at most 100 documents per invocation.
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("aiOperationCheckpoints")
      .withIndex("by_expires")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(100);

    for (const checkpoint of expired) {
      await ctx.db.delete(checkpoint._id);
    }

    return { deleted: expired.length };
  },
});
