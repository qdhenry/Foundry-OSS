import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { SegmentTranscriptSchema } from "../schemas/video.js";
import { segmentTranscriptRouter } from "./segment-transcript.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/segment-transcript", segmentTranscriptRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("segment-transcript route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid request payload", async () => {
    const app = createTestApp();

    const response = await request(app).post("/segment-transcript").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_REQUEST");
    expect(response.body.error?.message).toBe("Invalid segment-transcript request body");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns transcript segmentation for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        segments: [
          {
            segmentId: "seg_1",
            startMs: 0,
            endMs: 30_000,
            speakerLabel: "Speaker A",
            text: "Welcome to the kickoff call.",
            topics: ["introduction"],
            confidence: 0.94,
          },
        ],
        rollup: {
          totalSegments: 1,
          dominantTopics: ["introduction"],
          actionItemCandidates: 0,
        },
      },
      metadata: {
        totalTokensUsed: 210,
        inputTokens: 140,
        outputTokens: 70,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/segment-transcript")
      .set("x-org-id", "org_test")
      .send({
        transcript: "Welcome to the kickoff call.",
        context: { meetingId: "meeting_123" },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      transcriptSegmentation: mockResult.data,
      stage: "segment_transcript",
      pipelineStage: 2,
      queryMetadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [schemaArg, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(schemaArg).toBe(SegmentTranscriptSchema);
    expect(optionsArg.prompt).toContain("Segment this transcript for video analysis");
    expect(optionsArg.prompt).toContain('"segmentGoal": "speaker_turn"');
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
  });

  it("returns 500 when the ai service throws", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);
    mockedRunAgentQuery.mockRejectedValue(new Error("agent unavailable"));

    const response = await request(app).post("/segment-transcript").send({
      transcript: "hello world",
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "agent unavailable" });
  });
});
