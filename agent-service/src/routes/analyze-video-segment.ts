import { Router } from "express";
import { runAgentQuery } from "../lib/ai-service.js";
import { AnalyzeVideoSegmentRequestSchema, AnalyzeVideoSegmentSchema } from "../schemas/video.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const parsed = AnalyzeVideoSegmentRequestSchema.safeParse(req.body);
    const orgId = req.headers["x-org-id"] as string;

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid analyze-video-segment request body",
          details: parsed.error.issues,
        },
      });
      return;
    }

    if (parsed.data.transcriptTurns.length === 0) {
      res.status(400).json({
        error: {
          code: "MISSING_TRANSCRIPT_TURNS",
          message: "transcriptTurns must not be empty",
        },
      });
      return;
    }

    const systemPrompt = `You are a senior migration analyst performing fused transcript + keyframe reasoning.
Organization: ${orgId ?? "unknown"}

Stage 4 goal: analyze one call segment using speaker-attributed transcript turns and temporally aligned keyframes.
Produce findings with precise timestamps, speaker attribution, and confidence labels.
Respond with valid JSON matching the required schema exactly.`;

    const prompt = `Analyze this video segment:\n\n${JSON.stringify(parsed.data, null, 2)}`;

    const result = await runAgentQuery(AnalyzeVideoSegmentSchema, {
      prompt,
      systemPrompt,
      maxThinkingTokens: 6000,
    });

    res.json({
      segmentAnalysis: result.data,
      stage: "analyze_video_segment",
      pipelineStage: 4,
      queryMetadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as analyzeVideoSegmentRouter };
