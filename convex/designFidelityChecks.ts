import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

export const getByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    await assertOrgAccess(ctx, task.orgId);

    const checks = await ctx.db
      .query("designFidelityChecks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    if (checks.length === 0) return null;

    const latest = checks[checks.length - 1];
    return {
      ...latest,
      referenceImageUrl: await ctx.storage.getUrl(latest.referenceImageId),
      outputImageUrl: await ctx.storage.getUrl(latest.outputImageId),
      diffImageUrl: latest.diffImageId ? await ctx.storage.getUrl(latest.diffImageId) : null,
    };
  },
});
