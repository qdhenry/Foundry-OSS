import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { requestLogger } from "./request-logger";

describe("requestLogger", () => {
  it("logs method and path to console", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = new Hono();
    app.use("/*", requestLogger);
    app.get("/my-route", (c) => c.json({ ok: true }));

    await app.request("/my-route");

    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/GET \/my-route/));
    spy.mockRestore();
  });

  it("includes ISO timestamp in log", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = new Hono();
    app.use("/*", requestLogger);
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test");

    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/\d{4}-\d{2}-\d{2}T/));
    spy.mockRestore();
  });
});
