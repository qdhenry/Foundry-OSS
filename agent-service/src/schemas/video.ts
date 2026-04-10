import { z } from "zod";

const JsonContextSchema = z.record(z.string(), z.unknown());

export const ExtractVideoMetadataRequestSchema = z.object({
  videoUrl: z.url(),
  fileName: z.string().optional(),
  expectedDurationMs: z.number().int().positive().optional(),
  context: JsonContextSchema.optional(),
});

export const ExtractVideoMetadataSchema = z.object({
  media: z.object({
    durationMs: z.number().int().nonnegative(),
    frameRateFps: z.number().positive(),
    resolution: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    audioChannels: z.number().int().positive(),
    detectedLanguages: z.array(z.string()),
  }),
  contentSignals: z.object({
    speakerCountEstimate: z.number().int().nonnegative(),
    pacing: z.enum(["slow", "moderate", "fast"]),
    qualityFlags: z.array(z.string()),
  }),
  processingHints: z.object({
    recommendedSegmentSeconds: z.number().positive(),
    recommendedFrameSampleRate: z.number().positive(),
    notes: z.array(z.string()),
  }),
});

export const SegmentTranscriptRequestSchema = z.object({
  transcript: z.string().min(1),
  segmentGoal: z
    .enum(["speaker_turn", "topic_shift", "fixed_window"])
    .default("speaker_turn")
    .optional(),
  targetSegmentSeconds: z.number().positive().optional(),
  context: JsonContextSchema.optional(),
});

export const SegmentTranscriptSchema = z.object({
  segments: z.array(
    z.object({
      segmentId: z.string(),
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().nonnegative(),
      speakerLabel: z.string().optional(),
      text: z.string(),
      topics: z.array(z.string()),
      confidence: z.number().min(0).max(1),
    }),
  ),
  rollup: z.object({
    totalSegments: z.number().int().nonnegative(),
    dominantTopics: z.array(z.string()),
    actionItemCandidates: z.number().int().nonnegative(),
  }),
});

export const ClassifyFramesRequestSchema = z.object({
  frames: z.array(
    z.object({
      frameId: z.string().optional(),
      timestampMs: z.number().int().nonnegative(),
      description: z.string().optional(),
      ocrText: z.string().optional(),
    }),
  ),
  taxonomy: z.array(z.string()).optional(),
  context: JsonContextSchema.optional(),
});

export const ClassifyFramesSchema = z.object({
  classifications: z.array(
    z.object({
      frameId: z.string().optional(),
      timestampMs: z.number().int().nonnegative(),
      label: z.string(),
      confidence: z.number().min(0).max(1),
      tags: z.array(z.string()),
    }),
  ),
  rollup: z.object({
    dominantLabels: z.array(
      z.object({
        label: z.string(),
        count: z.number().int().nonnegative(),
      }),
    ),
    safetyFlags: z.array(z.string()),
  }),
});

export const AnalyzeFramesDeepRequestSchema = z.object({
  frames: z.array(
    z.object({
      timestampMs: z.number().int().nonnegative(),
      label: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      tags: z.array(z.string()).optional(),
      description: z.string().optional(),
    }),
  ),
  focusAreas: z.array(z.string()).optional(),
  context: JsonContextSchema.optional(),
});

export const AnalyzeFramesDeepSchema = z.object({
  insights: z.array(
    z.object({
      insightId: z.string(),
      type: z.enum(["behavior", "risk", "opportunity", "quality"]),
      summary: z.string(),
      evidenceTimestampsMs: z.array(z.number().int().nonnegative()),
      confidence: z.number().min(0).max(1),
      impact: z.enum(["high", "medium", "low"]),
    }),
  ),
  anomalies: z.array(
    z.object({
      timestampMs: z.number().int().nonnegative(),
      description: z.string(),
      severity: z.enum(["critical", "high", "medium", "low"]),
      followUp: z.string(),
    }),
  ),
  recommendations: z.array(
    z.object({
      recommendation: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      rationale: z.string(),
    }),
  ),
});

export const AnalyzeVideoSegmentRequestSchema = z.object({
  segment: z.object({
    segmentId: z.string(),
    segmentIndex: z.number().int().nonnegative(),
    totalSegments: z.number().int().positive(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
  }),
  transcriptTurns: z.array(
    z.object({
      speakerId: z.string(),
      speakerName: z.string().optional(),
      speakerRole: z.string().optional(),
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().nonnegative(),
      text: z.string().min(1),
    }),
  ),
  keyframes: z.array(
    z.object({
      keyframeIndex: z.number().int().nonnegative(),
      timestampMs: z.number().int().nonnegative(),
      imageUrl: z.url().optional(),
      classification: z.string().optional(),
      caption: z.string().optional(),
      ocrText: z.string().optional(),
    }),
  ),
  programContext: JsonContextSchema.optional(),
  context: JsonContextSchema.optional(),
});

export const AnalyzeVideoSegmentSchema = z.object({
  segmentSummary: z.string(),
  topicsDiscussed: z.array(z.string()),
  findings: z.array(
    z.object({
      type: z.enum(["requirement", "risk", "integration", "decision", "action_item"]),
      title: z.string(),
      description: z.string(),
      priority: z.enum(["must_have", "should_have", "nice_to_have", "deferred"]).optional(),
      timestampMs: z.number().int().nonnegative(),
      speakerId: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
      visualContext: z.string().optional(),
      sourceExcerpt: z.string(),
      suggestedWorkstream: z.string().optional(),
      relatedFindings: z.array(z.string()).optional(),
    }),
  ),
  visualDiscoveries: z.array(
    z.object({
      keyframeIndex: z.number().int().nonnegative(),
      systemIdentified: z.string(),
      whatItShows: z.string(),
      migrationRelevance: z.string(),
      extractedDataPoints: z.array(z.string()),
    }),
  ),
});

const VideoSynthesisFindingSchema = z.object({
  findingId: z.string(),
  type: z.enum(["requirement", "risk", "integration", "decision", "action_item"]),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["must_have", "should_have", "nice_to_have", "deferred"]).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  sourceTimestampsMs: z.array(z.number().int().nonnegative()),
  sourceSpeakers: z.array(z.string()),
  sourceExcerpts: z.array(z.string()),
  sourceKeyframeUrls: z.array(z.url()).optional(),
  dedupedFromSegments: z.array(z.number().int().nonnegative()),
  suggestedWorkstream: z.string().optional(),
  synthesisNote: z.string().optional(),
});

export const SynthesizeVideoFindingsRequestSchema = z.object({
  segmentAnalyses: z
    .array(
      z.object({
        segment: z.object({
          segmentId: z.string(),
          segmentIndex: z.number().int().nonnegative(),
          startMs: z.number().int().nonnegative(),
          endMs: z.number().int().nonnegative(),
        }),
        analysis: AnalyzeVideoSegmentSchema,
      }),
    )
    .min(1),
  existingFindings: z.array(VideoSynthesisFindingSchema).optional(),
  programContext: JsonContextSchema.optional(),
  context: JsonContextSchema.optional(),
});

export const SynthesizeVideoFindingsSchema = z.object({
  synthesizedFindings: z.array(VideoSynthesisFindingSchema),
  crossSegmentRisks: z.array(
    z.object({
      risk: z.string(),
      evidence: z.string(),
      impact: z.enum(["high", "medium", "low"]),
      recommendedAction: z.string(),
    }),
  ),
  visualDiscoverySections: z.array(
    z.object({
      title: z.string(),
      timeRange: z.object({
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().nonnegative(),
      }),
      speaker: z.string(),
      keyframes: z.array(
        z.object({
          imageUrl: z.url(),
          timestampMs: z.number().int().nonnegative(),
          category: z.string(),
          caption: z.string(),
          transcriptExcerpt: z.string(),
          systemIdentified: z.string(),
          extractedDataPoints: z.array(z.string()),
          linkedFindingIds: z.array(z.string()),
        }),
      ),
    }),
  ),
  rollup: z.object({
    totalInputFindings: z.number().int().nonnegative(),
    totalSynthesizedFindings: z.number().int().nonnegative(),
    contradictionsDetected: z.number().int().nonnegative(),
    implicitRequirementsDetected: z.number().int().nonnegative(),
  }),
});
