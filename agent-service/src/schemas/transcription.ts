import { z } from "zod";

export const UtteranceSchema = z.object({
  speakerId: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
});

export const TranscribeRequestSchema = z
  .object({
    audioUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    language: z.string().optional(),
  })
  .refine((data) => data.audioUrl || data.videoUrl, {
    message: "At least one of audioUrl or videoUrl must be provided",
  });

export const TranscribeResponseSchema = z.object({
  transcription: z.object({
    utterances: z.array(UtteranceSchema),
    speakerCount: z.number().int().nonnegative(),
    language: z.string(),
    totalDurationMs: z.number().int().nonnegative(),
    fullText: z.string(),
  }),
});

export type TranscribeRequest = z.infer<typeof TranscribeRequestSchema>;
export type TranscribeResponse = z.infer<typeof TranscribeResponseSchema>;
export type Utterance = z.infer<typeof UtteranceSchema>;
