import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// 1. storeRiskAssessment — internalMutation
// ---------------------------------------------------------------------------
export const storeRiskAssessment = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    assessment: v.any(),
    changeType: v.string(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const assessmentId = await ctx.db.insert("riskAssessments", {
      orgId: args.orgId,
      programId: args.programId,
      assessment: args.assessment,
      changeType: args.changeType,
      status: "completed",
      createdAt: Date.now(),
      totalTokensUsed: args.totalTokensUsed,
    });

    // Auto-create risk records from the assessment's identified risks
    const assessment = args.assessment as {
      newRisks?: Array<{
        title: string;
        description: string;
        severity: "critical" | "high" | "medium" | "low";
        probability: "very_likely" | "likely" | "possible" | "unlikely";
        mitigationSuggestions?: string[];
      }>;
    };

    if (assessment?.newRisks) {
      for (const risk of assessment.newRisks) {
        await ctx.runMutation(internalApi.risks.createFromAIGeneration, {
          programId: args.programId,
          orgId: args.orgId,
          title: risk.title,
          description: risk.description,
          severity: risk.severity,
          probability: risk.probability,
          mitigationSuggestions: risk.mitigationSuggestions ?? [],
          sourceChangeType: args.changeType,
        });
      }
    }

    return assessmentId;
  },
});

// ---------------------------------------------------------------------------
// 2. getLatestAssessment — query (reactive)
// ---------------------------------------------------------------------------
export const getLatestAssessment = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const assessments = await ctx.db
      .query("riskAssessments")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return assessments.length > 0 ? assessments[assessments.length - 1] : null;
  },
});

// ---------------------------------------------------------------------------
// 3. requestRiskEvaluation — public mutation (trigger)
// ---------------------------------------------------------------------------
export const requestRiskEvaluation = mutation({
  args: {
    programId: v.id("programs"),
    changeType: v.string(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "program",
      entityId: args.programId as string,
      action: "create",
      description: `Requested AI risk evaluation (change type: ${args.changeType})`,
    });

    await ctx.scheduler.runAfter(
      0,
      internalApi.riskAutogenerationActions.evaluateContextChangeForRisks,
      {
        orgId: program.orgId,
        programId: args.programId,
        changeType: args.changeType,
      },
    );
  },
});
