"use node";
import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { callAI } from "./lib/aiClient";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// evaluateContextChangeForRisks — internalAction (Node.js runtime)
// Calls Anthropic API directly to assess risk impact of changes
// ---------------------------------------------------------------------------
export const evaluateContextChangeForRisks = internalAction({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    changeType: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // 1. Gather context via internal queries
    const [program, requirements, risks, tasks, skills] = await Promise.all([
      ctx.runQuery(internalApi.programs.getById, {
        programId: args.programId,
      }),
      ctx.runQuery(internalApi.requirements.getByStatus, {
        programId: args.programId,
        status: "in_progress",
      }),
      ctx.runQuery(internalApi.risks.getByProgramInternal, {
        programId: args.programId,
      }),
      ctx.runQuery(internalApi.tasks.getByProgram, {
        programId: args.programId,
      }),
      ctx.runQuery(internalApi.skills.getActiveByProgram, {
        programId: args.programId,
      }),
    ]);

    if (!program) {
      throw new Error("Program not found");
    }

    // 2. Call Anthropic API directly
    const systemPrompt = `You are a risk assessment specialist for enterprise platform migrations. Evaluate the impact of recent changes on overall project risk, identify new risks, and recommend mitigations.
Organization: ${args.orgId}

Think carefully about cascade effects and second-order impacts before assessing.
Respond with valid JSON matching this schema:
{
  "change_impact_summary": { "overall_risk_level": "critical"|"high"|"medium"|"low", "confidence": "high"|"medium"|"low", "summary": string },
  "new_risks": [{ "title": string, "description": string, "severity": "critical"|"high"|"medium"|"low", "likelihood": "very_likely"|"likely"|"possible"|"unlikely", "affected_workstreams": [string], "mitigation_strategy": string }] (optional),
  "escalations": [{ "risk_id": string, "previous_severity": string, "new_severity": string, "reason": string, "recommended_action": string }] (optional),
  "cascade_impacts": [{ "trigger": string, "affected_areas": [string], "impact_description": string, "probability": "high"|"medium"|"low" }] (optional),
  "recommendations": [{ "priority": "immediate"|"short_term"|"long_term", "action": string, "expected_outcome": string, "effort": "low"|"medium"|"high" }] (optional)
}`;

    const userPrompt = `Assess risk impact for this change:

Change Type: ${args.changeType}
Program: ${JSON.stringify(program)}
Active Requirements: ${JSON.stringify(requirements)}
Existing Risks: ${JSON.stringify(risks)}
Active Tasks: ${JSON.stringify(tasks.filter((t: any) => t.status === "in_progress" || t.status === "todo"))}
Active Skills: ${JSON.stringify(skills)}`;

    const result = await callAI({ systemPrompt, userPrompt });

    // Record AI usage (best-effort)
    try {
      await ctx.runMutation(internal.billing.usageRecords.recordAiUsage, {
        orgId: args.orgId,
        programId: args.programId,
        source: "risk_assessment",
        claudeModelId: result.usage.claudeModelId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheCreationTokens: result.usage.cacheCreationTokens,
        costUsd: result.costUsd,
      });
    } catch (e) {
      console.error("[billing] Failed to record AI usage:", e);
    }

    // 3. Store results (also auto-creates risk records)
    await ctx.runMutation(internalApi.riskAutogeneration.storeRiskAssessment, {
      orgId: args.orgId,
      programId: args.programId,
      assessment: result.data.assessment ?? result.data,
      changeType: args.changeType,
      totalTokensUsed: result.totalTokensUsed,
    });

    // Log to agentExecutions for centralized telemetry
    await ctx.runMutation(internalApi.ai.logExecution, {
      orgId: args.orgId,
      programId: args.programId,
      executionMode: "platform" as const,
      trigger: "manual" as const,
      taskType: "risk_autogeneration",
      inputSummary: userPrompt.slice(0, 200),
      outputSummary: JSON.stringify(result.data).slice(0, 500),
      tokensUsed: result.totalTokensUsed,
    });
  },
});
