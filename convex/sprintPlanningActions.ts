"use node";
import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage, totalTokens } from "./lib/aiCostTracking";
import { extractCompletedObjects } from "./lib/streamingJsonParser";

const internalApi: any = (generatedApi as any).internal;

const STREAMING_MODEL = "claude-sonnet-4-5-20250929";

// ---------------------------------------------------------------------------
// suggestSprintComposition — internalAction (Node.js runtime, streaming)
// Calls Anthropic API with streaming to recommend sprint composition
// ---------------------------------------------------------------------------
export const suggestSprintComposition = internalAction({
  args: {
    orgId: v.string(),
    sprintId: v.id("sprints"),
    programId: v.id("programs"),
    placeholderId: v.id("sprintPlanningRecommendations"),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      await ctx.runMutation(internalApi.sprintPlanning.updateRecommendationProgress, {
        placeholderId: args.placeholderId,
        progress: "Gathering sprint context...",
      });

      const [sprint, allTasks, teamMembers, risks, requirements, sprints] = await Promise.all([
        ctx.runQuery(internalApi.sprints.getById, {
          sprintId: args.sprintId,
        }),
        ctx.runQuery(internalApi.tasks.getByProgram, {
          programId: args.programId,
        }),
        ctx.runQuery(internalApi.teamMembers.getByProgramInternal, {
          programId: args.programId,
        }),
        ctx.runQuery(internalApi.risks.getByProgramInternal, {
          programId: args.programId,
        }),
        ctx.runQuery(internalApi.requirements.getByStatus, {
          programId: args.programId,
          status: "approved",
        }),
        ctx.runQuery(internalApi.sprints.getByProgramInternal, {
          programId: args.programId,
        }),
      ]);

      // Separate unassigned tasks from already-assigned tasks
      const unassignedTasks = allTasks.filter((t: any) => !t.sprintId);
      const assignedTasks = allTasks.filter((t: any) => t.sprintId === args.sprintId);

      if (!sprint) {
        throw new Error("Sprint not found");
      }

      await ctx.runMutation(internalApi.sprintPlanning.updateRecommendationProgress, {
        placeholderId: args.placeholderId,
        progress: "Analyzing capacity and generating plan...",
      });

      const systemPrompt = `You are an agile sprint planner for enterprise platform migrations. Recommend which EXISTING unassigned tasks should be added to this sprint. Only suggest creating NEW tasks when there are clear gaps not covered by existing tasks.
Organization: ${args.orgId}

Respond with valid JSON matching this schema:
{
  "capacity_analysis": { "total_capacity_points": number, "available_team_members": number, "risk_buffer_percent": number, "effective_capacity": number },
  "recommended_existing_tasks": [{ "task_id": string, "title": string, "priority": "critical"|"high"|"medium"|"low", "rationale": string }],
  "suggested_new_tasks": [{ "title": string, "priority": "critical"|"high"|"medium"|"low", "rationale": string, "workstream_hint": string (optional) }] (optional, only when gaps exist),
  "deferred_to_next_sprint": [{ "task_id": string, "title": string, "reason": string }] (optional),
  "total_planned_points": number,
  "capacity_utilization_percent": number (optional),
  "sprint_health_indicators": { "dependency_risk": "low"|"medium"|"high", "skill_coverage": "good"|"partial"|"poor", "scope_stability": "stable"|"moderate"|"volatile", "overall_confidence": "high"|"medium"|"low" } (optional)
}

IMPORTANT: The "recommended_existing_tasks" array must reference task_id values from the "Unassigned Tasks" list below. Prefer recommending existing tasks over suggesting new ones.`;

      const userPrompt = `Plan sprint composition:

Sprint: ${JSON.stringify(sprint)}
Unassigned Tasks (available to add): ${JSON.stringify(unassignedTasks)}
Already Assigned to This Sprint: ${JSON.stringify(assignedTasks)}
Team Members: ${JSON.stringify(teamMembers)}
Open Risks: ${JSON.stringify(risks.filter((r: any) => r.status === "open"))}
Approved Requirements: ${JSON.stringify(requirements)}
Previous Sprints: ${JSON.stringify(sprints.filter((s: any) => s.status === "completed"))}`;

      const client = getAnthropicClient();
      const stream = client.messages.stream({
        model: STREAMING_MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      let fullText = "";
      let taskCount = 0;

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;

          const extracted = extractCompletedObjects(
            fullText,
            "recommended_existing_tasks",
            taskCount,
          );

          for (const task of extracted.newObjects) {
            await ctx.runMutation(internalApi.sprintPlanning.appendRecommendedTask, {
              placeholderId: args.placeholderId,
              task,
              taskIndex: taskCount,
            });
            taskCount++;
          }
        }
      }

      const finalExtracted = extractCompletedObjects(
        fullText,
        "recommended_existing_tasks",
        taskCount,
      );
      for (const task of finalExtracted.newObjects) {
        await ctx.runMutation(internalApi.sprintPlanning.appendRecommendedTask, {
          placeholderId: args.placeholderId,
          task,
          taskIndex: taskCount,
        });
        taskCount++;
      }

      let fullRecommendation: Record<string, unknown> | null = null;
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          fullRecommendation = JSON.parse(jsonMatch[0]);
        } catch {
          // Fall back to whatever we streamed
        }
      }

      if (!fullRecommendation) {
        fullRecommendation = { recommended_existing_tasks: [] };
      }

      const finalMessage = await stream.finalMessage();
      const usage = extractTokenUsage(finalMessage, STREAMING_MODEL);
      const costUsd = calculateCostUsd(usage);
      const tokenCount = totalTokens(usage);

      await ctx.runMutation(internalApi.sprintPlanning.finalizeRecommendation, {
        placeholderId: args.placeholderId,
        recommendation: fullRecommendation,
        totalTokensUsed: tokenCount,
      });

      try {
        await ctx.runMutation(internal.billing.usageRecords.recordAiUsage, {
          orgId: args.orgId,
          programId: args.programId,
          source: "sprint_planning",
          claudeModelId: usage.claudeModelId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheCreationTokens: usage.cacheCreationTokens,
          costUsd,
          sourceEntityId: String(args.sprintId),
          sourceEntityTable: "sprints",
        });
      } catch (e) {
        console.error("[billing] Failed to record AI usage:", e);
      }

      await ctx.runMutation(internalApi.ai.logExecution, {
        orgId: args.orgId,
        programId: args.programId,
        executionMode: "platform" as const,
        trigger: "manual" as const,
        taskType: "sprint_planning",
        inputSummary: userPrompt.slice(0, 200),
        outputSummary: JSON.stringify(fullRecommendation).slice(0, 500),
        tokensUsed: tokenCount,
      });
    } catch (error) {
      console.error("[sprint-planning] Generation failed:", error);
      await ctx.runMutation(internalApi.sprintPlanning.markRecommendationError, {
        placeholderId: args.placeholderId,
        error:
          error instanceof Error ? error.message : "Unknown error during sprint plan generation",
      });
    }
  },
});
