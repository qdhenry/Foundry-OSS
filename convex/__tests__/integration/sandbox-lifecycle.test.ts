import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

/**
 * Integration tests for the sandbox session lifecycle:
 * - Session creation with validation
 * - Status transitions (state machine: provisioning → cloning → executing → ...)
 * - Terminal status handling (completed, failed, cancelled)
 * - Setup progress tracking (10-stage pipeline)
 * - Runtime mode management
 * - Pin/unpin sessions
 * - Chat message flow
 */

// ── Helpers ──────────────────────────────────────────────────────────

async function seedSandboxEnv(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "sandbox-user-1",
      email: "sandbox@example.com",
      name: "Sandbox User",
      orgIds: ["org-sb"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-sb",
      name: "Sandbox Program",
      clientName: "SB Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  const taskId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("tasks", {
      orgId: "org-sb",
      programId,
      title: "Sandbox Task",
      priority: "high",
      status: "in_progress",
    });
  });

  return { userId, programId, taskId, orgId: "org-sb" };
}

async function createSession(
  t: any,
  env: Awaited<ReturnType<typeof seedSandboxEnv>>,
  overrides: Record<string, unknown> = {},
) {
  return await t.mutation(internalAny.sandbox.sessions.create, {
    orgId: env.orgId,
    programId: env.programId,
    taskId: env.taskId,
    sandboxId: `sb-${Math.random().toString(36).slice(2, 8)}`,
    worktreeBranch: "feat/sandbox-task",
    taskPrompt: "Implement the product catalog migration",
    assignedBy: env.userId,
    startedAt: Date.now(),
    ...overrides,
  });
}

// ── Session Creation ────────────────────────────────────────────────

describe("sandbox-lifecycle: session creation", () => {
  test("creates session with provisioning status by default", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);

    const sessionId = await createSession(t, env);

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("provisioning");
    expect(session.runtime).toBe("cloud");
    expect(session.orgId).toBe("org-sb");
    expect(session.taskPrompt).toBe("Implement the product catalog migration");
  });

  test("creates local runtime sessions with device metadata", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const asUser = t.withIdentity({ subject: "sandbox-user-1" });

    const sessionId = await createSession(t, env, {
      runtime: "local",
      localDeviceId: "device-local-1",
      localDeviceName: "Sandbox Laptop",
      status: "executing",
    });

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.runtime).toBe("local");
    expect(session.localDeviceId).toBe("device-local-1");
    expect(session.localDeviceName).toBe("Sandbox Laptop");

    const localSessions = await asUser.query(apiAny.sandbox.sessions.listByOrg, {
      orgId: env.orgId,
      runtime: "local",
    });
    expect(localSessions.some((item: any) => item._id === sessionId)).toBe(true);
  });

  test("rejects creation in terminal status", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);

    await expect(createSession(t, env, { status: "completed" })).rejects.toThrow(
      "Cannot create a session directly in a terminal status",
    );
  });

  test("validates program-org relationship", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);

    await expect(createSession(t, env, { orgId: "org-different" })).rejects.toThrow(
      "Program organization mismatch",
    );
  });

  test("validates assigned-by user belongs to org", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);

    const otherUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "other-user",
        email: "other@example.com",
        name: "Other",
        orgIds: ["org-other"],
        role: "developer",
      });
    });

    await expect(createSession(t, env, { assignedBy: otherUserId })).rejects.toThrow(
      "Assigned-by user does not belong to the organization",
    );
  });
});

// ── Status Transitions (State Machine) ──────────────────────────────

describe("sandbox-lifecycle: status transitions", () => {
  test("provisioning → cloning → executing → finalizing → completed", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env);

    // provisioning → cloning
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "cloning",
    });
    let session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("cloning");

    // cloning → executing
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "executing",
    });
    session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("executing");
    expect(session.runtimeMode).toBe("executing");

    // executing → finalizing
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "finalizing",
    });
    session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("finalizing");

    // finalizing → completed
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "completed",
      commitSha: "abc123",
      filesChanged: 5,
      tokensUsed: 15000,
    });
    session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("completed");
    expect(session.completedAt).toBeDefined();
    expect(session.durationMs).toBeDefined();
    expect(session.commitSha).toBe("abc123");
    expect(session.runtimeMode).toBe("idle");
  });

  test("rejects invalid transitions", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env);

    // provisioning → executing is not allowed (must go through cloning first)
    await expect(
      t.mutation(internalAny.sandbox.sessions.updateStatus, {
        orgId: env.orgId,
        sessionId,
        status: "executing",
      }),
    ).rejects.toThrow("Invalid status transition");
  });

  test("executing → sleeping → ready cycle", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env, { status: "cloning" });

    // cloning → executing
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "executing",
    });

    // executing → sleeping
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "sleeping",
    });
    let session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("sleeping");
    expect(session.runtimeMode).toBe("hibernating");

    // sleeping → ready
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "ready",
    });
    session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("ready");
    expect(session.runtimeMode).toBe("idle");
  });
});

// ── Terminal Status Handling ─────────────────────────────────────────

describe("sandbox-lifecycle: terminal status handling", () => {
  test("markComplete sets terminal timing", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env, { status: "cloning" });

    // cloning → executing → finalizing
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "executing",
    });
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "finalizing",
    });

    await t.mutation(internalAny.sandbox.sessions.markComplete, {
      orgId: env.orgId,
      sessionId,
      prUrl: "https://github.com/test/repo/pull/1",
      prNumber: 1,
      commitSha: "def456",
      filesChanged: 10,
    });

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("completed");
    expect(session.prUrl).toBe("https://github.com/test/repo/pull/1");
    expect(session.completedAt).toBeDefined();
    expect(session.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("markFailed records error", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env);

    await t.mutation(internalAny.sandbox.sessions.markFailed, {
      orgId: env.orgId,
      sessionId,
      error: "Container provision timeout after 120s",
    });

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("failed");
    expect(session.error).toBe("Container provision timeout after 120s");
    expect(session.runtimeMode).toBe("idle");
  });

  test("cancel sets cancelled status with timing", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env, { status: "cloning" });

    // Move to executing
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "executing",
    });

    const asUser = t.withIdentity({ subject: "sandbox-user-1" });
    await asUser.mutation(apiAny.sandbox.sessions.cancel, { sessionId });

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("cancelled");
    expect(session.completedAt).toBeDefined();
  });

  test("cancel on already-completed session is no-op", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env, { status: "cloning" });

    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "executing",
    });
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "finalizing",
    });
    await t.mutation(internalAny.sandbox.sessions.markComplete, {
      orgId: env.orgId,
      sessionId,
    });

    const asUser = t.withIdentity({ subject: "sandbox-user-1" });
    const result = await asUser.mutation(apiAny.sandbox.sessions.cancel, { sessionId });
    expect(result).toBe(sessionId);

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("completed");
  });
});

// ── Setup Progress Tracking ─────────────────────────────────────────

describe("sandbox-lifecycle: setup progress", () => {
  test("tracks 10-stage setup pipeline", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env);

    const stages = [
      "containerProvision",
      "systemSetup",
      "authSetup",
      "claudeConfig",
      "gitClone",
      "depsInstall",
      "mcpInstall",
      "workspaceCustomization",
      "healthCheck",
      "ready",
    ] as const;

    // Progress through first few stages
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const stage = stages[i];
      await t.mutation(internalAny.sandbox.sessions.updateSetupProgressInternal, {
        orgId: env.orgId,
        sessionId,
        stage,
        state: {
          status: "completed",
          startedAt: now + i * 1000,
          completedAt: now + i * 1000 + 500,
        },
      });
    }

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.setupProgress.containerProvision.status).toBe("completed");
    expect(session.setupProgress.gitClone.status).toBe("completed");
    expect(session.setupProgress.depsInstall).toBeUndefined();
  });
});

// ── Sandbox Logs ────────────────────────────────────────────────────

describe("sandbox-lifecycle: logs", () => {
  test("appends logs to session", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sandboxLogs", {
        orgId: env.orgId,
        sessionId,
        taskId: env.taskId,
        timestamp: Date.now(),
        level: "info",
        message: "Container provisioned successfully",
      });
      await ctx.db.insert("sandboxLogs", {
        orgId: env.orgId,
        sessionId,
        taskId: env.taskId,
        timestamp: Date.now() + 1000,
        level: "stdout",
        message: "npm install completed",
      });
      await ctx.db.insert("sandboxLogs", {
        orgId: env.orgId,
        sessionId,
        taskId: env.taskId,
        timestamp: Date.now() + 2000,
        level: "error",
        message: "Test failed: auth.test.ts",
      });
    });

    const logs = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("sandboxLogs")
        .withIndex("by_session", (q: any) => q.eq("sessionId", sessionId))
        .collect();
    });

    expect(logs).toHaveLength(3);
    expect(logs[0].level).toBe("info");
    expect(logs[2].level).toBe("error");
  });
});

// ── Chat Messages ───────────────────────────────────────────────────

describe("sandbox-lifecycle: chat messages", () => {
  test("sends and retrieves chat messages", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);
    const sessionId = await createSession(t, env, { status: "cloning" });

    // Move to executing so chat works
    await t.mutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: env.orgId,
      sessionId,
      status: "executing",
    });

    // Insert messages directly (sendChatMessage mutation uses ctx.scheduler.runAfter
    // which is not supported in convex-test transactions)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("chatMessages", {
        orgId: env.orgId,
        sessionId,
        role: "user",
        content: "Can you add error handling?",
        status: "complete",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("chatMessages", {
        orgId: env.orgId,
        sessionId,
        role: "assistant",
        content: "I'll add try-catch blocks to the API handlers.",
        status: "complete",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: "sandbox-user-1" });

    const messages = await asUser.query(apiAny.sandbox.sessions.getChatMessages, {
      sessionId,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });
});

// ── Subtask Execution ───────────────────────────────────────────────

describe("sandbox-lifecycle: subtask execution", () => {
  test("creates session in subtask execution mode", async () => {
    const t = convexTest(schema, modules);
    const env = await seedSandboxEnv(t);

    const subtaskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("subtasks", {
        orgId: env.orgId,
        taskId: env.taskId,
        programId: env.programId,
        title: "Subtask 1: Create API routes",
        description: "Set up the REST endpoints",
        prompt: "Create /api/products routes",
        estimatedFiles: 3,
        complexityScore: 5,
        estimatedDurationMs: 120000,
        order: 1,
        isPausePoint: false,
        status: "pending",
        retryCount: 0,
      });
    });

    const sessionId = await createSession(t, env, {
      subtaskId,
      executionMode: "subtask",
    });

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.executionMode).toBe("subtask");
    expect(session.subtaskId).toBe(subtaskId);
  });
});
