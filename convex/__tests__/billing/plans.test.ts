import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
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

// ── seedPricingPlans ────────────────────────────────────────────────

describe("billing.plans.seedPricingPlans", () => {
  test("creates 3 plans", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    const plans = await t.run(async (ctx: any) => {
      return await ctx.db.query("pricingPlans").collect();
    });

    expect(plans).toHaveLength(3);

    const slugs = plans.map((p: any) => p.slug).sort();
    expect(slugs).toEqual(["crucible", "forge", "foundry"]);
  });

  test("is idempotent (call twice, still 3 plans)", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});
    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    const plans = await t.run(async (ctx: any) => {
      return await ctx.db.query("pricingPlans").collect();
    });

    expect(plans).toHaveLength(3);
  });
});

// ── ensurePlansSeeded ───────────────────────────────────────────────

describe("billing.plans.ensurePlansSeeded", () => {
  test("creates plans if none exist (needs identity)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.billing.plans.ensurePlansSeeded, {});

    const plans = await t.run(async (ctx: any) => {
      return await ctx.db.query("pricingPlans").collect();
    });

    expect(plans).toHaveLength(3);
  });

  test("is idempotent when plans already exist", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.billing.plans.ensurePlansSeeded, {});
    await asUser.mutation(apiAny.billing.plans.ensurePlansSeeded, {});

    const plans = await t.run(async (ctx: any) => {
      return await ctx.db.query("pricingPlans").collect();
    });

    expect(plans).toHaveLength(3);
  });
});

// ── getPricingPlans ─────────────────────────────────────────────────

describe("billing.plans.getPricingPlans", () => {
  test("returns 3 public plans sorted by sortOrder", async () => {
    const t = convexTest(schema, modules);

    // Seed plans via internal mutation (no auth needed)
    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    // getPricingPlans is a public query, call it without auth
    const plans = await t.query(apiAny.billing.plans.getPricingPlans, {});

    expect(plans).toHaveLength(3);
    expect(plans[0].slug).toBe("crucible");
    expect(plans[0].sortOrder).toBe(1);
    expect(plans[1].slug).toBe("forge");
    expect(plans[1].sortOrder).toBe(2);
    expect(plans[2].slug).toBe("foundry");
    expect(plans[2].sortOrder).toBe(3);
  });

  test("plans have correct pricing", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    const plans = await t.query(apiAny.billing.plans.getPricingPlans, {});

    const crucible = plans.find((p: any) => p.slug === "crucible");
    expect(crucible.monthlyPriceUsd).toBe(299);
    expect(crucible.limits.maxSeats).toBe(1);
    expect(crucible.limits.maxPrograms).toBe(5);
    expect(crucible.limits.maxSessionsPerMonth).toBe(50);

    const forge = plans.find((p: any) => p.slug === "forge");
    expect(forge.monthlyPriceUsd).toBe(1800);
    expect(forge.limits.maxPrograms).toBe(-1); // unlimited

    const foundry = plans.find((p: any) => p.slug === "foundry");
    expect(foundry.monthlyPriceUsd).toBe(8000);
    expect(foundry.limits.maxSeats).toBe(-1); // unlimited
    expect(foundry.limits.maxPrograms).toBe(-1); // unlimited
  });
});

// ── getPlanBySlug ───────────────────────────────────────────────────

describe("billing.plans.getPlanBySlug", () => {
  test("returns correct plan for 'crucible'", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    const plan = await t.query(apiAny.billing.plans.getPlanBySlug, {
      slug: "crucible",
    });

    expect(plan).not.toBeNull();
    expect(plan.slug).toBe("crucible");
    expect(plan.displayName).toBe("Crucible");
    expect(plan.monthlyPriceUsd).toBe(299);
  });

  test("returns correct plan for 'forge'", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    const plan = await t.query(apiAny.billing.plans.getPlanBySlug, {
      slug: "forge",
    });

    expect(plan).not.toBeNull();
    expect(plan.slug).toBe("forge");
    expect(plan.displayName).toBe("Forge");
  });

  test("returns correct plan for 'foundry'", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    const plan = await t.query(apiAny.billing.plans.getPlanBySlug, {
      slug: "foundry",
    });

    expect(plan).not.toBeNull();
    expect(plan.slug).toBe("foundry");
    expect(plan.displayName).toBe("Foundry");
  });
});

// ── updateStripePriceIds ────────────────────────────────────────────

describe("billing.plans.updateStripePriceIds", () => {
  test("updates stripePriceId on existing plan", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    await t.mutation(internalAny.billing.plans.updateStripePriceIds, {
      slug: "crucible",
      stripePriceId: "price_new_crucible_123",
    });

    const plan = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("pricingPlans")
        .withIndex("by_slug", (q: any) => q.eq("slug", "crucible"))
        .first();
    });

    expect(plan.stripePriceId).toBe("price_new_crucible_123");
  });

  test("updates multiple price IDs at once", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    await t.mutation(internalAny.billing.plans.updateStripePriceIds, {
      slug: "foundry",
      stripePriceId: "price_foundry_new",
      stripeAnnualPriceId: "price_foundry_annual_new",
      stripeOveragePriceId: "price_foundry_overage_new",
    });

    const plan = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("pricingPlans")
        .withIndex("by_slug", (q: any) => q.eq("slug", "foundry"))
        .first();
    });

    expect(plan.stripePriceId).toBe("price_foundry_new");
    expect(plan.stripeAnnualPriceId).toBe("price_foundry_annual_new");
    expect(plan.stripeOveragePriceId).toBe("price_foundry_overage_new");
  });

  test("throws for nonexistent plan slug", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internalAny.billing.plans.seedPricingPlans, {});

    // The slug validator only accepts crucible/forge/foundry,
    // so we test with a valid slug that hasn't been seeded
    // Actually, all 3 are always seeded. Test by clearing plans first.
    await t.run(async (ctx: any) => {
      const plans = await ctx.db.query("pricingPlans").collect();
      for (const plan of plans) {
        await ctx.db.delete(plan._id);
      }
    });

    await expect(
      t.mutation(internalAny.billing.plans.updateStripePriceIds, {
        slug: "crucible",
        stripePriceId: "price_missing",
      }),
    ).rejects.toThrow("Plan not found: crucible");
  });
});
