"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AgentRunCard } from "./AgentRunCard";
import { RunActivityFeed } from "./RunActivityFeed";
import { RunControlBar } from "./RunControlBar";
import { RunStatusBadge } from "./RunStatusBadge";
import { RunTaskList } from "./RunTaskList";

function formatElapsed(startMs?: number, endMs?: number): string {
  if (!startMs) return "--";
  const end = endMs ?? Date.now();
  const seconds = Math.floor((end - startMs) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatCost(cost?: number): string {
  if (!cost) return "--";
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

export function OrchestrationRunDetail({ programId, runId }: { programId: string; runId: string }) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const run = useQuery("orchestration/runs:get" as any, { runId: runId as any });
  const events = useQuery("orchestration/events:listByRun" as any, { runId: runId as any });
  const agents = useQuery("agentTeam/agents:listByProgram" as any, {
    programId: programId as any,
  });
  const allExecutions = useQuery("agentTeam/executions:listByProgram" as any, {
    programId: programId as any,
  });

  const executions = (allExecutions ?? []).filter((e: any) => e.orchestrationRunId === runId);

  const [activeTab, setActiveTab] = useState<"tasks" | "activity">("tasks");
  const [elapsed, setElapsed] = useState("--");

  // Tick elapsed time while running
  useEffect(() => {
    if (!run?.startedAt) return;
    if (
      run.completedAt ||
      run.status === "completed" ||
      run.status === "failed" ||
      run.status === "cancelled"
    ) {
      setElapsed(formatElapsed(run.startedAt, run.completedAt));
      return;
    }
    setElapsed(formatElapsed(run.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(run.startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [run?.startedAt, run?.completedAt, run?.status]);

  if (run === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-12 animate-pulse rounded-lg bg-surface-elevated" />
        <div className="h-64 animate-pulse rounded-lg bg-surface-elevated" />
      </div>
    );
  }

  if (run === null) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default px-6 py-12 text-center">
        <h3 className="text-lg font-medium text-text-heading">Run not found</h3>
        <p className="mt-1 text-sm text-text-secondary">
          This orchestration run may have been deleted.
        </p>
        <Link
          href={`/${programId}/orchestration`}
          className="mt-4 inline-block text-sm font-medium text-interactive-primary hover:underline"
        >
          Back to runs
        </Link>
      </div>
    );
  }

  const status = run.status ?? "draft";
  const isActive = status === "running" || status === "paused";
  const isCompleted = status === "completed";
  const tokensUsed = run.tokensUsed ?? 0;
  const tokenBudget = run.tokenBudget ?? run.maxTokens ?? 0;
  const tokenPct = tokenBudget > 0 ? Math.min((tokensUsed / tokenBudget) * 100, 100) : 0;

  // Derive agent IDs and per-agent assignment counts from the execution plan
  const planAgentIds = new Set<string>();
  const agentAssignmentCounts = new Map<string, number>();
  const waves = run.executionPlan?.waves ?? [];
  for (const wave of waves) {
    for (const assignment of wave.taskAssignments ?? []) {
      if (assignment.agentId) {
        planAgentIds.add(assignment.agentId);
        agentAssignmentCounts.set(
          assignment.agentId,
          (agentAssignmentCounts.get(assignment.agentId) ?? 0) + 1,
        );
      }
    }
  }
  const execAgentIds = new Set(executions.map((e: any) => e.agentId).filter(Boolean));
  const allAgentIds = new Set([...planAgentIds, ...execAgentIds]);
  const runAgents = (agents ?? []).filter((a: any) => allAgentIds.has(a._id));

  // Per-agent token breakdown
  const agentTokenBreakdown = new Map<string, { name: string; tokens: number; cost: number }>();
  for (const exec of executions) {
    if (!exec.agentId) continue;
    const existing = agentTokenBreakdown.get(exec.agentId) ?? { name: "", tokens: 0, cost: 0 };
    existing.tokens += exec.tokensUsed?.total ?? 0;
    existing.cost += exec.cost ?? 0;
    agentTokenBreakdown.set(exec.agentId, existing);
  }
  for (const agent of runAgents) {
    const entry = agentTokenBreakdown.get(agent._id);
    if (entry) entry.name = agent.name;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${programId}/orchestration`}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            &larr; Runs
          </Link>
          <h1 className="text-2xl font-semibold text-text-heading">{run.name ?? "Unnamed Run"}</h1>
          <RunStatusBadge status={status} />
        </div>

        <div className="flex items-center gap-4 text-sm text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Elapsed:</span>
            <span className="font-medium text-text-primary">{elapsed}</span>
          </div>

          {tokenBudget > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Tokens:</span>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${tokenPct}%` }}
                />
              </div>
              <span className="text-xs">
                {tokensUsed.toLocaleString()} / {tokenBudget.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-text-muted">Cost:</span>
            <span className="font-medium text-text-primary">{formatCost(run.totalCost)}</span>
          </div>
        </div>
      </div>

      {/* Control bar */}
      {isActive && <RunControlBar runId={runId} runStatus={status} />}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Agent cards */}
        <div className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-text-heading">Agents</h2>
          {runAgents.length === 0 ? (
            <div className="rounded-xl border border-border-default bg-surface-default p-4 text-center text-sm text-text-muted">
              No agents assigned
            </div>
          ) : (
            <div className="space-y-3">
              {runAgents.map((agent: any) => (
                <AgentRunCard
                  key={agent._id}
                  agent={agent}
                  executions={executions}
                  runStatus={status}
                  totalAssigned={agentAssignmentCounts.get(agent._id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Tasks + Activity tabs */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex gap-1 border-b border-border-default">
            <button
              type="button"
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "tasks"
                  ? "border-b-2 border-accent-default text-accent-default"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setActiveTab("tasks")}
            >
              Tasks
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "activity"
                  ? "border-b-2 border-accent-default text-accent-default"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setActiveTab("activity")}
            >
              Activity
              {events && events.length > 0 && (
                <span className="ml-1.5 rounded-full bg-surface-elevated px-1.5 py-0.5 text-xs">
                  {events.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "tasks" && (
            <RunTaskList waves={waves} executions={executions} agents={agents ?? []} />
          )}
          {activeTab === "activity" && <RunActivityFeed events={events ?? []} />}
        </div>
      </div>

      {/* Completed report */}
      {isCompleted && (
        <div className="rounded-xl border border-border-default bg-surface-default p-6">
          <h2 className="text-lg font-semibold text-text-heading">Run Summary</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-text-muted">Tasks Completed</p>
              <p className="text-xl font-semibold text-text-heading">
                {executions.filter((e: any) => e.status === "success").length}/{executions.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Tokens</p>
              <p className="text-xl font-semibold text-text-heading">
                {tokensUsed.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Cost</p>
              <p className="text-xl font-semibold text-text-heading">{formatCost(run.totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Duration</p>
              <p className="text-xl font-semibold text-text-heading">{elapsed}</p>
            </div>
          </div>

          {agentTokenBreakdown.size > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-text-muted">Per-Agent Usage</p>
              <div className="mt-1 space-y-1">
                {Array.from(agentTokenBreakdown.entries()).map(([agentId, data]) => (
                  <div
                    key={agentId}
                    className="flex items-center justify-between text-xs text-text-secondary"
                  >
                    <span className="truncate font-medium text-text-primary">
                      {data.name || "Unknown Agent"}
                    </span>
                    <span>
                      {data.tokens.toLocaleString()} tokens{" "}
                      {data.cost > 0 && `(${formatCost(data.cost)})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {run.pullRequestUrls && run.pullRequestUrls.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-text-muted">Pull Requests</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {run.pullRequestUrls.map((url: string, i: number) => (
                  <a
                    key={`pr-${i}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-interactive-primary hover:underline"
                  >
                    PR #{i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}

          {run.riskNotes && (
            <div className="mt-4">
              <p className="text-xs font-medium text-text-muted">Risk Notes</p>
              <p className="mt-1 text-sm text-text-secondary">{run.riskNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
