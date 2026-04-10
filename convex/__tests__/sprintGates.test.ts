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

// ── create ───────────────────────────────────────────────────────────

describe("sprintGates.create", () => {
  test("creates a gate with criteria", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const gateId = await asUser.mutation(apiAny.sprintGates.create, {
      orgId: "org-1",
      programId: data.programId,
      workstreamId: data.workstreamId,
      name: "Foundation Gate",
      gateType: "foundation",
      criteria: [
        { title: "Schema defined" },
        { title: "API designed", description: "REST API docs ready" },
      ],
    });

    const gate = await t.run(async (ctx: any) => await ctx.db.get(gateId));
    expect(gate.name).toBe("Foundation Gate");
    expect(gate.status).toBe("pending");
    expect(gate.criteria).toHaveLength(2);
    expect(gate.criteria[0].passed).toBe(false);
    expect(gate.approvals).toHaveLength(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.sprintGates.create, {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Bad Gate",
        gateType: "foundation",
        criteria: [{ title: "Test" }],
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── listByProgram ────────────────────────────────────────────────────

describe("sprintGates.listByProgram", () => {
  test("returns gates for a program", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("sprintGates", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Gate 1",
        gateType: "foundation",
        criteria: [{ title: "Test", passed: false }],
        approvals: [],
        status: "pending",
      });
    });

    const gates = await asUser.query(apiAny.sprintGates.listByProgram, {
      programId: data.programId,
    });
    expect(gates).toHaveLength(1);
  });
});

// ── evaluateCriterion ────────────────────────────────────────────────

describe("sprintGates.evaluateCriterion", () => {
  test("marks criterion as passed", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const gateId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprintGates", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Gate 1",
        gateType: "foundation",
        criteria: [
          { title: "Criterion 1", passed: false },
          { title: "Criterion 2", passed: false },
        ],
        approvals: [],
        status: "pending",
      });
    });

    await asUser.mutation(apiAny.sprintGates.evaluateCriterion, {
      gateId,
      criterionIndex: 0,
      passed: true,
      evidence: "Tests passing",
    });

    const gate = await t.run(async (ctx: any) => await ctx.db.get(gateId));
    expect(gate.criteria[0].passed).toBe(true);
    expect(gate.criteria[0].evidence).toBe("Tests passing");
    expect(gate.criteria[1].passed).toBe(false);
  });

  test("rejects out-of-bounds index", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const gateId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprintGates", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Gate 1",
        gateType: "foundation",
        criteria: [{ title: "Only one", passed: false }],
        approvals: [],
        status: "pending",
      });
    });

    await expect(
      asUser.mutation(apiAny.sprintGates.evaluateCriterion, {
        gateId,
        criterionIndex: 5,
        passed: true,
      }),
    ).rejects.toThrow("Criterion index out of bounds");
  });
});

// ── addApproval / updateApproval ─────────────────────────────────────

describe("sprintGates.addApproval", () => {
  test("adds approval entry", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const gateId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprintGates", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Gate 1",
        gateType: "release",
        criteria: [{ title: "Test", passed: true }],
        approvals: [],
        status: "pending",
      });
    });

    await asUser.mutation(apiAny.sprintGates.addApproval, {
      gateId,
      role: "architect",
    });

    const gate = await t.run(async (ctx: any) => await ctx.db.get(gateId));
    expect(gate.approvals).toHaveLength(1);
    expect(gate.approvals[0].role).toBe("architect");
    expect(gate.approvals[0].status).toBe("pending");
  });

  test("rejects duplicate approval", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const gateId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprintGates", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Gate 1",
        gateType: "release",
        criteria: [],
        approvals: [{ userId: data.userId, role: "architect", status: "pending" as const }],
        status: "pending",
      });
    });

    await expect(
      asUser.mutation(apiAny.sprintGates.addApproval, {
        gateId,
        role: "architect",
      }),
    ).rejects.toThrow("User already has an approval entry");
  });
});

// ── finalize ─────────────────────────────────────────────────────────

describe("sprintGates.finalize", () => {
  test("passes gate when all criteria and approvals pass", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const gateId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprintGates", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Gate 1",
        gateType: "foundation",
        criteria: [{ title: "Done", passed: true }],
        approvals: [
          {
            userId: data.userId,
            role: "architect",
            status: "approved" as const,
            timestamp: Date.now(),
          },
        ],
        status: "pending",
      });
    });

    await asUser.mutation(apiAny.sprintGates.finalize, { gateId });

    const gate = await t.run(async (ctx: any) => await ctx.db.get(gateId));
    expect(gate.status).toBe("passed");
    expect(gate.evaluatedAt).toBeDefined();
  });

  test("fails gate when criteria not met", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const gateId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprintGates", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Gate 1",
        gateType: "foundation",
        criteria: [{ title: "Not done", passed: false }],
        approvals: [
          {
            userId: data.userId,
            role: "architect",
            status: "approved" as const,
            timestamp: Date.now(),
          },
        ],
        status: "pending",
      });
    });

    await asUser.mutation(apiAny.sprintGates.finalize, { gateId });

    const gate = await t.run(async (ctx: any) => await ctx.db.get(gateId));
    expect(gate.status).toBe("failed");
  });
});

// ── remove ───────────────────────────────────────────────────────────

describe("sprintGates.remove", () => {
  test("removes a pending gate", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const gateId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprintGates", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Gate 1",
        gateType: "foundation",
        criteria: [],
        approvals: [],
        status: "pending",
      });
    });

    await asUser.mutation(apiAny.sprintGates.remove, { gateId });

    const gate = await t.run(async (ctx: any) => await ctx.db.get(gateId));
    expect(gate).toBeNull();
  });

  test("rejects removing non-pending gate", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const gateId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprintGates", {
        orgId: "org-1",
        programId: data.programId,
        workstreamId: data.workstreamId,
        name: "Gate 1",
        gateType: "foundation",
        criteria: [],
        approvals: [],
        status: "passed",
      });
    });

    await expect(asUser.mutation(apiAny.sprintGates.remove, { gateId })).rejects.toThrow(
      "Can only delete gates with pending status",
    );
  });
});
