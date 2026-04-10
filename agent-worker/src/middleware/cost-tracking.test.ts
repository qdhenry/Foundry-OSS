import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { costTrackingMiddleware } from "./cost-tracking";

describe("costTrackingMiddleware", () => {
  it("logs cost info for 200 responses with metadata", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = new Hono();
    app.use("/*", costTrackingMiddleware);
    app.get("/test", (c) =>
      c.json({
        data: "result",
        metadata: {
          totalTokensUsed: 150,
          inputTokens: 100,
          outputTokens: 50,
        },
      }),
    );

    await app.request("/test");

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[cost]"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("tokens=150"));
    spy.mockRestore();
  });

  it("does not log cost for non-200 responses", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = new Hono();
    app.use("/*", costTrackingMiddleware);
    app.get("/test", (c) => c.json({ error: "bad request" }, 400));

    await app.request("/test");

    const costLogs = spy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("[cost]"),
    );
    expect(costLogs).toHaveLength(0);
    spy.mockRestore();
  });

  it("does not log cost when response has no metadata", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = new Hono();
    app.use("/*", costTrackingMiddleware);
    app.get("/test", (c) => c.json({ data: "no-metadata" }));

    await app.request("/test");

    const costLogs = spy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("[cost]"),
    );
    expect(costLogs).toHaveLength(0);
    spy.mockRestore();
  });
});
