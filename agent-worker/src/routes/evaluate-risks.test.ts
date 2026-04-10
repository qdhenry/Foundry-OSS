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
    change_impact_summary: {
      overall_risk_level: "medium",
      confidence: "high",
      summary: "Moderate risk level",
    },
    new_risks: [],
    escalations: [],
    cascade_impacts: [],
    recommendations: [],
  },
  metadata: {
    totalTokensUsed: 300,
    inputTokens: 150,
    outputTokens: 150,
    processedAt: new Date().toISOString(),
  },
};

describe("POST /evaluate-risks", () => {
  it("returns 400 when prompt is missing", async () => {
    const req = authedRequest("POST", "/evaluate-risks", {});
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("MISSING_PROMPT");
  });

  it("returns 200 with risk assessment", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/evaluate-risks", {
      prompt: "Evaluate risks for sprint 3",
      changes: [{ type: "scope_change", detail: "Added 5 requirements" }],
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.risk_assessment).toEqual(mockAiResult.data);
    expect(body.metadata).toEqual(mockAiResult.metadata);
  });

  it("passes maxThinkingTokens to AI service", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/evaluate-risks", {
      prompt: "Evaluate risks",
    });
    await app.fetch(req, env);

    expect(mockRunAgentQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxThinkingTokens: 6000 }),
      expect.any(String),
    );
  });

  it("returns 500 when AI service throws", async () => {
    mockRunAgentQuery.mockRejectedValue(new Error("AI unavailable"));

    const req = authedRequest("POST", "/evaluate-risks", {
      prompt: "Evaluate",
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(500);

    const body = await readJson(res);
    expect(body.error).toBeTruthy();
  });
});
