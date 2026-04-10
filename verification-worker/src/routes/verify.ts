import { Hono } from "hono";
import type { Env } from "../types";
import { generateNavigationPlan } from "../lib/ai-service";
import { executeBrowserVerification } from "../lib/browser";
import { reportResults, updateVerificationStatus } from "../lib/reporter";

export const verifyRoute = new Hono<{ Bindings: Env }>();

interface VerifyRequest {
  verificationId: string;
  taskId: string;
  programId: string;
  orgId: string;
  repoUrl?: string;
  branch?: string;
  commitSha?: string;
  githubToken?: string;
  taskTitle?: string;
  taskDescription?: string;
  requirementText?: string;
  gitDiff?: string;
  changedFiles?: string[];
  devServerCommand?: string;
  devServerPort?: number;
}

verifyRoute.post("/", async (c) => {
  const body = await c.req.json<VerifyRequest>();
  const env = c.env;
  const startedAt = Date.now();
  const proxyOrigin = new URL(c.req.url).origin;

  // Acknowledge receipt immediately
  const responsePromise = runVerification(env, body, startedAt, proxyOrigin);

  // Don't await — return 202 immediately and process in background
  c.executionCtx.waitUntil(responsePromise);

  return c.json({ ok: true, verificationId: body.verificationId }, 202);
});

async function runVerification(
  env: Env,
  body: VerifyRequest,
  startedAt: number,
  proxyOrigin: string
) {
  const containerId = env.VerificationContainer.idFromName(body.verificationId);
  const container = env.VerificationContainer.get(containerId) as any;

  try {
    // Update status: provisioning
    await updateVerificationStatus(env, body.verificationId, {
      status: "provisioning",
      startedAt,
    });

    if (!body.repoUrl) {
      throw new Error("Verification repoUrl is required");
    }
    if (!body.branch) {
      throw new Error("Verification branch is required");
    }

    const devServerPort = body.devServerPort ?? 3000;
    const devServerCommand =
      body.devServerCommand ??
      [
        "if [ -f bun.lock ]; then",
        `bun run dev -- --host 0.0.0.0 --port ${devServerPort} || bun run dev -- --hostname 0.0.0.0 --port ${devServerPort};`,
        "else",
        `npm run dev -- --host 0.0.0.0 --port ${devServerPort} || npm run dev -- --hostname 0.0.0.0 --port ${devServerPort};`,
        "fi",
      ].join(" ");

    await container.setup({
      repoUrl: body.repoUrl,
      branch: body.branch,
      githubToken: body.githubToken,
      devServerCommand,
      devServerPort,
    });

    const publicAppUrl = proxyOrigin;

    // Update status: running
    await updateVerificationStatus(env, body.verificationId, {
      status: "running",
    });

    // Generate AI navigation plan
    const plan = await generateNavigationPlan(env, {
      taskTitle: body.taskTitle ?? "Unknown task",
      taskDescription: body.taskDescription ?? "",
      requirementText: body.requirementText,
      gitDiff: body.gitDiff,
      changedFiles: body.changedFiles,
      baseUrl: publicAppUrl,
    });

    // Execute browser verification
    const results = await executeBrowserVerification(env, publicAppUrl, plan, {
      proxyOrigin,
      proxyHeaders: {
        "x-verification-id": body.verificationId,
        "x-verification-auth": env.VERIFICATION_API_SECRET,
      },
    });

    // Report results back to Convex
    await reportResults(env, {
      verificationId: body.verificationId,
      status: "completed",
      checks: results.checks,
      screenshots: results.screenshots,
      aiSummary: results.aiSummary,
      durationMs: Date.now() - startedAt,
    });
  } catch (err: any) {
    console.error("Verification failed:", err);
    await updateVerificationStatus(env, body.verificationId, {
      status: "failed",
      error: err.message ?? "Unknown error",
      durationMs: Date.now() - startedAt,
    });
  } finally {
    try {
      await container.cleanup();
    } catch (cleanupError) {
      console.error("Verification container cleanup failed:", cleanupError);
    }
  }
}
