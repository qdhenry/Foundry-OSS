import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestLogger } from "./request-logger.js";

describe("requestLogger middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs method and path for incoming requests", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = express();
    app.use(requestLogger);
    app.get("/test-path", (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get("/test-path");

    const logCall = consoleSpy.mock.calls.find(
      (call) =>
        typeof call[0] === "string" && call[0].includes("GET") && call[0].includes("/test-path"),
    );
    expect(logCall).toBeDefined();
  });

  it("includes timestamp in log output", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = express();
    app.use(requestLogger);
    app.post("/api/data", (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).post("/api/data").send({});

    const logCall = consoleSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("POST"),
    );
    expect(logCall).toBeDefined();
    // ISO timestamp pattern
    expect(logCall?.[0]).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("calls next to continue the middleware chain", async () => {
    const app = express();
    app.use(requestLogger);
    app.get("/next-test", (_req, res) => {
      res.json({ reached: true });
    });

    const response = await request(app).get("/next-test");

    expect(response.status).toBe(200);
    expect(response.body.reached).toBe(true);
  });
});
