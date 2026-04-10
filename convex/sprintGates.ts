import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess, getAuthUser } from "./model/access";
import { logAuditEvent } from "./model/audit";

const gateTypeValidator = v.union(
  v.literal("foundation"),
  v.literal("development"),
  v.literal("integration"),
  v.literal("release"),
);

const _gateStatusValidator = v.union(
  v.literal("pending"),
  v.literal("passed"),
  v.literal("failed"),
  v.literal("overridden"),
);

const approvalStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
);

const _criterionValidator = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  passed: v.boolean(),
  evidence: v.optional(v.string()),
});

/** List all sprint gates for a program, sorted by workstream then name. */
export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const gates = await ctx.db
      .query("sprintGates")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    gates.sort((a, b) => {
      const wsCmp = a.workstreamId.localeCompare(b.workstreamId);
      if (wsCmp !== 0) return wsCmp;
      return a.name.localeCompare(b.name);
    });

    return gates;
  },
});

/** List sprint gates belonging to a specific workstream. */
export const listByWorkstream = query({
  args: { workstreamId: v.id("workstreams") },
  handler: async (ctx, args) => {
    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new ConvexError("Workstream not found");
    await assertOrgAccess(ctx, workstream.orgId);

    return await ctx.db
      .query("sprintGates")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .collect();
  },
});

/** Retrieve a single sprint gate by ID with resolved approval user names. */
export const get = query({
  args: { gateId: v.id("sprintGates") },
  handler: async (ctx, args) => {
    const gate = await ctx.db.get(args.gateId);
    if (!gate) throw new ConvexError("Sprint gate not found");
    await assertOrgAccess(ctx, gate.orgId);

    const resolvedApprovals = await Promise.all(
      gate.approvals.map(async (approval) => {
        const user = await ctx.db.get(approval.userId);
        return {
          ...approval,
          userName: user?.name ?? "Unknown User",
        };
      }),
    );

    return {
      ...gate,
      approvals: resolvedApprovals,
    };
  },
});

/**
 * Create a new sprint gate with criteria and initial pending status.
 * @param orgId - Organization ID
 * @param programId - Parent program
 * @param workstreamId - Parent workstream
 * @param name - Gate display name
 * @param gateType - Gate category (e.g., foundation, release)
 * @param criteria - Array of pass/fail criteria
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.id("workstreams"),
    name: v.string(),
    gateType: gateTypeValidator,
    criteria: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const criteriaWithStatus = args.criteria.map((c) => ({
      ...c,
      passed: false,
    }));

    const gateId = await ctx.db.insert("sprintGates", {
      orgId: args.orgId,
      programId: args.programId,
      workstreamId: args.workstreamId,
      name: args.name,
      gateType: args.gateType,
      criteria: criteriaWithStatus,
      approvals: [],
      status: "pending",
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "gate",
      entityId: gateId as string,
      action: "create",
      description: `Created sprint gate "${args.name}"`,
    });

    return gateId;
  },
});

// 5. Update gate metadata (name, gateType only)
export const update = mutation({
  args: {
    gateId: v.id("sprintGates"),
    name: v.optional(v.string()),
    gateType: v.optional(gateTypeValidator),
  },
  handler: async (ctx, args) => {
    const gate = await ctx.db.get(args.gateId);
    if (!gate) throw new ConvexError("Sprint gate not found");
    await assertOrgAccess(ctx, gate.orgId);

    const patch: Record<string, string> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.gateType !== undefined) patch.gateType = args.gateType;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.gateId, patch);
    }
  },
});

/**
 * Mark a specific criterion within a gate as passed or failed.
 * @param gateId - The sprint gate
 * @param criterionIndex - Zero-based index of the criterion
 * @param passed - Whether the criterion passed
 * @param evidence - Optional evidence or notes
 */
export const evaluateCriterion = mutation({
  args: {
    gateId: v.id("sprintGates"),
    criterionIndex: v.number(),
    passed: v.boolean(),
    evidence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const gate = await ctx.db.get(args.gateId);
    if (!gate) throw new ConvexError("Sprint gate not found");
    await assertOrgAccess(ctx, gate.orgId);

    if (args.criterionIndex < 0 || args.criterionIndex >= gate.criteria.length) {
      throw new ConvexError("Criterion index out of bounds");
    }

    const updatedCriteria = [...gate.criteria];
    updatedCriteria[args.criterionIndex] = {
      ...updatedCriteria[args.criterionIndex],
      passed: args.passed,
      evidence: args.evidence,
    };

    await ctx.db.patch(args.gateId, { criteria: updatedCriteria });
  },
});

/**
 * Add the current user as an approver on a gate.
 * @param gateId - The sprint gate
 * @param role - The role under which the user is approving
 */
export const addApproval = mutation({
  args: {
    gateId: v.id("sprintGates"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const gate = await ctx.db.get(args.gateId);
    if (!gate) throw new ConvexError("Sprint gate not found");
    await assertOrgAccess(ctx, gate.orgId);

    const user = await getAuthUser(ctx);

    const existing = gate.approvals.find((a) => a.userId === user._id);
    if (existing) {
      throw new ConvexError("User already has an approval entry for this gate");
    }

    const updatedApprovals = [
      ...gate.approvals,
      {
        userId: user._id,
        role: args.role,
        status: "pending" as const,
      },
    ];

    await ctx.db.patch(args.gateId, { approvals: updatedApprovals });
  },
});

// 8. Update an existing approval's status
export const updateApproval = mutation({
  args: {
    gateId: v.id("sprintGates"),
    status: approvalStatusValidator,
  },
  handler: async (ctx, args) => {
    const gate = await ctx.db.get(args.gateId);
    if (!gate) throw new ConvexError("Sprint gate not found");
    await assertOrgAccess(ctx, gate.orgId);

    const user = await getAuthUser(ctx);

    const approvalIndex = gate.approvals.findIndex((a) => a.userId === user._id);
    if (approvalIndex === -1) {
      throw new ConvexError("No approval entry found for this user");
    }

    const updatedApprovals = [...gate.approvals];
    updatedApprovals[approvalIndex] = {
      ...updatedApprovals[approvalIndex],
      status: args.status,
      timestamp: Date.now(),
    };

    await ctx.db.patch(args.gateId, { approvals: updatedApprovals });
  },
});

/**
 * Finalize a gate by evaluating all criteria and approvals. Sets status to
 * "passed" if all criteria pass and all approvals are granted, otherwise "failed".
 * @param gateId - The sprint gate to finalize
 */
export const finalize = mutation({
  args: { gateId: v.id("sprintGates") },
  handler: async (ctx, args) => {
    const gate = await ctx.db.get(args.gateId);
    if (!gate) throw new ConvexError("Sprint gate not found");
    await assertOrgAccess(ctx, gate.orgId);

    const allCriteriaPassed = gate.criteria.every((c) => c.passed);
    const allApprovalsApproved =
      gate.approvals.length > 0 && gate.approvals.every((a) => a.status === "approved");

    const status = allCriteriaPassed && allApprovalsApproved ? "passed" : "failed";

    await ctx.db.patch(args.gateId, {
      status,
      evaluatedAt: Date.now(),
    });
  },
});

// 10. Override gate status
export const override = mutation({
  args: { gateId: v.id("sprintGates") },
  handler: async (ctx, args) => {
    const gate = await ctx.db.get(args.gateId);
    if (!gate) throw new ConvexError("Sprint gate not found");
    await assertOrgAccess(ctx, gate.orgId);

    await ctx.db.patch(args.gateId, {
      status: "overridden",
      evaluatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Internal query for Phase 3 AI features
// ---------------------------------------------------------------------------

export const getCriteria = internalQuery({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) return [];

    const gates = await ctx.db
      .query("sprintGates")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", sprint.workstreamId))
      .collect();

    return gates.map((g) => ({
      id: g._id,
      name: g.name,
      required: g.gateType === "foundation" || g.gateType === "release",
      status: g.status,
      completionPercent:
        (g.criteria.filter((c) => c.passed).length / Math.max(g.criteria.length, 1)) * 100,
    }));
  },
});

/**
 * Delete a sprint gate. Only gates with "pending" status can be deleted.
 * @param gateId - The gate to delete
 */
export const remove = mutation({
  args: { gateId: v.id("sprintGates") },
  handler: async (ctx, args) => {
    const gate = await ctx.db.get(args.gateId);
    if (!gate) throw new ConvexError("Sprint gate not found");
    await assertOrgAccess(ctx, gate.orgId);

    if (gate.status !== "pending") {
      throw new ConvexError("Can only delete gates with pending status");
    }

    await ctx.db.delete(args.gateId);
  },
});
