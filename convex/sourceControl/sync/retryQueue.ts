// @ts-nocheck
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * Retry queue mutations/queries for failed outbound GitHub API operations.
 *
 * Operations like issue creation, review posting, and issue updates that fail
 * are queued here with exponential backoff. Max 10 retries (~17 hours).
 *
 * The processRetry action lives in retryQueueActions.ts (Node.js runtime).
 */

const DEFAULT_MAX_RETRIES = 10;

// ---------------------------------------------------------------------------
// enqueueRetry — add a failed operation to the retry queue
// ---------------------------------------------------------------------------

export const enqueueRetry = internalMutation({
  args: {
    orgId: v.string(),
    operationType: v.string(),
    payload: v.any(),
    lastError: v.string(),
    retryAfterMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const delayMs = args.retryAfterMs ?? 1000; // First retry at 1s
    const retryId = await ctx.db.insert("sourceControlRetryQueue", {
      orgId: args.orgId,
      operationType: args.operationType,
      payload: args.payload,
      retryCount: 0,
      nextRetryAt: Date.now() + delayMs,
      lastError: args.lastError,
      status: "pending",
      maxRetries: DEFAULT_MAX_RETRIES,
      createdAt: Date.now(),
    });

    // Schedule the first retry
    await ctx.scheduler.runAfter(
      delayMs,
      internal.sourceControl.sync.retryQueueActions.processRetry,
      { retryId },
    );

    return retryId;
  },
});

// ---------------------------------------------------------------------------
// getRetryById — load a retry queue entry
// ---------------------------------------------------------------------------

export const getRetryById = internalQuery({
  args: { retryId: v.id("sourceControlRetryQueue") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.retryId);
  },
});

// ---------------------------------------------------------------------------
// updateRetryStatus — update retry queue entry state
// ---------------------------------------------------------------------------

export const updateRetryStatus = internalMutation({
  args: {
    retryId: v.id("sourceControlRetryQueue"),
    status: v.union(
      v.literal("pending"),
      v.literal("retrying"),
      v.literal("succeeded"),
      v.literal("abandoned"),
    ),
    retryCount: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.retryCount !== undefined) updates.retryCount = args.retryCount;
    if (args.nextRetryAt !== undefined) updates.nextRetryAt = args.nextRetryAt;
    if (args.lastError !== undefined) updates.lastError = args.lastError;
    await ctx.db.patch(args.retryId, updates);
  },
});

// ---------------------------------------------------------------------------
// getPendingRetries — list pending retries ready to process
// ---------------------------------------------------------------------------

export const getPendingRetries = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("sourceControlRetryQueue")
      .withIndex("by_status_retry", (q) => q.eq("status", "pending"))
      .filter((q) => q.lte(q.field("nextRetryAt"), now))
      .take(50);
  },
});
