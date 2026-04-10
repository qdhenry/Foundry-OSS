"use client";

import { AgentAvatar } from "../agents/AgentAvatar";

interface AgentRunCardProps {
  agent: any;
  executions: any[];
  runStatus: string;
  totalAssigned?: number;
  onPause?: () => void;
  onResume?: () => void;
}

export function AgentRunCard({
  agent,
  executions,
  runStatus,
  totalAssigned,
  onPause,
  onResume,
}: AgentRunCardProps) {
  const agentExecs = executions.filter((e: any) => e.agentId === agent._id);
  const currentExec = agentExecs.find((e: any) => e.status === "running");
  const completedCount = agentExecs.filter((e: any) => e.status === "success").length;
  const displayTotal = totalAssigned ?? agentExecs.length;
  const totalTokens = agentExecs.reduce(
    (sum: number, e: any) => sum + (e.tokensUsed?.total ?? 0),
    0,
  );

  const isPaused = agent.status === "paused";
  const isRunActive = runStatus === "running" || runStatus === "paused";

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4">
      <div className="flex items-center gap-3">
        <AgentAvatar seed={agent.avatarSeed ?? agent._id} name={agent.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-heading">{agent.name}</p>
          {agent.role && (
            <span className="inline-flex rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary">
              {agent.role}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-surface-subtle px-3 py-2">
        {currentExec ? (
          <div>
            <p className="truncate text-xs font-medium text-text-primary">
              {currentExec.taskName ?? currentExec.skillName ?? "Executing..."}
            </p>
            <span className="inline-flex animate-pulse rounded-full bg-status-success-bg px-1.5 py-0.5 text-[10px] font-medium text-status-success-fg">
              Running
            </span>
          </div>
        ) : (
          <p className="text-xs text-text-muted">Idle</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
        <span>
          {completedCount}/{displayTotal} tasks
        </span>
        <span>{totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k tokens` : "--"}</span>
      </div>

      {isRunActive && (
        <div className="mt-3 flex gap-2">
          {isPaused ? (
            <button type="button" className="btn-secondary btn-xs flex-1" onClick={onResume}>
              Resume
            </button>
          ) : (
            <button type="button" className="btn-secondary btn-xs flex-1" onClick={onPause}>
              Pause
            </button>
          )}
        </div>
      )}
    </div>
  );
}
