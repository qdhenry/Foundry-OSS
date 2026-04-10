import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { planSlugValidator } from "./validators";

// ---------------------------------------------------------------------------
// Stripe Webhook Event Processor
//
// Follows the durable event buffer pattern:
//   1. HTTP handler stores raw event in billingEvents (status: "pending")
//   2. processEvent action routes by event type, calls handler mutations
//   3. On success: status -> "processed"; on failure: status -> "failed"
//
// Idempotent — duplicate stripeEventId is rejected at the HTTP layer.
// All DB writes use .withIndex(), never .filter().
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Check if a Stripe event has already been stored (idempotency guard) */
export const getEventByStripeId = internalQuery({
  args: { stripeEventId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("billingEvents")
      .withIndex("by_stripe_event", (q) => q.eq("stripeEventId", args.stripeEventId))
      .first();
  },
});

/** Load a billing event by its Convex document ID */
export const getEventById = internalQuery({
  args: { eventId: v.id("billingEvents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});

// ---------------------------------------------------------------------------
// Mutations — event lifecycle
// ---------------------------------------------------------------------------

/** Store a raw Stripe event with status "pending" */
export const storeEvent = internalMutation({
  args: {
    stripeEventId: v.string(),
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("billingEvents", {
      stripeEventId: args.stripeEventId,
      eventType: args.eventType,
      status: "pending",
      payload: args.payload,
      receivedAt: Date.now(),
    });
  },
});

/** Mark event as successfully processed */
export const markEventProcessed = internalMutation({
  args: { eventId: v.id("billingEvents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, {
      status: "processed",
      processedAt: Date.now(),
    });
  },
});

/** Mark event as failed with error message */
export const markEventFailed = internalMutation({
  args: {
    eventId: v.id("billingEvents"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, {
      status: "failed",
      error: args.error,
      processedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Mutations — subscription lifecycle
// ---------------------------------------------------------------------------

/** Create a new subscription record from checkout completion */
export const createSubscription = internalMutation({
  args: {
    orgId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    planSlug: planSlugValidator,
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    trialEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if subscription already exists (idempotency)
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .first();

    if (existing) {
      // Update existing rather than duplicate
      await ctx.db.patch(existing._id, {
        status: args.status as any,
        planSlug: args.planSlug,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        trialEnd: args.trialEnd,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      orgId: args.orgId,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      planSlug: args.planSlug,
      status: args.status as any,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      trialEnd: args.trialEnd,
    });
  },
});

/** Update subscription fields by stripeSubscriptionId */
export const updateSubscriptionFields = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    updates: v.object({
      status: v.optional(v.string()),
      planSlug: v.optional(planSlugValidator),
      currentPeriodStart: v.optional(v.number()),
      currentPeriodEnd: v.optional(v.number()),
      cancelAtPeriodEnd: v.optional(v.boolean()),
      trialEnd: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .first();

    if (!subscription) {
      console.warn(`[stripe-webhook] Subscription not found: ${args.stripeSubscriptionId}`);
      return;
    }

    const patch: Record<string, any> = {};
    if (args.updates.status !== undefined) patch.status = args.updates.status;
    if (args.updates.planSlug !== undefined) patch.planSlug = args.updates.planSlug;
    if (args.updates.currentPeriodStart !== undefined)
      patch.currentPeriodStart = args.updates.currentPeriodStart;
    if (args.updates.currentPeriodEnd !== undefined)
      patch.currentPeriodEnd = args.updates.currentPeriodEnd;
    if (args.updates.cancelAtPeriodEnd !== undefined)
      patch.cancelAtPeriodEnd = args.updates.cancelAtPeriodEnd;
    if (args.updates.trialEnd !== undefined) patch.trialEnd = args.updates.trialEnd;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(subscription._id, patch);
    }
  },
});

/** Mark a trial as converted */
export const markTrialConverted = internalMutation({
  args: {
    orgId: v.string(),
    planSlug: planSlugValidator,
  },
  handler: async (ctx, args) => {
    const trial = await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (trial && !trial.convertedAt) {
      await ctx.db.patch(trial._id, {
        convertedAt: Date.now(),
        convertedToPlan: args.planSlug,
      });
    }
  },
});

/** Update the orgId on a billing event after we resolve it from checkout metadata */
export const updateEventOrgId = internalMutation({
  args: {
    eventId: v.id("billingEvents"),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { orgId: args.orgId });
  },
});

// ---------------------------------------------------------------------------
// Main processor — internalAction (can call external APIs if needed)
// ---------------------------------------------------------------------------

export const processEvent = internalAction({
  args: { eventId: v.id("billingEvents") },
  handler: async (ctx, args) => {
    // 1. Load event
    const event = await ctx.runQuery(internal.billing.webhookProcessor.getEventById, {
      eventId: args.eventId,
    });

    if (!event) {
      console.error(`[stripe-webhook] Event ${args.eventId} not found`);
      return;
    }

    // Skip already-processed events
    if (event.status === "processed") {
      return;
    }

    try {
      const payload = event.payload as Record<string, any>;
      const dataObject = payload.data?.object ?? {};

      // 2. Route by event type
      switch (event.eventType) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(ctx, args.eventId, dataObject);
          break;

        case "invoice.paid":
          await handleInvoicePaid(ctx, dataObject);
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(ctx, dataObject);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(ctx, dataObject);
          break;

        case "invoice.payment_failed":
          await handlePaymentFailed(ctx, dataObject);
          break;

        default:
          // Log unhandled event types but still mark as processed
          console.log(`[stripe-webhook] Unhandled event type: ${event.eventType}`);
          break;
      }

      // 3. Mark as processed
      await ctx.runMutation(internal.billing.webhookProcessor.markEventProcessed, {
        eventId: args.eventId,
      });
    } catch (error: any) {
      console.error(`[stripe-webhook] Failed to process event ${args.eventId}:`, error);

      // 4. Mark as failed with error
      await ctx.runMutation(internal.billing.webhookProcessor.markEventFailed, {
        eventId: args.eventId,
        error: error?.message ?? String(error),
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

/**
 * checkout.session.completed
 * Fired when a customer completes Stripe Checkout.
 * Extracts metadata.orgId and metadata.planSlug (set during checkout creation),
 * creates a subscription record, and marks the trial as converted.
 */
async function handleCheckoutCompleted(ctx: any, eventId: any, session: Record<string, any>) {
  const orgId = session.metadata?.orgId;
  const planSlug = session.metadata?.planSlug;
  const stripeCustomerId = session.customer;
  const stripeSubscriptionId = session.subscription;

  if (!orgId || !planSlug || !stripeCustomerId || !stripeSubscriptionId) {
    console.warn("[stripe-webhook] checkout.session.completed missing required fields", {
      orgId,
      planSlug,
      stripeCustomerId,
      stripeSubscriptionId,
    });
    return;
  }

  // Tag the billing event with the resolved orgId
  await ctx.runMutation(internal.billing.webhookProcessor.updateEventOrgId, { eventId, orgId });

  // Create or update subscription record
  // Period dates come from the subscription object; use checkout timestamp as fallback
  const now = Math.floor(Date.now() / 1000);
  const periodStart = session.current_period_start ?? now;
  const periodEnd = session.current_period_end ?? now + 30 * 24 * 60 * 60; // 30-day fallback

  await ctx.runMutation(internal.billing.webhookProcessor.createSubscription, {
    orgId,
    stripeCustomerId,
    stripeSubscriptionId,
    planSlug,
    status: "active",
    currentPeriodStart: periodStart * 1000, // Convert to ms
    currentPeriodEnd: periodEnd * 1000,
    cancelAtPeriodEnd: false,
  });

  // Mark trial as converted
  await ctx.runMutation(internal.billing.webhookProcessor.markTrialConverted, { orgId, planSlug });
}

/**
 * invoice.paid
 * Fired when an invoice payment succeeds (initial + recurring).
 * Updates subscription status to "active" and refreshes period dates.
 */
async function handleInvoicePaid(ctx: any, invoice: Record<string, any>) {
  const stripeSubscriptionId = invoice.subscription;
  if (!stripeSubscriptionId) return;

  const updates: Record<string, any> = {
    status: "active",
  };

  // Update period dates from the invoice's period
  if (invoice.period_start) {
    updates.currentPeriodStart = invoice.period_start * 1000;
  }
  if (invoice.period_end) {
    updates.currentPeriodEnd = invoice.period_end * 1000;
  }

  await ctx.runMutation(internal.billing.webhookProcessor.updateSubscriptionFields, {
    stripeSubscriptionId,
    updates,
  });
}

/**
 * customer.subscription.updated
 * Fired when a subscription is changed (plan upgrade/downgrade, status change, etc.).
 * Syncs all relevant fields from the Stripe subscription object.
 */
async function handleSubscriptionUpdated(ctx: any, subscription: Record<string, any>) {
  const stripeSubscriptionId = subscription.id;
  if (!stripeSubscriptionId) return;

  const updates: Record<string, any> = {};

  if (subscription.status) {
    updates.status = subscription.status;
  }
  if (subscription.current_period_start) {
    updates.currentPeriodStart = subscription.current_period_start * 1000;
  }
  if (subscription.current_period_end) {
    updates.currentPeriodEnd = subscription.current_period_end * 1000;
  }
  if (subscription.cancel_at_period_end !== undefined) {
    updates.cancelAtPeriodEnd = subscription.cancel_at_period_end;
  }
  if (subscription.trial_end) {
    updates.trialEnd = subscription.trial_end * 1000;
  }

  // Detect plan change via items array
  const newPriceId = subscription.items?.data?.[0]?.price?.id;
  if (newPriceId) {
    // We store the planSlug in metadata during checkout; for plan changes
    // the metadata on the subscription itself carries it
    const planSlug = subscription.metadata?.planSlug;
    if (planSlug) {
      updates.planSlug = planSlug;
    }
  }

  await ctx.runMutation(internal.billing.webhookProcessor.updateSubscriptionFields, {
    stripeSubscriptionId,
    updates,
  });
}

/**
 * customer.subscription.deleted
 * Fired when a subscription is canceled (immediate or at period end).
 * Sets status to "canceled".
 */
async function handleSubscriptionDeleted(ctx: any, subscription: Record<string, any>) {
  const stripeSubscriptionId = subscription.id;
  if (!stripeSubscriptionId) return;

  await ctx.runMutation(internal.billing.webhookProcessor.updateSubscriptionFields, {
    stripeSubscriptionId,
    updates: { status: "canceled" },
  });
}

/**
 * invoice.payment_failed
 * Fired when a payment attempt fails.
 * Sets subscription status to "past_due".
 */
async function handlePaymentFailed(ctx: any, invoice: Record<string, any>) {
  const stripeSubscriptionId = invoice.subscription;
  if (!stripeSubscriptionId) return;

  await ctx.runMutation(internal.billing.webhookProcessor.updateSubscriptionFields, {
    stripeSubscriptionId,
    updates: { status: "past_due" },
  });
}
