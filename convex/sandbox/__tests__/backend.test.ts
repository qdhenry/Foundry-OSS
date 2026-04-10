import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";
import * as generatedApi from "../../_generated/api";

const api: any = (generatedApi as any).api;
const internal: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";
import { __test__ as orchestratorTest } from "../orchestrator";
import { __test__ as secureSettingsTest } from "../secureSettings";

const sandboxInternal = (internal as any).sandbox;
const sandboxApi = (api as any).sandbox;
const notificationsApi = (api as any).notifications;
const notificationsInternal = (internal as any).notifications;

type SetupData = {
  userId: string;
  otherUserId: string;
  programId: string;
  taskId: string;
  repositoryId: string;
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
      name: "Sandbox Program",
      clientName: "Sandbox Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  const taskId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("tasks", {
      orgId: "org-1",
      programId,
      title: "Implement sandbox orchestration",
      description: "Build backend orchestration flow",
      priority: "high",
      status: "todo",
    });
  });

  const repositoryId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("sourceControlRepositories", {
      orgId: "org-1",
      programId,
      installationId: "inst-123",
      providerType: "github",
      repoFullName: "example/repo",
      providerRepoId: "42",
      defaultBranch: "main",
      role: "integration",
      isMonorepo: false,
    });
  });

  return {
    userId,
    otherUserId,
    programId,
    taskId,
    repositoryId,
    orgId: "org-1",
  };
}

async function createSession(
  t: any,
  data: SetupData,
  status: string = "provisioning",
  overrides: Record<string, unknown> = {},
) {
  return await t.mutation(sandboxInternal.sessions.create, {
    orgId: data.orgId,
    programId: data.programId,
    taskId: data.taskId,
    repositoryId: data.repositoryId,
    sandboxId: `sandbox-${Date.now()}`,
    worktreeBranch: "agent/task-branch",
    status,
    taskPrompt: "Implement all required backend changes",
    assignedBy: data.userId,
    ...overrides,
  });
}

async function createSubtasksForTask(
  t: any,
  data: SetupData,
  count: number = 2,
): Promise<string[]> {
  return await t.run(async (ctx: any) => {
    await ctx.db.patch(data.taskId, {
      hasSubtasks: true,
      subtaskCount: count,
      subtasksCompleted: 0,
      subtasksFailed: 0,
    });

    const subtaskIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const subtaskId = await ctx.db.insert("subtasks", {
        orgId: data.orgId,
        taskId: data.taskId,
        programId: data.programId,
        title: `Subtask ${i + 1}`,
        description: `Description ${i + 1}`,
        prompt: `Implement subtask ${i + 1}`,
        estimatedFiles: 1,
        complexityScore: 3,
        estimatedDurationMs: 60_000,
        order: i,
        isPausePoint: false,
        status: "pending",
        retryCount: 0,
      });
      subtaskIds.push(subtaskId);
    }
    return subtaskIds;
  });
}

async function drainScheduledFunctions(t: any) {
  await t.finishAllScheduledFunctions(() => {
    vi.runAllTimers();
  });
  await t.finishInProgressScheduledFunctions();
}

describe("sandbox sessions", () => {
  test("creates session and resolves it through auth-protected queries", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sessionId = await createSession(t, data, "provisioning");

    const byTask = await asUser.query(sandboxApi.sessions.getByTask, {
      taskId: data.taskId,
    });
    expect(byTask._id).toBe(sessionId);
    expect(byTask.status).toBe("provisioning");

    const list = await asUser.query(sandboxApi.sessions.listByProgram, {
      programId: data.programId,
    });
    expect(list).toHaveLength(1);
    expect(list[0]._id).toBe(sessionId);
  });

  test("rejects cross-org access on session query", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const sessionId = await createSession(t, data, "provisioning");
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(asOtherUser.query(sandboxApi.sessions.get, { sessionId })).rejects.toThrow(
      "Access denied",
    );
  });

  test("enforces status lifecycle transitions", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const sessionId = await createSession(t, data, "provisioning");

    await t.mutation(sandboxInternal.sessions.updateStatus, {
      orgId: data.orgId,
      sessionId,
      status: "cloning",
    });

    await expect(
      t.mutation(sandboxInternal.sessions.updateStatus, {
        orgId: data.orgId,
        sessionId,
        status: "completed",
      }),
    ).rejects.toThrow("Invalid status transition");
  });

  test("allows authorized users to cancel active sessions", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const sessionId = await createSession(t, data, "executing");
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(sandboxApi.sessions.cancel, { sessionId });

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("cancelled");
    expect(session.completedAt).toBeTypeOf("number");
  });

  test("marks completion with duration and PR metadata", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const sessionId = await createSession(t, data, "executing");

    await t.mutation(sandboxInternal.sessions.updateStatus, {
      orgId: data.orgId,
      sessionId,
      status: "finalizing",
    });
    await t.mutation(sandboxInternal.sessions.markComplete, {
      orgId: data.orgId,
      sessionId,
      prUrl: "https://github.com/example/repo/pull/99",
      prNumber: 99,
      filesChanged: 4,
      commitSha: "abc123",
      tokensUsed: 1000,
    });

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("completed");
    expect(session.completedAt).toBeTypeOf("number");
    expect(session.durationMs).toBeTypeOf("number");
    expect(session.prNumber).toBe(99);
    expect(session.filesChanged).toBe(4);
  });

  test("supports optional session config fields and manager list query", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const presetId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sandboxPresets", {
        orgId: data.orgId,
        userId: data.userId,
        name: "Backend preset",
        editorType: "monaco",
        ttlMinutes: 25,
        envVarOverrides: [],
        mcpServerOverrides: [],
        isDefault: true,
        createdAt: Date.now(),
      });
    });

    const sessionId = await createSession(t, data, "provisioning", {
      editorType: "monaco",
      ttlMinutes: 25,
      authProvider: "anthropic",
      runtimeMode: "idle",
      claudeSessionId: "claude-session-123",
      presetId,
    });

    const byOrg = await asUser.query(sandboxApi.sessions.listByOrg, {
      orgId: data.orgId,
    });
    expect(byOrg).toHaveLength(1);
    expect(byOrg[0]._id).toBe(sessionId);
    expect(byOrg[0].editorType).toBe("monaco");
    expect(byOrg[0].authProvider).toBe("anthropic");
    expect(byOrg[0].presetId).toBe(presetId);
  });

  test("supports runtime metadata and runtime filters", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const cloudSessionId = await createSession(t, data, "executing");
    const localSessionId = await createSession(t, data, "executing", {
      runtime: "local",
      localDeviceId: "device-123",
      localDeviceName: "Quintin MacBook",
    });

    const localByOrg = await asUser.query(sandboxApi.sessions.listByOrg, {
      orgId: data.orgId,
      runtime: "local",
    });
    expect(localByOrg).toHaveLength(1);
    expect(localByOrg[0]._id).toBe(localSessionId);
    expect(localByOrg[0].localDeviceId).toBe("device-123");
    expect(localByOrg[0].localDeviceName).toBe("Quintin MacBook");

    const cloudByProgram = await asUser.query(sandboxApi.sessions.listByProgram, {
      programId: data.programId,
      runtime: "cloud",
    });
    expect(cloudByProgram.some((session: any) => session._id === cloudSessionId)).toBe(true);
    expect(cloudByProgram.some((session: any) => session._id === localSessionId)).toBe(false);
  });

  test("requires localDeviceId when creating local runtime sessions", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await expect(
      createSession(t, data, "executing", {
        runtime: "local",
      }),
    ).rejects.toThrow("localDeviceId is required");
  });

  test("updates setup progress and supports pin/unpin + runtime mode", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });
    const sessionId = await createSession(t, data, "executing");

    await asUser.mutation(sandboxApi.sessions.updateSetupProgress, {
      sessionId,
      stage: "systemSetup",
      state: {
        status: "running",
        startedAt: 100,
      },
    });

    await asUser.mutation(sandboxApi.sessions.setRuntimeMode, {
      sessionId,
      runtimeMode: "interactive",
    });

    await asUser.mutation(sandboxApi.sessions.pin, { sessionId });
    await asUser.mutation(sandboxApi.sessions.unpin, { sessionId });

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.setupProgress?.systemSetup?.status).toBe("running");
    expect(session.runtimeMode).toBe("interactive");
    expect(session.isPinned).toBe(false);
    expect(session.pinnedBy).toBe(data.userId);
    expect(session.pinnedAt).toBeTypeOf("number");
  });

  test("syncs lifecycle metadata via internal mutation", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const sessionId = await createSession(t, data, "executing");

    await t.mutation(sandboxInternal.sessions.syncLifecycleInternal, {
      orgId: data.orgId,
      sessionId,
      runtimeMode: "interactive",
      setupProgress: {
        containerProvision: {
          status: "running",
          startedAt: 123,
        },
        ready: {
          status: "pending",
        },
      },
    });

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.runtimeMode).toBe("interactive");
    expect(session.setupProgress?.containerProvision?.status).toBe("running");
    expect(session.setupProgress?.containerProvision?.startedAt).toBe(123);
    expect(session.setupProgress?.ready?.status).toBe("pending");
  });
});

describe("sandbox logs", () => {
  test("appends logs and returns paginated stream", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const sessionId = await createSession(t, data, "executing");
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.mutation(sandboxInternal.logs.append, {
      orgId: data.orgId,
      sessionId,
      level: "stdout",
      message: "hello",
      timestamp: 10,
    });
    await t.mutation(sandboxInternal.logs.appendBatch, {
      orgId: data.orgId,
      sessionId,
      entries: [
        { level: "stderr", message: "warn", timestamp: 20 },
        { level: "system", message: "done", timestamp: 30 },
      ],
    });

    const page = await asUser.query(sandboxApi.logs.listBySession, {
      sessionId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toHaveLength(3);
    expect(page.page[0].message).toBe("hello");
    expect(page.page[2].message).toBe("done");
  });

  test("rejects org mismatch on appendBatch", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const sessionId = await createSession(t, data, "executing");

    await expect(
      t.mutation(sandboxInternal.logs.appendBatch, {
        orgId: "org-999",
        sessionId,
        entries: [{ level: "info", message: "x" }],
      }),
    ).rejects.toThrow("Sandbox session does not belong");
  });

  test("appends logs from desktop for local runtime sessions", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });
    const sessionId = await createSession(t, data, "executing", {
      runtime: "local",
      localDeviceId: "desktop-1",
      localDeviceName: "Primary Desktop",
    });

    await asUser.mutation(sandboxApi.logs.appendBatchFromDesktop, {
      sessionId,
      localDeviceId: "desktop-1",
      entries: [
        { level: "stdout", message: "desktop line 1", timestamp: 1000 },
        { level: "stderr", message: "desktop line 2", timestamp: 1001 },
      ],
    });

    const logs = await asUser.query(sandboxApi.logs.listBySession, { sessionId });
    expect(logs).toHaveLength(2);
    expect(logs[0].message).toBe("desktop line 1");
    expect(logs[1].message).toBe("desktop line 2");
  });

  test("rejects desktop log ingestion for cloud runtime sessions", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });
    const sessionId = await createSession(t, data, "executing");

    await expect(
      asUser.mutation(sandboxApi.logs.appendBatchFromDesktop, {
        sessionId,
        entries: [{ level: "info", message: "x" }],
      }),
    ).rejects.toThrow("only supported for local runtime sessions");
  });
});

describe("notifications", () => {
  test("lists unread, marks one read, then marks all read", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const n1 = await t.mutation(notificationsInternal.create, {
      orgId: data.orgId,
      userId: data.userId,
      programId: data.programId,
      type: "sandbox_complete",
      title: "A",
      body: "done",
    });
    await t.mutation(notificationsInternal.create, {
      orgId: data.orgId,
      userId: data.userId,
      programId: data.programId,
      type: "sandbox_failed",
      title: "B",
      body: "failed",
    });

    const unread = await asUser.query(notificationsApi.listUnread, {});
    expect(unread).toHaveLength(2);

    await asUser.mutation(notificationsApi.markRead, { notificationId: n1 });
    const unreadAfterSingle = await asUser.query(notificationsApi.listUnread, {});
    expect(unreadAfterSingle).toHaveLength(1);

    await asUser.mutation(notificationsApi.markAllRead, {});
    const unreadAfterAll = await asUser.query(notificationsApi.listUnread, {});
    expect(unreadAfterAll).toHaveLength(0);
  });

  test("prevents reading another user's notification", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const n1 = await t.mutation(notificationsInternal.create, {
      orgId: data.orgId,
      userId: data.userId,
      programId: data.programId,
      type: "sandbox_complete",
      title: "A",
      body: "done",
    });

    await expect(
      asOtherUser.mutation(notificationsApi.markRead, { notificationId: n1 }),
    ).rejects.toThrow("Access denied");
  });
});

describe("tasks.get sandbox enrichment", () => {
  test("returns activeSandboxSessionId for non-terminal session", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const completedSessionId = await createSession(t, data, "finalizing");
    await t.mutation(sandboxInternal.sessions.markComplete, {
      orgId: data.orgId,
      sessionId: completedSessionId,
      prUrl: "https://github.com/example/repo/pull/1",
    });

    const activeSessionId = await createSession(t, data, "executing");

    const task = await asUser.query(api.tasks.get, { taskId: data.taskId });
    expect(task.activeSandboxSessionId).toBe(activeSessionId);
  });
});

describe("orchestrator helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("parses JSON worker log payload with done + cursor", () => {
    const parsed = orchestratorTest.parseWorkerLogsPayload({
      done: true,
      nextCursor: "cursor-2",
      events: [{ level: "stdout", message: "hello", timestamp: 1 }],
    });

    expect(parsed.done).toBe(true);
    expect(parsed.nextCursor).toBe("cursor-2");
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].message).toBe("hello");
  });

  test("parses lifecycle metadata from JSON worker payload", () => {
    const parsed = orchestratorTest.parseWorkerLogsPayload({
      status: "executing",
      runtimeMode: "executing",
      setupProgress: {
        containerProvision: { status: "completed", startedAt: 1, completedAt: 2 },
        ready: { status: "pending" },
      },
      entries: [],
    });

    expect(parsed.runtimeMode).toBe("executing");
    expect(parsed.setupProgress?.containerProvision?.status).toBe("completed");
    expect(parsed.setupProgress?.ready?.status).toBe("pending");
  });

  test("parses SSE payload and detects failure", () => {
    const sse = [
      'data: {"event":{"level":"stdout","message":"line 1"}}',
      "",
      'data: {"error":"boom","failed":true}',
      "",
    ].join("\n");

    const parsed = orchestratorTest.parseWorkerLogsPayload(sse);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.failed).toBe(true);
    expect(parsed.error).toBe("boom");
  });

  test("parses lifecycle metadata from SSE status events", () => {
    const sse = [
      'data: {"event":{"type":"status","status":"executing","runtimeMode":"interactive","setupProgress":{"systemSetup":{"status":"running","startedAt":42}}}}',
      "",
    ].join("\n");

    const parsed = orchestratorTest.parseWorkerLogsPayload(sse);
    expect(parsed.runtimeMode).toBe("interactive");
    const systemSetup = parsed.setupProgress?.systemSetup;
    expect(systemSetup?.status).toBe("running");
    if (!systemSetup || systemSetup.status !== "running") {
      throw new Error("Expected running systemSetup stage");
    }
    expect(systemSetup.startedAt).toBe(42);
  });

  test("throws when sandbox worker env vars are missing", () => {
    expect(() => orchestratorTest.getWorkerConfig({} as any)).toThrow(
      "Sandbox worker is not configured",
    );
  });

  test("calls sandbox worker with auth header and parses JSON response", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
        return new Response(JSON.stringify({ sandboxId: "sbx-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    const result = await orchestratorTest.callSandboxWorker(
      { method: "POST", path: "/sandbox/create", body: { x: 1 } },
      {
        env: {
          SANDBOX_WORKER_URL: "https://sandbox.example.com",
          SANDBOX_API_SECRET: "secret-123",
        } as any,
        fetchImpl: fetchMock as any,
      },
    );

    const firstCall = fetchMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected sandbox worker call");
    }
    const callOptions = firstCall[1];
    expect(callOptions).toBeDefined();
    if (!callOptions) {
      throw new Error("Expected sandbox worker request options");
    }
    expect((callOptions.headers as Record<string, string>).Authorization).toBe("Bearer secret-123");
    expect((result as any).sandboxId).toBe("sbx-1");
  });

  test("unwraps worker API envelopes", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true, data: { sandboxId: "sbx-wrapped" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await orchestratorTest.callSandboxWorker(
      { method: "POST", path: "/sandbox/create", body: { x: 1 } },
      {
        env: {
          SANDBOX_WORKER_URL: "https://sandbox.example.com",
          SANDBOX_API_SECRET: "secret-123",
        } as any,
        fetchImpl: fetchMock as any,
      },
    );

    expect((result as any).sandboxId).toBe("sbx-wrapped");
  });

  test("throws meaningful error for non-200 worker responses", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "worker exploded" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(
      orchestratorTest.callSandboxWorker(
        { method: "POST", path: "/sandbox/create" },
        {
          env: {
            SANDBOX_WORKER_URL: "https://sandbox.example.com",
            SANDBOX_API_SECRET: "secret-123",
          } as any,
          fetchImpl: fetchMock as any,
        },
      ),
    ).rejects.toThrow("worker exploded");
  });

  test("includes nested worker error details.reason in thrown error message", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to provision sandbox environment.",
            details: { reason: "SandboxError: HTTP error! status: 500" },
          },
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    });

    await expect(
      orchestratorTest.callSandboxWorker(
        { method: "POST", path: "/sandbox/create" },
        {
          env: {
            SANDBOX_WORKER_URL: "https://sandbox.example.com",
            SANDBOX_API_SECRET: "secret-123",
          } as any,
          fetchImpl: fetchMock as any,
        },
      ),
    ).rejects.toThrow(
      "Failed to provision sandbox environment.: SandboxError: HTTP error! status: 500",
    );
  });

  test("classifies worker create timeout as queue fallback", () => {
    expect(
      orchestratorTest.shouldQueueWorkerCreateFailure(
        new Error("Sandbox worker request timed out (POST /sandbox/create, 30000ms)"),
      ),
    ).toBe(true);
  });

  test("classifies worker unavailable/not configured errors as queue fallback", () => {
    expect(
      orchestratorTest.shouldQueueWorkerCreateFailure(
        new Error(
          "Sandbox worker is not configured. Set SANDBOX_WORKER_URL and SANDBOX_API_SECRET.",
        ),
      ),
    ).toBe(true);

    expect(
      orchestratorTest.shouldQueueWorkerCreateFailure(
        new Error("Sandbox worker request failed (POST /sandbox/create): Service Unavailable"),
      ),
    ).toBe(true);

    expect(
      orchestratorTest.shouldQueueWorkerCreateFailure(
        new Error("Sandbox worker request failed (POST /sandbox/create): worker not found"),
      ),
    ).toBe(true);
  });

  test("does not classify non-outage worker errors as queue fallback", () => {
    expect(
      orchestratorTest.shouldQueueWorkerCreateFailure(
        new Error("Sandbox worker request failed (POST /sandbox/create): Invalid GitHub token"),
      ),
    ).toBe(false);

    expect(
      orchestratorTest.shouldQueueWorkerCreateFailure(
        new Error("Repository does not belong to the task's organization/program"),
      ),
    ).toBe(false);
  });

  test("parses queue replay token from env with expected fallback order", () => {
    expect(
      orchestratorTest.getQueueReplayToken({
        SANDBOX_QUEUE_REPLAY_SECRET: "queue-secret",
        SANDBOX_API_SECRET: "api-secret",
      } as any),
    ).toBe("queue-secret");

    expect(
      orchestratorTest.getQueueReplayToken({
        SANDBOX_API_SECRET: "api-secret",
      } as any),
    ).toBe("api-secret");

    expect(orchestratorTest.getQueueReplayToken({} as any)).toBe("");
  });

  test("normalizes queue launch mode with safe default", () => {
    expect(orchestratorTest.parseQueueLaunchMode("standard")).toBe("standard");
    expect(orchestratorTest.parseQueueLaunchMode("subtasks")).toBe("subtasks");
    expect(orchestratorTest.parseQueueLaunchMode("single_subtask")).toBe("single_subtask");
    expect(orchestratorTest.parseQueueLaunchMode("unexpected")).toBe("standard");
  });

  test("clamps queue drain limits to safe bounds", () => {
    expect(orchestratorTest.toPositiveQueueLimit(undefined)).toBe(5);
    expect(orchestratorTest.toPositiveQueueLimit(0)).toBe(1);
    expect(orchestratorTest.toPositiveQueueLimit(2.8)).toBe(2);
    expect(orchestratorTest.toPositiveQueueLimit(100)).toBe(25);
  });
});

describe("secure sandbox settings encryption", () => {
  test("encrypts/decrypts with org-derived keys", () => {
    const previousKey = process.env.SANDBOX_SECRET_ENCRYPTION_KEY;
    process.env.SANDBOX_SECRET_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    try {
      const encrypted = secureSettingsTest.encryptForOrg("org-1", "top-secret-value");
      expect(encrypted).not.toContain("top-secret-value");

      const decrypted = secureSettingsTest.decryptForOrg("org-1", encrypted);
      expect(decrypted).toBe("top-secret-value");

      expect(() => secureSettingsTest.decryptForOrg("org-2", encrypted)).toThrow();
    } finally {
      if (previousKey === undefined) {
        delete process.env.SANDBOX_SECRET_ENCRYPTION_KEY;
      } else {
        process.env.SANDBOX_SECRET_ENCRYPTION_KEY = previousKey;
      }
    }
  });
});

describe("cascade delete", () => {
  test("_cascadeDeleteSession removes session and all related data", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const sessionId = await createSession(t, data, "finalizing");

    // Transition to completed so it's terminal
    await t.mutation(sandboxInternal.sessions.markComplete, {
      orgId: data.orgId,
      sessionId,
    });

    // Seed logs and messages
    await t.run(async (ctx: any) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("sandboxLogs", {
          orgId: data.orgId,
          sessionId,
          timestamp: Date.now() + i,
          level: "info",
          message: `Log entry ${i}`,
        });
      }
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("chatMessages", {
          orgId: data.orgId,
          sessionId,
          role: "user",
          content: `Message ${i}`,
          status: "complete",
          createdAt: Date.now() + i,
        });
      }
    });

    await t.mutation(sandboxInternal.sessions._cascadeDeleteSession, { sessionId });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session).toBeNull();

    const remainingLogs = await t.run(async (ctx: any) =>
      ctx.db
        .query("sandboxLogs")
        .withIndex("by_session", (q: any) => q.eq("sessionId", sessionId))
        .collect(),
    );
    expect(remainingLogs).toHaveLength(0);

    const remainingMessages = await t.run(async (ctx: any) =>
      ctx.db
        .query("chatMessages")
        .withIndex("by_session", (q: any) => q.eq("sessionId", sessionId))
        .collect(),
    );
    expect(remainingMessages).toHaveLength(0);
  });

  test("_cascadeDeleteSession handles already-deleted session (idempotent)", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const sessionId = await createSession(t, data, "finalizing");
    await t.mutation(sandboxInternal.sessions.markComplete, {
      orgId: data.orgId,
      sessionId,
    });

    // Delete session directly
    await t.run(async (ctx: any) => ctx.db.delete(sessionId));

    // Should not throw
    await t.mutation(sandboxInternal.sessions._cascadeDeleteSession, { sessionId });
  });

  test("bulkDeleteSessions schedules deletion and returns counts", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const data = await setupBaseData(t);
      const asUser = t.withIdentity({ subject: "test-user-1" });

      // Create 3 completed sessions
      const completedIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const sid = await createSession(t, data, "finalizing", {
          sandboxId: `sandbox-bulk-${i}`,
        });
        await t.mutation(sandboxInternal.sessions.markComplete, {
          orgId: data.orgId,
          sessionId: sid,
        });
        completedIds.push(sid);
      }

      // Create 1 executing session
      const executingId = await createSession(t, data, "executing", {
        sandboxId: "sandbox-bulk-exec",
      });

      const result = await asUser.mutation(sandboxApi.sessions.bulkDeleteSessions, {
        sessionIds: [...completedIds, executingId],
      });
      expect(result.deleted).toBe(3);
      expect(result.skipped).toBe(1);

      // Completed sessions should be in "deleting" status
      for (const id of completedIds) {
        const session = await t.run(async (ctx: any) => ctx.db.get(id));
        expect(session.status).toBe("deleting");
      }

      // Executing session should be unchanged
      const execSession = await t.run(async (ctx: any) => ctx.db.get(executingId));
      expect(execSession.status).toBe("executing");
      await drainScheduledFunctions(t);

      for (const id of completedIds) {
        const session = await t.run(async (ctx: any) => ctx.db.get(id));
        expect(session).toBeNull();
      }

      const execSessionAfterDrain = await t.run(async (ctx: any) => ctx.db.get(executingId));
      expect(execSessionAfterDrain.status).toBe("executing");
    } finally {
      vi.useRealTimers();
    }
  });

  test("bulkDeleteSessions skips sessions from other orgs", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    // Create a completed session in org-1
    const sessionId = await createSession(t, data, "finalizing");
    await t.mutation(sandboxInternal.sessions.markComplete, {
      orgId: data.orgId,
      sessionId,
    });

    // Try to delete as user in org-2
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });
    const result = await asOtherUser.mutation(sandboxApi.sessions.bulkDeleteSessions, {
      sessionIds: [sessionId],
    });
    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test("deleteSession marks session as deleting", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const data = await setupBaseData(t);
      const asUser = t.withIdentity({ subject: "test-user-1" });

      const sessionId = await createSession(t, data, "finalizing");
      await t.mutation(sandboxInternal.sessions.markComplete, {
        orgId: data.orgId,
        sessionId,
      });

      // Seed some logs
      await t.run(async (ctx: any) => {
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert("sandboxLogs", {
            orgId: data.orgId,
            sessionId,
            timestamp: Date.now() + i,
            level: "info",
            message: `Log ${i}`,
          });
        }
      });

      const result = await asUser.mutation(sandboxApi.sessions.deleteSession, { sessionId });
      expect(result).toBe(sessionId);

      const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
      expect(session.status).toBe("deleting");
      await drainScheduledFunctions(t);

      const deletedSession = await t.run(async (ctx: any) => ctx.db.get(sessionId));
      expect(deletedSession).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("deleteSession rejects non-terminal sessions", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const sessionId = await createSession(t, data, "executing");

    await expect(asUser.mutation(sandboxApi.sessions.deleteSession, { sessionId })).rejects.toThrow(
      "Cannot delete session",
    );
  });
});

describe("stop action", () => {
  test("cancels session and schedules cleanup", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const data = await setupBaseData(t);
      const sessionId = await createSession(t, data, "executing");
      const asUser = t.withIdentity({ subject: "test-user-1" });

      const result = await asUser.action(sandboxApi.orchestrator.stop, {
        sessionId,
      });
      expect(result.sessionId).toBe(sessionId);

      const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
      expect(session.status).toBe("cancelled");
      await drainScheduledFunctions(t);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("local orchestrator actions", () => {
  test("startLocal creates a local runtime session", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const result = await asUser.action(sandboxApi.orchestrator.startLocal, {
      taskId: data.taskId,
      repositoryId: data.repositoryId,
      localDeviceId: "laptop-01",
      localDeviceName: "Laptop",
    });

    expect(result.runtime).toBe("local");
    expect(result.status).toBe("executing");

    const session = await t.run(async (ctx: any) => await ctx.db.get(result.sessionId));
    expect(session.runtime).toBe("local");
    expect(session.localDeviceId).toBe("laptop-01");
    expect(session.localDeviceName).toBe("Laptop");
    expect(session.status).toBe("executing");
    expect(session.runtimeMode).toBe("executing");
  });

  test("reportLocalCompletion completes local sessions through shared completion flow", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });
    const sessionId = await createSession(t, data, "executing", {
      runtime: "local",
      localDeviceId: "desktop-22",
      localDeviceName: "Desktop",
    });

    const result = await asUser.action(sandboxApi.orchestrator.reportLocalCompletion, {
      sessionId,
      localDeviceId: "desktop-22",
      commitSha: "deadbeef",
      filesChanged: 3,
    });

    expect(result.status).toBe("completed");

    const session = await t.run(async (ctx: any) => await ctx.db.get(sessionId));
    expect(session.status).toBe("completed");
    expect(session.commitSha).toBe("deadbeef");
    expect(session.filesChanged).toBe(3);
  });

  test("startSubtaskExecution supports local runtime without cloud worker execution", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });
    await createSubtasksForTask(t, data, 2);

    const result = await asUser.action(sandboxApi.orchestrator.startSubtaskExecution, {
      taskId: data.taskId,
      repositoryId: data.repositoryId,
      runtime: "local",
      localDeviceId: "desktop-subtask-1",
      localDeviceName: "Subtask Desktop",
    });

    expect(result.runtime).toBe("local");
    expect(result.status).toBe("executing");

    const session = await t.run(async (ctx: any) => await ctx.db.get(result.sessionId));
    expect(session.runtime).toBe("local");
    expect(session.localDeviceId).toBe("desktop-subtask-1");
    expect(session.localDeviceName).toBe("Subtask Desktop");
    expect(session.status).toBe("executing");
    expect(session.runtimeMode).toBe("executing");
    expect(session.executionMode).toBe("subtask");

    const subtasks = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("subtasks")
        .withIndex("by_task", (q: any) => q.eq("taskId", data.taskId))
        .collect();
    });
    expect(subtasks.every((subtask: any) => subtask.status === "pending")).toBe(true);
  });

  test("startSubtaskExecution enforces localDeviceId when runtime is local", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });
    await createSubtasksForTask(t, data, 1);

    await expect(
      asUser.action(sandboxApi.orchestrator.startSubtaskExecution, {
        taskId: data.taskId,
        repositoryId: data.repositoryId,
        runtime: "local",
      }),
    ).rejects.toThrow("localDeviceId is required when runtime is local");
  });

  test("executeSingleSubtask supports local runtime without cloud worker execution", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });
    const [subtaskId] = await createSubtasksForTask(t, data, 1);

    const result = await asUser.action(sandboxApi.orchestrator.executeSingleSubtask, {
      taskId: data.taskId,
      subtaskId,
      repositoryId: data.repositoryId,
      runtime: "local",
      localDeviceId: "desktop-single-1",
      localDeviceName: "Single Desktop",
    });

    expect(result.runtime).toBe("local");
    expect(result.status).toBe("executing");

    const session = await t.run(async (ctx: any) => await ctx.db.get(result.sessionId));
    expect(session.runtime).toBe("local");
    expect(session.localDeviceId).toBe("desktop-single-1");
    expect(session.localDeviceName).toBe("Single Desktop");
    expect(session.status).toBe("executing");
    expect(session.runtimeMode).toBe("executing");
    expect(session.executionMode).toBe("subtask");
    expect(session.subtaskId).toBe(subtaskId);

    const subtask = await t.run(async (ctx: any) => await ctx.db.get(subtaskId));
    expect(subtask.status).toBe("pending");
  });

  test("executeSingleSubtask enforces localDeviceId when runtime is local", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });
    const [subtaskId] = await createSubtasksForTask(t, data, 1);

    await expect(
      asUser.action(sandboxApi.orchestrator.executeSingleSubtask, {
        taskId: data.taskId,
        subtaskId,
        repositoryId: data.repositoryId,
        runtime: "local",
      }),
    ).rejects.toThrow("localDeviceId is required when runtime is local");
  });
});
