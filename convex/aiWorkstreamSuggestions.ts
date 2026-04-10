"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { action } from "./_generated/server";
import { getAnthropicClient } from "./lib/aiClient";

// Use anyApi to avoid excessive type instantiation depth on `internal`
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { internal } = require("./_generated/api") as { internal: any };

const internalApi: any = (generatedApi as any).internal;

/**
 * AI action that analyzes unassigned requirements and suggests workstream groupings.
 * Uses Claude Sonnet tier for cost-effective inference.
 */
export const suggestWorkstreamGroupings = action({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    // Fetch unassigned requirements via internal query
    const allRequirements: any[] = await ctx.runQuery(
      internal.requirements.listByProgramInternal as any,
      { programId: args.programId },
    );

    const unassigned = allRequirements.filter((r: any) => !r.workstreamId);

    if (unassigned.length === 0) {
      return { suggestions: [], message: "No unassigned requirements found." };
    }

    // Fetch existing workstreams for context
    const program = await ctx.runQuery(internal.programs.getById, {
      programId: args.programId,
    });

    if (!program) throw new ConvexError("Program not found");

    // Build prompt
    const requirementsList = unassigned
      .map(
        (r: any) =>
          `- [${r.refId}] ${r.title}${r.description ? `: ${r.description}` : ""} (priority: ${r.priority}, fitGap: ${r.fitGap})`,
      )
      .join("\n");

    const prompt = `You are an expert software delivery consultant. Analyze these unassigned requirements and suggest logical workstream groupings.

<requirements>
${requirementsList}
</requirements>

<program_context>
Program: ${program.name}
Client: ${program.clientName}
Source Platform: ${program.sourcePlatform}
Target Platform: ${program.targetPlatform}
</program_context>

Group the requirements into logical workstreams based on functional area, dependency chains, and implementation complexity. Each workstream should be a cohesive unit of work.

Respond with valid JSON only, no markdown fencing:
{
  "suggestions": [
    {
      "workstreamName": "Name of suggested workstream",
      "shortCode": "3-5 letter code like CART, AUTH, CATL",
      "requirementIds": ["REQ-001", "REQ-002"],
      "rationale": "Brief explanation of why these belong together"
    }
  ]
}`;

    const client = getAnthropicClient();

    const response: any = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock: any = response.content.find((b: any) => b.type === "text");
    const text: string = textBlock ? textBlock.text : "";

    const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    // Best-effort execution logging
    try {
      await ctx.runMutation(internalApi.ai.logExecution, {
        orgId: program.orgId,
        programId: args.programId,
        executionMode: "platform" as const,
        trigger: "manual" as const,
        taskType: "workstream_grouping",
        inputSummary: prompt.slice(0, 200),
        outputSummary: `${unassigned.length} unassigned requirements analyzed`,
        tokensUsed,
        modelId: "claude-sonnet-4-5-20250514",
      });
    } catch {
      /* best-effort */
    }

    try {
      const parsed = JSON.parse(text);

      // Map refIds back to document IDs
      const refIdMap = new Map(unassigned.map((r: any) => [r.refId, r._id]));

      const suggestions = (parsed.suggestions ?? []).map((s: any) => ({
        workstreamName: s.workstreamName,
        shortCode: s.shortCode,
        requirementRefIds: s.requirementIds,
        requirementDocIds: (s.requirementIds ?? [])
          .map((refId: string) => refIdMap.get(refId))
          .filter(Boolean),
        rationale: s.rationale,
      }));

      return { suggestions };
    } catch {
      return {
        suggestions: [],
        message: "Failed to parse AI response. Please try again.",
        rawResponse: text,
      };
    }
  },
});
