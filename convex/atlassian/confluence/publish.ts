import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

export const upsertPublishedPage = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    pageType: v.union(
      v.literal("gap_analysis"),
      v.literal("sprint_report"),
      v.literal("risk_register"),
      v.literal("visual_discovery"),
      v.literal("decisions_log"),
      v.literal("program_overview"),
      v.literal("ingested"),
    ),
    confluencePageId: v.string(),
    confluencePageTitle: v.string(),
    confluenceVersion: v.number(),
    contentHash: v.optional(v.string()),
    sprintId: v.optional(v.string()),
    cachedRenderedHtml: v.optional(v.string()),
    cachedRenderedVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const existing = await ctx.db
      .query("confluencePageRecords")
      .withIndex("by_confluence_page_id", (q) =>
        q.eq("programId", args.programId).eq("confluencePageId", args.confluencePageId),
      )
      .first();

    const patch = {
      pageType: args.pageType,
      confluencePageTitle: args.confluencePageTitle,
      confluenceVersion: args.confluenceVersion,
      direction: "publish" as const,
      lastPublishedAt: Date.now(),
      contentHash: args.contentHash,
      sprintId: args.sprintId,
      cachedRenderedHtml: args.cachedRenderedHtml,
      cachedRenderedVersion: args.cachedRenderedVersion,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("confluencePageRecords", {
      orgId: args.orgId,
      programId: args.programId,
      confluencePageId: args.confluencePageId,
      ...patch,
    });
  },
});

export const listPagesByProgram = query({
  args: {
    programId: v.id("programs"),
    direction: v.optional(v.union(v.literal("publish"), v.literal("ingest"))),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");

    await assertOrgAccess(ctx, program.orgId);

    const pages = await ctx.db
      .query("confluencePageRecords")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return args.direction ? pages.filter((page) => page.direction === args.direction) : pages;
  },
});

export const listPagesByProgramInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("confluencePageRecords")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});
