import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";

const apiAny: any = (generatedApi as any).api;

async function setupBaseData(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "user1@example.com",
      name: "User One",
      orgIds: ["org-1"],
      role: "admin",
    });
  });

  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
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
      sourcePlatform: "none",
      targetPlatform: "none",
      phase: "build",
      status: "active",
    });
  });

  return { programId };
}

// ── listByProgram ────────────────────────────────────────────────────

describe("auditLog.listByProgram", () => {
  test("returns audit entries for a program", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("auditLog", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "requirement",
        entityId: "req-1",
        action: "create",
        userId: (await ctx.db.query("users").first())._id,
        userName: "User One",
        description: "Created requirement",
        timestamp: Date.now(),
      });
      await ctx.db.insert("auditLog", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "risk",
        entityId: "risk-1",
        action: "update",
        userId: (await ctx.db.query("users").first())._id,
        userName: "User One",
        description: "Updated risk",
        timestamp: Date.now() - 1000,
      });
    });

    const entries = await asUser.query(apiAny.auditLog.listByProgram, {
      programId: data.programId,
    });
    expect(entries).toHaveLength(2);
  });

  test("filters by entityType", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      const userId = (await ctx.db.query("users").first())._id;
      await ctx.db.insert("auditLog", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "requirement",
        entityId: "req-1",
        action: "create",
        userId,
        userName: "User One",
        description: "Created requirement",
        timestamp: Date.now(),
      });
      await ctx.db.insert("auditLog", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "risk",
        entityId: "risk-1",
        action: "create",
        userId,
        userName: "User One",
        description: "Created risk",
        timestamp: Date.now(),
      });
    });

    const entries = await asUser.query(apiAny.auditLog.listByProgram, {
      programId: data.programId,
      entityType: "requirement",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].entityType).toBe("requirement");
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      const userId = (await ctx.db.query("users").first())._id;
      for (let i = 0; i < 10; i++) {
        await ctx.db.insert("auditLog", {
          orgId: "org-1",
          programId: data.programId,
          entityType: "requirement",
          entityId: `req-${i}`,
          action: "create",
          userId,
          userName: "User One",
          description: `Entry ${i}`,
          timestamp: Date.now() - i * 1000,
        });
      }
    });

    const entries = await asUser.query(apiAny.auditLog.listByProgram, {
      programId: data.programId,
      limit: 5,
    });
    expect(entries).toHaveLength(5);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.auditLog.listByProgram, {
        programId: data.programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── listByEntity ─────────────────────────────────────────────────────

describe("auditLog.listByEntity", () => {
  test("returns audit entries for a specific entity", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      const userId = (await ctx.db.query("users").first())._id;
      await ctx.db.insert("auditLog", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "requirement",
        entityId: "req-abc",
        action: "create",
        userId,
        userName: "User One",
        description: "Created",
        timestamp: Date.now(),
      });
      await ctx.db.insert("auditLog", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "requirement",
        entityId: "req-abc",
        action: "update",
        userId,
        userName: "User One",
        description: "Updated",
        timestamp: Date.now() + 1000,
      });
      await ctx.db.insert("auditLog", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "requirement",
        entityId: "req-other",
        action: "create",
        userId,
        userName: "User One",
        description: "Other entity",
        timestamp: Date.now(),
      });
    });

    const entries = await asUser.query(apiAny.auditLog.listByEntity, {
      entityType: "requirement",
      entityId: "req-abc",
    });
    expect(entries).toHaveLength(2);
  });
});
