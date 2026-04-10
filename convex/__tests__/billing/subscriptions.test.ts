import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

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

  const otherUserId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-2",
      email: "user2@example.com",
      name: "User Two",
      orgIds: ["org-2"],
      role: "admin",
    });
  });

  return { userId, otherUserId };
}

const NOW = Date.now();
const PERIOD_START = NOW - 15 * 24 * 60 * 60 * 1000; // 15 days ago
const PERIOD_END = NOW + 15 * 24 * 60 * 60 * 1000; // 15 days from now

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

// ---------------------------------------------------------------------------
// getOrgSubscription
// ---------------------------------------------------------------------------

describe("subscriptions.getOrgSubscription", () => {
  test("returns null when no subscription exists", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const result = await asUser.query(apiAny.billing.subscriptions.getOrgSubscription, {
      orgId: "org-1",
    });
    expect(result).toBeNull();
  });

  test("returns subscription when one exists for org", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription());
    });

    const result = await asUser.query(apiAny.billing.subscriptions.getOrgSubscription, {
      orgId: "org-1",
    });
    expect(result).not.toBeNull();
    expect(result.orgId).toBe("org-1");
    expect(result.planSlug).toBe("forge");
    expect(result.status).toBe("active");
    expect(result.stripeCustomerId).toBe("cus_test_123");
    expect(result.stripeSubscriptionId).toBe("sub_test_123");
  });

  test("requires auth (throws without identity)", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);

    // No withIdentity — unauthenticated
    await expect(
      t.query(apiAny.billing.subscriptions.getOrgSubscription, {
        orgId: "org-1",
      }),
    ).rejects.toThrow();
  });

  test("cross-org isolation (user in org-1 cannot see org-2 sub)", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser1 = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription({ orgId: "org-2" }));
    });

    await expect(
      asUser1.query(apiAny.billing.subscriptions.getOrgSubscription, {
        orgId: "org-2",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ---------------------------------------------------------------------------
// getOrgBillingState
// ---------------------------------------------------------------------------

describe("subscriptions.getOrgBillingState", () => {
  test("returns { subscription: null, trial, plan: null, usage: null } for trial-only org", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 2,
        sessionsLimit: 5,
        programsUsed: 1,
        programsLimit: 1,
        startedAt: NOW - 3 * 24 * 60 * 60 * 1000,
      });
    });

    const result = await asUser.query(apiAny.billing.subscriptions.getOrgBillingState, {
      orgId: "org-1",
    });
    expect(result.subscription).toBeNull();
    expect(result.trial).not.toBeNull();
    expect(result.trial.orgId).toBe("org-1");
    expect(result.trial.sessionsUsed).toBe(2);
    expect(result.plan).toBeNull();
    expect(result.usage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createSubscription (internal mutation)
// ---------------------------------------------------------------------------

describe("subscriptions.createSubscription", () => {
  test("inserts record with correct fields", async () => {
    const t = convexTest(schema, modules);

    const subData = makeSubscription();
    await t.mutation(internalAny.billing.subscriptions.createSubscription, subData);

    const sub = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(sub).not.toBeNull();
    expect(sub.orgId).toBe("org-1");
    expect(sub.stripeCustomerId).toBe("cus_test_123");
    expect(sub.stripeSubscriptionId).toBe("sub_test_123");
    expect(sub.planSlug).toBe("forge");
    expect(sub.status).toBe("active");
    expect(sub.currentPeriodStart).toBe(PERIOD_START);
    expect(sub.currentPeriodEnd).toBe(PERIOD_END);
    expect(sub.cancelAtPeriodEnd).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateSubscriptionStatus (internal mutation)
// ---------------------------------------------------------------------------

describe("subscriptions.updateSubscriptionStatus", () => {
  test("updates status by stripeSubscriptionId", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription());
    });

    await t.mutation(internalAny.billing.subscriptions.updateSubscriptionStatus, {
      stripeSubscriptionId: "sub_test_123",
      status: "past_due" as const,
    });

    const sub = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_stripe_subscription", (q: any) =>
          q.eq("stripeSubscriptionId", "sub_test_123"),
        )
        .first();
    });

    expect(sub).not.toBeNull();
    expect(sub.status).toBe("past_due");
  });
});

// ---------------------------------------------------------------------------
// markSubscriptionCanceled (internal mutation)
// ---------------------------------------------------------------------------

describe("subscriptions.markSubscriptionCanceled", () => {
  test("sets status to canceled", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", makeSubscription());
    });

    await t.mutation(internalAny.billing.subscriptions.markSubscriptionCanceled, {
      stripeSubscriptionId: "sub_test_123",
    });

    const sub = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_stripe_subscription", (q: any) =>
          q.eq("stripeSubscriptionId", "sub_test_123"),
        )
        .first();
    });

    expect(sub).not.toBeNull();
    expect(sub.status).toBe("canceled");
  });
});
