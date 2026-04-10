import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess, getAuthUser } from "./model/access";
import { logAuditEvent } from "./model/audit";

const typeValidator = v.union(
  v.literal("requirement"),
  v.literal("risk"),
  v.literal("integration"),
  v.literal("decision"),
  v.literal("action_item"),
);

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("imported"),
  v.literal("edited"),
);

const _confidenceValidator = v.union(v.literal("high"), v.literal("medium"), v.literal("low"));
const mergeStrategyValidator = v.union(
  v.literal("append_description"),
  v.literal("replace_description"),
  v.literal("update_fields"),
);

// Valid values for target tables (used during import)
const VALID_PRIORITIES = ["must_have", "should_have", "nice_to_have", "deferred"] as const;
const VALID_FIT_GAPS = ["native", "config", "custom_dev", "third_party", "not_feasible"] as const;
const VALID_SEVERITIES = ["critical", "high", "medium", "low"] as const;
const VALID_PROBABILITIES = ["very_likely", "likely", "possible", "unlikely"] as const;
const VALID_INTEGRATION_TYPES = [
  "api",
  "webhook",
  "file_transfer",
  "database",
  "middleware",
  "other",
] as const;
const VALID_TASK_PRIORITIES = ["critical", "high", "medium", "low"] as const;
const VALID_TASK_STATUSES = ["backlog", "todo", "in_progress", "review", "done"] as const;
const FINDING_LOCK_KEY = "__lock";
const FINDING_LOCK_TTL_MS = 30_000;

function isValidValue<T extends string>(value: unknown, valid: readonly T[]): value is T {
  return typeof value === "string" && (valid as readonly string[]).includes(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapRequirementImportStatus(
  status: "draft" | "active" | "deferred" | undefined,
): "draft" | "approved" | "deferred" {
  if (status === "active") return "approved";
  if (status === "deferred") return "deferred";
  return "draft";
}

async function logActivityEvent(
  ctx: any,
  args: {
    orgId: string;
    programId: any;
    userId: any;
    userName: string;
    eventType: string;
    message: string;
    entityType?: string;
    entityId?: string;
    metadata?: unknown;
  },
) {
  await ctx.db.insert("activityEvents", {
    orgId: args.orgId,
    programId: args.programId,
    page: "discovery",
    eventType: args.eventType,
    message: args.message,
    entityType: args.entityType,
    entityId: args.entityId,
    metadata: args.metadata,
    userId: args.userId,
    userName: args.userName,
    createdAt: Date.now(),
  });
}

// ── Queries ──────────────────────────────────────────────────────────

/**
 * List discovery findings for a program with optional type and status filters.
 * Returns enriched records with source document names.
 * @param programId - The program to query
 */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    type: v.optional(typeValidator),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    let findings;
    if (args.type !== undefined) {
      findings = await ctx.db
        .query("discoveryFindings")
        .withIndex("by_program_type", (q) =>
          q.eq("programId", args.programId).eq("type", args.type!),
        )
        .collect();
    } else if (args.status !== undefined) {
      findings = await ctx.db
        .query("discoveryFindings")
        .withIndex("by_program_status", (q) =>
          q.eq("programId", args.programId).eq("status", args.status!),
        )
        .collect();
    } else {
      findings = await ctx.db
        .query("discoveryFindings")
        .withIndex("by_program_type", (q) => q.eq("programId", args.programId))
        .collect();
    }

    // JS-level filtering for remaining criteria
    if (args.type !== undefined && args.status !== undefined) {
      findings = findings.filter((f) => f.status === args.status);
    }

    // Join document name
    const enriched = await Promise.all(
      findings.map(async (finding) => {
        const doc = await ctx.db.get(finding.documentId);
        return {
          ...finding,
          documentName: doc?.fileName ?? "Unknown",
        };
      }),
    );

    return enriched;
  },
});

/** List all discovery findings extracted from a specific document. */
export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ConvexError("Document not found");
    await assertOrgAccess(ctx, doc.orgId);

    const findings = await ctx.db
      .query("discoveryFindings")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Sort by type
    const typeOrder: Record<string, number> = {
      requirement: 0,
      risk: 1,
      integration: 2,
      decision: 3,
      action_item: 4,
    };
    findings.sort((a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99));

    return findings;
  },
});

/** Count findings awaiting review (status = "pending") for a program. */
export const countPending = query({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const findings = await ctx.db
      .query("discoveryFindings")
      .withIndex("by_program_status", (q) =>
        q.eq("programId", args.programId).eq("status", "pending"),
      )
      .collect();

    return { count: findings.length };
  },
});

export const countByStatus = query({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const findings = await ctx.db
      .query("discoveryFindings")
      .withIndex("by_program_status", (q) => q.eq("programId", args.programId))
      .collect();

    const counts: Record<string, number> = {
      pending: 0,
      approved: 0,
      edited: 0,
      rejected: 0,
      imported: 0,
      total: findings.length,
    };

    for (const finding of findings) {
      if (finding.status in counts) {
        counts[finding.status]++;
      }
    }

    return counts;
  },
});

// ── Internal Queries ─────────────────────────────────────────────────

export const listTitlesByAnalysis = internalQuery({
  args: {
    analysisId: v.id("documentAnalyses"),
  },
  handler: async (ctx, args) => {
    const findings = await ctx.db
      .query("discoveryFindings")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();

    return findings
      .map((f) => {
        const data = f.data as Record<string, unknown> | null;
        return typeof data?.title === "string" ? data.title : null;
      })
      .filter((title): title is string => title !== null);
  },
});

// ── Mutations ────────────────────────────────────────────────────────

/**
 * Review a single discovery finding (approve or reject).
 * @param findingId - The finding to review
 * @param status - Review decision (approved or rejected)
 */
export const reviewFinding = mutation({
  args: {
    findingId: v.id("discoveryFindings"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new ConvexError("Finding not found");
    await assertOrgAccess(ctx, finding.orgId);

    const user = await getAuthUser(ctx);

    await ctx.db.patch(args.findingId, {
      status: args.status,
      reviewedBy: user._id,
      reviewedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      orgId: finding.orgId,
      programId: finding.programId as string,
      entityType: "discoveryFinding",
      entityId: args.findingId as string,
      action: "status_change",
      description: `${args.status === "approved" ? "Approved" : "Rejected"} ${finding.type} finding`,
    });

    await logActivityEvent(ctx, {
      orgId: finding.orgId,
      programId: finding.programId,
      userId: user._id,
      userName: user.name,
      eventType: args.status === "approved" ? "finding_approved" : "finding_rejected",
      message: `${args.status === "approved" ? "Approved" : "Rejected"} ${finding.type} finding`,
      entityType: "finding",
      entityId: args.findingId as string,
    });
  },
});

export const editFinding = mutation({
  args: {
    findingId: v.id("discoveryFindings"),
    editedData: v.any(),
  },
  handler: async (ctx, args) => {
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new ConvexError("Finding not found");
    await assertOrgAccess(ctx, finding.orgId);

    await ctx.db.patch(args.findingId, {
      editedData: args.editedData,
      status: "edited",
    });

    await logAuditEvent(ctx, {
      orgId: finding.orgId,
      programId: finding.programId as string,
      entityType: "discoveryFinding",
      entityId: args.findingId as string,
      action: "update",
      description: `Edited ${finding.type} finding data`,
    });
  },
});

/**
 * Batch review multiple findings at once.
 * @param findingIds - Array of finding IDs to review
 * @param status - Review decision applied to all
 */
export const bulkReviewFindings = mutation({
  args: {
    findingIds: v.array(v.id("discoveryFindings")),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    if (args.findingIds.length > 100) {
      throw new ConvexError("Cannot review more than 100 findings at once");
    }
    if (args.findingIds.length === 0) {
      return { updated: 0 };
    }

    // Validate access from the first finding
    const firstFinding = await ctx.db.get(args.findingIds[0]);
    if (!firstFinding) throw new ConvexError("Finding not found");
    await assertOrgAccess(ctx, firstFinding.orgId);

    const user = await getAuthUser(ctx);
    const now = Date.now();

    for (const findingId of args.findingIds) {
      const finding = await ctx.db.get(findingId);
      if (finding) {
        await ctx.db.patch(findingId, {
          status: args.status,
          reviewedBy: user._id,
          reviewedAt: now,
        });
      }
    }

    await logAuditEvent(ctx, {
      orgId: firstFinding.orgId,
      programId: firstFinding.programId as string,
      entityType: "discoveryFinding",
      entityId: "bulk",
      action: "status_change",
      description: `Bulk ${args.status} ${args.findingIds.length} findings`,
      metadata: { count: args.findingIds.length, status: args.status },
    });

    await logActivityEvent(ctx, {
      orgId: firstFinding.orgId,
      programId: firstFinding.programId,
      userId: user._id,
      userName: user.name,
      eventType: args.status === "approved" ? "findings_bulk_approved" : "findings_bulk_rejected",
      message: `Bulk ${args.status} ${args.findingIds.length} findings`,
      entityType: "finding",
      entityId: "bulk",
      metadata: { count: args.findingIds.length },
    });

    return { updated: args.findingIds.length };
  },
});

/**
 * Convert all approved discovery findings into requirements. Each approved
 * finding becomes a new requirement with auto-generated refId.
 * @param programId - The program to import into
 * @param status - Initial status for created requirements (default: draft)
 */
export const importApprovedFindings = mutation({
  args: {
    programId: v.id("programs"),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("deferred"))),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);
    const user = await getAuthUser(ctx);

    // Query approved and edited findings
    const approvedFindings = await ctx.db
      .query("discoveryFindings")
      .withIndex("by_program_status", (q) =>
        q.eq("programId", args.programId).eq("status", "approved"),
      )
      .collect();

    const editedFindings = await ctx.db
      .query("discoveryFindings")
      .withIndex("by_program_status", (q) =>
        q.eq("programId", args.programId).eq("status", "edited"),
      )
      .collect();

    const findings = [...approvedFindings, ...editedFindings];
    const requirementStatus = mapRequirementImportStatus(args.status);

    if (findings.length === 0) {
      return {
        requirements: 0,
        risks: 0,
        integrations: 0,
        decisions: 0,
        tasks: 0,
      };
    }

    // Pre-fetch workstreams for name matching
    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Count existing requirements for refId generation
    const existingRequirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    let reqCounter = existingRequirements.length;

    const counts = {
      requirements: 0,
      risks: 0,
      integrations: 0,
      decisions: 0,
      tasks: 0,
    };

    for (const finding of findings) {
      const data = (finding.editedData ?? finding.data) as Record<string, unknown>;

      switch (finding.type) {
        case "requirement": {
          reqCounter++;
          const refId = `REQ-${String(reqCounter).padStart(3, "0")}`;

          // Match suggestedWorkstream to actual workstream
          let workstreamId: undefined | (typeof workstreams)[0]["_id"];
          if (finding.suggestedWorkstream) {
            const match = workstreams.find(
              (ws) =>
                ws.name.toLowerCase().includes(finding.suggestedWorkstream?.toLowerCase() ?? "") ||
                ws.shortCode
                  .toLowerCase()
                  .includes(finding.suggestedWorkstream?.toLowerCase() ?? ""),
            );
            if (match) workstreamId = match._id;
          }

          const priority = isValidValue(data.priority, VALID_PRIORITIES)
            ? data.priority
            : "should_have";
          const fitGap = isValidValue(data.fitGap, VALID_FIT_GAPS) ? data.fitGap : "custom_dev";

          const reqId = await ctx.db.insert("requirements", {
            orgId: program.orgId,
            programId: args.programId,
            workstreamId,
            refId,
            title: typeof data.title === "string" ? data.title : "Untitled",
            description: typeof data.description === "string" ? data.description : undefined,
            priority,
            fitGap,
            effortEstimate: isValidValue(data.effortEstimate, [
              "low",
              "medium",
              "high",
              "very_high",
            ] as const)
              ? data.effortEstimate
              : undefined,
            status: requirementStatus,
          });

          await ctx.db.patch(finding._id, {
            status: "imported",
            importedAs: { type: "requirement", id: reqId },
          });
          counts.requirements++;
          break;
        }

        case "risk": {
          const severity = isValidValue(data.severity, VALID_SEVERITIES) ? data.severity : "medium";
          const probability = isValidValue(data.probability, VALID_PROBABILITIES)
            ? data.probability
            : "possible";

          const riskId = await ctx.db.insert("risks", {
            orgId: program.orgId,
            programId: args.programId,
            title: typeof data.title === "string" ? data.title : "Untitled",
            description: typeof data.description === "string" ? data.description : undefined,
            severity,
            probability,
            mitigation: typeof data.mitigation === "string" ? data.mitigation : undefined,
            status: "open",
          });

          await ctx.db.patch(finding._id, {
            status: "imported",
            importedAs: { type: "risk", id: riskId },
          });
          counts.risks++;
          break;
        }

        case "integration": {
          const intType = isValidValue(data.type, VALID_INTEGRATION_TYPES)
            ? data.type
            : isValidValue(data.protocol, VALID_INTEGRATION_TYPES)
              ? data.protocol
              : "other";

          // Build description from AI data fields
          const descParts: string[] = [];
          if (typeof data.description === "string") descParts.push(data.description);
          if (typeof data.direction === "string") descParts.push(`Direction: ${data.direction}`);
          if (Array.isArray(data.dataEntities) && data.dataEntities.length > 0)
            descParts.push(`Data entities: ${data.dataEntities.join(", ")}`);
          if (typeof data.complexity === "string") descParts.push(`Complexity: ${data.complexity}`);

          const integrationId = await ctx.db.insert("integrations", {
            orgId: program.orgId,
            programId: args.programId,
            name: typeof data.name === "string" ? data.name : "Untitled",
            type: intType,
            sourceSystem: typeof data.sourceSystem === "string" ? data.sourceSystem : "Unknown",
            targetSystem: typeof data.targetSystem === "string" ? data.targetSystem : "Unknown",
            description: descParts.length > 0 ? descParts.join(". ") : undefined,
            status: "planned",
          });

          await ctx.db.patch(finding._id, {
            status: "imported",
            importedAs: { type: "integration", id: integrationId },
          });
          counts.integrations++;
          break;
        }

        case "decision": {
          // No decisions table — store via audit log
          await logAuditEvent(ctx, {
            orgId: program.orgId,
            programId: args.programId as string,
            entityType: "decision",
            entityId: finding._id as string,
            action: "create",
            description: `Imported decision: ${typeof data.title === "string" ? data.title : "Untitled"}`,
            metadata: data,
          });

          await ctx.db.patch(finding._id, {
            status: "imported",
            importedAs: { type: "decision", id: finding._id },
          });
          counts.decisions++;
          break;
        }

        case "action_item": {
          // Match suggestedWorkstream to actual workstream
          let workstreamId: undefined | (typeof workstreams)[0]["_id"];
          if (finding.suggestedWorkstream) {
            const match = workstreams.find(
              (ws) =>
                ws.name.toLowerCase().includes(finding.suggestedWorkstream?.toLowerCase() ?? "") ||
                ws.shortCode
                  .toLowerCase()
                  .includes(finding.suggestedWorkstream?.toLowerCase() ?? ""),
            );
            if (match) workstreamId = match._id;
          }

          const priority = isValidValue(data.priority, VALID_TASK_PRIORITIES)
            ? data.priority
            : "medium";
          const status = isValidValue(data.status, VALID_TASK_STATUSES) ? data.status : "backlog";

          const taskId = await ctx.db.insert("tasks", {
            orgId: program.orgId,
            programId: args.programId,
            workstreamId,
            title:
              typeof data.title === "string"
                ? data.title
                : typeof data.action === "string"
                  ? data.action
                  : "Untitled action item",
            description: typeof data.description === "string" ? data.description : undefined,
            priority,
            status,
            dueDate: typeof data.dueDate === "number" ? data.dueDate : undefined,
          });

          await ctx.db.patch(finding._id, {
            status: "imported",
            importedAs: { type: "task", id: taskId },
          });
          counts.tasks++;
          break;
        }
      }
    }

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "discoveryFinding",
      entityId: args.programId as string,
      action: "create",
      description: `Imported ${findings.length} findings: ${counts.requirements} requirements, ${counts.risks} risks, ${counts.integrations} integrations, ${counts.decisions} decisions, ${counts.tasks} tasks`,
      metadata: counts,
    });

    await logActivityEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId,
      userId: user._id,
      userName: user.name,
      eventType: "findings_imported",
      message: `Imported ${findings.length} findings`,
      entityType: "finding",
      entityId: args.programId as string,
      metadata: counts,
    });

    return counts;
  },
});

export const mergeFindingIntoRequirement = mutation({
  args: {
    findingId: v.id("discoveryFindings"),
    requirementId: v.id("requirements"),
    mergeStrategy: mergeStrategyValidator,
  },
  handler: async (ctx, args) => {
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new ConvexError("Finding not found");
    await assertOrgAccess(ctx, finding.orgId);
    const user = await getAuthUser(ctx);

    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found");
    if (requirement.programId !== finding.programId) {
      throw new ConvexError("Requirement and finding must belong to the same program");
    }
    if (requirement.orgId !== finding.orgId) {
      throw new ConvexError("Requirement and finding must belong to the same org");
    }
    if (finding.type !== "requirement") {
      throw new ConvexError("Only requirement findings can be merged into requirements");
    }

    // Merge editedData on top of data so lock-only editedData doesn't shadow content fields
    const baseData = asRecord(finding.data) ?? {};
    const editedOverrides = asRecord(finding.editedData) ?? {};
    const data = { ...baseData, ...editedOverrides };
    const updates: Record<string, unknown> = {};

    // Resolve merge text: prefer description, fall back to title/name/action
    // (matches the fallback chain used in MergeableFindingCard.getTitle)
    const findingTitle =
      typeof data.title === "string" && data.title.trim().length > 0
        ? data.title
        : typeof data.name === "string" && data.name.trim().length > 0
          ? data.name
          : typeof data.action === "string" && data.action.trim().length > 0
            ? data.action
            : null;
    const descriptionText =
      typeof data.description === "string" && data.description.trim().length > 0
        ? data.description
        : findingTitle;

    if (args.mergeStrategy === "append_description") {
      if (!descriptionText) {
        throw new ConvexError("Finding has no description or title to append");
      }
      updates.description = requirement.description
        ? `${requirement.description}\n\n${descriptionText}`
        : descriptionText;
    } else if (args.mergeStrategy === "replace_description") {
      if (!descriptionText) {
        throw new ConvexError("Finding has no description or title to replace with");
      }
      updates.description = descriptionText;
    } else {
      if (typeof data.title === "string" && data.title.trim().length > 0) {
        updates.title = data.title;
      }
      if (typeof data.description === "string") {
        updates.description = data.description;
      }
      if (isValidValue(data.priority, VALID_PRIORITIES)) {
        updates.priority = data.priority;
      }
      if (isValidValue(data.fitGap, VALID_FIT_GAPS)) {
        updates.fitGap = data.fitGap;
      }
      if (isValidValue(data.effortEstimate, ["low", "medium", "high", "very_high"] as const)) {
        updates.effortEstimate = data.effortEstimate;
      }
      if (isValidValue(data.deliveryPhase, ["phase_1", "phase_2", "phase_3"] as const)) {
        updates.deliveryPhase = data.deliveryPhase;
      }
      if (Object.keys(updates).length === 0) {
        throw new ConvexError("No compatible requirement fields found to update");
      }
    }

    await ctx.db.patch(args.requirementId, updates);

    await ctx.db.patch(args.findingId, {
      status: "imported",
      importedAs: {
        type: "requirement",
        id: args.requirementId,
        mergeStrategy: args.mergeStrategy,
        mergedAt: Date.now(),
      },
    });

    await logAuditEvent(ctx, {
      orgId: finding.orgId,
      programId: finding.programId as string,
      entityType: "discoveryFinding",
      entityId: args.findingId as string,
      action: "update",
      description: `Merged finding into requirement (${args.mergeStrategy})`,
      metadata: {
        requirementId: args.requirementId,
      },
    });

    await logActivityEvent(ctx, {
      orgId: finding.orgId,
      programId: finding.programId,
      userId: user._id,
      userName: user.name,
      eventType: "finding_merged",
      message: `Merged finding into ${requirement.refId}`,
      entityType: "finding",
      entityId: args.findingId as string,
      metadata: {
        requirementId: args.requirementId,
        mergeStrategy: args.mergeStrategy,
      },
    });

    return {
      merged: true,
      updatedFields: Object.keys(updates),
    };
  },
});

export const revertImport = mutation({
  args: {
    findingIds: v.array(v.id("discoveryFindings")),
  },
  handler: async (ctx, args) => {
    if (args.findingIds.length > 100) {
      throw new ConvexError("Cannot revert more than 100 findings at once");
    }
    if (args.findingIds.length === 0) {
      return {
        reverted: 0,
        deleted: { requirements: 0, risks: 0, integrations: 0, tasks: 0 },
        skipped: 0,
        failed: 0,
      };
    }

    const firstFinding = await ctx.db.get(args.findingIds[0]);
    if (!firstFinding) throw new ConvexError("Finding not found");
    await assertOrgAccess(ctx, firstFinding.orgId);
    const user = await getAuthUser(ctx);

    const deleted = { requirements: 0, risks: 0, integrations: 0, tasks: 0 };
    let reverted = 0;
    let skipped = 0;
    let failed = 0;

    for (const findingId of args.findingIds) {
      const finding = await ctx.db.get(findingId);
      if (!finding) {
        skipped++;
        continue;
      }

      if (finding.orgId !== firstFinding.orgId) {
        throw new ConvexError("All findings in one request must belong to the same organization");
      }

      const importedAs = asRecord(finding.importedAs);
      const importedType = typeof importedAs?.type === "string" ? importedAs.type : null;
      const importedId = importedAs?.id;

      try {
        if (
          importedType &&
          importedId &&
          (finding.status === "imported" || finding.status === "edited")
        ) {
          if (importedType === "requirement") {
            const entity = await ctx.db.get(importedId as any);
            if (entity) {
              await ctx.db.delete(importedId as any);
              deleted.requirements++;
            } else {
              skipped++;
            }
          } else if (importedType === "risk") {
            const entity = await ctx.db.get(importedId as any);
            if (entity) {
              await ctx.db.delete(importedId as any);
              deleted.risks++;
            } else {
              skipped++;
            }
          } else if (importedType === "integration") {
            const entity = await ctx.db.get(importedId as any);
            if (entity) {
              await ctx.db.delete(importedId as any);
              deleted.integrations++;
            } else {
              skipped++;
            }
          } else if (importedType === "task") {
            const entity = await ctx.db.get(importedId as any);
            if (entity) {
              await ctx.db.delete(importedId as any);
              deleted.tasks++;
            } else {
              skipped++;
            }
          } else {
            // "decision" and unknown imported types are not deletable entities.
            skipped++;
          }
        } else {
          skipped++;
        }
      } catch {
        failed++;
      }

      await ctx.db.patch(findingId, {
        status: "approved",
        importedAs: undefined,
      });
      reverted++;
    }

    await logAuditEvent(ctx, {
      orgId: firstFinding.orgId,
      programId: firstFinding.programId as string,
      entityType: "discoveryFinding",
      entityId: "bulk_revert",
      action: "update",
      description: `Reverted imports for ${reverted} findings`,
      metadata: {
        reverted,
        deleted,
        skipped,
        failed,
      },
    });

    await logActivityEvent(ctx, {
      orgId: firstFinding.orgId,
      programId: firstFinding.programId,
      userId: user._id,
      userName: user.name,
      eventType: "import_reverted",
      message: `Reverted ${reverted} imported findings`,
      entityType: "finding",
      entityId: "bulk_revert",
      metadata: {
        reverted,
        deleted,
      },
    });

    return {
      reverted,
      deleted,
      skipped,
      failed,
    };
  },
});

export const acquireLock = mutation({
  args: {
    findingId: v.id("discoveryFindings"),
  },
  handler: async (ctx, args) => {
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new ConvexError("Finding not found");
    await assertOrgAccess(ctx, finding.orgId);

    const user = await getAuthUser(ctx);
    const userId = user._id as string;
    const now = Date.now();

    const editedData = finding.editedData === undefined ? {} : asRecord(finding.editedData);
    if (!editedData) {
      throw new ConvexError("Cannot acquire lock when editedData is not an object");
    }

    const existingLock = asRecord(editedData[FINDING_LOCK_KEY]);
    const existingExpiresAt =
      typeof existingLock?.expiresAt === "number" ? existingLock.expiresAt : 0;
    const existingUserId = typeof existingLock?.userId === "string" ? existingLock.userId : null;

    if (existingLock && existingExpiresAt > now && existingUserId && existingUserId !== userId) {
      return {
        acquired: false,
        lockedBy: existingUserId,
        lockedByName: typeof existingLock.userName === "string" ? existingLock.userName : undefined,
        expiresAt: existingExpiresAt,
      };
    }

    const expiresAt = now + FINDING_LOCK_TTL_MS;
    const nextEditedData: Record<string, unknown> = {
      ...editedData,
      [FINDING_LOCK_KEY]: {
        userId,
        userName: user.name,
        acquiredAt: now,
        expiresAt,
      },
    };

    await ctx.db.patch(args.findingId, {
      editedData: nextEditedData,
    });

    return {
      acquired: true,
      lock: nextEditedData[FINDING_LOCK_KEY],
    };
  },
});

export const releaseLock = mutation({
  args: {
    findingId: v.id("discoveryFindings"),
  },
  handler: async (ctx, args) => {
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new ConvexError("Finding not found");
    await assertOrgAccess(ctx, finding.orgId);

    const user = await getAuthUser(ctx);
    const userId = user._id as string;
    const now = Date.now();

    const editedData = asRecord(finding.editedData);
    if (!editedData) {
      return { released: false, reason: "no_lock" };
    }

    const existingLock = asRecord(editedData[FINDING_LOCK_KEY]);
    if (!existingLock) {
      return { released: false, reason: "no_lock" };
    }

    const existingUserId = typeof existingLock.userId === "string" ? existingLock.userId : null;
    const existingExpiresAt =
      typeof existingLock.expiresAt === "number" ? existingLock.expiresAt : 0;

    if (existingUserId && existingUserId !== userId && existingExpiresAt > now) {
      throw new ConvexError("Lock is currently held by another user");
    }

    const nextEditedData = { ...editedData };
    delete nextEditedData[FINDING_LOCK_KEY];

    await ctx.db.patch(args.findingId, {
      editedData: Object.keys(nextEditedData).length > 0 ? nextEditedData : undefined,
    });

    return { released: true };
  },
});
