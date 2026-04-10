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
    overall_readiness_percent: 75,
    gate_criteria_status: [
      {
        criterion: "Unit test coverage",
        status: "passed",
        score: 90,
        evidence: "Coverage at 92%",
      },
    ],
    critical_blockers: [],
    health_assessment: {
      schedule_health: "on_track",
      quality_health: "good",
      team_health: "strong",
      budget_health: "on_track",
      summary: "Project is healthy",
    },
    recommendations: [],
    next_steps: [],
  },
  metadata: {
    totalTokensUsed: 300,
    inputTokens: 150,
    outputTokens: 150,
    processedAt: new Date().toISOString(),
  },
};

describe("POST /evaluate-gate", () => {
  it("returns 400 when prompt is missing", async () => {
    const req = authedRequest("POST", "/evaluate-gate", {});
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("MISSING_PROMPT");
  });

  it("returns 200 with gate evaluation", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/evaluate-gate", {
      prompt: "Evaluate sprint gate",
      gateDefinition: { name: "Sprint 3 Gate" },
      projectStatus: { completionPercent: 75 },
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.gate_evaluation).toEqual(mockAiResult.data);
    expect(body.metadata).toEqual(mockAiResult.metadata);
  });

  it("passes maxThinkingTokens to AI service", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/evaluate-gate", {
      prompt: "Evaluate gate",
    });
    await app.fetch(req, env);

    expect(mockRunAgentQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxThinkingTokens: 7000 }),
      expect.any(String),
    );
  });

  it("returns 500 when AI service throws", async () => {
    mockRunAgentQuery.mockRejectedValue(new Error("AI unavailable"));

    const req = authedRequest("POST", "/evaluate-gate", {
      prompt: "Evaluate",
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(500);

    const body = await readJson(res);
    expect(body.error).toBeTruthy();
  });
});
