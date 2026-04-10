import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { AnalyzeVideoSegmentSchema } from "../schemas/video.js";
import { analyzeVideoSegmentRouter } from "./analyze-video-segment.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/analyze-video-segment", analyzeVideoSegmentRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("analyze-video-segment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid request payload", async () => {
    const app = createTestApp();

    const response = await request(app).post("/analyze-video-segment").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_REQUEST");
    expect(response.body.error?.message).toBe("Invalid analyze-video-segment request body");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when transcriptTurns is empty", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/analyze-video-segment")
      .send({
        segment: {
          segmentId: "seg_3",
          segmentIndex: 2,
          totalSegments: 7,
          startMs: 120_000,
          endMs: 180_000,
        },
        transcriptTurns: [],
        keyframes: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_TRANSCRIPT_TURNS");
    expect(response.body.error?.message).toBe("transcriptTurns must not be empty");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns segment analysis for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        segmentSummary: "Discussed pricing override complexity in the source platform.",
        topicsDiscussed: ["pricing", "customizations"],
        findings: [
          {
            type: "risk" as const,
            title: "Custom pricing override may break migration parity",
            description: "Legacy contractor logic appears undocumented and brittle.",
            priority: "must_have" as const,
            timestampMs: 144_000,
            speakerId: "speaker_0",
            confidence: "high" as const,
            visualContext: "Admin pricing grid and override editor shown",
            sourceExcerpt: "...this custom override is what causes our pricing bugs.",
            suggestedWorkstream: "Pricing & Catalog",
            relatedFindings: ["finding_12"],
          },
        ],
        visualDiscoveries: [
          {
            keyframeIndex: 9,
            systemIdentified: "Magento Admin Panel",
            whatItShows: "Tier-based pricing configuration with custom overrides",
            migrationRelevance: "Needs parity mapping on target platform",
            extractedDataPoints: ["volume_discounts", "override_rules"],
          },
        ],
      },
      metadata: {
        totalTokensUsed: 640,
        inputTokens: 420,
        outputTokens: 220,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/analyze-video-segment")
      .set("x-org-id", "org_test")
      .send({
        segment: {
          segmentId: "seg_3",
          segmentIndex: 2,
          totalSegments: 7,
          startMs: 120_000,
          endMs: 180_000,
        },
        transcriptTurns: [
          {
            speakerId: "speaker_0",
            speakerName: "Sarah Chen",
            speakerRole: "Client CTO",
            startMs: 143_000,
            endMs: 149_000,
            text: "This custom override is what causes all our pricing bugs.",
          },
        ],
        keyframes: [
          {
            keyframeIndex: 9,
            timestampMs: 144_000,
            imageUrl: "https://example.com/frames/9.jpg",
            classification: "screen_share_admin",
            caption: "Pricing override editor",
          },
        ],
        programContext: { targetPlatform: "Shopify Plus" },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      segmentAnalysis: mockResult.data,
      stage: "analyze_video_segment",
      pipelineStage: 4,
      queryMetadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [schemaArg, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(schemaArg).toBe(AnalyzeVideoSegmentSchema);
    expect(optionsArg.prompt).toContain("Analyze this video segment");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
    expect(optionsArg.maxThinkingTokens).toBe(6000);
  });
});
