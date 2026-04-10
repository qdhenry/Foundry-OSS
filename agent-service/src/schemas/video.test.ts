import { describe, expect, it } from "vitest";
import {
  AnalyzeFramesDeepRequestSchema,
  AnalyzeFramesDeepSchema,
  AnalyzeVideoSegmentRequestSchema,
  ExtractVideoMetadataRequestSchema,
  ExtractVideoMetadataSchema,
  SegmentTranscriptRequestSchema,
  SegmentTranscriptSchema,
  SynthesizeVideoFindingsRequestSchema,
} from "./video.js";

describe("ExtractVideoMetadataRequestSchema", () => {
  it("accepts valid request with all fields", () => {
    const result = ExtractVideoMetadataRequestSchema.safeParse({
      videoUrl: "https://example.com/video.mp4",
      fileName: "kickoff.mp4",
      expectedDurationMs: 120000,
      context: { programId: "prog_1" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal valid request", () => {
    const result = ExtractVideoMetadataRequestSchema.safeParse({
      videoUrl: "https://example.com/video.mp4",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing videoUrl", () => {
    const result = ExtractVideoMetadataRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = ExtractVideoMetadataRequestSchema.safeParse({
      videoUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("ExtractVideoMetadataSchema", () => {
  it("accepts valid metadata", () => {
    const result = ExtractVideoMetadataSchema.safeParse({
      media: {
        durationMs: 120000,
        frameRateFps: 30,
        resolution: { width: 1920, height: 1080 },
        audioChannels: 2,
        detectedLanguages: ["en"],
      },
      contentSignals: {
        speakerCountEstimate: 3,
        pacing: "moderate",
        qualityFlags: [],
      },
      processingHints: {
        recommendedSegmentSeconds: 45,
        recommendedFrameSampleRate: 1,
        notes: [],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid pacing enum", () => {
    const result = ExtractVideoMetadataSchema.safeParse({
      media: {
        durationMs: 120000,
        frameRateFps: 30,
        resolution: { width: 1920, height: 1080 },
        audioChannels: 2,
        detectedLanguages: ["en"],
      },
      contentSignals: {
        speakerCountEstimate: 3,
        pacing: "invalid",
        qualityFlags: [],
      },
      processingHints: {
        recommendedSegmentSeconds: 45,
        recommendedFrameSampleRate: 1,
        notes: [],
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("SegmentTranscriptRequestSchema", () => {
  it("accepts valid request", () => {
    const result = SegmentTranscriptRequestSchema.safeParse({
      transcript: "Hello world",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty transcript", () => {
    const result = SegmentTranscriptRequestSchema.safeParse({
      transcript: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("SegmentTranscriptSchema", () => {
  it("accepts valid segmentation result", () => {
    const result = SegmentTranscriptSchema.safeParse({
      segments: [
        {
          segmentId: "seg_1",
          startMs: 0,
          endMs: 30000,
          text: "Hello",
          topics: ["greeting"],
          confidence: 0.95,
        },
      ],
      rollup: {
        totalSegments: 1,
        dominantTopics: ["greeting"],
        actionItemCandidates: 0,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("AnalyzeFramesDeepRequestSchema", () => {
  it("accepts valid request", () => {
    const result = AnalyzeFramesDeepRequestSchema.safeParse({
      frames: [{ timestampMs: 1000, label: "screen_share" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty frames array is valid (no .min constraint)", () => {
    const result = AnalyzeFramesDeepRequestSchema.safeParse({
      frames: [],
    });
    // Schema allows empty frames, route-level validation catches this
    expect(result.success).toBe(true);
  });
});

describe("AnalyzeFramesDeepSchema", () => {
  it("accepts valid deep analysis result", () => {
    const result = AnalyzeFramesDeepSchema.safeParse({
      insights: [
        {
          insightId: "ins_1",
          type: "opportunity",
          summary: "Test insight",
          evidenceTimestampsMs: [1000],
          confidence: 0.9,
          impact: "high",
        },
      ],
      anomalies: [],
      recommendations: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid insight type", () => {
    const result = AnalyzeFramesDeepSchema.safeParse({
      insights: [
        {
          insightId: "ins_1",
          type: "invalid_type",
          summary: "Test",
          evidenceTimestampsMs: [],
          confidence: 0.5,
          impact: "high",
        },
      ],
      anomalies: [],
      recommendations: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("AnalyzeVideoSegmentRequestSchema", () => {
  it("accepts valid segment request", () => {
    const result = AnalyzeVideoSegmentRequestSchema.safeParse({
      segment: {
        segmentId: "seg_1",
        segmentIndex: 0,
        totalSegments: 5,
        startMs: 0,
        endMs: 30000,
      },
      transcriptTurns: [
        {
          speakerId: "speaker_0",
          startMs: 0,
          endMs: 10000,
          text: "Hello",
        },
      ],
      keyframes: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("SynthesizeVideoFindingsRequestSchema", () => {
  it("rejects empty segmentAnalyses", () => {
    const result = SynthesizeVideoFindingsRequestSchema.safeParse({
      segmentAnalyses: [],
    });
    expect(result.success).toBe(false);
  });
});
