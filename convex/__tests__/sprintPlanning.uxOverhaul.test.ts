import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";

const api: any = (generatedApi as any).api;
const internalApi: any = (generatedApi as any).internal;

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
      status: "planning",
    });
  });

  return { programId, wsId, sprintId };
}

// ---------------------------------------------------------------------------
// sprintPlanning.requestSprintPlan
// ---------------------------------------------------------------------------

describe("sprintPlanning.requestSprintPlan", () => {
  it("creates a processing recommendation", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { sprintId } = await seedProgramWithSprint(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });

    // requestSprintPlan calls scheduler.runAfter which will fail in test env,
    // but the mutation itself should insert the placeholder record before that
    try {
      await asUser.mutation(api.sprintPlanning.requestSprintPlan, {
        sprintId,
      });
    } catch {
      // scheduler.runAfter may throw in test env — that's expected
    }

    // Verify the processing record was created
    const recs = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("sprintPlanningRecommendations")
        .withIndex("by_sprint", (q: any) => q.eq("sprintId", sprintId))
        .collect();
    });

    expect(recs.length).toBeGreaterThanOrEqual(1);
    const processingRec = recs.find(
      (r: any) => r.status === "processing" && r.recommendationType === "sprint_plan",
    );
    expect(processingRec).toBeDefined();
    expect(processingRec.orgId).toBe("org_test");
  });

  it("prevents duplicate processing requests", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    // Pre-seed a processing sprint_plan recommendation
    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        status: "processing",
        recommendationType: "sprint_plan",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    await expect(
      asUser.mutation(api.sprintPlanning.requestSprintPlan, { sprintId }),
    ).rejects.toThrow("already being generated");
  });

  it("allows request when existing rec is not processing", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    // Pre-seed a completed sprint_plan recommendation
    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        recommendation: { recommended_existing_tasks: [] },
        status: "pending",
        recommendationType: "sprint_plan",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    // Should not throw about duplicate — the existing rec is "pending", not "processing"
    try {
      await asUser.mutation(api.sprintPlanning.requestSprintPlan, {
        sprintId,
      });
    } catch (e: any) {
      // Only fail if it's about duplicate — scheduler errors are fine
      if (e.message?.includes("already being generated")) {
        throw e;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// sprintPlanning.appendRecommendedTask
// ---------------------------------------------------------------------------

describe("sprintPlanning.appendRecommendedTask", () => {
  it("stores under recommended_existing_tasks key", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    // Create a placeholder record
    let placeholderId = "";
    await t.run(async (ctx: any) => {
      placeholderId = await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        status: "processing",
        recommendationType: "sprint_plan",
        createdAt: Date.now(),
      });
    });

    // Append a task via internal mutation
    await t.mutation(internalApi.sprintPlanning.appendRecommendedTask, {
      placeholderId,
      task: { title: "Implement auth", priority: "high" },
      taskIndex: 0,
    });

    // Verify
    const rec = await t.run(async (ctx: any) => {
      return await ctx.db.get(placeholderId);
    });

    expect(rec.recommendation.recommended_existing_tasks).toHaveLength(1);
    expect(rec.recommendation.recommended_existing_tasks[0].title).toBe("Implement auth");
    expect(rec.generationProgress).toContain("1 recommended task");
  });

  it("appends multiple tasks incrementally", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    let placeholderId = "";
    await t.run(async (ctx: any) => {
      placeholderId = await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        status: "processing",
        recommendationType: "sprint_plan",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internalApi.sprintPlanning.appendRecommendedTask, {
      placeholderId,
      task: { title: "Task 1" },
      taskIndex: 0,
    });
    await t.mutation(internalApi.sprintPlanning.appendRecommendedTask, {
      placeholderId,
      task: { title: "Task 2" },
      taskIndex: 1,
    });

    const rec = await t.run(async (ctx: any) => {
      return await ctx.db.get(placeholderId);
    });

    expect(rec.recommendation.recommended_existing_tasks).toHaveLength(2);
    expect(rec.generationProgress).toContain("2 recommended tasks");
  });
});

// ---------------------------------------------------------------------------
// sprintPlanning.getRecommendation
// ---------------------------------------------------------------------------

describe("sprintPlanning.getRecommendation", () => {
  it("returns the latest recommendation", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, sprintId } = await seedProgramWithSprint(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        recommendation: { recommended_existing_tasks: [{ title: "Old" }] },
        status: "pending",
        recommendationType: "sprint_plan",
        createdAt: Date.now() - 10000,
      });
      await ctx.db.insert("sprintPlanningRecommendations", {
        orgId: "org_test",
        sprintId,
        programId,
        recommendation: { recommended_existing_tasks: [{ title: "New" }] },
        status: "pending",
        recommendationType: "sprint_plan",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.sprintPlanning.getRecommendation, {
      sprintId,
    });

    expect(result).not.toBeNull();
    // getRecommendation returns the last one in collection order
    expect(result.recommendation.recommended_existing_tasks[0].title).toBe("New");
  });

  it("returns null for sprint with no recommendations", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { sprintId } = await seedProgramWithSprint(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.sprintPlanning.getRecommendation, {
      sprintId,
    });

    expect(result).toBeNull();
  });
});
