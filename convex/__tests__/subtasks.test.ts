import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { seedFullStack, setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: insert a task into the DB and return its ID.
 */
async function insertTask(t: any, programId: string, orgId = "org-1") {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("tasks", {
      orgId,
      programId,
      title: "Test Task",
      priority: "high",
      status: "todo",
    });
  });
}

// ── listByTask ──────────────────────────────────────────────────────

describe("subtasks.listByTask", () => {
  test("returns subtasks for a task", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("subtasks", {
        orgId: "org-1",
        taskId,
        programId,
        title: "Subtask 1",
        description: "Desc",
        prompt: "Do this",
        estimatedFiles: 1,
        complexityScore: 1,
        estimatedDurationMs: 60000,
        order: 0,
        isPausePoint: false,
        status: "pending",
        retryCount: 0,
      });
    });

    const result = await asUser.query(apiAny.subtasks.listByTask, { taskId });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Subtask 1");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    await expect(asOtherUser.query(apiAny.subtasks.listByTask, { taskId })).rejects.toThrow();
  });
});

// ── get ─────────────────────────────────────────────────────────────

describe("subtasks.get", () => {
  test("returns a subtask by ID", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const subtaskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("subtasks", {
        orgId: "org-1",
        taskId,
        programId,
        title: "Get Me",
        description: "",
        prompt: "",
        estimatedFiles: 1,
        complexityScore: 1,
        estimatedDurationMs: 60000,
        order: 0,
        isPausePoint: false,
        status: "pending",
        retryCount: 0,
      });
    });

    const result = await asUser.query(apiAny.subtasks.get, { subtaskId });
    expect(result.title).toBe("Get Me");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const subtaskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("subtasks", {
        orgId: "org-1",
        taskId,
        programId,
        title: "Secret",
        description: "",
        prompt: "",
        estimatedFiles: 1,
        complexityScore: 1,
        estimatedDurationMs: 60000,
        order: 0,
        isPausePoint: false,
        status: "pending",
        retryCount: 0,
      });
    });

    await expect(asOtherUser.query(apiAny.subtasks.get, { subtaskId })).rejects.toThrow();
  });
});

// ── create ──────────────────────────────────────────────────────────

describe("subtasks.create", () => {
  test("creates a subtask and updates parent task", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const subtaskId = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "New Subtask",
      description: "A description",
    });

    expect(subtaskId).toBeTruthy();

    // Verify parent task updated
    const task = await t.run(async (ctx: any) => ctx.db.get(taskId));
    expect(task.hasSubtasks).toBe(true);
    expect(task.subtaskCount).toBe(1);
  });

  test("auto-increments order", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "First",
    });
    const secondId = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "Second",
    });

    const second = await t.run(async (ctx: any) => ctx.db.get(secondId));
    expect(second.order).toBe(1);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    await expect(
      asOtherUser.mutation(apiAny.subtasks.create, {
        taskId,
        title: "Blocked",
      }),
    ).rejects.toThrow();
  });
});

// ── update ──────────────────────────────────────────────────────────

describe("subtasks.update", () => {
  test("updates subtask fields", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const subtaskId = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "Original",
    });

    await asUser.mutation(apiAny.subtasks.update, {
      subtaskId,
      title: "Updated",
      isPausePoint: true,
    });

    const updated = await t.run(async (ctx: any) => ctx.db.get(subtaskId));
    expect(updated.title).toBe("Updated");
    expect(updated.isPausePoint).toBe(true);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asUser, asOtherUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const subtaskId = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "Mine",
    });

    await expect(
      asOtherUser.mutation(apiAny.subtasks.update, {
        subtaskId,
        title: "Hacked",
      }),
    ).rejects.toThrow();
  });
});

// ── updateStatus ────────────────────────────────────────────────────

describe("subtasks.updateStatus", () => {
  test("updates status and rolls up counts to parent task", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const subtaskId = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "Completable",
    });

    await asUser.mutation(apiAny.subtasks.updateStatus, {
      subtaskId,
      status: "completed",
    });

    const subtask = await t.run(async (ctx: any) => ctx.db.get(subtaskId));
    expect(subtask.status).toBe("completed");

    const task = await t.run(async (ctx: any) => ctx.db.get(taskId));
    expect(task.subtasksCompleted).toBe(1);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asUser, asOtherUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const subtaskId = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "Locked",
    });

    await expect(
      asOtherUser.mutation(apiAny.subtasks.updateStatus, {
        subtaskId,
        status: "completed",
      }),
    ).rejects.toThrow();
  });
});

// ── remove ──────────────────────────────────────────────────────────

describe("subtasks.remove", () => {
  test("removes subtask and re-orders remaining", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const first = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "First",
    });
    await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "Second",
    });

    await asUser.mutation(apiAny.subtasks.remove, { subtaskId: first });

    const remaining = await asUser.query(apiAny.subtasks.listByTask, {
      taskId,
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe("Second");
    expect(remaining[0].order).toBe(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asUser, asOtherUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const subtaskId = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "Protected",
    });

    await expect(asOtherUser.mutation(apiAny.subtasks.remove, { subtaskId })).rejects.toThrow();
  });
});

// ── reorder ─────────────────────────────────────────────────────────

describe("subtasks.reorder", () => {
  test("reorders subtasks", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const first = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "First",
    });
    const second = await asUser.mutation(apiAny.subtasks.create, {
      taskId,
      title: "Second",
    });

    // Swap order
    await asUser.mutation(apiAny.subtasks.reorder, {
      taskId,
      subtaskIds: [second, first],
    });

    const firstDoc = await t.run(async (ctx: any) => ctx.db.get(first));
    const secondDoc = await t.run(async (ctx: any) => ctx.db.get(second));
    expect(secondDoc.order).toBe(0);
    expect(firstDoc.order).toBe(1);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    await expect(
      asOtherUser.mutation(apiAny.subtasks.reorder, {
        taskId,
        subtaskIds: [],
      }),
    ).rejects.toThrow();
  });
});

// ── bulkCreate (internal) ───────────────────────────────────────────

describe("subtasks.bulkCreate (internal)", () => {
  test("bulk creates subtasks and updates parent task", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedFullStack(t);
    const taskId = await insertTask(t, programId);

    await t.mutation(internalAny.subtasks.bulkCreate, {
      taskId,
      subtasks: [
        {
          title: "S1",
          description: "D1",
          prompt: "P1",
          estimatedFiles: 2,
          complexityScore: 3,
          estimatedDurationMs: 120000,
          isPausePoint: false,
        },
        {
          title: "S2",
          description: "D2",
          prompt: "P2",
          estimatedFiles: 1,
          complexityScore: 1,
          estimatedDurationMs: 60000,
          isPausePoint: true,
        },
      ],
    });

    const task = await t.run(async (ctx: any) => ctx.db.get(taskId));
    expect(task.subtaskCount).toBe(2);
    expect(task.hasSubtasks).toBe(true);
  });
});
