import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: insert a task and an execution audit record.
 */
async function insertAuditRecord(
  t: any,
  opts: {
    programId: string;
    taskId: string;
    userId: string;
    eventType?: string;
    sandboxSessionId?: string;
  },
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("executionAuditRecords", {
      orgId: "org-1",
      programId: opts.programId,
      taskId: opts.taskId,
      sandboxSessionId: opts.sandboxSessionId,
      eventType: opts.eventType ?? "sandbox_completed",
      initiatedBy: opts.userId,
      initiatedByName: "User One",
      initiatedByClerkId: "test-user-1",
      timestamp: Date.now(),
      taskTitle: "Test Task",
      environment: {},
      outcome: { status: "completed" },
    });
  });
}

async function insertTask(t: any, programId: string) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("tasks", {
      orgId: "org-1",
      programId,
      title: "Test Task",
      priority: "high",
      status: "todo",
    });
  });
}

// ── record (internal) ───────────────────────────────────────────────

describe("executionAudit.record (internal)", () => {
  test("stores an audit record", async () => {
    const t = convexTest(schema, modules);
    const { programId, userId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const recordId = await t.mutation(internalAny.executionAudit.record, {
      orgId: "org-1",
      programId,
      taskId,
      eventType: "sandbox_started",
      initiatedBy: userId,
      initiatedByName: "User One",
      initiatedByClerkId: "test-user-1",
      timestamp: Date.now(),
      taskTitle: "Test Task",
      environment: {},
      outcome: { status: "started" },
    });

    expect(recordId).toBeTruthy();

    const record = await t.run(async (ctx: any) => ctx.db.get(recordId));
    expect(record.eventType).toBe("sandbox_started");
  });
});

// ── listByTask ──────────────────────────────────────────────────────

describe("executionAudit.listByTask", () => {
  test("returns audit records for a task", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    await insertAuditRecord(t, { programId, taskId, userId });
    await insertAuditRecord(t, {
      programId,
      taskId,
      userId,
      eventType: "sandbox_failed",
    });

    const records = await asUser.query(apiAny.executionAudit.listByTask, {
      taskId,
    });
    expect(records).toHaveLength(2);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId, userId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    await insertAuditRecord(t, { programId, taskId, userId });

    await expect(asOtherUser.query(apiAny.executionAudit.listByTask, { taskId })).rejects.toThrow();
  });
});

// ── listByProgram ───────────────────────────────────────────────────

describe("executionAudit.listByProgram", () => {
  test("returns audit records for a program", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    await insertAuditRecord(t, { programId, taskId, userId });

    const records = await asUser.query(apiAny.executionAudit.listByProgram, {
      programId,
    });
    expect(records.length).toBeGreaterThanOrEqual(1);
  });

  test("filters by eventType when provided", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    await insertAuditRecord(t, {
      programId,
      taskId,
      userId,
      eventType: "review_accepted",
    });
    await insertAuditRecord(t, {
      programId,
      taskId,
      userId,
      eventType: "sandbox_failed",
    });

    const records = await asUser.query(apiAny.executionAudit.listByProgram, {
      programId,
      eventType: "review_accepted",
    });
    expect(records).toHaveLength(1);
    expect(records[0].eventType).toBe("review_accepted");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.executionAudit.listByProgram, { programId }),
    ).rejects.toThrow();
  });
});

// ── listBySession ───────────────────────────────────────────────────

describe("executionAudit.listBySession", () => {
  test("returns audit records for a sandbox session", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    // Create a sandbox session
    const sandboxSessionId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sandboxSessions", {
        orgId: "org-1",
        programId,
        taskId,
        sandboxId: "sbx-test-123",
        worktreeBranch: "feature/test",
        status: "ready",
        taskPrompt: "Test prompt",
        assignedBy: userId,
        startedAt: Date.now(),
      });
    });

    await insertAuditRecord(t, {
      programId,
      taskId,
      userId,
      sandboxSessionId,
    });

    const records = await asUser.query(apiAny.executionAudit.listBySession, {
      sandboxSessionId,
    });
    expect(records).toHaveLength(1);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId, userId } = await setupTestEnv(t);
    const taskId = await insertTask(t, programId);

    const sandboxSessionId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sandboxSessions", {
        orgId: "org-1",
        programId,
        taskId,
        sandboxId: "sbx-test-456",
        worktreeBranch: "feature/test2",
        status: "ready",
        taskPrompt: "Test prompt",
        assignedBy: userId,
        startedAt: Date.now(),
      });
    });

    await expect(
      asOtherUser.query(apiAny.executionAudit.listBySession, {
        sandboxSessionId,
      }),
    ).rejects.toThrow();
  });
});
