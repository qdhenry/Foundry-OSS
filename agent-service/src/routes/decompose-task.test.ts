import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { decomposeTaskRouter } from "./decompose-task.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/decompose-task", decomposeTaskRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("decompose-task route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when prompt is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/decompose-task").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_PROMPT");
    expect(response.body.error?.message).toBe("prompt is required");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns task decomposition for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        decomposition_rationale: "Requirement broken into frontend and backend tasks.",
        critical_considerations: ["API contract must be finalized first"],
        tasks: [
          {
            title: "Create API endpoint",
            description: "Implement REST endpoint for pricing rules",
            acceptance_criteria: ["Returns 200 with valid JSON"],
            story_points: 3,
            dependencies: [],
            required_skills: ["backend", "node.js"],
            risk_factors: ["Schema migration required"],
          },
        ],
        estimated_total_points: 3,
        estimated_sprint_count: 1,
      },
      metadata: {
        totalTokensUsed: 500,
        inputTokens: 300,
        outputTokens: 200,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/decompose-task")
      .set("x-org-id", "org_test")
      .send({
        prompt: "Decompose the pricing override requirement",
        requirement: { title: "Pricing Override", priority: "must_have" },
        context: { targetPlatform: "Shopify Plus" },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      decomposition: mockResult.data,
      metadata: mockResult.metadata,
    });

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
    const [, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(optionsArg.prompt).toBe("Decompose the pricing override requirement");
    expect(optionsArg.systemPrompt).toContain("Organization: org_test");
    expect(optionsArg.systemPrompt).toContain("Pricing Override");
    expect(optionsArg.maxThinkingTokens).toBe(8000);
  });

  it("uses unknown org fallback when x-org-id is missing", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    mockedRunAgentQuery.mockResolvedValue({
      data: {
        decomposition_rationale: "Simple task",
        critical_considerations: [],
        tasks: [],
        estimated_total_points: 0,
      },
      metadata: {
        totalTokensUsed: 1,
        inputTokens: 1,
        outputTokens: 0,
        processedAt: "2026-02-12T00:00:00.000Z",
      },
    });

    const response = await request(app)
      .post("/decompose-task")
      .send({ prompt: "Decompose something" });

    expect(response.status).toBe(200);
    const [, optionsArg] = mockedRunAgentQuery.mock.calls[0];
    expect(optionsArg.systemPrompt).toContain("Organization: unknown");
  });

  it("returns 500 when the ai service throws", async () => {
    const app = createTestApp();
    vi.mocked(runAgentQuery).mockRejectedValue(new Error("decomposition failed"));

    const response = await request(app).post("/decompose-task").send({ prompt: "Decompose this" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "decomposition failed" });
  });
});
