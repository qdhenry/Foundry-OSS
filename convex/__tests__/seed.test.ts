import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;

import schema from "../schema";
import { modules } from "../test.helpers";
import { seedOrg } from "./helpers/baseFactory";

describe("seed.seedAcmeCorp", () => {
  test("creates program, 7 workstreams, and 118+ requirements", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await asUser.mutation(apiAny.seed.seedAcmeCorp, {
      orgId: "org-1",
    });
    expect(programId).toBeDefined();

    const program = await t.run(async (ctx: any) => {
      return await ctx.db.get(programId);
    });
    expect(program).toBeDefined();
    expect(program.clientName).toBe("AcmeCorp");
    expect(program.sourcePlatform).toBe("magento");
    expect(program.targetPlatform).toBe("salesforce_b2b");
    expect(program.phase).toBe("discovery");

    const workstreams = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("workstreams")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });
    expect(workstreams).toHaveLength(7);

    const shortCodes = workstreams.map((ws: any) => ws.shortCode).sort();
    expect(shortCodes).toEqual(["WS-1", "WS-2", "WS-3", "WS-4", "WS-5", "WS-6", "WS-7"]);

    const requirements = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("requirements")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });
    expect(requirements.length).toBeGreaterThanOrEqual(100);
    expect(requirements.length).toBeLessThanOrEqual(125);

    const workstreamIds = new Set(requirements.map((r: any) => r.workstreamId));
    expect(workstreamIds.size).toBeGreaterThanOrEqual(5);
  });

  test("is idempotent — rejects if AcmeCorp already exists", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.seed.seedAcmeCorp, {
      orgId: "org-1",
    });

    await expect(
      asUser.mutation(apiAny.seed.seedAcmeCorp, {
        orgId: "org-1",
      }),
    ).rejects.toThrow("AcmeCorp data already exists");
  });

  test("rejects unauthenticated access", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(apiAny.seed.seedAcmeCorp, {
        orgId: "org-1",
      }),
    ).rejects.toThrow();
  });

  test("verifies requirement batch coverage", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await asUser.mutation(apiAny.seed.seedAcmeCorp, {
      orgId: "org-1",
    });

    const requirements = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("requirements")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });

    const batches = new Set(requirements.map((r: any) => r.batch));
    expect(batches.size).toBeGreaterThanOrEqual(6);

    const priorities = new Set(requirements.map((r: any) => r.priority));
    expect(priorities.has("must_have")).toBe(true);
    expect(priorities.has("should_have")).toBe(true);
  });

  test("verifies workstream naming and ordering", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await asUser.mutation(apiAny.seed.seedAcmeCorp, {
      orgId: "org-1",
    });

    const workstreams = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("workstreams")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });

    const sortOrders = workstreams
      .map((ws: any) => ws.sortOrder)
      .sort((a: number, b: number) => a - b);
    expect(sortOrders).toEqual([1, 2, 3, 4, 5, 6, 7]);

    for (const ws of workstreams) {
      expect(ws.orgId).toBe("org-1");
    }
  });
});
