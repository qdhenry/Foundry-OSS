import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { planSprintRouter } from "./plan-sprint.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/plan-sprint", planSprintRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("plan-sprint route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when prompt is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/plan-sprint").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_PROMPT");
    expect(response.body.error?.message).toBe("prompt is required");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns sprint plan for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        capacity_analysis: {
          total_capacity_points: 40,
          available_team_members: 4,
          risk_buffer_percent: 20,
          effective_capacity: 32,
        },
        recommended_tasks: [
          {
            task_id: "task_1",
            title: "Implement pricing override API",
            story_points: 5,
            priority: "critical" as const,
            assigned_to: "Backend Developer",
            rationale: "Blocking requirement for sprint gate",
          },
        ],
        deferred_to_next_sprint: [
          {
            task_id: "task_5",
            title: "Dashboard polish",
            reason: "Low priority, capacity exceeded",
          },
        ],
        total_planned_points: 28,
        capacity_utilization_percent: 87.5,
        sprint_health_indicators: {
          dependency_risk: "medium" as const,
          skill_coverage: "good" as const,
          scope_stability: "stable" as const,
          overall_confidence: "high" as const,
        },
      },
      metadata: {
        totalTokensUsed: 450,
        inputTokens: 280,
        outputTokens: 170,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/plan-sprint")
      .set("x-org-id", "org_test")
      .send({
        prompt: "Plan sprint 4 with available tasks",
        tasks: [{ id: "task_1", title: "Pricing API", points: 5 }],
        team: { members: 4, velocity: 32 },
        sprintConfig: { durationWeeks: 2 },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sprint_plan: mockResult.data,
      metadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(optionsArg.prompt).toBe("Plan sprint 4 with available tasks");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
  });

  it("returns 500 when the ai service throws", async () => {
    const app = createTestApp();
    vi.mocked(runAgentQuery).mockRejectedValue(new Error("sprint planning failed"));

    const response = await request(app).post("/plan-sprint").send({ prompt: "Plan sprint" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "sprint planning failed" });
  });
});
