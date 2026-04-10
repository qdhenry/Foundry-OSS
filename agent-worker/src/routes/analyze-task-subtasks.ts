import { Hono } from "hono";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service";
import type { Env } from "../types";

const SubtaskProposalSchema = z.object({
  subtaskId: z.string().nullable(),
  proposalType: z.enum(["status_change", "rewrite", "new_subtask", "skip"]),
  currentState: z
    .object({
      title: z.string(),
      status: z.string(),
    })
    .optional(),
  proposedState: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    prompt: z.string().optional(),
    status: z.string().optional(),
  }),
  reasoning: z.string(),
  evidence: z.object({
    files: z.array(
      z.object({
        filePath: z.string(),
        lineStart: z.number().optional(),
        lineEnd: z.number().optional(),
        snippet: z.string().optional(),
      }),
    ),
  }),
});

const TaskAnalysisResultSchema = z.object({
  taskImplementationStatus: z.enum([
    "not_found",
    "partially_implemented",
    "fully_implemented",
    "needs_verification",
  ]),
  confidence: z.number().min(0).max(100),
  subtaskProposals: z.array(SubtaskProposalSchema),
});

type TaskAnalysisResult = z.infer<typeof TaskAnalysisResultSchema>;

const MODEL_BY_TIER: Record<string, string> = {
  fast: "claude-sonnet-4-5-20250929",
  standard: "claude-sonnet-4-5-20250929",
  thorough: "claude-opus-4-6",
};

const THINKING_BY_TIER: Record<string, number | undefined> = {
  fast: undefined,
  standard: 6000,
  thorough: 8000,
};

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const body = await c.req.json();
  const {
    taskId,
    taskTitle,
    taskDescription,
    acceptanceCriteria,
    subtasks,
    directoryScope,
    directoryContents,
    config,
  } = body;

  if (!taskTitle) {
    return c.json({ error: { code: "MISSING_TASK", message: "taskTitle is required" } }, 400);
  }

  const tier = config?.modelTier ?? "standard";
  const model = MODEL_BY_TIER[tier] ?? MODEL_BY_TIER.standard;
  const thinkingTokens = THINKING_BY_TIER[tier];

  const criteriaBlock =
    acceptanceCriteria && acceptanceCriteria.length > 0
      ? `\nAcceptance Criteria:\n${acceptanceCriteria.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`
      : "";

  const subtaskBlock =
    subtasks && subtasks.length > 0
      ? subtasks
          .map(
            (s: any, i: number) =>
              `[${i + 1}] ID: ${s.id}\n    Title: ${s.title}\n    Status: ${s.status}\n    Description: ${s.description}\n    Prompt: ${s.prompt}`,
          )
          .join("\n\n")
      : "No subtasks exist yet.";

  const codeBlock =
    directoryContents && directoryContents.length > 0
      ? directoryContents
          .map((f: { path: string; content: string }) => `--- ${f.path} ---\n${f.content}`)
          .join("\n\n")
      : "No source files found in the specified directory.";

  const systemPrompt = `You are an expert code analyst specializing in task decomposition and implementation tracking.

Your job is to analyze source code against a task and its subtasks, then propose changes:

For EACH existing subtask, determine:
- "status_change": if the subtask's work is already done in code (set status to "completed" or "skipped")
- "rewrite": if the subtask's prompt should be adjusted based on actual code structure
- "skip": if the subtask is no longer relevant

You may also propose "new_subtask" entries for gaps you identify.

Rules:
- Never propose changes to subtasks with status "executing" — skip them
- Be conservative — only propose "completed" if the code clearly does what the subtask describes
- For rewrites, explain WHY the prompt needs adjustment
- Keep evidence snippets under 500 characters
- Include file evidence for every proposal

Respond with valid JSON matching the required schema. No markdown fences.`;

  const prompt = `Analyze this task and its subtasks against the codebase.

## Task
ID: ${taskId ?? "unknown"}
Title: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ""}${criteriaBlock}

## Existing Subtasks (${subtasks?.length ?? 0})
${subtaskBlock}

## Directory Scope: ${directoryScope ?? "entire repo"}

## Source Code (${directoryContents?.length ?? 0} files)
${codeBlock}

Analyze and produce proposals for each subtask as JSON.`;

  const result = await runAgentQuery<TaskAnalysisResult>(
    TaskAnalysisResultSchema,
    {
      prompt,
      systemPrompt,
      model,
      ...(thinkingTokens && { maxThinkingTokens: thinkingTokens }),
    },
    c.env.ANTHROPIC_API_KEY,
  );

  return c.json({
    ...result.data,
    metadata: result.metadata,
  });
});

export { app as analyzeTaskSubtasksRoute };
