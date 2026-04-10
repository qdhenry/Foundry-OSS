import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const _internalAny: any = (generatedApi as any).internal;

import schema from "../../schema";
import { modules } from "../../test.helpers";

/**
 * Integration tests for the full data model hierarchy:
 * Organization → Program → Workstreams → Requirements ↔ Skills
 *
 * Tests cross-entity relationships, cascade behavior, and referential integrity.
 */

// ── Full Hierarchy Setup ────────────────────────────────────────────

async function seedFullHierarchy(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "hierarchy-user",
      email: "hierarchy@example.com",
      name: "Hierarchy User",
      orgIds: ["org-h"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-h",
      name: "Full Hierarchy Program",
      clientName: "Hierarchy Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  const wsBackend = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-h",
      programId,
      name: "Backend",
      shortCode: "BE",
      status: "on_track",
      sortOrder: 1,
    });
  });

  const wsFrontend = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-h",
      programId,
      name: "Frontend",
      shortCode: "FE",
      status: "on_track",
      sortOrder: 2,
    });
  });

  const req1 = await t.run(async (ctx: any) => {
    return await ctx.db.insert("requirements", {
      orgId: "org-h",
      programId,
      workstreamId: wsBackend,
      refId: "REQ-001",
      title: "API Authentication",
      priority: "must_have",
      fitGap: "custom_dev",
      status: "approved",
    });
  });

  const req2 = await t.run(async (ctx: any) => {
    return await ctx.db.insert("requirements", {
      orgId: "org-h",
      programId,
      workstreamId: wsBackend,
      refId: "REQ-002",
      title: "Data Validation",
      priority: "should_have",
      fitGap: "config",
      status: "approved",
    });
  });

  const req3 = await t.run(async (ctx: any) => {
    return await ctx.db.insert("requirements", {
      orgId: "org-h",
      programId,
      workstreamId: wsFrontend,
      refId: "REQ-003",
      title: "Product Page UI",
      priority: "must_have",
      fitGap: "custom_dev",
      status: "draft",
    });
  });

  const skill1 = await t.run(async (ctx: any) => {
    return await ctx.db.insert("skills", {
      orgId: "org-h",
      programId,
      name: "Auth Skill",
      domain: "backend",
      targetPlatform: "salesforce_b2b",
      currentVersion: "1.0.0",
      content: "Authentication implementation instructions",
      lineCount: 10,
      linkedRequirements: [req1, req2],
      status: "active",
    });
  });

  const skill2 = await t.run(async (ctx: any) => {
    return await ctx.db.insert("skills", {
      orgId: "org-h",
      programId,
      name: "UI Skill",
      domain: "frontend",
      targetPlatform: "salesforce_b2b",
      currentVersion: "1.0.0",
      content: "Frontend implementation instructions",
      lineCount: 5,
      linkedRequirements: [req3],
      status: "active",
    });
  });

  return {
    userId,
    programId,
    wsBackend,
    wsFrontend,
    req1,
    req2,
    req3,
    skill1,
    skill2,
    orgId: "org-h",
  };
}

// ── Organization → Program ──────────────────────────────────────────

describe("data-relationships: org → program", () => {
  test("programs are scoped to organization", async () => {
    const t = convexTest(schema, modules);
    await seedFullHierarchy(t);

    // Create program in different org
    await t.run(async (ctx: any) => {
      await ctx.db.insert("programs", {
        orgId: "org-other",
        name: "Other Org Program",
        clientName: "Other Client",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
      });
    });

    const orgHPrograms = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("programs")
        .withIndex("by_org", (q: any) => q.eq("orgId", "org-h"))
        .collect();
    });

    expect(orgHPrograms).toHaveLength(1);
    expect(orgHPrograms[0].name).toBe("Full Hierarchy Program");
  });
});

// ── Program → Workstreams ───────────────────────────────────────────

describe("data-relationships: program → workstreams", () => {
  test("workstreams are scoped to program", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    const workstreams = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("workstreams")
        .withIndex("by_program", (q: any) => q.eq("programId", h.programId))
        .collect();
    });

    expect(workstreams).toHaveLength(2);
    expect(workstreams.map((ws: any) => ws.shortCode).sort()).toEqual(["BE", "FE"]);
  });
});

// ── Workstream → Requirements ───────────────────────────────────────

describe("data-relationships: workstream → requirements", () => {
  test("requirements are filterable by workstream", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    const backendReqs = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("requirements")
        .withIndex("by_workstream", (q: any) => q.eq("workstreamId", h.wsBackend))
        .collect();
    });

    expect(backendReqs).toHaveLength(2);
    expect(backendReqs.map((r: any) => r.refId).sort()).toEqual(["REQ-001", "REQ-002"]);

    const frontendReqs = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("requirements")
        .withIndex("by_workstream", (q: any) => q.eq("workstreamId", h.wsFrontend))
        .collect();
    });

    expect(frontendReqs).toHaveLength(1);
    expect(frontendReqs[0].refId).toBe("REQ-003");
  });
});

// ── Requirements ↔ Skills ───────────────────────────────────────────

describe("data-relationships: requirements ↔ skills", () => {
  test("skills have linked requirements", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    const skill = await t.run(async (ctx: any) => await ctx.db.get(h.skill1));
    expect(skill.linkedRequirements).toHaveLength(2);
    expect(skill.linkedRequirements).toContain(h.req1);
    expect(skill.linkedRequirements).toContain(h.req2);
  });

  test("requirements can be resolved from skill links", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    const skill = await t.run(async (ctx: any) => await ctx.db.get(h.skill1));
    const linkedReqs = await t.run(async (ctx: any) => {
      return await Promise.all(skill.linkedRequirements.map((id: any) => ctx.db.get(id)));
    });

    expect(linkedReqs).toHaveLength(2);
    expect(linkedReqs.map((r: any) => r.refId).sort()).toEqual(["REQ-001", "REQ-002"]);
  });
});

// ── Tasks → Requirements + Workstreams + Sprints ────────────────────

describe("data-relationships: tasks with full enrichment", () => {
  test("task links to workstream, sprint, requirement, and assignee", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    const sprintId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("sprints", {
        orgId: "org-h",
        programId: h.programId,
        workstreamId: h.wsBackend,
        name: "Sprint 1",
        number: 1,
        status: "active",
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("tasks", {
        orgId: "org-h",
        programId: h.programId,
        workstreamId: h.wsBackend,
        sprintId,
        requirementId: h.req1,
        assigneeId: h.userId,
        title: "Implement JWT auth",
        priority: "high",
        status: "in_progress",
      });
    });

    const asUser = t.withIdentity({ subject: "hierarchy-user" });
    const tasks = await asUser.query(apiAny.tasks.listByProgram, {
      programId: h.programId,
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Implement JWT auth");
    expect(tasks[0].workstreamName).toBe("Backend");
    expect(tasks[0].workstreamShortCode).toBe("BE");
    expect(tasks[0].sprintName).toBe("Sprint 1");
    expect(tasks[0].requirementTitle).toBe("API Authentication");
    expect(tasks[0].assigneeName).toBe("Hierarchy User");
  });
});

// ── Cross-Workstream Dependencies ───────────────────────────────────

describe("data-relationships: cross-workstream dependencies", () => {
  test("tracks dependency between workstreams", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    const depId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("workstreamDependencies", {
        orgId: "org-h",
        programId: h.programId,
        sourceWorkstreamId: h.wsFrontend,
        targetWorkstreamId: h.wsBackend,
        description: "Frontend needs backend API ready",
        status: "active",
        dependencyType: "blocks",
        suggestedBy: "ai",
        aiConfidence: 0.85,
        requirementIds: [h.req1],
      });
    });

    const dep = await t.run(async (ctx: any) => await ctx.db.get(depId));
    expect(dep.sourceWorkstreamId).toBe(h.wsFrontend);
    expect(dep.targetWorkstreamId).toBe(h.wsBackend);
    expect(dep.dependencyType).toBe("blocks");
    expect(dep.aiConfidence).toBe(0.85);
  });
});

// ── Skill Versions (Immutable History) ──────────────────────────────

describe("data-relationships: skill versioning", () => {
  test("creates immutable version history for skill", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("skillVersions", {
        orgId: "org-h",
        skillId: h.skill1,
        version: "1.0.0",
        content: "Original auth skill content",
        lineCount: 10,
        authorId: h.userId,
        message: "Initial version",
      });
      await ctx.db.insert("skillVersions", {
        orgId: "org-h",
        skillId: h.skill1,
        version: "1.1.0",
        content: "Updated auth skill with OAuth support",
        lineCount: 15,
        authorId: h.userId,
        message: "Added OAuth 2.0 support",
      });
    });

    const versions = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("skillVersions")
        .withIndex("by_skill", (q: any) => q.eq("skillId", h.skill1))
        .collect();
    });

    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe("1.0.0");
    expect(versions[1].version).toBe("1.1.0");
  });
});

// ── Risks → Program + Workstreams ───────────────────────────────────

describe("data-relationships: risks", () => {
  test("risk links to program and multiple workstreams", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    const riskId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("risks", {
        orgId: "org-h",
        programId: h.programId,
        title: "API rate limiting risk",
        description: "Salesforce API limits may block bulk migration",
        severity: "high",
        probability: "likely",
        mitigation: "Implement batch processing with exponential backoff",
        ownerId: h.userId,
        workstreamIds: [h.wsBackend, h.wsFrontend],
        status: "mitigating",
      });
    });

    const risk = await t.run(async (ctx: any) => await ctx.db.get(riskId));
    expect(risk.workstreamIds).toHaveLength(2);
    expect(risk.severity).toBe("high");
    expect(risk.status).toBe("mitigating");
  });
});

// ── Team Members → Program + User ───────────────────────────────────

describe("data-relationships: team members", () => {
  test("assigns user to program with role and workstream scope", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    const memberId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("teamMembers", {
        orgId: "org-h",
        programId: h.programId,
        userId: h.userId,
        role: "architect",
        workstreamIds: [h.wsBackend],
      });
    });

    const member = await t.run(async (ctx: any) => await ctx.db.get(memberId));
    expect(member.role).toBe("architect");
    expect(member.workstreamIds).toEqual([h.wsBackend]);
  });
});

// ── Audit Log ───────────────────────────────────────────────────────

describe("data-relationships: audit log", () => {
  test("records audit event with entity references", async () => {
    const t = convexTest(schema, modules);
    const h = await seedFullHierarchy(t);

    const auditId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("auditLog", {
        orgId: "org-h",
        programId: h.programId,
        entityType: "requirement",
        entityId: h.req1,
        action: "update",
        userId: h.userId,
        userName: "Hierarchy User",
        description: "Changed status from draft to approved",
        timestamp: Date.now(),
      });
    });

    const entry = await t.run(async (ctx: any) => await ctx.db.get(auditId));
    expect(entry.entityType).toBe("requirement");
    expect(entry.action).toBe("update");
    expect(entry.description).toContain("draft to approved");
  });
});
