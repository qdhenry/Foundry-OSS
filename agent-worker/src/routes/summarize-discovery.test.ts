import { describe, expect, it, vi } from "vitest";
import { app } from "../router";
import { authedRequest, makeEnv, readJson } from "../test-helpers";

vi.mock("../lib/ai-service", () => ({
  runAgentQuery: vi.fn(),
}));

import { runAgentQuery } from "../lib/ai-service";

const mockRunAgentQuery = vi.mocked(runAgentQuery);

const env = makeEnv();

const mockAiResult = {
  data: {
    overview: "Project is on track",
    statusBreakdown: "80% complete",
    priorityDistribution: "Most are high priority",
    fitGapAnalysis: "3 gaps identified",
    keyInsights: ["Insight 1"],
    recommendations: ["Rec 1"],
    riskFlags: ["Risk 1"],
  },
  metadata: {
    totalTokensUsed: 200,
    inputTokens: 100,
    outputTokens: 100,
    processedAt: new Date().toISOString(),
  },
};

describe("POST /summarize-discovery", () => {
  it("returns 400 when requirements is missing", async () => {
    const req = authedRequest("POST", "/summarize-discovery", {});
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("MISSING_REQUIREMENTS");
  });

  it("returns 400 when requirements is empty array", async () => {
    const req = authedRequest("POST", "/summarize-discovery", {
      requirements: [],
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("MISSING_REQUIREMENTS");
  });

  it("returns 400 when requirements have invalid format", async () => {
    const req = authedRequest("POST", "/summarize-discovery", {
      requirements: [{ invalid: true }],
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("INVALID_REQUIREMENTS");
  });

  it("returns 200 with summary data", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/summarize-discovery", {
      requirements: [
        {
          title: "User Auth",
          status: "in_progress",
          priority: "high",
          fitGap: "gap",
        },
      ],
      programName: "AcmeCorp",
      targetPlatform: "Salesforce",
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.summary).toEqual(mockAiResult.data);
    expect(body.metadata).toEqual(mockAiResult.metadata);
  });

  it("returns 500 when AI service throws", async () => {
    mockRunAgentQuery.mockRejectedValue(new Error("AI unavailable"));

    const req = authedRequest("POST", "/summarize-discovery", {
      requirements: [{ title: "Req", status: "draft", priority: "low", fitGap: "fit" }],
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(500);

    const body = await readJson(res);
    expect(body.error).toBeTruthy();
  });
});
