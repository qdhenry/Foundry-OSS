"use node";
import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { callAI } from "./lib/aiClient";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// suggestRefinements — internalAction (Node.js runtime)
// Calls Anthropic API directly to refine requirements
// ---------------------------------------------------------------------------
export const suggestRefinements = internalAction({
  args: {
    orgId: v.string(),
    requirementId: v.id("requirements"),
    programId: v.id("programs"),
    placeholderId: v.id("refinementSuggestions"),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      // 1. Gather context via internal queries
      const context = await ctx.runQuery(internalApi.requirements.getWithContext, {
        requirementId: args.requirementId,
      });

      if (!context) {
        throw new Error("Requirement not found or context unavailable");
      }

      // 2. Call Anthropic API directly
      const systemPrompt = `You are a requirements engineering specialist for platform migrations. Analyze and refine the provided requirement for clarity, completeness, and testability.
Organization: ${args.orgId}

Respond with valid JSON matching this schema:
{
  "overall_assessment": { "clarity_score": number (1-10), "completeness_score": number (1-10), "testability_score": number (1-10), "summary": string },
  "suggestions": [{ "area": string, "current_text": string, "suggested_text": string, "reason": string, "priority": "critical"|"high"|"medium"|"low" }],
  "potential_split": { "should_split": boolean, "reason": string, "proposed_sub_requirements": [{ "title": string, "description": string }] } (optional),
  "related_requirements": [{ "requirement_id": string, "relationship": "depends_on"|"conflicts_with"|"extends"|"duplicates", "description": string }] (optional)
}`;

      const userPrompt = `Analyze and refine this requirement:

Requirement: ${JSON.stringify(context.requirement)}
Program: ${JSON.stringify(context.program)}
Related Requirements: ${JSON.stringify(context.allRequirements)}
Related Tasks: ${JSON.stringify(context.relatedTasks)}
Active Skills: ${JSON.stringify(context.activeSkills)}`;

      const result = await callAI({ systemPrompt, userPrompt });

      // Record AI usage (best-effort)
      try {
        await ctx.runMutation(internal.billing.usageRecords.recordAiUsage, {
          orgId: args.orgId,
          programId: args.programId,
          source: "requirement_refinement",
          claudeModelId: result.usage.claudeModelId,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          cacheCreationTokens: result.usage.cacheCreationTokens,
          costUsd: result.costUsd,
          sourceEntityId: String(args.requirementId),
          sourceEntityTable: "requirements",
        });
      } catch (e) {
        console.error("[billing] Failed to record AI usage:", e);
      }

      // 3. Store results by patching the placeholder
      await ctx.runMutation(internalApi.requirementRefinement.storeRefinementSuggestions, {
        placeholderId: args.placeholderId,
        suggestions: result.data.suggestions ?? result.data,
        totalTokensUsed: result.totalTokensUsed,
      });

      // Log to agentExecutions for centralized telemetry
      await ctx.runMutation(internalApi.ai.logExecution, {
        orgId: args.orgId,
        programId: args.programId,
        executionMode: "platform" as const,
        trigger: "manual" as const,
        taskType: "requirement_refinement",
        inputSummary: userPrompt.slice(0, 200),
        outputSummary: JSON.stringify(result.data).slice(0, 500),
        tokensUsed: result.totalTokensUsed,
      });
    } catch (error) {
      await ctx.runMutation(internalApi.requirementRefinement.markRefinementError, {
        placeholderId: args.placeholderId,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  },
});
