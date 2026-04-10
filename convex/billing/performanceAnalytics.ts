import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

// ---------------------------------------------------------------------------
// getLatencyPercentiles — p50/p75/p90/p99 from agentExecutions
// ---------------------------------------------------------------------------
export const getLatencyPercentiles = query({
  args: {
    orgId: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const now = Date.now();
    const startDate = args.startDate ?? now - 30 * 24 * 60 * 60 * 1000;
    const endDate = args.endDate ?? now;

    const executions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();

    // Filter by date range and extract durations
    const durations = executions
      .filter((e) => e._creationTime >= startDate && e._creationTime <= endDate && e.durationMs)
      .map((e) => e.durationMs as number)
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p99: 0, count: 0 };
    }

    function percentile(sorted: number[], p: number): number {
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    }

    // Group by model
    const byModel: Record<string, number[]> = {};
    for (const exec of executions) {
      if (exec._creationTime < startDate || exec._creationTime > endDate) continue;
      if (!exec.durationMs || !exec.modelId) continue;
      if (!byModel[exec.modelId]) byModel[exec.modelId] = [];
      byModel[exec.modelId].push(exec.durationMs);
    }

    const modelPercentiles = Object.entries(byModel).map(([modelId, durs]) => {
      const sorted = durs.sort((a, b) => a - b);
      return {
        modelId,
        count: sorted.length,
        p50: percentile(sorted, 50),
        p75: percentile(sorted, 75),
        p90: percentile(sorted, 90),
        p99: percentile(sorted, 99),
      };
    });

    return {
      overall: {
        p50: percentile(durations, 50),
        p75: percentile(durations, 75),
        p90: percentile(durations, 90),
        p99: percentile(durations, 99),
        count: durations.length,
      },
      byModel: modelPercentiles,
    };
  },
});

// ---------------------------------------------------------------------------
// getDailyPerformanceTrend — daily cost + avg latency + volume
// ---------------------------------------------------------------------------
export const getDailyPerformanceTrend = query({
  args: {
    orgId: v.string(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const days = args.days ?? 14;
    const now = Date.now();
    const startDate = now - days * 24 * 60 * 60 * 1000;

    // Cost data
    const usageRecords = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_org_recorded", (q) =>
        q.eq("orgId", args.orgId).gte("recordedAt", startDate).lte("recordedAt", now),
      )
      .collect();

    // Latency data
    const executions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();

    const filteredExec = executions.filter(
      (e) => e._creationTime >= startDate && e._creationTime <= now,
    );

    const dayMap: Record<
      string,
      {
        costUsd: number;
        totalDuration: number;
        durationCount: number;
        executions: number;
        totalTokens: number;
      }
    > = {};

    for (const record of usageRecords) {
      const date = new Date(record.recordedAt);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = {
          costUsd: 0,
          totalDuration: 0,
          durationCount: 0,
          executions: 0,
          totalTokens: 0,
        };
      }
      dayMap[dayKey].costUsd += record.costUsd;
    }

    for (const exec of filteredExec) {
      const date = new Date(exec._creationTime);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = {
          costUsd: 0,
          totalDuration: 0,
          durationCount: 0,
          executions: 0,
          totalTokens: 0,
        };
      }
      dayMap[dayKey].executions++;
      if (exec.durationMs) {
        dayMap[dayKey].totalDuration += exec.durationMs;
        dayMap[dayKey].durationCount++;
      }
      if (exec.tokensUsed) {
        dayMap[dayKey].totalTokens += exec.tokensUsed;
      }
    }

    const timeline: Array<{
      date: string;
      costUsd: number;
      avgDurationMs: number;
      executions: number;
      totalTokens: number;
    }> = [];

    for (let d = 0; d < days; d++) {
      const ts = startDate + d * 24 * 60 * 60 * 1000;
      const date = new Date(ts);
      const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      const entry = dayMap[dayKey];
      timeline.push({
        date: dayKey,
        costUsd: entry?.costUsd ?? 0,
        avgDurationMs:
          entry && entry.durationCount > 0
            ? Math.round(entry.totalDuration / entry.durationCount)
            : 0,
        executions: entry?.executions ?? 0,
        totalTokens: entry?.totalTokens ?? 0,
      });
    }

    return timeline;
  },
});

// ---------------------------------------------------------------------------
// getModelComparison — per-model performance comparison
// ---------------------------------------------------------------------------
export const getModelComparison = query({
  args: {
    orgId: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const now = Date.now();
    const startDate = args.startDate ?? now - 30 * 24 * 60 * 60 * 1000;
    const endDate = args.endDate ?? now;

    const usageRecords = await ctx.db
      .query("aiUsageRecords")
      .withIndex("by_org_recorded", (q) =>
        q.eq("orgId", args.orgId).gte("recordedAt", startDate).lte("recordedAt", endDate),
      )
      .collect();

    const modelMap: Record<
      string,
      {
        totalCostUsd: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCacheReadTokens: number;
        totalDurationMs: number;
        durationCount: number;
        recordCount: number;
      }
    > = {};

    for (const record of usageRecords) {
      const key = record.claudeModelId;
      if (!modelMap[key]) {
        modelMap[key] = {
          totalCostUsd: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheReadTokens: 0,
          totalDurationMs: 0,
          durationCount: 0,
          recordCount: 0,
        };
      }
      const m = modelMap[key];
      m.totalCostUsd += record.costUsd;
      m.totalInputTokens += record.inputTokens;
      m.totalOutputTokens += record.outputTokens;
      m.totalCacheReadTokens += record.cacheReadTokens;
      m.recordCount++;
      if (record.durationMs) {
        m.totalDurationMs += record.durationMs;
        m.durationCount++;
      }
    }

    return Object.entries(modelMap)
      .map(([modelId, m]) => {
        const cacheEligible = m.totalInputTokens + m.totalCacheReadTokens;
        return {
          modelId,
          avgCostPerCall: m.recordCount > 0 ? m.totalCostUsd / m.recordCount : 0,
          totalCostUsd: m.totalCostUsd,
          avgDurationMs: m.durationCount > 0 ? Math.round(m.totalDurationMs / m.durationCount) : 0,
          cacheHitRate: cacheEligible > 0 ? m.totalCacheReadTokens / cacheEligible : 0,
          volume: m.recordCount,
        };
      })
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  },
});
