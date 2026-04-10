import { Hono } from "hono";
import type { Env } from "../types";

const REQUIRED_ATLASSIAN_ENV_VARS = [
  "ATLASSIAN_CLIENT_ID",
  "ATLASSIAN_CLIENT_SECRET",
  "ATLASSIAN_OAUTH_REDIRECT_URI",
] as const;

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  const missingEnvVars = REQUIRED_ATLASSIAN_ENV_VARS.filter((envVar) => !c.env[envVar]?.trim());
  const envConfigured = missingEnvVars.length === 0;

  const payload = {
    provider: "atlassian",
    status: envConfigured ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    authEndpoint: "https://auth.atlassian.com/oauth/token",
    checks: {
      env: {
        configured: envConfigured,
        requiredEnvVars: REQUIRED_ATLASSIAN_ENV_VARS,
        missingEnvVars,
      },
      tokenValidation: { implemented: false, status: "not_checked" },
      apiAccessibility: { implemented: false, status: "not_checked" },
      webhookStatus: { implemented: false, status: "not_checked" },
    },
  };

  return c.json(payload, envConfigured ? 200 : 503);
});

export { app as atlassianConnectionHealthRoute };
