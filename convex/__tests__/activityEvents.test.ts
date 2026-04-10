import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { setupTestEnv } from "./helpers/baseFactory";

// ── create ──────────────────────────────────────────────────────────

describe("activityEvents.create", () => {
  test("creates an activity event", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    const result = await asUser.mutation(apiAny.activityEvents.create, {
      programId,
      page: "discovery",
      eventType: "document_uploaded",
      message: "Uploaded requirements.pdf",
      entityType: "document",
      entityId: "doc-123",
    });

    expect(result.eventId).toBeTruthy();
  });

  test("trims eventType and message", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    const result = await asUser.mutation(apiAny.activityEvents.create, {
      programId,
      eventType: "  test_event  ",
      message: "  A message  ",
    });

    const event = await t.run(async (ctx: any) => ctx.db.get(result.eventId));
    expect(event.eventType).toBe("test_event");
    expect(event.message).toBe("A message");
  });

  test("rejects empty eventType", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    await expect(
      asUser.mutation(apiAny.activityEvents.create, {
        programId,
        eventType: "   ",
        message: "A message",
      }),
    ).rejects.toThrow("eventType is required");
  });

  test("rejects empty message", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    await expect(
      asUser.mutation(apiAny.activityEvents.create, {
        programId,
        eventType: "test_event",
        message: "   ",
      }),
    ).rejects.toThrow("message is required");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    await expect(
      asOtherUser.mutation(apiAny.activityEvents.create, {
        programId,
        eventType: "test_event",
        message: "Blocked",
      }),
    ).rejects.toThrow();
  });
});

// ── listRecent ──────────────────────────────────────────────────────

describe("activityEvents.listRecent", () => {
  test("returns paginated activity events for a program", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    // Insert events directly for controlled timestamps
    await t.run(async (ctx: any) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("activityEvents", {
          orgId: "org-1",
          programId,
          page: "discovery",
          eventType: "test_event",
          message: `Event ${i}`,
          userId,
          userName: "User One",
          createdAt: Date.now() + i,
        });
      }
    });

    const page = await asUser.query(apiAny.activityEvents.listRecent, {
      programId,
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(page.page).toHaveLength(3);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.activityEvents.listRecent, {
        programId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow();
  });
});
