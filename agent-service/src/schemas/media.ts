import { z } from "zod";

export const ExtractMediaRequestSchema = z.object({
  videoUrl: z.string().url(),
  keyframeIntervalSeconds: z.number().positive().optional(),
});

export const ExtractMediaResponseSchema = z.object({
  audioUrl: z.string(),
  frames: z.array(
    z.object({
      timestampMs: z.number(),
      frameUrl: z.string(),
    }),
  ),
  durationMs: z.number(),
  resolution: z.object({
    width: z.number(),
    height: z.number(),
  }),
});
