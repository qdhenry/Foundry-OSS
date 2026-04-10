import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

import { seedCrossOrgUser, seedOrg, seedProgram, setupTestEnv } from "./helpers/baseFactory";

// ── storeHealthScore ────────────────────────────────────────────────

describe("healthScoring.storeHealthScore", () => {
  const baseFactors = {
    velocityScore: 0.8,
    taskAgingScore: 0.7,
    riskScore: 0.9,
    gatePassRate: 1.0,
    dependencyScore: 0.85,
  };

  test("stores a health score record", async () => {
    const t = convexTest(schema, modules);
    const { orgId, workstreamId } = await setupTestEnv(t);

    await t.mutation(internalAny.healthScoring.storeHealthScore, {
      orgId,
      workstreamId,
      health: "on_track",
      healthScore: 85,
      reasoning: "All metrics look good",
      factors: baseFactors,
    });

    const scores = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("aiHealthScores")
        .withIndex("by_workstream", (q: any) => q.eq("workstreamId", workstreamId))
        .collect();
    });

    expect(scores).toHaveLength(1);
    expect(scores[0].health).toBe("on_track");
    expect(scores[0].healthScore).toBe(85);
    expect(scores[0].reasoning).toBe("All metrics look good");
    expect(scores[0].factors).toEqual(baseFactors);
    expect(scores[0].scheduledAt).toBeTypeOf("number");
    expect(scores[0].expiresAt).toBeGreaterThan(scores[0].scheduledAt);
  });

  test("updates workstream status when health changes", async () => {
    const t = convexTest(schema, modules);
    const { orgId, workstreamId } = await setupTestEnv(t);

    await t.mutation(internalAny.healthScoring.storeHealthScore, {
      orgId,
      workstreamId,
      health: "at_risk",
      healthScore: 45,
      reasoning: "Velocity declining",
      factors: baseFactors,
      previousHealth: "on_track",
      changeReason: "Multiple overdue tasks",
    });

    const ws = await t.run(async (ctx: any) => {
      return await ctx.db.get(workstreamId);
    });

    expect(ws.status).toBe("at_risk");
    expect(ws.healthLastUpdated).toBeTypeOf("number");
  });

  test("does not change workstream status when health stays the same", async () => {
    const t = convexTest(schema, modules);
    const { orgId, workstreamId } = await setupTestEnv(t);

    await t.mutation(internalAny.healthScoring.storeHealthScore, {
      orgId,
      workstreamId,
      health: "on_track",
      healthScore: 90,
      reasoning: "Still on track",
      factors: baseFactors,
      previousHealth: "on_track",
    });

    const ws = await t.run(async (ctx: any) => {
      return await ctx.db.get(workstreamId);
    });

    // Status stays as original "on_track" from seed
    expect(ws.status).toBe("on_track");
    expect(ws.healthLastUpdated).toBeTypeOf("number");
  });
});

// ── getLatestHealthScore ────────────────────────────────────────────

describe("healthScoring.getLatestHealthScore", () => {
  const baseFactors = {
    velocityScore: 0.8,
    taskAgingScore: 0.7,
    riskScore: 0.9,
    gatePassRate: 1.0,
    dependencyScore: 0.85,
  };

  test("returns latest health score for workstream", async () => {
    const t = convexTest(schema, modules);
    const { orgId, workstreamId, asUser } = await setupTestEnv(t);

    // Store two scores
    await t.mutation(internalAny.healthScoring.storeHealthScore, {
      orgId,
      workstreamId,
      health: "on_track",
      healthScore: 85,
      reasoning: "First score",
      factors: baseFactors,
    });

    await t.mutation(internalAny.healthScoring.storeHealthScore, {
      orgId,
      workstreamId,
      health: "at_risk",
      healthScore: 50,
      reasoning: "Second score",
      factors: baseFactors,
    });

    const latest = await asUser.query(apiAny.healthScoring.getLatestHealthScore, {
      workstreamId,
    });

    expect(latest).not.toBeNull();
    expect(latest.health).toBe("at_risk");
    expect(latest.healthScore).toBe(50);
  });

  test("returns null when no scores exist", async () => {
    const t = convexTest(schema, modules);
    const { workstreamId, asUser } = await setupTestEnv(t);

    const latest = await asUser.query(apiAny.healthScoring.getLatestHealthScore, {
      workstreamId,
    });

    expect(latest).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { workstreamId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.healthScoring.getLatestHealthScore, {
        workstreamId,
      }),
    ).rejects.toThrow();
  });
});

// ── getHealthHistory ────────────────────────────────────────────────

describe("healthScoring.getHealthHistory", () => {
  const baseFactors = {
    velocityScore: 0.8,
    taskAgingScore: 0.7,
    riskScore: 0.9,
    gatePassRate: 1.0,
    dependencyScore: 0.85,
  };

  test("returns history with limit", async () => {
    const t = convexTest(schema, modules);
    const { orgId, workstreamId, asUser } = await setupTestEnv(t);

    // Store 3 scores
    for (let i = 0; i < 3; i++) {
      await t.mutation(internalAny.healthScoring.storeHealthScore, {
        orgId,
        workstreamId,
        health: "on_track",
        healthScore: 80 + i,
        reasoning: `Score ${i}`,
        factors: baseFactors,
      });
    }

    const history = await asUser.query(apiAny.healthScoring.getHealthHistory, {
      workstreamId,
      limit: 2,
    });

    expect(history).toHaveLength(2);
  });

  test("defaults to 10 when no limit specified", async () => {
    const t = convexTest(schema, modules);
    const { orgId, workstreamId, asUser } = await setupTestEnv(t);

    // Store 3 scores
    for (let i = 0; i < 3; i++) {
      await t.mutation(internalAny.healthScoring.storeHealthScore, {
        orgId,
        workstreamId,
        health: "on_track",
        healthScore: 80 + i,
        reasoning: `Score ${i}`,
        factors: baseFactors,
      });
    }

    const history = await asUser.query(apiAny.healthScoring.getHealthHistory, {
      workstreamId,
    });

    expect(history).toHaveLength(3);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { workstreamId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.healthScoring.getHealthHistory, {
        workstreamId,
      }),
    ).rejects.toThrow();
  });
});
