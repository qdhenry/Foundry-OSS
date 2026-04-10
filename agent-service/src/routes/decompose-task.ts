import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

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

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { prompt, requirement, context } = req.body;
    const orgId = req.headers["x-org-id"] as string;

    if (!prompt) {
      res.status(400).json({ error: { code: "MISSING_PROMPT", message: "prompt is required" } });
      return;
    }

    const systemPrompt = `You are a technical project manager specializing in platform migrations. Decompose the provided requirement into actionable implementation tasks with accurate estimates.
Organization: ${orgId ?? "unknown"}
${requirement ? `Requirement: ${JSON.stringify(requirement)}` : ""}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}

Think carefully about dependencies, skill requirements, and risk factors before decomposing.
Respond with valid JSON matching the required schema.`;

    const result = await runAgentQuery(TaskDecompositionSchema, {
      prompt,
      systemPrompt,
      maxThinkingTokens: 8000,
    });

    res.json({
      decomposition: result.data,
      metadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as decomposeTaskRouter };
