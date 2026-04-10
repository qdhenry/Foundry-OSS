import { v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

export const listByAgent = query({
  args: { agentId: v.id("programAgents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    await assertOrgAccess(ctx, agent.orgId);

    return await ctx.db
      .query("agentVersions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const getVersion = query({
  args: {
    agentId: v.id("programAgents"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    await assertOrgAccess(ctx, agent.orgId);

    return await ctx.db
      .query("agentVersions")
      .withIndex("by_agent_version", (q) =>
        q.eq("agentId", args.agentId).eq("version", args.version),
      )
      .unique();
  },
});

// Internal version for workflow/orchestration context (no auth check)
export const getVersionInternal = internalQuery({
  args: {
    agentId: v.id("programAgents"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentVersions")
      .withIndex("by_agent_version", (q) =>
        q.eq("agentId", args.agentId).eq("version", args.version),
      )
      .unique();
  },
});
