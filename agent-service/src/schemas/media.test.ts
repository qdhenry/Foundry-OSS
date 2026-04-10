import { describe, expect, it } from "vitest";
import { ExtractMediaRequestSchema, ExtractMediaResponseSchema } from "./media.js";

describe("ExtractMediaRequestSchema", () => {
  it("accepts valid request with all fields", () => {
    const result = ExtractMediaRequestSchema.safeParse({
      videoUrl: "https://example.com/video.mp4",
      keyframeIntervalSeconds: 5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts request without optional keyframeIntervalSeconds", () => {
    const result = ExtractMediaRequestSchema.safeParse({
      videoUrl: "https://example.com/video.mp4",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing videoUrl", () => {
    const result = ExtractMediaRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = ExtractMediaRequestSchema.safeParse({
      videoUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive keyframeIntervalSeconds", () => {
    const result = ExtractMediaRequestSchema.safeParse({
      videoUrl: "https://example.com/video.mp4",
      keyframeIntervalSeconds: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("ExtractMediaResponseSchema", () => {
  it("accepts valid response", () => {
    const result = ExtractMediaResponseSchema.safeParse({
      audioUrl: "https://example.com/audio.wav",
      frames: [
        { timestampMs: 0, frameUrl: "https://example.com/frame0.jpg" },
        { timestampMs: 5000, frameUrl: "https://example.com/frame1.jpg" },
      ],
      durationMs: 120000,
      resolution: { width: 1920, height: 1080 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing audioUrl", () => {
    const result = ExtractMediaResponseSchema.safeParse({
      frames: [],
      durationMs: 120000,
      resolution: { width: 1920, height: 1080 },
    });
    expect(result.success).toBe(false);
  });
});
