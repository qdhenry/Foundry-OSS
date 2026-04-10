import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

import { setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: create a task for testing subtask generation.
 */
async function seedTask(t: any, opts: { orgId: string; programId: string; workstreamId: string }) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("tasks", {
      orgId: opts.orgId,
      programId: opts.programId,
      workstreamId: opts.workstreamId,
      title: "Test Task",
      description: "A test task for subtask generation",
      priority: "medium",
      status: "backlog",
    });
  });
}

// ── markSubtaskGenerationError ──────────────────────────────────────

describe("subtaskGeneration.markSubtaskGenerationError", () => {
  test("sets error status on task", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId } = await setupTestEnv(t);
    const taskId = await seedTask(t, { orgId, programId, workstreamId });

    await t.mutation(internalAny.subtaskGeneration.markSubtaskGenerationError, {
      taskId,
      error: "Model rate limited",
    });

    const task = await t.run(async (ctx: any) => {
      return await ctx.db.get(taskId);
    });

    expect(task.subtaskGenerationStatus).toBe("error");
    expect(task.subtaskGenerationError).toBe("Model rate limited");
  });
});

// ── updateProgress ──────────────────────────────────────────────────

describe("subtaskGeneration.updateProgress", () => {
  test("sets progress string on task", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId } = await setupTestEnv(t);
    const taskId = await seedTask(t, { orgId, programId, workstreamId });

    await t.mutation(internalAny.subtaskGeneration.updateProgress, {
      taskId,
      progress: "Analyzing repository structure...",
    });

    const task = await t.run(async (ctx: any) => {
      return await ctx.db.get(taskId);
    });

    expect(task.subtaskGenerationProgress).toBe("Analyzing repository structure...");
  });
});

// ── insertOneSubtask ────────────────────────────────────────────────

describe("subtaskGeneration.insertOneSubtask", () => {
  const sampleSubtask = {
    title: "Setup database schema",
    description: "Create the initial schema",
    prompt: "Create a schema file with tables",
    estimatedFiles: 3,
    complexityScore: 5,
    estimatedDurationMs: 60000,
    isPausePoint: false,
  };

  test("inserts a subtask and updates task counters", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId } = await setupTestEnv(t);
    const taskId = await seedTask(t, { orgId, programId, workstreamId });

    await t.mutation(internalAny.subtaskGeneration.insertOneSubtask, {
      taskId,
      subtask: sampleSubtask,
      order: 0,
      isFirst: true,
    });

    const task = await t.run(async (ctx: any) => {
      return await ctx.db.get(taskId);
    });

    expect(task.hasSubtasks).toBe(true);
    expect(task.subtaskCount).toBe(1);
    expect(task.subtasksCompleted).toBe(0);

    const subtasks = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("subtasks")
        .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
        .collect();
    });

    expect(subtasks).toHaveLength(1);
    expect(subtasks[0].title).toBe("Setup database schema");
    expect(subtasks[0].status).toBe("pending");
    expect(subtasks[0].order).toBe(0);
  });

  test("deletes existing subtasks when isFirst is true", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId } = await setupTestEnv(t);
    const taskId = await seedTask(t, { orgId, programId, workstreamId });

    // Insert an existing subtask
    await t.run(async (ctx: any) => {
      await ctx.db.insert("subtasks", {
        orgId,
        taskId,
        programId,
        title: "Old subtask",
        description: "Old",
        prompt: "Old prompt",
        estimatedFiles: 1,
        complexityScore: 1,
        estimatedDurationMs: 1000,
        order: 0,
        isPausePoint: false,
        status: "pending",
        retryCount: 0,
      });
    });

    // Insert new subtask as first
    await t.mutation(internalAny.subtaskGeneration.insertOneSubtask, {
      taskId,
      subtask: sampleSubtask,
      order: 0,
      isFirst: true,
    });

    const subtasks = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("subtasks")
        .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
        .collect();
    });

    expect(subtasks).toHaveLength(1);
    expect(subtasks[0].title).toBe("Setup database schema");
  });

  test("increments count when isFirst is false", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId } = await setupTestEnv(t);
    const taskId = await seedTask(t, { orgId, programId, workstreamId });

    // First subtask
    await t.mutation(internalAny.subtaskGeneration.insertOneSubtask, {
      taskId,
      subtask: sampleSubtask,
      order: 0,
      isFirst: true,
    });

    // Second subtask
    await t.mutation(internalAny.subtaskGeneration.insertOneSubtask, {
      taskId,
      subtask: { ...sampleSubtask, title: "Second subtask" },
      order: 1,
      isFirst: false,
    });

    const task = await t.run(async (ctx: any) => {
      return await ctx.db.get(taskId);
    });

    expect(task.subtaskCount).toBe(2);
  });
});

// ── finalizeGeneration ──────────────────────────────────────────────

describe("subtaskGeneration.finalizeGeneration", () => {
  test("marks generation completed and sets final counts", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId } = await setupTestEnv(t);
    const taskId = await seedTask(t, { orgId, programId, workstreamId });

    await t.mutation(internalAny.subtaskGeneration.finalizeGeneration, {
      taskId,
      totalSubtasks: 5,
      totalTokensUsed: 3000,
    });

    const task = await t.run(async (ctx: any) => {
      return await ctx.db.get(taskId);
    });

    expect(task.subtaskGenerationStatus).toBe("completed");
    expect(task.subtaskCount).toBe(5);
    expect(task.subtasksCompleted).toBe(0);
    expect(task.subtasksFailed).toBe(0);
    expect(task.subtaskGenerationProgress).toBeUndefined();
  });
});

// ── getGenerationStatus ─────────────────────────────────────────────

describe("subtaskGeneration.getGenerationStatus", () => {
  test("returns idle status by default", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId, asUser } = await setupTestEnv(t);
    const taskId = await seedTask(t, { orgId, programId, workstreamId });

    const status = await asUser.query(apiAny.subtaskGeneration.getGenerationStatus, {
      taskId,
    });

    expect(status.status).toBe("idle");
    expect(status.error).toBeUndefined();
    expect(status.progress).toBeUndefined();
  });

  test("returns processing status after generation starts", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId, asUser } = await setupTestEnv(t);
    const taskId = await seedTask(t, { orgId, programId, workstreamId });

    // Simulate generation start
    await t.run(async (ctx: any) => {
      await ctx.db.patch(taskId, { subtaskGenerationStatus: "processing" });
    });

    const status = await asUser.query(apiAny.subtaskGeneration.getGenerationStatus, {
      taskId,
    });

    expect(status.status).toBe("processing");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId, asOtherUser } = await setupTestEnv(t);
    const taskId = await seedTask(t, { orgId, programId, workstreamId });

    await expect(
      asOtherUser.query(apiAny.subtaskGeneration.getGenerationStatus, {
        taskId,
      }),
    ).rejects.toThrow();
  });
});
