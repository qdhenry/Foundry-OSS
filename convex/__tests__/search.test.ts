import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { setupTestEnv } from "./helpers/baseFactory";

// ── globalSearch ────────────────────────────────────────────────────

describe("search.globalSearch", () => {
  test("returns empty results for short query (< 2 chars)", async () => {
    const t = convexTest(schema, modules);
    const { asUser, orgId } = await setupTestEnv(t);

    const result = await asUser.query(apiAny.search.globalSearch, {
      orgId,
      query: "a",
    });

    expect(result.requirements).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.risks).toHaveLength(0);
    expect(result.tasks).toHaveLength(0);
  });

  test("finds requirements by title", async () => {
    const t = convexTest(schema, modules);
    const { asUser, orgId, programId, workstreamId } = await setupTestEnv(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId,
        workstreamId,
        refId: "REQ-100",
        title: "Payment Gateway Integration",
        description: "Integrate payment",
        priority: "must_have",
        fitGap: "custom_dev",
        status: "approved",
      });
    });

    const result = await asUser.query(apiAny.search.globalSearch, {
      orgId,
      query: "payment",
    });

    expect(result.requirements.length).toBeGreaterThanOrEqual(1);
    expect(result.requirements[0].title).toBe("Payment Gateway Integration");
  });

  test("finds requirements by refId", async () => {
    const t = convexTest(schema, modules);
    const { asUser, orgId } = await setupTestEnv(t);

    // The default seedFullStack already inserts REQ-001
    const result = await asUser.query(apiAny.search.globalSearch, {
      orgId,
      query: "REQ-001",
    });

    expect(result.requirements.length).toBeGreaterThanOrEqual(1);
  });

  test("finds skills by name", async () => {
    const t = convexTest(schema, modules);
    const { asUser, orgId, programId } = await setupTestEnv(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("skills", {
        orgId: "org-1",
        programId,
        name: "Apex Developer Standards",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        currentVersion: "1.0",
        content: "Apex skill",
        lineCount: 5,
        status: "active",
      });
    });

    const result = await asUser.query(apiAny.search.globalSearch, {
      orgId,
      query: "apex",
    });

    expect(result.skills.length).toBeGreaterThanOrEqual(1);
    expect(result.skills[0].title).toBe("Apex Developer Standards");
  });

  test("finds tasks by title", async () => {
    const t = convexTest(schema, modules);
    const { asUser, orgId, programId } = await setupTestEnv(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org-1",
        programId,
        title: "Implement Checkout Flow",
        priority: "high",
        status: "todo",
      });
    });

    const result = await asUser.query(apiAny.search.globalSearch, {
      orgId,
      query: "checkout",
    });

    expect(result.tasks.length).toBeGreaterThanOrEqual(1);
  });

  test("finds risks by title", async () => {
    const t = convexTest(schema, modules);
    const { asUser, orgId, programId } = await setupTestEnv(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId,
        title: "Governor Limit Breach Risk",
        severity: "high",
        probability: "possible",
        status: "open",
      });
    });

    const result = await asUser.query(apiAny.search.globalSearch, {
      orgId,
      query: "governor",
    });

    expect(result.risks.length).toBeGreaterThanOrEqual(1);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, orgId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.search.globalSearch, {
        orgId,
        query: "test",
      }),
    ).rejects.toThrow();
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const { asUser, orgId, programId, workstreamId } = await setupTestEnv(t);

    // Insert multiple requirements with matching title
    await t.run(async (ctx: any) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("requirements", {
          orgId: "org-1",
          programId,
          workstreamId,
          refId: `SEARCH-${i}`,
          title: `Searchable Item ${i}`,
          description: "",
          priority: "must_have",
          fitGap: "custom_dev",
          status: "approved",
        });
      }
    });

    const result = await asUser.query(apiAny.search.globalSearch, {
      orgId,
      query: "searchable",
      limit: 2,
    });

    expect(result.requirements).toHaveLength(2);
  });
});
