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
    decomposition_rationale: "Split by concern",
    critical_considerations: ["Database migration"],
    tasks: [
      {
        title: "Setup schema",
        description: "Create DB schema",
        acceptance_criteria: ["Schema created"],
        story_points: 3,
        dependencies: [],
        required_skills: ["SQL"],
        risk_factors: ["Data loss"],
      },
    ],
    estimated_total_points: 3,
    estimated_sprint_count: 1,
  },
  metadata: {
    totalTokensUsed: 300,
    inputTokens: 150,
    outputTokens: 150,
    processedAt: new Date().toISOString(),
  },
};

describe("POST /decompose-task", () => {
  it("returns 400 when prompt is missing", async () => {
    const req = authedRequest("POST", "/decompose-task", {});
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("MISSING_PROMPT");
  });

  it("returns 200 with decomposition data", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/decompose-task", {
      prompt: "Decompose user auth requirement",
      requirement: { title: "User Auth" },
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.decomposition).toEqual(mockAiResult.data);
    expect(body.metadata).toEqual(mockAiResult.metadata);
  });

  it("passes maxThinkingTokens to AI service", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/decompose-task", {
      prompt: "Decompose this",
    });
    await app.fetch(req, env);

    expect(mockRunAgentQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxThinkingTokens: 8000 }),
      expect.any(String),
    );
  });

  it("returns 500 when AI service throws", async () => {
    mockRunAgentQuery.mockRejectedValue(new Error("AI unavailable"));

    const req = authedRequest("POST", "/decompose-task", {
      prompt: "Decompose this",
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(500);

    const body = await readJson(res);
    expect(body.error).toBeTruthy();
  });
});
