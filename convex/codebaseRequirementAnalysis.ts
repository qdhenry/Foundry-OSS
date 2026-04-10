import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

// ── Validators ──────────────────────────────────────────────────────────

const implementationStatusValidator = v.union(
  v.literal("not_found"),
  v.literal("partially_implemented"),
  v.literal("fully_implemented"),
  v.literal("needs_verification"),
);

const runStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const scopeValidator = v.union(
  v.literal("requirement"),
  v.literal("workstream"),
  v.literal("program"),
  v.literal("task"),
);

const modelTierValidator = v.union(v.literal("fast"), v.literal("standard"), v.literal("thorough"));

const reviewStatusValidator = v.union(
  v.literal("auto_applied"),
  v.literal("pending_review"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("regression_flagged"),
);

// ── Queries ─────────────────────────────────────────────────────────────

export const listRunsByWorkstream = query({
  args: {
    orgId: v.string(),
    workstreamId: v.id("workstreams"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("codebaseAnalysisRuns")
      .withIndex("by_workstream", (q) =>
        q.eq("orgId", args.orgId).eq("workstreamId", args.workstreamId),
      )
      .order("desc")
      .collect();
  },
});

export const listRunsByProgram = query({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("codebaseAnalysisRuns")
      .withIndex("by_org_program", (q) => q.eq("orgId", args.orgId).eq("programId", args.programId))
      .order("desc")
      .collect();
  },
});

export const getRunResults = query({
  args: {
    runId: v.id("codebaseAnalysisRuns"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Analysis run not found");
    await assertOrgAccess(ctx, run.orgId);

    const results = await ctx.db
      .query("codebaseAnalysisResults")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    return await Promise.all(
      results.map(async (r) => {
        const req = await ctx.db.get(r.requirementId);
        return {
          ...r,
          requirementTitle: req?.title ?? "Unknown Requirement",
          requirementRefId: req?.refId ?? "",
        };
      }),
    );
  },
});

export const getLatestResultForRequirement = query({
  args: {
    orgId: v.string(),
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const results = await ctx.db
      .query("codebaseAnalysisResults")
      .withIndex("by_requirement", (q) =>
        q.eq("orgId", args.orgId).eq("requirementId", args.requirementId),
      )
      .order("desc")
      .take(1);
    return results[0] ?? null;
  },
});

export const getPendingReviews = query({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const pending = await ctx.db
      .query("codebaseAnalysisResults")
      .withIndex("by_review_status", (q) =>
        q.eq("orgId", args.orgId).eq("reviewStatus", "pending_review"),
      )
      .collect();
    // Filter to program scope in JS (no composite index on review_status + program)
    return pending.filter((r) => r.programId === args.programId);
  },
});

export const getRegressionFlags = query({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const flagged = await ctx.db
      .query("codebaseAnalysisResults")
      .withIndex("by_review_status", (q) =>
        q.eq("orgId", args.orgId).eq("reviewStatus", "regression_flagged"),
      )
      .collect();
    return flagged.filter((r) => r.programId === args.programId);
  },
});

export const getResultsByProgramWithRequirements = query({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    // Only include results from completed runs to avoid showing partial/unstable data
    const runs = await ctx.db
      .query("codebaseAnalysisRuns")
      .withIndex("by_org_program", (q) => q.eq("orgId", args.orgId).eq("programId", args.programId))
      .collect();
    const completedRunIds = new Set(runs.filter((r) => r.status === "completed").map((r) => r._id));

    const results = await ctx.db
      .query("codebaseAnalysisResults")
      .withIndex("by_org_program", (q) => q.eq("orgId", args.orgId).eq("programId", args.programId))
      .order("desc")
      .collect();

    const completedResults = results.filter((r) => completedRunIds.has(r.runId));

    return await Promise.all(
      completedResults.map(async (r) => {
        const req = await ctx.db.get(r.requirementId);
        return {
          ...r,
          requirementTitle: req?.title ?? "Unknown Requirement",
          requirementRefId: req?.refId ?? "",
        };
      }),
    );
  },
});

// ── Internal Queries ────────────────────────────────────────────────────

export const getRunInternal = internalQuery({
  args: { runId: v.id("codebaseAnalysisRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const getLatestResultsForContext = internalQuery({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
  },
  handler: async (ctx, args) => {
    // Get requirements for this program/workstream
    let requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (args.workstreamId) {
      requirements = requirements.filter((r) => r.workstreamId === args.workstreamId);
    }

    // For each requirement that has analysis data, get latest result
    const results: Array<{
      refId: string;
      implementationStatus: string;
      confidence: number;
      evidenceSummary: string;
      gapDescription?: string;
    }> = [];

    for (const req of requirements) {
      if (req.implementationStatus && req.lastAnalyzedAt) {
        // Get latest result for evidence summary
        const latestResults = await ctx.db
          .query("codebaseAnalysisResults")
          .withIndex("by_requirement", (q) =>
            q.eq("orgId", args.orgId).eq("requirementId", req._id),
          )
          .order("desc")
          .take(1);

        const latest = latestResults[0];
        const evidenceSummary = latest
          ? latest.evidence.files
              .map(
                (f) => `${f.filePath}${f.lineStart ? ` (lines ${f.lineStart}-${f.lineEnd})` : ""}`,
              )
              .join(", ")
          : "";

        results.push({
          refId: req.refId,
          implementationStatus: req.implementationStatus,
          confidence: req.implementationConfidence ?? 0,
          evidenceSummary,
          gapDescription: latest?.gapDescription ?? undefined,
        });
      }
    }

    return results;
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

export const createRun = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
    requirementId: v.optional(v.id("requirements")),
    taskId: v.optional(v.id("tasks")),
    scope: scopeValidator,
    config: v.object({
      branch: v.string(),
      directoryFilter: v.optional(v.string()),
      fileTypeFilter: v.optional(v.array(v.string())),
      confidenceThreshold: v.number(),
      modelTier: modelTierValidator,
      useKnowledgeGraph: v.boolean(),
    }),
    repositoryIds: v.array(v.id("sourceControlRepositories")),
    totalRequirements: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await assertOrgAccess(ctx, args.orgId);

    // Block if analysis already running for this scope
    const existing = await ctx.db
      .query("codebaseAnalysisRuns")
      .withIndex("by_status", (q) => q.eq("orgId", args.orgId).eq("status", "running"))
      .collect();

    const conflicting = existing.find((r) => {
      if (args.scope === "workstream" && r.workstreamId === args.workstreamId) return true;
      if (args.scope === "requirement" && r.requirementId === args.requirementId) return true;
      if (args.scope === "program" && r.programId === args.programId && r.scope === "program")
        return true;
      if (args.scope === "task" && r.taskId === args.taskId) return true;
      return false;
    });

    if (conflicting) {
      throw new ConvexError("Analysis already in progress for this scope");
    }

    const runId = await ctx.db.insert("codebaseAnalysisRuns", {
      ...args,
      triggeredBy: user._id,
      status: "pending",
      analyzedCount: 0,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "codebaseAnalysisRun",
      entityId: runId as string,
      action: "create",
      description: `Started ${args.scope}-level codebase analysis (${args.totalRequirements} requirements, ${args.config.modelTier} tier)`,
    });

    return runId;
  },
});

export const updateRunStatus = internalMutation({
  args: {
    runId: v.id("codebaseAnalysisRuns"),
    status: runStatusValidator,
    errorMessage: v.optional(v.string()),
    summary: v.optional(
      v.object({
        notFound: v.number(),
        partiallyImplemented: v.number(),
        fullyImplemented: v.number(),
        needsVerification: v.number(),
        autoApplied: v.number(),
        pendingReview: v.number(),
      }),
    ),
    tokenUsage: v.optional(
      v.object({
        input: v.number(),
        output: v.number(),
        cost: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { runId, ...updates } = args;
    const patch: Record<string, unknown> = { ...updates };

    if (args.status === "running" && !updates.errorMessage) {
      patch.startedAt = Date.now();
    }
    if (args.status === "completed" || args.status === "failed") {
      patch.completedAt = Date.now();
    }

    await ctx.db.patch(runId, patch);
  },
});

export const incrementAnalyzedCount = internalMutation({
  args: {
    runId: v.id("codebaseAnalysisRuns"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    await ctx.db.patch(args.runId, {
      analyzedCount: run.analyzedCount + 1,
    });
  },
});

export const insertResult = internalMutation({
  args: {
    runId: v.id("codebaseAnalysisRuns"),
    programId: v.id("programs"),
    orgId: v.string(),
    requirementId: v.id("requirements"),
    taskId: v.optional(v.id("tasks")),
    implementationStatus: implementationStatusValidator,
    confidence: v.number(),
    confidenceReasoning: v.string(),
    evidence: v.object({
      files: v.array(
        v.object({
          repositoryId: v.string(),
          filePath: v.string(),
          lineStart: v.optional(v.number()),
          lineEnd: v.optional(v.number()),
          snippet: v.optional(v.string()),
          relevance: v.string(),
        }),
      ),
    }),
    gapDescription: v.optional(v.string()),
    previousStatus: v.optional(v.string()),
    proposedStatus: v.optional(v.string()),
    proposedPipelineStage: v.optional(v.string()),
    reviewStatus: reviewStatusValidator,
  },
  handler: async (ctx, args) => {
    const resultId = await ctx.db.insert("codebaseAnalysisResults", args);

    // Update requirement's inline analysis fields
    await ctx.db.patch(args.requirementId, {
      implementationStatus: args.implementationStatus,
      implementationConfidence: args.confidence,
      lastAnalyzedAt: Date.now(),
      lastAnalysisRunId: args.runId,
    });

    return resultId;
  },
});

// ── Review Mutations ────────────────────────────────────────────────────

export const approveResult = mutation({
  args: {
    resultId: v.id("codebaseAnalysisResults"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.resultId);
    if (!result) throw new ConvexError("Result not found");
    const user = await assertOrgAccess(ctx, result.orgId);

    await ctx.db.patch(args.resultId, {
      reviewStatus: "approved",
      reviewedBy: user._id,
      reviewedAt: Date.now(),
      reviewNote: args.note,
    });

    // Apply the proposed status change to the requirement
    if (result.proposedStatus) {
      const req = await ctx.db.get(result.requirementId);
      if (req) {
        await ctx.db.patch(result.requirementId, {
          status: result.proposedStatus as any,
        });

        await logAuditEvent(ctx, {
          orgId: result.orgId,
          programId: result.programId as string,
          entityType: "requirement",
          entityId: result.requirementId as string,
          action: "status_change",
          description: `Approved analysis: changed "${req.title}" status from ${result.previousStatus} to ${result.proposedStatus} (confidence: ${result.confidence}%)`,
          metadata: {
            previousStatus: result.previousStatus,
            newStatus: result.proposedStatus,
            confidence: result.confidence,
            analysisRunId: result.runId,
          },
        });
      }
    }

    // Cascade to tasks if requirement is now complete
    if (result.proposedStatus === "complete") {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_program", (q) => q.eq("programId", result.programId))
        .collect();
      const linkedTasks = tasks.filter(
        (t) => t.requirementId === result.requirementId && t.status !== "done",
      );
      for (const task of linkedTasks) {
        await ctx.db.patch(task._id, { status: "review" });
        await logAuditEvent(ctx, {
          orgId: result.orgId,
          programId: result.programId as string,
          entityType: "task",
          entityId: task._id as string,
          action: "status_change",
          description: `Cascaded from requirement analysis approval: moved task "${task.title}" to review`,
        });
      }
    }
  },
});

export const rejectResult = mutation({
  args: {
    resultId: v.id("codebaseAnalysisResults"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.resultId);
    if (!result) throw new ConvexError("Result not found");
    const user = await assertOrgAccess(ctx, result.orgId);

    await ctx.db.patch(args.resultId, {
      reviewStatus: "rejected",
      reviewedBy: user._id,
      reviewedAt: Date.now(),
      reviewNote: args.note,
    });

    await logAuditEvent(ctx, {
      orgId: result.orgId,
      programId: result.programId as string,
      entityType: "codebaseAnalysisResult",
      entityId: args.resultId as string,
      action: "update",
      description: `Rejected analysis result for requirement (confidence: ${result.confidence}%)`,
    });
  },
});

export const bulkApprove = mutation({
  args: {
    resultIds: v.array(v.id("codebaseAnalysisResults")),
  },
  handler: async (ctx, args) => {
    if (args.resultIds.length === 0) return;

    const first = await ctx.db.get(args.resultIds[0]);
    if (!first) throw new ConvexError("Result not found");
    const user = await assertOrgAccess(ctx, first.orgId);

    for (const resultId of args.resultIds) {
      const result = await ctx.db.get(resultId);
      if (!result || result.orgId !== first.orgId) continue;

      await ctx.db.patch(resultId, {
        reviewStatus: "approved",
        reviewedBy: user._id,
        reviewedAt: Date.now(),
      });

      if (result.proposedStatus) {
        await ctx.db.patch(result.requirementId, {
          status: result.proposedStatus as any,
        });
      }
    }

    await logAuditEvent(ctx, {
      orgId: first.orgId,
      programId: first.programId as string,
      entityType: "codebaseAnalysisResult",
      entityId: "bulk",
      action: "update",
      description: `Bulk approved ${args.resultIds.length} analysis results`,
    });
  },
});

export const bulkReject = mutation({
  args: {
    resultIds: v.array(v.id("codebaseAnalysisResults")),
  },
  handler: async (ctx, args) => {
    if (args.resultIds.length === 0) return;

    const first = await ctx.db.get(args.resultIds[0]);
    if (!first) throw new ConvexError("Result not found");
    const user = await assertOrgAccess(ctx, first.orgId);

    for (const resultId of args.resultIds) {
      const result = await ctx.db.get(resultId);
      if (!result || result.orgId !== first.orgId) continue;

      await ctx.db.patch(resultId, {
        reviewStatus: "rejected",
        reviewedBy: user._id,
        reviewedAt: Date.now(),
      });
    }

    await logAuditEvent(ctx, {
      orgId: first.orgId,
      programId: first.programId as string,
      entityType: "codebaseAnalysisResult",
      entityId: "bulk",
      action: "update",
      description: `Bulk rejected ${args.resultIds.length} analysis results`,
    });
  },
});
