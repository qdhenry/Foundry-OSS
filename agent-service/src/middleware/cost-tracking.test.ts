import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { costTrackingMiddleware } from "./cost-tracking.js";

describe("costTrackingMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs cost when response contains metadata with token counts", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = express();
    app.use(costTrackingMiddleware);
    app.get("/test", (_req, res) => {
      res.json({
        data: "result",
        metadata: {
          totalTokensUsed: 500,
          inputTokens: 300,
          outputTokens: 200,
        },
      });
    });

    await request(app).get("/test");

    const costLog = consoleSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("[cost]"),
    );
    expect(costLog).toBeDefined();
    expect(costLog?.[0]).toContain("tokens=500");
    expect(costLog?.[0]).toMatch(/estimated_cost=\$[\d.]+/);
  });

  it("does not log cost when response lacks metadata", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = express();
    app.use(costTrackingMiddleware);
    app.get("/test", (_req, res) => {
      res.json({ data: "no metadata" });
    });

    await request(app).get("/test");

    const costLog = consoleSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("[cost]"),
    );
    expect(costLog).toBeUndefined();
  });

  it("still returns the response body correctly", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const app = express();
    app.use(costTrackingMiddleware);
    app.get("/test", (_req, res) => {
      res.json({
        data: "result",
        metadata: {
          totalTokensUsed: 100,
          inputTokens: 60,
          outputTokens: 40,
        },
      });
    });

    const response = await request(app).get("/test");

    expect(response.status).toBe(200);
    expect(response.body.data).toBe("result");
    expect(response.body.metadata.totalTokensUsed).toBe(100);
  });
});
