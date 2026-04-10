import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { seedCrossOrgUser, seedOrg } from "./helpers/baseFactory";

// ---------------------------------------------------------------------------
// upsertFromClerk (internalMutation)
// ---------------------------------------------------------------------------

describe("users.upsertFromClerk", () => {
  test("creates a new user", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-new-1",
      email: "new@example.com",
      name: "New User",
      orgIds: ["org-1"],
    });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", "clerk-new-1"))
        .unique();
    });

    expect(user).not.toBeNull();
    expect(user.email).toBe("new@example.com");
    expect(user.name).toBe("New User");
    expect(user.orgIds).toEqual(["org-1"]);
  });

  test("updates existing user with same clerkId", async () => {
    const t = convexTest(schema, modules);

    // Create user first
    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-upsert-1",
      email: "old@example.com",
      name: "Old Name",
      orgIds: ["org-1"],
    });

    // Upsert with same clerkId but updated fields
    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-upsert-1",
      email: "updated@example.com",
      name: "Updated Name",
      orgIds: ["org-1", "org-2"],
    });

    const users = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", "clerk-upsert-1"))
        .collect();
    });

    // Should still be only one user
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("updated@example.com");
    expect(users[0].name).toBe("Updated Name");
    expect(users[0].orgIds).toEqual(["org-1", "org-2"]);
  });

  test("stores avatarUrl when provided", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internalAny.users.upsertFromClerk, {
      clerkId: "clerk-avatar-1",
      email: "avatar@example.com",
      name: "Avatar User",
      orgIds: ["org-1"],
      avatarUrl: "https://example.com/avatar.png",
    });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", "clerk-avatar-1"))
        .unique();
    });

    expect(user.avatarUrl).toBe("https://example.com/avatar.png");
  });
});

// ---------------------------------------------------------------------------
// getByClerkId (query — no auth check)
// ---------------------------------------------------------------------------

describe("users.getByClerkId", () => {
  test("returns user by clerkId", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);

    const user = await t.query(apiAny.users.getByClerkId, {
      clerkId: "test-user-1",
    });

    expect(user).not.toBeNull();
    expect(user.clerkId).toBe("test-user-1");
    expect(user.name).toBe("User One");
  });

  test("returns null for unknown clerkId", async () => {
    const t = convexTest(schema, modules);

    const user = await t.query(apiAny.users.getByClerkId, {
      clerkId: "nonexistent-clerk-id",
    });

    expect(user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// list (query — filters by orgId in memory)
// ---------------------------------------------------------------------------

describe("users.list", () => {
  test("returns users for org", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    await seedCrossOrgUser(t);

    const users = await t.query(apiAny.users.list, { orgId: "org-1" });

    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("User One");
  });

  test("excludes users from other orgs", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);
    await seedCrossOrgUser(t);

    const org1Users = await t.query(apiAny.users.list, { orgId: "org-1" });
    const org2Users = await t.query(apiAny.users.list, { orgId: "org-2" });

    expect(org1Users).toHaveLength(1);
    expect(org1Users[0].clerkId).toBe("test-user-1");

    expect(org2Users).toHaveLength(1);
    expect(org2Users[0].clerkId).toBe("test-user-2");
  });

  test("returns empty array when no users in org", async () => {
    const t = convexTest(schema, modules);

    const users = await t.query(apiAny.users.list, { orgId: "org-empty" });
    expect(users).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// syncActiveOrg (mutation — uses auth)
// ---------------------------------------------------------------------------

describe("users.syncActiveOrg", () => {
  test("adds orgId to authenticated user", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedOrg(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // User starts with org-1, add org-3
    await asUser.mutation(apiAny.users.syncActiveOrg, { orgId: "org-3" });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db.get(userId);
    });

    expect(user.orgIds).toContain("org-1");
    expect(user.orgIds).toContain("org-3");
  });

  test("no-op if orgId already present", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedOrg(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // org-1 is already in the user's orgIds
    await asUser.mutation(apiAny.users.syncActiveOrg, { orgId: "org-1" });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db.get(userId);
    });

    // Should still be exactly one entry of org-1
    expect(user.orgIds).toEqual(["org-1"]);
  });

  test("no-op if unauthenticated", async () => {
    const t = convexTest(schema, modules);
    await seedOrg(t);

    // No identity — should return without error
    await t.mutation(apiAny.users.syncActiveOrg, { orgId: "org-new" });

    // Verify no user was modified
    const users = await t.run(async (ctx: any) => {
      return await ctx.db.query("users").collect();
    });
    expect(users[0].orgIds).toEqual(["org-1"]);
  });
});

// ---------------------------------------------------------------------------
// addOrgId (internalMutation)
// ---------------------------------------------------------------------------

describe("users.addOrgId", () => {
  test("adds orgId to user", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedOrg(t);

    await t.mutation(internalAny.users.addOrgId, {
      clerkId: "test-user-1",
      orgId: "org-new",
    });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db.get(userId);
    });

    expect(user.orgIds).toContain("org-1");
    expect(user.orgIds).toContain("org-new");
  });

  test("no-op if orgId already present", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedOrg(t);

    await t.mutation(internalAny.users.addOrgId, {
      clerkId: "test-user-1",
      orgId: "org-1",
    });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db.get(userId);
    });

    expect(user.orgIds).toEqual(["org-1"]);
  });

  test("no-op for unknown clerkId", async () => {
    const t = convexTest(schema, modules);

    // Should not throw — silently ignores missing user
    await t.mutation(internalAny.users.addOrgId, {
      clerkId: "nonexistent",
      orgId: "org-1",
    });
  });
});

// ---------------------------------------------------------------------------
// removeOrgId (internalMutation)
// ---------------------------------------------------------------------------

describe("users.removeOrgId", () => {
  test("removes orgId from user", async () => {
    const t = convexTest(schema, modules);

    // Create user with two orgs
    const userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "multi-org-user",
        email: "multi@example.com",
        name: "Multi Org",
        orgIds: ["org-1", "org-2"],
      });
    });

    await t.mutation(internalAny.users.removeOrgId, {
      clerkId: "multi-org-user",
      orgId: "org-2",
    });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db.get(userId);
    });

    expect(user.orgIds).toEqual(["org-1"]);
  });

  test("no-op for unknown clerkId", async () => {
    const t = convexTest(schema, modules);

    // Should not throw — silently ignores missing user
    await t.mutation(internalAny.users.removeOrgId, {
      clerkId: "nonexistent",
      orgId: "org-1",
    });
  });

  test("removes last orgId leaving empty array", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "single-org-user",
        email: "single@example.com",
        name: "Single Org",
        orgIds: ["org-only"],
      });
    });

    await t.mutation(internalAny.users.removeOrgId, {
      clerkId: "single-org-user",
      orgId: "org-only",
    });

    const user = await t.run(async (ctx: any) => {
      return await ctx.db.get(userId);
    });

    expect(user.orgIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getByIdInternal (internalQuery)
// ---------------------------------------------------------------------------

describe("users.getByIdInternal", () => {
  test("returns user by ID", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedOrg(t);

    const user = await t.query(internalAny.users.getByIdInternal, {
      userId,
    });

    expect(user).not.toBeNull();
    expect(user.clerkId).toBe("test-user-1");
    expect(user.name).toBe("User One");
  });
});
