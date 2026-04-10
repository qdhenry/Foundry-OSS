// @ts-nocheck
import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

/**
 * Anonymized code snippet storage and retrieval.
 *
 * Snippets are shared across all tenants by default.
 * Browsable library with search, upvote, and flag controls.
 */

// ---------------------------------------------------------------------------
// storeSnippet — store an anonymized code snippet (user-facing)
// ---------------------------------------------------------------------------

export const storeSnippet = mutation({
  args: {
    programId: v.id("programs"),
    title: v.string(),
    description: v.string(),
    code: v.string(),
    annotations: v.optional(v.string()),
    requirementCategory: v.string(),
    targetPlatform: v.union(
      v.literal("salesforce_b2b"),
      v.literal("bigcommerce_b2b"),
      v.literal("sitecore"),
      v.literal("wordpress"),
      v.literal("none"),
      v.literal("platform_agnostic"),
    ),
    language: v.string(),
    successRating: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db.insert("codeSnippets", {
      orgId: program.orgId,
      programId: args.programId,
      title: args.title,
      description: args.description,
      code: args.code,
      annotations: args.annotations,
      requirementCategory: args.requirementCategory,
      targetPlatform: args.targetPlatform,
      language: args.language,
      successRating: args.successRating,
      upvotes: 0,
      flagCount: 0,
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// searchSnippets — search the shared snippet library
// ---------------------------------------------------------------------------

export const searchSnippets = query({
  args: {
    targetPlatform: v.optional(
      v.union(
        v.literal("salesforce_b2b"),
        v.literal("bigcommerce_b2b"),
        v.literal("platform_agnostic"),
      ),
    ),
    requirementCategory: v.optional(v.string()),
    language: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxResults = args.limit ?? 20;

    // Use index-driven filtering when possible
    let snippets;
    if (args.targetPlatform) {
      snippets = await ctx.db
        .query("codeSnippets")
        .withIndex("by_platform", (q) => q.eq("targetPlatform", args.targetPlatform!))
        .collect();
    } else if (args.requirementCategory) {
      snippets = await ctx.db
        .query("codeSnippets")
        .withIndex("by_category", (q) => q.eq("requirementCategory", args.requirementCategory!))
        .collect();
    } else {
      snippets = await ctx.db.query("codeSnippets").collect();
    }

    // Apply additional in-memory filters
    let filtered = snippets;

    if (args.targetPlatform && args.requirementCategory) {
      // Platform was used for index; now filter by category
      filtered = filtered.filter((s) => s.requirementCategory === args.requirementCategory);
    }

    if (args.language) {
      filtered = filtered.filter((s) => s.language === args.language);
    }

    // Sort by upvotes (descending), then recency
    filtered.sort((a, b) => {
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      return b.createdAt - a.createdAt;
    });

    return filtered.slice(0, maxResults);
  },
});

// ---------------------------------------------------------------------------
// listSnippets — browse snippets with optional filters (public, auth-checked)
// ---------------------------------------------------------------------------

export const listSnippets = query({
  args: {
    programId: v.id("programs"),
    targetPlatform: v.optional(
      v.union(
        v.literal("salesforce_b2b"),
        v.literal("bigcommerce_b2b"),
        v.literal("platform_agnostic"),
      ),
    ),
    requirementCategory: v.optional(v.string()),
    language: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) return [];
    await assertOrgAccess(ctx, program.orgId);

    const maxResults = args.limit ?? 20;

    // Use index-driven filtering when possible
    let snippets;
    if (args.targetPlatform) {
      snippets = await ctx.db
        .query("codeSnippets")
        .withIndex("by_platform", (q) => q.eq("targetPlatform", args.targetPlatform!))
        .collect();
    } else if (args.requirementCategory) {
      snippets = await ctx.db
        .query("codeSnippets")
        .withIndex("by_category", (q) => q.eq("requirementCategory", args.requirementCategory!))
        .collect();
    } else {
      // Fall back to program-scoped snippets
      snippets = await ctx.db
        .query("codeSnippets")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect();
    }

    // Apply additional in-memory filters
    let filtered = snippets;

    if (args.targetPlatform && args.requirementCategory) {
      filtered = filtered.filter((s) => s.requirementCategory === args.requirementCategory);
    }

    if (args.language) {
      filtered = filtered.filter((s) => s.language === args.language);
    }

    // Sort by upvotes descending, then recency
    filtered.sort((a, b) => {
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      return b.createdAt - a.createdAt;
    });

    return filtered.slice(0, maxResults);
  },
});

// ---------------------------------------------------------------------------
// upvoteSnippet — increment upvote count
// ---------------------------------------------------------------------------

export const upvoteSnippet = mutation({
  args: {
    snippetId: v.id("codeSnippets"),
  },
  handler: async (ctx, args) => {
    const snippet = await ctx.db.get(args.snippetId);
    if (!snippet) throw new Error("Snippet not found");

    await ctx.db.patch(args.snippetId, {
      upvotes: snippet.upvotes + 1,
    });
  },
});

// ---------------------------------------------------------------------------
// flagSnippet — flag a snippet for review (e.g., contains PII)
// ---------------------------------------------------------------------------

export const flagSnippet = mutation({
  args: {
    snippetId: v.id("codeSnippets"),
  },
  handler: async (ctx, args) => {
    const snippet = await ctx.db.get(args.snippetId);
    if (!snippet) throw new Error("Snippet not found");

    await ctx.db.patch(args.snippetId, {
      flagCount: snippet.flagCount + 1,
    });
  },
});

// ---------------------------------------------------------------------------
// getSnippetById — get a single snippet by ID
// ---------------------------------------------------------------------------

export const getSnippetById = query({
  args: {
    snippetId: v.id("codeSnippets"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.snippetId);
  },
});

// ---------------------------------------------------------------------------
// getSnippetsForProgram — get all snippets for a program (org-scoped)
// ---------------------------------------------------------------------------

export const getSnippetsForProgram = query({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("codeSnippets")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});
