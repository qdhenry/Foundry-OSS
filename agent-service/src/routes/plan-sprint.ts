import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

const SprintCompositionSchema = z.object({
  capacity_analysis: z.object({
    total_capacity_points: z.number(),
    available_team_members: z.number(),
    risk_buffer_percent: z.number(),
    effective_capacity: z.number(),
  }),
  recommended_tasks: z.array(
    z.object({
      task_id: z.string(),
      title: z.string(),
      story_points: z.number(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      assigned_to: z.string().optional(),
      rationale: z.string(),
    }),
  ),
  deferred_to_next_sprint: z
    .array(
      z.object({
        task_id: z.string(),
        title: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
  total_planned_points: z.number(),
  capacity_utilization_percent: z.number().optional(),
  sprint_health_indicators: z
    .object({
      dependency_risk: z.enum(["low", "medium", "high"]),
      skill_coverage: z.enum(["good", "partial", "poor"]),
      scope_stability: z.enum(["stable", "moderate", "volatile"]),
      overall_confidence: z.enum(["high", "medium", "low"]),
    })
    .optional(),
});

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { prompt, tasks, team, sprintConfig, context } = req.body;
    const orgId = req.headers["x-org-id"] as string;

    if (!prompt) {
      res.status(400).json({ error: { code: "MISSING_PROMPT", message: "prompt is required" } });
      return;
    }

    const systemPrompt = `You are an agile sprint planner for enterprise platform migrations. Compose an optimal sprint from the available tasks considering team capacity, dependencies, and risk.
Organization: ${orgId ?? "unknown"}
${tasks ? `Available tasks: ${JSON.stringify(tasks)}` : ""}
${team ? `Team: ${JSON.stringify(team)}` : ""}
${sprintConfig ? `Sprint config: ${JSON.stringify(sprintConfig)}` : ""}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}

Respond with valid JSON matching the required schema.`;

    const result = await runAgentQuery(SprintCompositionSchema, {
      prompt,
      systemPrompt,
    });

    res.json({
      sprint_plan: result.data,
      metadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as planSprintRouter };
