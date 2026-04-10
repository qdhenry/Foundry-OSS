"use node";

import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { action } from "./_generated/server";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "./lib/aiCostTracking";

const internalApi: any = (generatedApi as any).internal;

export const generateDailyDigest = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    userId: v.string(),
    changesSummary: v.string(),
    workstreamSummary: v.string(),
    taskSummary: v.string(),
    timeframe: v.string(),
  },
  handler: async (ctx, args) => {
    const systemPrompt = [
      "You are a project management intelligence assistant for enterprise platform migrations.",
      "Provide brief, actionable daily briefings. 3-4 sentences max.",
      "Focus on: blockers, risks, critical path items, and notable progress.",
      "Use concrete numbers and specifics. Do not use filler language.",
      "If there are no significant changes, say so briefly.",
    ].join(" ");

    const userPrompt = [
      `<timeframe>${args.timeframe}</timeframe>`,
      "",
      `<changes-since-last-visit>`,
      args.changesSummary,
      `</changes-since-last-visit>`,
      "",
      `<workstream-status>`,
      args.workstreamSummary,
      `</workstream-status>`,
      "",
      `<task-health>`,
      args.taskSummary,
      `</task-health>`,
      "",
      "Provide a concise daily digest summarizing the migration program status.",
    ].join("\n");

    try {
      const client = getAnthropicClient();

      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const digest = textBlock && textBlock.type === "text" ? textBlock.text : "";

      const tokensUsed = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);

      let changeCount = 0;
      try {
        const parsed = JSON.parse(args.changesSummary);
        changeCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        changeCount = 0;
      }

      let workstreamsAffected = 0;
      try {
        const parsed = JSON.parse(args.workstreamSummary);
        workstreamsAffected = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        workstreamsAffected = 0;
      }

      await ctx.runMutation(internalApi.missionControl.cacheDigest, {
        orgId: args.orgId,
        programId: args.programId,
        userId: args.userId,
        digest,
        metadata: {
          auditLogsAnalyzed: changeCount,
          changeCount,
          workstreamsAffected,
          tokensUsed,
        },
      });

      // Record AI usage for billing (best-effort)
      try {
        const tokenUsage = extractTokenUsage(response, "claude-sonnet-4-5-20250929");
        await ctx.runMutation(internalApi.billing.usageRecords.recordAiUsage, {
          orgId: args.orgId,
          programId: args.programId,
          source: "daily_digest" as const,
          claudeModelId: "claude-sonnet-4-5-20250929",
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          cacheReadTokens: tokenUsage.cacheReadTokens,
          cacheCreationTokens: tokenUsage.cacheCreationTokens,
          costUsd: calculateCostUsd(tokenUsage),
        });
      } catch (e) {
        console.error("[billing] Failed to record daily digest usage:", e);
      }

      // Best-effort execution logging
      try {
        await ctx.runMutation(internalApi.ai.logExecution, {
          orgId: args.orgId,
          programId: args.programId,
          executionMode: "platform" as const,
          trigger: "scheduled" as const,
          taskType: "daily_digest",
          inputSummary: userPrompt.slice(0, 200),
          outputSummary: digest.slice(0, 500),
          tokensUsed,
          modelId: "claude-sonnet-4-5-20250929",
        });
      } catch {
        /* best-effort */
      }

      return { success: true, digest, tokensUsed };
    } catch (error: any) {
      return {
        success: false,
        digest: "Unable to generate digest at this time.",
        tokensUsed: 0,
        error: error.message ?? "Unknown error",
      };
    }
  },
});
