import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

// Lenient schema: accept partial AI responses with sensible defaults
const DispatchResultSchema = z.object({
  summary: z.string().optional().default("No summary provided"),
  findings: z.array(z.string()).optional().default([]),
  artifacts: z
    .array(
      z.object({
        type: z.string().optional().default("unknown"),
        title: z.string().optional().default("Untitled"),
        content: z.string().optional().default(""),
      }),
    )
    .optional()
    .default([]),
  nextActions: z.array(z.string()).optional().default([]),
});

/** Build a normalized response that always matches the executor's expected shape. */
function buildResponse(
  data: z.infer<typeof DispatchResultSchema>,
  metadata: {
    inputTokens: number;
    outputTokens: number;
    totalTokensUsed: number;
    processedAt: string;
  },
) {
  return {
    result: {
      summary: data.summary ?? "No summary provided",
      findings: data.findings ?? [],
      artifacts: data.artifacts ?? [],
      nextActions: data.nextActions ?? [],
    },
    metadata: {
      inputTokens: metadata.inputTokens ?? 0,
      outputTokens: metadata.outputTokens ?? 0,
      totalTokensUsed: metadata.totalTokensUsed ?? 0,
      processedAt: metadata.processedAt,
    },
  };
}

/** Build an error fallback response that still satisfies the executor's shape. */
function buildErrorResponse(errorMessage: string) {
  return {
    result: {
      summary: `Agent dispatch failed: ${errorMessage}`,
      findings: [],
      artifacts: [],
      nextActions: [],
    },
    metadata: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokensUsed: 0,
      processedAt: new Date().toISOString(),
    },
  };
}

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { agent, task, context } = req.body;

    if (!agent?.name || !task?.title) {
      res.status(400).json({
        error: { code: "INVALID_REQUEST", message: "agent and task are required" },
      });
      return;
    }

    const prompt = `Execute this assignment as the specified AI delivery agent.

Agent: ${JSON.stringify(agent)}
Task: ${JSON.stringify(task)}
Context: ${JSON.stringify(context ?? {})}

Produce structured analysis and actionable next steps.`;

    const systemPrompt = `You are ${agent.name}, operating as ${agent.role}.
Organization: ${orgId ?? "unknown"}

Follow the provided system prompt and constraints:
System prompt: ${agent.systemPrompt ?? ""}
Constraints: ${JSON.stringify(agent.constraints ?? [])}

Return valid JSON matching the response schema.`;

    try {
      const result = await runAgentQuery(DispatchResultSchema, {
        prompt,
        systemPrompt,
        maxThinkingTokens: 6000,
        model: agent.model,
      });

      res.json(buildResponse(result.data, result.metadata));
    } catch (aiError: any) {
      // AI call failed but we can still return a structured response
      // so the executor can record the failure cleanly
      console.error("[dispatch-agent] AI call failed:", aiError?.message ?? aiError);
      res.json(buildErrorResponse(aiError?.message ?? "Unknown AI error"));
    }
  } catch (error) {
    next(error);
  }
});

export { router as dispatchAgentRouter };
