import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { agentModelValidator } from "./schema";

export const get = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("orgAgentSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    orgId: v.string(),
    monthlyTokenBudget: v.optional(v.number()),
    maxConcurrentSandboxes: v.optional(v.number()),
    webhookUrl: v.optional(v.string()),
    notificationPreferences: v.optional(
      v.object({
        email: v.boolean(),
        webhook: v.boolean(),
        inApp: v.boolean(),
      }),
    ),
    defaultModel: v.optional(agentModelValidator),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const existing = await ctx.db
      .query("orgAgentSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();

    if (existing) {
      const { orgId: _orgId, ...updates } = args;
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(filtered).length > 0) {
        await ctx.db.patch(existing._id, filtered);
      }
      return existing._id;
    }

    return await ctx.db.insert("orgAgentSettings", {
      orgId: args.orgId,
      monthlyTokenBudget: args.monthlyTokenBudget ?? 1_000_000,
      monthlyTokensUsed: 0,
      budgetResetDate: Date.now(),
      maxConcurrentSandboxes: args.maxConcurrentSandboxes ?? 4,
      webhookUrl: args.webhookUrl,
      notificationPreferences: args.notificationPreferences ?? {
        email: true,
        webhook: false,
        inApp: true,
      },
      defaultModel: args.defaultModel ?? "claude-sonnet-4-5-20250929",
    });
  },
});
