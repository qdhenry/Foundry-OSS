import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { AnalyzeFramesDeepSchema } from "../schemas/video.js";
import { analyzeFramesDeepRouter } from "./analyze-frames-deep.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/analyze-frames-deep", analyzeFramesDeepRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("analyze-frames-deep route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when frames array is empty", async () => {
    const app = createTestApp();

    const response = await request(app).post("/analyze-frames-deep").send({ frames: [] });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_FRAMES");
    expect(response.body.error?.message).toBe("frames must not be empty");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns deep frame analysis for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        insights: [
          {
            insightId: "ins_1",
            type: "opportunity" as const,
            summary: "Stakeholders repeatedly align on phased rollout.",
            evidenceTimestampsMs: [12_000, 25_000],
            confidence: 0.88,
            impact: "high" as const,
          },
        ],
        anomalies: [
          {
            timestampMs: 42_000,
            description: "Unexpected dashboard error visible during demo.",
            severity: "medium" as const,
            followUp: "Verify API timeout handling in staging.",
          },
        ],
        recommendations: [
          {
            recommendation: "Add a pre-demo smoke test checklist.",
            priority: "high" as const,
            rationale: "Would prevent recurring runtime demo issues.",
          },
        ],
      },
      metadata: {
        totalTokensUsed: 430,
        inputTokens: 260,
        outputTokens: 170,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/analyze-frames-deep")
      .set("x-org-id", "org_test")
      .send({
        frames: [
          {
            timestampMs: 12_000,
            label: "screen_share",
            confidence: 0.93,
            tags: ["timeline"],
            description: "Roadmap slide visible",
          },
        ],
        focusAreas: ["execution_risk", "alignment"],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      deepFrameAnalysis: mockResult.data,
      stage: "analyze_frames_deep",
      queryMetadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [schemaArg, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(schemaArg).toBe(AnalyzeFramesDeepSchema);
    expect(optionsArg.prompt).toContain("Perform deep analysis over these classified frames");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
    expect(optionsArg.maxThinkingTokens).toBe(6000);
  });

  it("returns 500 when the ai service throws", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);
    mockedRunAgentQuery.mockRejectedValue(new Error("deep analysis failed"));

    const response = await request(app)
      .post("/analyze-frames-deep")
      .send({
        frames: [
          {
            timestampMs: 12_000,
            label: "screen_share",
            confidence: 0.93,
            tags: ["timeline"],
            description: "Roadmap slide visible",
          },
        ],
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "deep analysis failed" });
  });
});
