import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUser, getAuthUserOrNull } from "./model/access";

const notificationTypeValidator = v.union(
  v.literal("sandbox_complete"),
  v.literal("sandbox_failed"),
  v.literal("pr_ready"),
  v.literal("review_requested"),
  v.literal("subtask_completed"),
  v.literal("subtask_failed"),
  v.literal("subtask_scope_violation"),
  v.literal("all_subtasks_complete"),
  v.literal("subtask_paused"),
  v.literal("verification_completed"),
  v.literal("verification_failed"),
  v.literal("orchestration_plan_ready"),
  v.literal("orchestration_complete"),
  v.literal("orchestration_failed"),
);

/** List all unread notifications for the authenticated user, newest first. */
export const listUnread = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUserOrNull(ctx);
    if (!user) return [];
    const db = ctx.db as any;

    const notifications = await db
      .query("notifications")
      .withIndex("by_user_read", (q: any) => q.eq("userId", user._id).eq("read", false))
      .collect();

    notifications.sort(
      (a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt,
    );
    return notifications;
  },
});

/**
 * List recent notifications (unread + read) for the authenticated user.
 * @param limit - Maximum number of notifications (default 20, max 100)
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getAuthUserOrNull(ctx);
    if (!user) return [];
    const db = ctx.db as any;
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));

    const [unread, read] = await Promise.all([
      db
        .query("notifications")
        .withIndex("by_user_read", (q: any) => q.eq("userId", user._id).eq("read", false))
        .collect(),
      db
        .query("notifications")
        .withIndex("by_user_read", (q: any) => q.eq("userId", user._id).eq("read", true))
        .collect(),
    ]);

    return [...unread, ...read]
      .sort((a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },
});

/** Mark a single notification as read. */
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const db = ctx.db as any;

    const notification = await db.get(args.notificationId);
    if (!notification) throw new ConvexError("Notification not found");
    if (notification.userId !== user._id) throw new ConvexError("Access denied");

    if (!notification.read) {
      await db.patch(args.notificationId, { read: true });
    }

    return args.notificationId;
  },
});

/** Mark all unread notifications as read for the authenticated user. */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    const db = ctx.db as any;

    const unread = await db
      .query("notifications")
      .withIndex("by_user_read", (q: any) => q.eq("userId", user._id).eq("read", false))
      .collect();

    await Promise.all(unread.map((item: { _id: string }) => db.patch(item._id, { read: true })));
    return { updated: unread.length };
  },
});

export const create = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.id("users"),
    programId: v.optional(v.id("programs")),
    type: notificationTypeValidator,
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get(args.userId);
    if (!recipient) throw new ConvexError("Recipient user not found");
    if (!recipient.orgIds.includes(args.orgId)) {
      throw new ConvexError("Recipient does not belong to this organization");
    }

    const db = ctx.db as any;
    return await db.insert("notifications", {
      orgId: args.orgId,
      userId: args.userId,
      programId: args.programId,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link,
      entityType: args.entityType,
      entityId: args.entityId,
      read: false,
      createdAt: args.createdAt ?? Date.now(),
    });
  },
});
