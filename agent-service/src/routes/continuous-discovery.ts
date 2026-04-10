import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

const DiscoveryFindingsSchema = z.object({
  suggested_requirements: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      category: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      rationale: z.string(),
    }),
  ),
  identified_gaps: z.array(
    z.object({
      area: z.string(),
      description: z.string(),
      severity: z.enum(["critical", "high", "medium", "low"]),
      suggested_action: z.string(),
    }),
  ),
  risk_indicators: z.array(
    z.object({
      indicator: z.string(),
      risk_level: z.enum(["critical", "high", "medium", "low"]),
      affected_workstreams: z.array(z.string()),
      mitigation_suggestion: z.string(),
    }),
  ),
  key_insights: z.array(
    z.object({
      insight: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
      source_context: z.string(),
    }),
  ),
});

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { prompt, context } = req.body;
    const orgId = req.headers["x-org-id"] as string;

    if (!prompt) {
      res.status(400).json({ error: { code: "MISSING_PROMPT", message: "prompt is required" } });
      return;
    }

    const systemPrompt = `You are a migration discovery analyst. Analyze the provided context and produce structured discovery findings for a platform migration project.
Organization: ${orgId ?? "unknown"}
${context ? `Additional context: ${JSON.stringify(context)}` : ""}

Respond with valid JSON matching the required schema.`;

    const result = await runAgentQuery(DiscoveryFindingsSchema, {
      prompt,
      systemPrompt,
    });

    res.json({
      findings: result.data,
      metadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as continuousDiscoveryRouter };
