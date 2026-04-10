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
      sourcePlatform: "none",
      targetPlatform: "none",
      phase: "build",
      status: "active",
    });
  });

  return { userId, programId };
}

// ── create ───────────────────────────────────────────────────────────

describe("integrations.create", () => {
  test("creates an integration with defaults", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const integrationId = await asUser.mutation(apiAny.integrations.create, {
      orgId: "org-1",
      programId: data.programId,
      name: "Product API",
      type: "api",
      sourceSystem: "Magento",
      targetSystem: "Salesforce",
    });

    const integration = await t.run(async (ctx: any) => await ctx.db.get(integrationId));
    expect(integration.name).toBe("Product API");
    expect(integration.status).toBe("planned");
    expect(integration.type).toBe("api");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.integrations.create, {
        orgId: "org-1",
        programId: data.programId,
        name: "Bad Integration",
        type: "api",
        sourceSystem: "A",
        targetSystem: "B",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── listByProgram ────────────────────────────────────────────────────

describe("integrations.listByProgram", () => {
  test("returns integrations sorted by name", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("integrations", {
        orgId: "org-1",
        programId: data.programId,
        name: "Zebra API",
        type: "api",
        sourceSystem: "A",
        targetSystem: "B",
        status: "planned",
      });
      await ctx.db.insert("integrations", {
        orgId: "org-1",
        programId: data.programId,
        name: "Alpha Webhook",
        type: "webhook",
        sourceSystem: "C",
        targetSystem: "D",
        status: "live",
      });
    });

    const integrations = await asUser.query(apiAny.integrations.listByProgram, {
      programId: data.programId,
    });
    expect(integrations).toHaveLength(2);
    expect(integrations[0].name).toBe("Alpha Webhook");
  });

  test("filters by type", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("integrations", {
        orgId: "org-1",
        programId: data.programId,
        name: "API 1",
        type: "api",
        sourceSystem: "A",
        targetSystem: "B",
        status: "planned",
      });
      await ctx.db.insert("integrations", {
        orgId: "org-1",
        programId: data.programId,
        name: "Webhook 1",
        type: "webhook",
        sourceSystem: "C",
        targetSystem: "D",
        status: "planned",
      });
    });

    const integrations = await asUser.query(apiAny.integrations.listByProgram, {
      programId: data.programId,
      type: "api",
    });
    expect(integrations).toHaveLength(1);
    expect(integrations[0].name).toBe("API 1");
  });
});

// ── updateStatus ─────────────────────────────────────────────────────

describe("integrations.updateStatus", () => {
  test("updates integration status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const integrationId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("integrations", {
        orgId: "org-1",
        programId: data.programId,
        name: "API 1",
        type: "api",
        sourceSystem: "A",
        targetSystem: "B",
        status: "planned",
      });
    });

    await asUser.mutation(apiAny.integrations.updateStatus, {
      integrationId,
      status: "in_progress",
    });

    const integration = await t.run(async (ctx: any) => await ctx.db.get(integrationId));
    expect(integration.status).toBe("in_progress");
  });
});

// ── linkRequirement / unlinkRequirement ──────────────────────────────

describe("integrations.linkRequirement", () => {
  test("links a requirement", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const integrationId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("integrations", {
        orgId: "org-1",
        programId: data.programId,
        name: "API 1",
        type: "api",
        sourceSystem: "A",
        targetSystem: "B",
        status: "planned",
      });
    });

    const requirementId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Req 1",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
      });
    });

    await asUser.mutation(apiAny.integrations.linkRequirement, {
      integrationId,
      requirementId,
    });

    const integration = await t.run(async (ctx: any) => await ctx.db.get(integrationId));
    expect(integration.requirementIds).toContainEqual(requirementId);
  });
});

// ── remove ───────────────────────────────────────────────────────────

describe("integrations.remove", () => {
  test("removes a planned integration", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const integrationId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("integrations", {
        orgId: "org-1",
        programId: data.programId,
        name: "API 1",
        type: "api",
        sourceSystem: "A",
        targetSystem: "B",
        status: "planned",
      });
    });

    await asUser.mutation(apiAny.integrations.remove, { integrationId });

    const integration = await t.run(async (ctx: any) => await ctx.db.get(integrationId));
    expect(integration).toBeNull();
  });

  test("rejects removing non-planned integration", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const integrationId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("integrations", {
        orgId: "org-1",
        programId: data.programId,
        name: "API 1",
        type: "api",
        sourceSystem: "A",
        targetSystem: "B",
        status: "live",
      });
    });

    await expect(asUser.mutation(apiAny.integrations.remove, { integrationId })).rejects.toThrow(
      "Only integrations with 'planned' status",
    );
  });
});
