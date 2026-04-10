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
}

async function seedProgramAndWorkstream(t: any): Promise<SeedResult> {
  let programId = "";
  let wsId = "";

  await t.run(async (ctx: any) => {
    programId = await ctx.db.insert("programs", {
      orgId: "org_test",
      name: "Test Program",
      clientName: "Acme",
      phase: "discovery",
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
  });

  return { programId, wsId };
}

// ---------------------------------------------------------------------------
// requirements.listAllByProgram
// ---------------------------------------------------------------------------

describe("requirements.listAllByProgram", () => {
  it("returns paginated results", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId } = await seedProgramAndWorkstream(t);

    await t.run(async (ctx: any) => {
      for (let i = 1; i <= 5; i++) {
        await ctx.db.insert("requirements", {
          orgId: "org_test",
          programId,
          refId: `REQ-${String(i).padStart(3, "0")}`,
          title: `Requirement ${i}`,
          priority: "must_have",
          fitGap: "native",
          status: "draft",
        });
      }
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Page 1 with limit 3
    const page1 = await asUser.query(api.requirements.listAllByProgram, {
      programId,
      limit: 3,
    });

    expect(page1.items).toHaveLength(3);
    expect(page1.totalCount).toBe(5);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();

    // Page 2
    const page2 = await asUser.query(api.requirements.listAllByProgram, {
      programId,
      limit: 3,
      cursor: page1.nextCursor,
    });

    expect(page2.items).toHaveLength(2);
    expect(page2.hasMore).toBe(false);
  });

  it("filters by unassigned", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, wsId } = await seedProgramAndWorkstream(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-001",
        title: "Assigned",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
        workstreamId: wsId,
      });
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-002",
        title: "Unassigned",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.requirements.listAllByProgram, {
      programId,
      unassigned: true,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Unassigned");
  });

  it("filters by workstreamId", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, wsId } = await seedProgramAndWorkstream(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-001",
        title: "In WS",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
        workstreamId: wsId,
      });
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-002",
        title: "No WS",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.requirements.listAllByProgram, {
      programId,
      workstreamId: wsId,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("In WS");
  });

  it("includes workstreamName in results", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, wsId } = await seedProgramAndWorkstream(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-001",
        title: "Test",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
        workstreamId: wsId,
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.requirements.listAllByProgram, {
      programId,
    });

    expect(result.items[0].workstreamName).toBe("Core Dev");
  });
});

// ---------------------------------------------------------------------------
// requirements.countUnassigned
// ---------------------------------------------------------------------------

describe("requirements.countUnassigned", () => {
  it("returns correct count and total", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, wsId } = await seedProgramAndWorkstream(t);

    await t.run(async (ctx: any) => {
      // 2 unassigned
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-001",
        title: "Unassigned 1",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-002",
        title: "Unassigned 2",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
      // 1 assigned
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-003",
        title: "Assigned",
        priority: "nice_to_have",
        fitGap: "custom_dev",
        status: "approved",
        workstreamId: wsId,
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.requirements.countUnassigned, {
      programId,
    });

    expect(result.count).toBe(2);
    expect(result.total).toBe(3);
  });

  it("returns 0 count when all assigned", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, wsId } = await seedProgramAndWorkstream(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-001",
        title: "Assigned",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
        workstreamId: wsId,
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.requirements.countUnassigned, {
      programId,
    });

    expect(result.count).toBe(0);
    expect(result.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// requirements.bulkAssignWorkstream
// ---------------------------------------------------------------------------

describe("requirements.bulkAssignWorkstream", () => {
  it("assigns multiple requirements and returns count", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, wsId } = await seedProgramAndWorkstream(t);

    let reqId1 = "";
    let reqId2 = "";
    await t.run(async (ctx: any) => {
      reqId1 = await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-001",
        title: "Req 1",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      reqId2 = await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-002",
        title: "Req 2",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.mutation(api.requirements.bulkAssignWorkstream, {
      requirementIds: [reqId1, reqId2],
      workstreamId: wsId,
    });

    expect(result.updated).toBe(2);

    // Verify assignment
    const reqs = await t.run(async (ctx: any) => {
      const r1 = await ctx.db.get(reqId1);
      const r2 = await ctx.db.get(reqId2);
      return [r1, r2];
    });

    expect(reqs[0].workstreamId).toBe(wsId);
    expect(reqs[1].workstreamId).toBe(wsId);
  });

  it("returns 0 for empty array", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { wsId } = await seedProgramAndWorkstream(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.mutation(api.requirements.bulkAssignWorkstream, {
      requirementIds: [],
      workstreamId: wsId,
    });

    expect(result.updated).toBe(0);
  });

  it("validates org access", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { wsId } = await seedProgramAndWorkstream(t);

    // Requirement in a different org
    let foreignReqId = "";
    await t.run(async (ctx: any) => {
      const foreignProgram = await ctx.db.insert("programs", {
        orgId: "org_other",
        name: "Foreign",
        clientName: "Foreign",
        phase: "discovery",
        status: "active",
        slug: "foreign",
      });
      foreignReqId = await ctx.db.insert("requirements", {
        orgId: "org_other",
        programId: foreignProgram,
        refId: "REQ-001",
        title: "Foreign",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    await expect(
      asUser.mutation(api.requirements.bulkAssignWorkstream, {
        requirementIds: [foreignReqId],
        workstreamId: wsId,
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// requirements.bulkCreateTasks
// ---------------------------------------------------------------------------

describe("requirements.bulkCreateTasks", () => {
  it("creates tasks from requirements with correct priority mapping", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const { programId, wsId } = await seedProgramAndWorkstream(t);

    let reqMustHave = "";
    let reqShouldHave = "";
    let reqNiceToHave = "";
    await t.run(async (ctx: any) => {
      reqMustHave = await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-001",
        title: "Must Have Req",
        description: "Description 1",
        priority: "must_have",
        fitGap: "native",
        status: "approved",
        workstreamId: wsId,
      });
      reqShouldHave = await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-002",
        title: "Should Have Req",
        priority: "should_have",
        fitGap: "config",
        status: "approved",
      });
      reqNiceToHave = await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-003",
        title: "Nice To Have Req",
        priority: "nice_to_have",
        fitGap: "custom_dev",
        status: "approved",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.mutation(api.requirements.bulkCreateTasks, {
      requirementIds: [reqMustHave, reqShouldHave, reqNiceToHave],
    });

    expect(result.created).toBe(3);

    // Verify tasks were created with correct priority mapping
    const tasks = await t.run(async (ctx: any) => {
      return await ctx.db.query("tasks").collect();
    });

    expect(tasks).toHaveLength(3);

    const mustHaveTask = tasks.find((t: any) => t.requirementId === reqMustHave);
    expect(mustHaveTask.priority).toBe("high");
    expect(mustHaveTask.title).toBe("Must Have Req");
    expect(mustHaveTask.description).toBe("Description 1");
    expect(mustHaveTask.workstreamId).toBe(wsId);
    expect(mustHaveTask.status).toBe("backlog");

    const shouldHaveTask = tasks.find((t: any) => t.requirementId === reqShouldHave);
    expect(shouldHaveTask.priority).toBe("medium");

    const niceToHaveTask = tasks.find((t: any) => t.requirementId === reqNiceToHave);
    expect(niceToHaveTask.priority).toBe("low");
  });

  it("returns 0 for empty array", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.mutation(api.requirements.bulkCreateTasks, {
      requirementIds: [],
    });

    expect(result.created).toBe(0);
  });
});
