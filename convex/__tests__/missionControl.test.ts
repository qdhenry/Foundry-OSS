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

  await t.run(async (ctx: any) => {
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
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  return { userId, programId };
}

// ── getDailyDigest ───────────────────────────────────────────────────

describe("missionControl.getDailyDigest", () => {
  test("returns generate source when no cache exists", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Add some data to appear in the digest context
    await t.run(async (ctx: any) => {
      await ctx.db.insert("workstreams", {
        orgId: "org-1",
        programId: data.programId,
        name: "Backend",
        shortCode: "BE",
        status: "on_track",
        sortOrder: 1,
      });
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Req 1",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Risk 1",
        severity: "high",
        probability: "likely",
        status: "open",
      });
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Task 1",
        priority: "high",
        status: "todo",
      });
    });

    const result = await asUser.query(apiAny.missionControl.getDailyDigest, {
      programId: data.programId,
      lastVisitTime: Date.now() - 86400000,
    });

    expect(result.source).toBe("generate");
    expect(result.digest).toBeNull();
    expect(result.context).toBeDefined();
    expect(result.context?.workstreamSummary).toHaveLength(1);
    expect(result.context?.requirementSummary.total).toBe(1);
    expect(result.context?.riskSummary.total).toBe(1);
    expect(result.context?.taskSummary.total).toBe(1);
  });

  test("returns cache source when valid cache exists", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("dailyDigestCache", {
        orgId: "org-1",
        programId: data.programId,
        userId: "test-user-1",
        lastVisitTime: Date.now(),
        digest: "Cached digest content",
        metadata: {
          auditLogsAnalyzed: 10,
          changeCount: 5,
          workstreamsAffected: 2,
          tokensUsed: 500,
        },
        expiresAt: Date.now() + 86400000,
      });
    });

    const result = await asUser.query(apiAny.missionControl.getDailyDigest, {
      programId: data.programId,
      lastVisitTime: Date.now() - 86400000,
    });

    expect(result.source).toBe("cache");
    expect(result.digest).toBe("Cached digest content");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.missionControl.getDailyDigest, {
        programId: data.programId,
        lastVisitTime: Date.now(),
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── cacheDigest (internal) ───────────────────────────────────────────

describe("missionControl.cacheDigest (internal)", () => {
  test("creates a new cache entry", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await t.mutation(internalAny.missionControl.cacheDigest, {
      orgId: "org-1",
      programId: data.programId,
      userId: "test-user-1",
      digest: "AI-generated digest",
      metadata: {
        auditLogsAnalyzed: 20,
        changeCount: 10,
        workstreamsAffected: 3,
        tokensUsed: 1000,
      },
    });

    const cached = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("dailyDigestCache")
        .withIndex("by_program_user", (q: any) =>
          q.eq("programId", data.programId).eq("userId", "test-user-1"),
        )
        .first();
    });

    expect(cached).not.toBeNull();
    expect(cached.digest).toBe("AI-generated digest");
    expect(cached.expiresAt).toBeGreaterThan(Date.now());
  });

  test("replaces existing cache entry", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("dailyDigestCache", {
        orgId: "org-1",
        programId: data.programId,
        userId: "test-user-1",
        lastVisitTime: Date.now(),
        digest: "Old digest",
        metadata: {
          auditLogsAnalyzed: 5,
          changeCount: 2,
          workstreamsAffected: 1,
          tokensUsed: 200,
        },
        expiresAt: Date.now() + 86400000,
      });
    });

    await t.mutation(internalAny.missionControl.cacheDigest, {
      orgId: "org-1",
      programId: data.programId,
      userId: "test-user-1",
      digest: "New digest",
      metadata: {
        auditLogsAnalyzed: 30,
        changeCount: 15,
        workstreamsAffected: 4,
        tokensUsed: 1500,
      },
    });

    const entries = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("dailyDigestCache")
        .withIndex("by_program_user", (q: any) =>
          q.eq("programId", data.programId).eq("userId", "test-user-1"),
        )
        .collect();
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].digest).toBe("New digest");
  });
});
