import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

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
      proposed_sub_requirements: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
        }),
      ),
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

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { prompt, requirement, context } = req.body;
    const orgId = req.headers["x-org-id"] as string;

    if (!prompt) {
      res.status(400).json({ error: { code: "MISSING_PROMPT", message: "prompt is required" } });
      return;
    }

    const systemPrompt = `You are a requirements engineering specialist for platform migrations. Analyze and refine the provided requirement for clarity, completeness, and testability.
Organization: ${orgId ?? "unknown"}
${requirement ? `Requirement: ${JSON.stringify(requirement)}` : ""}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}

Respond with valid JSON matching the required schema.`;

    const result = await runAgentQuery(RefinementSchema, {
      prompt,
      systemPrompt,
    });

    res.json({
      refinement: result.data,
      metadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as refineRequirementRouter };
