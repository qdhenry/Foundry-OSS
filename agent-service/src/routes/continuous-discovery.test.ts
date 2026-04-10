import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { continuousDiscoveryRouter } from "./continuous-discovery.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/continuous-discovery", continuousDiscoveryRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("continuous-discovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when prompt is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/continuous-discovery").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_PROMPT");
    expect(response.body.error?.message).toBe("prompt is required");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns discovery findings for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        suggested_requirements: [
          {
            title: "Multi-currency support",
            description: "Platform must handle transactions in USD, EUR, GBP",
            category: "Pricing & Catalog",
            priority: "high" as const,
            rationale: "Client operates in 3 markets",
          },
        ],
        identified_gaps: [
          {
            area: "Data migration",
            description: "No strategy for migrating historical order data",
            severity: "critical" as const,
            suggested_action: "Define data migration scope and approach",
          },
        ],
        risk_indicators: [
          {
            indicator: "Undocumented custom pricing logic",
            risk_level: "high" as const,
            affected_workstreams: ["Pricing & Catalog"],
            mitigation_suggestion: "Conduct pricing logic audit with client dev team",
          },
        ],
        key_insights: [
          {
            insight: "Client has significant reliance on custom Magento extensions",
            confidence: "high" as const,
            source_context: "Discovery call transcript",
          },
        ],
      },
      metadata: {
        totalTokensUsed: 500,
        inputTokens: 320,
        outputTokens: 180,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/continuous-discovery")
      .set("x-org-id", "org_test")
      .send({
        prompt: "Analyze the discovery context for gaps and risks",
        context: { targetPlatform: "Shopify Plus", sourcePlatform: "Magento" },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      findings: mockResult.data,
      metadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(optionsArg.prompt).toBe("Analyze the discovery context for gaps and risks");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
  });

  it("returns 500 when the ai service throws", async () => {
    const app = createTestApp();
    vi.mocked(runAgentQuery).mockRejectedValue(new Error("discovery analysis failed"));

    const response = await request(app)
      .post("/continuous-discovery")
      .send({ prompt: "Analyze discovery" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "discovery analysis failed" });
  });
});
