"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internalAction } from "./_generated/server";
import { getProvider } from "./sourceControl/factory";

const internalAny: any = (generatedApi as any).internal;

function resolveDefaultDevServerPort() {
  const configuredPort = Number(process.env.VERIFICATION_DEV_SERVER_PORT ?? 3000);
  return Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 3000;
}

function buildDefaultDevServerCommand(port: number) {
  return [
    "if [ -f bun.lock ]; then",
    `bun run dev -- --host 0.0.0.0 --port ${port} || bun run dev -- --hostname 0.0.0.0 --port ${port};`,
    "else",
    `npm run dev -- --host 0.0.0.0 --port ${port} || npm run dev -- --hostname 0.0.0.0 --port ${port};`,
    "fi",
  ].join(" ");
}

async function getRepoAndToken(ctx: any, repositoryId: any) {
  const sourceControlInternal = internalAny.sourceControl;
  const { repo, installation } = await ctx.runQuery(
    sourceControlInternal.mcp.queries.getRepoWithInstallation,
    { repositoryId },
  );

  const provider = getProvider(repo.providerType);
  let token = await ctx.runQuery(sourceControlInternal.mcp.queries.getCachedToken, {
    installationId: installation.installationId,
  });

  if (!token) {
    const tokenResult = await provider.getInstallationToken(installation.installationId);
    token = tokenResult.token;
    await ctx.runMutation(sourceControlInternal.mcp.queries.upsertToken, {
      installationId: installation.installationId,
      token: tokenResult.token,
      expiresAt: tokenResult.expiresAt,
    });
  }

  return { repo, token };
}

export const triggerVerification = internalAction({
  args: {
    taskId: v.id("tasks"),
    sandboxSessionId: v.optional(v.id("sandboxSessions")),
    triggeredBy: v.id("users"),
    trigger: v.union(v.literal("automatic"), v.literal("manual")),
    commitSha: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    branch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internalAny.tasks.getInternal, {
      taskId: args.taskId,
    });
    if (!task) throw new ConvexError("Task not found");

    const session = args.sandboxSessionId
      ? await ctx.runQuery(internalAny.sandbox.sessions.getInternal, {
          sessionId: args.sandboxSessionId,
        })
      : await ctx.runQuery(internalAny.sandbox.sessions.getLatestForTaskInternal, {
          taskId: args.taskId,
        });

    const resolvedBranch = args.branch ?? session?.worktreeBranch ?? task.worktreeBranch;
    const resolvedCommitSha = args.commitSha ?? session?.commitSha;
    const resolvedPrUrl = args.prUrl ?? session?.prUrl;
    const resolvedPrNumber = args.prNumber ?? session?.prNumber;

    const verificationId = await ctx.runMutation(internalAny.taskVerifications.create, {
      orgId: task.orgId,
      programId: task.programId,
      taskId: args.taskId,
      sandboxSessionId: session?._id,
      triggeredBy: args.triggeredBy,
      trigger: args.trigger,
      status: "pending",
      commitSha: resolvedCommitSha,
      prUrl: resolvedPrUrl,
      prNumber: resolvedPrNumber,
      branch: resolvedBranch,
    });

    const workerUrl = process.env.VERIFICATION_WORKER_URL;
    const workerSecret = process.env.VERIFICATION_API_SECRET;
    if (!workerUrl || !workerSecret) {
      await ctx.runMutation(internalAny.taskVerifications.updateStatus, {
        verificationId,
        status: "failed",
        error: "Verification worker not configured",
      });
      return;
    }

    try {
      if (!session) {
        await ctx.runMutation(internalAny.taskVerifications.updateStatus, {
          verificationId,
          status: "failed",
          error: "No sandbox session available for verification",
        });
        return;
      }

      if (session.taskId !== args.taskId) {
        await ctx.runMutation(internalAny.taskVerifications.updateStatus, {
          verificationId,
          status: "failed",
          error: "Sandbox session does not belong to the requested task",
        });
        return;
      }

      if (!session.repositoryId) {
        await ctx.runMutation(internalAny.taskVerifications.updateStatus, {
          verificationId,
          status: "failed",
          error: "Sandbox session is missing repository metadata",
        });
        return;
      }

      const { repo, token } = await getRepoAndToken(ctx, session.repositoryId);
      const requirement = task.requirementId
        ? await ctx.runQuery(internalAny.requirements.getById, {
            requirementId: task.requirementId,
          })
        : null;
      const devServerPort = resolveDefaultDevServerPort();
      const devServerCommand =
        process.env.VERIFICATION_DEV_SERVER_COMMAND ?? buildDefaultDevServerCommand(devServerPort);

      const response = await fetch(`${workerUrl}/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${workerSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verificationId: String(verificationId),
          taskId: String(args.taskId),
          programId: String(task.programId),
          orgId: task.orgId,
          repoUrl: repo.repoFullName,
          branch: resolvedBranch ?? repo.defaultBranch,
          commitSha: resolvedCommitSha,
          githubToken: token,
          taskTitle: task.title,
          taskDescription: task.description,
          requirementText: requirement?.description ?? requirement?.title ?? undefined,
          devServerCommand,
          devServerPort,
        }),
      });

      if (!response.ok) {
        await ctx.runMutation(internalAny.taskVerifications.updateStatus, {
          verificationId,
          status: "failed",
          error: `Worker returned ${response.status}: ${await response.text()}`,
        });
      }
    } catch (err: any) {
      await ctx.runMutation(internalAny.taskVerifications.updateStatus, {
        verificationId,
        status: "failed",
        error: `Worker unreachable: ${err.message}`,
      });
    }
  },
});
