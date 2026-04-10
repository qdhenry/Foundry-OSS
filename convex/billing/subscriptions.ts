import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";
import { planSlugValidator } from "./validators";

const subscriptionStatusValidator = v.union(
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("unpaid"),
  v.literal("incomplete"),
  v.literal("paused"),
);

// ---------------------------------------------------------------------------
// Public queries (with assertOrgAccess)
// ---------------------------------------------------------------------------

/** Returns the subscription record for an org, or null if none exists. */
export const getOrgSubscription = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
  },
});

/**
 * Combined billing state query.
 * Returns subscription + trial + plan + current usage period in one call
 * so the frontend avoids a waterfall of separate queries.
 */
export const getOrgBillingState = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    const trial = await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    let plan = null;
    if (subscription) {
      plan = await ctx.db
        .query("pricingPlans")
        .withIndex("by_slug", (q) => q.eq("slug", subscription.planSlug))
        .first();
    }

    // Get the current usage period (most recent one for the active subscription period)
    const currentPeriodStart = subscription?.currentPeriodStart ?? 0;
    const usage = await ctx.db
      .query("usagePeriods")
      .withIndex("by_org_period", (q) =>
        q.eq("orgId", args.orgId).gte("periodStart", currentPeriodStart),
      )
      .first();

    return { subscription, trial, plan, usage };
  },
});

// ---------------------------------------------------------------------------
// Internal queries (for actions — no auth check, actions handle auth separately)
// ---------------------------------------------------------------------------

/**
 * Verifies the caller has access to the org and returns user data (email, name)
 * for populating Stripe customer records.
 */
export const assertOrgAccessAndGetUser = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new ConvexError("User not found");

    const jwtOrgId = (identity as any).org_id as string | undefined;
    if (!user.orgIds.includes(args.orgId) && jwtOrgId !== args.orgId) {
      throw new ConvexError("Access denied");
    }

    return {
      _id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      clerkId: user.clerkId,
    };
  },
});

/** Same as getOrgSubscription but without auth check — for use by actions. */
export const getOrgSubscriptionInternal = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
  },
});

/** Returns all active subscriptions. Used by reportAllOverages to iterate orgs. */
export const listActiveSubscriptions = internalQuery({
  handler: async (ctx) => {
    const subs = await ctx.db.query("subscriptions").collect();
    return subs.filter((s) => s.status === "active");
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (for webhook processor)
// ---------------------------------------------------------------------------

/** Creates a new subscription record. Called when checkout.session.completed fires. */
export const createSubscription = internalMutation({
  args: {
    orgId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    planSlug: planSlugValidator,
    status: subscriptionStatusValidator,
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    trialEnd: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Upsert — if subscription already exists for this org, patch instead of duplicate insert
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        planSlug: args.planSlug,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        trialEnd: args.trialEnd,
        metadata: args.metadata,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      orgId: args.orgId,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      planSlug: args.planSlug,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      trialEnd: args.trialEnd,
      metadata: args.metadata,
    });
  },
});

/** Updates subscription status and period dates. Called on invoice.paid, subscription.updated, etc. */
export const updateSubscriptionStatus = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: subscriptionStatusValidator,
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    planSlug: v.optional(planSlugValidator),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .first();

    if (!subscription) {
      throw new ConvexError(`Subscription not found: ${args.stripeSubscriptionId}`);
    }

    const updates: Record<string, unknown> = { status: args.status };
    if (args.currentPeriodStart !== undefined) {
      updates.currentPeriodStart = args.currentPeriodStart;
    }
    if (args.currentPeriodEnd !== undefined) {
      updates.currentPeriodEnd = args.currentPeriodEnd;
    }
    if (args.cancelAtPeriodEnd !== undefined) {
      updates.cancelAtPeriodEnd = args.cancelAtPeriodEnd;
    }
    if (args.planSlug !== undefined) {
      updates.planSlug = args.planSlug;
    }

    await ctx.db.patch(subscription._id, updates);
  },
});

/** Marks a subscription as canceled. Called when customer.subscription.deleted fires. */
export const markSubscriptionCanceled = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .first();

    if (!subscription) {
      // Graceful no-op — subscription may already be cleaned up
      return;
    }

    await ctx.db.patch(subscription._id, { status: "canceled" });
  },
});
