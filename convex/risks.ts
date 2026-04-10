import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const severityValidator = v.union(
  v.literal("critical"),
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

const probabilityValidator = v.union(
  v.literal("very_likely"),
  v.literal("likely"),
  v.literal("possible"),
  v.literal("unlikely"),
);

const statusValidator = v.union(
  v.literal("open"),
  v.literal("mitigating"),
  v.literal("resolved"),
  v.literal("accepted"),
);

// ── Queries ──────────────────────────────────────────────────────────

/**
 * List risks for a program with optional severity and status filters.
 * Returns enriched records with resolved workstream names and owner names,
 * sorted by severity (descending) then title.
 * @param programId - The program to query
 */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    severity: v.optional(severityValidator),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const risks = await ctx.db
      .query("risks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // JS-level filtering for optional params (cannot compound-index these)
    let filtered = risks;
    if (args.severity !== undefined) {
      filtered = filtered.filter((r) => r.severity === args.severity);
    }
    if (args.status !== undefined) {
      filtered = filtered.filter((r) => r.status === args.status);
    }

    // Resolve workstream names for display
    const enriched = await Promise.all(
      filtered.map(async (risk) => {
        const resolvedWorkstreams: { _id: string; name: string; shortCode: string }[] = [];
        if (risk.workstreamIds) {
          for (const wsId of risk.workstreamIds) {
            const ws = await ctx.db.get(wsId);
            if (ws) {
              resolvedWorkstreams.push({
                _id: ws._id,
                name: ws.name,
                shortCode: ws.shortCode,
              });
            }
          }
        }

        let ownerName: string | undefined;
        if (risk.ownerId) {
          const owner = await ctx.db.get(risk.ownerId);
          if (owner) ownerName = owner.name;
        }

        return { ...risk, resolvedWorkstreams, ownerName };
      }),
    );

    // Sort by severity weight descending, then title ascending
    const severityWeight: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    enriched.sort((a, b) => {
      const sw = (severityWeight[b.severity] ?? 0) - (severityWeight[a.severity] ?? 0);
      if (sw !== 0) return sw;
      return a.title.localeCompare(b.title);
    });

    return enriched;
  },
});

/**
 * Retrieve a single risk by ID with resolved owner name and workstream details.
 * @param riskId - The risk to fetch
 */
export const get = query({
  args: { riskId: v.id("risks") },
  handler: async (ctx, args) => {
    const risk = await ctx.db.get(args.riskId);
    if (!risk) throw new ConvexError("Risk not found");
    await assertOrgAccess(ctx, risk.orgId);

    // Resolve owner
    let ownerName: string | undefined;
    if (risk.ownerId) {
      const owner = await ctx.db.get(risk.ownerId);
      if (owner) ownerName = owner.name;
    }

    // Resolve workstreams
    const resolvedWorkstreams: { _id: string; name: string; shortCode: string }[] = [];
    if (risk.workstreamIds) {
      for (const wsId of risk.workstreamIds) {
        const ws = await ctx.db.get(wsId);
        if (ws) {
          resolvedWorkstreams.push({
            _id: ws._id,
            name: ws.name,
            shortCode: ws.shortCode,
          });
        }
      }
    }

    return { ...risk, ownerName, resolvedWorkstreams };
  },
});

// ── Mutations ────────────────────────────────────────────────────────

/**
 * Create a new risk entry for a program.
 * @param orgId - Organization ID
 * @param programId - Parent program
 * @param title - Risk title
 * @param severity - Severity level (critical, high, medium, low)
 * @param probability - Likelihood of occurrence
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    title: v.string(),
    description: v.optional(v.string()),
    severity: severityValidator,
    probability: probabilityValidator,
    mitigation: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    workstreamIds: v.optional(v.array(v.id("workstreams"))),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const riskId = await ctx.db.insert("risks", {
      orgId: args.orgId,
      programId: args.programId,
      title: args.title,
      description: args.description,
      severity: args.severity,
      probability: args.probability,
      mitigation: args.mitigation,
      ownerId: args.ownerId,
      workstreamIds: args.workstreamIds,
      status: args.status ?? "open",
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "risk",
      entityId: riskId as string,
      action: "create",
      description: `Created risk "${args.title}"`,
    });

    return riskId;
  },
});

/**
 * Update risk properties such as title, severity, probability, or mitigation plan.
 * @param riskId - The risk to update
 */
export const update = mutation({
  args: {
    riskId: v.id("risks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    severity: v.optional(severityValidator),
    probability: v.optional(probabilityValidator),
    mitigation: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    workstreamIds: v.optional(v.array(v.id("workstreams"))),
  },
  handler: async (ctx, args) => {
    const risk = await ctx.db.get(args.riskId);
    if (!risk) throw new ConvexError("Risk not found");
    await assertOrgAccess(ctx, risk.orgId);

    const { riskId: _, ...updates } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.riskId, patch);

      await logAuditEvent(ctx, {
        orgId: risk.orgId,
        programId: risk.programId as string,
        entityType: "risk",
        entityId: args.riskId as string,
        action: "update",
        description: `Updated risk "${risk.title}"`,
        metadata: { updatedFields: Object.keys(patch) },
      });
    }
  },
});

/**
 * Transition a risk to a new status (open, mitigating, resolved, accepted).
 * @param riskId - The risk to update
 * @param status - New status value
 */
export const updateStatus = mutation({
  args: {
    riskId: v.id("risks"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const risk = await ctx.db.get(args.riskId);
    if (!risk) throw new ConvexError("Risk not found");
    await assertOrgAccess(ctx, risk.orgId);

    const oldStatus = risk.status;
    await ctx.db.patch(args.riskId, { status: args.status });

    await logAuditEvent(ctx, {
      orgId: risk.orgId,
      programId: risk.programId as string,
      entityType: "risk",
      entityId: args.riskId as string,
      action: "status_change",
      description: `Changed risk "${risk.title}" status from ${oldStatus} to ${args.status}`,
      metadata: { oldStatus, newStatus: args.status },
    });
  },
});

/**
 * Delete a risk. Only risks with status "open" can be deleted.
 * @param riskId - The risk to delete
 */
export const remove = mutation({
  args: { riskId: v.id("risks") },
  handler: async (ctx, args) => {
    const risk = await ctx.db.get(args.riskId);
    if (!risk) throw new ConvexError("Risk not found");
    await assertOrgAccess(ctx, risk.orgId);

    if (risk.status !== "open") {
      throw new ConvexError(
        "Only risks with status 'open' can be deleted. Change status to 'open' first.",
      );
    }

    await ctx.db.delete(args.riskId);

    await logAuditEvent(ctx, {
      orgId: risk.orgId,
      programId: risk.programId as string,
      entityType: "risk",
      entityId: args.riskId as string,
      action: "delete",
      description: `Deleted risk "${risk.title}"`,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal queries/mutations for Phase 3 AI features
// ---------------------------------------------------------------------------

export const getByProgramInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("risks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});

export const createFromAIGeneration = internalMutation({
  args: {
    programId: v.id("programs"),
    orgId: v.string(),
    title: v.string(),
    description: v.string(),
    severity: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    probability: v.union(
      v.literal("very_likely"),
      v.literal("likely"),
      v.literal("possible"),
      v.literal("unlikely"),
    ),
    mitigationSuggestions: v.array(v.string()),
    sourceChangeType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("risks", {
      orgId: args.orgId,
      programId: args.programId,
      title: args.title,
      description: args.description,
      severity: args.severity,
      probability: args.probability,
      mitigation:
        args.mitigationSuggestions.length > 0
          ? `- ${args.mitigationSuggestions.join("\n- ")}`
          : undefined,
      status: "open",
    });
  },
});
