import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { auditMiddleware } from "./audit";

describe("auditMiddleware", () => {
  it("logs request details after response", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = new Hono();
    app.use("/*", auditMiddleware);
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test", {
      headers: { "x-org-id": "org-123" },
    });

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[audit]"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("org=org-123"));
    spy.mockRestore();
  });

  it("defaults org to 'unknown' when x-org-id is missing", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = new Hono();
    app.use("/*", auditMiddleware);
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test");

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("org=unknown"));
    spy.mockRestore();
  });
});
