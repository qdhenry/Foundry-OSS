import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { assertOrgAccess, getAuthUser } from "../model/access";

function normalizeSecretName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new ConvexError("Environment variable name is required");
  }
  return normalized;
}

function redactSecretValue<T extends { encryptedValue?: string }>(entry: T) {
  const { encryptedValue: _secret, ...rest } = entry;
  return {
    ...rest,
    hasEncryptedValue: Boolean(_secret),
  };
}

/** List environment vault entries for an organization (values are redacted). */
export const listByOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const db = ctx.db as any;
    const entries = await db
      .query("envVault")
      .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    return entries
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
      .map((entry: any) => redactSecretValue(entry));
  },
});

/** Retrieve a single vault entry by ID (value is redacted). */
export const get = query({
  args: { envVarId: v.id("envVault") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.envVarId);
    if (!entry) throw new ConvexError("Vault entry not found");
    await assertOrgAccess(ctx, entry.orgId);
    return redactSecretValue(entry as any);
  },
});

/**
 * Create or update an encrypted environment variable in the vault.
 * @param orgId - Organization ID
 * @param name - Variable name (auto-normalized to SCREAMING_SNAKE_CASE)
 * @param encryptedValue - Encrypted value
 */
export const upsert = mutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    encryptedValue: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user.orgIds.includes(args.orgId)) throw new ConvexError("Access denied");

    const db = ctx.db as any;
    const normalizedName = normalizeSecretName(args.name);
    const existing = await db
      .query("envVault")
      .withIndex("by_org_name", (q: any) => q.eq("orgId", args.orgId).eq("name", normalizedName))
      .first();

    const patch = {
      name: normalizedName,
      encryptedValue: args.encryptedValue,
      description: args.description,
      updatedAt: Date.now(),
    };

    if (existing) {
      await db.patch(existing._id, patch);
      return existing._id;
    }

    return await db.insert("envVault", {
      orgId: args.orgId,
      createdBy: user._id,
      ...patch,
    });
  },
});

/** Delete an environment variable from the vault. */
export const remove = mutation({
  args: { envVarId: v.id("envVault") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.envVarId);
    if (!entry) throw new ConvexError("Vault entry not found");
    await assertOrgAccess(ctx, entry.orgId);

    await ctx.db.delete(args.envVarId);
    return args.envVarId;
  },
});

export const getByNameInternal = internalQuery({
  args: {
    orgId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    return await db
      .query("envVault")
      .withIndex("by_org_name", (q: any) => q.eq("orgId", args.orgId).eq("name", args.name.trim()))
      .first();
  },
});

export const listInternal = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    return await db
      .query("envVault")
      .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
      .collect();
  },
});
