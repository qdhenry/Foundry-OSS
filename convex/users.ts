import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    orgIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
        orgIds: args.orgIds,
      });
    } else {
      await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
        orgIds: args.orgIds,
      });
    }
  },
});

/** Look up a user by their Clerk subject ID. Returns null if not found. */
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

/** List all users belonging to an organization. */
export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db.query("users").collect();
    return allUsers.filter((u) => u.orgIds.includes(args.orgId));
  },
});

/**
 * Ensure the authenticated user's record includes the given orgId.
 * Called on first visit to an org context.
 * @param orgId - Organization ID to sync
 */
export const syncActiveOrg = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (user && !user.orgIds.includes(args.orgId)) {
      await ctx.db.patch(user._id, { orgIds: [...user.orgIds, args.orgId] });
    }
  },
});

export const addOrgId = internalMutation({
  args: { clerkId: v.string(), orgId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (user && !user.orgIds.includes(args.orgId)) {
      await ctx.db.patch(user._id, { orgIds: [...user.orgIds, args.orgId] });
    }
  },
});

export const removeOrgId = internalMutation({
  args: { clerkId: v.string(), orgId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (user) {
      await ctx.db.patch(user._id, {
        orgIds: user.orgIds.filter((id) => id !== args.orgId),
      });
    }
  },
});

export const getByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});
