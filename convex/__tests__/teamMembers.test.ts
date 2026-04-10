import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

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

  const user3Id = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-3",
      email: "user3@example.com",
      name: "User Three",
      orgIds: ["org-1"],
      role: "developer",
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

  return { userId, otherUserId, user3Id, programId };
}

// ── listByProgram ────────────────────────────────────────────────────

describe("teamMembers.listByProgram", () => {
  test("returns members with user info", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("teamMembers", {
        orgId: "org-1",
        programId: data.programId,
        userId: data.userId,
        role: "architect",
      });
    });

    const members = await asUser.query(apiAny.teamMembers.listByProgram, {
      programId: data.programId,
    });
    expect(members).toHaveLength(1);
    expect(members[0].user?.name).toBe("User One");
    expect(members[0].role).toBe("architect");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.teamMembers.listByProgram, {
        programId: data.programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── add ──────────────────────────────────────────────────────────────

describe("teamMembers.add", () => {
  test("adds a team member", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const memberId = await asUser.mutation(apiAny.teamMembers.add, {
      orgId: "org-1",
      programId: data.programId,
      userId: data.user3Id,
      role: "developer",
    });

    const member = await t.run(async (ctx: any) => await ctx.db.get(memberId));
    expect(member.role).toBe("developer");
    expect(member.userId).toBe(data.user3Id);
  });

  test("rejects duplicate member", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.teamMembers.add, {
      orgId: "org-1",
      programId: data.programId,
      userId: data.user3Id,
      role: "developer",
    });

    await expect(
      asUser.mutation(apiAny.teamMembers.add, {
        orgId: "org-1",
        programId: data.programId,
        userId: data.user3Id,
        role: "qa",
      }),
    ).rejects.toThrow("User is already a member");
  });
});

// ── update ───────────────────────────────────────────────────────────

describe("teamMembers.update", () => {
  test("updates member role", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const memberId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("teamMembers", {
        orgId: "org-1",
        programId: data.programId,
        userId: data.user3Id,
        role: "developer",
      });
    });

    await asUser.mutation(apiAny.teamMembers.update, {
      memberId,
      role: "architect",
    });

    const member = await t.run(async (ctx: any) => await ctx.db.get(memberId));
    expect(member.role).toBe("architect");
  });
});

// ── remove ───────────────────────────────────────────────────────────

describe("teamMembers.remove", () => {
  test("removes a team member", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const memberId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("teamMembers", {
        orgId: "org-1",
        programId: data.programId,
        userId: data.user3Id,
        role: "developer",
      });
    });

    await asUser.mutation(apiAny.teamMembers.remove, { memberId });

    const member = await t.run(async (ctx: any) => await ctx.db.get(memberId));
    expect(member).toBeNull();
  });
});

// ── getByProgramInternal ─────────────────────────────────────────────

describe("teamMembers.getByProgramInternal", () => {
  test("returns members with names", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("teamMembers", {
        orgId: "org-1",
        programId: data.programId,
        userId: data.userId,
        role: "architect",
      });
    });

    const members = await t.query(internalAny.teamMembers.getByProgramInternal, {
      programId: data.programId,
    });
    expect(members).toHaveLength(1);
    expect(members[0].name).toBe("User One");
  });
});
