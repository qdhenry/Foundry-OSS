import { describe, expect, it } from "vitest";
import {
  AtlassianOAuthExchangeResponseSchema,
  AtlassianOAuthRefreshResponseSchema,
  AtlassianOAuthRequestSchema,
  AtlassianOAuthTokenSchema,
  AtlassianTokenEndpointResponseSchema,
} from "./atlassian.js";

describe("AtlassianOAuthRequestSchema", () => {
  it("accepts valid exchange_code request", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      action: "exchange_code",
      code: "auth_code_123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts exchange_code with optional redirectUri", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      action: "exchange_code",
      code: "auth_code_123",
      redirectUri: "https://example.com/callback",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid refresh_token request", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      action: "refresh_token",
      refreshToken: "refresh_token_123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing action", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      code: "auth_code_123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid action", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      action: "invalid_action",
      code: "auth_code_123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects exchange_code with empty code", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      action: "exchange_code",
      code: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects refresh_token with empty refreshToken", () => {
    const result = AtlassianOAuthRequestSchema.safeParse({
      action: "refresh_token",
      refreshToken: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtlassianTokenEndpointResponseSchema", () => {
  it("accepts valid token response", () => {
    const result = AtlassianTokenEndpointResponseSchema.safeParse({
      access_token: "access_123",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "read:jira-work",
      refresh_token: "refresh_123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts token without optional fields", () => {
    const result = AtlassianTokenEndpointResponseSchema.safeParse({
      access_token: "access_123",
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing access_token", () => {
    const result = AtlassianTokenEndpointResponseSchema.safeParse({
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive expires_in", () => {
    const result = AtlassianTokenEndpointResponseSchema.safeParse({
      access_token: "access_123",
      expires_in: 0,
      token_type: "Bearer",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtlassianOAuthTokenSchema", () => {
  it("accepts valid token", () => {
    const result = AtlassianOAuthTokenSchema.safeParse({
      accessToken: "access_123",
      expiresIn: 3600,
      tokenType: "Bearer",
      obtainedAt: "2026-02-12T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid datetime", () => {
    const result = AtlassianOAuthTokenSchema.safeParse({
      accessToken: "access_123",
      expiresIn: 3600,
      tokenType: "Bearer",
      obtainedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtlassianOAuthExchangeResponseSchema", () => {
  it("accepts valid exchange response", () => {
    const result = AtlassianOAuthExchangeResponseSchema.safeParse({
      action: "exchange_code",
      token: {
        accessToken: "access_123",
        expiresIn: 3600,
        tokenType: "Bearer",
        obtainedAt: "2026-02-12T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("AtlassianOAuthRefreshResponseSchema", () => {
  it("accepts valid refresh response", () => {
    const result = AtlassianOAuthRefreshResponseSchema.safeParse({
      action: "refresh_token",
      token: {
        accessToken: "refreshed_123",
        expiresIn: 3600,
        tokenType: "Bearer",
        obtainedAt: "2026-02-12T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });
});
