import { Router } from "express";
import { runAgentQuery } from "../lib/ai-service.js";
import { SegmentTranscriptRequestSchema, SegmentTranscriptSchema } from "../schemas/video.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const parsed = SegmentTranscriptRequestSchema.safeParse(req.body);
    const orgId = req.headers["x-org-id"] as string;

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid segment-transcript request body",
          details: parsed.error.issues,
        },
      });
      return;
    }

    const systemPrompt = `You are a transcript segmentation specialist for call intelligence.
Organization: ${orgId ?? "unknown"}

Stage 2 goal: split transcript text into reliable and reviewable segments for downstream analysis.
Respond with valid JSON matching the required schema exactly.`;

    const prompt = `Segment this transcript for video analysis:\n\n${JSON.stringify(parsed.data, null, 2)}`;

    const result = await runAgentQuery(SegmentTranscriptSchema, {
      prompt,
      systemPrompt,
    });

    res.json({
      transcriptSegmentation: result.data,
      stage: "segment_transcript",
      pipelineStage: 2,
      queryMetadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as segmentTranscriptRouter };
