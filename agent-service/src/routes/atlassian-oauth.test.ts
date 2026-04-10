import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atlassianOAuthRouter } from "./atlassian-oauth.js";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/atlassian/oauth", atlassianOAuthRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("atlassian-oauth route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ATLASSIAN_CLIENT_ID: "test-client-id",
      ATLASSIAN_CLIENT_SECRET: "test-client-secret",
      ATLASSIAN_OAUTH_REDIRECT_URI: "https://example.com/callback",
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns 400 for invalid request body", async () => {
    const app = createTestApp();

    const response = await request(app).post("/atlassian/oauth").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_REQUEST");
    expect(response.body.error?.message).toBe("Invalid atlassian oauth request body");
  });

  it("returns 400 for missing action field", async () => {
    const app = createTestApp();

    const response = await request(app).post("/atlassian/oauth").send({ code: "auth_code_123" });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_REQUEST");
  });

  it("returns 500 when env vars are missing", async () => {
    delete process.env.ATLASSIAN_CLIENT_ID;
    delete process.env.ATLASSIAN_CLIENT_SECRET;
    const app = createTestApp();

    const response = await request(app)
      .post("/atlassian/oauth")
      .send({ action: "exchange_code", code: "auth_code_123" });

    expect(response.status).toBe(500);
    expect(response.body.error?.code).toBe("MISSING_ATLASSIAN_CONFIG");
    expect(response.body.error?.details?.missingEnvVars).toContain("ATLASSIAN_CLIENT_ID");
    expect(response.body.error?.details?.missingEnvVars).toContain("ATLASSIAN_CLIENT_SECRET");
  });

  it("returns 500 when redirect URI is missing for exchange_code", async () => {
    delete process.env.ATLASSIAN_OAUTH_REDIRECT_URI;
    const app = createTestApp();

    const response = await request(app)
      .post("/atlassian/oauth")
      .send({ action: "exchange_code", code: "auth_code_123" });

    expect(response.status).toBe(500);
    expect(response.body.error?.code).toBe("MISSING_ATLASSIAN_CONFIG");
    expect(response.body.error?.details?.missingEnvVars).toContain("ATLASSIAN_OAUTH_REDIRECT_URI");
  });

  it("exchanges code successfully with mocked fetch", async () => {
    const app = createTestApp();

    const mockTokenResponse = {
      access_token: "test-access-token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "read:jira-work",
      refresh_token: "test-refresh-token",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockTokenResponse)),
      }),
    );

    const response = await request(app)
      .post("/atlassian/oauth")
      .send({ action: "exchange_code", code: "auth_code_123" });

    expect(response.status).toBe(200);
    expect(response.body.action).toBe("exchange_code");
    expect(response.body.token.accessToken).toBe("test-access-token");
    expect(response.body.token.expiresIn).toBe(3600);
    expect(response.body.token.tokenType).toBe("Bearer");
    expect(response.body.token.refreshToken).toBe("test-refresh-token");
    expect(response.body.token.obtainedAt).toBeDefined();
  });

  it("refreshes token successfully with mocked fetch", async () => {
    const app = createTestApp();

    const mockTokenResponse = {
      access_token: "refreshed-access-token",
      expires_in: 3600,
      token_type: "Bearer",
      refresh_token: "new-refresh-token",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockTokenResponse)),
      }),
    );

    const response = await request(app)
      .post("/atlassian/oauth")
      .send({ action: "refresh_token", refreshToken: "old-refresh-token" });

    expect(response.status).toBe(200);
    expect(response.body.action).toBe("refresh_token");
    expect(response.body.token.accessToken).toBe("refreshed-access-token");
  });

  it("returns 502 when Atlassian token endpoint rejects request", async () => {
    const app = createTestApp();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ error: "invalid_grant" })),
      }),
    );

    const response = await request(app)
      .post("/atlassian/oauth")
      .send({ action: "exchange_code", code: "bad_code" });

    expect(response.status).toBe(502);
    expect(response.body.error?.code).toBe("ATLASSIAN_TOKEN_REQUEST_FAILED");
    expect(response.body.error?.details?.upstreamStatus).toBe(401);
  });

  it("returns 502 when fetch throws network error", async () => {
    const app = createTestApp();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const response = await request(app)
      .post("/atlassian/oauth")
      .send({ action: "exchange_code", code: "auth_code_123" });

    expect(response.status).toBe(502);
    expect(response.body.error?.code).toBe("ATLASSIAN_TOKEN_REQUEST_FAILED");
    expect(response.body.error?.message).toBe("Failed to reach Atlassian token endpoint");
  });

  it("returns 502 when Atlassian returns malformed response", async () => {
    const app = createTestApp();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ unexpected: "data" })),
      }),
    );

    const response = await request(app)
      .post("/atlassian/oauth")
      .send({ action: "exchange_code", code: "auth_code_123" });

    expect(response.status).toBe(502);
    expect(response.body.error?.code).toBe("INVALID_ATLASSIAN_RESPONSE");
  });
});
