import { Hono } from "hono";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service";
import type { Env } from "../types";

const RefinementSchema = z.object({
  overall_assessment: z.object({
    clarity_score: z.number().min(1).max(10),
    completeness_score: z.number().min(1).max(10),
    testability_score: z.number().min(1).max(10),
    summary: z.string(),
  }),
  suggestions: z.array(
    z.object({
      area: z.string(),
      current_text: z.string(),
      suggested_text: z.string(),
      reason: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
    }),
  ),
  potential_split: z
    .object({
      should_split: z.boolean(),
      reason: z.string(),
      proposed_sub_requirements: z.array(z.object({ title: z.string(), description: z.string() })),
    })
    .optional(),
  related_requirements: z
    .array(
      z.object({
        requirement_id: z.string(),
        relationship: z.enum(["depends_on", "conflicts_with", "extends", "duplicates"]),
        description: z.string(),
      }),
    )
    .optional(),
});

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const { prompt, requirement, context } = await c.req.json();
  const orgId = c.req.header("x-org-id") ?? "unknown";

  if (!prompt) {
    return c.json({ error: { code: "MISSING_PROMPT", message: "prompt is required" } }, 400);
  }

  const systemPrompt = `You are a requirements engineering specialist for platform migrations. Analyze and refine the provided requirement for clarity, completeness, and testability.
Organization: ${orgId}
${requirement ? `Requirement: ${JSON.stringify(requirement)}` : ""}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}

Respond with valid JSON matching the required schema.`;

  const result = await runAgentQuery(
    RefinementSchema,
    { prompt, systemPrompt },
    c.env.ANTHROPIC_API_KEY,
  );

  return c.json({ refinement: result.data, metadata: result.metadata });
});

export { app as refineRequirementRoute };
