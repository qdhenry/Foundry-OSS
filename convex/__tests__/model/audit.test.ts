import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";
import { seedOrg, seedProgram, setupTestEnv } from "../helpers/baseFactory";

// ---------------------------------------------------------------------------
// logAuditEvent — tested indirectly through mutations that call it
// tasks.create calls logAuditEvent with action "create"
// tasks.updateStatus calls logAuditEvent with action "status_change"
// ---------------------------------------------------------------------------

describe("logAuditEvent via tasks.create", () => {
  test("creates audit log entry with correct fields on task creation", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedOrg(t);
    const { programId } = await seedProgram(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await asUser.mutation(apiAny.tasks.create, {
      orgId: "org-1",
      programId,
      title: "Audit test task",
      priority: "high",
    });

    const auditEntries = await t.run(async (ctx: any) => {
      return await ctx.db.query("auditLog").collect();
    });

    expect(auditEntries).toHaveLength(1);
    const entry = auditEntries[0];
    expect(entry.orgId).toBe("org-1");
    expect(entry.entityType).toBe("task");
    expect(entry.entityId).toBe(taskId);
    expect(entry.action).toBe("create");
    expect(entry.userId).toBe(userId);
    expect(entry.userName).toBe("User One");
    expect(entry.description).toContain("Audit test task");
    expect(entry.timestamp).toBeGreaterThan(0);
  });

  test("audit log links to correct program", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId } = await seedProgram(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.tasks.create, {
      orgId: "org-1",
      programId,
      title: "Program link task",
      priority: "medium",
    });

    const auditEntries = await t.run(async (ctx: any) => {
      return await ctx.db.query("auditLog").collect();
    });

    expect(auditEntries[0].programId).toBe(programId);
  });
});

describe("logAuditEvent via tasks.updateStatus", () => {
  test("creates audit log entry with status_change action", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId } = await seedProgram(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await asUser.mutation(apiAny.tasks.create, {
      orgId: "org-1",
      programId,
      title: "Status change task",
      priority: "medium",
      status: "todo",
    });

    await asUser.mutation(apiAny.tasks.updateStatus, {
      taskId,
      status: "in_progress",
    });

    const auditEntries = await t.run(async (ctx: any) => {
      return await ctx.db.query("auditLog").collect();
    });

    // Two entries: one from create, one from updateStatus
    expect(auditEntries).toHaveLength(2);

    const statusEntry = auditEntries.find((e: any) => e.action === "status_change");
    expect(statusEntry).toBeDefined();
    expect(statusEntry.entityType).toBe("task");
    expect(statusEntry.entityId).toBe(taskId);
    expect(statusEntry.description).toContain("todo");
    expect(statusEntry.description).toContain("in_progress");
  });

  test("status_change audit entry includes metadata with old and new status", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId } = await seedProgram(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await asUser.mutation(apiAny.tasks.create, {
      orgId: "org-1",
      programId,
      title: "Metadata task",
      priority: "low",
      status: "backlog",
    });

    await asUser.mutation(apiAny.tasks.updateStatus, {
      taskId,
      status: "todo",
    });

    const auditEntries = await t.run(async (ctx: any) => {
      return await ctx.db.query("auditLog").collect();
    });

    const statusEntry = auditEntries.find((e: any) => e.action === "status_change");
    expect(statusEntry.metadata).toBeDefined();
    expect(statusEntry.metadata.oldStatus).toBe("backlog");
    expect(statusEntry.metadata.newStatus).toBe("todo");
  });

  test("multiple mutations produce multiple audit log entries", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const { programId } = await seedProgram(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const taskId = await asUser.mutation(apiAny.tasks.create, {
      orgId: "org-1",
      programId,
      title: "Multi-audit task",
      priority: "critical",
      status: "todo",
    });

    await asUser.mutation(apiAny.tasks.updateStatus, {
      taskId,
      status: "in_progress",
    });

    await asUser.mutation(apiAny.tasks.updateStatus, {
      taskId,
      status: "review",
    });

    const auditEntries = await t.run(async (ctx: any) => {
      return await ctx.db.query("auditLog").collect();
    });

    // 1 create + 2 status_change = 3
    expect(auditEntries).toHaveLength(3);
    expect(auditEntries.filter((e: any) => e.action === "create")).toHaveLength(1);
    expect(auditEntries.filter((e: any) => e.action === "status_change")).toHaveLength(2);
  });
});
