import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { getAuthUser } from "../model/access";

export const aiProviderValidator = v.union(
  v.literal("anthropic"),
  v.literal("bedrock"),
  v.literal("vertex"),
  v.literal("azure"),
);

function ensureOrgMembership(user: { orgIds: string[] }, orgId: string) {
  if (!user.orgIds.includes(orgId)) {
    throw new ConvexError("Access denied");
  }
}

function withoutEncryptedCredentials(entry: any) {
  const { encryptedCredentials: _secret, ...rest } = entry;
  return {
    ...rest,
    hasEncryptedCredentials: Boolean(_secret),
  };
}

export const listMine = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    ensureOrgMembership(user, args.orgId);

    const db = ctx.db as any;
    const rows = await db
      .query("aiProviderConfigs")
      .withIndex("by_user_org", (q: any) => q.eq("userId", user._id).eq("orgId", args.orgId))
      .collect();

    return rows
      .sort(
        (
          a: { isDefault: boolean; updatedAt: number },
          b: { isDefault: boolean; updatedAt: number },
        ) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        },
      )
      .map((row: any) => withoutEncryptedCredentials(row));
  },
});

export const getDefaultMine = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    ensureOrgMembership(user, args.orgId);

    const db = ctx.db as any;
    const rows = await db
      .query("aiProviderConfigs")
      .withIndex("by_user_org", (q: any) => q.eq("userId", user._id).eq("orgId", args.orgId))
      .collect();

    const selected = rows.find((row: { isDefault: boolean }) => row.isDefault) ?? rows[0] ?? null;
    return selected ? withoutEncryptedCredentials(selected) : null;
  },
});

export const upsertMine = mutation({
  args: {
    orgId: v.string(),
    provider: aiProviderValidator,
    encryptedCredentials: v.string(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    ensureOrgMembership(user, args.orgId);

    const db = ctx.db as any;
    const existing = await db
      .query("aiProviderConfigs")
      .withIndex("by_user_org_provider", (q: any) =>
        q.eq("userId", user._id).eq("orgId", args.orgId).eq("provider", args.provider),
      )
      .first();

    const allForOrg = await db
      .query("aiProviderConfigs")
      .withIndex("by_user_org", (q: any) => q.eq("userId", user._id).eq("orgId", args.orgId))
      .collect();

    const hasDefault = allForOrg.some((row: { isDefault: boolean }) => row.isDefault);
    const shouldBeDefault = args.isDefault ?? !hasDefault;
    const now = Date.now();

    if (shouldBeDefault) {
      for (const row of allForOrg) {
        if (existing && row._id === existing._id) continue;
        if (row.isDefault) {
          await db.patch(row._id, { isDefault: false, updatedAt: now });
        }
      }
    }

    if (existing) {
      await db.patch(existing._id, {
        encryptedCredentials: args.encryptedCredentials,
        isDefault: shouldBeDefault,
        updatedAt: now,
      });
      return existing._id;
    }

    return await db.insert("aiProviderConfigs", {
      userId: user._id,
      orgId: args.orgId,
      provider: args.provider,
      encryptedCredentials: args.encryptedCredentials,
      isDefault: shouldBeDefault,
      updatedAt: now,
    });
  },
});

export const setDefault = mutation({
  args: { configId: v.id("aiProviderConfigs") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const db = ctx.db as any;
    const config = await db.get(args.configId);
    if (!config) throw new ConvexError("AI provider config not found");
    if (config.userId !== user._id) throw new ConvexError("Access denied");
    ensureOrgMembership(user, config.orgId);

    const allForOrg = await db
      .query("aiProviderConfigs")
      .withIndex("by_user_org", (q: any) => q.eq("userId", user._id).eq("orgId", config.orgId))
      .collect();

    const now = Date.now();
    for (const row of allForOrg) {
      if (row._id !== config._id && row.isDefault) {
        await db.patch(row._id, { isDefault: false, updatedAt: now });
      }
    }

    await db.patch(config._id, { isDefault: true, updatedAt: now });
    return config._id;
  },
});

export const remove = mutation({
  args: { configId: v.id("aiProviderConfigs") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const db = ctx.db as any;
    const config = await db.get(args.configId);
    if (!config) throw new ConvexError("AI provider config not found");
    if (config.userId !== user._id) throw new ConvexError("Access denied");
    ensureOrgMembership(user, config.orgId);

    const wasDefault = config.isDefault;
    await db.delete(config._id);

    if (!wasDefault) return config._id;

    const remaining = await db
      .query("aiProviderConfigs")
      .withIndex("by_user_org", (q: any) => q.eq("userId", user._id).eq("orgId", config.orgId))
      .collect();

    if (remaining.length > 0) {
      remaining.sort(
        (a: { updatedAt: number }, b: { updatedAt: number }) => b.updatedAt - a.updatedAt,
      );
      await db.patch(remaining[0]._id, {
        isDefault: true,
        updatedAt: Date.now(),
      });
    }

    return config._id;
  },
});

export const getDefaultForUserInternal = internalQuery({
  args: {
    orgId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const rows = await db
      .query("aiProviderConfigs")
      .withIndex("by_user_org", (q: any) => q.eq("userId", args.userId).eq("orgId", args.orgId))
      .collect();
    return rows.find((row: { isDefault: boolean }) => row.isDefault) ?? rows[0] ?? null;
  },
});

export const getByProviderInternal = internalQuery({
  args: {
    orgId: v.string(),
    userId: v.id("users"),
    provider: aiProviderValidator,
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    return await db
      .query("aiProviderConfigs")
      .withIndex("by_user_org_provider", (q: any) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId).eq("provider", args.provider),
      )
      .first();
  },
});
