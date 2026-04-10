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

  return { userId, otherUserId };
}

// ── create (internal) ────────────────────────────────────────────────

describe("notifications.create (internal)", () => {
  test("creates a notification", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    const notifId = await t.mutation(internalAny.notifications.create, {
      orgId: "org-1",
      userId: data.userId,
      type: "sandbox_complete",
      title: "Sandbox Done",
      body: "Your sandbox execution completed",
    });

    const notif = await t.run(async (ctx: any) => await ctx.db.get(notifId));
    expect(notif.title).toBe("Sandbox Done");
    expect(notif.read).toBe(false);
    expect(notif.type).toBe("sandbox_complete");
  });

  test("rejects if recipient not in org", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await expect(
      t.mutation(internalAny.notifications.create, {
        orgId: "org-1",
        userId: data.otherUserId,
        type: "sandbox_complete",
        title: "Test",
        body: "Test body",
      }),
    ).rejects.toThrow("Recipient does not belong to this organization");
  });
});

// ── listUnread ───────────────────────────────────────────────────────

describe("notifications.listUnread", () => {
  test("returns unread notifications", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await (ctx.db as any).insert("notifications", {
        orgId: "org-1",
        userId: data.userId,
        type: "sandbox_complete",
        title: "Notif 1",
        body: "Body 1",
        read: false,
        createdAt: Date.now() - 1000,
      });
      await (ctx.db as any).insert("notifications", {
        orgId: "org-1",
        userId: data.userId,
        type: "pr_ready",
        title: "Notif 2",
        body: "Body 2",
        read: true,
        createdAt: Date.now(),
      });
    });

    const notifs = await asUser.query(apiAny.notifications.listUnread, {});
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe("Notif 1");
  });
});

// ── listRecent ───────────────────────────────────────────────────────

describe("notifications.listRecent", () => {
  test("returns both unread and read notifications", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await (ctx.db as any).insert("notifications", {
        orgId: "org-1",
        userId: data.userId,
        type: "sandbox_complete",
        title: "Unread",
        body: "Body",
        read: false,
        createdAt: Date.now(),
      });
      await (ctx.db as any).insert("notifications", {
        orgId: "org-1",
        userId: data.userId,
        type: "pr_ready",
        title: "Read",
        body: "Body",
        read: true,
        createdAt: Date.now() - 1000,
      });
    });

    const notifs = await asUser.query(apiAny.notifications.listRecent, {});
    expect(notifs).toHaveLength(2);
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      for (let i = 0; i < 5; i++) {
        await (ctx.db as any).insert("notifications", {
          orgId: "org-1",
          userId: data.userId,
          type: "sandbox_complete",
          title: `Notif ${i}`,
          body: "Body",
          read: false,
          createdAt: Date.now() - i * 1000,
        });
      }
    });

    const notifs = await asUser.query(apiAny.notifications.listRecent, {
      limit: 3,
    });
    expect(notifs).toHaveLength(3);
  });
});

// ── markRead ─────────────────────────────────────────────────────────

describe("notifications.markRead", () => {
  test("marks a notification as read", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const notifId = await t.run(async (ctx: any) => {
      return await (ctx.db as any).insert("notifications", {
        orgId: "org-1",
        userId: data.userId,
        type: "sandbox_complete",
        title: "Test",
        body: "Body",
        read: false,
        createdAt: Date.now(),
      });
    });

    await asUser.mutation(apiAny.notifications.markRead, {
      notificationId: notifId,
    });

    const notif = await t.run(async (ctx: any) => await ctx.db.get(notifId));
    expect(notif.read).toBe(true);
  });

  test("rejects if notification belongs to another user", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const notifId = await t.run(async (ctx: any) => {
      return await (ctx.db as any).insert("notifications", {
        orgId: "org-2",
        userId: data.otherUserId,
        type: "sandbox_complete",
        title: "Other's notif",
        body: "Body",
        read: false,
        createdAt: Date.now(),
      });
    });

    await expect(
      asUser.mutation(apiAny.notifications.markRead, {
        notificationId: notifId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── markAllRead ──────────────────────────────────────────────────────

describe("notifications.markAllRead", () => {
  test("marks all unread notifications as read", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      for (let i = 0; i < 3; i++) {
        await (ctx.db as any).insert("notifications", {
          orgId: "org-1",
          userId: data.userId,
          type: "sandbox_complete",
          title: `Notif ${i}`,
          body: "Body",
          read: false,
          createdAt: Date.now() - i * 1000,
        });
      }
    });

    const result = await asUser.mutation(apiAny.notifications.markAllRead, {});
    expect(result.updated).toBe(3);

    const unread = await asUser.query(apiAny.notifications.listUnread, {});
    expect(unread).toHaveLength(0);
  });
});
