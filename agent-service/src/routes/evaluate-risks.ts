import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

const RiskAssessmentSchema = z.object({
  change_impact_summary: z.object({
    overall_risk_level: z.enum(["critical", "high", "medium", "low"]),
    confidence: z.enum(["high", "medium", "low"]),
    summary: z.string(),
  }),
  new_risks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        severity: z.enum(["critical", "high", "medium", "low"]),
        likelihood: z.enum(["very_likely", "likely", "possible", "unlikely"]),
        affected_workstreams: z.array(z.string()),
        mitigation_strategy: z.string(),
      }),
    )
    .optional(),
  escalations: z
    .array(
      z.object({
        risk_id: z.string(),
        previous_severity: z.string(),
        new_severity: z.string(),
        reason: z.string(),
        recommended_action: z.string(),
      }),
    )
    .optional(),
  cascade_impacts: z
    .array(
      z.object({
        trigger: z.string(),
        affected_areas: z.array(z.string()),
        impact_description: z.string(),
        probability: z.enum(["high", "medium", "low"]),
      }),
    )
    .optional(),
  recommendations: z
    .array(
      z.object({
        priority: z.enum(["immediate", "short_term", "long_term"]),
        action: z.string(),
        expected_outcome: z.string(),
        effort: z.enum(["low", "medium", "high"]),
      }),
    )
    .optional(),
});

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { prompt, changes, existingRisks, context } = req.body;
    const orgId = req.headers["x-org-id"] as string;

    if (!prompt) {
      res.status(400).json({ error: { code: "MISSING_PROMPT", message: "prompt is required" } });
      return;
    }

    const systemPrompt = `You are a risk assessment specialist for enterprise platform migrations. Evaluate the impact of recent changes on overall project risk, identify new risks, and recommend mitigations.
Organization: ${orgId ?? "unknown"}
${changes ? `Recent changes: ${JSON.stringify(changes)}` : ""}
${existingRisks ? `Existing risks: ${JSON.stringify(existingRisks)}` : ""}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}

Think carefully about cascade effects and second-order impacts before assessing.
Respond with valid JSON matching the required schema.`;

    const result = await runAgentQuery(RiskAssessmentSchema, {
      prompt,
      systemPrompt,
      maxThinkingTokens: 6000,
    });

    res.json({
      risk_assessment: result.data,
      metadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as evaluateRisksRouter };
