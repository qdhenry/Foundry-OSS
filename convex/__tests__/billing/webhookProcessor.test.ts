import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

const NOW = Date.now();
const PERIOD_START = NOW - 15 * 24 * 60 * 60 * 1000;
const PERIOD_END = NOW + 15 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// getEventByStripeId
// ---------------------------------------------------------------------------

describe("webhookProcessor.getEventByStripeId", () => {
  test("returns null for unknown ID", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(internalAny.billing.webhookProcessor.getEventByStripeId, {
      stripeEventId: "evt_nonexistent",
    });

    expect(result).toBeNull();
  });

  test("returns event for known ID", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("billingEvents", {
        stripeEventId: "evt_test_123",
        eventType: "checkout.session.completed",
        status: "pending" as const,
        payload: { data: { object: {} } },
        receivedAt: NOW,
      });
    });

    const result = await t.query(internalAny.billing.webhookProcessor.getEventByStripeId, {
      stripeEventId: "evt_test_123",
    });

    expect(result).not.toBeNull();
    expect(result.stripeEventId).toBe("evt_test_123");
    expect(result.eventType).toBe("checkout.session.completed");
    expect(result.status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// storeEvent
// ---------------------------------------------------------------------------

describe("webhookProcessor.storeEvent", () => {
  test("inserts billingEvent with status pending", async () => {
    const t = convexTest(schema, modules);

    const before = Date.now();

    await t.mutation(internalAny.billing.webhookProcessor.storeEvent, {
      stripeEventId: "evt_store_test",
      eventType: "invoice.paid",
      payload: { data: { object: { subscription: "sub_123" } } },
    });

    const after = Date.now();

    const event = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("billingEvents")
        .withIndex("by_stripe_event", (q: any) => q.eq("stripeEventId", "evt_store_test"))
        .first();
    });

    expect(event).not.toBeNull();
    expect(event.stripeEventId).toBe("evt_store_test");
    expect(event.eventType).toBe("invoice.paid");
    expect(event.status).toBe("pending");
    expect(event.payload).toEqual({
      data: { object: { subscription: "sub_123" } },
    });
    expect(event.receivedAt).toBeGreaterThanOrEqual(before);
    expect(event.receivedAt).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// markEventProcessed
// ---------------------------------------------------------------------------

describe("webhookProcessor.markEventProcessed", () => {
  test("updates status to processed and sets processedAt", async () => {
    const t = convexTest(schema, modules);

    const eventId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("billingEvents", {
        stripeEventId: "evt_proc_test",
        eventType: "invoice.paid",
        status: "pending" as const,
        payload: {},
        receivedAt: NOW,
      });
    });

    const before = Date.now();

    await t.mutation(internalAny.billing.webhookProcessor.markEventProcessed, { eventId });

    const after = Date.now();

    const event = await t.run(async (ctx: any) => {
      return await ctx.db.get(eventId);
    });

    expect(event).not.toBeNull();
    expect(event.status).toBe("processed");
    expect(event.processedAt).toBeDefined();
    expect(event.processedAt).toBeGreaterThanOrEqual(before);
    expect(event.processedAt).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// markEventFailed
// ---------------------------------------------------------------------------

describe("webhookProcessor.markEventFailed", () => {
  test("updates status to failed and sets error message", async () => {
    const t = convexTest(schema, modules);

    const eventId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("billingEvents", {
        stripeEventId: "evt_fail_test",
        eventType: "invoice.payment_failed",
        status: "pending" as const,
        payload: {},
        receivedAt: NOW,
      });
    });

    await t.mutation(internalAny.billing.webhookProcessor.markEventFailed, {
      eventId,
      error: "Payment method declined",
    });

    const event = await t.run(async (ctx: any) => {
      return await ctx.db.get(eventId);
    });

    expect(event).not.toBeNull();
    expect(event.status).toBe("failed");
    expect(event.error).toBe("Payment method declined");
    expect(event.processedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// createSubscription
// ---------------------------------------------------------------------------

describe("webhookProcessor.createSubscription", () => {
  test("creates subscription record", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internalAny.billing.webhookProcessor.createSubscription, {
      orgId: "org-1",
      stripeCustomerId: "cus_wp_test",
      stripeSubscriptionId: "sub_wp_test",
      planSlug: "forge" as const,
      status: "active",
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: false,
    });

    const sub = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_stripe_subscription", (q: any) =>
          q.eq("stripeSubscriptionId", "sub_wp_test"),
        )
        .first();
    });

    expect(sub).not.toBeNull();
    expect(sub.orgId).toBe("org-1");
    expect(sub.stripeCustomerId).toBe("cus_wp_test");
    expect(sub.planSlug).toBe("forge");
    expect(sub.status).toBe("active");
    expect(sub.currentPeriodStart).toBe(PERIOD_START);
    expect(sub.currentPeriodEnd).toBe(PERIOD_END);
    expect(sub.cancelAtPeriodEnd).toBe(false);
  });

  test("idempotent (updates existing if same stripeSubscriptionId)", async () => {
    const t = convexTest(schema, modules);

    // Insert first subscription
    await t.mutation(internalAny.billing.webhookProcessor.createSubscription, {
      orgId: "org-1",
      stripeCustomerId: "cus_wp_test",
      stripeSubscriptionId: "sub_wp_idem",
      planSlug: "forge" as const,
      status: "active",
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: false,
    });

    // Call again with updated fields — same stripeSubscriptionId
    await t.mutation(internalAny.billing.webhookProcessor.createSubscription, {
      orgId: "org-1",
      stripeCustomerId: "cus_wp_test",
      stripeSubscriptionId: "sub_wp_idem",
      planSlug: "foundry" as const,
      status: "active",
      currentPeriodStart: PERIOD_START + 1000,
      currentPeriodEnd: PERIOD_END + 1000,
      cancelAtPeriodEnd: true,
    });

    // Should still be only one subscription
    const subs = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_stripe_subscription", (q: any) =>
          q.eq("stripeSubscriptionId", "sub_wp_idem"),
        )
        .collect();
    });

    expect(subs).toHaveLength(1);
    expect(subs[0].planSlug).toBe("foundry");
    expect(subs[0].cancelAtPeriodEnd).toBe(true);
    expect(subs[0].currentPeriodStart).toBe(PERIOD_START + 1000);
  });
});

// ---------------------------------------------------------------------------
// markTrialConverted
// ---------------------------------------------------------------------------

describe("webhookProcessor.markTrialConverted", () => {
  test("sets convertedAt on trial record", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 3,
        sessionsLimit: 5,
        programsUsed: 1,
        programsLimit: 1,
        startedAt: NOW - 10 * 24 * 60 * 60 * 1000,
      });
    });

    const before = Date.now();

    await t.mutation(internalAny.billing.webhookProcessor.markTrialConverted, {
      orgId: "org-1",
      planSlug: "forge" as const,
    });

    const after = Date.now();

    const trial = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("trialState")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(trial).not.toBeNull();
    expect(trial.convertedAt).toBeDefined();
    expect(trial.convertedAt).toBeGreaterThanOrEqual(before);
    expect(trial.convertedAt).toBeLessThanOrEqual(after);
    expect(trial.convertedToPlan).toBe("forge");
  });
});
