import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";

const api: any = (generatedApi as any).api;

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedUser(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "test@test.com",
      name: "Test User",
      orgIds: ["org_test"],
      role: "admin",
    });
  });
}

async function seedProgram(t: any): Promise<string> {
  let programId: string = "";
  await t.run(async (ctx: any) => {
    programId = await ctx.db.insert("programs", {
      orgId: "org_test",
      name: "Test Program",
      clientName: "Acme Corp",
      phase: "discovery",
      status: "active",
      slug: "test-program",
    });
  });
  return programId;
}

// ---------------------------------------------------------------------------
// programs.getNavigationState
// ---------------------------------------------------------------------------

describe("programs.getNavigationState", () => {
  it("returns all zero counts for an empty program", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const programId = await seedProgram(t);

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.programs.getNavigationState, {
      programId,
    });

    expect(result.discoveryPending).toBe(0);
    expect(result.requirementsTotal).toBe(0);
    expect(result.requirementsUnassigned).toBe(0);
    expect(result.workstreamsCount).toBe(0);
    expect(result.sprintsActive).toBe(0);
    expect(result.sprintsPlanning).toBe(0);
    expect(result.tasksTotal).toBe(0);
    expect(result.tasksInProgress).toBe(0);
    expect(result.skillsCount).toBe(0);
    expect(result.risksCount).toBe(0);
    expect(result.gatesCount).toBe(0);
    expect(result.designAssetsTotal).toBe(0);
  });

  it("counts discoveryPending (pending findings only)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const programId = await seedProgram(t);

    // Need a userId for the document uploadedBy
    let userId = "";
    await t.run(async (ctx: any) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", "test-user-1"))
        .first();
      userId = user._id;
    });

    await t.run(async (ctx: any) => {
      // Need a document and analysis for findings
      const docId = await ctx.db.insert("documents", {
        orgId: "org_test",
        programId,
        fileName: "test.pdf",
        fileType: "pdf",
        fileSize: 1000,
        category: "requirements",
        uploadedBy: userId,
      });
      const analysisId = await ctx.db.insert("documentAnalyses", {
        orgId: "org_test",
        programId,
        documentId: docId,
        status: "complete",
        analysisVersion: 1,
      });

      // Pending finding — should be counted
      await ctx.db.insert("discoveryFindings", {
        orgId: "org_test",
        programId,
        analysisId,
        documentId: docId,
        type: "requirement",
        status: "pending",
        data: {},
        confidence: "high",
      });

      // Approved finding — should NOT be counted
      await ctx.db.insert("discoveryFindings", {
        orgId: "org_test",
        programId,
        analysisId,
        documentId: docId,
        type: "risk",
        status: "approved",
        data: {},
        confidence: "medium",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.programs.getNavigationState, {
      programId,
    });

    expect(result.discoveryPending).toBe(1);
  });

  it("counts requirementsTotal and requirementsUnassigned", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const programId = await seedProgram(t);

    await t.run(async (ctx: any) => {
      const wsId = await ctx.db.insert("workstreams", {
        orgId: "org_test",
        programId,
        name: "WS 1",
        shortCode: "WS-1",
        status: "on_track",
        sortOrder: 1,
      });

      // Assigned requirement
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-001",
        title: "Assigned Req",
        priority: "must_have",
        fitGap: "native",
        status: "draft",
        workstreamId: wsId,
      });

      // Unassigned requirements
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-002",
        title: "Unassigned Req 1",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
      await ctx.db.insert("requirements", {
        orgId: "org_test",
        programId,
        refId: "REQ-003",
        title: "Unassigned Req 2",
        priority: "nice_to_have",
        fitGap: "custom_dev",
        status: "approved",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.programs.getNavigationState, {
      programId,
    });

    expect(result.requirementsTotal).toBe(3);
    expect(result.requirementsUnassigned).toBe(2);
  });

  it("counts workstreams, sprints by status, and tasks by status", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const programId = await seedProgram(t);

    await t.run(async (ctx: any) => {
      const ws1 = await ctx.db.insert("workstreams", {
        orgId: "org_test",
        programId,
        name: "WS 1",
        shortCode: "WS-1",
        status: "on_track",
        sortOrder: 1,
      });
      await ctx.db.insert("workstreams", {
        orgId: "org_test",
        programId,
        name: "WS 2",
        shortCode: "WS-2",
        status: "on_track",
        sortOrder: 2,
      });

      // Sprints
      await ctx.db.insert("sprints", {
        orgId: "org_test",
        programId,
        workstreamId: ws1,
        name: "Sprint 1",
        number: 1,
        status: "active",
      });
      await ctx.db.insert("sprints", {
        orgId: "org_test",
        programId,
        workstreamId: ws1,
        name: "Sprint 2",
        number: 2,
        status: "planning",
      });
      await ctx.db.insert("sprints", {
        orgId: "org_test",
        programId,
        workstreamId: ws1,
        name: "Sprint 3",
        number: 3,
        status: "planning",
      });

      // Tasks
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        title: "Task 1",
        priority: "high",
        status: "in_progress",
      });
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        title: "Task 2",
        priority: "medium",
        status: "in_progress",
      });
      await ctx.db.insert("tasks", {
        orgId: "org_test",
        programId,
        title: "Task 3",
        priority: "low",
        status: "backlog",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.programs.getNavigationState, {
      programId,
    });

    expect(result.workstreamsCount).toBe(2);
    expect(result.sprintsActive).toBe(1);
    expect(result.sprintsPlanning).toBe(2);
    expect(result.tasksTotal).toBe(3);
    expect(result.tasksInProgress).toBe(2);
  });

  it("counts skills, risks, and gates", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const programId = await seedProgram(t);

    await t.run(async (ctx: any) => {
      const wsId = await ctx.db.insert("workstreams", {
        orgId: "org_test",
        programId,
        name: "WS 1",
        shortCode: "WS-1",
        status: "on_track",
        sortOrder: 1,
      });

      await ctx.db.insert("skills", {
        orgId: "org_test",
        programId,
        name: "Skill 1",
        domain: "backend",
        targetPlatform: "none",
        currentVersion: "1.0",
        content: "content",
        lineCount: 10,
        status: "active",
      });
      await ctx.db.insert("skills", {
        orgId: "org_test",
        programId,
        name: "Skill 2",
        domain: "frontend",
        targetPlatform: "none",
        currentVersion: "1.0",
        content: "content",
        lineCount: 5,
        status: "draft",
      });

      await ctx.db.insert("risks", {
        orgId: "org_test",
        programId,
        title: "Risk 1",
        severity: "high",
        probability: "likely",
        status: "open",
      });

      await ctx.db.insert("sprintGates", {
        orgId: "org_test",
        programId,
        workstreamId: wsId,
        name: "Gate 1",
        gateType: "foundation",
        criteria: [{ title: "Crit 1", passed: false }],
        approvals: [],
        status: "pending",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    const result = await asUser.query(api.programs.getNavigationState, {
      programId,
    });

    expect(result.skillsCount).toBe(2);
    expect(result.risksCount).toBe(1);
    expect(result.gatesCount).toBe(1);
  });

  it("rejects unauthenticated access", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t);
    const programId = await seedProgram(t);

    await expect(t.query(api.programs.getNavigationState, { programId })).rejects.toThrow();
  });

  it("rejects wrong org access", async () => {
    const t = convexTest(schema, modules);
    // User belongs to org_test
    await seedUser(t);

    // Program belongs to different org
    let programId: string = "";
    await t.run(async (ctx: any) => {
      programId = await ctx.db.insert("programs", {
        orgId: "org_other",
        name: "Other Program",
        clientName: "Other Corp",
        phase: "discovery",
        status: "active",
        slug: "other-program",
      });
    });

    const asUser = t.withIdentity({ subject: "test-user-1" });
    await expect(asUser.query(api.programs.getNavigationState, { programId })).rejects.toThrow();
  });
});
