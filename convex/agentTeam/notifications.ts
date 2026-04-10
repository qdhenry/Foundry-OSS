import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

const createNotificationArgs = {
  orgId: v.string(),
  programId: v.id("programs"),
  agentId: v.optional(v.id("programAgents")),
  sprintWorkflowId: v.optional(v.id("sprintWorkflows")),
  type: v.union(
    v.literal("failure"),
    v.literal("completion"),
    v.literal("budget_warning"),
    v.literal("reassignment"),
    v.literal("sprint_complete"),
    v.literal("pr_created"),
  ),
  severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
  title: v.string(),
  message: v.string(),
  channels: v.array(v.string()),
};

export const listByProgram = query({
  args: { programId: v.id("programs"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("agentNotifications")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const listUnread = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("agentNotifications")
      .withIndex("by_org_unread", (q) => q.eq("orgId", args.orgId).eq("readAt", undefined))
      .take(20);
  },
});

export const create = mutation({
  args: createNotificationArgs,
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db.insert("agentNotifications", {
      ...args,
      deliveredVia: ["in_app"],
      readAt: undefined,
    });
  },
});

export const createInternal = internalMutation({
  args: createNotificationArgs,
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentNotifications", {
      ...args,
      deliveredVia: ["in_app"],
      readAt: undefined,
    });
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("agentNotifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return;
    await assertOrgAccess(ctx, notification.orgId);
    await ctx.db.patch(args.notificationId, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const unread = await ctx.db
      .query("agentNotifications")
      .withIndex("by_org_unread", (q) => q.eq("orgId", args.orgId).eq("readAt", undefined))
      .collect();

    const now = Date.now();
    for (const notification of unread) {
      await ctx.db.patch(notification._id, { readAt: now });
    }
  },
});
