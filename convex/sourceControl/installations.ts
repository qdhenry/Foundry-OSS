import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

/**
 * Installation management — create/update/disconnect GitHub App installations.
 *
 * Called from webhook processor when installation events arrive.
 */

// ---------------------------------------------------------------------------
// handleInstallation — create or update installation on install event
// ---------------------------------------------------------------------------

export const handleInstallation = internalMutation({
  args: {
    installationId: v.string(),
    accountLogin: v.string(),
    accountType: v.union(v.literal("organization"), v.literal("user")),
    permissions: v.any(),
    orgId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "active",
        accountLogin: args.accountLogin,
        accountType: args.accountType,
        permissions: args.permissions,
        disconnectedAt: undefined,
      });
      return existing._id;
    }

    // New installation — orgId must be provided or will be set later
    // during the repo connection flow
    const id = await ctx.db.insert("sourceControlInstallations", {
      orgId: args.orgId ?? "",
      providerType: "github",
      installationId: args.installationId,
      accountLogin: args.accountLogin,
      accountType: args.accountType,
      status: "active",
      permissions: args.permissions,
      installedAt: Date.now(),
    });
    return id;
  },
});

// ---------------------------------------------------------------------------
// handleUninstall — mark installation as disconnected
// ---------------------------------------------------------------------------

export const handleUninstall = internalMutation({
  args: { installationId: v.string() },
  handler: async (ctx, args) => {
    const installation = await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();

    if (installation) {
      await ctx.db.patch(installation._id, {
        status: "disconnected",
        disconnectedAt: Date.now(),
      });
    }
  },
});

// ---------------------------------------------------------------------------
/** List GitHub App installations for an organization. */
export const listByOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// getByOrg — get installations for an org (internal)
// ---------------------------------------------------------------------------

export const getByOrg = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// getByInstallationId — get a specific installation
// ---------------------------------------------------------------------------

export const getByInstallationId = internalQuery({
  args: { installationId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();
  },
});

// ---------------------------------------------------------------------------
// bindOrgToInstallation — set orgId on an installation after OAuth callback
// ---------------------------------------------------------------------------

export const bindOrgToInstallation = internalMutation({
  args: {
    installationId: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    const installation = await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();

    if (installation) {
      await ctx.db.patch(installation._id, { orgId: args.orgId });
    }
  },
});

// ---------------------------------------------------------------------------
// claimInstallation — public mutation to bind an unbound installation to an org
// ---------------------------------------------------------------------------

/**
 * Bind an unbound GitHub App installation to an organization.
 * @param installationId - GitHub App installation ID
 * @param orgId - Organization to bind to
 */
export const claimInstallation = mutation({
  args: {
    installationId: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const installation = await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();

    if (!installation) return null;
    // Only allow claiming unbound installations (empty orgId)
    if (installation.orgId && installation.orgId !== "") return null;

    await ctx.db.patch(installation._id, { orgId: args.orgId });
    return installation._id;
  },
});

// ---------------------------------------------------------------------------
// listUnbound — get active installations not yet bound to any org
// ---------------------------------------------------------------------------

export const listUnbound = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_org", (q) => q.eq("orgId", ""))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});
