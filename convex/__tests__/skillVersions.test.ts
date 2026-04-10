import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: insert a skill and one or more versions.
 */
async function insertSkillWithVersions(
  t: any,
  programId: string,
  userId: string,
  versionCount = 1,
) {
  const skillId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("skills", {
      orgId: "org-1",
      programId,
      name: "Test Skill",
      domain: "backend",
      targetPlatform: "salesforce_b2b",
      currentVersion: `${versionCount}.0`,
      content: "Skill content",
      lineCount: 10,
      status: "active",
    });
  });

  const versionIds: string[] = [];
  for (let i = 1; i <= versionCount; i++) {
    const vId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skillVersions", {
        orgId: "org-1",
        skillId,
        version: `${i}.0`,
        content: `Content version ${i}`,
        lineCount: 10 + i,
        authorId: userId,
        message: `Version ${i} commit`,
      });
    });
    versionIds.push(vId);
  }

  return { skillId, versionIds };
}

// ── listBySkill ─────────────────────────────────────────────────────

describe("skillVersions.listBySkill", () => {
  test("returns versions newest first", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    const { skillId } = await insertSkillWithVersions(t, programId, userId, 3);

    const versions = await asUser.query(apiAny.skillVersions.listBySkill, {
      skillId,
    });

    expect(versions).toHaveLength(3);
    // Newest first (reversed creation order)
    expect(versions[0].version).toBe("3.0");
    expect(versions[2].version).toBe("1.0");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId, userId } = await setupTestEnv(t);

    const { skillId } = await insertSkillWithVersions(t, programId, userId);

    await expect(
      asOtherUser.query(apiAny.skillVersions.listBySkill, { skillId }),
    ).rejects.toThrow();
  });
});

// ── get ─────────────────────────────────────────────────────────────

describe("skillVersions.get", () => {
  test("returns a specific version", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    const { versionIds } = await insertSkillWithVersions(t, programId, userId, 2);

    const version = await asUser.query(apiAny.skillVersions.get, {
      versionId: versionIds[0],
    });

    expect(version.version).toBe("1.0");
    expect(version.content).toBe("Content version 1");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId, userId } = await setupTestEnv(t);

    const { versionIds } = await insertSkillWithVersions(t, programId, userId);

    await expect(
      asOtherUser.query(apiAny.skillVersions.get, {
        versionId: versionIds[0],
      }),
    ).rejects.toThrow();
  });
});

// ── compare ─────────────────────────────────────────────────────────

describe("skillVersions.compare", () => {
  test("returns both versions for comparison", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    const { versionIds } = await insertSkillWithVersions(t, programId, userId, 2);

    const result = await asUser.query(apiAny.skillVersions.compare, {
      versionAId: versionIds[0],
      versionBId: versionIds[1],
    });

    expect(result.versionA.version).toBe("1.0");
    expect(result.versionB.version).toBe("2.0");
  });

  test("throws when comparing versions from different skills", async () => {
    const t = convexTest(schema, modules);
    const { asUser, programId, userId } = await setupTestEnv(t);

    const { versionIds: v1 } = await insertSkillWithVersions(t, programId, userId);

    // Create a second skill with its own version
    const skill2Id = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skills", {
        orgId: "org-1",
        programId,
        name: "Other Skill",
        domain: "frontend",
        targetPlatform: "salesforce_b2b",
        currentVersion: "1.0",
        content: "Other content",
        lineCount: 5,
        status: "active",
      });
    });

    const v2Id = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skillVersions", {
        orgId: "org-1",
        skillId: skill2Id,
        version: "1.0",
        content: "Other version",
        lineCount: 5,
        authorId: userId,
      });
    });

    await expect(
      asUser.query(apiAny.skillVersions.compare, {
        versionAId: v1[0],
        versionBId: v2Id,
      }),
    ).rejects.toThrow("Versions must belong to the same skill");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, programId, userId } = await setupTestEnv(t);

    const { versionIds } = await insertSkillWithVersions(t, programId, userId, 2);

    await expect(
      asOtherUser.query(apiAny.skillVersions.compare, {
        versionAId: versionIds[0],
        versionBId: versionIds[1],
      }),
    ).rejects.toThrow();
  });
});
