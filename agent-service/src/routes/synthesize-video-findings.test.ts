import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { SynthesizeVideoFindingsSchema } from "../schemas/video.js";
import { synthesizeVideoFindingsRouter } from "./synthesize-video-findings.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/synthesize-video-findings", synthesizeVideoFindingsRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("synthesize-video-findings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid request payload", async () => {
    const app = createTestApp();

    const response = await request(app).post("/synthesize-video-findings").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_REQUEST");
    expect(response.body.error?.message).toBe("Invalid synthesize-video-findings request body");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns synthesized findings for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        synthesizedFindings: [
          {
            findingId: "syn_1",
            type: "requirement" as const,
            title: "Preserve complex pricing override behavior",
            description: "Target platform must support volume-tier overrides and exception logic.",
            priority: "must_have" as const,
            confidence: "high" as const,
            sourceTimestampsMs: [144_000, 246_000],
            sourceSpeakers: ["speaker_0", "speaker_2"],
            sourceExcerpts: [
              "This custom override is what causes all our pricing bugs.",
              "We cannot launch without parity for these rules.",
            ],
            sourceKeyframeUrls: ["https://example.com/frames/9.jpg"],
            dedupedFromSegments: [2, 5],
            suggestedWorkstream: "Pricing & Catalog",
            synthesisNote: "Merged duplicate requirement statements across segments.",
          },
        ],
        crossSegmentRisks: [
          {
            risk: "Stakeholder expectation mismatch on sync frequency",
            evidence: "CTO requests real-time while tech lead states 15-minute batch limit.",
            impact: "high" as const,
            recommendedAction:
              "Run alignment workshop and decide target SLA before sprint planning.",
          },
        ],
        visualDiscoverySections: [
          {
            title: "Current Pricing Configuration",
            timeRange: { startMs: 120_000, endMs: 180_000 },
            speaker: "Sarah Chen",
            keyframes: [
              {
                imageUrl: "https://example.com/frames/9.jpg",
                timestampMs: 144_000,
                category: "screen_share_admin",
                caption: "Pricing override editor in Magento admin",
                transcriptExcerpt: "This custom override is what causes all our pricing bugs.",
                systemIdentified: "Magento Admin Panel",
                extractedDataPoints: ["override_rules", "volume_discounts"],
                linkedFindingIds: ["syn_1"],
              },
            ],
          },
        ],
        rollup: {
          totalInputFindings: 6,
          totalSynthesizedFindings: 4,
          contradictionsDetected: 1,
          implicitRequirementsDetected: 1,
        },
      },
      metadata: {
        totalTokensUsed: 980,
        inputTokens: 700,
        outputTokens: 280,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/synthesize-video-findings")
      .set("x-org-id", "org_test")
      .send({
        segmentAnalyses: [
          {
            segment: {
              segmentId: "seg_3",
              segmentIndex: 2,
              startMs: 120_000,
              endMs: 180_000,
            },
            analysis: {
              segmentSummary: "Pricing setup and custom overrides discussed",
              topicsDiscussed: ["pricing"],
              findings: [
                {
                  type: "requirement",
                  title: "Pricing parity required",
                  description: "Need support for exception-based pricing overrides.",
                  priority: "must_have",
                  timestampMs: 144_000,
                  speakerId: "speaker_0",
                  confidence: "high",
                  sourceExcerpt: "This custom override is what causes all our pricing bugs.",
                },
              ],
              visualDiscoveries: [
                {
                  keyframeIndex: 9,
                  systemIdentified: "Magento Admin Panel",
                  whatItShows: "Override rules",
                  migrationRelevance: "Critical parity area",
                  extractedDataPoints: ["override_rules"],
                },
              ],
            },
          },
        ],
        programContext: {
          targetPlatform: "Shopify Plus",
          workstreams: ["Pricing & Catalog"],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      synthesizedVideoFindings: mockResult.data,
      stage: "synthesize_video_findings",
      pipelineStage: 5,
      queryMetadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [schemaArg, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(schemaArg).toBe(SynthesizeVideoFindingsSchema);
    expect(optionsArg.prompt).toContain("Synthesize findings from these analyzed video segments");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
    expect(optionsArg.maxThinkingTokens).toBe(8000);
  });
});
