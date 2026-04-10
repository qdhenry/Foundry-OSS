import { describe, expect, it } from "vitest";
import {
  TranscribeRequestSchema,
  TranscribeResponseSchema,
  UtteranceSchema,
} from "./transcription.js";

describe("UtteranceSchema", () => {
  it("accepts valid utterance", () => {
    const result = UtteranceSchema.safeParse({
      speakerId: "speaker_0",
      startMs: 0,
      endMs: 5000,
      text: "Hello world",
      confidence: 0.95,
    });
    expect(result.success).toBe(true);
  });

  it("rejects confidence above 1", () => {
    const result = UtteranceSchema.safeParse({
      speakerId: "speaker_0",
      startMs: 0,
      endMs: 5000,
      text: "Hello",
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative startMs", () => {
    const result = UtteranceSchema.safeParse({
      speakerId: "speaker_0",
      startMs: -1,
      endMs: 5000,
      text: "Hello",
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("TranscribeRequestSchema", () => {
  it("accepts request with audioUrl", () => {
    const result = TranscribeRequestSchema.safeParse({
      audioUrl: "https://example.com/audio.wav",
    });
    expect(result.success).toBe(true);
  });

  it("accepts request with videoUrl", () => {
    const result = TranscribeRequestSchema.safeParse({
      videoUrl: "https://example.com/video.mp4",
    });
    expect(result.success).toBe(true);
  });

  it("accepts request with both URLs", () => {
    const result = TranscribeRequestSchema.safeParse({
      audioUrl: "https://example.com/audio.wav",
      videoUrl: "https://example.com/video.mp4",
    });
    expect(result.success).toBe(true);
  });

  it("rejects request with neither URL", () => {
    const result = TranscribeRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts optional language field", () => {
    const result = TranscribeRequestSchema.safeParse({
      audioUrl: "https://example.com/audio.wav",
      language: "en",
    });
    expect(result.success).toBe(true);
  });
});

describe("TranscribeResponseSchema", () => {
  it("accepts valid response", () => {
    const result = TranscribeResponseSchema.safeParse({
      transcription: {
        utterances: [
          {
            speakerId: "speaker_0",
            startMs: 0,
            endMs: 5000,
            text: "Hello",
            confidence: 0.95,
          },
        ],
        speakerCount: 1,
        language: "en",
        totalDurationMs: 5000,
        fullText: "Hello",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing transcription", () => {
    const result = TranscribeResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
