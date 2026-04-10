import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";

function deriveContentHash(payload: Record<string, any>): string | undefined {
  const version = payload.page?.version?.number ?? payload.version?.number;
  const updated = payload.page?.version?.when ?? payload.timestamp;
  if (version === undefined && updated === undefined) return undefined;
  return `${String(version ?? "na")}:${String(updated ?? "na")}`;
}

function extractPage(payload: Record<string, any>) {
  const page = payload.page ?? payload.content ?? payload;
  const pageId = page?.id;
  const title = page?.title;
  const spaceKey = payload.space?.key ?? page?.space?.key ?? payload.content?.space?.key;
  const version = Number(page?.version?.number ?? payload.version?.number ?? 1) || 1;

  if (!pageId || !title) return null;

  return {
    confluencePageId: String(pageId),
    confluencePageTitle: String(title),
    confluenceVersion: version,
    confluenceSpaceKey: typeof spaceKey === "string" && spaceKey.length > 0 ? spaceKey : undefined,
  };
}

export const handleConfluenceWebhookEvent = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.optional(v.id("programs")),
    eventType: v.string(),
    action: v.optional(v.string()),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    if (!args.programId) {
      return { processed: false, reason: "missing programId" };
    }

    const derived = extractPage(args.payload as Record<string, any>);
    if (!derived) {
      return { processed: false, reason: "no page id/title in payload" };
    }

    const contentHash = deriveContentHash(args.payload as Record<string, any>);

    const existing = await ctx.db
      .query("confluencePageRecords")
      .withIndex("by_confluence_page_id", (q) =>
        q.eq("programId", args.programId!).eq("confluencePageId", derived.confluencePageId),
      )
      .first();

    const patch = {
      pageType: "ingested" as const,
      confluencePageTitle: derived.confluencePageTitle,
      confluenceVersion: derived.confluenceVersion,
      direction: "ingest" as const,
      lastIngestedAt: Date.now(),
      contentHash,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return {
        processed: true,
        updated: true,
        confluencePageId: derived.confluencePageId,
        confluencePageTitle: derived.confluencePageTitle,
        confluenceVersion: derived.confluenceVersion,
      };
    }

    await ctx.db.insert("confluencePageRecords", {
      orgId: args.orgId,
      programId: args.programId,
      confluencePageId: derived.confluencePageId,
      ...patch,
    });

    return {
      processed: true,
      created: true,
      confluencePageId: derived.confluencePageId,
      confluencePageTitle: derived.confluencePageTitle,
      confluenceVersion: derived.confluenceVersion,
    };
  },
});

export const queueManualIngest = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    confluencePageId: v.string(),
    confluencePageTitle: v.string(),
    confluenceVersion: v.number(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const existing = await ctx.db
      .query("confluencePageRecords")
      .withIndex("by_confluence_page_id", (q) =>
        q.eq("programId", args.programId).eq("confluencePageId", args.confluencePageId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pageType: "ingested",
        direction: "ingest",
        confluencePageTitle: args.confluencePageTitle,
        confluenceVersion: args.confluenceVersion,
        lastIngestedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("confluencePageRecords", {
      orgId: args.orgId,
      programId: args.programId,
      pageType: "ingested",
      confluencePageId: args.confluencePageId,
      confluencePageTitle: args.confluencePageTitle,
      confluenceVersion: args.confluenceVersion,
      direction: "ingest",
      lastIngestedAt: Date.now(),
    });
  },
});

export const getPageRecordQuery = internalQuery({
  args: {
    programId: v.id("programs"),
    confluencePageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("confluencePageRecords")
      .withIndex("by_confluence_page_id", (q) =>
        q.eq("programId", args.programId).eq("confluencePageId", args.confluencePageId),
      )
      .first();
  },
});

export const getProgramInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.programId);
  },
});

export const upsertIngestedPageRecord = internalMutation({
  args: {
    programId: v.id("programs"),
    confluencePageId: v.string(),
    confluencePageTitle: v.string(),
    confluenceVersion: v.number(),
    contentHash: v.string(),
    cachedRenderedHtml: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("confluencePageRecords")
      .withIndex("by_confluence_page_id", (q) =>
        q.eq("programId", args.programId).eq("confluencePageId", args.confluencePageId),
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        confluencePageTitle: args.confluencePageTitle,
        confluenceVersion: args.confluenceVersion,
        contentHash: args.contentHash,
        cachedRenderedHtml: args.cachedRenderedHtml,
        cachedRenderedVersion: args.confluenceVersion,
        lastIngestedAt: now,
      });
      return existing._id;
    }

    // Should not normally happen since handleConfluenceWebhookEvent or queueManualIngest
    // creates the record first, but handle gracefully
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");

    return await ctx.db.insert("confluencePageRecords", {
      orgId: program.orgId,
      programId: args.programId,
      pageType: "ingested",
      confluencePageId: args.confluencePageId,
      confluencePageTitle: args.confluencePageTitle,
      confluenceVersion: args.confluenceVersion,
      direction: "ingest",
      contentHash: args.contentHash,
      cachedRenderedHtml: args.cachedRenderedHtml,
      cachedRenderedVersion: args.confluenceVersion,
      lastIngestedAt: now,
    });
  },
});
