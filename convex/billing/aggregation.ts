import { internalMutation } from "../_generated/server";

/**
 * Hourly cron: aggregates aiUsageRecords into usagePeriods for each active subscription.
 *
 * Uses a watermark pattern (lastUpdatedAt) to avoid double-counting records.
 * Only processes orgs with an active subscription and a matching billing period.
 */
export const runUsageAggregation = internalMutation({
  handler: async (ctx) => {
    // Get all subscriptions — table is small, filter in-memory is acceptable
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const active = subscriptions.filter((s) => s.status === "active");

    for (const subscription of active) {
      // Find existing usage period for this subscription's current billing cycle
      let period = await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_period", (q) =>
          q.eq("orgId", subscription.orgId).gte("periodStart", subscription.currentPeriodStart),
        )
        .first();

      if (!period) {
        // Create a new usage period for this billing cycle
        const periodId = await ctx.db.insert("usagePeriods", {
          orgId: subscription.orgId,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          sandboxSessionCount: 0,
          documentAnalysisCount: 0,
          videoAnalysisCount: 0,
          totalAiCostUsd: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheReadTokens: 0,
          totalCacheCreationTokens: 0,
          overageSessionCount: 0,
          overageReportedToStripe: false,
          lastUpdatedAt: Date.now(),
        });
        period = await ctx.db.get(periodId);
        if (!period) continue;
      }

      // Aggregate aiUsageRecords that arrived since the last watermark
      const records = await ctx.db
        .query("aiUsageRecords")
        .withIndex("by_org_recorded", (q) =>
          q.eq("orgId", subscription.orgId).gt("recordedAt", period.lastUpdatedAt),
        )
        .collect();

      if (records.length === 0) continue;

      // Sum up token counts and costs
      let totalCost = 0;
      let totalInput = 0;
      let totalOutput = 0;
      let totalCacheRead = 0;
      let totalCacheCreate = 0;

      for (const record of records) {
        totalCost += record.costUsd;
        totalInput += record.inputTokens;
        totalOutput += record.outputTokens;
        totalCacheRead += record.cacheReadTokens;
        totalCacheCreate += record.cacheCreationTokens;
      }

      await ctx.db.patch(period._id, {
        totalAiCostUsd: period.totalAiCostUsd + totalCost,
        totalInputTokens: period.totalInputTokens + totalInput,
        totalOutputTokens: period.totalOutputTokens + totalOutput,
        totalCacheReadTokens: period.totalCacheReadTokens + totalCacheRead,
        totalCacheCreationTokens: period.totalCacheCreationTokens + totalCacheCreate,
        lastUpdatedAt: Date.now(),
      });
    }
  },
});
