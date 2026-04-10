import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

// Create a new incident
export const createIncident = mutation({
  args: {
    orgId: v.string(),
    service: v.string(),
    title: v.string(),
    severity: v.union(v.literal("minor"), v.literal("major"), v.literal("critical")),
    affectedComponents: v.array(v.string()),
    autoCreated: v.boolean(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const now = Date.now();

    return await ctx.db.insert("serviceIncidents", {
      orgId: args.orgId,
      service: args.service,
      title: args.title,
      status: "investigating",
      severity: args.severity,
      affectedComponents: args.affectedComponents,
      timeline: [
        {
          timestamp: now,
          status: "investigating",
          message: args.message ?? `${args.service} outage detected`,
          updatedBy: args.autoCreated ? "system" : undefined,
        },
      ],
      startedAt: now,
      autoCreated: args.autoCreated,
    });
  },
});

// Update an incident status
export const updateIncidentStatus = mutation({
  args: {
    orgId: v.string(),
    incidentId: v.id("serviceIncidents"),
    status: v.union(
      v.literal("investigating"),
      v.literal("identified"),
      v.literal("monitoring"),
      v.literal("resolved"),
    ),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident || incident.orgId !== args.orgId) {
      throw new Error("Incident not found");
    }

    const now = Date.now();
    const timeline = [
      ...incident.timeline,
      {
        timestamp: now,
        status: args.status,
        message: args.message,
      },
    ];

    await ctx.db.patch(args.incidentId, {
      status: args.status,
      timeline,
      ...(args.status === "resolved" ? { resolvedAt: now } : {}),
    });
  },
});

// Resolve an incident (convenience wrapper)
export const resolveIncident = mutation({
  args: {
    orgId: v.string(),
    incidentId: v.id("serviceIncidents"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident || incident.orgId !== args.orgId) {
      throw new Error("Incident not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.incidentId, {
      status: "resolved",
      resolvedAt: now,
      timeline: [
        ...incident.timeline,
        {
          timestamp: now,
          status: "resolved",
          message: args.message ?? "Service restored",
          updatedBy: "system",
        },
      ],
    });
  },
});

// Get a single incident by ID
export const getIncident = query({
  args: {
    orgId: v.string(),
    incidentId: v.id("serviceIncidents"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident || incident.orgId !== args.orgId) return null;
    return incident;
  },
});
