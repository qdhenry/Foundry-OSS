import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../router";
import { authedRequest, makeEnv, readJson } from "../test-helpers";

// Mock global fetch for Atlassian token endpoint calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const envWithAtlassian = makeEnv({
  ATLASSIAN_CLIENT_ID: "test-client-id",
  ATLASSIAN_CLIENT_SECRET: "test-client-secret",
  ATLASSIAN_OAUTH_REDIRECT_URI: "https://example.com/callback",
});

describe("POST /atlassian/oauth", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns 400 for invalid request body (missing action)", async () => {
    const req = authedRequest("POST", "/atlassian/oauth", {
      code: "some-code",
    });
    const res = await app.fetch(req, envWithAtlassian);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 for invalid exchange_code request (missing code)", async () => {
    const req = authedRequest("POST", "/atlassian/oauth", {
      action: "exchange_code",
    });
    const res = await app.fetch(req, envWithAtlassian);
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 500 when Atlassian env vars are missing", async () => {
    const envNoAtlassian = makeEnv();
    const req = authedRequest("POST", "/atlassian/oauth", {
      action: "exchange_code",
      code: "auth-code-123",
    });
    const res = await app.fetch(req, envNoAtlassian);
    expect(res.status).toBe(500);

    const body = await readJson(res);
    expect(body.error.code).toBe("MISSING_ATLASSIAN_CONFIG");
  });

  it("returns 200 with token for successful exchange_code", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-123",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "read:jira-work",
          refresh_token: "refresh-456",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const req = authedRequest("POST", "/atlassian/oauth", {
      action: "exchange_code",
      code: "auth-code-123",
    });
    const res = await app.fetch(req, envWithAtlassian);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.action).toBe("exchange_code");
    expect(body.token.accessToken).toBe("access-123");
    expect(body.token.expiresIn).toBe(3600);
    expect(body.token.tokenType).toBe("Bearer");
    expect(body.token.obtainedAt).toBeTruthy();
  });

  it("returns 200 with token for successful refresh_token", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new-access-789",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "read:jira-work",
          refresh_token: "new-refresh-012",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const req = authedRequest("POST", "/atlassian/oauth", {
      action: "refresh_token",
      refreshToken: "old-refresh-token",
    });
    const res = await app.fetch(req, envWithAtlassian);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.action).toBe("refresh_token");
    expect(body.token.accessToken).toBe("new-access-789");
  });

  it("returns 502 when Atlassian token endpoint rejects the request", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const req = authedRequest("POST", "/atlassian/oauth", {
      action: "exchange_code",
      code: "expired-code",
    });
    const res = await app.fetch(req, envWithAtlassian);
    expect(res.status).toBe(502);

    const body = await readJson(res);
    expect(body.error.code).toBe("ATLASSIAN_TOKEN_REQUEST_FAILED");
  });

  it("returns 502 when fetch to Atlassian fails (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const req = authedRequest("POST", "/atlassian/oauth", {
      action: "exchange_code",
      code: "some-code",
    });
    const res = await app.fetch(req, envWithAtlassian);
    expect(res.status).toBe(502);

    const body = await readJson(res);
    expect(body.error.code).toBe("ATLASSIAN_TOKEN_REQUEST_FAILED");
    expect(body.error.message).toBe("Failed to reach Atlassian token endpoint");
  });

  it("returns 502 when Atlassian response does not match expected schema", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ unexpected: "format" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const req = authedRequest("POST", "/atlassian/oauth", {
      action: "exchange_code",
      code: "some-code",
    });
    const res = await app.fetch(req, envWithAtlassian);
    expect(res.status).toBe(502);

    const body = await readJson(res);
    expect(body.error.code).toBe("INVALID_ATLASSIAN_RESPONSE");
  });
});
