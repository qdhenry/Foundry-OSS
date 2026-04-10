import { Router } from "express";
import { runAgentQuery } from "../lib/ai-service.js";
import { AnalyzeFramesDeepRequestSchema, AnalyzeFramesDeepSchema } from "../schemas/video.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const parsed = AnalyzeFramesDeepRequestSchema.safeParse(req.body);
    const orgId = req.headers["x-org-id"] as string;

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid analyze-frames-deep request body",
          details: parsed.error.issues,
        },
      });
      return;
    }

    if (parsed.data.frames.length === 0) {
      res.status(400).json({
        error: {
          code: "MISSING_FRAMES",
          message: "frames must not be empty",
        },
      });
      return;
    }

    const systemPrompt = `You are a senior multimodal analyst performing deep frame reasoning for call analysis.
Organization: ${orgId ?? "unknown"}

Produce high-signal insights, anomalies, and recommendations grounded in frame evidence.
Respond with valid JSON matching the required schema exactly.`;

    const prompt = `Perform deep analysis over these classified frames:\n\n${JSON.stringify(parsed.data, null, 2)}`;

    const result = await runAgentQuery(AnalyzeFramesDeepSchema, {
      prompt,
      systemPrompt,
      maxThinkingTokens: 6000,
    });

    res.json({
      deepFrameAnalysis: result.data,
      stage: "analyze_frames_deep",
      queryMetadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as analyzeFramesDeepRouter };
