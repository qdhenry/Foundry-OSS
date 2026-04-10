import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

import { setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: create a second workstream for dependency testing.
 */
async function seedSecondWorkstream(t: any, opts: { orgId: string; programId: string }) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: opts.orgId,
      programId: opts.programId,
      name: "Frontend Workstream",
      shortCode: "FE",
      status: "on_track",
      sortOrder: 2,
    });
  });
}

// ── suggestDependency ───────────────────────────────────────────────

describe("dependencyDetection.suggestDependency", () => {
  test("creates a suggested dependency between workstreams", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId } = await setupTestEnv(t);
    const targetWorkstreamId = await seedSecondWorkstream(t, { orgId, programId });

    const depId = await t.mutation(internalAny.dependencyDetection.suggestDependency, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId,
      dependencyType: "blocks",
      description: "Backend must be ready before frontend",
      confidence: 0.85,
      reasoning: "Frontend consumes backend API endpoints",
    });

    expect(depId).toBeTruthy();

    const dep = await t.run(async (ctx: any) => {
      return await ctx.db.get(depId);
    });

    expect(dep.status).toBe("suggested");
    expect(dep.suggestedBy).toBe("ai");
    expect(dep.aiConfidence).toBe(0.85);
    expect(dep.dependencyType).toBe("blocks");
  });

  test("rejects self-dependency", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId } = await setupTestEnv(t);

    await expect(
      t.mutation(internalAny.dependencyDetection.suggestDependency, {
        orgId,
        programId,
        sourceWorkstreamId: workstreamId,
        targetWorkstreamId: workstreamId,
        dependencyType: "blocks",
        description: "Self ref",
        confidence: 0.9,
        reasoning: "Test",
      }),
    ).rejects.toThrow("Source and target workstreams must be different");
  });
});

// ── approveDependency ───────────────────────────────────────────────

describe("dependencyDetection.approveDependency", () => {
  test("approves a suggested dependency", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId, asUser } = await setupTestEnv(t);
    const targetWorkstreamId = await seedSecondWorkstream(t, { orgId, programId });

    const depId = await t.mutation(internalAny.dependencyDetection.suggestDependency, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId,
      dependencyType: "enables",
      description: "Backend enables frontend",
      confidence: 0.9,
      reasoning: "API dependency",
    });

    await asUser.mutation(apiAny.dependencyDetection.approveDependency, {
      dependencyId: depId,
    });

    const dep = await t.run(async (ctx: any) => {
      return await ctx.db.get(depId);
    });

    expect(dep.status).toBe("approved");
    expect(dep.approvedBy).toBe("test-user-1");
    expect(dep.approvedAt).toBeTypeOf("number");
  });

  test("rejects approving non-suggested dependency", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId, asUser } = await setupTestEnv(t);
    const targetWorkstreamId = await seedSecondWorkstream(t, { orgId, programId });

    // Create a dependency directly with "active" status
    const depId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("workstreamDependencies", {
        orgId,
        programId,
        sourceWorkstreamId: workstreamId,
        targetWorkstreamId,
        status: "active",
      });
    });

    await expect(
      asUser.mutation(apiAny.dependencyDetection.approveDependency, {
        dependencyId: depId,
      }),
    ).rejects.toThrow("Only suggested dependencies can be approved");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId, asOtherUser } = await setupTestEnv(t);
    const targetWorkstreamId = await seedSecondWorkstream(t, { orgId, programId });

    const depId = await t.mutation(internalAny.dependencyDetection.suggestDependency, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId,
      dependencyType: "blocks",
      description: "Test",
      confidence: 0.8,
      reasoning: "Test",
    });

    await expect(
      asOtherUser.mutation(apiAny.dependencyDetection.approveDependency, {
        dependencyId: depId,
      }),
    ).rejects.toThrow();
  });
});

// ── dismissDependency ───────────────────────────────────────────────

describe("dependencyDetection.dismissDependency", () => {
  test("deletes a suggested dependency", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId, asUser } = await setupTestEnv(t);
    const targetWorkstreamId = await seedSecondWorkstream(t, { orgId, programId });

    const depId = await t.mutation(internalAny.dependencyDetection.suggestDependency, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId,
      dependencyType: "conflicts",
      description: "Conflict test",
      confidence: 0.7,
      reasoning: "Test",
    });

    await asUser.mutation(apiAny.dependencyDetection.dismissDependency, {
      dependencyId: depId,
    });

    const dep = await t.run(async (ctx: any) => {
      return await ctx.db.get(depId);
    });

    expect(dep).toBeNull();
  });
});

// ── getPendingSuggestions ────────────────────────────────────────────

describe("dependencyDetection.getPendingSuggestions", () => {
  test("returns only suggested dependencies sorted by confidence", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId, asUser } = await setupTestEnv(t);
    const targetWorkstreamId = await seedSecondWorkstream(t, { orgId, programId });

    // Create a suggested dependency
    await t.mutation(internalAny.dependencyDetection.suggestDependency, {
      orgId,
      programId,
      sourceWorkstreamId: workstreamId,
      targetWorkstreamId,
      dependencyType: "blocks",
      description: "Low confidence",
      confidence: 0.5,
      reasoning: "Test",
    });

    await t.mutation(internalAny.dependencyDetection.suggestDependency, {
      orgId,
      programId,
      sourceWorkstreamId: targetWorkstreamId,
      targetWorkstreamId: workstreamId,
      dependencyType: "enables",
      description: "High confidence",
      confidence: 0.95,
      reasoning: "Test",
    });

    // Create an active (non-suggested) dependency
    await t.run(async (ctx: any) => {
      await ctx.db.insert("workstreamDependencies", {
        orgId,
        programId,
        sourceWorkstreamId: workstreamId,
        targetWorkstreamId,
        status: "active",
      });
    });

    const suggestions = await asUser.query(apiAny.dependencyDetection.getPendingSuggestions, {
      programId,
    });

    // Only suggested ones
    expect(suggestions).toHaveLength(2);
    // Sorted by confidence desc
    expect(suggestions[0].aiConfidence).toBe(0.95);
    expect(suggestions[1].aiConfidence).toBe(0.5);
    // Enriched with workstream info
    expect(suggestions[0].sourceWorkstream).not.toBeNull();
    expect(suggestions[0].targetWorkstream).not.toBeNull();
  });

  test("returns empty array when no suggestions", async () => {
    const t = convexTest(schema, modules);
    const { programId, asUser } = await setupTestEnv(t);

    const suggestions = await asUser.query(apiAny.dependencyDetection.getPendingSuggestions, {
      programId,
    });

    expect(suggestions).toHaveLength(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { programId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.dependencyDetection.getPendingSuggestions, {
        programId,
      }),
    ).rejects.toThrow();
  });
});

// ── getAllWorkstreamsWithRequirements (internal) ───────────────────

describe("dependencyDetection.getAllWorkstreamsWithRequirements", () => {
  test("returns workstreams enriched with requirements", async () => {
    const t = convexTest(schema, modules);
    const { programId, workstreamId } = await setupTestEnv(t);

    const result = await t.query(
      internalAny.dependencyDetection.getAllWorkstreamsWithRequirements,
      { programId },
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    const ws = result.find((w: any) => w._id === workstreamId);
    expect(ws).toBeTruthy();
    expect(ws.requirements).toBeInstanceOf(Array);
    // The seed creates one requirement
    expect(ws.requirements.length).toBeGreaterThanOrEqual(1);
  });
});

// ── getExistingDependencies (internal) ──────────────────────────────

describe("dependencyDetection.getExistingDependencies", () => {
  test("returns dependencies enriched with workstream names", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, workstreamId } = await setupTestEnv(t);
    const targetWorkstreamId = await seedSecondWorkstream(t, { orgId, programId });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("workstreamDependencies", {
        orgId,
        programId,
        sourceWorkstreamId: workstreamId,
        targetWorkstreamId,
        status: "active",
      });
    });

    const result = await t.query(internalAny.dependencyDetection.getExistingDependencies, {
      programId,
    });

    expect(result).toHaveLength(1);
    expect(result[0].sourceName).toBe("Backend Workstream");
    expect(result[0].targetName).toBe("Frontend Workstream");
  });

  test("returns empty array when no dependencies", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestEnv(t);

    const result = await t.query(internalAny.dependencyDetection.getExistingDependencies, {
      programId,
    });

    expect(result).toHaveLength(0);
  });
});
