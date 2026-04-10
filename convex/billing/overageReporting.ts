"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

/**
 * Reports metered overage usage to Stripe for a single org.
 * Called by a cron job or triggered by the invoice.upcoming webhook.
 *
 * Uses the Stripe Billing Meters API (v2+) — each overage session is reported
 * as a meter event. Stripe accumulates events for the billing period.
 *
 * Flow:
 * 1. Fetch subscription (must be active)
 * 2. Fetch current usage period (must have overage, not yet reported)
 * 3. Report overage via stripe.billing.meterEvents.create()
 * 4. Mark overageReportedToStripe=true so we don't double-report
 */
export const reportOverageUsage = internalAction({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    // 1. Get subscription
    const subscription = await ctx.runQuery(
      internal.billing.subscriptions.getOrgSubscriptionInternal as any,
      { orgId: args.orgId },
    );
    if (!subscription || subscription.status !== "active") return;

    // 2. Get current usage period
    const usage = await ctx.runQuery(internal.billing.usageCounters.getCurrentUsageInternal, {
      orgId: args.orgId,
    });
    if (!usage || usage.overageSessionCount <= 0) return;
    if (usage.overageReportedToStripe) return; // already reported

    // 3. Report to Stripe via Billing Meters API
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // The meter event_name must match the meter configured in Stripe Dashboard.
    // FOUNDRY_OVERAGE_SESSIONS is the expected meter name for sandbox session overages.
    await stripe.billing.meterEvents.create({
      event_name: "foundry_session_overage",
      payload: {
        stripe_customer_id: subscription.stripeCustomerId,
        value: String(usage.overageSessionCount),
      },
      timestamp: Math.floor(Date.now() / 1000),
    });

    // 4. Mark as reported
    await ctx.runMutation(internal.billing.usageCounters.markOverageReported, {
      usagePeriodId: usage._id,
    });

    console.log(
      `[billing] Reported ${usage.overageSessionCount} overage sessions to Stripe for org ${args.orgId}`,
    );
  },
});

/**
 * Reports overage usage for ALL active subscriptions.
 * Called by the daily cron job to ensure Stripe has up-to-date metered usage.
 */
export const reportAllOverages = internalAction({
  handler: async (ctx) => {
    const activeSubscriptions = await ctx.runQuery(
      internal.billing.subscriptions.listActiveSubscriptions,
    );

    for (const subscription of activeSubscriptions) {
      try {
        await ctx.runAction(internal.billing.overageReporting.reportOverageUsage, {
          orgId: subscription.orgId,
        });
      } catch (error) {
        // Log but don't fail the entire batch for one org's error
        console.error(`[billing] Failed to report overage for org ${subscription.orgId}:`, error);
      }
    }

    console.log(
      `[billing] Overage reporting complete for ${activeSubscriptions.length} active subscriptions`,
    );
  },
});
