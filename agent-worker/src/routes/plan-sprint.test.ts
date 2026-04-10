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
    capacity_analysis: {
      total_capacity_points: 40,
      available_team_members: 5,
      risk_buffer_percent: 20,
      effective_capacity: 32,
    },
    recommended_tasks: [
      {
        task_id: "task-1",
        title: "Setup CI/CD",
        story_points: 5,
        priority: "high",
        rationale: "Foundation for delivery",
      },
    ],
    total_planned_points: 5,
  },
  metadata: {
    totalTokensUsed: 200,
    inputTokens: 100,
    outputTokens: 100,
    processedAt: new Date().toISOString(),
  },
};

describe("POST /plan-sprint", () => {
  it("returns 400 when prompt is missing", async () => {
    const req = authedRequest("POST", "/plan-sprint", {});
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("MISSING_PROMPT");
  });

  it("returns 200 with sprint plan", async () => {
    mockRunAgentQuery.mockResolvedValue(mockAiResult);

    const req = authedRequest("POST", "/plan-sprint", {
      prompt: "Plan sprint 4",
      tasks: [{ id: "task-1", title: "Setup CI/CD", points: 5 }],
      team: { members: 5 },
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.sprint_plan).toEqual(mockAiResult.data);
    expect(body.metadata).toEqual(mockAiResult.metadata);
  });

  it("returns 500 when AI service throws", async () => {
    mockRunAgentQuery.mockRejectedValue(new Error("AI unavailable"));

    const req = authedRequest("POST", "/plan-sprint", {
      prompt: "Plan sprint",
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(500);

    const body = await readJson(res);
    expect(body.error).toBeTruthy();
  });
});
