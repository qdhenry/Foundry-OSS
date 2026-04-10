import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

/**
 * Integration tests for the authentication flow:
 * - User sync from Clerk webhook (upsertFromClerk)
 * - Organization access control (assertOrgAccess)
 * - Cross-org isolation
 * - JWT identity resolution
 */

// ── Helpers ──────────────────────────────────────────────────────────

async function seedUser(
  t: any,
  overrides: Partial<{
    clerkId: string;
    email: string;
    name: string;
    orgIds: string[];
    role: string;
  }> = {},
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: overrides.clerkId ?? "clerk-user-1",
      email: overrides.email ?? "user@example.com",
      name: overrides.name ?? "Test User",
      orgIds: overrides.orgIds ?? ["org-1"],
      role: overrides.role ?? "admin",
    });
  });
}

async function seedProgram(t: any, orgId = "org-1") {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId,
      name: "Test Program",
      clientName: "Test Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });
}

// ── User Sync Webhook (upsertFromClerk) ─────────────────────────────

describe("auth-flow: user sync webhook", () => {
  test("creates a new user from Clerk webhook data", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-new-user",
      email: "new@example.com",
      name: "New User",
      orgIds: ["org-1", "org-2"],
    });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", "clerk-new-user"))
        .unique();
    });

    expect(user).not.toBeNull();
    expect(user.email).toBe("new@example.com");
    expect(user.name).toBe("New User");
    expect(user.orgIds).toEqual(["org-1", "org-2"]);
  });

  test("updates existing user on repeated webhook", async () => {
    const t = convexTest(schema, modules);

    // Initial create
    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-existing",
      email: "old@example.com",
      name: "Old Name",
      orgIds: ["org-1"],
    });

    // Update via second webhook
    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-existing",
      email: "new@example.com",
      name: "New Name",
      avatarUrl: "https://example.com/avatar.png",
      orgIds: ["org-1", "org-2"],
    });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", "clerk-existing"))
        .unique();
    });

    expect(user.email).toBe("new@example.com");
    expect(user.name).toBe("New Name");
    expect(user.avatarUrl).toBe("https://example.com/avatar.png");
    expect(user.orgIds).toEqual(["org-1", "org-2"]);
  });

  test("handles user with no organization memberships", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-no-org",
      email: "noorg@example.com",
      name: "No Org User",
      orgIds: [],
    });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", "clerk-no-org"))
        .unique();
    });

    expect(user.orgIds).toEqual([]);
  });
});

// ── Organization Access Control ─────────────────────────────────────

describe("auth-flow: organization access control", () => {
  test("authenticated user can access resources in their org", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, { clerkId: "clerk-user-1", orgIds: ["org-1"] });
    const programId = await seedProgram(t, "org-1");

    const asUser = t.withIdentity({ subject: "clerk-user-1" });

    // Should not throw — user has access to org-1
    const tasks = await asUser.query(apiAny.tasks.listByProgram, { programId });
    expect(tasks).toEqual([]);
  });

  test("cross-org access is denied", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, { clerkId: "clerk-user-1", orgIds: ["org-1"] });
    await seedUser(t, { clerkId: "clerk-user-2", orgIds: ["org-2"] });
    const programId = await seedProgram(t, "org-1");

    const asOtherUser = t.withIdentity({ subject: "clerk-user-2" });

    await expect(asOtherUser.query(apiAny.tasks.listByProgram, { programId })).rejects.toThrow(
      "Access denied",
    );
  });

  test("unauthenticated request is rejected", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, { clerkId: "clerk-user-1", orgIds: ["org-1"] });
    const programId = await seedProgram(t, "org-1");

    // No identity provided — unauthenticated
    await expect(t.query(apiAny.tasks.listByProgram, { programId })).rejects.toThrow();
  });

  test("user with multiple orgs can access resources in each", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, { clerkId: "multi-org-user", orgIds: ["org-A", "org-B"] });
    const programA = await seedProgram(t, "org-A");
    const programB = await seedProgram(t, "org-B");

    const asUser = t.withIdentity({ subject: "multi-org-user" });

    // Both should succeed
    const tasksA = await asUser.query(apiAny.tasks.listByProgram, { programId: programA });
    const tasksB = await asUser.query(apiAny.tasks.listByProgram, { programId: programB });
    expect(tasksA).toEqual([]);
    expect(tasksB).toEqual([]);
  });
});

// ── JWT Identity Resolution ─────────────────────────────────────────

describe("auth-flow: JWT identity resolution", () => {
  test("identity subject maps to clerkId for user lookup", async () => {
    const t = convexTest(schema, modules);
    const _userId = await seedUser(t, { clerkId: "clerk-jwt-user", orgIds: ["org-1"] });
    const programId = await seedProgram(t, "org-1");

    const asUser = t.withIdentity({ subject: "clerk-jwt-user" });

    // Create a task — requires identity resolution to work
    const taskId = await asUser.mutation(apiAny.tasks.create, {
      orgId: "org-1",
      programId,
      title: "JWT Test Task",
      priority: "medium",
    });

    const task = await t.run(async (ctx: any) => await ctx.db.get(taskId));
    expect(task).not.toBeNull();
    expect(task.title).toBe("JWT Test Task");
  });

  test("unknown clerkId in JWT returns access denied", async () => {
    const t = convexTest(schema, modules);
    const programId = await seedProgram(t, "org-1");

    // Identity with a clerkId that doesn't exist in users table
    const asUnknown = t.withIdentity({ subject: "clerk-nonexistent" });

    await expect(asUnknown.query(apiAny.tasks.listByProgram, { programId })).rejects.toThrow();
  });
});

// ── Org removal via webhook update ──────────────────────────────────

describe("auth-flow: org membership changes", () => {
  test("removing org from user revokes access to that org's resources", async () => {
    const t = convexTest(schema, modules);

    // User initially in org-1 and org-2
    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-revoke-test",
      email: "revoke@example.com",
      name: "Revoke Test",
      orgIds: ["org-1", "org-2"],
    });

    const programId = await seedProgram(t, "org-1");
    const asUser = t.withIdentity({ subject: "clerk-revoke-test" });

    // Should work initially
    const tasks = await asUser.query(apiAny.tasks.listByProgram, { programId });
    expect(tasks).toEqual([]);

    // Webhook removes org-1 membership
    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-revoke-test",
      email: "revoke@example.com",
      name: "Revoke Test",
      orgIds: ["org-2"],
    });

    // Should now be denied
    await expect(asUser.query(apiAny.tasks.listByProgram, { programId })).rejects.toThrow(
      "Access denied",
    );
  });
});
