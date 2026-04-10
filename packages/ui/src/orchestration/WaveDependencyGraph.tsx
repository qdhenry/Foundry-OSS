"use client";

interface TaskAssignment {
  taskId: string;
  taskTitle?: string;
  agentId?: string;
  agentName?: string;
  mode: "sandbox" | "sdk";
  estimatedTokens?: number;
}

interface Wave {
  wave: number;
  taskAssignments?: TaskAssignment[];
}

interface WaveDependencyGraphProps {
  waves: Wave[];
}

// 8-color palette for agent differentiation (blue/slate spectrum, no purple)
const AGENT_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200",
  "bg-sky-100 border-sky-300 text-sky-800 dark:bg-sky-900 dark:border-sky-700 dark:text-sky-200",
  "bg-teal-100 border-teal-300 text-teal-800 dark:bg-teal-900 dark:border-teal-700 dark:text-teal-200",
  "bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200",
  "bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-900 dark:border-cyan-700 dark:text-cyan-200",
  "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900 dark:border-emerald-700 dark:text-emerald-200",
  "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900 dark:border-amber-700 dark:text-amber-200",
  "bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-900 dark:border-rose-700 dark:text-rose-200",
];

function hashToIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % AGENT_COLORS.length;
}

function getAgentColor(agentId?: string): string {
  if (!agentId) return AGENT_COLORS[3]; // slate for unassigned
  return AGENT_COLORS[hashToIndex(agentId)];
}

export function WaveDependencyGraph({ waves }: WaveDependencyGraphProps) {
  if (waves.length === 0) {
    return <p className="text-sm text-text-muted">No waves to display.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        <span>Execution flows top to bottom. Tasks in the same wave run in parallel.</span>
      </div>

      {waves.map((wave, wIdx) => {
        const tasks = wave.taskAssignments ?? [];
        return (
          <div key={wave.wave}>
            {/* Connector between waves */}
            {wIdx > 0 && (
              <div className="flex justify-center py-1">
                <div className="h-4 w-px bg-border-default" />
              </div>
            )}

            {/* Wave lane */}
            <div className="rounded-lg border border-border-default bg-surface-default">
              <div className="flex items-center gap-2 border-b border-border-default px-3 py-1.5">
                <span className="text-xs font-semibold text-text-heading">Wave {wave.wave}</span>
                <span className="text-xs text-text-muted">
                  {tasks.length} task{tasks.length !== 1 ? "s" : ""} (parallel)
                </span>
              </div>
              <div className="flex flex-wrap gap-2 p-3">
                {tasks.length === 0 ? (
                  <span className="text-xs text-text-muted">No tasks</span>
                ) : (
                  tasks.map((task, tIdx) => (
                    <div
                      key={task.taskId ?? tIdx}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${getAgentColor(task.agentId)}`}
                    >
                      {/* Agent dot */}
                      <div
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor: task.agentId
                            ? `hsl(${Math.abs(hashToIndex(task.agentId)) * 45}, 60%, 50%)`
                            : "#94a3b8",
                        }}
                        title={task.agentName ?? "Unassigned"}
                      />
                      <span className="font-medium">{task.taskTitle ?? `Task ${tIdx + 1}`}</span>
                      {/* Mode icon */}
                      {task.mode === "sandbox" ? (
                        <svg
                          className="h-3 w-3 opacity-70"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-label="Sandbox"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-3 w-3 opacity-70"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-label="SDK"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
