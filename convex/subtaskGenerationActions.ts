"use node";
import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internalAction } from "./_generated/server";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "./lib/aiCostTracking";
import { getRepoStructureForTask } from "./lib/repoContext";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// Streaming subtask extraction helpers
// ---------------------------------------------------------------------------

interface ParsedSubtask {
  title?: string;
  description?: string;
  prompt?: string;
  estimatedFiles?: number;
  complexityScore?: number;
  estimatedDurationMs?: number;
  allowedFiles?: string[];
  isPausePoint?: boolean;
}

function normalizeSubtask(raw: ParsedSubtask, index: number) {
  return {
    title: String(raw.title ?? `Subtask ${index + 1}`),
    description: String(raw.description ?? ""),
    prompt: String(raw.prompt ?? raw.description ?? ""),
    estimatedFiles: Math.max(1, Number(raw.estimatedFiles) || 1),
    complexityScore: Math.min(5, Math.max(1, Number(raw.complexityScore) || 1)),
    estimatedDurationMs: Math.max(
      60000,
      Math.min(600000, Number(raw.estimatedDurationMs) || 180000),
    ),
    allowedFiles: Array.isArray(raw.allowedFiles)
      ? raw.allowedFiles.filter((f: unknown) => typeof f === "string")
      : undefined,
    isPausePoint: Boolean(raw.isPausePoint),
  };
}

/**
 * Extract completed JSON objects from the streamed text within the "subtasks" array.
 * Uses brace-depth tracking to find complete objects.
 */
function extractCompletedSubtasks(
  text: string,
  alreadyExtracted: number,
): { newSubtasks: ParsedSubtask[]; remaining: string } {
  const newSubtasks: ParsedSubtask[] = [];

  // Find the subtasks array start
  const arrayMatch = text.match(/"subtasks"\s*:\s*\[/);
  if (!arrayMatch || arrayMatch.index === undefined) {
    return { newSubtasks, remaining: text };
  }

  let pos = arrayMatch.index + arrayMatch[0].length;
  let objectsFound = 0;
  let lastObjectEnd = pos;

  while (pos < text.length) {
    // Skip whitespace and commas
    while (pos < text.length && /[\s,]/.test(text[pos])) pos++;
    if (pos >= text.length || text[pos] === "]") break;

    if (text[pos] !== "{") {
      pos++;
      continue;
    }

    // Track brace depth to find complete object
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
            pos++; // move past closing brace
            const objectStr = text.slice(objectStart, pos);
            objectsFound++;

            // Only parse objects we haven't already extracted
            if (objectsFound > alreadyExtracted) {
              try {
                const parsed = JSON.parse(objectStr) as ParsedSubtask;
                newSubtasks.push(parsed);
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

    // If we didn't close the object, it's incomplete — stop
    if (depth > 0) break;
  }

  // Keep text from the last complete object onward for the next pass
  return {
    newSubtasks,
    remaining: text.slice(lastObjectEnd),
  };
}

// ---------------------------------------------------------------------------
// generateSubtasks — internalAction (Node.js runtime)
// Decomposes a task into ordered subtasks with scoped prompts, streaming
// ---------------------------------------------------------------------------
export const generateSubtasks = internalAction({
  args: {
    orgId: v.string(),
    taskId: v.id("tasks"),
    programId: v.id("programs"),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      // 1. Gather context

      // Gather full context in parallel
      const [taskData, program, existingSubtasks, teamMembers, activeSkills, repoStructure] =
        await Promise.all([
          ctx.runQuery(internalApi.tasks.getInternal, {
            taskId: args.taskId,
          }),
          ctx.runQuery(internalApi.programs.getByIdInternal, {
            programId: args.programId,
          }),
          ctx.runQuery(internalApi.subtasks.listByTaskInternal, {
            taskId: args.taskId,
          }),
          ctx.runQuery(internalApi.teamMembers.getByProgramInternal, {
            programId: args.programId,
          }),
          ctx.runQuery(internalApi.skills.getActiveByProgram, {
            programId: args.programId,
          }),
          getRepoStructureForTask(ctx, args.programId as any),
        ]);

      // Fetch linked requirement if task has one
      let linkedRequirement: any = null;
      if (taskData?.requirementId) {
        linkedRequirement = await ctx.runQuery(internalApi.requirements.getWithContext, {
          requirementId: taskData.requirementId,
        });
      }

      // 2. Build prompts
      const systemPrompt = `You are a technical implementation planner for a platform migration project. Break down the provided task into ordered subtasks suitable for an AI coding agent to execute one at a time in a sandboxed environment.

<constraints>
- Each subtask must be self-contained: a single, scoped code change or operation.
- Subtasks execute SEQUENTIALLY — later subtasks can reference prior subtask outputs.
- Each subtask gets a scoped file list ("allowedFiles") to prevent cross-concern changes.
- Include a "prompt" field with the EXACT instruction the coding agent will receive.
- Include pause points (isPausePoint: true) after significant milestones for human review.
- Set complexityScore from 1 (trivial) to 5 (complex) to reflect implementation difficulty.
</constraints>

<sizing_rules>
- Target 1-3 files per subtask. If a subtask touches 4+ files, split it.
- estimatedDurationMs: target 120000-300000ms (2-5 min). Minimum 60000ms, maximum 600000ms.
- estimatedFiles: number of files expected to be modified.
- 3-8 subtasks is ideal. More than 10 usually means the parent task should be split.
</sizing_rules>

<prompt_generation>
Each subtask "prompt" must be a complete, standalone instruction for a coding agent that:
- References specific file paths from the codebase structure
- Includes acceptance criteria the agent can verify
- Specifies what to import, where to add code, and expected behavior
- Uses XML tags for structured sections when the prompt is complex
</prompt_generation>

Respond with valid JSON matching this schema:
{
  "decomposition_rationale": string,
  "subtasks": [
    {
      "title": string,
      "description": string,
      "prompt": string,
      "estimatedFiles": number,
      "complexityScore": number (1-5),
      "estimatedDurationMs": number,
      "allowedFiles": [string] (glob patterns),
      "isPausePoint": boolean
    }
  ]
}

Guidelines:
- First subtask often sets up types/interfaces.
- Last subtask usually runs tests or linting.
- Place pause points after schema changes, after core logic, and before the final test run.`;

      // Assemble XML-structured user prompt sections
      const prog = program as any;
      const task = taskData as any;

      const taskSection = `<task>
<title>${task?.title ?? "Unknown"}</title>
<description>${task?.description ?? "No description"}</description>
<status>${task?.status ?? "unknown"}</status>
${task?.priority ? `<priority>${task.priority}</priority>` : ""}
</task>`;

      const requirementSection = linkedRequirement
        ? `<requirement>
<title>${(linkedRequirement as any).requirement?.title ?? ""}</title>
<ref_id>${(linkedRequirement as any).requirement?.refId ?? ""}</ref_id>
<description>${(linkedRequirement as any).requirement?.description ?? ""}</description>
<fit_gap>${(linkedRequirement as any).requirement?.fitGap ?? ""}</fit_gap>
<acceptance_criteria>${JSON.stringify((linkedRequirement as any).requirement?.acceptanceCriteria ?? [])}</acceptance_criteria>
</requirement>`
        : "";

      const programSection = prog
        ? `<program>
<name>${prog.name ?? "Unknown"}</name>
<source_platform>${prog.sourcePlatform ?? ""}</source_platform>
<target_platform>${prog.targetPlatform ?? ""}</target_platform>
</program>`
        : "";

      const codebaseSection = repoStructure
        ? `<codebase_structure>
${repoStructure}
</codebase_structure>`
        : "";

      const skillsSection =
        activeSkills && (activeSkills as any[]).length > 0
          ? `<active_skills>
${(activeSkills as any[]).map((s: any) => `- ${s.name}${s.domain ? ` (${s.domain})` : ""}: ${s.description ?? ""}`).join("\n")}
</active_skills>`
          : "";

      const teamSection =
        teamMembers && (teamMembers as any[]).length > 0
          ? `<team>
${(teamMembers as any[]).map((m: any) => `- ${m.name} (${m.role ?? "member"})`).join("\n")}
</team>`
          : "";

      const existingContext =
        existingSubtasks && (existingSubtasks as any[]).length > 0
          ? `<existing_subtasks>
${JSON.stringify((existingSubtasks as any[]).map((s: any) => ({ title: s.title, status: s.status })))}
</existing_subtasks>`
          : "";

      const userPrompt = `Break down this task into implementation subtasks.

${taskSection}
${requirementSection}
${programSection}
${codebaseSection}
${skillsSection}
${teamSection}
${existingContext}`.trim();

      // 3. Stream AI response and insert subtasks incrementally
      await ctx.runMutation(internalApi.subtaskGeneration.updateProgress, {
        taskId: args.taskId,
        progress: "Analyzing task and generating subtasks...",
      });

      const client = getAnthropicClient();
      const stream = client.messages.stream({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 16384,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      let fullText = "";
      let subtaskCount = 0;
      let lastProgressUpdate = Date.now();

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;

          // Try to extract completed subtask objects from the stream
          const extracted = extractCompletedSubtasks(fullText, subtaskCount);
          for (const subtask of extracted.newSubtasks) {
            const normalized = normalizeSubtask(subtask, subtaskCount);
            await ctx.runMutation(internalApi.subtaskGeneration.insertOneSubtask, {
              taskId: args.taskId,
              subtask: normalized,
              order: subtaskCount,
              isFirst: subtaskCount === 0,
            });
            subtaskCount++;
          }

          // Throttled progress update while waiting for first subtask (every 3s)
          const now = Date.now();
          if (now - lastProgressUpdate >= 3000 && subtaskCount === 0) {
            lastProgressUpdate = now;
            await ctx.runMutation(internalApi.subtaskGeneration.updateProgress, {
              taskId: args.taskId,
              progress: "AI is analyzing the codebase...",
            });
          }
        }
      }

      // Final pass: parse any remaining subtasks from complete response
      const finalExtracted = extractCompletedSubtasks(fullText, subtaskCount);
      for (const subtask of finalExtracted.newSubtasks) {
        const normalized = normalizeSubtask(subtask, subtaskCount);
        await ctx.runMutation(internalApi.subtaskGeneration.insertOneSubtask, {
          taskId: args.taskId,
          subtask: normalized,
          order: subtaskCount,
          isFirst: subtaskCount === 0,
        });
        subtaskCount++;
      }

      // If streaming parser missed everything, fall back to full JSON parse
      if (subtaskCount === 0) {
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          const subtasks = data.subtasks ?? data;
          if (Array.isArray(subtasks) && subtasks.length > 0) {
            for (const raw of subtasks) {
              const normalized = normalizeSubtask(raw, subtaskCount);
              await ctx.runMutation(internalApi.subtaskGeneration.insertOneSubtask, {
                taskId: args.taskId,
                subtask: normalized,
                order: subtaskCount,
                isFirst: subtaskCount === 0,
              });
              subtaskCount++;
            }
          }
        }
      }

      if (subtaskCount === 0) {
        throw new Error("AI response did not contain a valid subtasks array");
      }

      // Get token usage from final message
      const finalMessage = await stream.finalMessage();
      const tokenCount =
        (finalMessage.usage?.input_tokens ?? 0) + (finalMessage.usage?.output_tokens ?? 0);

      // 4. Finalize generation
      await ctx.runMutation(internalApi.subtaskGeneration.finalizeGeneration, {
        taskId: args.taskId,
        totalSubtasks: subtaskCount,
        totalTokensUsed: tokenCount,
      });

      // Log to agentExecutions
      try {
        await ctx.runMutation(internalApi.ai.logExecution, {
          orgId: args.orgId,
          programId: args.programId,
          taskId: args.taskId,
          executionMode: "platform" as const,
          trigger: "manual" as const,
          taskType: "subtask_generation",
          inputSummary: userPrompt.slice(0, 200),
          outputSummary: `Generated ${subtaskCount} subtasks (streamed)`,
          tokensUsed: tokenCount,
        });
      } catch {
        // Best effort telemetry
      }

      // Record AI usage for billing (best-effort)
      try {
        const tokenUsage = extractTokenUsage(finalMessage, "claude-sonnet-4-5-20250929");
        await ctx.runMutation(internalApi.billing.usageRecords.recordAiUsage, {
          orgId: args.orgId,
          programId: args.programId,
          source: "subtask_generation" as const,
          claudeModelId: "claude-sonnet-4-5-20250929",
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          cacheReadTokens: tokenUsage.cacheReadTokens,
          cacheCreationTokens: tokenUsage.cacheCreationTokens,
          costUsd: calculateCostUsd(tokenUsage),
          sourceEntityId: String(args.taskId),
          sourceEntityTable: "tasks",
        });
      } catch (e) {
        console.error("[billing] Failed to record subtask generation usage:", e);
      }
    } catch (error) {
      await ctx.runMutation(internalApi.subtaskGeneration.markSubtaskGenerationError, {
        taskId: args.taskId,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  },
});
