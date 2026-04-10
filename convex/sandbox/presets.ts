import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { getAuthUser } from "../model/access";

export const presetEditorTypeValidator = v.union(
  v.literal("monaco"),
  v.literal("codemirror"),
  v.literal("none"),
);

const presetScopeValidator = v.union(v.literal("org"), v.literal("personal"));

const envVarOverrideValidator = v.object({
  name: v.string(),
  value: v.string(),
});

function ensureOrgMembership(user: { orgIds: string[] }, orgId: string) {
  if (!user.orgIds.includes(orgId)) {
    throw new ConvexError("Access denied");
  }
}

function ensurePresetAccess(userId: string, preset: { userId?: string }) {
  if (preset.userId && preset.userId !== userId) {
    throw new ConvexError("Access denied");
  }
}

function validateTtlMinutes(ttlMinutes: number) {
  if (ttlMinutes < 5 || ttlMinutes > 60) {
    throw new ConvexError("ttlMinutes must be between 5 and 60");
  }
}

async function clearDefaultForScope(
  db: any,
  orgId: string,
  scopeUserId: string | undefined,
  skipId?: string,
) {
  const byOrg = await db
    .query("sandboxPresets")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();

  for (const preset of byOrg) {
    if (skipId && preset._id === skipId) continue;
    const sameScope =
      scopeUserId === undefined ? preset.userId === undefined : preset.userId === scopeUserId;
    if (sameScope && preset.isDefault) {
      await db.patch(preset._id, { isDefault: false });
    }
  }
}

/** List sandbox presets for an organization, including org-wide and user-specific presets. */
export const listForOrg = query({
  args: {
    orgId: v.string(),
    includeOrgOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    ensureOrgMembership(user, args.orgId);

    const db = ctx.db as any;
    const all = await db
      .query("sandboxPresets")
      .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    const visible = all.filter((preset: { userId?: string }) => {
      if (args.includeOrgOnly) return preset.userId === undefined;
      return preset.userId === undefined || preset.userId === user._id;
    });

    visible.sort(
      (
        a: { isDefault: boolean; createdAt: number; name: string },
        b: { isDefault: boolean; createdAt: number; name: string },
      ) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
        return a.name.localeCompare(b.name);
      },
    );

    return visible;
  },
});

/** Retrieve a single sandbox preset by ID. */
export const get = query({
  args: { presetId: v.id("sandboxPresets") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const preset = await ctx.db.get(args.presetId);
    if (!preset) throw new ConvexError("Sandbox preset not found");
    ensureOrgMembership(user, preset.orgId);
    ensurePresetAccess(user._id, preset);
    return preset;
  },
});

/** Create or update a sandbox preset with editor, runtime, and tool settings. */
export const upsert = mutation({
  args: {
    presetId: v.optional(v.id("sandboxPresets")),
    orgId: v.string(),
    name: v.string(),
    editorType: presetEditorTypeValidator,
    ttlMinutes: v.number(),
    envVarOverrides: v.optional(v.array(envVarOverrideValidator)),
    mcpServerOverrides: v.optional(v.array(v.string())),
    isDefault: v.optional(v.boolean()),
    scope: v.optional(presetScopeValidator),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    ensureOrgMembership(user, args.orgId);
    validateTtlMinutes(args.ttlMinutes);

    const db = ctx.db as any;
    const now = Date.now();

    if (args.presetId) {
      const existing = await db.get(args.presetId);
      if (!existing) throw new ConvexError("Sandbox preset not found");
      if (existing.orgId !== args.orgId) {
        throw new ConvexError("Sandbox preset does not belong to this organization");
      }
      ensurePresetAccess(user._id, existing);

      if (args.isDefault) {
        await clearDefaultForScope(db, args.orgId, existing.userId, existing._id);
      }

      await db.patch(existing._id, {
        name: args.name,
        editorType: args.editorType,
        ttlMinutes: args.ttlMinutes,
        envVarOverrides: args.envVarOverrides ?? [],
        mcpServerOverrides: args.mcpServerOverrides ?? [],
        isDefault: args.isDefault ?? existing.isDefault,
      });
      return existing._id;
    }

    const scope = args.scope ?? "personal";
    const scopeUserId = scope === "org" ? undefined : user._id;

    if (args.isDefault) {
      await clearDefaultForScope(db, args.orgId, scopeUserId);
    }

    return await db.insert("sandboxPresets", {
      orgId: args.orgId,
      userId: scopeUserId,
      name: args.name,
      editorType: args.editorType,
      ttlMinutes: args.ttlMinutes,
      envVarOverrides: args.envVarOverrides ?? [],
      mcpServerOverrides: args.mcpServerOverrides ?? [],
      isDefault: args.isDefault ?? false,
      createdAt: now,
    });
  },
});

/** Delete a sandbox preset. */
export const remove = mutation({
  args: { presetId: v.id("sandboxPresets") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const preset = await ctx.db.get(args.presetId);
    if (!preset) throw new ConvexError("Sandbox preset not found");
    ensureOrgMembership(user, preset.orgId);
    ensurePresetAccess(user._id, preset);

    await ctx.db.delete(args.presetId);
    return args.presetId;
  },
});

export const getInternal = internalQuery({
  args: { presetId: v.id("sandboxPresets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.presetId);
  },
});

export const listByOrgInternal = internalQuery({
  args: {
    orgId: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const all = await db
      .query("sandboxPresets")
      .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    if (!args.userId)
      return all.filter((preset: { userId?: string }) => preset.userId === undefined);
    return all.filter(
      (preset: { userId?: string }) => preset.userId === undefined || preset.userId === args.userId,
    );
  },
});
