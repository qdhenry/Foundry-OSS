import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { evaluateGateRouter } from "./evaluate-gate.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/evaluate-gate", evaluateGateRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("evaluate-gate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when prompt is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/evaluate-gate").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_PROMPT");
    expect(response.body.error?.message).toBe("prompt is required");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns gate evaluation for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        overall_readiness_percent: 72,
        gate_criteria_status: [
          {
            criterion: "All critical requirements implemented",
            status: "partial" as const,
            score: 65,
            evidence: "8 of 12 critical requirements done",
          },
        ],
        critical_blockers: [
          {
            blocker: "Pricing override not migrated",
            severity: "critical" as const,
            resolution_path: "Complete pricing migration task",
            estimated_effort: "3 days",
          },
        ],
        health_assessment: {
          schedule_health: "at_risk" as const,
          quality_health: "acceptable" as const,
          team_health: "adequate" as const,
          budget_health: "on_track" as const,
          summary: "Project is at risk due to pending pricing migration.",
        },
        recommendations: [
          {
            recommendation: "Prioritize pricing migration",
            priority: "critical" as const,
            category: "technical" as const,
          },
        ],
        next_steps: [
          {
            action: "Complete pricing override migration",
            owner: "Backend team",
            deadline: "2026-03-01",
          },
        ],
      },
      metadata: {
        totalTokensUsed: 600,
        inputTokens: 400,
        outputTokens: 200,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/evaluate-gate")
      .set("x-org-id", "org_test")
      .send({
        prompt: "Evaluate sprint 3 gate readiness",
        gateDefinition: { name: "Sprint 3 Gate" },
        projectStatus: { completedTasks: 8, totalTasks: 12 },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      gate_evaluation: mockResult.data,
      metadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(optionsArg.prompt).toBe("Evaluate sprint 3 gate readiness");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
    expect(optionsArg.maxThinkingTokens).toBe(7000);
  });

  it("returns 500 when the ai service throws", async () => {
    const app = createTestApp();
    vi.mocked(runAgentQuery).mockRejectedValue(new Error("gate evaluation failed"));

    const response = await request(app).post("/evaluate-gate").send({ prompt: "Evaluate gate" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "gate evaluation failed" });
  });
});
