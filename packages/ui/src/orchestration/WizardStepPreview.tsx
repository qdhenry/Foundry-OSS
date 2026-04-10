"use client";

interface TaskAssignment {
  taskId: string;
  taskTitle?: string;
  agentId?: string;
  agentName?: string;
  mode: "sandbox" | "sdk";
  branch?: string;
  confidence?: number;
  estimatedTokens?: number;
  wave?: number;
}

interface ExecutionPlan {
  waves?: Array<{
    wave: number;
    taskAssignments?: TaskAssignment[];
  }>;
  assignments?: TaskAssignment[];
}

interface WizardStepPreviewProps {
  executionPlan: ExecutionPlan | null;
  tokenBudget: number;
  onTokenBudgetChange: (value: number) => void;
  branchStrategy: string;
  targetBranch: string;
  scopeName: string;
  maxConcurrency: number;
}

function getWaves(plan: ExecutionPlan | null): Array<{ wave: number; tasks: TaskAssignment[] }> {
  if (!plan) return [];
  if (plan.waves && Array.isArray(plan.waves)) {
    return plan.waves.map((w) => ({
      wave: w.wave,
      tasks: w.taskAssignments ?? [],
    }));
  }
  if (plan.assignments && Array.isArray(plan.assignments)) {
    const grouped = new Map<number, TaskAssignment[]>();
    for (const a of plan.assignments) {
      const w = a.wave ?? 1;
      if (!grouped.has(w)) grouped.set(w, []);
      grouped.get(w)!.push(a);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([wave, tasks]) => ({ wave, tasks }));
  }
  return [];
}

function estimateTokenCost(tokens: number): string {
  // Rough estimate: $3 per 1M input tokens (Sonnet-class pricing)
  const cost = (tokens / 1_000_000) * 3;
  return cost < 0.01 ? "<$0.01" : `$${cost.toFixed(2)}`;
}

export function WizardStepPreview({
  executionPlan,
  tokenBudget,
  onTokenBudgetChange,
  branchStrategy,
  targetBranch,
  scopeName,
  maxConcurrency,
}: WizardStepPreviewProps) {
  const waves = getWaves(executionPlan);
  const allTasks = waves.flatMap((w) => w.tasks);

  // Aggregate by agent
  const agentSummary = new Map<string, { name: string; taskCount: number; tokens: number }>();
  for (const task of allTasks) {
    const key = task.agentId ?? "unassigned";
    const existing = agentSummary.get(key) ?? {
      name: task.agentName ?? "Unassigned",
      taskCount: 0,
      tokens: 0,
    };
    existing.taskCount += 1;
    existing.tokens += task.estimatedTokens ?? 50000;
    agentSummary.set(key, existing);
  }

  const totalEstTokens = Array.from(agentSummary.values()).reduce((s, a) => s + a.tokens, 0);
  const overBudget = totalEstTokens > tokenBudget;

  // Collect branch names
  const branches = new Set<string>();
  for (const task of allTasks) {
    if (task.branch) branches.add(task.branch);
  }

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="rounded-lg border border-border-default bg-surface-subtle p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-muted">Run</dt>
            <dd className="font-medium text-text-heading">{scopeName || "Unnamed"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Tasks</dt>
            <dd className="font-medium text-text-heading">{allTasks.length}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Waves</dt>
            <dd className="font-medium text-text-heading">{waves.length}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Concurrency</dt>
            <dd className="font-medium text-text-heading">{maxConcurrency}</dd>
          </div>
        </dl>
      </div>

      {/* Wave breakdown */}
      <div>
        <h4 className="mb-3 font-medium text-text-heading">Wave Breakdown</h4>
        {waves.length === 0 ? (
          <p className="text-sm text-text-muted">No waves in plan.</p>
        ) : (
          <div className="space-y-3">
            {waves.map((wave) => (
              <div
                key={wave.wave}
                className="rounded-lg border border-border-default bg-surface-default"
              >
                <div className="flex items-center justify-between border-b border-border-default px-4 py-2">
                  <span className="text-sm font-semibold text-text-heading">Wave {wave.wave}</span>
                  <span className="text-xs text-text-muted">
                    {wave.tasks.length} task{wave.tasks.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="divide-y divide-border-default">
                  {wave.tasks.map((task, tIdx) => (
                    <div
                      key={task.taskId ?? tIdx}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text-heading">
                          {task.taskTitle ?? `Task ${tIdx + 1}`}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            task.mode === "sandbox"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {task.mode === "sandbox" ? "SBX" : "SDK"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {task.agentName && (
                          <span className="text-xs text-text-secondary">{task.agentName}</span>
                        )}
                        <span className="text-xs text-text-muted">
                          {((task.estimatedTokens ?? 50000) / 1000).toFixed(0)}K tokens
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cost estimate */}
      <div>
        <h4 className="mb-3 font-medium text-text-heading">Cost Estimate</h4>
        <div className="overflow-hidden rounded-lg border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-elevated">
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Agent</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Tasks</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">
                  Est. Tokens
                </th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(agentSummary.entries()).map(([key, data]) => (
                <tr key={key} className="border-b border-border-default last:border-b-0">
                  <td className="px-3 py-2 text-text-heading">{data.name}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{data.taskCount}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {(data.tokens / 1000).toFixed(0)}K
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {estimateTokenCost(data.tokens)}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface-elevated font-medium">
                <td className="px-3 py-2 text-text-heading">Total</td>
                <td className="px-3 py-2 text-right text-text-heading">{allTasks.length}</td>
                <td className="px-3 py-2 text-right text-text-heading">
                  {(totalEstTokens / 1000).toFixed(0)}K
                </td>
                <td className="px-3 py-2 text-right text-text-heading">
                  {estimateTokenCost(totalEstTokens)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Token budget */}
      <div>
        <label className="mb-1 block text-sm font-medium text-text-heading">Token Budget</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={50000}
            step={50000}
            value={tokenBudget}
            onChange={(e) => onTokenBudgetChange(Number.parseInt(e.target.value, 10) || 500000)}
            className="w-40 rounded-md border border-border-default bg-surface-subtle px-3 py-2 text-sm"
          />
          <span className="text-sm text-text-secondary">
            ({(tokenBudget / 1000).toFixed(0)}K tokens)
          </span>
        </div>
        {overBudget && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2">
            <svg
              className="h-4 w-4 flex-shrink-0 text-status-warning-fg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm text-status-warning-fg">
              Estimated usage ({(totalEstTokens / 1000).toFixed(0)}K) exceeds budget (
              {(tokenBudget / 1000).toFixed(0)}K)
            </span>
          </div>
        )}
      </div>

      {/* Branch summary */}
      {branches.size > 0 && (
        <div>
          <h4 className="mb-2 font-medium text-text-heading">Branches</h4>
          <div className="rounded-lg border border-border-default bg-surface-subtle p-3">
            <p className="mb-1 text-xs text-text-muted">
              Strategy: {branchStrategy.replaceAll("_", " ")} | Target: {targetBranch}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(branches).map((branch) => (
                <span
                  key={branch}
                  className="inline-flex rounded bg-surface-elevated px-2 py-0.5 font-mono text-xs text-text-secondary"
                >
                  {branch}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
