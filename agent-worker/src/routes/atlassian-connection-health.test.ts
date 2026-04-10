import { describe, expect, it } from "vitest";
import { app } from "../router";
import { authedRequest, makeEnv, readJson } from "../test-helpers";

describe("GET /atlassian/connection-health", () => {
  it("returns 503 with degraded status when Atlassian env vars are missing", async () => {
    const env = makeEnv();
    const req = authedRequest("GET", "/atlassian/connection-health");
    const res = await app.fetch(req, env);
    expect(res.status).toBe(503);

    const body = await readJson(res);
    expect(body.provider).toBe("atlassian");
    expect(body.status).toBe("degraded");
    expect(body.checks.env.configured).toBe(false);
    expect(body.checks.env.missingEnvVars.length).toBeGreaterThan(0);
  });

  it("returns 200 with ok status when all Atlassian env vars are set", async () => {
    const env = makeEnv({
      ATLASSIAN_CLIENT_ID: "client-id",
      ATLASSIAN_CLIENT_SECRET: "client-secret",
      ATLASSIAN_OAUTH_REDIRECT_URI: "https://example.com/callback",
    });
    const req = authedRequest("GET", "/atlassian/connection-health");
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.provider).toBe("atlassian");
    expect(body.status).toBe("ok");
    expect(body.checks.env.configured).toBe(true);
    expect(body.checks.env.missingEnvVars).toHaveLength(0);
  });

  it("includes checkedAt timestamp", async () => {
    const env = makeEnv();
    const req = authedRequest("GET", "/atlassian/connection-health");
    const res = await app.fetch(req, env);

    const body = await readJson(res);
    expect(body.checkedAt).toBeTruthy();
  });
});
