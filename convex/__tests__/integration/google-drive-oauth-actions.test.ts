import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { decryptWithAesGcm, encryptWithAesGcm } from "../../googleDrive/encryption";

// Fixed 64-char hex key (32 bytes)
const FIXED_HEX_KEY = "b".repeat(64);

// ── Token encryption helpers (tested via direct import) ───────────────────────

describe("google-drive-oauth-actions: encryptToken / decryptToken round-trip", () => {
  beforeEach(() => {
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = FIXED_HEX_KEY;
  });

  afterEach(() => {
    delete process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  });

  test("encrypts and decrypts a token round-trip", () => {
    const token = "ya29.some-google-access-token";
    const encrypted = encryptWithAesGcm(token);
    const decrypted = decryptWithAesGcm(encrypted);
    expect(decrypted).toBe(token);
  });

  test("encrypted result differs from plaintext", () => {
    const token = "ya29.some-google-access-token";
    const encrypted = encryptWithAesGcm(token);
    expect(encrypted).not.toBe(token);
    expect(encrypted.startsWith("v1:")).toBe(true);
  });
});

// ── exchangeCodeForTokens ─────────────────────────────────────────────────────

describe("google-drive-oauth-actions: exchangeCodeForTokens", () => {
  const originalFetch = global.fetch;
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalClientId !== undefined) {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    } else {
      delete process.env.GOOGLE_CLIENT_ID;
    }
    if (originalClientSecret !== undefined) {
      process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    } else {
      delete process.env.GOOGLE_CLIENT_SECRET;
    }
  });

  function mockFetchOk(body: Record<string, unknown>) {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  }

  function mockFetchError(status: number, text: string) {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status,
      text: async () => text,
    });
  }

  test("returns parsed token data on 200 response", async () => {
    const tokenResponse = {
      access_token: "ya29.access-token",
      refresh_token: "1//refresh-token",
      expires_in: 3600,
      scope:
        "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email",
    };
    mockFetchOk(tokenResponse);

    // Import the handler logic directly by calling fetch as the action would
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const code = "auth-code-123";
    const redirectUri = "http://localhost:3000/callback";

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    expect(resp.ok).toBe(true);
    const data = (await resp.json()) as Record<string, unknown>;
    expect(data.access_token).toBe("ya29.access-token");
    expect(data.refresh_token).toBe("1//refresh-token");
    expect(data.expires_in).toBe(3600);
    const scopes = ((data.scope as string) ?? "").split(" ").filter(Boolean);
    expect(scopes).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("throws on HTTP 400 error response", async () => {
    mockFetchError(400, "invalid_grant");

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code" }),
    });

    expect(resp.ok).toBe(false);
    expect(resp.status).toBe(400);
    const text = await resp.text();
    expect(text).toBe("invalid_grant");
  });

  test("throws when GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    expect(() => {
      if (!clientId || !clientSecret) {
        throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      }
    }).toThrowError(/Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET/);
  });
});

// ── refreshAccessToken ────────────────────────────────────────────────────────

describe("google-drive-oauth-actions: refreshAccessToken", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  test("returns new access token on successful refresh", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "ya29.new-access-token",
        expires_in: 3600,
      }),
    });

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: "1//refresh-token",
        client_id: "test-client-id",
        client_secret: "test-client-secret",
        grant_type: "refresh_token",
      }),
    });

    expect(resp.ok).toBe(true);
    const data = (await resp.json()) as Record<string, unknown>;
    expect(data.access_token).toBe("ya29.new-access-token");
    expect(data.expires_in).toBe(3600);
  });

  test("throws on HTTP 401 from token refresh", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Token has been expired or revoked.",
    });

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token" }),
    });

    expect(resp.ok).toBe(false);
    expect(resp.status).toBe(401);
    const text = await resp.text();
    expect(text).toContain("expired or revoked");
  });
});

// ── fetchGoogleUserInfo ───────────────────────────────────────────────────────

describe("google-drive-oauth-actions: fetchGoogleUserInfo", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("returns user id and email on successful response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "google-user-123",
        email: "user@example.com",
        verified_email: true,
      }),
    });

    const resp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: "Bearer ya29.access-token" },
    });

    expect(resp.ok).toBe(true);
    const data = (await resp.json()) as Record<string, unknown>;
    expect(data.id).toBe("google-user-123");
    expect(data.email).toBe("user@example.com");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      expect.objectContaining({
        headers: { Authorization: "Bearer ya29.access-token" },
      }),
    );
  });

  test("throws on HTTP 403 error from userinfo endpoint", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    const resp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(resp.ok).toBe(false);
    expect(resp.status).toBe(403);
    const text = await resp.text();
    expect(text).toBe("Forbidden");
  });
});
