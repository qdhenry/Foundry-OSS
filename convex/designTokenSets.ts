import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";
import {
  generateCssVariables,
  generateScssVariables,
  generateTailwindConfig,
  parseCssVariables,
  parseJsonTokens,
} from "./model/tokenParser";

// ── Create ────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    colors: v.optional(v.string()),
    typography: v.optional(v.string()),
    spacing: v.optional(v.string()),
    breakpoints: v.optional(v.string()),
    shadows: v.optional(v.string()),
    radii: v.optional(v.string()),
    sourceType: v.union(
      v.literal("manual"),
      v.literal("figma"),
      v.literal("extracted"),
      v.literal("imported"),
    ),
    sourceAssetId: v.optional(v.id("designAssets")),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    // Find the latest version for this program
    const existing = await ctx.db
      .query("designTokenSets")
      .withIndex("by_program", (q) => q.eq("orgId", args.orgId).eq("programId", args.programId))
      .collect();

    const maxVersion = existing.reduce((max, ts) => Math.max(max, ts.version), 0);

    const tokenSetId = await ctx.db.insert("designTokenSets", {
      orgId: args.orgId,
      programId: args.programId,
      name: args.name,
      version: maxVersion + 1,
      colors: args.colors,
      typography: args.typography,
      spacing: args.spacing,
      breakpoints: args.breakpoints,
      shadows: args.shadows,
      radii: args.radii,
      sourceType: args.sourceType,
      sourceAssetId: args.sourceAssetId,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "design_token_set",
      entityId: tokenSetId as string,
      action: "create",
      description: `Created design token set "${args.name}" (v${maxVersion + 1}, ${args.sourceType})`,
    });

    return tokenSetId;
  },
});

// ── List by Program ───────────────────────────────────────────────

export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    return await ctx.db
      .query("designTokenSets")
      .withIndex("by_program", (q) => q.eq("orgId", program.orgId).eq("programId", args.programId))
      .collect();
  },
});

// ── Get ───────────────────────────────────────────────────────────

export const get = query({
  args: { tokenSetId: v.id("designTokenSets") },
  handler: async (ctx, args) => {
    const tokenSet = await ctx.db.get(args.tokenSetId);
    if (!tokenSet) throw new Error("Design token set not found");
    await assertOrgAccess(ctx, tokenSet.orgId);
    return tokenSet;
  },
});

// ── Update ────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    tokenSetId: v.id("designTokenSets"),
    name: v.optional(v.string()),
    colors: v.optional(v.string()),
    typography: v.optional(v.string()),
    spacing: v.optional(v.string()),
    breakpoints: v.optional(v.string()),
    shadows: v.optional(v.string()),
    radii: v.optional(v.string()),
    tailwindConfig: v.optional(v.string()),
    cssVariables: v.optional(v.string()),
    scssVariables: v.optional(v.string()),
    jsonTokens: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tokenSet = await ctx.db.get(args.tokenSetId);
    if (!tokenSet) throw new Error("Design token set not found");
    await assertOrgAccess(ctx, tokenSet.orgId);

    const updateObj: Record<string, unknown> = {};
    const { tokenSetId: _, ...fields } = args;
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updateObj[key] = value;
      }
    }

    if (Object.keys(updateObj).length > 0) {
      await ctx.db.patch(args.tokenSetId, updateObj);

      await logAuditEvent(ctx, {
        orgId: tokenSet.orgId,
        programId: tokenSet.programId as string,
        entityType: "design_token_set",
        entityId: args.tokenSetId as string,
        action: "update",
        description: `Updated design token set "${tokenSet.name}"`,
      });
    }
  },
});

// ── Remove ────────────────────────────────────────────────────────

export const remove = mutation({
  args: { tokenSetId: v.id("designTokenSets") },
  handler: async (ctx, args) => {
    const tokenSet = await ctx.db.get(args.tokenSetId);
    if (!tokenSet) throw new Error("Design token set not found");
    await assertOrgAccess(ctx, tokenSet.orgId);

    await ctx.db.delete(args.tokenSetId);

    await logAuditEvent(ctx, {
      orgId: tokenSet.orgId,
      programId: tokenSet.programId as string,
      entityType: "design_token_set",
      entityId: args.tokenSetId as string,
      action: "delete",
      description: `Deleted design token set "${tokenSet.name}" (v${tokenSet.version})`,
    });
  },
});

// ── Clear All ────────────────────────────────────────────────────

export const clearAllForProgram = mutation({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const tokenSets = await ctx.db
      .query("designTokenSets")
      .withIndex("by_program", (q) => q.eq("orgId", program.orgId).eq("programId", args.programId))
      .collect();

    for (const ts of tokenSets) {
      await ctx.db.delete(ts._id);
    }

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "design_token_set",
      entityId: args.programId as string,
      action: "delete",
      description: `Cleared all design token sets (${tokenSets.length} removed)`,
    });

    return tokenSets.length;
  },
});

// ── Create from Analysis ─────────────────────────────────────────

export const createFromAnalysis = mutation({
  args: {
    programId: v.id("programs"),
    analysisId: v.id("designAnalyses"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new Error("Analysis not found");

    // Build token categories from extracted data
    const colors: Record<string, string> = {};
    if (analysis.extractedColors) {
      for (const c of analysis.extractedColors) {
        colors[c.name] = c.hex;
      }
    }

    const typography: Record<string, any> = {};
    if (analysis.extractedTypography) {
      for (const t of analysis.extractedTypography) {
        typography[t.role] = {
          fontFamily: t.fontFamily,
          fontSize: t.fontSize,
          fontWeight: t.fontWeight,
          ...(t.lineHeight ? { lineHeight: t.lineHeight } : {}),
        };
      }
    }

    // Generate code artifacts
    const normalized = {
      colors,
      typography,
      spacing: {},
      breakpoints: {},
      shadows: {},
      radii: {},
    };

    const tailwindConfig = generateTailwindConfig(normalized);
    const cssVariables = generateCssVariables(normalized);
    const scssVariables = generateScssVariables(normalized);

    // Find latest version
    const existing = await ctx.db
      .query("designTokenSets")
      .withIndex("by_program", (q) => q.eq("orgId", program.orgId).eq("programId", args.programId))
      .collect();
    const maxVersion = existing.reduce((max, ts) => Math.max(max, ts.version), 0);

    const tokenSetId = await ctx.db.insert("designTokenSets", {
      orgId: program.orgId,
      programId: args.programId,
      name: args.name,
      version: maxVersion + 1,
      colors: Object.keys(colors).length > 0 ? JSON.stringify(colors) : undefined,
      typography: Object.keys(typography).length > 0 ? JSON.stringify(typography) : undefined,
      sourceType: "extracted",
      sourceAssetId: analysis.designAssetId,
      tailwindConfig,
      cssVariables,
      scssVariables,
      jsonTokens: JSON.stringify(normalized, null, 2),
    });

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "design_token_set",
      entityId: tokenSetId as string,
      action: "create",
      description: `Extracted design tokens from screenshot analysis "${args.name}"`,
    });

    return tokenSetId;
  },
});

// ── Import from Content ───────────────────────────────────────────

export const importFromContent = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    content: v.string(),
    format: v.union(v.literal("json"), v.literal("css"), v.literal("scss")),
    sourceAssetId: v.optional(v.id("designAssets")),
  },
  handler: async (ctx, args) => {
    // 1. Assert access
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    // 2. Parse tokens based on format
    const parsed =
      args.format === "json" ? parseJsonTokens(args.content) : parseCssVariables(args.content);

    // 3. Generate all code artifacts
    const tailwindConfig = generateTailwindConfig(parsed);
    const cssVariables = generateCssVariables(parsed);
    const scssVariables = generateScssVariables(parsed);

    // 4. Find latest version for program
    const existing = await ctx.db
      .query("designTokenSets")
      .withIndex("by_program", (q) => q.eq("orgId", args.orgId).eq("programId", args.programId))
      .collect();

    const maxVersion = existing.reduce((max, ts) => Math.max(max, ts.version), 0);

    const version = maxVersion + 1;

    // 5. Insert token set with all parsed categories and artifacts
    const tokenSetId = await ctx.db.insert("designTokenSets", {
      orgId: args.orgId,
      programId: args.programId,
      name: args.name,
      version,
      colors: Object.keys(parsed.colors).length > 0 ? JSON.stringify(parsed.colors) : undefined,
      typography:
        Object.keys(parsed.typography).length > 0 ? JSON.stringify(parsed.typography) : undefined,
      spacing: Object.keys(parsed.spacing).length > 0 ? JSON.stringify(parsed.spacing) : undefined,
      breakpoints:
        Object.keys(parsed.breakpoints).length > 0 ? JSON.stringify(parsed.breakpoints) : undefined,
      shadows: Object.keys(parsed.shadows).length > 0 ? JSON.stringify(parsed.shadows) : undefined,
      radii: Object.keys(parsed.radii).length > 0 ? JSON.stringify(parsed.radii) : undefined,
      tailwindConfig,
      cssVariables,
      scssVariables,
      jsonTokens: args.content,
      sourceType: "manual",
      sourceAssetId: args.sourceAssetId,
    });

    // 6. Audit log
    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "design_token_set",
      entityId: tokenSetId as string,
      action: "create",
      description: `Imported design token set "${args.name}" (v${version}, ${args.format})`,
    });

    // 7. Return tokenSetId
    return tokenSetId;
  },
});

// Internal version callable from scheduler (no auth check — called by designAssets:create)
export const importFromContentInternal = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.string(),
    name: v.string(),
    content: v.string(),
    format: v.union(v.literal("json"), v.literal("css"), v.literal("scss")),
    sourceAssetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parsed =
      args.format === "json" ? parseJsonTokens(args.content) : parseCssVariables(args.content);

    const tailwindConfig = generateTailwindConfig(parsed);
    const cssVariables = generateCssVariables(parsed);
    const scssVariables = generateScssVariables(parsed);

    const existing = await ctx.db
      .query("designTokenSets")
      .withIndex("by_program", (q) =>
        q.eq("orgId", args.orgId).eq("programId", args.programId as any),
      )
      .collect();

    const maxVersion = existing.reduce((max, ts) => Math.max(max, ts.version), 0);
    const version = maxVersion + 1;

    await ctx.db.insert("designTokenSets", {
      orgId: args.orgId,
      programId: args.programId as any,
      name: args.name,
      version,
      colors: Object.keys(parsed.colors).length > 0 ? JSON.stringify(parsed.colors) : undefined,
      typography:
        Object.keys(parsed.typography).length > 0 ? JSON.stringify(parsed.typography) : undefined,
      spacing: Object.keys(parsed.spacing).length > 0 ? JSON.stringify(parsed.spacing) : undefined,
      breakpoints:
        Object.keys(parsed.breakpoints).length > 0 ? JSON.stringify(parsed.breakpoints) : undefined,
      shadows: Object.keys(parsed.shadows).length > 0 ? JSON.stringify(parsed.shadows) : undefined,
      radii: Object.keys(parsed.radii).length > 0 ? JSON.stringify(parsed.radii) : undefined,
      tailwindConfig,
      cssVariables,
      scssVariables,
      jsonTokens: args.content,
      sourceType: "manual",
      sourceAssetId: args.sourceAssetId as any,
    });
  },
});
