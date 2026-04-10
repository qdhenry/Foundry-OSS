import { Hono } from "hono";
import { validateBearerToken } from "./lib/auth";
import { auditMiddleware } from "./middleware/audit";
import { costTrackingMiddleware } from "./middleware/cost-tracking";
import { errorHandler } from "./middleware/error-handler";
import { orgIdMiddleware } from "./middleware/org-id";
import { requestLogger } from "./middleware/request-logger";
import { analyzeCodebaseRoute } from "./routes/analyze-codebase";
import { analyzeRequirementRoute } from "./routes/analyze-requirement";
import { analyzeTaskSubtasksRoute } from "./routes/analyze-task-subtasks";
import { atlassianConnectionHealthRoute } from "./routes/atlassian-connection-health";
import { atlassianOAuthRoute } from "./routes/atlassian-oauth";
// Routes
import { authStatusRoute } from "./routes/auth-status";
import { codebaseChatRoute } from "./routes/codebase-chat";
import { continuousDiscoveryRoute } from "./routes/continuous-discovery";
import { decomposeTaskRoute } from "./routes/decompose-task";
import { dispatchAgentRoute } from "./routes/dispatch-agent";
import { evaluateGateRoute } from "./routes/evaluate-gate";
import { evaluateRisksRoute } from "./routes/evaluate-risks";
import { generateTeamRoute } from "./routes/generate-team";
import { planAssignmentsRoute } from "./routes/plan-assignments";
import { planSprintRoute } from "./routes/plan-sprint";
import { refineRequirementRoute } from "./routes/refine-requirement";
import { summarizeDiscoveryRoute } from "./routes/summarize-discovery";
import type { Env } from "./types";

const WORKER_VERSION = "0.1.0";

const app = new Hono<{ Bindings: Env }>();

// Global error handler
app.onError(errorHandler);

// Health check — no auth
app.get("/health", (c) =>
  c.json({
    ok: true,
    data: {
      status: "ok",
      service: "foundry-agent-worker",
      timestamp: new Date().toISOString(),
      version: WORKER_VERSION,
    },
  }),
);

// Bearer token auth for all other routes
app.use("/*", async (c, next) => {
  // Skip auth for health endpoint (already handled above)
  if (c.req.path === "/health") return next();

  const secret = c.env.AGENT_SERVICE_SECRET;
  if (!secret) {
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "AGENT_SERVICE_SECRET is not configured." } },
      500,
    );
  }

  const valid = await validateBearerToken(c.req.raw, secret);
  if (!valid) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing bearer token." } },
      401,
    );
  }

  await next();
});

// Middleware chain
app.use("/*", requestLogger);
app.use("/*", orgIdMiddleware);
app.use("/*", auditMiddleware);
app.use("/*", costTrackingMiddleware);

// Phase A routes (no AI)
app.route("/auth/status", authStatusRoute);
app.route("/atlassian/connection-health", atlassianConnectionHealthRoute);

// Phase B routes (external HTTP only)
app.route("/atlassian/oauth", atlassianOAuthRoute);

// Phase C routes (AI, no thinking)
app.route("/continuous-discovery", continuousDiscoveryRoute);
app.route("/refine-requirement", refineRequirementRoute);
app.route("/summarize-discovery", summarizeDiscoveryRoute);

// Phase D routes (AI + thinking tokens)
app.route("/decompose-task", decomposeTaskRoute);
app.route("/evaluate-risks", evaluateRisksRoute);
app.route("/evaluate-gate", evaluateGateRoute);
app.route("/plan-sprint", planSprintRoute);

// Phase E routes (AI + thinking, codebase analysis)
app.route("/analyze-codebase", analyzeCodebaseRoute);
app.route("/codebase-chat", codebaseChatRoute);
app.route("/analyze-requirement", analyzeRequirementRoute);
app.route("/analyze-task-subtasks", analyzeTaskSubtasksRoute);
app.route("/generate-team", generateTeamRoute);
app.route("/dispatch-agent", dispatchAgentRoute);
app.route("/plan-assignments", planAssignmentsRoute);

export { app };
