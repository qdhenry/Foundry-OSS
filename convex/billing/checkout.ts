"use node";

import { ConvexError, v } from "convex/values";
import Stripe from "stripe";
import * as generatedApi from "../_generated/api";
import { action } from "../_generated/server";

const internal: any = (generatedApi as any).internal;

/**
 * Creates a Stripe Checkout session for self-serve subscription signup.
 * Supports Crucible and Forge tiers (Foundry is annual_contract / sales-led).
 */
export const createCheckoutSession = action({
  args: {
    orgId: v.string(),
    planSlug: v.union(v.literal("crucible"), v.literal("forge")),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Auth check — verifies the caller belongs to this org and returns user data
    const user: any = await ctx.runQuery(internal.billing.subscriptions.assertOrgAccessAndGetUser, {
      orgId: args.orgId,
    });

    // 2. Check no active subscription exists
    const existing: any = await ctx.runQuery(
      internal.billing.subscriptions.getOrgSubscriptionInternal,
      { orgId: args.orgId },
    );
    if (existing && existing.status === "active") {
      throw new ConvexError("Organization already has an active subscription");
    }

    // 3. Get plan details
    const plan: any = await ctx.runQuery(internal.billing.plans.getPlanBySlugInternal, {
      slug: args.planSlug,
    });
    if (!plan) throw new ConvexError("Plan not found");

    // 4. Create or retrieve Stripe customer (lookup by orgId metadata)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    let stripeCustomerId: string;

    const existingCustomers = await stripe.customers.search({
      query: `metadata["orgId"]:"${args.orgId}"`,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        metadata: { orgId: args.orgId },
        email: user.email ?? undefined,
        name: user.name ?? undefined,
      });
      stripeCustomerId = customer.id;
    }

    // 5. Create Checkout Session with base price + metered overage
    const session: any = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        { price: plan.stripePriceId, quantity: 1 },
        { price: plan.stripeOveragePriceId }, // metered — no quantity
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: { orgId: args.orgId, planSlug: args.planSlug },
      subscription_data: {
        metadata: { orgId: args.orgId, planSlug: args.planSlug },
      },
    });

    return { url: session.url };
  },
});

/**
 * Creates a Stripe Customer Portal session for existing subscribers.
 * Allows managing payment methods, viewing invoices, and canceling.
 */
export const createCustomerPortalSession = action({
  args: {
    orgId: v.string(),
    returnUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Auth check
    await ctx.runQuery(internal.billing.subscriptions.assertOrgAccessAndGetUser, {
      orgId: args.orgId,
    });

    // 2. Get the subscription to find the Stripe customer ID
    const subscription: any = await ctx.runQuery(
      internal.billing.subscriptions.getOrgSubscriptionInternal,
      { orgId: args.orgId },
    );
    if (!subscription) {
      throw new ConvexError("No subscription found for this organization");
    }

    // 3. Create billing portal session
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const portalSession: any = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: args.returnUrl,
    });

    return { url: portalSession.url };
  },
});
