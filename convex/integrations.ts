import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const typeValidator = v.union(
  v.literal("api"),
  v.literal("webhook"),
  v.literal("file_transfer"),
  v.literal("database"),
  v.literal("middleware"),
  v.literal("other"),
);

const statusValidator = v.union(
  v.literal("planned"),
  v.literal("in_progress"),
  v.literal("testing"),
  v.literal("live"),
  v.literal("deprecated"),
);

/** List integrations for a program with optional type and status filters. */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    type: v.optional(typeValidator),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    let integrations = await ctx.db
      .query("integrations")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (args.type !== undefined) {
      integrations = integrations.filter((i) => i.type === args.type);
    }
    if (args.status !== undefined) {
      integrations = integrations.filter((i) => i.status === args.status);
    }

    integrations.sort((a, b) => a.name.localeCompare(b.name));

    return integrations;
  },
});

/** Retrieve a single integration by ID with resolved requirement and owner details. */
export const get = query({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await assertOrgAccess(ctx, integration.orgId);

    const resolvedRequirements: {
      _id: string;
      refId: string;
      title: string;
    }[] = [];
    if (integration.requirementIds) {
      for (const reqId of integration.requirementIds) {
        const req = await ctx.db.get(reqId);
        if (req) {
          resolvedRequirements.push({
            _id: req._id,
            refId: req.refId,
            title: req.title,
          });
        }
      }
    }

    let ownerName: string | undefined;
    if (integration.ownerId) {
      const owner = await ctx.db.get(integration.ownerId);
      if (owner) {
        ownerName = owner.name;
      }
    }

    return {
      ...integration,
      resolvedRequirements,
      ownerName,
    };
  },
});

/**
 * Create a new integration record.
 * @param orgId - Organization ID
 * @param programId - Parent program
 * @param name - Integration display name
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    type: typeValidator,
    sourceSystem: v.string(),
    targetSystem: v.string(),
    description: v.optional(v.string()),
    status: v.optional(statusValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const integrationId = await ctx.db.insert("integrations", {
      orgId: args.orgId,
      programId: args.programId,
      name: args.name,
      type: args.type,
      sourceSystem: args.sourceSystem,
      targetSystem: args.targetSystem,
      description: args.description,
      status: args.status ?? "planned",
      notes: args.notes,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "integration",
      entityId: integrationId as string,
      action: "create",
      description: `Created integration "${args.name}"`,
    });

    return integrationId;
  },
});

/**
 * Update integration properties.
 * @param integrationId - The integration to update
 */
export const update = mutation({
  args: {
    integrationId: v.id("integrations"),
    name: v.optional(v.string()),
    type: v.optional(typeValidator),
    sourceSystem: v.optional(v.string()),
    targetSystem: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(statusValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await assertOrgAccess(ctx, integration.orgId);

    const { integrationId: _, ...updates } = args;
    const updateObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateObj[key] = value;
      }
    }

    if (Object.keys(updateObj).length > 0) {
      await ctx.db.patch(args.integrationId, updateObj);

      await logAuditEvent(ctx, {
        orgId: integration.orgId,
        programId: integration.programId as string,
        entityType: "integration",
        entityId: args.integrationId as string,
        action: "update",
        description: `Updated integration "${integration.name}"`,
      });
    }
  },
});

export const updateStatus = mutation({
  args: {
    integrationId: v.id("integrations"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await assertOrgAccess(ctx, integration.orgId);

    await ctx.db.patch(args.integrationId, { status: args.status });

    await logAuditEvent(ctx, {
      orgId: integration.orgId,
      programId: integration.programId as string,
      entityType: "integration",
      entityId: args.integrationId as string,
      action: "status_change",
      description: `Changed integration status from "${integration.status}" to "${args.status}"`,
    });
  },
});

export const linkRequirement = mutation({
  args: {
    integrationId: v.id("integrations"),
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await assertOrgAccess(ctx, integration.orgId);

    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new Error("Requirement not found");

    if (integration.programId !== requirement.programId) {
      throw new Error("Integration and requirement must be in the same program");
    }

    const current = integration.requirementIds ?? [];
    if (!current.includes(args.requirementId)) {
      await ctx.db.patch(args.integrationId, {
        requirementIds: [...current, args.requirementId],
      });

      await logAuditEvent(ctx, {
        orgId: integration.orgId,
        programId: integration.programId as string,
        entityType: "integration",
        entityId: args.integrationId as string,
        action: "update",
        description: `Linked requirement "${requirement.refId}" to integration "${integration.name}"`,
      });
    }
  },
});

export const unlinkRequirement = mutation({
  args: {
    integrationId: v.id("integrations"),
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await assertOrgAccess(ctx, integration.orgId);

    const current = integration.requirementIds ?? [];
    await ctx.db.patch(args.integrationId, {
      requirementIds: current.filter((id) => id !== args.requirementId),
    });

    const requirement = await ctx.db.get(args.requirementId);
    const reqLabel = requirement ? requirement.refId : args.requirementId;

    await logAuditEvent(ctx, {
      orgId: integration.orgId,
      programId: integration.programId as string,
      entityType: "integration",
      entityId: args.integrationId as string,
      action: "update",
      description: `Unlinked requirement "${reqLabel}" from integration "${integration.name}"`,
    });
  },
});

/** Delete an integration. Only integrations with "planned" status can be deleted. */
export const remove = mutation({
  args: {
    integrationId: v.id("integrations"),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await assertOrgAccess(ctx, integration.orgId);

    if (integration.status !== "planned") {
      throw new Error("Only integrations with 'planned' status can be deleted");
    }

    await ctx.db.delete(args.integrationId);

    await logAuditEvent(ctx, {
      orgId: integration.orgId,
      programId: integration.programId as string,
      entityType: "integration",
      entityId: args.integrationId as string,
      action: "delete",
      description: `Deleted integration "${integration.name}"`,
    });
  },
});
