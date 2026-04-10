import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess, getAuthUser } from "./model/access";

const PRESENCE_FRESHNESS_MS = 30_000;
const PRESENCE_DEBOUNCE_MS = 10_000;

export const upsert = mutation({
  args: {
    programId: v.id("programs"),
    page: v.string(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const user = await getAuthUser(ctx);
    const now = Date.now();

    const existingEntries = await ctx.db
      .query("presence")
      .withIndex("by_program_page_user", (q) =>
        q.eq("programId", args.programId).eq("page", args.page).eq("userId", user._id),
      )
      .collect();

    let presenceId: string;
    if (existingEntries.length > 0) {
      const [current, ...duplicates] = existingEntries;

      // Skip write if recently updated — reduces OCC conflicts from rapid heartbeats
      const recentlyUpdated = now - current.lastSeenAt < PRESENCE_DEBOUNCE_MS;
      if (!recentlyUpdated) {
        const patch: Record<string, unknown> = { lastSeenAt: now };
        if (current.userName !== user.name) {
          patch.userName = user.name;
        }
        await ctx.db.patch(current._id, patch);
      }
      presenceId = current._id as string;

      for (const duplicate of duplicates) {
        await ctx.db.delete(duplicate._id);
      }
    } else {
      const insertedId = await ctx.db.insert("presence", {
        orgId: program.orgId,
        programId: args.programId,
        page: args.page,
        userId: user._id,
        userName: user.name,
        lastSeenAt: now,
      });
      presenceId = insertedId as string;
    }

    return {
      presenceId,
      lastSeenAt: now,
      expiresAt: now + PRESENCE_FRESHNESS_MS,
    };
  },
});

export const listByPage = query({
  args: {
    programId: v.id("programs"),
    page: v.string(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const freshnessThreshold = Date.now() - PRESENCE_FRESHNESS_MS;
    const entries = await ctx.db
      .query("presence")
      .withIndex("by_program_page", (q) => q.eq("programId", args.programId).eq("page", args.page))
      .collect();

    const fresh = entries
      .filter((entry) => entry.lastSeenAt >= freshnessThreshold)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

    const enriched = await Promise.all(
      fresh.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          ...entry,
          userName: user?.name ?? entry.userName,
          userAvatarUrl: user?.avatarUrl,
          expiresAt: entry.lastSeenAt + PRESENCE_FRESHNESS_MS,
        };
      }),
    );

    return enriched;
  },
});
