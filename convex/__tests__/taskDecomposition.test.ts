import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

import { setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: create a taskDecompositions placeholder.
 */
async function seedDecompositionPlaceholder(
  t: any,
  opts: { orgId: string; requirementId: string; programId: string; status?: string },
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("taskDecompositions", {
      orgId: opts.orgId,
      requirementId: opts.requirementId,
      programId: opts.programId,
      status: opts.status ?? "processing",
      createdAt: Date.now(),
    });
  });
}

// ── storeDecomposition ──────────────────────────────────────────────

describe("taskDecomposition.storeDecomposition", () => {
  test("patches placeholder with decomposition data", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId } = await setupTestEnv(t);

    const placeholderId = await seedDecompositionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
    });

    await t.mutation(internalAny.taskDecomposition.storeDecomposition, {
      placeholderId,
      decomposition: {
        tasks: [
          { title: "Setup schema", description: "Create DB schema" },
          { title: "Build API", description: "Implement endpoints" },
        ],
      },
      thinkingTokens: 2000,
      totalTokensUsed: 5000,
    });

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(placeholderId);
    });

    expect(record.status).toBe("pending_review");
    expect(record.decomposition.tasks).toHaveLength(2);
    expect(record.thinkingTokens).toBe(2000);
    expect(record.totalTokensUsed).toBe(5000);
  });
});

// ── markDecompositionError ──────────────────────────────────────────

describe("taskDecomposition.markDecompositionError", () => {
  test("sets error status on placeholder", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId } = await setupTestEnv(t);

    const placeholderId = await seedDecompositionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
    });

    await t.mutation(internalAny.taskDecomposition.markDecompositionError, {
      placeholderId,
      error: "Token limit exceeded",
    });

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(placeholderId);
    });

    expect(record.status).toBe("error");
    expect(record.error).toBe("Token limit exceeded");
  });
});

// ── getLatestDecomposition ──────────────────────────────────────────

describe("taskDecomposition.getLatestDecomposition", () => {
  test("returns the most recent decomposition for a requirement", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, asUser } = await setupTestEnv(t);

    await seedDecompositionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "rejected",
    });

    const secondId = await seedDecompositionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending_review",
    });

    const result = await asUser.query(apiAny.taskDecomposition.getLatestDecomposition, {
      requirementId,
    });

    expect(result).not.toBeNull();
    expect(result._id).toBe(secondId);
    expect(result.status).toBe("pending_review");
  });

  test("returns null when no decompositions exist", async () => {
    const t = convexTest(schema, modules);
    const { requirementId, asUser } = await setupTestEnv(t);

    const result = await asUser.query(apiAny.taskDecomposition.getLatestDecomposition, {
      requirementId,
    });

    expect(result).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { requirementId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.taskDecomposition.getLatestDecomposition, {
        requirementId,
      }),
    ).rejects.toThrow();
  });
});

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

  const requirementId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("requirements", {
      orgId: "org-1",
      programId,
      workstreamId,
      refId: "REQ-001",
      title: "Test Requirement",
      description: "A test requirement for decomposition",
      priority: "must_have",
      fitGap: "custom_dev",
      status: "approved",
    });
  });

  return { userId, programId, workstreamId, requirementId };
}

// ── requestDecomposition ────────────────────────────────────────────
// Note: requestDecomposition calls ctx.scheduler.runAfter() to trigger an
// AI action (suggestTaskDecomposition). In the test environment, convex-test
// automatically fires scheduled functions which then fail because external
// APIs are unavailable. We suppress the unhandled rejection via process
// listener and focus on verifying the synchronous mutation behavior.

describe("taskDecomposition.requestDecomposition", () => {
  test("prevents duplicate processing", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Create an existing processing record
    await t.run(async (ctx: any) => {
      await ctx.db.insert("taskDecompositions", {
        orgId: "org-1",
        requirementId: data.requirementId,
        programId: data.programId,
        status: "processing",
        createdAt: Date.now(),
      });
    });

    await expect(
      asUser.mutation(apiAny.taskDecomposition.requestDecomposition, {
        requirementId: data.requirementId,
      }),
    ).rejects.toThrow("A task decomposition is already in progress for this requirement");
  });
});

// ── appendDecomposedTask ────────────────────────────────────────────

describe("taskDecomposition.appendDecomposedTask", () => {
  test("appends first task to empty decomposition", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    const placeholderId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("taskDecompositions", {
        orgId: "org-1",
        requirementId: data.requirementId,
        programId: data.programId,
        status: "processing",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internalAny.taskDecomposition.appendDecomposedTask, {
      placeholderId,
      task: { title: "Task 1", description: "First task" },
      taskIndex: 0,
    });

    const record = await t.run(async (ctx: any) => ctx.db.get(placeholderId));
    expect(record.decomposition.tasks).toHaveLength(1);
    expect(record.decomposition.tasks[0].title).toBe("Task 1");
    expect(record.generationProgress).toBe("Generated 1 task...");
  });

  test("appends subsequent tasks", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    const placeholderId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("taskDecompositions", {
        orgId: "org-1",
        requirementId: data.requirementId,
        programId: data.programId,
        status: "processing",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internalAny.taskDecomposition.appendDecomposedTask, {
      placeholderId,
      task: { title: "Task 1", description: "First task" },
      taskIndex: 0,
    });

    await t.mutation(internalAny.taskDecomposition.appendDecomposedTask, {
      placeholderId,
      task: { title: "Task 2", description: "Second task" },
      taskIndex: 1,
    });

    const record = await t.run(async (ctx: any) => ctx.db.get(placeholderId));
    expect(record.decomposition.tasks).toHaveLength(2);
    expect(record.decomposition.tasks[0].title).toBe("Task 1");
    expect(record.decomposition.tasks[1].title).toBe("Task 2");
    expect(record.generationProgress).toBe("Generated 2 tasks...");
  });
});

// ── finalizeDecomposition ───────────────────────────────────────────

describe("taskDecomposition.finalizeDecomposition", () => {
  test("sets status to pending_review and clears progress", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    const placeholderId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("taskDecompositions", {
        orgId: "org-1",
        requirementId: data.requirementId,
        programId: data.programId,
        status: "processing",
        createdAt: Date.now(),
        generationProgress: "Generated 3 tasks...",
      });
    });

    const fullDecomposition = {
      decomposition_rationale: "Breaking down the requirement into tasks",
      tasks: [
        { title: "Task 1", description: "First task" },
        { title: "Task 2", description: "Second task" },
        { title: "Task 3", description: "Third task" },
      ],
      implementation_considerations: "Consider edge cases",
    };

    await t.mutation(internalAny.taskDecomposition.finalizeDecomposition, {
      placeholderId,
      decomposition: fullDecomposition,
      thinkingTokens: 1500,
      totalTokensUsed: 4000,
    });

    const record = await t.run(async (ctx: any) => ctx.db.get(placeholderId));
    expect(record.status).toBe("pending_review");
    expect(record.generationProgress).toBeUndefined();
    expect(record.decomposition.tasks).toHaveLength(3);
    expect(record.decomposition.decomposition_rationale).toBe(
      "Breaking down the requirement into tasks",
    );
    expect(record.thinkingTokens).toBe(1500);
    expect(record.totalTokensUsed).toBe(4000);
  });
});

// ── updateDecompositionProgress ─────────────────────────────────────

describe("taskDecomposition.updateDecompositionProgress", () => {
  test("updates progress text on decomposition record", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    const placeholderId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("taskDecompositions", {
        orgId: "org-1",
        requirementId: data.requirementId,
        programId: data.programId,
        status: "processing",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internalAny.taskDecomposition.updateDecompositionProgress, {
      placeholderId,
      progress: "Analyzing requirement context...",
    });

    const record = await t.run(async (ctx: any) => ctx.db.get(placeholderId));
    expect(record.generationProgress).toBe("Analyzing requirement context...");
  });
});

// ── acceptDecomposition ─────────────────────────────────────────────

describe("taskDecomposition.acceptDecomposition", () => {
  test("creates tasks from decomposition and marks accepted", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, workstreamId, asUser } = await setupTestEnv(t);

    const placeholderId = await seedDecompositionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending_review",
    });

    // Store decomposition data
    await t.run(async (ctx: any) => {
      await ctx.db.patch(placeholderId, {
        decomposition: {
          tasks: [
            { title: "Task A", description: "First task", priority: "high" },
            { title: "Task B", description: "Second task", dependencies: [0] },
          ],
        },
      });
    });

    const taskIds = await asUser.mutation(apiAny.taskDecomposition.acceptDecomposition, {
      decompositionId: placeholderId,
    });

    expect(taskIds).toHaveLength(2);

    // Decomposition marked accepted
    const decomp = await t.run(async (ctx: any) => {
      return await ctx.db.get(placeholderId);
    });
    expect(decomp.status).toBe("accepted");

    // Tasks created
    const tasks = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("tasks")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });
    const createdTasks = tasks.filter((t: any) => t.title === "Task A" || t.title === "Task B");
    expect(createdTasks).toHaveLength(2);

    const taskA = createdTasks.find((t: any) => t.title === "Task A");
    expect(taskA.priority).toBe("high");
    expect(taskA.status).toBe("backlog");

    const taskB = createdTasks.find((t: any) => t.title === "Task B");
    // Task B depends on Task A
    expect(taskB.blockedBy).toHaveLength(1);

    // Requirement status updated
    const req = await t.run(async (ctx: any) => {
      return await ctx.db.get(requirementId);
    });
    // Original was "approved", should now be "in_progress"
    expect(req.status).toBe("in_progress");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, asOtherUser } = await setupTestEnv(t);

    const placeholderId = await seedDecompositionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending_review",
    });

    await expect(
      asOtherUser.mutation(apiAny.taskDecomposition.acceptDecomposition, {
        decompositionId: placeholderId,
      }),
    ).rejects.toThrow();
  });
});

// ── rejectDecomposition ─────────────────────────────────────────────

describe("taskDecomposition.rejectDecomposition", () => {
  test("marks decomposition as rejected", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, asUser } = await setupTestEnv(t);

    const placeholderId = await seedDecompositionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending_review",
    });

    await asUser.mutation(apiAny.taskDecomposition.rejectDecomposition, {
      decompositionId: placeholderId,
    });

    const decomp = await t.run(async (ctx: any) => {
      return await ctx.db.get(placeholderId);
    });
    expect(decomp.status).toBe("rejected");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, asOtherUser } = await setupTestEnv(t);

    const placeholderId = await seedDecompositionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending_review",
    });

    await expect(
      asOtherUser.mutation(apiAny.taskDecomposition.rejectDecomposition, {
        decompositionId: placeholderId,
      }),
    ).rejects.toThrow();
  });
});
