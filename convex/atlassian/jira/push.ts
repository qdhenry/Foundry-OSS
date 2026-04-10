import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

export const getQueueItemInternal = internalQuery({
  args: { queueItemId: v.id("jiraSyncQueue") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.queueItemId);
  },
});

export const enqueueOperationInternal = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    operationType: v.union(
      v.literal("create_issue"),
      v.literal("update_issue"),
      v.literal("create_sprint"),
      v.literal("transition_issue"),
      v.literal("add_comment"),
    ),
    payload: v.any(),
    platformEntityId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jiraSyncQueue", {
      orgId: args.orgId,
      programId: args.programId,
      operationType: args.operationType,
      payload: args.payload,
      platformEntityId: args.platformEntityId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const enqueueOperation = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    operationType: v.union(
      v.literal("create_issue"),
      v.literal("update_issue"),
      v.literal("create_sprint"),
      v.literal("transition_issue"),
      v.literal("add_comment"),
    ),
    payload: v.any(),
    platformEntityId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    return await ctx.db.insert("jiraSyncQueue", {
      orgId: args.orgId,
      programId: args.programId,
      operationType: args.operationType,
      payload: args.payload,
      platformEntityId: args.platformEntityId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const listQueueByProgram = query({
  args: {
    programId: v.id("programs"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("executed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const items = await ctx.db
      .query("jiraSyncQueue")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return args.status ? items.filter((item) => item.status === args.status) : items;
  },
});

export const reviewQueueItem = mutation({
  args: {
    queueItemId: v.id("jiraSyncQueue"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    reviewUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.queueItemId);
    if (!item) throw new ConvexError("Queue item not found");

    await assertOrgAccess(ctx, item.orgId);

    await ctx.db.patch(args.queueItemId, {
      status: args.decision,
      reviewedBy: args.reviewUserId,
      reviewedAt: Date.now(),
    });
  },
});

export const markQueueItemExecuted = internalMutation({
  args: {
    queueItemId: v.id("jiraSyncQueue"),
    jiraResponse: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.queueItemId);
    if (!item) throw new ConvexError("Queue item not found");

    await ctx.db.patch(args.queueItemId, {
      status: "executed",
      jiraResponse: args.jiraResponse,
      reviewedAt: item.reviewedAt ?? Date.now(),
    });
  },
});
