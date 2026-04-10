import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

const NOW = Date.now();
const PERIOD_START = NOW - 15 * 24 * 60 * 60 * 1000;
const PERIOD_END = NOW + 15 * 24 * 60 * 60 * 1000;

async function setupBaseData(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "user1@example.com",
      name: "User One",
      orgIds: ["org-1"],
      role: "admin",
    });
  });
  return { userId };
}

function makeSubscription(overrides: Record<string, any> = {}) {
  return {
    orgId: "org-1",
    stripeCustomerId: "cus_test_123",
    stripeSubscriptionId: "sub_test_123",
    planSlug: "forge" as const,
    status: "active" as const,
    currentPeriodStart: PERIOD_START,
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function makePricingPlan(overrides: Record<string, any> = {}) {
  return {
    slug: "forge" as const,
    displayName: "Forge",
    tagline: "For growing teams",
    monthlyPriceUsd: 499,
    stripePriceId: "price_test_forge",
    stripeOveragePriceId: "price_test_forge_overage",
    overageRateUsd: 12,
    limits: {
      maxSeats: 10,
      maxPrograms: 5,
      maxSessionsPerMonth: 50,
    },
    features: ["sandbox", "analysis"],
    isPublic: true,
    sortOrder: 2,
    buyingMotion: "self_serve" as const,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// incrementSessionCount
// ---------------------------------------------------------------------------

describe("usageCounters.incrementSessionCount", () => {
  test("creates usagePeriod if none exists, increments sandboxSessionCount to 1", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription());
      await ctx.db.insert("pricingPlans", makePricingPlan());
    });

    await t.mutation(internalAny.billing.usageCounters.incrementSessionCount, { orgId: "org-1" });

    const period = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_period", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(period).not.toBeNull();
    expect(period.sandboxSessionCount).toBe(1);
    expect(period.overageSessionCount).toBe(0);
    expect(period.periodStart).toBe(PERIOD_START);
    expect(period.periodEnd).toBe(PERIOD_END);
  });

  test("when at plan limit, increments overageSessionCount", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription());
      await ctx.db.insert(
        "pricingPlans",
        makePricingPlan({
          limits: { maxSeats: 10, maxPrograms: 5, maxSessionsPerMonth: 2 },
        }),
      );
      // Pre-seed a usage period already at the limit
      await ctx.db.insert("usagePeriods", {
        orgId: "org-1",
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        sandboxSessionCount: 2,
        documentAnalysisCount: 0,
        videoAnalysisCount: 0,
        totalAiCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheCreationTokens: 0,
        overageSessionCount: 0,
        overageReportedToStripe: false,
        lastUpdatedAt: NOW,
      });
    });

    await t.mutation(internalAny.billing.usageCounters.incrementSessionCount, { orgId: "org-1" });

    const period = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_period", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(period).not.toBeNull();
    expect(period.sandboxSessionCount).toBe(3);
    expect(period.overageSessionCount).toBe(1); // 3 - 2 (limit) = 1
  });
});

// ---------------------------------------------------------------------------
// incrementAnalysisCount
// ---------------------------------------------------------------------------

describe("usageCounters.incrementAnalysisCount", () => {
  test("increments documentAnalysisCount for type document", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription());
      await ctx.db.insert("pricingPlans", makePricingPlan());
    });

    await t.mutation(internalAny.billing.usageCounters.incrementAnalysisCount, {
      orgId: "org-1",
      type: "document" as const,
    });

    const period = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_period", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(period).not.toBeNull();
    expect(period.documentAnalysisCount).toBe(1);
    expect(period.videoAnalysisCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCurrentUsage
// ---------------------------------------------------------------------------

describe("usageCounters.getCurrentUsage", () => {
  test("returns current period data (public query with auth)", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription());
      await ctx.db.insert("usagePeriods", {
        orgId: "org-1",
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        sandboxSessionCount: 5,
        documentAnalysisCount: 3,
        videoAnalysisCount: 1,
        totalAiCostUsd: 1.5,
        totalInputTokens: 10000,
        totalOutputTokens: 5000,
        totalCacheReadTokens: 2000,
        totalCacheCreationTokens: 1000,
        overageSessionCount: 0,
        overageReportedToStripe: false,
        lastUpdatedAt: NOW,
      });
    });

    const result = await asUser.query(apiAny.billing.usageCounters.getCurrentUsage, {
      orgId: "org-1",
    });

    expect(result).not.toBeNull();
    expect(result.sandboxSessionCount).toBe(5);
    expect(result.documentAnalysisCount).toBe(3);
    expect(result.totalAiCostUsd).toBe(1.5);
  });

  test("returns null when no subscription", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const result = await asUser.query(apiAny.billing.usageCounters.getCurrentUsage, {
      orgId: "org-1",
    });

    expect(result).toBeNull();
  });
});
