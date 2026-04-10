"use client";

import { RunStatusBadge } from "./RunStatusBadge";

interface RunTaskListProps {
  waves: any[];
  executions: any[];
  agents: any[];
}

function formatDuration(startMs?: number, endMs?: number): string {
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

interface TaskRow {
  wave: number;
  taskName: string;
  agentName: string;
  mode: string;
  status: string;
  startedAt?: number;
  completedAt?: number;
  tokensUsed?: number;
}

export function RunTaskList({ waves, executions, agents }: RunTaskListProps) {
  const agentMap = new Map<string, string>();
  for (const a of agents) {
    agentMap.set(a._id, a.name ?? a.role ?? "Agent");
  }

  const rows: TaskRow[] = [];

  if (waves && waves.length > 0) {
    for (const wave of waves) {
      const waveNum = wave.waveNumber ?? wave.wave ?? wave.order ?? 0;
      const tasks = wave.taskAssignments ?? wave.tasks ?? wave.items ?? [];
      for (const task of tasks) {
        const exec = executions.find((e: any) => e.taskId === task.taskId);
        rows.push({
          wave: waveNum,
          taskName: task.branchName ?? task.taskId ?? "Unnamed task",
          agentName: agentMap.get(task.agentId) ?? task.agentName ?? "--",
          mode: task.executionMode ?? task.mode ?? "sdk",
          status: exec?.status ?? "pending",
          startedAt: exec?.startedAt ?? exec?._creationTime,
          completedAt: exec?.completedAt,
          tokensUsed: exec?.tokensUsed?.total ?? exec?.tokensUsed,
        });
      }
    }
  } else if (executions.length > 0) {
    for (const exec of executions) {
      rows.push({
        wave: 0,
        taskName: exec.inputSummary ?? exec.taskName ?? "Task",
        agentName: agentMap.get(exec.agentId) ?? "--",
        mode: exec.executionMode ?? "sdk",
        status: exec.status ?? "pending",
        startedAt: exec._creationTime,
        completedAt: exec.completedAt,
        tokensUsed: exec.tokensUsed?.total ?? exec.tokensUsed,
      });
    }
  }

  rows.sort((a, b) => a.wave - b.wave);

  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-text-muted">No tasks in this run.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border-default">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default bg-surface-subtle">
            <th className="px-3 py-2 text-left font-medium text-text-secondary">Wave</th>
            <th className="px-3 py-2 text-left font-medium text-text-secondary">Task</th>
            <th className="hidden px-3 py-2 text-left font-medium text-text-secondary md:table-cell">
              Agent
            </th>
            <th className="hidden px-3 py-2 text-left font-medium text-text-secondary sm:table-cell">
              Mode
            </th>
            <th className="px-3 py-2 text-left font-medium text-text-secondary">Status</th>
            <th className="hidden px-3 py-2 text-right font-medium text-text-secondary md:table-cell">
              Duration
            </th>
            <th className="hidden px-3 py-2 text-right font-medium text-text-secondary lg:table-cell">
              Tokens
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.wave}-${row.taskName}-${i}`}
              className="border-b border-border-default last:border-b-0"
            >
              <td className="px-3 py-2">
                <span className="inline-flex rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
                  W{row.wave}
                </span>
              </td>
              <td className="max-w-[200px] truncate px-3 py-2 font-medium text-text-primary">
                {row.taskName}
              </td>
              <td className="hidden px-3 py-2 text-text-secondary md:table-cell">
                {row.agentName}
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <span className="text-text-muted" title={row.mode}>
                  {row.mode === "sandbox" ? "\u{1F4BB}" : "\u{2699}\uFE0F"}
                </span>
              </td>
              <td className="px-3 py-2">
                <RunStatusBadge status={row.status} />
              </td>
              <td className="hidden px-3 py-2 text-right text-text-secondary md:table-cell">
                {formatDuration(row.startedAt, row.completedAt)}
              </td>
              <td className="hidden px-3 py-2 text-right text-text-secondary lg:table-cell">
                {row.tokensUsed ? row.tokensUsed.toLocaleString() : "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
