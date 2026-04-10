import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { atlassianConnectionHealthRouter } from "./atlassian-connection-health.js";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/atlassian/connection-health", atlassianConnectionHealthRouter);
  return app;
}

describe("atlassian-connection-health route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 200 with ok status when all env vars are configured", async () => {
    process.env.ATLASSIAN_CLIENT_ID = "test-client-id";
    process.env.ATLASSIAN_CLIENT_SECRET = "test-client-secret";
    process.env.ATLASSIAN_OAUTH_REDIRECT_URI = "https://example.com/callback";

    const app = createTestApp();
    const response = await request(app).get("/atlassian/connection-health");

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe("atlassian");
    expect(response.body.status).toBe("ok");
    expect(response.body.checks.env.configured).toBe(true);
    expect(response.body.checks.env.missingEnvVars).toEqual([]);
    expect(response.body.checkedAt).toBeDefined();
  });

  it("returns 503 with degraded status when env vars are missing", async () => {
    delete process.env.ATLASSIAN_CLIENT_ID;
    delete process.env.ATLASSIAN_CLIENT_SECRET;
    delete process.env.ATLASSIAN_OAUTH_REDIRECT_URI;

    const app = createTestApp();
    const response = await request(app).get("/atlassian/connection-health");

    expect(response.status).toBe(503);
    expect(response.body.provider).toBe("atlassian");
    expect(response.body.status).toBe("degraded");
    expect(response.body.checks.env.configured).toBe(false);
    expect(response.body.checks.env.missingEnvVars).toContain("ATLASSIAN_CLIENT_ID");
    expect(response.body.checks.env.missingEnvVars).toContain("ATLASSIAN_CLIENT_SECRET");
    expect(response.body.checks.env.missingEnvVars).toContain("ATLASSIAN_OAUTH_REDIRECT_URI");
  });

  it("returns 503 when only some env vars are missing", async () => {
    process.env.ATLASSIAN_CLIENT_ID = "test-client-id";
    delete process.env.ATLASSIAN_CLIENT_SECRET;
    delete process.env.ATLASSIAN_OAUTH_REDIRECT_URI;

    const app = createTestApp();
    const response = await request(app).get("/atlassian/connection-health");

    expect(response.status).toBe(503);
    expect(response.body.checks.env.missingEnvVars).not.toContain("ATLASSIAN_CLIENT_ID");
    expect(response.body.checks.env.missingEnvVars).toContain("ATLASSIAN_CLIENT_SECRET");
  });

  it("includes unimplemented check stubs", async () => {
    process.env.ATLASSIAN_CLIENT_ID = "id";
    process.env.ATLASSIAN_CLIENT_SECRET = "secret";
    process.env.ATLASSIAN_OAUTH_REDIRECT_URI = "https://example.com/cb";

    const app = createTestApp();
    const response = await request(app).get("/atlassian/connection-health");

    expect(response.body.checks.tokenValidation.implemented).toBe(false);
    expect(response.body.checks.tokenValidation.status).toBe("not_checked");
    expect(response.body.checks.apiAccessibility.implemented).toBe(false);
    expect(response.body.checks.webhookStatus.implemented).toBe(false);
  });
});
