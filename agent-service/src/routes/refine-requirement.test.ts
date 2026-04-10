import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { refineRequirementRouter } from "./refine-requirement.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/refine-requirement", refineRequirementRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("refine-requirement route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when prompt is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/refine-requirement").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_PROMPT");
    expect(response.body.error?.message).toBe("prompt is required");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns refinement for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        overall_assessment: {
          clarity_score: 6,
          completeness_score: 5,
          testability_score: 4,
          summary: "Requirement needs more specific acceptance criteria.",
        },
        suggestions: [
          {
            area: "acceptance_criteria",
            current_text: "System should handle pricing overrides",
            suggested_text:
              "System must support tier-based volume discounts with configurable override rules per customer segment",
            reason: "More specific and testable",
            priority: "high" as const,
          },
        ],
        potential_split: {
          should_split: true,
          reason: "Requirement covers pricing logic and UI concerns",
          proposed_sub_requirements: [
            { title: "Pricing engine rules", description: "Backend pricing override logic" },
            { title: "Pricing admin UI", description: "Admin interface for managing overrides" },
          ],
        },
      },
      metadata: {
        totalTokensUsed: 400,
        inputTokens: 250,
        outputTokens: 150,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/refine-requirement")
      .set("x-org-id", "org_test")
      .send({
        prompt: "Refine this pricing requirement",
        requirement: { title: "Pricing Override", description: "Handle pricing overrides" },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      refinement: mockResult.data,
      metadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(optionsArg.prompt).toBe("Refine this pricing requirement");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
  });

  it("returns 500 when the ai service throws", async () => {
    const app = createTestApp();
    vi.mocked(runAgentQuery).mockRejectedValue(new Error("refinement failed"));

    const response = await request(app).post("/refine-requirement").send({ prompt: "Refine this" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "refinement failed" });
  });
});
