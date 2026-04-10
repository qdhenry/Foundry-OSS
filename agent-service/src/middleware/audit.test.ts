import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditMiddleware } from "./audit.js";

describe("auditMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs audit info on response finish", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = express();
    app.use(auditMiddleware);
    app.get("/test", (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get("/test").set("x-org-id", "org_123");

    const auditLog = consoleSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("[audit]"),
    );
    expect(auditLog).toBeDefined();
    expect(auditLog?.[0]).toContain("org=org_123");
    expect(auditLog?.[0]).toContain("method=GET");
    expect(auditLog?.[0]).toContain("path=/test");
    expect(auditLog?.[0]).toContain("status=200");
    expect(auditLog?.[0]).toMatch(/duration=\d+ms/);
  });

  it("logs unknown org when x-org-id header is missing", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const app = express();
    app.use(auditMiddleware);
    app.get("/test", (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get("/test");

    const auditLog = consoleSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("[audit]"),
    );
    expect(auditLog).toBeDefined();
    expect(auditLog?.[0]).toContain("org=unknown");
  });

  it("calls next to continue the middleware chain", async () => {
    const app = express();
    app.use(auditMiddleware);
    app.get("/test", (_req, res) => {
      res.json({ reached: true });
    });

    const response = await request(app).get("/test");

    expect(response.status).toBe(200);
    expect(response.body.reached).toBe(true);
  });
});
