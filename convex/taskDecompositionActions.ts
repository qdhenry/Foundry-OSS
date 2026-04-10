"use node";
import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "./lib/aiCostTracking";
import { getRepoStructureForProgram } from "./lib/repoContext";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// Streaming task extraction helpers (ported from subtaskGenerationActions.ts)
// ---------------------------------------------------------------------------

interface ParsedTask {
  title?: string;
  description?: string;
  story_points?: number;
  task_type?: string;
  acceptance_criteria?: string[];
  dependencies?: string[];
  required_skills?: string[];
  risk_factors?: string[];
  suggested_assignee_role?: string;
  depends_on?: number[];
  task_number?: number;
  suggested_owner_role?: string;
}

function extractCompletedTasks(
  text: string,
  alreadyExtracted: number,
): { newTasks: ParsedTask[]; remaining: string } {
  const newTasks: ParsedTask[] = [];

  const arrayMatch = text.match(/"tasks"\s*:\s*\[/);
  if (!arrayMatch || arrayMatch.index === undefined) {
    return { newTasks, remaining: text };
  }

  let pos = arrayMatch.index + arrayMatch[0].length;
  let objectsFound = 0;
  let lastObjectEnd = pos;

  while (pos < text.length) {
    while (pos < text.length && /[\s,]/.test(text[pos])) pos++;
    if (pos >= text.length || text[pos] === "]") break;

    if (text[pos] !== "{") {
      pos++;
      continue;
    }

    let depth = 0;
    const objectStart = pos;
    let inString = false;
    let escaped = false;

    while (pos < text.length) {
      const ch = text[pos];
      if (escaped) {
        escaped = false;
        pos++;
        continue;
      }
      if (ch === "\\" && inString) {
        escaped = true;
        pos++;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
      } else if (!inString) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            pos++;
            const objectStr = text.slice(objectStart, pos);
            objectsFound++;

            if (objectsFound > alreadyExtracted) {
              try {
                const parsed = JSON.parse(objectStr) as ParsedTask;
                newTasks.push(parsed);
              } catch {
                // Incomplete or malformed JSON, skip
              }
            }
            lastObjectEnd = pos;
            break;
          }
        }
      }
      pos++;
    }

    if (depth > 0) break;
  }

  return {
    newTasks,
    remaining: text.slice(lastObjectEnd),
  };
}

// ---------------------------------------------------------------------------
// suggestTaskDecomposition — internalAction (Node.js runtime, streaming)
// ---------------------------------------------------------------------------
export const suggestTaskDecomposition = internalAction({
  args: {
    orgId: v.string(),
    requirementId: v.id("requirements"),
    programId: v.id("programs"),
    placeholderId: v.id("taskDecompositions"),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      const [context, teamMembers, repoStructure] = await Promise.all([
        ctx.runQuery(internalApi.requirements.getWithContext, {
          requirementId: args.requirementId,
        }),
        ctx.runQuery(internalApi.teamMembers.getByProgramInternal, {
          programId: args.programId,
        }),
        getRepoStructureForProgram(ctx, args.programId as any),
      ]);

      if (!context) {
        throw new Error("Requirement not found or context unavailable");
      }

      const systemPrompt = `You are a technical project manager specializing in platform migrations. Decompose the provided requirement into actionable implementation tasks with accurate estimates.
Organization: ${args.orgId}

Think carefully about dependencies, skill requirements, and risk factors before decomposing.
Respond with valid JSON matching this schema:
{
  "decomposition_rationale": string,
  "critical_considerations": [string],
  "tasks": [{ "title": string, "description": string, "acceptance_criteria": [string], "story_points": number, "dependencies": [string], "required_skills": [string], "risk_factors": [string], "suggested_assignee_role": string (optional) }],
  "estimated_total_points": number,
  "estimated_sprint_count": number (optional)
}`;

      const userPrompt = `Decompose this requirement into implementation tasks:

Requirement: ${JSON.stringify(context.requirement)}
Program: ${JSON.stringify(context.program)}
Related Requirements: ${JSON.stringify(context.allRequirements)}
Existing Tasks: ${JSON.stringify(context.relatedTasks)}
Active Skills: ${JSON.stringify(context.activeSkills)}
Team Members: ${JSON.stringify(teamMembers)}
${repoStructure ? `\nRepository Structure:\n${repoStructure}` : ""}`;

      await ctx.runMutation(internalApi.taskDecomposition.updateDecompositionProgress, {
        placeholderId: args.placeholderId,
        progress: "Analyzing requirement and generating tasks...",
      });

      const client = getAnthropicClient();
      const stream = client.messages.stream({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 16384,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      let fullText = "";
      let taskCount = 0;
      let lastProgressUpdate = Date.now();

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;

          const extracted = extractCompletedTasks(fullText, taskCount);
          for (const task of extracted.newTasks) {
            await ctx.runMutation(internalApi.taskDecomposition.appendDecomposedTask, {
              placeholderId: args.placeholderId,
              task: { ...task, task_number: taskCount + 1 },
              taskIndex: taskCount,
            });
            taskCount++;
          }

          const now = Date.now();
          if (now - lastProgressUpdate >= 3000 && taskCount === 0) {
            lastProgressUpdate = now;
            await ctx.runMutation(internalApi.taskDecomposition.updateDecompositionProgress, {
              placeholderId: args.placeholderId,
              progress: "AI is analyzing the requirement...",
            });
          }
        }
      }

      // Final pass: parse any remaining tasks
      const finalExtracted = extractCompletedTasks(fullText, taskCount);
      for (const task of finalExtracted.newTasks) {
        await ctx.runMutation(internalApi.taskDecomposition.appendDecomposedTask, {
          placeholderId: args.placeholderId,
          task: { ...task, task_number: taskCount + 1 },
          taskIndex: taskCount,
        });
        taskCount++;
      }

      // Fallback: full JSON parse if streaming parser missed everything
      if (taskCount === 0) {
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          const tasks = data.tasks ?? [];
          if (Array.isArray(tasks) && tasks.length > 0) {
            for (const raw of tasks) {
              await ctx.runMutation(internalApi.taskDecomposition.appendDecomposedTask, {
                placeholderId: args.placeholderId,
                task: { ...raw, task_number: taskCount + 1 },
                taskIndex: taskCount,
              });
              taskCount++;
            }
          }
        }
      }

      if (taskCount === 0) {
        throw new Error("AI response did not contain a valid tasks array");
      }

      // Parse full response for top-level fields (rationale, considerations)
      let fullDecomposition: any = {};
      try {
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          fullDecomposition = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use whatever we streamed
      }

      const finalMessage = await stream.finalMessage();
      const tokenCount =
        (finalMessage.usage?.input_tokens ?? 0) + (finalMessage.usage?.output_tokens ?? 0);

      await ctx.runMutation(internalApi.taskDecomposition.finalizeDecomposition, {
        placeholderId: args.placeholderId,
        decomposition: fullDecomposition,
        thinkingTokens: 0,
        totalTokensUsed: tokenCount,
      });

      await ctx.runMutation(internalApi.ai.logExecution, {
        orgId: args.orgId,
        programId: args.programId,
        executionMode: "platform" as const,
        trigger: "manual" as const,
        taskType: "task_decomposition",
        inputSummary: userPrompt.slice(0, 200),
        outputSummary: `Generated ${taskCount} tasks (streamed)`,
        tokensUsed: tokenCount,
      });

      try {
        const tokenUsage = extractTokenUsage(finalMessage, "claude-sonnet-4-5-20250929");
        await ctx.runMutation(internal.billing.usageRecords.recordAiUsage, {
          orgId: args.orgId,
          programId: args.programId,
          source: "task_decomposition",
          claudeModelId: "claude-sonnet-4-5-20250929",
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          cacheReadTokens: tokenUsage.cacheReadTokens,
          cacheCreationTokens: tokenUsage.cacheCreationTokens,
          costUsd: calculateCostUsd(tokenUsage),
          sourceEntityId: String(args.requirementId),
          sourceEntityTable: "requirements",
        });
      } catch (e) {
        console.error("[billing] Failed to record AI usage:", e);
      }
    } catch (error) {
      await ctx.runMutation(internalApi.taskDecomposition.markDecompositionError, {
        placeholderId: args.placeholderId,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  },
});
