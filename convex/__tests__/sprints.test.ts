import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

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

  await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-2",
      email: "user2@example.com",
      name: "User Two",
      orgIds: ["org-2"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-1",
      name: "Test Program",
      clientName: "Test Client",
      sourcePlatform: "none",
      targetPlatform: "none",
      phase: "build",
      status: "active",
    });
  });

  const workstreamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-1",
      programId,
      name: "Backend",
      shortCode: "BE",
      status: "on_track",
      sortOrder: 1,
    });
  });

  return { userId, programId, workstreamId };
}

// ── create ───────────────────────────────────────────────────────────

describe("sprints.create", () => {
  test("creates sprint with auto-increment number", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sprintId = await asUser.mutation(apiAny.sprints.create, {
      orgId: "org-1",
      programId: data.programId,
      workstreamId: data.workstreamId,
      name: "Sprint 1",
    });

    const sprint = await t.run(async (ctx: any) => await ctx.db.get(sprintId));
    expect(sprint.name).toBe("Sprint 1");
    expect(sprint.number).toBe(1);
    expect(sprint.status).toBe("planning");

    // Second sprint auto-increments
    const sprint2Id = await asUser.mutation(apiAny.sprints.create, {
      orgId: "org-1",
      programId: data.programId,
      workstreamId: data.workstreamId,
      name: "Sprint 2",
    });
    const sprint2 = await t.run(async (ctx: any) => await ctx.db.get(sprint2Id));
    expect(sprint2.number).toBe(2);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.sprints.create, {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Bad Sprint",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── listByProgram ────────────────────────────────────────────────────

describe("sprints.listByProgram", () => {
  test("returns sprints for a program", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "planning",
      });
      await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 2",
        number: 2,
        status: "active",
      });
    });

    const sprints = await asUser.query(apiAny.sprints.listByProgram, {
      programId: data.programId,
    });
    expect(sprints).toHaveLength(2);
  });

  test("filters by status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "planning",
      });
      await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 2",
        number: 2,
        status: "active",
      });
    });

    const sprints = await asUser.query(apiAny.sprints.listByProgram, {
      programId: data.programId,
      status: "active",
    });
    expect(sprints).toHaveLength(1);
    expect(sprints[0].name).toBe("Sprint 2");
  });
});

// ── get ──────────────────────────────────────────────────────────────

describe("sprints.get", () => {
  test("returns a sprint", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "planning",
      });
    });

    const sprint = await asUser.query(apiAny.sprints.get, { sprintId });
    expect(sprint.name).toBe("Sprint 1");
  });
});

// ── activate ─────────────────────────────────────────────────────────

describe("sprints.activate", () => {
  test("activates a planning sprint", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "planning",
      });
    });

    await asUser.mutation(apiAny.sprints.activate, { sprintId });

    const sprint = await t.run(async (ctx: any) => await ctx.db.get(sprintId));
    expect(sprint.status).toBe("active");
  });

  test("deactivates other active sprints in same workstream", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const activeSprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "active",
      });
    });

    const newSprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 2",
        number: 2,
        status: "planning",
      });
    });

    await asUser.mutation(apiAny.sprints.activate, { sprintId: newSprintId });

    const oldSprint = await t.run(async (ctx: any) => await ctx.db.get(activeSprintId));
    expect(oldSprint.status).toBe("completed");
  });

  test("rejects activating non-planning sprint", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "completed",
      });
    });

    await expect(asUser.mutation(apiAny.sprints.activate, { sprintId })).rejects.toThrow(
      "Only sprints with planning status",
    );
  });
});

// ── complete ─────────────────────────────────────────────────────────

describe("sprints.complete", () => {
  test("completes an active sprint", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "active",
      });
    });

    await asUser.mutation(apiAny.sprints.complete, { sprintId });

    const sprint = await t.run(async (ctx: any) => await ctx.db.get(sprintId));
    expect(sprint.status).toBe("completed");
  });

  test("rejects completing non-active sprint", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "planning",
      });
    });

    await expect(asUser.mutation(apiAny.sprints.complete, { sprintId })).rejects.toThrow(
      "Only active sprints can be completed",
    );
  });
});

// ── remove ───────────────────────────────────────────────────────────

describe("sprints.remove", () => {
  test("removes a planning sprint", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "planning",
      });
    });

    await asUser.mutation(apiAny.sprints.remove, { sprintId });

    const sprint = await t.run(async (ctx: any) => await ctx.db.get(sprintId));
    expect(sprint).toBeNull();
  });

  test("rejects removing non-planning sprint", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "active",
      });
    });

    await expect(asUser.mutation(apiAny.sprints.remove, { sprintId })).rejects.toThrow(
      "Can only delete sprints with planning status",
    );
  });
});

// ── internal queries ─────────────────────────────────────────────────

describe("sprints.getByProgramInternal", () => {
  test("returns all sprints for a program", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprints", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Sprint 1",
        number: 1,
        status: "planning",
      });
    });

    const sprints = await t.query(internalAny.sprints.getByProgramInternal, {
      programId: data.programId,
    });
    expect(sprints).toHaveLength(1);
  });
});
