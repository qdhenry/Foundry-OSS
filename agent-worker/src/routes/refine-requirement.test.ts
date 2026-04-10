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
    overall_assessment: {
      clarity_score: 7,
      completeness_score: 8,
      testability_score: 6,
      summary: "Good requirement",
    },
    suggestions: [
      {
        area: "description",
        current_text: "old text",
        suggested_text: "new text",
        reason: "Clarity",
        priority: "medium",
      },
    ],
  },
  metadata: {
    totalTokensUsed: 200,
    inputTokens: 100,
    outputTokens: 100,
    processedAt: new Date().toISOString(),
  },
};

describe("POST /refine-requirement", () => {
  it("returns 400 when prompt is missing", async () => {
    const req = authedRequest("POST", "/refine-requirement", {});
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("MISSING_PROMPT");
  });

  it("returns 200 with refinement data", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/refine-requirement", {
      prompt: "Refine this requirement",
      requirement: { title: "User login", description: "Users should be able to login" },
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.refinement).toEqual(mockAiResult.data);
    expect(body.metadata).toEqual(mockAiResult.metadata);
  });

  it("returns 500 when AI service throws", async () => {
    mockRunAgentQuery.mockRejectedValue(new Error("AI unavailable"));

    const req = authedRequest("POST", "/refine-requirement", {
      prompt: "Refine this",
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(500);

    const body = await readJson(res);
    expect(body.error).toBeTruthy();
  });
});
