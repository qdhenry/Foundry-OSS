import { describe, expect, it } from "vitest";
import {
  AtlassianOAuthExchangeRequestSchema,
  AtlassianOAuthExchangeResponseSchema,
  AtlassianOAuthRefreshRequestSchema,
  AtlassianOAuthRefreshResponseSchema,
  AtlassianOAuthRequestSchema,
  AtlassianOAuthResponseSchema,
  AtlassianOAuthTokenSchema,
  AtlassianTokenEndpointResponseSchema,
} from "./atlassian";

describe("AtlassianOAuthExchangeRequestSchema", () => {
  it("accepts valid exchange_code request", () => {
    const result = AtlassianOAuthExchangeRequestSchema.safeParse({
      action: "exchange_code",
      code: "auth-code-123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts exchange_code with optional redirectUri", () => {
    const result = AtlassianOAuthExchangeRequestSchema.safeParse({
      action: "exchange_code",
      code: "auth-code-123",
      redirectUri: "https://example.com/callback",
    });
    expect(result.success).toBe(true);
  });

  it("rejects exchange_code with empty code", () => {
    const result = AtlassianOAuthExchangeRequestSchema.safeParse({
      action: "exchange_code",
      code: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects exchange_code with invalid redirectUri", () => {
    const result = AtlassianOAuthExchangeRequestSchema.safeParse({
      action: "exchange_code",
      code: "abc",
      redirectUri: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtlassianOAuthRefreshRequestSchema", () => {
  it("accepts valid refresh_token request", () => {
    const result = AtlassianOAuthRefreshRequestSchema.safeParse({
      action: "refresh_token",
      refreshToken: "refresh-token-456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects refresh_token with empty refreshToken", () => {
    const result = AtlassianOAuthRefreshRequestSchema.safeParse({
      action: "refresh_token",
      refreshToken: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtlassianOAuthRequestSchema (discriminated union)", () => {
  it("accepts exchange_code action", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      action: "exchange_code",
      code: "abc",
    });
    expect(result.success).toBe(true);
  });

  it("accepts refresh_token action", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      action: "refresh_token",
      refreshToken: "xyz",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown action", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      action: "invalid_action",
      code: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects request with no action", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      code: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtlassianTokenEndpointResponseSchema", () => {
  it("accepts valid token response", () => {
    const result = AtlassianTokenEndpointResponseSchema.safeParse({
      access_token: "token-abc",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "read:jira-work",
      refresh_token: "refresh-xyz",
    });
    expect(result.success).toBe(true);
  });

  it("accepts response without optional fields", () => {
    const result = AtlassianTokenEndpointResponseSchema.safeParse({
      access_token: "token-abc",
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects response with empty access_token", () => {
    const result = AtlassianTokenEndpointResponseSchema.safeParse({
      access_token: "",
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects response with non-positive expires_in", () => {
    const result = AtlassianTokenEndpointResponseSchema.safeParse({
      access_token: "token",
      expires_in: 0,
      token_type: "Bearer",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtlassianOAuthTokenSchema", () => {
  it("accepts valid token object", () => {
    const result = AtlassianOAuthTokenSchema.safeParse({
      accessToken: "access-123",
      expiresIn: 3600,
      tokenType: "Bearer",
      scope: "read:jira-work",
      refreshToken: "refresh-456",
      obtainedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects token with invalid obtainedAt format", () => {
    const result = AtlassianOAuthTokenSchema.safeParse({
      accessToken: "access-123",
      expiresIn: 3600,
      tokenType: "Bearer",
      obtainedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtlassianOAuthResponseSchema (discriminated union)", () => {
  const validToken = {
    accessToken: "access-123",
    expiresIn: 3600,
    tokenType: "Bearer",
    obtainedAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts exchange_code response", () => {
    const result = AtlassianOAuthResponseSchema.safeParse({
      action: "exchange_code",
      token: validToken,
    });
    expect(result.success).toBe(true);
  });

  it("accepts refresh_token response", () => {
    const result = AtlassianOAuthResponseSchema.safeParse({
      action: "refresh_token",
      token: validToken,
    });
    expect(result.success).toBe(true);
  });

  it("rejects response with invalid action", () => {
    const result = AtlassianOAuthResponseSchema.safeParse({
      action: "bad_action",
      token: validToken,
    });
    expect(result.success).toBe(false);
  });
});
