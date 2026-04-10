import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

// ---------------------------------------------------------------------------
// Helper: get or create the usagePeriods record for the current billing period
// ---------------------------------------------------------------------------

interface SubscriptionPeriod {
  currentPeriodStart: number;
  currentPeriodEnd: number;
}

async function getOrCreateCurrentPeriod(
  ctx: MutationCtx,
  orgId: string,
  subscription: SubscriptionPeriod,
) {
  const existing = await ctx.db
    .query("usagePeriods")
    .withIndex("by_org_period", (q) =>
      q.eq("orgId", orgId).gte("periodStart", subscription.currentPeriodStart),
    )
    .first();

  if (existing) return existing;

  const id = await ctx.db.insert("usagePeriods", {
    orgId,
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

  // Return the full document so callers can read fields + _id
  return (await ctx.db.get(id))!;
}

// ---------------------------------------------------------------------------
// Internal mutations (called by other Convex functions)
// ---------------------------------------------------------------------------

/**
 * Increment sandbox session count for the current billing period.
 * Called when a sandbox session is created.
 */
export const incrementSessionCount = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    // No subscription means trial — tracked separately in trialState
    if (!subscription) return;

    const period = await getOrCreateCurrentPeriod(ctx, args.orgId, subscription);
    const newCount = period.sandboxSessionCount + 1;

    // Determine plan's included sessions
    const plan = await ctx.db
      .query("pricingPlans")
      .withIndex("by_slug", (q) => q.eq("slug", subscription.planSlug))
      .first();

    const included = plan?.limits.maxSessionsPerMonth ?? 50;
    const newOverage = Math.max(0, newCount - included);

    await ctx.db.patch(period._id, {
      sandboxSessionCount: newCount,
      overageSessionCount: newOverage,
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Increment document or video analysis count for the current billing period.
 * Called when an analysis completes.
 */
export const incrementAnalysisCount = internalMutation({
  args: {
    orgId: v.string(),
    type: v.union(v.literal("document"), v.literal("video")),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!subscription) return;

    const period = await getOrCreateCurrentPeriod(ctx, args.orgId, subscription);

    if (args.type === "document") {
      await ctx.db.patch(period._id, {
        documentAnalysisCount: period.documentAnalysisCount + 1,
        lastUpdatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(period._id, {
        videoAnalysisCount: period.videoAnalysisCount + 1,
        lastUpdatedAt: Date.now(),
      });
    }
  },
});

/**
 * Add AI cost and token usage to the current billing period totals.
 * Called alongside recordAiUsage to accumulate period-level aggregates.
 */
export const addAiCost = internalMutation({
  args: {
    orgId: v.string(),
    costUsd: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheCreationTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!subscription) return;

    const period = await getOrCreateCurrentPeriod(ctx, args.orgId, subscription);

    await ctx.db.patch(period._id, {
      totalAiCostUsd: period.totalAiCostUsd + args.costUsd,
      totalInputTokens: period.totalInputTokens + args.inputTokens,
      totalOutputTokens: period.totalOutputTokens + args.outputTokens,
      totalCacheReadTokens: period.totalCacheReadTokens + args.cacheReadTokens,
      totalCacheCreationTokens: period.totalCacheCreationTokens + args.cacheCreationTokens,
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Mark overage as reported to Stripe on a specific usagePeriods record.
 * Called by overageReporting after Stripe API call succeeds.
 */
export const markOverageReported = internalMutation({
  args: { usagePeriodId: v.id("usagePeriods") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.usagePeriodId, {
      overageReportedToStripe: true,
      lastUpdatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Public query (with assertOrgAccess)
// ---------------------------------------------------------------------------

/**
 * Returns the current billing period usage for an org.
 * Used by the billing UI to render progress bars ("47 of 50 sessions").
 */
export const getCurrentUsage = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!subscription) return null;

    return await ctx.db
      .query("usagePeriods")
      .withIndex("by_org_period", (q) =>
        q.eq("orgId", args.orgId).gte("periodStart", subscription.currentPeriodStart),
      )
      .first();
  },
});

// ---------------------------------------------------------------------------
// Internal query (for actions — no auth check)
// ---------------------------------------------------------------------------

/**
 * Same as getCurrentUsage but without assertOrgAccess.
 * Used by internalActions (e.g., overageReporting) that handle auth separately.
 */
export const getCurrentUsageInternal = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!subscription) return null;

    return await ctx.db
      .query("usagePeriods")
      .withIndex("by_org_period", (q) =>
        q.eq("orgId", args.orgId).gte("periodStart", subscription.currentPeriodStart),
      )
      .first();
  },
});
