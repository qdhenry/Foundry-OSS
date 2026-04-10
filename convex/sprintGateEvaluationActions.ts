"use node";
import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { callAI } from "./lib/aiClient";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// evaluateSprintGate — internalAction (Node.js runtime)
// Calls Anthropic API directly to evaluate sprint gate readiness
// ---------------------------------------------------------------------------
export const evaluateSprintGate = internalAction({
  args: {
    orgId: v.string(),
    sprintId: v.id("sprints"),
    programId: v.id("programs"),
  },
  handler: async (ctx, args): Promise<void> => {
    // 1. Gather context via internal queries
    const [sprint, sprintTasks, gateCriteria, risks, teamMembers] = await Promise.all([
      ctx.runQuery(internalApi.sprints.getById, {
        sprintId: args.sprintId,
      }),
      ctx.runQuery(internalApi.tasks.getBySprint, {
        sprintId: args.sprintId,
      }),
      ctx.runQuery(internalApi.sprintGates.getCriteria, {
        sprintId: args.sprintId,
      }),
      ctx.runQuery(internalApi.risks.getByProgramInternal, {
        programId: args.programId,
      }),
      ctx.runQuery(internalApi.teamMembers.getByProgramInternal, {
        programId: args.programId,
      }),
    ]);

    if (!sprint) {
      throw new Error("Sprint not found");
    }

    // 2. Call Anthropic API directly
    const systemPrompt = `You are a quality gate evaluator for enterprise platform migrations. Assess project readiness against gate criteria, identify blockers, and provide actionable recommendations.
Organization: ${args.orgId}

Think carefully about all gate criteria and their interdependencies before evaluating.
Respond with valid JSON matching this schema:
{
  "overall_readiness_percent": number (0-100),
  "gate_criteria_status": [{ "criterion": string, "status": "passed"|"failed"|"partial"|"not_evaluated", "score": number (0-100), "evidence": string, "notes": string (optional) }],
  "critical_blockers": [{ "blocker": string, "severity": "critical"|"high", "resolution_path": string, "estimated_effort": string }],
  "health_assessment": { "schedule_health": "on_track"|"at_risk"|"behind", "quality_health": "good"|"acceptable"|"poor", "team_health": "strong"|"adequate"|"strained", "budget_health": "on_track"|"at_risk"|"over", "summary": string },
  "recommendations": [{ "recommendation": string, "priority": "critical"|"high"|"medium"|"low", "category": "process"|"technical"|"team"|"scope" }],
  "next_steps": [{ "action": string, "owner": string (optional), "deadline": string (optional), "dependency": string (optional) }]
}`;

    const userPrompt = `Evaluate sprint gate readiness:

Sprint: ${JSON.stringify(sprint)}
Sprint Tasks: ${JSON.stringify(sprintTasks)}
Gate Criteria: ${JSON.stringify(gateCriteria)}
Open Risks: ${JSON.stringify(risks.filter((r: any) => r.status === "open"))}
Team Members: ${JSON.stringify(teamMembers)}`;

    const result = await callAI({ systemPrompt, userPrompt });

    // Record AI usage (best-effort)
    try {
      await ctx.runMutation(internal.billing.usageRecords.recordAiUsage, {
        orgId: args.orgId,
        programId: args.programId,
        source: "gate_evaluation",
        claudeModelId: result.usage.claudeModelId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheCreationTokens: result.usage.cacheCreationTokens,
        costUsd: result.costUsd,
        sourceEntityId: String(args.sprintId),
        sourceEntityTable: "sprints",
      });
    } catch (e) {
      console.error("[billing] Failed to record AI usage:", e);
    }

    // 3. Store results
    await ctx.runMutation(internalApi.sprintGateEvaluation.storeEvaluation, {
      orgId: args.orgId,
      sprintId: args.sprintId,
      programId: args.programId,
      evaluation: result.data.evaluation ?? result.data,
      totalTokensUsed: result.totalTokensUsed,
    });

    // Log to agentExecutions for centralized telemetry
    await ctx.runMutation(internalApi.ai.logExecution, {
      orgId: args.orgId,
      programId: args.programId,
      executionMode: "platform" as const,
      trigger: "manual" as const,
      taskType: "sprint_gate_evaluation",
      inputSummary: userPrompt.slice(0, 200),
      outputSummary: JSON.stringify(result.data).slice(0, 500),
      tokensUsed: result.totalTokensUsed,
    });
  },
});
