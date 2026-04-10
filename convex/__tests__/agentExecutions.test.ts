import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: insert an agentExecution into the DB.
 */
async function insertExecution(t: any, programId: string, overrides: Record<string, any> = {}) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("agentExecutions", {
      orgId: "org-1",
      programId,
      executionMode: "platform",
      trigger: "manual",
      taskType: "code_generation",
      reviewStatus: "pending",
      ...overrides,
    });
  });
}

// ── listByProgram ───────────────────────────────────────────────────

describe("agentExecutions.listByProgram", () => {
  test("returns executions with enriched skill names", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    // Create a skill to link
    const skillId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skills", {
        orgId: "org-1",
        programId,
        name: "Apex Developer",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        currentVersion: "1.0",
        content: "skill content",
        lineCount: 10,
        status: "active",
      });
    });

    await insertExecution(t, programId, { skillId });
    await insertExecution(t, programId);

    const results = await asUser.query(apiAny.agentExecutions.listByProgram, {
      programId,
    });
    expect(results).toHaveLength(2);

    const withSkill = results.find((r: any) => r.skillName !== null);
    expect(withSkill.skillName).toBe("Apex Developer");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.agentExecutions.listByProgram, { programId }),
    ).rejects.toThrow();
  });
});

// ── get ─────────────────────────────────────────────────────────────

describe("agentExecutions.get", () => {
  test("returns execution with skill and user names", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    const executionId = await insertExecution(t, programId, { userId });

    const result = await asUser.query(apiAny.agentExecutions.get, {
      executionId,
    });
    expect(result.userName).toBe("User One");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    const executionId = await insertExecution(t, programId);

    await expect(asOtherUser.query(apiAny.agentExecutions.get, { executionId })).rejects.toThrow();
  });
});

// ── listRecent ──────────────────────────────────────────────────────

describe("agentExecutions.listRecent", () => {
  test("returns at most 10 executions", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    // Create 12 executions
    for (let i = 0; i < 12; i++) {
      await insertExecution(t, programId);
    }

    const results = await asUser.query(apiAny.agentExecutions.listRecent, {
      programId,
    });
    expect(results).toHaveLength(10);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.agentExecutions.listRecent, { programId }),
    ).rejects.toThrow();
  });
});

// ── listByTask ──────────────────────────────────────────────────────

describe("agentExecutions.listByTask", () => {
  test("returns executions linked to a task", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId,
        title: "Test Task",
        priority: "high",
        status: "todo",
      });
    });

    await insertExecution(t, programId, { taskId });
    await insertExecution(t, programId); // No task link

    const results = await asUser.query(apiAny.agentExecutions.listByTask, {
      taskId,
    });
    expect(results).toHaveLength(1);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId,
        title: "Task",
        priority: "high",
        status: "todo",
      });
    });

    await expect(
      asOtherUser.query(apiAny.agentExecutions.listByTask, { taskId }),
    ).rejects.toThrow();
  });
});

// ── updateReview ────────────────────────────────────────────────────

describe("agentExecutions.updateReview", () => {
  test("updates review status to accepted", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    const executionId = await insertExecution(t, programId);

    await asUser.mutation(apiAny.agentExecutions.updateReview, {
      executionId,
      reviewStatus: "accepted",
      reviewNotes: "Looks good",
    });

    const updated = await t.run(async (ctx: any) => ctx.db.get(executionId));
    expect(updated.reviewStatus).toBe("accepted");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    const executionId = await insertExecution(t, programId);

    await expect(
      asOtherUser.mutation(apiAny.agentExecutions.updateReview, {
        executionId,
        reviewStatus: "rejected",
      }),
    ).rejects.toThrow();
  });
});
