import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { setupTestEnv } from "./helpers/baseFactory";

// ── upsert ──────────────────────────────────────────────────────────

describe("presence.upsert", () => {
  test("creates a new presence entry", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    const result = await asUser.mutation(apiAny.presence.upsert, {
      programId,
      page: "tasks",
    });

    expect(result.presenceId).toBeTruthy();
    expect(result.lastSeenAt).toBeGreaterThan(0);
    expect(result.expiresAt).toBeGreaterThan(result.lastSeenAt);
  });

  test("updates existing presence entry on second call", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId } = await setupTestEnv(t);

    const first = await asUser.mutation(apiAny.presence.upsert, {
      programId,
      page: "tasks",
    });

    const second = await asUser.mutation(apiAny.presence.upsert, {
      programId,
      page: "tasks",
    });

    // Should reuse the same presence record
    expect(second.presenceId).toBe(first.presenceId);
    expect(second.lastSeenAt).toBeGreaterThanOrEqual(first.lastSeenAt);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    await expect(
      asOtherUser.mutation(apiAny.presence.upsert, {
        programId,
        page: "tasks",
      }),
    ).rejects.toThrow();
  });
});

// ── listByPage ──────────────────────────────────────────────────────

describe("presence.listByPage", () => {
  test("returns active users on a page", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    // Create a fresh presence entry
    await asUser.mutation(apiAny.presence.upsert, {
      programId,
      page: "discovery",
    });

    const entries = await asUser.query(apiAny.presence.listByPage, {
      programId,
      page: "discovery",
    });

    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].userName).toBe("User One");
  });

  test("does not return stale presence entries", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    // Insert a stale presence entry (60 seconds old)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("presence", {
        orgId: "org-1",
        programId,
        page: "skills",
        userId,
        userName: "User One",
        lastSeenAt: Date.now() - 60000, // 60 seconds ago, beyond 30s freshness
      });
    });

    const entries = await asUser.query(apiAny.presence.listByPage, {
      programId,
      page: "skills",
    });

    expect(entries).toHaveLength(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.presence.listByPage, {
        programId,
        page: "tasks",
      }),
    ).rejects.toThrow();
  });
});
