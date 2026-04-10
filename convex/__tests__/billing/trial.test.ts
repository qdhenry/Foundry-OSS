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

// ── initializeTrial ─────────────────────────────────────────────────

describe("billing.trial.initializeTrial", () => {
  test("creates trial with sessionsLimit=10, programsLimit=1", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const trial = await asUser.mutation(apiAny.billing.trial.initializeTrial, {
      orgId: "org-1",
    });

    expect(trial).not.toBeNull();
    expect(trial.orgId).toBe("org-1");
    expect(trial.sessionsLimit).toBe(10);
    expect(trial.programsLimit).toBe(1);
    expect(trial.sessionsUsed).toBe(0);
    expect(trial.programsUsed).toBe(0);
    expect(trial.startedAt).toBeTypeOf("number");
  });

  test("is idempotent (call twice, only 1 record)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const first = await asUser.mutation(apiAny.billing.trial.initializeTrial, {
      orgId: "org-1",
    });
    const second = await asUser.mutation(apiAny.billing.trial.initializeTrial, {
      orgId: "org-1",
    });

    expect(first._id).toBe(second._id);

    // Verify only 1 record in db
    const count = await t.run(async (ctx: any) => {
      const all = await ctx.db
        .query("trialState")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .collect();
      return all.length;
    });
    expect(count).toBe(1);
  });
});

// ── ensureTrialInitialized ──────────────────────────────────────────

describe("billing.trial.ensureTrialInitialized", () => {
  test("creates trial if no subscription and no trial exist", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const trial = await asUser.mutation(apiAny.billing.trial.ensureTrialInitialized, {
      orgId: "org-1",
    });

    expect(trial).not.toBeNull();
    expect(trial.sessionsLimit).toBe(10);
    expect(trial.programsLimit).toBe(1);
  });

  test("skips if subscription exists", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    // Seed subscription
    await t.run(async (ctx: any) => {
      await ctx.db.insert("subscriptions", {
        orgId: "org-1",
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test",
        planSlug: "crucible",
        status: "active",
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.mutation(apiAny.billing.trial.ensureTrialInitialized, {
      orgId: "org-1",
    });

    expect(result).toBeNull();

    // Verify no trial record was created
    const trialCount = await t.run(async (ctx: any) => {
      const all = await ctx.db
        .query("trialState")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .collect();
      return all.length;
    });
    expect(trialCount).toBe(0);
  });

  test("requires auth (call without identity throws)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    await expect(
      t.mutation(apiAny.billing.trial.ensureTrialInitialized, {
        orgId: "org-1",
      }),
    ).rejects.toThrow();
  });
});

// ── getTrialStatus ──────────────────────────────────────────────────

describe("billing.trial.getTrialStatus", () => {
  test("isOnTrial=true, sessionsRemaining=10 for fresh trial", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Initialize trial first
    await asUser.mutation(apiAny.billing.trial.initializeTrial, {
      orgId: "org-1",
    });

    const status = await asUser.query(apiAny.billing.trial.getTrialStatus, {
      orgId: "org-1",
    });

    expect(status.isOnTrial).toBe(true);
    expect(status.sessionsRemaining).toBe(10);
    expect(status.programsRemaining).toBe(1);
    expect(status.isExhausted).toBe(false);
    expect(status.isConverted).toBe(false);
    expect(status.sessionsUsed).toBe(0);
    expect(status.sessionsLimit).toBe(10);
  });

  test("isExhausted=true when sessionsUsed >= sessionsLimit", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Seed exhausted trial directly
    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 10,
        sessionsLimit: 10,
        programsUsed: 1,
        programsLimit: 1,
        startedAt: Date.now(),
      });
    });

    const status = await asUser.query(apiAny.billing.trial.getTrialStatus, {
      orgId: "org-1",
    });

    expect(status.isExhausted).toBe(true);
    expect(status.sessionsRemaining).toBe(0);
    expect(status.isOnTrial).toBe(true);
  });

  test("isConverted=true when subscription exists", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Seed trial + subscription
    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 5,
        sessionsLimit: 10,
        programsUsed: 1,
        programsLimit: 1,
        startedAt: Date.now(),
        convertedAt: Date.now(),
        convertedToPlan: "crucible",
      });
      await ctx.db.insert("subscriptions", {
        orgId: "org-1",
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test",
        planSlug: "crucible",
        status: "active",
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
      });
    });

    const status = await asUser.query(apiAny.billing.trial.getTrialStatus, {
      orgId: "org-1",
    });

    expect(status.isConverted).toBe(true);
    expect(status.isOnTrial).toBe(false);
  });
});

// ── incrementTrialSession ───────────────────────────────────────────

describe("billing.trial.incrementTrialSession", () => {
  test("sessionsUsed goes from 0 to 1", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    // Seed trial
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

    // Call internal mutation
    await t.mutation(internalAny.billing.trial.incrementTrialSession, {
      orgId: "org-1",
    });

    const trial = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("trialState")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(trial.sessionsUsed).toBe(1);
  });

  test("throws when session limit already reached", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    // Seed exhausted trial
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

    await expect(
      t.mutation(internalAny.billing.trial.incrementTrialSession, {
        orgId: "org-1",
      }),
    ).rejects.toThrow("Trial session limit reached");
  });

  test("throws when no trial state exists", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    await expect(
      t.mutation(internalAny.billing.trial.incrementTrialSession, {
        orgId: "org-1",
      }),
    ).rejects.toThrow("No trial state found for org");
  });
});

// ── incrementTrialProgram ───────────────────────────────────────────

describe("billing.trial.incrementTrialProgram", () => {
  test("programsUsed goes from 0 to 1", async () => {
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

    await t.mutation(internalAny.billing.trial.incrementTrialProgram, {
      orgId: "org-1",
    });

    const trial = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("trialState")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(trial.programsUsed).toBe(1);
  });

  test("throws when program limit already reached", async () => {
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

    await expect(
      t.mutation(internalAny.billing.trial.incrementTrialProgram, {
        orgId: "org-1",
      }),
    ).rejects.toThrow("Trial program limit reached");
  });
});

// ── convertTrial ────────────────────────────────────────────────────

describe("billing.trial.convertTrial", () => {
  test("sets convertedAt and convertedToPlan", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("trialState", {
        orgId: "org-1",
        sessionsUsed: 5,
        sessionsLimit: 10,
        programsUsed: 1,
        programsLimit: 1,
        startedAt: Date.now(),
      });
    });

    await t.mutation(internalAny.billing.trial.convertTrial, {
      orgId: "org-1",
      planSlug: "forge",
    });

    const trial = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("trialState")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(trial.convertedAt).toBeTypeOf("number");
    expect(trial.convertedToPlan).toBe("forge");
  });

  test("graceful no-op when no trial exists", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    // Should not throw
    await t.mutation(internalAny.billing.trial.convertTrial, {
      orgId: "org-1",
      planSlug: "crucible",
    });

    const trial = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("trialState")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-1"))
        .first();
    });

    expect(trial).toBeNull();
  });
});
