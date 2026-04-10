import express from "express";
import { clearApiKey, detectAuthStatus, setApiKey } from "./lib/auth-detector.js";
import { auditMiddleware } from "./middleware/audit.js";
import { costTrackingMiddleware } from "./middleware/cost-tracking.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { analyzeCodebaseRouter } from "./routes/analyze-codebase.js";
import { analyzeRequirementRouter } from "./routes/analyze-requirement.js";
import { analyzeTaskSubtasksRouter } from "./routes/analyze-task-subtasks.js";
import { atlassianConnectionHealthRouter } from "./routes/atlassian-connection-health.js";
import { atlassianOAuthRouter } from "./routes/atlassian-oauth.js";
import { codebaseChatRouter } from "./routes/codebase-chat.js";
import { continuousDiscoveryRouter } from "./routes/continuous-discovery.js";
import { decomposeTaskRouter } from "./routes/decompose-task.js";
import { dispatchAgentRouter } from "./routes/dispatch-agent.js";
import { embedRouter } from "./routes/embed.js";
import { evaluateGateRouter } from "./routes/evaluate-gate.js";
import { evaluateRisksRouter } from "./routes/evaluate-risks.js";
import { generateTeamRouter } from "./routes/generate-team.js";
import { planAssignmentsRouter } from "./routes/plan-assignments.js";
import { planSprintRouter } from "./routes/plan-sprint.js";
import { refineRequirementRouter } from "./routes/refine-requirement.js";
import { summarizeDiscoveryRouter } from "./routes/summarize-discovery.js";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

// Auth routes — mounted before audit middleware (no x-org-id required)
app.get("/auth/status", async (_req, res) => {
  const status = await detectAuthStatus();
  res.json(status);
});

app.post("/auth/api-key", async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey || typeof apiKey !== "string") {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }
  if (!apiKey.startsWith("sk-ant-")) {
    res.status(400).json({ error: "Invalid API key format. Expected prefix: sk-ant-" });
    return;
  }
  await setApiKey(apiKey);
  const status = await detectAuthStatus();
  res.json(status);
});

app.delete("/auth/api-key", async (_req, res) => {
  await clearApiKey();
  const status = await detectAuthStatus();
  res.json(status);
});

app.use(auditMiddleware);
app.use(costTrackingMiddleware);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/continuous-discovery", continuousDiscoveryRouter);
app.use("/refine-requirement", refineRequirementRouter);
app.use("/decompose-task", decomposeTaskRouter);
app.use("/plan-sprint", planSprintRouter);
app.use("/evaluate-risks", evaluateRisksRouter);
app.use("/evaluate-gate", evaluateGateRouter);
app.use("/summarize-discovery", summarizeDiscoveryRouter);
app.use("/atlassian/oauth", atlassianOAuthRouter);
app.use("/atlassian/connection-health", atlassianConnectionHealthRouter);
app.use("/analyze-codebase", analyzeCodebaseRouter);
app.use("/codebase-chat", codebaseChatRouter);
app.use("/analyze-requirement", analyzeRequirementRouter);
app.use("/analyze-task-subtasks", analyzeTaskSubtasksRouter);
app.use("/embed", embedRouter);
app.use("/generate-team", generateTeamRouter);
app.use("/dispatch-agent", dispatchAgentRouter);
app.use("/plan-assignments", planAssignmentsRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3001;

async function startServer() {
  const status = await detectAuthStatus();
  if (status.source === "manual_config" || status.source === "env_var") {
    console.log(
      `[auth] API key configured (source: ${status.source}, prefix: ${status.apiKeyPrefix})`,
    );
  } else if (status.source === "claude_code_oauth") {
    console.log(`[auth] Claude Code detected (${status.claudeCodeEmail}) - SDK will use OAuth`);
  } else {
    console.log(
      `[auth] No API key configured. Set via POST /auth/api-key or ANTHROPIC_API_KEY env var.`,
    );
  }

  app.listen(PORT, () => {
    console.log(`Agent service listening on port ${PORT}`);
  });
}

startServer();

export { app };
