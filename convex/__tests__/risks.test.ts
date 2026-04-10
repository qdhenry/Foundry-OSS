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

  const workstreamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-1",
      programId,
      name: "Backend",
      shortCode: "BE",
      status: "on_track",
      sortOrder: 1,
    });
  });

  return { userId, programId, workstreamId };
}

// ── listByProgram ────────────────────────────────────────────────────

describe("risks.listByProgram", () => {
  test("returns risks sorted by severity", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Low Risk",
        severity: "low",
        probability: "unlikely",
        status: "open",
      });
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Critical Risk",
        severity: "critical",
        probability: "very_likely",
        status: "open",
      });
    });

    const risks = await asUser.query(apiAny.risks.listByProgram, {
      programId: data.programId,
    });
    expect(risks).toHaveLength(2);
    expect(risks[0].severity).toBe("critical");
    expect(risks[1].severity).toBe("low");
  });

  test("filters by severity", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "High",
        severity: "high",
        probability: "likely",
        status: "open",
      });
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Low",
        severity: "low",
        probability: "unlikely",
        status: "open",
      });
    });

    const risks = await asUser.query(apiAny.risks.listByProgram, {
      programId: data.programId,
      severity: "high",
    });
    expect(risks).toHaveLength(1);
    expect(risks[0].title).toBe("High");
  });

  test("filters by status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Open Risk",
        severity: "high",
        probability: "likely",
        status: "open",
      });
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Resolved Risk",
        severity: "medium",
        probability: "possible",
        status: "resolved",
      });
    });

    const risks = await asUser.query(apiAny.risks.listByProgram, {
      programId: data.programId,
      status: "resolved",
    });
    expect(risks).toHaveLength(1);
    expect(risks[0].title).toBe("Resolved Risk");
  });

  test("enriches with workstream names", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "WS Risk",
        severity: "high",
        probability: "likely",
        status: "open",
        workstreamIds: [data.workstreamId],
      });
    });

    const risks = await asUser.query(apiAny.risks.listByProgram, {
      programId: data.programId,
    });
    expect(risks[0].resolvedWorkstreams).toHaveLength(1);
    expect(risks[0].resolvedWorkstreams[0].name).toBe("Backend");
  });

  test("enriches with owner name", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Owned Risk",
        severity: "medium",
        probability: "possible",
        status: "open",
        ownerId: data.userId,
      });
    });

    const risks = await asUser.query(apiAny.risks.listByProgram, {
      programId: data.programId,
    });
    expect(risks[0].ownerName).toBe("User One");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.risks.listByProgram, {
        programId: data.programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── get ──────────────────────────────────────────────────────────────

describe("risks.get", () => {
  test("returns risk with enrichment", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const riskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Test Risk",
        severity: "high",
        probability: "likely",
        status: "open",
        ownerId: data.userId,
        workstreamIds: [data.workstreamId],
      });
    });

    const risk = await asUser.query(apiAny.risks.get, { riskId });
    expect(risk.title).toBe("Test Risk");
    expect(risk.ownerName).toBe("User One");
    expect(risk.resolvedWorkstreams).toHaveLength(1);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const riskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Private",
        severity: "high",
        probability: "likely",
        status: "open",
      });
    });

    await expect(asOtherUser.query(apiAny.risks.get, { riskId })).rejects.toThrow("Access denied");
  });
});

// ── create ───────────────────────────────────────────────────────────

describe("risks.create", () => {
  test("creates risk with defaults", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const riskId = await asUser.mutation(apiAny.risks.create, {
      orgId: "org-1",
      programId: data.programId,
      title: "New Risk",
      severity: "critical",
      probability: "very_likely",
    });

    const risk = await t.run(async (ctx: any) => await ctx.db.get(riskId));
    expect(risk.title).toBe("New Risk");
    expect(risk.status).toBe("open");
    expect(risk.severity).toBe("critical");
  });

  test("creates risk with all optional fields", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const riskId = await asUser.mutation(apiAny.risks.create, {
      orgId: "org-1",
      programId: data.programId,
      title: "Full Risk",
      description: "Detailed description",
      severity: "high",
      probability: "likely",
      mitigation: "Mitigation plan",
      ownerId: data.userId,
      workstreamIds: [data.workstreamId],
      status: "mitigating",
    });

    const risk = await t.run(async (ctx: any) => await ctx.db.get(riskId));
    expect(risk.description).toBe("Detailed description");
    expect(risk.mitigation).toBe("Mitigation plan");
    expect(risk.status).toBe("mitigating");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.risks.create, {
        orgId: "org-1",
        programId: data.programId,
        title: "Unauthorized",
        severity: "low",
        probability: "unlikely",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── update ───────────────────────────────────────────────────────────

describe("risks.update", () => {
  test("updates risk fields", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const riskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Original",
        severity: "low",
        probability: "unlikely",
        status: "open",
      });
    });

    await asUser.mutation(apiAny.risks.update, {
      riskId,
      title: "Updated Title",
      severity: "critical",
    });

    const risk = await t.run(async (ctx: any) => await ctx.db.get(riskId));
    expect(risk.title).toBe("Updated Title");
    expect(risk.severity).toBe("critical");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const riskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Private",
        severity: "high",
        probability: "likely",
        status: "open",
      });
    });

    await expect(
      asOtherUser.mutation(apiAny.risks.update, {
        riskId,
        title: "Hacked",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── updateStatus ─────────────────────────────────────────────────────

describe("risks.updateStatus", () => {
  test("changes status", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const riskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Risk",
        severity: "high",
        probability: "likely",
        status: "open",
      });
    });

    await asUser.mutation(apiAny.risks.updateStatus, {
      riskId,
      status: "resolved",
    });

    const risk = await t.run(async (ctx: any) => await ctx.db.get(riskId));
    expect(risk.status).toBe("resolved");
  });
});

// ── remove ───────────────────────────────────────────────────────────

describe("risks.remove", () => {
  test("deletes open risk", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const riskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "To Delete",
        severity: "low",
        probability: "unlikely",
        status: "open",
      });
    });

    await asUser.mutation(apiAny.risks.remove, { riskId });

    const risk = await t.run(async (ctx: any) => await ctx.db.get(riskId));
    expect(risk).toBeNull();
  });

  test("rejects deletion of non-open risks", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const riskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Resolved",
        severity: "low",
        probability: "unlikely",
        status: "resolved",
      });
    });

    await expect(asUser.mutation(apiAny.risks.remove, { riskId })).rejects.toThrow(
      "Only risks with status 'open' can be deleted",
    );
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const riskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("risks", {
        orgId: "org-1",
        programId: data.programId,
        title: "Private",
        severity: "low",
        probability: "unlikely",
        status: "open",
      });
    });

    await expect(asOtherUser.mutation(apiAny.risks.remove, { riskId })).rejects.toThrow(
      "Access denied",
    );
  });
});

// ── createFromAIGeneration (internal) ────────────────────────────────

describe("risks.createFromAIGeneration (internal)", () => {
  test("creates risk without auth", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    const riskId = await t.mutation(internalAny.risks.createFromAIGeneration, {
      programId: data.programId,
      orgId: "org-1",
      title: "AI Risk",
      description: "AI-generated risk",
      severity: "high",
      probability: "likely",
      mitigationSuggestions: ["Step 1", "Step 2"],
      sourceChangeType: "requirement_change",
    });

    const risk = await t.run(async (ctx: any) => await ctx.db.get(riskId));
    expect(risk.title).toBe("AI Risk");
    expect(risk.mitigation).toBe("- Step 1\n- Step 2");
    expect(risk.status).toBe("open");
  });
});
