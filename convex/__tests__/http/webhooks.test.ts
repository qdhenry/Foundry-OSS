import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";
import { seedOrg, seedProgram } from "../helpers/baseFactory";

// ---------------------------------------------------------------------------
// Webhook processing logic tests
// convex-test does not support HTTP actions directly, so we test the internal
// mutations that webhook handlers call after signature validation.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// sandbox.logs.appendFromHook — called by POST /api/sandbox/hook
// ---------------------------------------------------------------------------

describe("sandbox.logs.appendFromHook", () => {
  async function createSession(t: any) {
    const { userId } = await seedOrg(t);
    const { programId } = await seedProgram(t);

    const taskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId,
        title: "Sandbox task",
        priority: "high",
        status: "in_progress",
      });
    });

    const sessionId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sandboxSessions", {
        orgId: "org-1",
        programId,
        taskId,
        sandboxId: "sandbox-abc-123",
        worktreeBranch: "feature/test",
        status: "executing",
        taskPrompt: "Build the thing",
        assignedBy: userId,
        startedAt: Date.now(),
      });
    });

    return { userId, programId, taskId, sessionId };
  }

  test("appends log entry when session exists", async () => {
    const t = convexTest(schema, modules);
    const { sessionId, taskId } = await createSession(t);

    await t.mutation(internalAny.sandbox.logs.appendFromHook, {
      sessionId: "sandbox-abc-123",
      hookEventType: "PostToolUse",
      toolName: "Write",
      message: "Wrote src/index.ts",
      timestamp: Date.now(),
    });

    const logs = await t.run(async (ctx: any) => {
      return await ctx.db.query("sandboxLogs").collect();
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe("Wrote src/index.ts");
    expect(logs[0].orgId).toBe("org-1");
    expect(logs[0].taskId).toBe(taskId);
    expect(logs[0].level).toBe("system");
    expect(logs[0].metadata.source).toBe("hook");
    expect(logs[0].metadata.hookEventType).toBe("PostToolUse");
    expect(logs[0].metadata.toolName).toBe("Write");
  });

  test("silently ignores unknown session", async () => {
    const t = convexTest(schema, modules);

    // No session in DB — should not throw
    await t.mutation(internalAny.sandbox.logs.appendFromHook, {
      sessionId: "nonexistent-sandbox-id",
      hookEventType: "Stop",
      message: "Execution stopped",
      timestamp: Date.now(),
    });

    const logs = await t.run(async (ctx: any) => {
      return await ctx.db.query("sandboxLogs").collect();
    });

    expect(logs).toHaveLength(0);
  });

  test("stores metadata when provided", async () => {
    const t = convexTest(schema, modules);
    await createSession(t);

    await t.mutation(internalAny.sandbox.logs.appendFromHook, {
      sessionId: "sandbox-abc-123",
      hookEventType: "PostToolUse",
      toolName: "Bash",
      message: "Ran: npm install",
      metadata: { exitCode: 0, duration: 1500 },
      timestamp: Date.now(),
    });

    const logs = await t.run(async (ctx: any) => {
      return await ctx.db.query("sandboxLogs").collect();
    });

    expect(logs[0].metadata.payload).toBeDefined();
    expect(logs[0].metadata.payload.exitCode).toBe(0);
  });

  test("omits toolName from metadata when not provided", async () => {
    const t = convexTest(schema, modules);
    await createSession(t);

    await t.mutation(internalAny.sandbox.logs.appendFromHook, {
      sessionId: "sandbox-abc-123",
      hookEventType: "Stop",
      message: "Claude Code execution stopped",
      timestamp: Date.now(),
    });

    const logs = await t.run(async (ctx: any) => {
      return await ctx.db.query("sandboxLogs").collect();
    });

    expect(logs[0].metadata.toolName).toBeUndefined();
    expect(logs[0].metadata.hookEventType).toBe("Stop");
  });
});

// ---------------------------------------------------------------------------
// Webhook event buffer pattern — sourceControlEvents table
// Webhooks store events with status "pending" for async processing
// ---------------------------------------------------------------------------

describe("webhook event buffer pattern", () => {
  test("events stored with pending status can be queried", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sourceControlEvents", {
        orgId: "org-1",
        providerType: "github",
        eventType: "push",
        action: "created",
        entityType: "repository",
        entityId: "repo-123",
        payload: { ref: "refs/heads/main", commits: [] },
        status: "pending",
        retryCount: 0,
        receivedAt: Date.now(),
      });
    });

    const events = await t.run(async (ctx: any) => {
      return await ctx.db.query("sourceControlEvents").collect();
    });

    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("pending");
    expect(events[0].providerType).toBe("github");
    expect(events[0].eventType).toBe("push");
  });

  test("processed events transition from pending to processed", async () => {
    const t = convexTest(schema, modules);

    const eventId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlEvents", {
        orgId: "org-1",
        providerType: "github",
        eventType: "pull_request",
        action: "opened",
        entityType: "pull_request",
        entityId: "pr-456",
        payload: { number: 42, title: "Fix bug" },
        status: "pending",
        retryCount: 0,
        receivedAt: Date.now(),
      });
    });

    // Simulate processing by updating status
    await t.run(async (ctx: any) => {
      await ctx.db.patch(eventId, {
        status: "processed",
        processedAt: Date.now(),
      });
    });

    const event = await t.run(async (ctx: any) => {
      return await ctx.db.get(eventId);
    });

    expect(event.status).toBe("processed");
    expect(event.processedAt).toBeGreaterThan(0);
  });

  test("failed events retain their payload for retry", async () => {
    const t = convexTest(schema, modules);

    const eventId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sourceControlEvents", {
        orgId: "org-1",
        providerType: "github",
        eventType: "issues",
        action: "opened",
        entityType: "issue",
        entityId: "issue-789",
        payload: { number: 99, title: "New issue", body: "Description" },
        status: "pending",
        retryCount: 0,
        receivedAt: Date.now(),
      });
    });

    // Simulate failure
    await t.run(async (ctx: any) => {
      await ctx.db.patch(eventId, { status: "failed" });
    });

    const event = await t.run(async (ctx: any) => {
      return await ctx.db.get(eventId);
    });

    expect(event.status).toBe("failed");
    // Payload preserved for retry
    expect(event.payload.number).toBe(99);
    expect(event.payload.title).toBe("New issue");
  });
});
