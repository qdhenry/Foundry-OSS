import { Router } from "express";
import { runAgentQuery } from "../lib/ai-service.js";
import {
  SynthesizeVideoFindingsRequestSchema,
  SynthesizeVideoFindingsSchema,
} from "../schemas/video.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const parsed = SynthesizeVideoFindingsRequestSchema.safeParse(req.body);
    const orgId = req.headers["x-org-id"] as string;

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid synthesize-video-findings request body",
          details: parsed.error.issues,
        },
      });
      return;
    }

    const systemPrompt = `You are a principal migration synthesis analyst for cross-segment reconciliation.
Organization: ${orgId ?? "unknown"}

Stage 5 goal: synthesize findings across all analyzed segments, deduplicate overlap, resolve contradictions, and produce visual discovery sections.
Ground every synthesized item in segment evidence and preserve source traceability.
Respond with valid JSON matching the required schema exactly.`;

    const prompt = `Synthesize findings from these analyzed video segments:\n\n${JSON.stringify(parsed.data, null, 2)}`;

    const result = await runAgentQuery(SynthesizeVideoFindingsSchema, {
      prompt,
      systemPrompt,
      maxThinkingTokens: 8000,
    });

    res.json({
      synthesizedVideoFindings: result.data,
      stage: "synthesize_video_findings",
      pipelineStage: 5,
      queryMetadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as synthesizeVideoFindingsRouter };
