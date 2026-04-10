import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;

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

  return { userId, otherUserId, programId };
}

// ── create ───────────────────────────────────────────────────────────

describe("comments.create", () => {
  test("creates a comment", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const commentId = await asUser.mutation(apiAny.comments.create, {
      orgId: "org-1",
      programId: data.programId,
      entityType: "requirement",
      entityId: "some-entity-id",
      content: "This is a comment",
    });

    const comment = await t.run(async (ctx: any) => await ctx.db.get(commentId));
    expect(comment.content).toBe("This is a comment");
    expect(comment.authorId).toBe(data.userId);
    expect(comment.entityType).toBe("requirement");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.comments.create, {
        orgId: "org-1",
        programId: data.programId,
        entityType: "requirement",
        entityId: "some-entity-id",
        content: "Unauthorized comment",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── listByEntity ─────────────────────────────────────────────────────

describe("comments.listByEntity", () => {
  test("returns comments with author names", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("comments", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "risk",
        entityId: "entity-123",
        authorId: data.userId,
        content: "Comment 1",
      });
      await ctx.db.insert("comments", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "risk",
        entityId: "entity-123",
        authorId: data.userId,
        content: "Comment 2",
      });
    });

    const comments = await asUser.query(apiAny.comments.listByEntity, {
      entityType: "risk",
      entityId: "entity-123",
    });
    expect(comments).toHaveLength(2);
    expect(comments[0].authorName).toBe("User One");
  });

  test("returns empty for no comments", async () => {
    const t = convexTest(schema, modules);
    await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const comments = await asUser.query(apiAny.comments.listByEntity, {
      entityType: "task",
      entityId: "nonexistent-entity",
    });
    expect(comments).toHaveLength(0);
  });
});

// ── remove ───────────────────────────────────────────────────────────

describe("comments.remove", () => {
  test("deletes own comment", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const commentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("comments", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "requirement",
        entityId: "entity-123",
        authorId: data.userId,
        content: "My comment",
      });
    });

    await asUser.mutation(apiAny.comments.remove, { commentId });

    const comment = await t.run(async (ctx: any) => await ctx.db.get(commentId));
    expect(comment).toBeNull();
  });

  test("rejects deleting another user's comment", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    // Create a second user in org-1
    const _user3Id = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-3",
        email: "user3@example.com",
        name: "User Three",
        orgIds: ["org-1"],
        role: "developer",
      });
    });

    const commentId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("comments", {
        orgId: "org-1",
        programId: data.programId,
        entityType: "requirement",
        entityId: "entity-123",
        authorId: data.userId,
        content: "User One's comment",
      });
    });

    const asUser3 = t.withIdentity({ subject: "test-user-3" });

    await expect(asUser3.mutation(apiAny.comments.remove, { commentId })).rejects.toThrow(
      "You can only delete your own comments",
    );
  });
});
