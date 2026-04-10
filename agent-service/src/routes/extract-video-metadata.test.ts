import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { ExtractVideoMetadataSchema } from "../schemas/video.js";
import { extractVideoMetadataRouter } from "./extract-video-metadata.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/extract-video-metadata", extractVideoMetadataRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("extract-video-metadata route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid request payload", async () => {
    const app = createTestApp();

    const response = await request(app).post("/extract-video-metadata").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_REQUEST");
    expect(response.body.error?.message).toBe("Invalid extract-video-metadata request body");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns stage metadata for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        media: {
          durationMs: 120_000,
          frameRateFps: 30,
          resolution: { width: 1920, height: 1080 },
          audioChannels: 2,
          detectedLanguages: ["en"],
        },
        contentSignals: {
          speakerCountEstimate: 3,
          pacing: "moderate" as const,
          qualityFlags: [],
        },
        processingHints: {
          recommendedSegmentSeconds: 45,
          recommendedFrameSampleRate: 1,
          notes: ["Looks stable"],
        },
      },
      metadata: {
        totalTokensUsed: 321,
        inputTokens: 200,
        outputTokens: 121,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/extract-video-metadata")
      .set("x-org-id", "org_test")
      .send({
        videoUrl: "https://example.com/call.mp4",
        fileName: "kickoff-call.mp4",
        expectedDurationMs: 120_000,
        context: { programId: "program_123" },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      metadata: mockResult.data,
      stage: "extract_video_metadata",
      pipelineStage: 1,
      queryMetadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [schemaArg, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(schemaArg).toBe(ExtractVideoMetadataSchema);
    expect(optionsArg.prompt).toContain("Extract metadata from this video input");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
  });

  it("uses unknown org fallback when x-org-id header is missing", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    mockedRunAgentQuery.mockResolvedValue({
      data: {
        media: {
          durationMs: 60_000,
          frameRateFps: 24,
          resolution: { width: 1280, height: 720 },
          audioChannels: 2,
          detectedLanguages: ["en"],
        },
        contentSignals: {
          speakerCountEstimate: 2,
          pacing: "moderate",
          qualityFlags: [],
        },
        processingHints: {
          recommendedSegmentSeconds: 30,
          recommendedFrameSampleRate: 1,
          notes: [],
        },
      },
      metadata: {
        totalTokensUsed: 1,
        inputTokens: 1,
        outputTokens: 0,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    });

    const response = await request(app).post("/extract-video-metadata").send({
      videoUrl: "https://example.com/call.mp4",
    });

    expect(response.status).toBe(200);
    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(optionsArg.systemPrompt).toContain("Organization: unknown");
  });
});
