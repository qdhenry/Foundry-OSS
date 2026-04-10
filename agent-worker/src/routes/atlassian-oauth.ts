import { Hono } from "hono";
import {
  AtlassianOAuthExchangeResponseSchema,
  AtlassianOAuthRefreshResponseSchema,
  AtlassianOAuthRequestSchema,
  AtlassianTokenEndpointResponseSchema,
} from "../schemas/atlassian";
import type { Env } from "../types";

const ATLASSIAN_TOKEN_ENDPOINT = "https://auth.atlassian.com/oauth/token";

const app = new Hono<{ Bindings: Env }>();

async function readJsonOrText(response: Response): Promise<unknown> {
  const rawBody = await response.text();
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return { rawBody };
  }
}

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = AtlassianOAuthRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid atlassian oauth request body",
          details: parsed.error.issues,
        },
      },
      400,
    );
  }

  const clientId = c.env.ATLASSIAN_CLIENT_ID?.trim() ?? "";
  const clientSecret = c.env.ATLASSIAN_CLIENT_SECRET?.trim() ?? "";
  const redirectUriFromEnv = c.env.ATLASSIAN_OAUTH_REDIRECT_URI?.trim() ?? "";

  const missingEnvVars: string[] = [];
  if (!clientId) missingEnvVars.push("ATLASSIAN_CLIENT_ID");
  if (!clientSecret) missingEnvVars.push("ATLASSIAN_CLIENT_SECRET");
  if (parsed.data.action === "exchange_code" && !parsed.data.redirectUri && !redirectUriFromEnv) {
    missingEnvVars.push("ATLASSIAN_OAUTH_REDIRECT_URI");
  }

  if (missingEnvVars.length > 0) {
    return c.json(
      {
        error: {
          code: "MISSING_ATLASSIAN_CONFIG",
          message: "Atlassian OAuth environment variables are not configured",
          details: { missingEnvVars },
        },
      },
      500,
    );
  }

  const tokenRequestBody =
    parsed.data.action === "exchange_code"
      ? {
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code: parsed.data.code,
          redirect_uri: parsed.data.redirectUri ?? redirectUriFromEnv,
        }
      : {
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: parsed.data.refreshToken,
        };

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(ATLASSIAN_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tokenRequestBody),
    });
  } catch (fetchErr) {
    return c.json(
      {
        error: {
          code: "ATLASSIAN_TOKEN_REQUEST_FAILED",
          message: "Failed to reach Atlassian token endpoint",
          details: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        },
      },
      502,
    );
  }

  const upstreamPayload = await readJsonOrText(tokenResponse);

  if (!tokenResponse.ok) {
    return c.json(
      {
        error: {
          code: "ATLASSIAN_TOKEN_REQUEST_FAILED",
          message: "Atlassian token request was rejected",
          details: {
            action: parsed.data.action,
            upstreamStatus: tokenResponse.status,
            upstreamPayload,
          },
        },
      },
      502,
    );
  }

  const tokenParsed = AtlassianTokenEndpointResponseSchema.safeParse(upstreamPayload);
  if (!tokenParsed.success) {
    return c.json(
      {
        error: {
          code: "INVALID_ATLASSIAN_RESPONSE",
          message: "Atlassian token response did not match expected schema",
          details: tokenParsed.error.issues,
        },
      },
      502,
    );
  }

  const token = {
    accessToken: tokenParsed.data.access_token,
    expiresIn: tokenParsed.data.expires_in,
    tokenType: tokenParsed.data.token_type,
    scope: tokenParsed.data.scope,
    refreshToken: tokenParsed.data.refresh_token,
    obtainedAt: new Date().toISOString(),
  };

  const responsePayload =
    parsed.data.action === "exchange_code"
      ? AtlassianOAuthExchangeResponseSchema.parse({ action: "exchange_code", token })
      : AtlassianOAuthRefreshResponseSchema.parse({ action: "refresh_token", token });

  return c.json(responsePayload);
});

export { app as atlassianOAuthRoute };
