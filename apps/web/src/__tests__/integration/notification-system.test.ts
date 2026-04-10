import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { modules } from "../../../convex/test.helpers";

/**
 * Integration tests for the notification system:
 * - Notification creation (internal mutation)
 * - Unread notification listing
 * - Recent notifications with limit
 * - Mark single notification as read
 * - Mark all notifications as read
 * - Cross-user isolation
 * - Notification types coverage
 */

// ── Helpers ──────────────────────────────────────────────────────────

async function seedNotificationEnv(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "notif-user-1",
      email: "notif@example.com",
      name: "Notification User",
      orgIds: ["org-notif"],
      role: "admin",
    });
  });

  const otherUserId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "notif-user-2",
      email: "other@example.com",
      name: "Other User",
      orgIds: ["org-notif"],
      role: "developer",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-notif",
      name: "Notification Program",
      clientName: "Notif Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  return { userId, otherUserId, programId, orgId: "org-notif" };
}

// ── Notification Creation ───────────────────────────────────────────

describe("notification-system: creation", () => {
  test("creates notification via internal mutation", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    const notifId = await t.mutation(internal.notifications.create, {
      orgId: env.orgId,
      userId: env.userId,
      programId: env.programId,
      type: "sandbox_complete",
      title: "Sandbox session completed",
      body: "Task 'Implement JWT auth' completed with 5 files changed",
      link: "/programs/prog-1/tasks/task-1",
      entityType: "sandboxSession",
      entityId: "session-123",
    });

    const notif = await t.run(async (ctx: any) => await ctx.db.get(notifId));
    expect(notif.type).toBe("sandbox_complete");
    expect(notif.read).toBe(false);
    expect(notif.title).toContain("Sandbox session completed");
    expect(notif.link).toBeDefined();
  });

  test("validates recipient belongs to organization", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    // Create user in different org
    const externalUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "external-user",
        email: "external@example.com",
        name: "External",
        orgIds: ["org-other"],
        role: "developer",
      });
    });

    await expect(
      t.mutation(internal.notifications.create, {
        orgId: env.orgId,
        userId: externalUserId,
        type: "sandbox_complete",
        title: "Test",
        body: "Test",
      }),
    ).rejects.toThrow("Recipient does not belong to this organization");
  });

  test("creates notifications for all sandbox-related types", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    const types = [
      "sandbox_complete",
      "sandbox_failed",
      "pr_ready",
      "review_requested",
      "subtask_completed",
      "subtask_failed",
      "subtask_scope_violation",
      "all_subtasks_complete",
      "subtask_paused",
    ] as const;

    for (const type of types) {
      await t.mutation(internal.notifications.create, {
        orgId: env.orgId,
        userId: env.userId,
        type,
        title: `Notification: ${type}`,
        body: `Body for ${type}`,
      });
    }

    const all = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_org", (q: any) => q.eq("orgId", env.orgId))
        .collect();
    });

    expect(all).toHaveLength(types.length);
  });
});

// ── Listing Notifications ───────────────────────────────────────────

describe("notification-system: listing", () => {
  test("lists unread notifications for authenticated user", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    // Create 3 notifications, mark 1 as read
    await t.mutation(internal.notifications.create, {
      orgId: env.orgId,
      userId: env.userId,
      type: "sandbox_complete",
      title: "Notif 1",
      body: "Body 1",
    });
    await t.mutation(internal.notifications.create, {
      orgId: env.orgId,
      userId: env.userId,
      type: "pr_ready",
      title: "Notif 2",
      body: "Body 2",
    });
    const readNotifId = await t.mutation(internal.notifications.create, {
      orgId: env.orgId,
      userId: env.userId,
      type: "sandbox_failed",
      title: "Notif 3",
      body: "Body 3",
    });

    // Mark one as read directly
    await t.run(async (ctx: any) => {
      await ctx.db.patch(readNotifId, { read: true });
    });

    const asUser = t.withIdentity({ subject: "notif-user-1" });
    const unread = await asUser.query(api.notifications.listUnread, {});
    expect(unread).toHaveLength(2);
  });

  test("lists recent notifications with limit", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    for (let i = 0; i < 5; i++) {
      await t.mutation(internal.notifications.create, {
        orgId: env.orgId,
        userId: env.userId,
        type: "sandbox_complete",
        title: `Notif ${i}`,
        body: `Body ${i}`,
        createdAt: Date.now() + i * 1000,
      });
    }

    const asUser = t.withIdentity({ subject: "notif-user-1" });
    const recent = await asUser.query(api.notifications.listRecent, { limit: 3 });
    expect(recent).toHaveLength(3);
  });
});

// ── Mark as Read ────────────────────────────────────────────────────

describe("notification-system: mark as read", () => {
  test("marks single notification as read", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    const notifId = await t.mutation(internal.notifications.create, {
      orgId: env.orgId,
      userId: env.userId,
      type: "sandbox_complete",
      title: "Read me",
      body: "Please read",
    });

    const asUser = t.withIdentity({ subject: "notif-user-1" });
    await asUser.mutation(api.notifications.markRead, { notificationId: notifId });

    const notif = await t.run(async (ctx: any) => await ctx.db.get(notifId));
    expect(notif.read).toBe(true);
  });

  test("markRead is idempotent", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    const notifId = await t.mutation(internal.notifications.create, {
      orgId: env.orgId,
      userId: env.userId,
      type: "sandbox_complete",
      title: "Read me",
      body: "Body",
    });

    const asUser = t.withIdentity({ subject: "notif-user-1" });
    await asUser.mutation(api.notifications.markRead, { notificationId: notifId });
    await asUser.mutation(api.notifications.markRead, { notificationId: notifId });

    const notif = await t.run(async (ctx: any) => await ctx.db.get(notifId));
    expect(notif.read).toBe(true);
  });

  test("marks all notifications as read", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    for (let i = 0; i < 4; i++) {
      await t.mutation(internal.notifications.create, {
        orgId: env.orgId,
        userId: env.userId,
        type: "sandbox_complete",
        title: `Notif ${i}`,
        body: `Body ${i}`,
      });
    }

    const asUser = t.withIdentity({ subject: "notif-user-1" });
    const result = await asUser.mutation(api.notifications.markAllRead, {});
    expect(result.updated).toBe(4);

    const unread = await asUser.query(api.notifications.listUnread, {});
    expect(unread).toHaveLength(0);
  });
});

// ── Cross-User Isolation ────────────────────────────────────────────

describe("notification-system: cross-user isolation", () => {
  test("users cannot see other users' notifications", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    await t.mutation(internal.notifications.create, {
      orgId: env.orgId,
      userId: env.userId,
      type: "sandbox_complete",
      title: "User 1 notification",
      body: "Body",
    });

    await t.mutation(internal.notifications.create, {
      orgId: env.orgId,
      userId: env.otherUserId,
      type: "pr_ready",
      title: "User 2 notification",
      body: "Body",
    });

    const asUser1 = t.withIdentity({ subject: "notif-user-1" });
    const user1Notifs = await asUser1.query(api.notifications.listUnread, {});
    expect(user1Notifs).toHaveLength(1);
    expect(user1Notifs[0].title).toBe("User 1 notification");

    const asUser2 = t.withIdentity({ subject: "notif-user-2" });
    const user2Notifs = await asUser2.query(api.notifications.listUnread, {});
    expect(user2Notifs).toHaveLength(1);
    expect(user2Notifs[0].title).toBe("User 2 notification");
  });

  test("users cannot mark other users' notifications as read", async () => {
    const t = convexTest(schema, modules);
    const env = await seedNotificationEnv(t);

    const notifId = await t.mutation(internal.notifications.create, {
      orgId: env.orgId,
      userId: env.userId,
      type: "sandbox_complete",
      title: "User 1's notification",
      body: "Body",
    });

    const asUser2 = t.withIdentity({ subject: "notif-user-2" });
    await expect(
      asUser2.mutation(api.notifications.markRead, { notificationId: notifId }),
    ).rejects.toThrow("Access denied");
  });
});
