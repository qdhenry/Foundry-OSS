"use node";

import { ConvexError, v } from "convex/values";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api, internal } = require("../_generated/api") as { api: any; internal: any };

import { action } from "../_generated/server";
import { getProvider } from "../sourceControl/factory";

// ── Types ───────────────────────────────────────────────────────────────────

interface AgentStats {
  agentId: string;
  agentName: string;
  tasksAttempted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  tokensUsed: number;
  cost: number;
  durationMs: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

interface RiskNote {
  taskName: string;
  agentId: string;
  error: string;
}

interface RunReport {
  perAgent: AgentStats[];
  prUrls: string[];
  branches: Array<{ repoName: string; branchName: string }>;
  totalDurationMs: number;
  totalTokensUsed: number;
  totalCost: number;
  riskNotes: RiskNote[];
  generatedAt: number;
}

// ── Generate Report ─────────────────────────────────────────────────────────

export const generateReport = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    runId: v.id("orchestrationRuns"),
  },
  handler: async (ctx, args): Promise<RunReport> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    // Fetch the orchestration run
    const run = await (ctx.runQuery as any)(api.orchestration.runs.get, {
      runId: args.runId,
    });
    if (!run) {
      throw new ConvexError("Orchestration run not found");
    }

    // Fetch executions for this program, then filter by orchestrationRunId
    const allExecutions: any[] = await (ctx.runQuery as any)(
      api.agentTeam.executions.listByProgram,
      { programId: args.programId },
    );
    const executions = allExecutions.filter((e: any) => e.orchestrationRunId === args.runId);

    // Group executions by agentId and compute per-agent stats
    const agentMap = new Map<string, { executions: any[]; name: string }>();
    for (const exec of executions) {
      const agentId = exec.agentId as string;
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, { executions: [], name: agentId });
      }
      agentMap.get(agentId)!.executions.push(exec);
    }

    // Try to resolve agent names
    for (const [agentId, data] of agentMap) {
      try {
        const agent = await (ctx.runQuery as any)(api.agentTeam.agents.get, {
          agentId,
        });
        if (agent?.name) {
          data.name = agent.name;
        }
      } catch {
        // Agent lookup failed, keep ID as name
      }
    }

    const perAgent: AgentStats[] = [];
    const riskNotes: RiskNote[] = [];
    let totalDurationMs = 0;
    let totalTokensUsed = 0;
    let totalCost = 0;

    for (const [agentId, data] of agentMap) {
      const agentExecs = data.executions;
      const succeeded = agentExecs.filter((e: any) => e.status === "success");
      const failed = agentExecs.filter((e: any) => e.status === "failed");

      const agentTokens = agentExecs.reduce(
        (sum: number, e: any) => sum + (e.tokensUsed?.total ?? 0),
        0,
      );
      const agentCost = agentExecs.reduce((sum: number, e: any) => sum + (e.cost ?? 0), 0);
      const agentDuration = agentExecs.reduce(
        (sum: number, e: any) => sum + (e.durationMs ?? 0),
        0,
      );

      perAgent.push({
        agentId,
        agentName: data.name,
        tasksAttempted: agentExecs.length,
        tasksSucceeded: succeeded.length,
        tasksFailed: failed.length,
        tokensUsed: agentTokens,
        cost: agentCost,
        durationMs: agentDuration,
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
      });

      totalTokensUsed += agentTokens;
      totalCost += agentCost;
      totalDurationMs += agentDuration;

      // Collect risk notes from failed executions
      for (const exec of failed) {
        riskNotes.push({
          taskName: exec.inputSummary ?? "Unknown task",
          agentId,
          error: exec.errorDetails ?? "No error details available",
        });
      }
    }

    const report: RunReport = {
      perAgent,
      prUrls: [],
      branches: [],
      totalDurationMs,
      totalTokensUsed,
      totalCost,
      riskNotes,
      generatedAt: Date.now(),
    };

    // Persist report on the run document
    await (ctx.runMutation as any)(internal.orchestration.runs.setReport, {
      runId: args.runId,
      report,
    });

    // Log completion event
    await (ctx.runMutation as any)(internal.orchestration.events.createInternal, {
      orgId: args.orgId,
      runId: args.runId,
      type: "run_completed",
      message: `Run report generated: ${perAgent.length} agents, ${executions.length} tasks, ${riskNotes.length} failures`,
      metadata: {
        totalTokensUsed,
        totalCost,
        totalDurationMs,
        agentCount: perAgent.length,
        taskCount: executions.length,
        failureCount: riskNotes.length,
      },
    });

    // Create notification for run completion
    await (ctx.runMutation as any)(internal.agentTeam.notifications.createInternal, {
      orgId: args.orgId,
      programId: args.programId,
      type: "sprint_complete",
      severity: riskNotes.length > 0 ? "warning" : "info",
      title: `Orchestration run "${run.name}" completed`,
      message: `${executions.length} tasks executed across ${perAgent.length} agents. ${riskNotes.length} failures.`,
      channels: ["in_app"],
    });

    return report;
  },
});

// ── Create PRs ──────────────────────────────────────────────────────────────

export const createPRs = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    runId: v.id("orchestrationRuns"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ prUrls: string[]; branches: Array<{ repoName: string; branchName: string }> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    // Fetch the orchestration run
    const run = await (ctx.runQuery as any)(api.orchestration.runs.get, {
      runId: args.runId,
    });
    if (!run) {
      throw new ConvexError("Orchestration run not found");
    }

    const executionPlan = run.executionPlan;
    if (!executionPlan) {
      return { prUrls: [], branches: [] };
    }

    const repositoryIds: string[] = run.repositoryIds ?? [];
    if (repositoryIds.length === 0) {
      return { prUrls: [], branches: [] };
    }

    // Collect unique branch names from execution plan task assignments
    const branchNames = new Set<string>();
    const waves = executionPlan.waves ?? executionPlan.tasks ?? [];
    for (const wave of Array.isArray(waves) ? waves : []) {
      const assignments = wave.assignments ?? wave.tasks ?? (Array.isArray(wave) ? wave : []);
      for (const assignment of Array.isArray(assignments) ? assignments : []) {
        if (assignment.branchName) {
          branchNames.add(assignment.branchName);
        }
        if (assignment.branch) {
          branchNames.add(assignment.branch);
        }
      }
    }

    // If no branch names found, derive from branch strategy
    if (branchNames.size === 0 && run.branchPattern) {
      branchNames.add(run.branchPattern);
    }

    const prUrls: string[] = [];
    const branches: Array<{ repoName: string; branchName: string }> = [];

    // Resolve repository details
    const repos: any[] = [];
    for (const repoId of repositoryIds) {
      try {
        const repo = await (ctx.runQuery as any)(
          internal.sourceControl.repositories.getByIdInternal,
          { repositoryId: repoId },
        );
        if (repo) {
          repos.push(repo);
        }
      } catch {
        // Repository lookup failed, skip
      }
    }

    // Attempt PR creation for each repo + branch combination
    for (const repo of repos) {
      for (const branchName of branchNames) {
        // Always record the branch for manual fallback
        branches.push({
          repoName: repo.repoFullName ?? repo.name ?? "unknown",
          branchName,
        });

        // Try to create a PR via GitHub provider
        try {
          // Get installation for this repo
          const installation = await (ctx.runQuery as any)(
            internal.sourceControl.mcp.queries.getRepoWithInstallation,
            { repositoryId: repo._id },
          );

          if (!installation?.installation) {
            // Log that PR creation was skipped — no installation
            await (ctx.runMutation as any)(internal.orchestration.events.createInternal, {
              orgId: args.orgId,
              runId: args.runId,
              type: "pr_created",
              message: `PR creation skipped for ${repo.repoFullName}/${branchName}: no GitHub installation`,
              metadata: { repoName: repo.repoFullName, branchName, skipped: true },
            });
            continue;
          }

          const provider = getProvider(repo.providerType ?? "github");

          // Get installation token
          let token = await (ctx.runQuery as any)(
            internal.sourceControl.mcp.queries.getCachedToken,
            { installationId: installation.installation.installationId },
          );

          if (!token) {
            const tokenResult = await (provider as any).getInstallationToken(
              installation.installation.installationId,
            );
            token = tokenResult.token;
            await (ctx.runMutation as any)(internal.sourceControl.mcp.queries.upsertToken, {
              installationId: installation.installation.installationId,
              token: tokenResult.token,
              expiresAt: tokenResult.expiresAt,
            });
          }

          (provider as any).setToken(token);

          // Create the PR
          const title = `[Foundry] ${run.name} — ${branchName}`;
          const body = [
            `## Automated PR from Foundry Orchestration`,
            ``,
            `**Run:** ${run.name}`,
            `**Branch:** ${branchName}`,
            `**Target:** ${run.targetBranch}`,
            ``,
            `This pull request was created automatically by the Foundry orchestration engine.`,
          ].join("\n");

          const pr = await (provider as any).createPullRequest(
            repo.repoFullName,
            branchName,
            run.targetBranch,
            title,
            body,
            true, // draft
          );

          if (pr?.url || pr?.htmlUrl) {
            prUrls.push(pr.url ?? pr.htmlUrl);
          }

          // Log PR creation event
          await (ctx.runMutation as any)(internal.orchestration.events.createInternal, {
            orgId: args.orgId,
            runId: args.runId,
            type: "pr_created",
            message: `PR created for ${repo.repoFullName}: ${branchName} → ${run.targetBranch}`,
            metadata: {
              repoName: repo.repoFullName,
              branchName,
              targetBranch: run.targetBranch,
              prUrl: pr?.url ?? pr?.htmlUrl,
              prNumber: pr?.number,
            },
          });

          // Create notification for PR
          await (ctx.runMutation as any)(internal.agentTeam.notifications.createInternal, {
            orgId: args.orgId,
            programId: args.programId,
            type: "pr_created",
            severity: "info",
            title: `PR created: ${branchName}`,
            message: `Pull request created for ${repo.repoFullName}: ${branchName} → ${run.targetBranch}`,
            channels: ["in_app"],
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error ?? "Unknown error");

          // Log failure but don't throw — PR creation is best-effort
          await (ctx.runMutation as any)(internal.orchestration.events.createInternal, {
            orgId: args.orgId,
            runId: args.runId,
            type: "pr_created",
            message: `PR creation failed for ${repo.repoFullName}/${branchName}: ${errorMessage}`,
            metadata: {
              repoName: repo.repoFullName,
              branchName,
              error: errorMessage,
              skipped: true,
            },
          });
        }
      }
    }

    // Update the report with PR URLs and branch info
    const existingReport = run.report ?? {};
    const updatedReport = {
      ...existingReport,
      prUrls,
      branches,
    };

    await (ctx.runMutation as any)(internal.orchestration.runs.setReport, {
      runId: args.runId,
      report: updatedReport,
    });

    return { prUrls, branches };
  },
});
