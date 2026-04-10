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

// ── listByProgram ────────────────────────────────────────────────────

describe("skills.listByProgram", () => {
  test("returns skills sorted by domain then name", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Backend Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# Backend",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [],
      });
      await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Architecture Skill",
        domain: "architecture",
        targetPlatform: "salesforce_b2b",
        content: "# Architecture",
        lineCount: 1,
        currentVersion: "v1",
        status: "draft",
        linkedRequirements: [],
      });
    });

    const skills = await asUser.query(apiAny.skills.listByProgram, {
      programId: data.programId,
    });
    expect(skills).toHaveLength(2);
    expect(skills[0].domain).toBe("architecture");
    expect(skills[1].domain).toBe("backend");
  });

  test("filters by domain", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Backend Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# Backend",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [],
      });
      await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Frontend Skill",
        domain: "frontend",
        targetPlatform: "salesforce_b2b",
        content: "# Frontend",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [],
      });
    });

    const skills = await asUser.query(apiAny.skills.listByProgram, {
      programId: data.programId,
      domain: "backend",
    });
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("Backend Skill");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.query(apiAny.skills.listByProgram, {
        programId: data.programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── get ──────────────────────────────────────────────────────────────

describe("skills.get", () => {
  test("returns skill with resolved requirements", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Linked Req",
        priority: "must_have",
        fitGap: "native",
        status: "approved",
      });
    });

    const skillId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Test Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# Test",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [reqId],
      });
    });

    const skill = await asUser.query(apiAny.skills.get, { skillId });
    expect(skill.name).toBe("Test Skill");
    expect(skill.resolvedRequirements).toHaveLength(1);
    expect(skill.resolvedRequirements[0].title).toBe("Linked Req");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    const skillId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Private Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# Private",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [],
      });
    });

    await expect(asOtherUser.query(apiAny.skills.get, { skillId })).rejects.toThrow(
      "Access denied",
    );
  });
});

// ── create ───────────────────────────────────────────────────────────

describe("skills.create", () => {
  test("creates skill with initial version", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const skillId = await asUser.mutation(apiAny.skills.create, {
      orgId: "org-1",
      programId: data.programId,
      name: "New Skill",
      domain: "backend",
      targetPlatform: "salesforce_b2b",
      content: "# Skill Content\nline 2\nline 3",
    });

    const skill = await t.run(async (ctx: any) => await ctx.db.get(skillId));
    expect(skill.name).toBe("New Skill");
    expect(skill.currentVersion).toBe("v1");
    expect(skill.status).toBe("draft");
    expect(skill.lineCount).toBe(3);
    expect(skill.linkedRequirements).toEqual([]);

    const versions = await t.run(
      async (ctx: any) =>
        await ctx.db
          .query("skillVersions")
          .withIndex("by_skill", (q: any) => q.eq("skillId", skillId))
          .collect(),
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe("v1");
    expect(versions[0].message).toBe("Initial version");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.skills.create, {
        orgId: "org-1",
        programId: data.programId,
        name: "Unauthorized",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# test",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── update ───────────────────────────────────────────────────────────

describe("skills.update", () => {
  test("updates skill metadata", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const skillId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Original",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# Test",
        lineCount: 1,
        currentVersion: "v1",
        status: "draft",
        linkedRequirements: [],
      });
    });

    await asUser.mutation(apiAny.skills.update, {
      skillId,
      name: "Updated Skill",
      status: "active",
    });

    const skill = await t.run(async (ctx: any) => await ctx.db.get(skillId));
    expect(skill.name).toBe("Updated Skill");
    expect(skill.status).toBe("active");
  });
});

// ── updateContent ────────────────────────────────────────────────────

describe("skills.updateContent", () => {
  test("creates new version on content update", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const skillId = await t.run(async (ctx: any) => {
      const id = await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Versioned Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# v1",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [],
      });
      await ctx.db.insert("skillVersions", {
        orgId: "org-1",
        skillId: id,
        version: "v1",
        content: "# v1",
        lineCount: 1,
        authorId: data.userId,
        message: "Initial",
      });
      return id;
    });

    await asUser.mutation(apiAny.skills.updateContent, {
      skillId,
      content: "# v2\nUpdated content",
      message: "Updated content",
    });

    const skill = await t.run(async (ctx: any) => await ctx.db.get(skillId));
    expect(skill.currentVersion).toBe("v2");
    expect(skill.lineCount).toBe(2);
    expect(skill.content).toBe("# v2\nUpdated content");

    const versions = await t.run(
      async (ctx: any) =>
        await ctx.db
          .query("skillVersions")
          .withIndex("by_skill", (q: any) => q.eq("skillId", skillId))
          .collect(),
    );
    expect(versions).toHaveLength(2);
  });
});

// ── linkRequirement / unlinkRequirement ──────────────────────────────

describe("skills.linkRequirement", () => {
  test("links a requirement to a skill", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Req",
        priority: "must_have",
        fitGap: "native",
        status: "approved",
      });
    });

    const skillId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# Test",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [],
      });
    });

    await asUser.mutation(apiAny.skills.linkRequirement, {
      skillId,
      requirementId: reqId,
    });

    const skill = await t.run(async (ctx: any) => await ctx.db.get(skillId));
    expect(skill.linkedRequirements).toContain(reqId);
  });

  test("rejects cross-program linking", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const otherProgramId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Other",
        clientName: "Client",
        sourcePlatform: "none",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
      });
    });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: otherProgramId,
        refId: "REQ-001",
        title: "Other Req",
        priority: "must_have",
        fitGap: "native",
        status: "approved",
      });
    });

    const skillId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# Test",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [],
      });
    });

    await expect(
      asUser.mutation(apiAny.skills.linkRequirement, {
        skillId,
        requirementId: reqId,
      }),
    ).rejects.toThrow("Skill and requirement must be in the same program");
  });
});

describe("skills.unlinkRequirement", () => {
  test("unlinks a requirement", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const reqId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId: data.programId,
        refId: "REQ-001",
        title: "Req",
        priority: "must_have",
        fitGap: "native",
        status: "approved",
      });
    });

    const skillId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# Test",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [reqId],
      });
    });

    await asUser.mutation(apiAny.skills.unlinkRequirement, {
      skillId,
      requirementId: reqId,
    });

    const skill = await t.run(async (ctx: any) => await ctx.db.get(skillId));
    expect(skill.linkedRequirements).toHaveLength(0);
  });
});

// ── getActiveByProgram (internal) ────────────────────────────────────

describe("skills.getActiveByProgram (internal)", () => {
  test("returns only active skills", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Active Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        content: "# Active",
        lineCount: 1,
        currentVersion: "v1",
        status: "active",
        linkedRequirements: [],
      });
      await ctx.db.insert("skills", {
        orgId: "org-1",
        programId: data.programId,
        name: "Draft Skill",
        domain: "frontend",
        targetPlatform: "salesforce_b2b",
        content: "# Draft",
        lineCount: 1,
        currentVersion: "v1",
        status: "draft",
        linkedRequirements: [],
      });
    });

    const skills = await t.query(internalAny.skills.getActiveByProgram, {
      programId: data.programId,
    });
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("Active Skill");
  });
});
