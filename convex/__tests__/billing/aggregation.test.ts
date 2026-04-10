import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

const NOW = Date.now();
const PERIOD_START = NOW - 15 * 24 * 60 * 60 * 1000;
const PERIOD_END = NOW + 15 * 24 * 60 * 60 * 1000;
// Watermark: records created before this should not be aggregated again
const WATERMARK = NOW - 2 * 60 * 60 * 1000; // 2 hours ago

function makeSubscription() {
  return {
    orgId: "org-1",
    stripeCustomerId: "cus_test_123",
    stripeSubscriptionId: "sub_test_123",
    planSlug: "forge" as const,
    status: "active" as const,
    currentPeriodStart: PERIOD_START,
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
  };
}

function makeUsageRecord(overrides: Record<string, any> = {}) {
  return {
    orgId: "org-1",
    source: "document_analysis" as const,
    claudeModelId: "claude-opus-4-6",
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 200,
    cacheCreationTokens: 100,
    costUsd: 0.05,
    recordedAt: NOW,
    ...overrides,
  };
}

describe("aggregation.runUsageAggregation", () => {
  test("aggregates aiUsageRecords cost/tokens into usagePeriod", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription());

      // Pre-create usage period with watermark set far in the past so all records are aggregated
      await ctx.db.insert("usagePeriods", {
        orgId: "org-1",
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
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
        lastUpdatedAt: PERIOD_START, // watermark at period start so all records qualify
      });

      // Insert two usage records
      await ctx.db.insert(
        "aiUsageRecords",
        makeUsageRecord({
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadTokens: 200,
          cacheCreationTokens: 100,
          costUsd: 0.05,
          recordedAt: NOW - 60 * 1000, // 1 minute ago
        }),
      );
      await ctx.db.insert(
        "aiUsageRecords",
        makeUsageRecord({
          inputTokens: 2000,
          outputTokens: 1000,
          cacheReadTokens: 400,
          cacheCreationTokens: 200,
          costUsd: 0.1,
          recordedAt: NOW - 30 * 1000, // 30 seconds ago
        }),
      );
    });

    await t.mutation(internalAny.billing.aggregation.runUsageAggregation, {});

    const period = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_period", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(period).not.toBeNull();
    expect(period.totalAiCostUsd).toBeCloseTo(0.15, 5);
    expect(period.totalInputTokens).toBe(3000);
    expect(period.totalOutputTokens).toBe(1500);
    expect(period.totalCacheReadTokens).toBe(600);
    expect(period.totalCacheCreationTokens).toBe(300);
  });

  test("watermark prevents double counting (only aggregates records after lastUpdatedAt)", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription());

      // Usage period with watermark set to WATERMARK
      await ctx.db.insert("usagePeriods", {
        orgId: "org-1",
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        sandboxSessionCount: 0,
        documentAnalysisCount: 0,
        videoAnalysisCount: 0,
        totalAiCostUsd: 1.0, // already has accumulated cost
        totalInputTokens: 5000,
        totalOutputTokens: 2500,
        totalCacheReadTokens: 1000,
        totalCacheCreationTokens: 500,
        overageSessionCount: 0,
        overageReportedToStripe: false,
        lastUpdatedAt: WATERMARK,
      });

      // Old record (before watermark) — should NOT be aggregated
      await ctx.db.insert(
        "aiUsageRecords",
        makeUsageRecord({
          inputTokens: 9999,
          outputTokens: 9999,
          cacheReadTokens: 9999,
          cacheCreationTokens: 9999,
          costUsd: 99.99,
          recordedAt: WATERMARK - 60 * 1000, // before watermark
        }),
      );

      // New record (after watermark) — should be aggregated
      await ctx.db.insert(
        "aiUsageRecords",
        makeUsageRecord({
          inputTokens: 500,
          outputTokens: 250,
          cacheReadTokens: 100,
          cacheCreationTokens: 50,
          costUsd: 0.02,
          recordedAt: WATERMARK + 60 * 1000, // after watermark
        }),
      );
    });

    await t.mutation(internalAny.billing.aggregation.runUsageAggregation, {});

    const period = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_period", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(period).not.toBeNull();
    // Should only include the new record on top of existing totals
    expect(period.totalAiCostUsd).toBeCloseTo(1.02, 5); // 1.0 + 0.02
    expect(period.totalInputTokens).toBe(5500); // 5000 + 500
    expect(period.totalOutputTokens).toBe(2750); // 2500 + 250
    expect(period.totalCacheReadTokens).toBe(1100); // 1000 + 100
    expect(period.totalCacheCreationTokens).toBe(550); // 500 + 50
  });
});
