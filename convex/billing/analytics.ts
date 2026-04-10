import { v } from "convex/values";
import { query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

/**
 * Aggregate AI cost breakdown for an organization within a date range.
 * Returns total tokens, cost, and per-model breakdowns.
 * @param orgId - Organization ID
 * @param startDate - Range start (epoch ms)
 * @param endDate - Range end (epoch ms)
 */
export const getOrgCostSummary = query({
  args: {
    orgId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const records = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_org_recorded", (q) =>
        q.eq("orgId", args.orgId).gte("recordedAt", args.startDate).lte("recordedAt", args.endDate),
      )
      .collect();

    // Aggregate totals
    let totalCostUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalRecords = 0;

    const costBySource: Record<string, number> = {};
    const costByModel: Record<string, number> = {};
    const recordsBySource: Record<string, number> = {};

    for (const record of records) {
      totalCostUsd += record.costUsd;
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;
      totalCacheReadTokens += record.cacheReadTokens;
      totalCacheCreationTokens += record.cacheCreationTokens;
      totalRecords++;

      // Cost by source
      costBySource[record.source] = (costBySource[record.source] ?? 0) + record.costUsd;
      recordsBySource[record.source] = (recordsBySource[record.source] ?? 0) + 1;

      // Cost by model
      costByModel[record.claudeModelId] = (costByModel[record.claudeModelId] ?? 0) + record.costUsd;
    }

    // Cache hit rate: cacheReadTokens / (inputTokens + cacheReadTokens)
    const cacheEligibleTokens = totalInputTokens + totalCacheReadTokens;
    const cacheHitRate = cacheEligibleTokens > 0 ? totalCacheReadTokens / cacheEligibleTokens : 0;

    // Sandbox session count: records where source is sandbox-related
    const sandboxSessionCount = recordsBySource.sandbox_chat ?? 0;

    return {
      totalCostUsd,
      totalRecords,
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        cacheRead: totalCacheReadTokens,
        cacheCreation: totalCacheCreationTokens,
      },
      cacheHitRate,
      sandboxSessionCount,
      costBySource,
      costByModel,
      recordsBySource,
    };
  },
});

/**
 * Daily AI cost timeline for an organization over the last N days.
 * @param orgId - Organization ID
 * @param days - Number of days to look back
 */
export const getOrgCostTimeline = query({
  args: {
    orgId: v.string(),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const now = Date.now();
    const startDate = now - args.days * 24 * 60 * 60 * 1000;

    const records = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_org_recorded", (q) =>
        q.eq("orgId", args.orgId).gte("recordedAt", startDate).lte("recordedAt", now),
      )
      .collect();

    // Group by day (UTC)
    const dayMap: Record<string, { costUsd: number; sessionCount: number; recordCount: number }> =
      {};

    for (const record of records) {
      const date = new Date(record.recordedAt);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { costUsd: 0, sessionCount: 0, recordCount: 0 };
      }

      dayMap[dayKey].costUsd += record.costUsd;
      dayMap[dayKey].recordCount++;

      if (record.source === "sandbox_chat") {
        dayMap[dayKey].sessionCount++;
      }
    }

    // Build sorted array filling in missing days with zeros
    const timeline: Array<{
      date: string;
      costUsd: number;
      sessionCount: number;
      recordCount: number;
    }> = [];

    for (let d = 0; d < args.days; d++) {
      const ts = startDate + d * 24 * 60 * 60 * 1000;
      const date = new Date(ts);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

      timeline.push({
        date: dayKey,
        costUsd: dayMap[dayKey]?.costUsd ?? 0,
        sessionCount: dayMap[dayKey]?.sessionCount ?? 0,
        recordCount: dayMap[dayKey]?.recordCount ?? 0,
      });
    }

    return timeline;
  },
});

// ---------------------------------------------------------------------------
// getOrgCostByModel — per-model cost and token breakdown
// ---------------------------------------------------------------------------
export const getOrgCostByModel = query({
  args: {
    orgId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const records = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_org_recorded", (q) =>
        q.eq("orgId", args.orgId).gte("recordedAt", args.startDate).lte("recordedAt", args.endDate),
      )
      .collect();

    const modelMap: Record<
      string,
      {
        claudeModelId: string;
        totalCostUsd: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCacheReadTokens: number;
        totalCacheCreationTokens: number;
        recordCount: number;
        cacheHitRate: number;
      }
    > = {};

    for (const record of records) {
      const key = record.claudeModelId;
      if (!modelMap[key]) {
        modelMap[key] = {
          claudeModelId: key,
          totalCostUsd: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheReadTokens: 0,
          totalCacheCreationTokens: 0,
          recordCount: 0,
          cacheHitRate: 0,
        };
      }

      const m = modelMap[key];
      m.totalCostUsd += record.costUsd;
      m.totalInputTokens += record.inputTokens;
      m.totalOutputTokens += record.outputTokens;
      m.totalCacheReadTokens += record.cacheReadTokens;
      m.totalCacheCreationTokens += record.cacheCreationTokens;
      m.recordCount++;
    }

    // Compute per-model cache hit rates
    const models = Object.values(modelMap).map((m) => {
      const cacheEligible = m.totalInputTokens + m.totalCacheReadTokens;
      return {
        ...m,
        cacheHitRate: cacheEligible > 0 ? m.totalCacheReadTokens / cacheEligible : 0,
      };
    });

    // Sort by cost descending
    models.sort((a, b) => b.totalCostUsd - a.totalCostUsd);

    return models;
  },
});
