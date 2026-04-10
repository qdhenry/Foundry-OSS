import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

export const checkAgentBudget = query({
  args: { agentId: v.id("programAgents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return { allowed: false, reason: "Agent not found" };
    }

    await assertOrgAccess(ctx, agent.orgId);

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const executions = await ctx.db
      .query("agentTaskExecutions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const todayUsage = executions
      .filter((execution) => execution._creationTime >= dayStart.getTime())
      .reduce((sum, execution) => sum + execution.tokensUsed.total, 0);

    if (todayUsage >= agent.tokenBudget.perDay) {
      return { allowed: false, reason: "Daily budget exceeded", todayUsage };
    }

    return {
      allowed: true,
      remainingDailyBudget: agent.tokenBudget.perDay - todayUsage,
      perExecutionBudget: agent.tokenBudget.perExecution,
      todayUsage,
    };
  },
});

export const addExecutionUsage = mutation({
  args: {
    orgId: v.string(),
    tokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const settings = await ctx.db
      .query("orgAgentSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();

    if (!settings) {
      return { withinBudget: true, monthlyTokensUsed: 0, monthlyTokenBudget: 0 };
    }

    const nextMonthlyUsage = settings.monthlyTokensUsed + args.tokensUsed;
    await ctx.db.patch(settings._id, {
      monthlyTokensUsed: nextMonthlyUsage,
    });

    return {
      withinBudget: nextMonthlyUsage <= settings.monthlyTokenBudget,
      monthlyTokensUsed: nextMonthlyUsage,
      monthlyTokenBudget: settings.monthlyTokenBudget,
    };
  },
});
