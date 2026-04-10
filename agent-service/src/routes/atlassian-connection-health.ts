import { Router } from "express";

const router = Router();

const REQUIRED_ATLASSIAN_ENV_VARS = [
  "ATLASSIAN_CLIENT_ID",
  "ATLASSIAN_CLIENT_SECRET",
  "ATLASSIAN_OAUTH_REDIRECT_URI",
] as const;

router.get("/", (_req, res) => {
  const missingEnvVars = REQUIRED_ATLASSIAN_ENV_VARS.filter(
    (envVar) => !process.env[envVar]?.trim(),
  );
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
      tokenValidation: {
        implemented: false,
        status: "not_checked",
      },
      apiAccessibility: {
        implemented: false,
        status: "not_checked",
      },
      webhookStatus: {
        implemented: false,
        status: "not_checked",
      },
    },
  };

  // TODO(atlassian): Add token validity checks using encrypted token storage once connection persistence is implemented.
  // TODO(atlassian): Add Jira/Confluence API probe checks and webhook registration checks for full health coverage.
  res.status(envConfigured ? 200 : 503).json(payload);
});

export { router as atlassianConnectionHealthRouter };
