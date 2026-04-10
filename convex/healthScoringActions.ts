"use node";

import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "./lib/aiCostTracking";

const internalApi: any = (generatedApi as any).internal;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

type WorkstreamForHealthScoring = {
  _id: string;
  previousHealth?: "on_track" | "at_risk" | "blocked" | null;
  [key: string]: unknown;
};

const healthScoringSystemPrompt = `You are an expert project health analyst for enterprise platform migrations. Your job is to assess the health of workstreams based on quantitative metrics.

## Scoring Rules

### Health Status Classification
- **on_track**: <10% tasks overdue, velocity stable or improving, no critical blocking dependencies
- **at_risk**: 10-25% tasks overdue, velocity declining, or moderate dependency concerns
- **blocked**: >25% tasks overdue, critical path blocked, or unresolved critical risks

### Health Score (0-100)
- 90-100: Excellent — ahead of schedule, strong velocity
- 70-89: Good — on track with minor concerns
- 50-69: Concerning — at risk of slipping
- 30-49: Poor — significant issues requiring intervention
- 0-29: Critical — blocked or severely behind

### Factor Scoring (each 0-100)
- **velocityScore**: Based on week-over-week completion trend. 100 = improving, 50 = stable, 0 = no completions
- **taskAgingScore**: Based on average task age. 100 = fresh (<3 days avg), 0 = stale (>14 days avg)
- **riskScore**: Based on open risks. 100 = no risks, 0 = multiple critical risks
- **gatePassRate**: Based on sprint gate pass rate. 100 = all passed, 0 = all failed
- **dependencyScore**: Based on dependency health. 100 = all resolved, 0 = multiple blocked

## Response Format
Return ONLY a JSON array (no markdown fences, no explanation). Each element:
{
  "workstreamId": "<workstream ID>",
  "health": "on_track" | "at_risk" | "blocked",
  "healthScore": <number 0-100>,
  "reasoning": "<2-3 sentence explanation>",
  "factors": {
    "velocityScore": <number 0-100>,
    "taskAgingScore": <number 0-100>,
    "riskScore": <number 0-100>,
    "gatePassRate": <number 0-100>,
    "dependencyScore": <number 0-100>
  },
  "changeReason": "<reason if health status changed from previous, or null>"
}`;

export const computeHealthScores = internalAction({
  args: {
    programId: v.id("programs"),
    orgId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; workstreamsScored: number }> => {
    const enrichedWorkstreams = (await ctx.runQuery(
      internalApi.healthScoring.getAllWorkstreamsForScoring,
      { programId: args.programId },
    )) as WorkstreamForHealthScoring[];

    if (enrichedWorkstreams.length === 0) {
      return { success: true, workstreamsScored: 0 };
    }

    const batches = chunkArray(enrichedWorkstreams, 5);
    let totalScored = 0;

    for (const batch of batches) {
      try {
        const client = getAnthropicClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 8192,
          system: healthScoringSystemPrompt,
          messages: [
            {
              role: "user",
              content: `Analyze the following workstream metrics and provide health scores for each.\n\n${JSON.stringify(batch, null, 2)}`,
            },
          ],
        });

        // Record AI usage (best-effort)
        try {
          const modelId = "claude-sonnet-4-5-20250929";
          const usage = extractTokenUsage(response, modelId);
          const costUsd = calculateCostUsd(usage);
          await ctx.runMutation(internal.billing.usageRecords.recordAiUsage, {
            orgId: args.orgId,
            programId: args.programId,
            source: "health_scoring",
            claudeModelId: usage.claudeModelId,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheCreationTokens: usage.cacheCreationTokens,
            costUsd,
          });
        } catch (e) {
          console.error("[billing] Failed to record AI usage:", e);
        }

        const textBlock = response.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          console.error("No text content in Claude response for health scoring");
          continue;
        }

        let jsonText = textBlock.text.trim();
        const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
        }

        const scores: Array<{
          workstreamId: string;
          health: "on_track" | "at_risk" | "blocked";
          healthScore: number;
          reasoning: string;
          factors: {
            velocityScore: number;
            taskAgingScore: number;
            riskScore: number;
            gatePassRate: number;
            dependencyScore: number;
          };
          changeReason: string | null;
        }> = JSON.parse(jsonText);

        for (const score of scores) {
          const workstream = batch.find((ws) => ws._id === score.workstreamId);
          await ctx.runMutation(internalApi.healthScoring.storeHealthScore, {
            orgId: args.orgId,
            workstreamId: score.workstreamId as any,
            health: score.health,
            healthScore: score.healthScore,
            reasoning: score.reasoning,
            factors: score.factors,
            previousHealth: workstream?.previousHealth ?? undefined,
            changeReason: score.changeReason ?? undefined,
          });
          totalScored++;
        }
      } catch (error: any) {
        console.error(`Health scoring batch failed: ${error.message}`);
      }
    }

    return { success: true, workstreamsScored: totalScored };
  },
});
