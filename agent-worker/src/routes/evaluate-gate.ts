import { Hono } from "hono";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service";
import type { Env } from "../types";

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

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const { prompt, gateDefinition, projectStatus, context } = await c.req.json();
  const orgId = c.req.header("x-org-id") ?? "unknown";

  if (!prompt) {
    return c.json({ error: { code: "MISSING_PROMPT", message: "prompt is required" } }, 400);
  }

  const systemPrompt = `You are a quality gate evaluator for enterprise platform migrations. Assess project readiness against gate criteria, identify blockers, and provide actionable recommendations.
Organization: ${orgId}
${gateDefinition ? `Gate definition: ${JSON.stringify(gateDefinition)}` : ""}
${projectStatus ? `Project status: ${JSON.stringify(projectStatus)}` : ""}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}

Think carefully about all gate criteria and their interdependencies before evaluating.
Respond with valid JSON matching the required schema.`;

  const result = await runAgentQuery(
    GateEvaluationSchema,
    { prompt, systemPrompt, maxThinkingTokens: 7000 },
    c.env.ANTHROPIC_API_KEY,
  );

  return c.json({ gate_evaluation: result.data, metadata: result.metadata });
});

export { app as evaluateGateRoute };
