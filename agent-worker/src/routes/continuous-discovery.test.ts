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
    suggested_requirements: [
      {
        title: "Req 1",
        description: "A requirement",
        category: "functional",
        priority: "high",
        rationale: "Important",
      },
    ],
    identified_gaps: [],
    risk_indicators: [],
    key_insights: [],
  },
  metadata: {
    totalTokensUsed: 200,
    inputTokens: 100,
    outputTokens: 100,
    processedAt: new Date().toISOString(),
  },
};

describe("POST /continuous-discovery", () => {
  it("returns 400 when prompt is missing", async () => {
    const req = authedRequest("POST", "/continuous-discovery", {});
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("MISSING_PROMPT");
  });

  it("returns 200 with AI-generated findings", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/continuous-discovery", {
      prompt: "Analyze this migration",
      context: { platform: "Magento" },
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.findings).toEqual(mockAiResult.data);
    expect(body.metadata).toEqual(mockAiResult.metadata);
  });

  it("returns 500 when AI service throws", async () => {
    mockRunAgentQuery.mockRejectedValue(new Error("AI service unavailable"));

    const req = authedRequest("POST", "/continuous-discovery", {
      prompt: "Analyze this",
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(500);

    const body = await readJson(res);
    expect(body.error).toBeTruthy();
  });
});
