import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { orgIdMiddleware } from "./org-id";

describe("orgIdMiddleware", () => {
  it("sets orgId from x-org-id header", async () => {
    let capturedOrgId: string | undefined;

    const app = new Hono<{ Variables: { orgId: string } }>();
    app.use("/*", orgIdMiddleware);
    app.get("/test", (c) => {
      capturedOrgId = c.get("orgId");
      return c.json({ ok: true });
    });

    await app.request("/test", {
      headers: { "x-org-id": "org-abc" },
    });

    expect(capturedOrgId).toBe("org-abc");
  });

  it("defaults to 'unknown' when x-org-id is missing", async () => {
    let capturedOrgId: string | undefined;

    const app = new Hono<{ Variables: { orgId: string } }>();
    app.use("/*", orgIdMiddleware);
    app.get("/test", (c) => {
      capturedOrgId = c.get("orgId");
      return c.json({ ok: true });
    });

    await app.request("/test");

    expect(capturedOrgId).toBe("unknown");
  });

  it("does not reject requests without x-org-id", async () => {
    const app = new Hono();
    app.use("/*", orgIdMiddleware);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });
});
