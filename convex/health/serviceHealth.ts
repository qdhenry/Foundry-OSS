import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

/** Get the most recent health check for each monitored service in an organization. */
export const getLatestHealthByService = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const services = [
      "convex",
      "clerk",
      "anthropic",
      "github",
      "jira",
      "confluence",
      "stripe",
      "sandbox",
      "twelveLabs",
    ];

    const results: Record<string, any> = {};
    for (const service of services) {
      const latest = await ctx.db
        .query("serviceHealthChecks")
        .withIndex("by_org_service", (q) => q.eq("orgId", args.orgId).eq("service", service))
        .order("desc")
        .first();
      if (latest) {
        results[service] = latest;
      }
    }
    return results;
  },
});

/** Get all active (unresolved) service incidents for an organization. */
export const getActiveIncidents = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const incidents = [];
    // Query each non-resolved status separately via index (no .filter())
    for (const status of ["investigating", "identified", "monitoring"] as const) {
      const batch = await ctx.db
        .query("serviceIncidents")
        .withIndex("by_org_status", (q) => q.eq("orgId", args.orgId).eq("status", status))
        .collect();
      incidents.push(...batch);
    }

    return incidents.sort((a, b) => b.startedAt - a.startedAt);
  },
});

// Get incident history (all incidents, most recent first)
export const getIncidentHistory = query({
  args: {
    orgId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("serviceIncidents")
      .withIndex("by_org_started", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Record a health check result for a service.
 * @param orgId - Organization ID
 * @param service - Service name being checked
 * @param status - Health status (healthy, degraded, outage, unknown)
 * @param checkType - How the check was triggered (cron, probe, inferred)
 */
export const recordHealthCheck = mutation({
  args: {
    orgId: v.string(),
    service: v.string(),
    status: v.union(
      v.literal("healthy"),
      v.literal("degraded"),
      v.literal("outage"),
      v.literal("unknown"),
    ),
    latencyMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    checkType: v.union(v.literal("cron"), v.literal("probe"), v.literal("inferred")),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db.insert("serviceHealthChecks", {
      orgId: args.orgId,
      service: args.service,
      status: args.status,
      latencyMs: args.latencyMs,
      errorMessage: args.errorMessage,
      checkedAt: Date.now(),
      checkType: args.checkType,
    });
  },
});
