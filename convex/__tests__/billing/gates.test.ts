import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

async function seedUser(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "user1@example.com",
      name: "User One",
      orgIds: ["org-1"],
      role: "admin",
    });
  });
}

async function seedCruciblePlan(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("pricingPlans", {
      slug: "crucible",
      displayName: "Crucible",
      tagline: "For solo operators shipping fast",
      monthlyPriceUsd: 299,
      stripePriceId: "price_crucible_monthly",
      stripeOveragePriceId: "price_crucible_overage",
      overageRateUsd: 5,
      limits: { maxSeats: 1, maxPrograms: 5, maxSessionsPerMonth: 50 },
      features: ["All integrations"],
      isPublic: true,
      sortOrder: 1,
      buyingMotion: "self_serve",
    });
  });
}

async function seedForgePlan(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("pricingPlans", {
      slug: "forge",
      displayName: "Forge",
      tagline: "For teams that deliver together",
      monthlyPriceUsd: 1800,
      stripePriceId: "price_forge_monthly",
      stripeOveragePriceId: "price_forge_overage",
      overageRateUsd: 4,
      limits: { maxSeats: 10, maxPrograms: -1, maxSessionsPerMonth: 300 },
      features: ["All integrations"],
      isPublic: true,
      sortOrder: 2,
      buyingMotion: "sales_assisted",
    });
  });
}

async function seedSubscription(
  t: any,
  planSlug: "crucible" | "forge" | "foundry" = "crucible",
  status: string = "active",
) {
  const now = Date.now();
  await t.run(async (ctx: any) => {
    await ctx.db.insert("subscriptions", {
      orgId: "org-1",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      planSlug,
      status,
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
      cancelAtPeriodEnd: false,
    });
  });
  return now;
}

async function seedPrograms(t: any, count: number) {
  for (let i = 0; i < count; i++) {
    await t.run(async (ctx: any) => {
      await ctx.db.insert("programs", {
        orgId: "org-1",
        name: `Program ${i + 1}`,
        clientName: "Test Client",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "build",
        status: "active",
      });
    });
  }
}

async function seedUsagePeriod(
  t: any,
  periodStart: number,
  sessionCount: number,
  docCount: number = 0,
) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("usagePeriods", {
      orgId: "org-1",
      periodStart,
      periodEnd: periodStart + 30 * 24 * 60 * 60 * 1000,
      sandboxSessionCount: sessionCount,
      documentAnalysisCount: docCount,
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
  });
}

// ── Subscription gate checks (via checkPlanLimitsQuery) ─────────────

describe("billing.gates.checkPlanLimitsQuery — subscription limits", () => {
  test("programs under limit -> allowed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    await seedCruciblePlan(t);
    await seedSubscription(t, "crucible");
    await seedPrograms(t, 3); // 3 of 5 max

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "program",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
    expect(result.currentCount).toBe(3);
    expect(result.limit).toBe(5);
  });

  test("programs at limit -> blocked (hard limit)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    await seedCruciblePlan(t);
    await seedSubscription(t, "crucible");
    await seedPrograms(t, 5); // 5 of 5 max

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "program",
    });

    expect(result.allowed).toBe(false);
    expect(result.isOverage).toBe(false);
    expect(result.reason).toContain("Program limit reached");
    expect(result.currentCount).toBe(5);
    expect(result.limit).toBe(5);
  });

  test("sessions over limit -> allowed with isOverage=true (soft limit)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    await seedCruciblePlan(t);
    const periodStart = await seedSubscription(t, "crucible");
    await seedUsagePeriod(t, periodStart, 55); // 55 of 50 max

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "sandbox_session",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(true);
    expect(result.reason).toContain("Overage rate");
    expect(result.overageRate).toBe(5);
    expect(result.currentCount).toBe(55);
    expect(result.limit).toBe(50);
  });

  test("sessions under limit -> allowed, no overage", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    await seedCruciblePlan(t);
    const periodStart = await seedSubscription(t, "crucible");
    await seedUsagePeriod(t, periodStart, 20); // 20 of 50

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "sandbox_session",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
    expect(result.currentCount).toBe(20);
    expect(result.limit).toBe(50);
  });

  test("unlimited programs (-1) -> always allowed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    await seedForgePlan(t);
    await seedSubscription(t, "forge");
    await seedPrograms(t, 50); // forge has maxPrograms: -1

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "program",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
  });

  test("seat limit enforced (hard limit)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    await seedCruciblePlan(t);
    await seedSubscription(t, "crucible");

    // Crucible maxSeats=1, and we already have 1 user in org-1
    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "seat",
    });

    expect(result.allowed).toBe(false);
    expect(result.isOverage).toBe(false);
    expect(result.reason).toContain("Seat limit reached");
  });

  test("document_analysis counts against session budget with overage", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    await seedCruciblePlan(t);
    const periodStart = await seedSubscription(t, "crucible");
    await seedUsagePeriod(t, periodStart, 30, 25); // 30 sessions + 25 docs = 55 > 50 limit

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "document_analysis",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(true);
    expect(result.currentCount).toBe(55);
  });
});

// ── Trial gate checks ───────────────────────────────────────────────

describe("billing.gates.checkPlanLimitsQuery — trial limits", () => {
  test("trial sessions at limit -> blocked", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 10,
        sessionsLimit: 10,
        programsUsed: 0,
        programsLimit: 1,
        startedAt: Date.now(),
      });
    });

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "sandbox_session",
    });

    expect(result.allowed).toBe(false);
    expect(result.isOverage).toBe(false);
    expect(result.reason).toContain("Trial session limit reached");
    expect(result.currentCount).toBe(10);
    expect(result.limit).toBe(10);
  });

  test("trial sessions under limit -> allowed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 5,
        sessionsLimit: 10,
        programsUsed: 0,
        programsLimit: 1,
        startedAt: Date.now(),
      });
    });

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "sandbox_session",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
    expect(result.currentCount).toBe(5);
    expect(result.limit).toBe(10);
  });

  test("trial programs at limit -> blocked", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 0,
        sessionsLimit: 10,
        programsUsed: 1,
        programsLimit: 1,
        startedAt: Date.now(),
      });
    });

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "program",
    });

    expect(result.allowed).toBe(false);
    expect(result.isOverage).toBe(false);
    expect(result.reason).toContain("Trial program limit reached");
  });

  test("trial always blocks seats (limited to 1)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 0,
        sessionsLimit: 10,
        programsUsed: 0,
        programsLimit: 1,
        startedAt: Date.now(),
      });
    });

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "seat",
    });

    expect(result.allowed).toBe(false);
    expect(result.isOverage).toBe(false);
    expect(result.reason).toContain("Trial accounts are limited to 1 seat");
  });

  test("trial doc analysis at session limit -> blocked", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 10,
        sessionsLimit: 10,
        programsUsed: 0,
        programsLimit: 1,
        startedAt: Date.now(),
      });
    });

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "document_analysis",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Trial usage limit reached");
  });
});

// ── No subscription, no trial (design partner grace) ────────────────

describe("billing.gates.checkPlanLimitsQuery — design partner grace", () => {
  test("no subscription + no trial -> allowed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "program",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
  });

  test("no subscription + no trial -> sessions allowed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "sandbox_session",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
  });

  test("no subscription + no trial -> seats allowed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "seat",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
  });
});

// ── Converted trial (should fall through to grace) ──────────────────

describe("billing.gates.checkPlanLimitsQuery — converted trial", () => {
  test("converted trial without subscription -> design partner grace", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    // A trial that has convertedAt set but no active subscription
    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 10,
        sessionsLimit: 10,
        programsUsed: 1,
        programsLimit: 1,
        startedAt: Date.now(),
        convertedAt: Date.now(),
        convertedToPlan: "crucible",
      });
    });

    // With convertedAt set, the trial is considered converted and skipped
    // No active subscription exists -> falls through to grace period
    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "program",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
  });
});

// ── Subscription with missing plan record ───────────────────────────

describe("billing.gates.checkPlanLimitsQuery — missing plan", () => {
  test("active subscription with missing plan record -> allowed gracefully", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    // Subscription exists but NO plan record seeded
    await seedSubscription(t, "crucible");

    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "program",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
  });
});

// ── Inactive subscription status ────────────────────────────────────

describe("billing.gates.checkPlanLimitsQuery — inactive subscription", () => {
  test("canceled subscription -> falls through to trial/grace", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    await seedCruciblePlan(t);
    await seedSubscription(t, "crucible", "canceled");

    // No active trial, canceled sub -> design partner grace
    const result = await t.query(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: "org-1",
      resource: "program",
    });

    expect(result.allowed).toBe(true);
    expect(result.isOverage).toBe(false);
  });
});
