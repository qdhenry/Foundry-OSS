"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { decryptWithAesGcm, encryptWithAesGcm } from "./encryption";

export const encryptToken = internalAction({
  args: { token: v.string() },
  handler: async (_ctx, args) => {
    return encryptWithAesGcm(args.token);
  },
});

export const decryptToken = internalAction({
  args: { encryptedToken: v.string() },
  handler: async (_ctx, args) => {
    return decryptWithAesGcm(args.encryptedToken);
  },
});

export const exchangeCodeForTokens = internalAction({
  args: {
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (_ctx, args) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    }

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: args.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: args.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google token exchange failed: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as Record<string, unknown>;
    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string | undefined,
      expiresIn: data.expires_in as number,
      scopes: ((data.scope as string) ?? "").split(" ").filter(Boolean),
    };
  },
});

export const refreshAccessToken = internalAction({
  args: { refreshToken: v.string() },
  handler: async (_ctx, args) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    }

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: args.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google token refresh failed: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as Record<string, unknown>;
    return {
      accessToken: data.access_token as string,
      expiresIn: data.expires_in as number,
    };
  },
});

export const fetchGoogleUserInfo = internalAction({
  args: { accessToken: v.string() },
  handler: async (_ctx, args) => {
    const resp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google userinfo fetch failed: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as Record<string, unknown>;
    return {
      id: data.id as string,
      email: data.email as string,
    };
  },
});
