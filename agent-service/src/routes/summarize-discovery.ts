import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

const DiscoverySummarySchema = z.object({
  overview: z.string(),
  statusBreakdown: z.string(),
  priorityDistribution: z.string(),
  fitGapAnalysis: z.string(),
  keyInsights: z.array(z.string()),
  recommendations: z.array(z.string()),
  riskFlags: z.array(z.string()),
});

const RequirementInputSchema = z.object({
  title: z.string(),
  status: z.string(),
  priority: z.string(),
  fitGap: z.string(),
  workstream: z.string().optional(),
  description: z.string().optional(),
  effortEstimate: z.string().optional(),
});

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { requirements, programName, targetPlatform } = req.body;
    const orgId = req.headers["x-org-id"] as string;

    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
      res.status(400).json({
        error: {
          code: "MISSING_REQUIREMENTS",
          message: "requirements array is required and must not be empty",
        },
      });
      return;
    }

    const parsed = z.array(RequirementInputSchema).safeParse(requirements);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUIREMENTS",
          message: "Invalid requirements format",
          details: parsed.error.issues,
        },
      });
      return;
    }

    const systemPrompt = `You are a senior migration consultant analyzing discovery findings for a platform migration project.
Organization: ${orgId ?? "unknown"}
Program: ${programName ?? "Unknown Program"}
Target Platform: ${targetPlatform ?? "unknown"}

Analyze the provided requirements data and produce a structured JSON summary. Be specific and actionable — reference actual numbers from the data. Identify patterns, risks, and strategic recommendations.

Respond with valid JSON matching this schema:
{
  "overview": "2-3 sentence executive summary of the discovery state",
  "statusBreakdown": "Analysis of requirement statuses and what they indicate about project readiness",
  "priorityDistribution": "Analysis of priority spread and what it means for planning",
  "fitGapAnalysis": "Analysis of fit/gap distribution and implications for effort/timeline",
  "keyInsights": ["insight 1", "insight 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "riskFlags": ["risk 1", "risk 2", ...]
}`;

    const prompt = `Analyze these ${requirements.length} discovery requirements and produce a strategic summary:\n\n${JSON.stringify(parsed.data, null, 2)}`;

    const result = await runAgentQuery(DiscoverySummarySchema, {
      prompt,
      systemPrompt,
    });

    res.json({
      summary: result.data,
      metadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as summarizeDiscoveryRouter };
