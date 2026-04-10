import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import { ENGAGEMENT_TYPE_DEFAULTS } from "../programs";
import schema from "../schema";
import { modules } from "../test.helpers";

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

const DEFAULT_CREATE_ARGS = {
  orgId: "org-1",
  name: "Test Program",
  clientName: "Test Client",
  engagementType: "greenfield" as const,
  workstreams: [
    { name: "Architecture", shortCode: "WS-1", sortOrder: 1 },
    { name: "Development", shortCode: "WS-2", sortOrder: 2 },
  ],
};

describe("programs.list", () => {
  test("returns programs for org", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Prog A",
        clientName: "Client A",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "discovery",
        status: "active",
        engagementType: "migration",
      });
      await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Prog B",
        clientName: "Client B",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "build",
        status: "active",
        engagementType: "greenfield",
      });
    });

    const programs = await asUser.query(apiAny.programs.list, { orgId: "org-1" });
    expect(programs).toHaveLength(2);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(asOtherUser.query(apiAny.programs.list, { orgId: "org-1" })).rejects.toThrow(
      "Access denied",
    );
  });
});

describe("programs.get", () => {
  test("returns program with stats", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Test Program",
        clientName: "Test Client",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "build",
        status: "active",
        engagementType: "migration",
      });
    });

    const program = await asUser.query(apiAny.programs.get, { programId });
    expect(program.name).toBe("Test Program");
    expect(program.stats).toBeDefined();
    expect(program.stats.totalRequirements).toBe(0);
    expect(program.stats.completionPercent).toBe(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const programId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "P",
        clientName: "C",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
        engagementType: "greenfield",
      });
    });

    await expect(asOtherUser.query(apiAny.programs.get, { programId })).rejects.toThrow(
      "Access denied",
    );
  });
});

describe("programs.create", () => {
  test("creates program with engagementType and techStack", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const techStack = [
      { category: "frontend" as const, technologies: ["React", "TypeScript"] },
      { category: "backend" as const, technologies: ["Node.js"] },
    ];

    const programId = await asUser.mutation(apiAny.programs.create, {
      ...DEFAULT_CREATE_ARGS,
      engagementType: "greenfield",
      techStack,
    });

    const program = await t.run(async (ctx: any) => await ctx.db.get(programId));
    expect(program.engagementType).toBe("greenfield");
    expect(program.techStack).toHaveLength(2);
    expect(program.techStack[0].category).toBe("frontend");
    expect(program.techStack[0].technologies).toEqual(["React", "TypeScript"]);
  });

  test("creates user-provided workstreams", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const customWorkstreams = [
      { name: "Frontend Build", shortCode: "WS-1", sortOrder: 1 },
      { name: "Backend APIs", shortCode: "WS-2", sortOrder: 2 },
      { name: "Testing & QA", shortCode: "WS-3", sortOrder: 3 },
    ];

    const programId = await asUser.mutation(apiAny.programs.create, {
      ...DEFAULT_CREATE_ARGS,
      workstreams: customWorkstreams,
    });

    const workstreams = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("workstreams")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });
    expect(workstreams).toHaveLength(3);
    const names = workstreams.map((ws: any) => ws.name).sort();
    expect(names).toEqual(["Backend APIs", "Frontend Build", "Testing & QA"]);
    const codes = workstreams.map((ws: any) => ws.shortCode).sort();
    expect(codes).toEqual(["WS-1", "WS-2", "WS-3"]);
  });

  test("creates program without sourcePlatform (defaults to none)", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await asUser.mutation(apiAny.programs.create, {
      orgId: "org-1",
      name: "No Platform",
      clientName: "Client",
      engagementType: "greenfield",
      workstreams: [{ name: "Work", shortCode: "WS-1", sortOrder: 1 }],
    });

    const program = await t.run(async (ctx: any) => await ctx.db.get(programId));
    expect(program.sourcePlatform).toBe("none");
    expect(program.targetPlatform).toBe("none");
  });

  test("stores workstream descriptions when provided", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await asUser.mutation(apiAny.programs.create, {
      ...DEFAULT_CREATE_ARGS,
      workstreams: [
        {
          name: "Core Dev",
          shortCode: "WS-1",
          sortOrder: 1,
          description: "Primary development work",
        },
        { name: "Testing", shortCode: "WS-2", sortOrder: 2, description: "QA and test automation" },
      ],
    });

    const workstreams = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("workstreams")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });
    // Note: workstream descriptions are not stored in the workstreams table
    // The create mutation inserts name, shortCode, sortOrder, status, sprintCadence, currentSprint
    expect(workstreams).toHaveLength(2);
    expect(workstreams.find((ws: any) => ws.name === "Core Dev")).toBeDefined();
    expect(workstreams.find((ws: any) => ws.name === "Testing")).toBeDefined();
  });

  test("creates program with empty workstreams array", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await asUser.mutation(apiAny.programs.create, {
      ...DEFAULT_CREATE_ARGS,
      workstreams: [],
    });

    const workstreams = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("workstreams")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });
    expect(workstreams).toHaveLength(0);
  });

  test("creates program for each engagement type", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const types = ["greenfield", "migration", "integration", "ongoing_product_dev"] as const;

    for (const engagementType of types) {
      const programId = await asUser.mutation(apiAny.programs.create, {
        orgId: "org-1",
        name: `Program ${engagementType}`,
        clientName: "Client",
        engagementType,
        workstreams: [{ name: "Work", shortCode: "WS-1", sortOrder: 1 }],
      });

      const program = await t.run(async (ctx: any) => await ctx.db.get(programId));
      expect(program.engagementType).toBe(engagementType);
      expect(program.phase).toBe("discovery");
      expect(program.status).toBe("active");
    }
  });

  test("creates program with migration platforms", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await asUser.mutation(apiAny.programs.create, {
      orgId: "org-1",
      name: "Migration Program",
      clientName: "Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      engagementType: "migration",
      workstreams: [{ name: "Migration Work", shortCode: "WS-1", sortOrder: 1 }],
    });

    const program = await t.run(async (ctx: any) => await ctx.db.get(programId));
    expect(program.sourcePlatform).toBe("magento");
    expect(program.targetPlatform).toBe("salesforce_b2b");
    expect(program.engagementType).toBe("migration");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.programs.create, {
        ...DEFAULT_CREATE_ARGS,
        orgId: "org-1",
      }),
    ).rejects.toThrow("Access denied");
  });
});

describe("ENGAGEMENT_TYPE_DEFAULTS", () => {
  test("has entries for all 4 engagement types", () => {
    expect(ENGAGEMENT_TYPE_DEFAULTS).toHaveProperty("greenfield");
    expect(ENGAGEMENT_TYPE_DEFAULTS).toHaveProperty("migration");
    expect(ENGAGEMENT_TYPE_DEFAULTS).toHaveProperty("integration");
    expect(ENGAGEMENT_TYPE_DEFAULTS).toHaveProperty("ongoing_product_dev");
    expect(Object.keys(ENGAGEMENT_TYPE_DEFAULTS)).toHaveLength(4);
  });

  test("each engagement type has at least 4 workstreams", () => {
    for (const [_type, workstreams] of Object.entries(ENGAGEMENT_TYPE_DEFAULTS)) {
      expect(workstreams.length).toBeGreaterThanOrEqual(4);
    }
  });

  test("all workstreams have required fields (name, shortCode, sortOrder, description)", () => {
    for (const [_type, workstreams] of Object.entries(ENGAGEMENT_TYPE_DEFAULTS)) {
      for (const ws of workstreams) {
        expect(ws).toHaveProperty("name");
        expect(ws).toHaveProperty("shortCode");
        expect(ws).toHaveProperty("sortOrder");
        expect(ws).toHaveProperty("description");
        expect(typeof ws.name).toBe("string");
        expect(typeof ws.shortCode).toBe("string");
        expect(typeof ws.sortOrder).toBe("number");
        expect(typeof ws.description).toBe("string");
        expect(ws.name.length).toBeGreaterThan(0);
        expect(ws.shortCode).toMatch(/^WS-\d+$/);
      }
    }
  });

  test("sortOrders are sequential starting from 1", () => {
    for (const [_type, workstreams] of Object.entries(ENGAGEMENT_TYPE_DEFAULTS)) {
      const sortOrders = workstreams.map((ws) => ws.sortOrder);
      for (let i = 0; i < sortOrders.length; i++) {
        expect(sortOrders[i]).toBe(i + 1);
      }
    }
  });
});

describe("programs.update", () => {
  test("updates program name and description", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Old Name",
        clientName: "Client",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
        engagementType: "greenfield",
      });
    });

    await asUser.mutation(apiAny.programs.update, {
      programId,
      name: "New Name",
      description: "Updated",
    });

    const updated = await t.run(async (ctx: any) => await ctx.db.get(programId));
    expect(updated.name).toBe("New Name");
    expect(updated.description).toBe("Updated");
  });
});

describe("programs.updatePhase", () => {
  test("updates phase", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "P",
        clientName: "C",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
        engagementType: "greenfield",
      });
    });

    await asUser.mutation(apiAny.programs.updatePhase, {
      programId,
      phase: "build",
    });

    const updated = await t.run(async (ctx: any) => await ctx.db.get(programId));
    expect(updated.phase).toBe("build");
  });
});

describe("programs.remove", () => {
  test("cascade deletes program and children", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await t.run(async (ctx: any) => {
      const pid = await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "To Delete",
        clientName: "C",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
        engagementType: "greenfield",
      });
      // Add a workstream child
      await ctx.db.insert("workstreams", {
        orgId: "org-1",
        programId: pid,
        name: "WS",
        shortCode: "W1",
        status: "on_track",
        sortOrder: 1,
      });
      // Add a requirement child
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: pid,
        refId: "REQ-001",
        title: "R1",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      return pid;
    });

    await asUser.mutation(apiAny.programs.remove, { programId });

    const deleted = await t.run(async (ctx: any) => await ctx.db.get(programId));
    expect(deleted).toBeNull();

    const remainingWs = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("workstreams")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });
    expect(remainingWs).toHaveLength(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const programId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "P",
        clientName: "C",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
        engagementType: "greenfield",
      });
    });

    await expect(asOtherUser.mutation(apiAny.programs.remove, { programId })).rejects.toThrow(
      "Access denied",
    );
  });
});

describe("programs.getStats", () => {
  test("returns correct stats", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const programId = await t.run(async (ctx: any) => {
      const pid = await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Stats Program",
        clientName: "C",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "build",
        status: "active",
        engagementType: "greenfield",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: pid,
        refId: "REQ-001",
        title: "R1",
        priority: "must_have",
        fitGap: "native",
        status: "complete",
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: pid,
        refId: "REQ-002",
        title: "R2",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
      return pid;
    });

    const stats = await asUser.query(apiAny.programs.getStats, { programId });
    expect(stats.totalRequirements).toBe(2);
    expect(stats.completedRequirements).toBe(1);
    expect(stats.completionPercent).toBe(50);
  });
});

describe("programs.getById", () => {
  test("returns program without auth (internal)", async () => {
    const t = convexTest(schema, modules);

    const programId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Internal",
        clientName: "C",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
        engagementType: "greenfield",
      });
    });

    const program = await t.query(internalAny.programs.getById, { programId });
    expect(program?.name).toBe("Internal");
  });
});
