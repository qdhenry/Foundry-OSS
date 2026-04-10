import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

// ── Helpers ──────────────────────────────────────────────────────────

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
      phase: "build",
      status: "active",
    });
  });

  const taskId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("tasks", {
      orgId: "org-1",
      programId,
      title: "Test Task",
      priority: "medium",
      status: "review",
    });
  });

  return { userId, otherUserId, programId, taskId };
}

async function createVerification(
  t: any,
  data: Awaited<ReturnType<typeof setupBaseData>>,
  overrides: Record<string, unknown> = {},
) {
  return await t.mutation(internalAny.taskVerifications.create, {
    orgId: "org-1",
    programId: data.programId,
    taskId: data.taskId,
    triggeredBy: data.userId,
    trigger: "manual" as const,
    status: "pending" as const,
    ...overrides,
  });
}

async function createSandboxSession(
  t: any,
  data: Awaited<ReturnType<typeof setupBaseData>>,
  overrides: Record<string, unknown> = {},
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("sandboxSessions", {
      orgId: "org-1",
      programId: data.programId,
      taskId: data.taskId,
      sandboxId: "sandbox-verification-1",
      worktreeBranch: "feature/test-verification",
      status: "completed",
      taskPrompt: "Verify the latest implementation",
      assignedBy: data.userId,
      startedAt: Date.now(),
      ...overrides,
    });
  });
}

async function drainScheduledFunctions(t: any) {
  await t.finishAllScheduledFunctions(() => {
    vi.runAllTimers();
  });
  await t.finishInProgressScheduledFunctions();
}

// ── Internal mutations: create ──────────────────────────────────────

describe("taskVerifications.create (internal)", () => {
  test("inserts a verification record with correct fields", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    const verificationId = await createVerification(t, data, {
      trigger: "automatic",
      commitSha: "abc123",
      branch: "feat/test",
    });

    const record = await t.run(async (ctx: any) => await ctx.db.get(verificationId));
    expect(record).not.toBeNull();
    expect(record.orgId).toBe("org-1");
    expect(record.programId).toBe(data.programId);
    expect(record.taskId).toBe(data.taskId);
    expect(record.triggeredBy).toBe(data.userId);
    expect(record.trigger).toBe("automatic");
    expect(record.status).toBe("pending");
    expect(record.commitSha).toBe("abc123");
    expect(record.branch).toBe("feat/test");
  });
});

// ── Internal mutations: updateStatus ────────────────────────────────

describe("taskVerifications.updateStatus (internal)", () => {
  test("patches only the provided fields", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);

    await t.mutation(internalAny.taskVerifications.updateStatus, {
      verificationId,
      status: "completed",
      checksTotal: 5,
      checksPassed: 4,
      checksFailed: 1,
      aiSummary: "Looks good overall",
      completedAt: 1700000000000,
      durationMs: 12345,
    });

    const updated = await t.run(async (ctx: any) => await ctx.db.get(verificationId));
    expect(updated.status).toBe("completed");
    expect(updated.checksTotal).toBe(5);
    expect(updated.checksPassed).toBe(4);
    expect(updated.checksFailed).toBe(1);
    expect(updated.aiSummary).toBe("Looks good overall");
    expect(updated.completedAt).toBe(1700000000000);
    expect(updated.durationMs).toBe(12345);
    // Fields not provided should remain absent
    expect(updated.screenshotCount).toBeUndefined();
    expect(updated.error).toBeUndefined();
  });

  test("sets error message on failure", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);

    await t.mutation(internalAny.taskVerifications.updateStatus, {
      verificationId,
      status: "failed",
      error: "Worker unreachable",
    });

    const updated = await t.run(async (ctx: any) => await ctx.db.get(verificationId));
    expect(updated.status).toBe("failed");
    expect(updated.error).toBe("Worker unreachable");
  });
});

// ── Internal mutations: saveCheck ───────────────────────────────────

describe("taskVerifications.saveCheck (internal)", () => {
  test("inserts a check record with correct fields", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);

    const checkId = await t.mutation(internalAny.taskVerifications.saveCheck, {
      orgId: "org-1",
      verificationId,
      type: "functional",
      description: "Button click triggers form submit",
      status: "passed",
      route: "/checkout",
      order: 0,
    });

    const check = await t.run(async (ctx: any) => await ctx.db.get(checkId));
    expect(check).not.toBeNull();
    expect(check.orgId).toBe("org-1");
    expect(check.verificationId).toBe(verificationId);
    expect(check.type).toBe("functional");
    expect(check.description).toBe("Button click triggers form submit");
    expect(check.status).toBe("passed");
    expect(check.route).toBe("/checkout");
    expect(check.order).toBe(0);
  });
});

// ── Internal mutations: saveScreenshot ──────────────────────────────

describe("taskVerifications.saveScreenshot (internal)", () => {
  // convex-test does not support ctx.storage.store() (Blob crypto.subtle.digest
  // unavailable in test environment) and fabricated _storage IDs are rejected by
  // schema validation. The saveScreenshot mutation is exercised indirectly via
  // the processResults integration test when screenshotStorageIds are provided.
  test.skip("inserts a screenshot record (requires file storage support)", () => {
    // Placeholder — covered by integration tests against real Convex backend.
  });
});

// ── Public queries: listByTask ──────────────────────────────────────

describe("taskVerifications.listByTask", () => {
  test("returns verifications for a task sorted newest-first", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Create three verifications with slightly different creation times
    // (Convex auto-increments _creationTime so insertion order = chronological)
    await createVerification(t, data, { status: "completed" });
    await createVerification(t, data, { status: "failed" });
    await createVerification(t, data, { status: "pending" });

    const results = await asUser.query(apiAny.taskVerifications.listByTask, {
      taskId: data.taskId,
    });
    expect(results).toHaveLength(3);
    // Newest first: pending was created last
    expect(results[0].status).toBe("pending");
    expect(results[2].status).toBe("completed");
  });

  test("returns empty array for task with no verifications", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const results = await asUser.query(apiAny.taskVerifications.listByTask, {
      taskId: data.taskId,
    });
    expect(results).toHaveLength(0);
  });

  test("requires authentication", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await expect(
      t.query(apiAny.taskVerifications.listByTask, {
        taskId: data.taskId,
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("rejects users outside the task org", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    await createVerification(t, data, { status: "completed" });
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.taskVerifications.listByTask, {
        taskId: data.taskId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── Public queries: getLatestByTask ─────────────────────────────────

describe("taskVerifications.getLatestByTask", () => {
  test("returns most recent verification", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await createVerification(t, data, { status: "completed" });
    await createVerification(t, data, { status: "failed" });
    const latestId = await createVerification(t, data, { status: "running" });

    const latest = await asUser.query(apiAny.taskVerifications.getLatestByTask, {
      taskId: data.taskId,
    });
    expect(latest).not.toBeNull();
    expect(latest._id).toBe(latestId);
    expect(latest.status).toBe("running");
  });

  test("returns null when no verifications exist", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const latest = await asUser.query(apiAny.taskVerifications.getLatestByTask, {
      taskId: data.taskId,
    });
    expect(latest).toBeNull();
  });

  test("requires authentication", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await expect(
      t.query(apiAny.taskVerifications.getLatestByTask, {
        taskId: data.taskId,
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("rejects users outside the task org", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    await createVerification(t, data, { status: "completed" });
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.taskVerifications.getLatestByTask, {
        taskId: data.taskId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── Public queries: get ─────────────────────────────────────────────

describe("taskVerifications.get", () => {
  test("returns a single verification by ID", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const verificationId = await createVerification(t, data, {
      commitSha: "def456",
      branch: "main",
    });

    const result = await asUser.query(apiAny.taskVerifications.get, {
      verificationId,
    });
    expect(result).not.toBeNull();
    expect(result._id).toBe(verificationId);
    expect(result.commitSha).toBe("def456");
    expect(result.branch).toBe("main");
  });

  test("requires authentication", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);

    await expect(t.query(apiAny.taskVerifications.get, { verificationId })).rejects.toThrow(
      "Not authenticated",
    );
  });

  test("rejects users outside the verification org", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.taskVerifications.get, { verificationId }),
    ).rejects.toThrow("Access denied");
  });
});

// ── Public queries: getChecks ───────────────────────────────────────

describe("taskVerifications.getChecks", () => {
  test("returns checks for a verification ordered by index", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });
    const verificationId = await createVerification(t, data);

    // Insert checks with explicit order values (out of insertion order)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("verificationChecks", {
        orgId: "org-1",
        verificationId,
        type: "visual",
        description: "Check C",
        status: "passed",
        order: 2,
      });
      await ctx.db.insert("verificationChecks", {
        orgId: "org-1",
        verificationId,
        type: "functional",
        description: "Check A",
        status: "failed",
        order: 0,
      });
      await ctx.db.insert("verificationChecks", {
        orgId: "org-1",
        verificationId,
        type: "accessibility",
        description: "Check B",
        status: "warning",
        order: 1,
      });
    });

    const checks = await asUser.query(apiAny.taskVerifications.getChecks, {
      verificationId,
    });
    expect(checks).toHaveLength(3);
    // Ordered by the by_verification index which includes order
    expect(checks[0].description).toBe("Check A");
    expect(checks[0].order).toBe(0);
    expect(checks[1].description).toBe("Check B");
    expect(checks[1].order).toBe(1);
    expect(checks[2].description).toBe("Check C");
    expect(checks[2].order).toBe(2);
  });

  test("rejects users outside the verification org", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.taskVerifications.getChecks, {
        verificationId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── Public queries: getScreenshots ──────────────────────────────────

describe("taskVerifications.getScreenshots", () => {
  // convex-test does not support ctx.storage.store() and fabricated _storage IDs
  // are rejected by schema validation. This query is exercised indirectly via
  // the processResults integration test and manual QA against a live backend.
  test.skip("returns screenshots for a verification (requires file storage support)", () => {
    // Placeholder — covered by integration tests against real Convex backend.
  });

  test("rejects users outside the verification org", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.taskVerifications.getScreenshots, {
        verificationId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── Public mutations: generateUploadUrl ─────────────────────────────

describe("taskVerifications.generateUploadUrl", () => {
  test("requires authentication", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);

    await expect(t.mutation(apiAny.taskVerifications.generateUploadUrl, {})).rejects.toThrow(
      "Not authenticated",
    );
  });
});

// ── Internal actions: processResults ────────────────────────────────

describe("taskVerifications.processStatusUpdate (internal action)", () => {
  test("records non-final and failed worker updates on the verification row", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);

    await t.action(internalAny.taskVerifications.processStatusUpdate, {
      verificationId,
      status: "provisioning",
      startedAt: 1700000000000,
    });

    let updated = await t.run(async (ctx: any) => await ctx.db.get(verificationId));
    expect(updated.status).toBe("provisioning");
    expect(updated.startedAt).toBe(1700000000000);
    expect(updated.completedAt).toBeUndefined();

    await t.action(internalAny.taskVerifications.processStatusUpdate, {
      verificationId,
      status: "failed",
      error: "Dev server failed to boot",
      durationMs: 4321,
    });

    updated = await t.run(async (ctx: any) => await ctx.db.get(verificationId));
    expect(updated.status).toBe("failed");
    expect(updated.error).toBe("Dev server failed to boot");
    expect(updated.durationMs).toBe(4321);
    expect(updated.completedAt).toBeDefined();
  });
});

describe("taskVerifications.processResults (internal action)", () => {
  test("creates checks, updates verification status, and sends notification", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);

    await t.action(internalAny.taskVerifications.processResults, {
      verificationId,
      status: "completed",
      checks: [
        {
          type: "functional",
          description: "Form submission works",
          status: "passed",
        },
        {
          type: "visual",
          description: "Layout matches design",
          status: "passed",
        },
        {
          type: "accessibility",
          description: "Missing alt text on hero image",
          status: "failed",
          selector: "img.hero",
          expected: "Alt text present",
          actual: "No alt attribute",
        },
      ],
      screenshotStorageIds: [],
      aiSummary: "2 of 3 checks passed. One accessibility issue found.",
      durationMs: 8500,
    });

    // Verify: checks were created
    const checks = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("verificationChecks")
        .withIndex("by_verification", (q: any) => q.eq("verificationId", verificationId))
        .collect();
    });
    expect(checks).toHaveLength(3);
    expect(checks.find((c: any) => c.description === "Form submission works")).toBeDefined();
    expect(
      checks.find((c: any) => c.description === "Missing alt text on hero image"),
    ).toBeDefined();

    // Verify: verification record was updated
    const updated = await t.run(async (ctx: any) => await ctx.db.get(verificationId));
    expect(updated.status).toBe("completed");
    expect(updated.checksTotal).toBe(3);
    expect(updated.checksPassed).toBe(2);
    expect(updated.checksFailed).toBe(1);
    expect(updated.screenshotCount).toBe(0);
    expect(updated.aiSummary).toBe("2 of 3 checks passed. One accessibility issue found.");
    expect(updated.durationMs).toBe(8500);
    expect(updated.completedAt).toBeDefined();

    // Verify: notification was created
    const notifications = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q: any) => q.eq("userId", data.userId))
        .collect();
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("verification_failed");
    expect(notifications[0].title).toContain("1 issue");
    expect(notifications[0].body).toContain("2/3 checks passed");
  });

  test("sends verification_completed notification when all checks pass", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const verificationId = await createVerification(t, data);

    await t.action(internalAny.taskVerifications.processResults, {
      verificationId,
      status: "completed",
      checks: [
        {
          type: "functional",
          description: "Page loads correctly",
          status: "passed",
        },
        {
          type: "visual",
          description: "Colors match brand palette",
          status: "passed",
        },
      ],
      screenshotStorageIds: [],
      aiSummary: "All checks passed.",
      durationMs: 5000,
    });

    const notifications = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q: any) => q.eq("userId", data.userId))
        .collect();
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("verification_completed");
    expect(notifications[0].title).toBe("Verification passed");
  });
});

// ── Internal actions: triggerVerification ────────────────────────────

describe("taskVerificationActions.triggerVerification (internal action)", () => {
  test("creates verification record and fails gracefully when worker is not configured", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await t.action(internalAny.taskVerificationActions.triggerVerification, {
      taskId: data.taskId,
      triggeredBy: data.userId,
      trigger: "manual",
      branch: "feat/new-feature",
    });

    // The verification record should exist and be marked as failed
    const verifications = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("taskVerifications")
        .withIndex("by_task", (q: any) => q.eq("taskId", data.taskId))
        .collect();
    });
    expect(verifications).toHaveLength(1);
    expect(verifications[0].status).toBe("failed");
    expect(verifications[0].error).toBe("Verification worker not configured");
    expect(verifications[0].branch).toBe("feat/new-feature");
  });
});

// ── Public actions: retriggerVerification ───────────────────────────

describe("taskVerifications.retriggerVerification", () => {
  test("requires task access before scheduling a manual verification", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.action(apiAny.taskVerifications.retriggerVerification, {
        taskId: data.taskId,
      }),
    ).rejects.toThrow("Access denied");
  });

  test("derives verification ownership from the task and schedules the run", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const data = await setupBaseData(t);
      await createSandboxSession(t, data);
      const asUser = t.withIdentity({ subject: "test-user-1" });

      await asUser.action(apiAny.taskVerifications.retriggerVerification, {
        taskId: data.taskId,
      });
      await drainScheduledFunctions(t);

      const verifications = await t.run(async (ctx: any) => {
        return await ctx.db
          .query("taskVerifications")
          .withIndex("by_task", (q: any) => q.eq("taskId", data.taskId))
          .collect();
      });
      expect(verifications).toHaveLength(1);
      expect(verifications[0].orgId).toBe("org-1");
      expect(verifications[0].programId).toBe(data.programId);
      expect(verifications[0].taskId).toBe(data.taskId);
      expect(verifications[0].trigger).toBe("manual");
      expect(verifications[0].status).toBe("failed");
      expect(verifications[0].error).toBe("Verification worker not configured");
    } finally {
      vi.useRealTimers();
    }
  });
});
