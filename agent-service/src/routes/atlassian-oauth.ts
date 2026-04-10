import { Router } from "express";
import {
  AtlassianOAuthExchangeResponseSchema,
  AtlassianOAuthRefreshResponseSchema,
  AtlassianOAuthRequestSchema,
  AtlassianTokenEndpointResponseSchema,
} from "../schemas/atlassian.js";

const router = Router();

const ATLASSIAN_TOKEN_ENDPOINT = "https://auth.atlassian.com/oauth/token";
const ATLASSIAN_CLIENT_ID_ENV = "ATLASSIAN_CLIENT_ID";
const ATLASSIAN_CLIENT_SECRET_ENV = "ATLASSIAN_CLIENT_SECRET";
const ATLASSIAN_REDIRECT_URI_ENV = "ATLASSIAN_OAUTH_REDIRECT_URI";

function getEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

async function readJsonOrText(response: Response): Promise<unknown> {
  const rawBody = await response.text();
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return { rawBody };
  }
}

router.post("/", async (req, res, next) => {
  try {
    const parsed = AtlassianOAuthRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid atlassian oauth request body",
          details: parsed.error.issues,
        },
      });
      return;
    }

    const clientId = getEnv(ATLASSIAN_CLIENT_ID_ENV);
    const clientSecret = getEnv(ATLASSIAN_CLIENT_SECRET_ENV);
    const redirectUriFromEnv = getEnv(ATLASSIAN_REDIRECT_URI_ENV);

    const missingEnvVars: string[] = [];
    if (!clientId) missingEnvVars.push(ATLASSIAN_CLIENT_ID_ENV);
    if (!clientSecret) missingEnvVars.push(ATLASSIAN_CLIENT_SECRET_ENV);

    if (parsed.data.action === "exchange_code" && !parsed.data.redirectUri && !redirectUriFromEnv) {
      missingEnvVars.push(ATLASSIAN_REDIRECT_URI_ENV);
    }

    if (missingEnvVars.length > 0) {
      res.status(500).json({
        error: {
          code: "MISSING_ATLASSIAN_CONFIG",
          message: "Atlassian OAuth environment variables are not configured",
          details: {
            missingEnvVars,
          },
        },
      });
      return;
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
      res.status(502).json({
        error: {
          code: "ATLASSIAN_TOKEN_REQUEST_FAILED",
          message: "Failed to reach Atlassian token endpoint",
          details: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        },
      });
      return;
    }

    const upstreamPayload = await readJsonOrText(tokenResponse);

    if (!tokenResponse.ok) {
      res.status(502).json({
        error: {
          code: "ATLASSIAN_TOKEN_REQUEST_FAILED",
          message: "Atlassian token request was rejected",
          details: {
            action: parsed.data.action,
            upstreamStatus: tokenResponse.status,
            upstreamPayload,
          },
        },
      });
      return;
    }

    const tokenParsed = AtlassianTokenEndpointResponseSchema.safeParse(upstreamPayload);
    if (!tokenParsed.success) {
      res.status(502).json({
        error: {
          code: "INVALID_ATLASSIAN_RESPONSE",
          message: "Atlassian token response did not match expected schema",
          details: tokenParsed.error.issues,
        },
      });
      return;
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
        ? AtlassianOAuthExchangeResponseSchema.parse({
            action: "exchange_code",
            token,
          })
        : AtlassianOAuthRefreshResponseSchema.parse({
            action: "refresh_token",
            token,
          });

    // TODO(atlassian): Persist encrypted Atlassian tokens in Convex instead of returning them directly.
    // TODO(atlassian): Enforce OAuth state/PKCE validation when callback wiring is connected to frontend auth flow.
    res.json(responsePayload);
  } catch (err) {
    next(err);
  }
});

export { router as atlassianOAuthRouter };
