import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { evaluateRisksRouter } from "./evaluate-risks.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/evaluate-risks", evaluateRisksRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("evaluate-risks route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when prompt is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/evaluate-risks").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_PROMPT");
    expect(response.body.error?.message).toBe("prompt is required");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns risk assessment for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        change_impact_summary: {
          overall_risk_level: "high" as const,
          confidence: "medium" as const,
          summary: "Scope change introduces significant risk to timeline.",
        },
        new_risks: [
          {
            title: "API contract instability",
            description: "Third-party API spec changed mid-sprint",
            severity: "high" as const,
            likelihood: "likely" as const,
            affected_workstreams: ["Integration"],
            mitigation_strategy: "Pin API version and add contract tests",
          },
        ],
        escalations: [
          {
            risk_id: "risk_001",
            previous_severity: "medium",
            new_severity: "high",
            reason: "Vendor delayed API freeze date",
            recommended_action: "Escalate to program sponsor",
          },
        ],
        recommendations: [
          {
            priority: "immediate" as const,
            action: "Run integration smoke tests daily",
            expected_outcome: "Early detection of API drift",
            effort: "low" as const,
          },
        ],
      },
      metadata: {
        totalTokensUsed: 550,
        inputTokens: 350,
        outputTokens: 200,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/evaluate-risks")
      .set("x-org-id", "org_test")
      .send({
        prompt: "Evaluate risks after scope change",
        changes: [{ type: "scope_change", description: "Added real-time sync" }],
        existingRisks: [{ id: "risk_001", title: "Vendor dependency" }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      risk_assessment: mockResult.data,
      metadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(optionsArg.prompt).toBe("Evaluate risks after scope change");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
    expect(optionsArg.maxThinkingTokens).toBe(6000);
  });

  it("returns 500 when the ai service throws", async () => {
    const app = createTestApp();
    vi.mocked(runAgentQuery).mockRejectedValue(new Error("risk evaluation failed"));

    const response = await request(app).post("/evaluate-risks").send({ prompt: "Evaluate risks" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "risk evaluation failed" });
  });
});
