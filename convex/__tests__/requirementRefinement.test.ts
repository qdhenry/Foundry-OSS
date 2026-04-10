import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

import { setupTestEnv } from "./helpers/baseFactory";

/**
 * Helper: insert a refinementSuggestions placeholder (simulates what requestRefinement does).
 */
async function seedSuggestionPlaceholder(
  t: any,
  opts: { orgId: string; requirementId: string; programId: string; status?: string },
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("refinementSuggestions", {
      orgId: opts.orgId,
      requirementId: opts.requirementId,
      programId: opts.programId,
      status: opts.status ?? "processing",
      createdAt: Date.now(),
    });
  });
}

// ── storeRefinementSuggestions ───────────────────────────────────────

describe("requirementRefinement.storeRefinementSuggestions", () => {
  test("patches placeholder with suggestions and status", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId } = await setupTestEnv(t);

    const placeholderId = await seedSuggestionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
    });

    await t.mutation(internalAny.requirementRefinement.storeRefinementSuggestions, {
      placeholderId,
      suggestions: [{ title: "Improved title", rationale: "More specific" }],
      totalTokensUsed: 500,
    });

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(placeholderId);
    });

    expect(record.status).toBe("pending");
    expect(record.suggestions).toHaveLength(1);
    expect(record.totalTokensUsed).toBe(500);
  });
});

// ── markRefinementError ─────────────────────────────────────────────

describe("requirementRefinement.markRefinementError", () => {
  test("sets error status on placeholder", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId } = await setupTestEnv(t);

    const placeholderId = await seedSuggestionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
    });

    await t.mutation(internalAny.requirementRefinement.markRefinementError, {
      placeholderId,
      error: "Claude API timeout",
    });

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(placeholderId);
    });

    expect(record.status).toBe("error");
    expect(record.error).toBe("Claude API timeout");
  });
});

// ── getRefinementSuggestions ────────────────────────────────────────

describe("requirementRefinement.getRefinementSuggestions", () => {
  test("returns the most recent suggestion for a requirement", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, asUser } = await setupTestEnv(t);

    // Insert two suggestions
    await seedSuggestionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "dismissed",
    });

    const secondId = await seedSuggestionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending",
    });

    const result = await asUser.query(apiAny.requirementRefinement.getRefinementSuggestions, {
      requirementId,
    });

    expect(result).not.toBeNull();
    expect(result._id).toBe(secondId);
    expect(result.status).toBe("pending");
  });

  test("returns null when no suggestions exist", async () => {
    const t = convexTest(schema, modules);
    const { requirementId, asUser } = await setupTestEnv(t);

    const result = await asUser.query(apiAny.requirementRefinement.getRefinementSuggestions, {
      requirementId,
    });

    expect(result).toBeNull();
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { requirementId, asOtherUser } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.requirementRefinement.getRefinementSuggestions, {
        requirementId,
      }),
    ).rejects.toThrow();
  });
});

// ── applySuggestion ────────────────────────────────────────────────

describe("requirementRefinement.applySuggestion", () => {
  test("accept updates requirement and marks applied", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, asUser } = await setupTestEnv(t);

    const suggestionId = await seedSuggestionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending",
    });

    await asUser.mutation(apiAny.requirementRefinement.applySuggestion, {
      suggestionId,
      action: "accept",
      updatedTitle: "Better Title",
      updatedDescription: "Better description",
    });

    const suggestion = await t.run(async (ctx: any) => {
      return await ctx.db.get(suggestionId);
    });
    expect(suggestion.status).toBe("applied");

    const requirement = await t.run(async (ctx: any) => {
      return await ctx.db.get(requirementId);
    });
    expect(requirement.title).toBe("Better Title");
    expect(requirement.description).toBe("Better description");
  });

  test("dismiss sets status to dismissed", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, asUser } = await setupTestEnv(t);

    const suggestionId = await seedSuggestionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending",
    });

    await asUser.mutation(apiAny.requirementRefinement.applySuggestion, {
      suggestionId,
      action: "dismiss",
    });

    const suggestion = await t.run(async (ctx: any) => {
      return await ctx.db.get(suggestionId);
    });
    expect(suggestion.status).toBe("dismissed");
  });

  test("split creates new requirements and defers original", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, asUser } = await setupTestEnv(t);

    const suggestionId = await seedSuggestionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending",
    });

    await asUser.mutation(apiAny.requirementRefinement.applySuggestion, {
      suggestionId,
      action: "split",
      splitRequirements: [
        {
          title: "Split Part 1",
          description: "First part",
          priority: "must_have",
          fitGap: "custom_dev",
        },
        {
          title: "Split Part 2",
          description: "Second part",
          priority: "should_have",
          fitGap: "config",
        },
      ],
    });

    // Original requirement deferred
    const original = await t.run(async (ctx: any) => {
      return await ctx.db.get(requirementId);
    });
    expect(original.status).toBe("deferred");

    // Suggestion marked applied
    const suggestion = await t.run(async (ctx: any) => {
      return await ctx.db.get(suggestionId);
    });
    expect(suggestion.status).toBe("applied");

    // New requirements created
    const allReqs = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("requirements")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });
    // Original + 2 new
    expect(allReqs.length).toBeGreaterThanOrEqual(3);
    const splitReqs = allReqs.filter((r: any) => r.title.startsWith("Split Part"));
    expect(splitReqs).toHaveLength(2);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { orgId, programId, requirementId, asOtherUser } = await setupTestEnv(t);

    const suggestionId = await seedSuggestionPlaceholder(t, {
      orgId,
      requirementId,
      programId,
      status: "pending",
    });

    await expect(
      asOtherUser.mutation(apiAny.requirementRefinement.applySuggestion, {
        suggestionId,
        action: "dismiss",
      }),
    ).rejects.toThrow();
  });
});
