import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";

const api: any = (generatedApi as any).api;

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedUser(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "test@test.com",
      name: "Test User",
      orgIds: ["org_test"],
      role: "admin",
    });
  });
}

interface SeedResult {
  programId: string;
  wsId: string;
  sprintId: string;
}

async function seedProgramWithSprint(t: any): Promise<SeedResult> {
  let programId = "";
  let wsId = "";
  let sprintId = "";

  await t.run(async (ctx: any) => {
    programId = await ctx.db.insert("programs", {
      orgId: "org_test",
      name: "Test Program",
      clientName: "Acme",
      phase: "build",
      status: "active",
      slug: "test-program",
    });
    wsId = await ctx.db.insert("workstreams", {
      orgId: "org_test",
      programId,
      name: "Core Dev",
      shortCode: "WS-1",
      status: "on_track",
      sortOrder: 1,
    });
    sprintId = await ctx.db.insert("sprints", {
      orgId: "org_test",
      programId,
      workstreamId: wsId,
      name: "Sprint 1",
      number: 1,
      status: "active",
    });
  });

  return { programId, wsId, sprintId };
}

// ---------------------------------------------------------------------------
// sourceControl.branching.strategyRecommendation.getStrategyForSprint
// ---------------------------------------------------------------------------

describe("strategyRecommendation.getStrategyForSprint", () => {
  it("filters by recommendationType === branch_strategy", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    await t.run(async (ctx: any) => {
      // branch_strategy rec — should be returned
      await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        recommendation: {
          branchStrategy: { strategy: "feature-branch", recommended_branches: [] },
          acknowledgedDeviations: [],
        },
        recommendationType: "branch_strategy",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(
      api.sourceControl.branching.strategyRecommendation.getStrategyForSprint,
      { sprintId },
    );

    expect(result).not.toBeNull();
    expect(result.branchStrategy).toBeDefined();
    expect(result.branchStrategy.strategy).toBe("feature-branch");
    expect(result.status).toBe("pending");
  });

  it("returns null when only sprint_plan recs exist", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    await t.run(async (ctx: any) => {
      // Only sprint_plan recs, no branch_strategy
      await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        recommendation: {
          recommended_existing_tasks: [{ title: "Task 1" }],
        },
        recommendationType: "sprint_plan",
        status: "pending",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(
      api.sourceControl.branching.strategyRecommendation.getStrategyForSprint,
      { sprintId },
    );

    expect(result).toBeNull();
  });

  it("handles legacy records without recommendationType", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    await t.run(async (ctx: any) => {
      // Legacy record — no recommendationType field but has branchStrategy data
      await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        recommendation: {
          branchStrategy: { strategy: "legacy-flow", recommended_branches: [] },
        },
        status: "pending",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(
      api.sourceControl.branching.strategyRecommendation.getStrategyForSprint,
      { sprintId },
    );

    // Should still find via the fallback loop
    expect(result).not.toBeNull();
    expect(result.branchStrategy.strategy).toBe("legacy-flow");
  });

  it("returns processing status when generation is in progress", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        recommendation: null,
        recommendationType: "branch_strategy",
        status: "processing",
        createdAt: Date.now(),
        generationProgress: "Analyzing repository...",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(
      api.sourceControl.branching.strategyRecommendation.getStrategyForSprint,
      { sprintId },
    );

    expect(result).not.toBeNull();
    expect(result.status).toBe("processing");
    expect(result.branchStrategy).toBeNull();
    expect(result.generationProgress).toBe("Analyzing repository...");
  });

  it("returns error status correctly", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        recommendation: null,
        recommendationType: "branch_strategy",
        status: "error",
        createdAt: Date.now(),
        error: "AI service unavailable",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(
      api.sourceControl.branching.strategyRecommendation.getStrategyForSprint,
      { sprintId },
    );

    expect(result).not.toBeNull();
    expect(result.status).toBe("error");
    expect(result.error).toBe("AI service unavailable");
    expect(result.branchStrategy).toBeNull();
  });

  it("returns null when no recommendations exist", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { sprintId } = await seedProgramWithSprint(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(
      api.sourceControl.branching.strategyRecommendation.getStrategyForSprint,
      { sprintId },
    );

    expect(result).toBeNull();
  });
});
