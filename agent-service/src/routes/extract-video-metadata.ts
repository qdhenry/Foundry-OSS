import { Router } from "express";
import { runAgentQuery } from "../lib/ai-service.js";
import { ExtractVideoMetadataRequestSchema, ExtractVideoMetadataSchema } from "../schemas/video.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const parsed = ExtractVideoMetadataRequestSchema.safeParse(req.body);
    const orgId = req.headers["x-org-id"] as string;

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid extract-video-metadata request body",
          details: parsed.error.issues,
        },
      });
      return;
    }

    const systemPrompt = `You are a video intake analyst for a multi-stage call analysis pipeline.
Organization: ${orgId ?? "unknown"}

Stage 1 goal: extract lightweight but structured metadata that downstream stages can trust.
Respond with valid JSON matching the required schema exactly.`;

    const prompt = `Extract metadata from this video input:\n\n${JSON.stringify(parsed.data, null, 2)}`;

    const result = await runAgentQuery(ExtractVideoMetadataSchema, {
      prompt,
      systemPrompt,
    });

    res.json({
      metadata: result.data,
      stage: "extract_video_metadata",
      pipelineStage: 1,
      queryMetadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as extractVideoMetadataRouter };
