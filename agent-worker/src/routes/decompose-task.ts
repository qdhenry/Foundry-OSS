import { Hono } from "hono";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service";
import type { Env } from "../types";

const TaskDecompositionSchema = z.object({
  decomposition_rationale: z.string(),
  critical_considerations: z.array(z.string()),
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      acceptance_criteria: z.array(z.string()),
      story_points: z.number(),
      dependencies: z.array(z.string()),
      required_skills: z.array(z.string()),
      risk_factors: z.array(z.string()),
      suggested_assignee_role: z.string().optional(),
    }),
  ),
  estimated_total_points: z.number(),
  estimated_sprint_count: z.number().optional(),
});

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const { prompt, requirement, context } = await c.req.json();
  const orgId = c.req.header("x-org-id") ?? "unknown";

  if (!prompt) {
    return c.json({ error: { code: "MISSING_PROMPT", message: "prompt is required" } }, 400);
  }

  const systemPrompt = `You are a technical project manager specializing in platform migrations. Decompose the provided requirement into actionable implementation tasks with accurate estimates.
Organization: ${orgId}
${requirement ? `Requirement: ${JSON.stringify(requirement)}` : ""}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}

Think carefully about dependencies, skill requirements, and risk factors before decomposing.
Respond with valid JSON matching the required schema.`;

  const result = await runAgentQuery(
    TaskDecompositionSchema,
    { prompt, systemPrompt, maxThinkingTokens: 8000 },
    c.env.ANTHROPIC_API_KEY,
  );

  return c.json({ decomposition: result.data, metadata: result.metadata });
});

export { app as decomposeTaskRoute };
