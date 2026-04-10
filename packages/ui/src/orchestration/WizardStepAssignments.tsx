"use client";

import { useQuery } from "convex/react";

interface TaskAssignment {
  taskId: string;
  taskTitle?: string;
  agentId?: string;
  agentName?: string;
  executionMode: string;
  branchName?: string;
  confidence?: number;
  estimatedTokens?: number;
  rationale?: string;
  wave?: number;
}

interface ExecutionPlan {
  waves?: Array<{
    waveNumber: number;
    taskAssignments?: TaskAssignment[];
  }>;
  assignments?: TaskAssignment[];
}

interface Agent {
  _id: string;
  name: string;
  role?: string;
}

interface WizardStepAssignmentsProps {
  programId: string;
  executionPlan: ExecutionPlan | null;
  agents?: Agent[] | null;
  branchStrategy: "per_agent" | "per_task" | "single_branch" | "custom";
  onBranchStrategyChange: (strategy: "per_agent" | "per_task" | "single_branch" | "custom") => void;
  branchPattern: string;
  onBranchPatternChange: (pattern: string) => void;
  maxConcurrency: number;
  onMaxConcurrencyChange: (value: number) => void;
  targetBranch: string;
  onTargetBranchChange: (value: string) => void;
  onChange: (plan: ExecutionPlan) => void;
}

const BRANCH_STRATEGIES = [
  { value: "per_task" as const, label: "Per Task", desc: "One branch per task" },
  { value: "per_agent" as const, label: "Per Agent", desc: "One branch per agent" },
  { value: "single_branch" as const, label: "Single Branch", desc: "All work on one branch" },
  { value: "custom" as const, label: "Custom", desc: "Custom naming pattern" },
];

function flattenAssignments(plan: ExecutionPlan | null): TaskAssignment[] {
  if (!plan) return [];
  if (plan.assignments && Array.isArray(plan.assignments)) {
    return plan.assignments;
  }
  if (plan.waves && Array.isArray(plan.waves)) {
    return plan.waves.flatMap((w) =>
      (w.taskAssignments ?? []).map((ta) => ({
        ...ta,
        wave: w.waveNumber,
      })),
    );
  }
  return [];
}

export function WizardStepAssignments({
  programId,
  executionPlan,
  agents: agentsProp,
  branchStrategy,
  onBranchStrategyChange,
  branchPattern,
  onBranchPatternChange,
  maxConcurrency,
  onMaxConcurrencyChange,
  targetBranch,
  onTargetBranchChange,
  onChange,
}: WizardStepAssignmentsProps) {
  // Use prop if available, otherwise fall back to internal query
  const agentsQuery = useQuery(
    "agentTeam/agents:listByProgram" as any,
    agentsProp
      ? "skip"
      : {
          programId: programId as any,
        },
  );
  const agents = agentsProp ?? agentsQuery;

  const assignments = flattenAssignments(executionPlan);

  function updateAssignment(index: number, updates: Partial<TaskAssignment>) {
    if (!executionPlan) return;
    const flat = flattenAssignments(executionPlan);
    const updated = flat.map((a, i) => (i === index ? { ...a, ...updates } : a));
    onChange({ ...executionPlan, assignments: updated });
  }

  return (
    <div className="space-y-5">
      {/* Assignment table */}
      <div>
        <h4 className="mb-3 font-medium text-text-heading">Task Assignments</h4>
        {assignments.length === 0 ? (
          <p className="text-sm text-text-muted">No assignments in the execution plan.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-elevated">
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Task</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Agent</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Mode</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    Confidence
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Branch</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment, idx) => (
                  <tr
                    key={assignment.taskId ?? idx}
                    className="border-b border-border-default last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-heading">
                          {assignment.taskTitle ?? `Task ${idx + 1}`}
                        </span>
                        {assignment.wave != null && (
                          <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-xs text-text-muted">
                            W{assignment.wave}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={assignment.agentId ?? ""}
                        onChange={(e) => {
                          const agent = (agents ?? []).find((a: any) => a._id === e.target.value);
                          updateAssignment(idx, {
                            agentId: e.target.value || undefined,
                            agentName: agent?.name ?? undefined,
                          });
                        }}
                        className="w-full rounded-md border border-border-default bg-surface-subtle px-2 py-1 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {(agents ?? []).map((agent: any) => (
                          <option key={agent._id} value={agent._id}>
                            {agent.name} ({agent.role})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex rounded-md border border-border-default">
                        <button
                          type="button"
                          onClick={() => updateAssignment(idx, { executionMode: "sandbox" })}
                          className={`px-2.5 py-1 text-xs font-medium rounded-l-md transition-colors ${
                            assignment.executionMode === "sandbox"
                              ? "bg-blue-600 text-white"
                              : "text-text-secondary hover:bg-surface-elevated"
                          }`}
                        >
                          Sandbox
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAssignment(idx, { executionMode: "sdk" })}
                          className={`px-2.5 py-1 text-xs font-medium rounded-r-md transition-colors ${
                            assignment.executionMode === "sdk"
                              ? "bg-blue-600 text-white"
                              : "text-text-secondary hover:bg-surface-elevated"
                          }`}
                        >
                          SDK
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {assignment.confidence != null ? (
                        <span
                          className={`text-xs font-medium ${
                            assignment.confidence >= 80
                              ? "text-status-success-fg"
                              : assignment.confidence >= 50
                                ? "text-status-warning-fg"
                                : "text-status-error-fg"
                          }`}
                        >
                          {assignment.confidence}%
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">--</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={assignment.branchName ?? ""}
                        onChange={(e) => updateAssignment(idx, { branchName: e.target.value })}
                        placeholder="auto"
                        className="w-full rounded-md border border-border-default bg-surface-subtle px-2 py-1 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Configuration section */}
      <div className="rounded-lg border border-border-default bg-surface-subtle p-4">
        <h4 className="mb-3 font-medium text-text-heading">Run Configuration</h4>
        <div className="space-y-4">
          {/* Branch strategy */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text-heading">
              Branch Strategy
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BRANCH_STRATEGIES.map((strategy) => (
                <button
                  key={strategy.value}
                  type="button"
                  onClick={() => onBranchStrategyChange(strategy.value)}
                  className={`rounded-lg border p-2.5 text-left transition-colors ${
                    branchStrategy === strategy.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-border-default bg-surface-default hover:bg-surface-elevated"
                  }`}
                >
                  <span className="block text-sm font-medium text-text-heading">
                    {strategy.label}
                  </span>
                  <span className="block text-xs text-text-muted">{strategy.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom pattern */}
          {branchStrategy === "custom" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text-heading">
                Branch Pattern
              </label>
              <input
                type="text"
                value={branchPattern}
                onChange={(e) => onBranchPatternChange(e.target.value)}
                placeholder="orchestration/{run}/{task}"
                className="w-full rounded-md border border-border-default bg-surface-default px-3 py-2 text-sm text-text-heading placeholder:text-text-muted"
              />
              <p className="mt-1 text-xs text-text-muted">
                Variables: {"{run}"}, {"{task}"}, {"{agent}"}, {"{wave}"}
              </p>
            </div>
          )}

          {/* Max concurrency + Target branch */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-heading">
                Max Concurrency
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onMaxConcurrencyChange(Math.max(1, maxConcurrency - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border-default bg-surface-default text-text-secondary hover:bg-surface-elevated"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxConcurrency}
                  onChange={(e) =>
                    onMaxConcurrencyChange(
                      Math.min(10, Math.max(1, Number.parseInt(e.target.value, 10) || 3)),
                    )
                  }
                  className="w-16 rounded-md border border-border-default bg-surface-default px-2 py-1.5 text-center text-sm"
                />
                <button
                  type="button"
                  onClick={() => onMaxConcurrencyChange(Math.min(10, maxConcurrency + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border-default bg-surface-default text-text-secondary hover:bg-surface-elevated"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-heading">
                Target Branch
              </label>
              <input
                type="text"
                value={targetBranch}
                onChange={(e) => onTargetBranchChange(e.target.value)}
                className="w-full rounded-md border border-border-default bg-surface-default px-3 py-2 text-sm text-text-heading"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
