import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { summarizeDiscoveryRouter } from "./summarize-discovery.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/summarize-discovery", summarizeDiscoveryRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("summarize-discovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when requirements is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/summarize-discovery").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_REQUIREMENTS");
    expect(response.body.error?.message).toBe(
      "requirements array is required and must not be empty",
    );
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when requirements is empty array", async () => {
    const app = createTestApp();

    const response = await request(app).post("/summarize-discovery").send({ requirements: [] });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_REQUIREMENTS");
  });

  it("returns 400 when requirements have invalid format", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/summarize-discovery")
      .send({
        requirements: [{ invalid: "data" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_REQUIREMENTS");
    expect(response.body.error?.message).toBe("Invalid requirements format");
  });

  it("returns discovery summary for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        overview: "The discovery contains 2 requirements across pricing and catalog domains.",
        statusBreakdown: "Both requirements are in draft status.",
        priorityDistribution: "1 critical, 1 high priority.",
        fitGapAnalysis: "Both are gaps requiring custom development.",
        keyInsights: ["Pricing logic is a major risk area"],
        recommendations: ["Conduct detailed pricing audit"],
        riskFlags: ["Custom pricing logic undocumented"],
      },
      metadata: {
        totalTokensUsed: 350,
        inputTokens: 220,
        outputTokens: 130,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/summarize-discovery")
      .set("x-org-id", "org_test")
      .send({
        requirements: [
          {
            title: "Pricing Override",
            status: "draft",
            priority: "critical",
            fitGap: "gap",
            workstream: "Pricing & Catalog",
          },
          {
            title: "Multi-currency support",
            status: "draft",
            priority: "high",
            fitGap: "gap",
            workstream: "Pricing & Catalog",
          },
        ],
        programName: "AcmeCorp Migration",
        targetPlatform: "Shopify Plus",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      summary: mockResult.data,
      metadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(optionsArg.prompt).toContain("Analyze these 2 discovery requirements");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
    expect(optionsArg.systemPrompt).toContain("AcmeCorp Migration");
    expect(optionsArg.systemPrompt).toContain("Shopify Plus");
  });

  it("returns 500 when the ai service throws", async () => {
    const app = createTestApp();
    vi.mocked(runAgentQuery).mockRejectedValue(new Error("summary failed"));

    const response = await request(app)
      .post("/summarize-discovery")
      .send({
        requirements: [{ title: "Test", status: "draft", priority: "high", fitGap: "gap" }],
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "summary failed" });
  });
});
