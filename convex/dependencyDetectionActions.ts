"use node";

import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "./lib/aiCostTracking";

const internalApi: any = (generatedApi as any).internal;

type RequirementForDependencyDetection = {
  _id: string;
  title: string;
  description?: string;
  status?: string;
};

type WorkstreamForDependencyDetection = {
  _id: string;
  name: string;
  shortCode?: string;
  requirements: RequirementForDependencyDetection[];
};

type ExistingDependencyForDetection = {
  sourceName: string;
  targetName: string;
  dependencyType?: string | null;
  status?: string;
  sourceWorkstreamId: string;
  targetWorkstreamId: string;
};

export const detectDependencies = internalAction({
  args: {
    programId: v.id("programs"),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    const workstreams = (await ctx.runQuery(
      internalApi.dependencyDetection.getAllWorkstreamsWithRequirements,
      { programId: args.programId },
    )) as WorkstreamForDependencyDetection[];

    if (workstreams.length < 2) {
      return { success: true, newDependencies: 0 };
    }

    const existingDeps = (await ctx.runQuery(
      internalApi.dependencyDetection.getExistingDependencies,
      { programId: args.programId },
    )) as ExistingDependencyForDetection[];

    const systemPrompt = `You are a system architecture analyst specializing in enterprise platform migrations.
Your task is to identify cross-workstream dependencies by analyzing requirement descriptions and workstream scopes.

Dependency types:
- "blocks": Source workstream must complete before target can proceed
- "enables": Source workstream's output enables functionality in the target
- "conflicts": Requirements in source and target workstreams conflict or overlap

For each dependency, provide:
- sourceWorkstreamId: The _id of the source workstream
- targetWorkstreamId: The _id of the target workstream
- dependencyType: One of "blocks", "enables", "conflicts"
- description: Clear explanation of the dependency relationship
- confidence: Integer 0-100 (only return suggestions with confidence >= 50)
- reasoning: Why this dependency exists
- requirementIds: Array of requirement _ids that are involved (from either workstream)

Respond with ONLY a JSON array of dependency objects. No markdown fences or extra text.`;

    const workstreamDetails = workstreams
      .map((ws) => {
        const reqs = ws.requirements
          .map(
            (r) =>
              `    - [${r._id}] ${r.title}${r.description ? `: ${r.description}` : ""} (status: ${r.status})`,
          )
          .join("\n");
        return `Workstream: ${ws.name} (ID: ${ws._id}, Code: ${ws.shortCode})\n  Requirements:\n${reqs || "    (none)"}`;
      })
      .join("\n\n");

    const existingDepsText =
      existingDeps.length > 0
        ? existingDeps
            .map(
              (d) =>
                `- ${d.sourceName} -> ${d.targetName} (${d.dependencyType ?? "untyped"}, status: ${d.status})`,
            )
            .join("\n")
        : "(none)";

    const userPrompt = `Analyze these workstreams and their requirements to identify cross-workstream dependencies.

## Workstreams and Requirements

${workstreamDetails}

## Existing Dependencies (do NOT duplicate these)

${existingDepsText}

Identify NEW dependencies not already captured above. Return a JSON array of dependency suggestions.`;

    let suggestions: Array<{
      sourceWorkstreamId: string;
      targetWorkstreamId: string;
      dependencyType: "blocks" | "enables" | "conflicts";
      description: string;
      confidence: number;
      reasoning: string;
      requirementIds?: string[];
    }> = [];

    try {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Record AI usage (best-effort)
      const _depModelId = "claude-sonnet-4-5-20250929";
      try {
        const usage = extractTokenUsage(response, _depModelId);
        const costUsd = calculateCostUsd(usage);
        await ctx.runMutation(internal.billing.usageRecords.recordAiUsage, {
          orgId: args.orgId,
          programId: args.programId,
          source: "dependency_detection",
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

      const outputText = response.content[0].type === "text" ? response.content[0].text : "";

      const cleaned = outputText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      suggestions = JSON.parse(cleaned);

      if (!Array.isArray(suggestions)) {
        suggestions = [];
      }

      // Best-effort execution logging
      try {
        const depUsage = extractTokenUsage(response, _depModelId);
        const depTokensUsed = depUsage.inputTokens + depUsage.outputTokens;
        await ctx.runMutation(internalApi.ai.logExecution, {
          orgId: args.orgId,
          programId: args.programId,
          executionMode: "platform" as const,
          trigger: "manual" as const,
          taskType: "dependency_detection",
          inputSummary: userPrompt.slice(0, 200),
          outputSummary: `${suggestions.length} dependency suggestions`,
          tokensUsed: depTokensUsed,
          modelId: _depModelId,
        });
      } catch {
        /* best-effort */
      }
    } catch (error) {
      console.error("Dependency detection AI call failed:", error);
      return { success: false, newDependencies: 0 };
    }

    let newCount = 0;

    for (const suggestion of suggestions) {
      if (suggestion.confidence < 50) continue;

      const isDuplicate = existingDeps.some(
        (d) =>
          d.sourceWorkstreamId === suggestion.sourceWorkstreamId &&
          d.targetWorkstreamId === suggestion.targetWorkstreamId &&
          d.dependencyType === suggestion.dependencyType,
      );
      if (isDuplicate) continue;

      if (suggestion.sourceWorkstreamId === suggestion.targetWorkstreamId) continue;

      try {
        await ctx.runMutation(internalApi.dependencyDetection.suggestDependency, {
          orgId: args.orgId,
          programId: args.programId,
          sourceWorkstreamId: suggestion.sourceWorkstreamId as any,
          targetWorkstreamId: suggestion.targetWorkstreamId as any,
          dependencyType: suggestion.dependencyType,
          description: suggestion.description,
          requirementIds: suggestion.requirementIds as any,
          confidence: suggestion.confidence,
          reasoning: suggestion.reasoning,
        });
        newCount++;
      } catch (error) {
        console.error("Failed to store dependency suggestion:", error);
      }
    }

    return { success: true, newDependencies: newCount };
  },
});
