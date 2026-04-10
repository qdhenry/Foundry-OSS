import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

const GateEvaluationSchema = z.object({
  overall_readiness_percent: z.number().min(0).max(100),
  gate_criteria_status: z.array(
    z.object({
      criterion: z.string(),
      status: z.enum(["passed", "failed", "partial", "not_evaluated"]),
      score: z.number().min(0).max(100),
      evidence: z.string(),
      notes: z.string().optional(),
    }),
  ),
  critical_blockers: z.array(
    z.object({
      blocker: z.string(),
      severity: z.enum(["critical", "high"]),
      resolution_path: z.string(),
      estimated_effort: z.string(),
    }),
  ),
  health_assessment: z.object({
    schedule_health: z.enum(["on_track", "at_risk", "behind"]),
    quality_health: z.enum(["good", "acceptable", "poor"]),
    team_health: z.enum(["strong", "adequate", "strained"]),
    budget_health: z.enum(["on_track", "at_risk", "over"]),
    summary: z.string(),
  }),
  recommendations: z.array(
    z.object({
      recommendation: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      category: z.enum(["process", "technical", "team", "scope"]),
    }),
  ),
  next_steps: z.array(
    z.object({
      action: z.string(),
      owner: z.string().optional(),
      deadline: z.string().optional(),
      dependency: z.string().optional(),
    }),
  ),
});

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { prompt, gateDefinition, projectStatus, context } = req.body;
    const orgId = req.headers["x-org-id"] as string;

    if (!prompt) {
      res.status(400).json({ error: { code: "MISSING_PROMPT", message: "prompt is required" } });
      return;
    }

    const systemPrompt = `You are a quality gate evaluator for enterprise platform migrations. Assess project readiness against gate criteria, identify blockers, and provide actionable recommendations.
Organization: ${orgId ?? "unknown"}
${gateDefinition ? `Gate definition: ${JSON.stringify(gateDefinition)}` : ""}
${projectStatus ? `Project status: ${JSON.stringify(projectStatus)}` : ""}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}

Think carefully about all gate criteria and their interdependencies before evaluating.
Respond with valid JSON matching the required schema.`;

    const result = await runAgentQuery(GateEvaluationSchema, {
      prompt,
      systemPrompt,
      maxThinkingTokens: 7000,
    });

    res.json({
      gate_evaluation: result.data,
      metadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as evaluateGateRouter };
