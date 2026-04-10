import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";

const api: any = (generatedApi as any).api;

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedOrg(t: any) {
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

async function seedProgramWithWorkstreamAndSprint(t: any): Promise<SeedResult> {
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
// tasks.listUnassignedByWorkstream
// ---------------------------------------------------------------------------

describe("tasks.listUnassignedByWorkstream", () => {
  it("returns tasks with no sprintId in workstream", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId, wsId, sprintId } = await seedProgramWithWorkstreamAndSprint(t);

    await t.run(async (ctx: any) => {
      // Unassigned task (no sprintId)
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        title: "Unassigned Task",
        priority: "high",
        status: "backlog",
      });
      // Assigned task (has sprintId) — should be excluded
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        sprintId,
        title: "Assigned Task",
        priority: "medium",
        status: "todo",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.tasks.listUnassignedByWorkstream, {
      workstreamId: wsId,
      programId,
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Unassigned Task");
  });

  it("excludes tasks from other programs in the same workstream", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId, wsId } = await seedProgramWithWorkstreamAndSprint(t);

    let otherProgramId = "";
    await t.run(async (ctx: any) => {
      otherProgramId = await ctx.db.insert("programs", {
        orgId: "org_test",
        name: "Other Program",
        clientName: "Other",
        phase: "discovery",
        status: "active",
        slug: "other-program",
      });
      // Task in same workstream but different program
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId: otherProgramId,
        workstreamId: wsId,
        title: "Other Program Task",
        priority: "low",
        status: "backlog",
      });
      // Task in correct program
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        title: "Correct Program Task",
        priority: "high",
        status: "backlog",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.tasks.listUnassignedByWorkstream, {
      workstreamId: wsId,
      programId,
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Correct Program Task");
  });
});

// ---------------------------------------------------------------------------
// tasks.listUnassignedByProgram
// ---------------------------------------------------------------------------

describe("tasks.listUnassignedByProgram", () => {
  it("returns all unassigned tasks in the program", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId, wsId, sprintId } = await seedProgramWithWorkstreamAndSprint(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        title: "Unassigned 1",
        priority: "high",
        status: "backlog",
      });
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        title: "Unassigned 2",
        priority: "medium",
        status: "backlog",
      });
      // Assigned — excluded
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        sprintId,
        title: "Assigned Task",
        priority: "low",
        status: "todo",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.tasks.listUnassignedByProgram, {
      programId,
    });

    expect(result).toHaveLength(2);
    const titles = result.map((r: any) => r.title);
    expect(titles).toContain("Unassigned 1");
    expect(titles).toContain("Unassigned 2");
  });

  it("sorts by priority (high first) then title", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId } = await seedProgramWithWorkstreamAndSprint(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        title: "Beta Task",
        priority: "low",
        status: "backlog",
      });
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        title: "Alpha Task",
        priority: "critical",
        status: "backlog",
      });
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        title: "Charlie Task",
        priority: "critical",
        status: "backlog",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.tasks.listUnassignedByProgram, {
      programId,
    });

    expect(result[0].title).toBe("Alpha Task");
    expect(result[1].title).toBe("Charlie Task");
    expect(result[2].title).toBe("Beta Task");
  });
});

// ---------------------------------------------------------------------------
// tasks.bulkAssignToSprint
// ---------------------------------------------------------------------------

describe("tasks.bulkAssignToSprint", () => {
  it("assigns tasks and returns count", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId, sprintId } = await seedProgramWithWorkstreamAndSprint(t);

    let taskId1 = "";
    let taskId2 = "";
    await t.run(async (ctx: any) => {
      taskId1 = await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        title: "Task 1",
        priority: "high",
        status: "backlog",
      });
      taskId2 = await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        title: "Task 2",
        priority: "medium",
        status: "backlog",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.mutation(api.tasks.bulkAssignToSprint, {
      taskIds: [taskId1, taskId2],
      sprintId,
    });

    expect(result.updated).toBe(2);

    // Verify tasks are now assigned
    const tasks = await t.run(async (ctx: any) => {
      const t1 = await ctx.db.get(taskId1);
      const t2 = await ctx.db.get(taskId2);
      return [t1, t2];
    });

    expect(tasks[0].sprintId).toBe(sprintId);
    expect(tasks[1].sprintId).toBe(sprintId);
  });

  it("returns 0 for empty taskIds array", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { sprintId } = await seedProgramWithWorkstreamAndSprint(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.mutation(api.tasks.bulkAssignToSprint, {
      taskIds: [],
      sprintId,
    });

    expect(result.updated).toBe(0);
  });

  it("rejects cross-org task assignment", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { sprintId } = await seedProgramWithWorkstreamAndSprint(t);

    let foreignTaskId = "";
    await t.run(async (ctx: any) => {
      const foreignProgram = await ctx.db.insert("programs", {
        orgId: "org_other",
        name: "Foreign",
        clientName: "Foreign",
        phase: "build",
        status: "active",
        slug: "foreign",
      });
      foreignTaskId = await ctx.db.insert("tasks", {
        orgId: "org_other",
        programId: foreignProgram,
        title: "Foreign Task",
        priority: "high",
        status: "backlog",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    await expect(
      asUser.mutation(api.tasks.bulkAssignToSprint, {
        taskIds: [foreignTaskId],
        sprintId,
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// tasks.countBySprint
// ---------------------------------------------------------------------------

describe("tasks.countBySprint", () => {
  it("returns correct count", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId, sprintId } = await seedProgramWithWorkstreamAndSprint(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        sprintId,
        title: "Task 1",
        priority: "high",
        status: "todo",
      });
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        sprintId,
        title: "Task 2",
        priority: "low",
        status: "backlog",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const count = await asUser.query(api.tasks.countBySprint, { sprintId });
    expect(count).toBe(2);
  });

  it("returns 0 for empty sprint", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { sprintId } = await seedProgramWithWorkstreamAndSprint(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const count = await asUser.query(api.tasks.countBySprint, { sprintId });
    expect(count).toBe(0);
  });
});
