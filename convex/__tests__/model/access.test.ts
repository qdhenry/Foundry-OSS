import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";
import { seedCrossOrgUser, seedOrg, seedProgram, setupTestEnv } from "../helpers/baseFactory";

// ---------------------------------------------------------------------------
// assertOrgAccess — tested indirectly via programs.list (calls assertOrgAccess)
// ---------------------------------------------------------------------------

describe("assertOrgAccess", () => {
  test("unauthenticated request throws 'Not authenticated'", async () => {
    const t = convexTest(schema, modules);
    // No identity — anonymous caller
    await expect(t.query(apiAny.programs.list, { orgId: "org-1" })).rejects.toThrow(
      "Not authenticated",
    );
  });

  test("user not found in DB throws 'Access denied'", async () => {
    const t = convexTest(schema, modules);
    // Identity with subject that has no matching user record
    const asGhost = t.withIdentity({ subject: "nonexistent-user" });

    await expect(asGhost.query(apiAny.programs.list, { orgId: "org-1" })).rejects.toThrow(
      "Access denied",
    );
  });

  test("user exists but wrong orgId throws 'Access denied'", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // User belongs to org-1, trying to access org-2
    await expect(asUser.query(apiAny.programs.list, { orgId: "org-2" })).rejects.toThrow(
      "Access denied",
    );
  });

  test("user with correct orgId succeeds", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Should not throw — user belongs to org-1
    const programs = await asUser.query(apiAny.programs.list, { orgId: "org-1" });
    expect(Array.isArray(programs)).toBe(true);
  });

  test("cross-org user cannot access other org", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    await seedCrossOrgUser(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(asOtherUser.query(apiAny.programs.list, { orgId: "org-1" })).rejects.toThrow(
      "Access denied",
    );
  });

  test("JWT org_id fallback — user passes access check via identity org_id claim", async () => {
    const t = convexTest(schema, modules);

    // Create a user that does NOT have org-3 in their orgIds array
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkId: "jwt-fallback-user",
        email: "jwt@example.com",
        name: "JWT User",
        orgIds: ["org-1"], // does NOT include org-3
      });
    });

    // Identity has org_id claim for org-3 — should pass via JWT fallback
    const asJwtUser = t.withIdentity({
      subject: "jwt-fallback-user",
      org_id: "org-3",
    });

    const programs = await asJwtUser.query(apiAny.programs.list, { orgId: "org-3" });
    expect(Array.isArray(programs)).toBe(true);
  });

  test("JWT org_id claim does not match requested orgId — still denied", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkId: "jwt-mismatch-user",
        email: "mismatch@example.com",
        name: "Mismatch User",
        orgIds: ["org-1"],
      });
    });

    // org_id claim is org-5 but requesting org-4
    const asUser = t.withIdentity({
      subject: "jwt-mismatch-user",
      org_id: "org-5",
    });

    await expect(asUser.query(apiAny.programs.list, { orgId: "org-4" })).rejects.toThrow(
      "Access denied",
    );
  });
});

// ---------------------------------------------------------------------------
// getAuthUser — tested indirectly via notifications.markAllRead (calls getAuthUser)
// or auditLog.listByProgram (calls assertOrgAccess which is similar)
// We use tasks.create which calls both assertOrgAccess and logAuditEvent(→getAuthUser)
// ---------------------------------------------------------------------------

describe("getAuthUser", () => {
  test("unauthenticated throws 'Not authenticated'", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await seedProgram(t);
    await seedOrg(t);

    // No identity — tasks.create calls assertOrgAccess first which also throws
    await expect(
      t.mutation(apiAny.tasks.create, {
        orgId: "org-1",
        programId,
        title: "Test",
        priority: "medium",
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("user not found throws error", async () => {
    const t = convexTest(schema, modules);
    // Create a user with matching org but then query as different clerk user
    await seedOrg(t);
    const { programId } = await seedProgram(t);

    // Ghost user identity — no user record
    const asGhost = t.withIdentity({ subject: "ghost-user" });

    await expect(
      asGhost.mutation(apiAny.tasks.create, {
        orgId: "org-1",
        programId,
        title: "Test",
        priority: "medium",
      }),
    ).rejects.toThrow("Access denied");
  });

  test("returns user when authenticated (task creation succeeds)", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedOrg(t);
    const { programId } = await seedProgram(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // tasks.create succeeds, meaning both assertOrgAccess and getAuthUser worked
    const taskId = await asUser.mutation(apiAny.tasks.create, {
      orgId: "org-1",
      programId,
      title: "Auth test task",
      priority: "medium",
    });

    expect(taskId).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getAuthUserOrNull — tested indirectly via notifications.listUnread
// which returns [] when user is null instead of throwing
// ---------------------------------------------------------------------------

describe("getAuthUserOrNull", () => {
  test("returns empty array when unauthenticated (user is null)", async () => {
    const t = convexTest(schema, modules);

    // No identity — getAuthUserOrNull returns null, listUnread returns []
    const result = await t.query(apiAny.notifications.listUnread, {});
    expect(result).toEqual([]);
  });

  test("returns empty array when user not in DB", async () => {
    const t = convexTest(schema, modules);
    const asGhost = t.withIdentity({ subject: "nonexistent-user" });

    // User identity exists but no DB record — getAuthUserOrNull returns null
    const result = await asGhost.query(apiAny.notifications.listUnread, {});
    expect(result).toEqual([]);
  });

  test("returns user when authenticated (notifications query succeeds)", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedOrg(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Create a notification for this user
    await t.run(async (ctx: any) => {
      await ctx.db.insert("notifications", {
        orgId: "org-1",
        userId,
        type: "sandbox_complete",
        title: "Test notification",
        body: "Testing",
        read: false,
        createdAt: Date.now(),
      });
    });

    const result = await asUser.query(apiAny.notifications.listUnread, {});
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test notification");
  });
});
