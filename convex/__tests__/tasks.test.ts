import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

type SetupData = {
  userId: string;
  otherUserId: string;
  programId: string;
  workstreamId: string;
  sprintId: string;
  requirementId: string;
  orgId: string;
};

async function setupBaseData(t: any): Promise<SetupData> {
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

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-1",
      name: "Test Program",
      clientName: "Test Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  const workstreamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-1",
      programId,
      name: "Backend Workstream",
      shortCode: "BE",
      status: "on_track",
      sortOrder: 1,
    });
  });

  const sprintId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("sprints", {
      orgId: "org-1",
      programId,
      workstreamId,
      name: "Sprint 1",
      number: 1,
      status: "active",
    });
  });

  const requirementId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("requirements", {
      orgId: "org-1",
      programId,
      workstreamId,
      refId: "REQ-001",
      title: "Test Requirement",
      description: "A test requirement",
      priority: "must_have",
      fitGap: "custom_dev",
      status: "approved",
    });
  });

  return {
    userId,
    otherUserId,
    programId,
    workstreamId,
    sprintId,
    requirementId,
    orgId: "org-1",
  };
}

// ── listByProgram ──────────────────────────────────────────────────

describe("tasks.listByProgram", () => {
  test("returns all tasks for a program", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task A",
        priority: "high",
        status: "todo",
      });
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task B",
        priority: "medium",
        status: "backlog",
      });
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task C",
        priority: "low",
        status: "done",
      });
    });

    const tasks = await asUser.query(apiAny.tasks.listByProgram, {
      programId: data.programId,
    });
    expect(tasks).toHaveLength(3);
  });

  test("filters by status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task A",
        priority: "high",
        status: "todo",
      });
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task B",
        priority: "medium",
        status: "done",
      });
    });

    const tasks = await asUser.query(apiAny.tasks.listByProgram, {
      programId: data.programId,
      status: "todo",
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Task A");
  });

  test("filters by priority", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task Critical",
        priority: "critical",
        status: "todo",
      });
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task Low",
        priority: "low",
        status: "todo",
      });
    });

    const tasks = await asUser.query(apiAny.tasks.listByProgram, {
      programId: data.programId,
      priority: "critical",
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Task Critical");
  });

  test("filters by workstreamId", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        title: "Task with WS",
        priority: "high",
        status: "todo",
      });
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task without WS",
        priority: "medium",
        status: "todo",
      });
    });

    const tasks = await asUser.query(apiAny.tasks.listByProgram, {
      programId: data.programId,
      workstreamId: data.workstreamId,
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Task with WS");
  });

  test("enriches tasks with assigneeName, workstreamName, sprintName", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        sprintId: data.sprintId,
        requirementId: data.requirementId,
        assigneeId: data.userId,
        title: "Enriched Task",
        priority: "high",
        status: "todo",
      });
    });

    const tasks = await asUser.query(apiAny.tasks.listByProgram, {
      programId: data.programId,
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].assigneeName).toBe("User One");
    expect(tasks[0].workstreamName).toBe("Backend Workstream");
    expect(tasks[0].workstreamShortCode).toBe("BE");
    expect(tasks[0].sprintName).toBe("Sprint 1");
    expect(tasks[0].requirementTitle).toBe("Test Requirement");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.tasks.listByProgram, {
        programId: data.programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── get ────────────────────────────────────────────────────────────

describe("tasks.get", () => {
  test("returns single task with full enrichment", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        sprintId: data.sprintId,
        requirementId: data.requirementId,
        assigneeId: data.userId,
        title: "Full Task",
        priority: "high",
        status: "todo",
      });
    });

    const task = await asUser.query(apiAny.tasks.get, { taskId });
    expect(task.title).toBe("Full Task");
    expect(task.assigneeName).toBe("User One");
    expect(task.sprintName).toBe("Sprint 1");
    expect(task.workstreamName).toBe("Backend Workstream");
    expect(task.workstreamShortCode).toBe("BE");
    expect(task.requirementTitle).toBe("Test Requirement");
    expect(task.requirementRefId).toBe("REQ-001");
    expect(task.resolvedBlockedBy).toEqual([]);
  });

  test("returns resolvedBlockedBy with blocker details", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const blockerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Blocker Task",
        priority: "critical",
        status: "in_progress",
      });
    });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Blocked Task",
        priority: "high",
        status: "backlog",
        blockedBy: [blockerId],
      });
    });

    const task = await asUser.query(apiAny.tasks.get, { taskId });
    expect(task.resolvedBlockedBy).toHaveLength(1);
    expect(task.resolvedBlockedBy[0].title).toBe("Blocker Task");
    expect(task.resolvedBlockedBy[0].status).toBe("in_progress");
    expect(task.resolvedBlockedBy[0]._id).toBe(blockerId);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Private Task",
        priority: "high",
        status: "todo",
      });
    });

    await expect(asOtherUser.query(apiAny.tasks.get, { taskId })).rejects.toThrow("Access denied");
  });

  test("throws on non-existent task ID", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Create and immediately delete a task to get a valid-format but non-existent ID
    const taskId = await t.run(async (ctx: any) => {
      const id = await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: (await ctx.db.query("programs").first())._id,
        title: "Temp",
        priority: "low",
        status: "backlog",
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(asUser.query(apiAny.tasks.get, { taskId })).rejects.toThrow("Task not found");
  });
});

// ── create ─────────────────────────────────────────────────────────

describe("tasks.create", () => {
  test("creates task with required fields only", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await asUser.mutation(apiAny.tasks.create, {
      orgId: "org-1",
      programId: data.programId,
      title: "Simple Task",
      priority: "medium",
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task.title).toBe("Simple Task");
    expect(task.priority).toBe("medium");
    expect(task.status).toBe("backlog"); // default status
    expect(task.orgId).toBe("org-1");
  });

  test("creates task with all optional fields", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await asUser.mutation(apiAny.tasks.create, {
      orgId: "org-1",
      programId: data.programId,
      title: "Full Task",
      description: "A fully specified task",
      acceptanceCriteria: ["Criteria 1", "Criteria 2"],
      storyPoints: 8,
      workstreamId: data.workstreamId,
      sprintId: data.sprintId,
      requirementId: data.requirementId,
      assigneeId: data.userId,
      priority: "critical",
      status: "todo",
      dueDate: 1700000000000,
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task.title).toBe("Full Task");
    expect(task.description).toBe("A fully specified task");
    expect(task.acceptanceCriteria).toEqual(["Criteria 1", "Criteria 2"]);
    expect(task.storyPoints).toBe(8);
    expect(task.workstreamId).toBe(data.workstreamId);
    expect(task.sprintId).toBe(data.sprintId);
    expect(task.requirementId).toBe(data.requirementId);
    expect(task.assigneeId).toBe(data.userId);
    expect(task.priority).toBe("critical");
    expect(task.status).toBe("todo");
    expect(task.dueDate).toBe(1700000000000);
  });

  test("validates org access (cross-org rejection)", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.tasks.create, {
        orgId: "org-1",
        programId: data.programId,
        title: "Unauthorized Task",
        priority: "low",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── update ─────────────────────────────────────────────────────────

describe("tasks.update", () => {
  test("updates title", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Original Title",
        priority: "medium",
        status: "todo",
      });
    });

    await asUser.mutation(apiAny.tasks.update, {
      taskId,
      title: "Updated Title",
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task.title).toBe("Updated Title");
  });

  test("updates priority", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task",
        priority: "low",
        status: "todo",
      });
    });

    await asUser.mutation(apiAny.tasks.update, {
      taskId,
      priority: "critical",
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task.priority).toBe("critical");
  });

  test("updates acceptanceCriteria and storyPoints", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task",
        priority: "medium",
        status: "todo",
      });
    });

    await asUser.mutation(apiAny.tasks.update, {
      taskId,
      acceptanceCriteria: ["New criterion A", "New criterion B"],
      storyPoints: 5,
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task.acceptanceCriteria).toEqual(["New criterion A", "New criterion B"]);
    expect(task.storyPoints).toBe(5);
  });

  test("validates org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task",
        priority: "medium",
        status: "todo",
      });
    });

    await expect(
      asOtherUser.mutation(apiAny.tasks.update, {
        taskId,
        title: "Hacked",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── updateStatus ───────────────────────────────────────────────────

describe("tasks.updateStatus", () => {
  test("changes status successfully", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task",
        priority: "medium",
        status: "backlog",
      });
    });

    await asUser.mutation(apiAny.tasks.updateStatus, {
      taskId,
      status: "in_progress",
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task.status).toBe("in_progress");
  });

  test("validates org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task",
        priority: "medium",
        status: "backlog",
      });
    });

    await expect(
      asOtherUser.mutation(apiAny.tasks.updateStatus, {
        taskId,
        status: "done",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── remove ─────────────────────────────────────────────────────────

describe("tasks.remove", () => {
  test("deletes task in backlog status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Backlog Task",
        priority: "low",
        status: "backlog",
      });
    });

    await asUser.mutation(apiAny.tasks.remove, { taskId });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task).toBeNull();
  });

  test("rejects deletion of non-backlog tasks", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Todo Task",
        priority: "medium",
        status: "todo",
      });
    });

    await expect(asUser.mutation(apiAny.tasks.remove, { taskId })).rejects.toThrow(
      "Only tasks with status 'backlog' can be deleted",
    );
  });

  test("validates org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task",
        priority: "low",
        status: "backlog",
      });
    });

    await expect(asOtherUser.mutation(apiAny.tasks.remove, { taskId })).rejects.toThrow(
      "Access denied",
    );
  });
});

// ── updateStatusInternal ───────────────────────────────────────────

describe("tasks.updateStatusInternal", () => {
  test("updates status without assertOrgAccess check", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    // logAuditEvent requires an authenticated user, so we provide identity
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Internal Task",
        priority: "high",
        status: "todo",
      });
    });

    await asUser.mutation(internalAny.tasks.updateStatusInternal, {
      taskId,
      status: "in_progress",
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task.status).toBe("in_progress");
  });

  test("no-ops when status is the same", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Same Status Task",
        priority: "medium",
        status: "done",
      });
    });

    // No-op path doesn't reach logAuditEvent, so no identity needed
    await t.mutation(internalAny.tasks.updateStatusInternal, {
      taskId,
      status: "done",
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task.status).toBe("done");
  });
});

// ── getBySprint ────────────────────────────────────────────────────

describe("tasks.getBySprint", () => {
  test("returns tasks for given sprintId", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        sprintId: data.sprintId,
        title: "Sprint Task 1",
        priority: "high",
        status: "todo",
      });
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        sprintId: data.sprintId,
        title: "Sprint Task 2",
        priority: "medium",
        status: "in_progress",
      });
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "No Sprint Task",
        priority: "low",
        status: "backlog",
      });
    });

    const tasks = await t.query(internalAny.tasks.getBySprint, {
      sprintId: data.sprintId,
    });
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t: any) => t.title).sort()).toEqual(["Sprint Task 1", "Sprint Task 2"]);
  });
});

// ── getByProgram ───────────────────────────────────────────────────

describe("tasks.getByProgram", () => {
  test("returns tasks for given programId", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Program Task 1",
        priority: "high",
        status: "todo",
      });
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Program Task 2",
        priority: "medium",
        status: "done",
      });
    });

    const tasks = await t.query(internalAny.tasks.getByProgram, {
      programId: data.programId,
    });
    expect(tasks).toHaveLength(2);
  });
});
