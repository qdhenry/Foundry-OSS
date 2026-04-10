"use client";

import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  CheckSquare,
  ListTodo,
  Loader2,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface TaskDecompositionPanelProps {
  requirementId: string;
  programId: string;
}

const TASK_TYPE_BADGE: Record<string, string> = {
  development: "bg-status-info-bg text-accent-default",
  testing: "bg-status-success-bg text-status-success-fg",
  design: "bg-status-success-bg text-status-success-fg",
  configuration: "bg-status-warning-bg text-status-warning-fg",
  integration: "bg-status-warning-bg text-status-warning-fg",
  documentation: "bg-surface-raised text-text-secondary",
  research: "bg-status-info-bg text-status-info-fg",
  review: "bg-orange-100 text-orange-700",
};

export function TaskDecompositionPanel({ requirementId, programId }: TaskDecompositionPanelProps) {
  const data = useQuery("taskDecomposition:getLatestDecomposition" as any, {
    requirementId,
  });

  const generateTasks = useMutation("taskDecomposition:requestDecomposition" as any);
  const acceptDecomposition = useMutation("taskDecomposition:acceptDecomposition" as any);
  const rejectDecomposition = useMutation("taskDecomposition:rejectDecomposition" as any);

  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Derive processing state from reactive data
  const isProcessing = data?.status === "processing";
  const isError = data?.status === "error";
  const isAccepted = data?.status === "accepted";
  const isRejected = data?.status === "rejected";

  async function handleGenerate() {
    await generateTasks({ requirementId });
  }

  function toggleTask(index: number) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleAcceptAll() {
    if (!data) return;
    setAccepting(true);
    try {
      await acceptDecomposition({ decompositionId: data._id });
      const allIndices = new Set((decomposition.tasks ?? []).map((_: unknown, i: number) => i));
      setSelectedTasks(allIndices);
    } finally {
      setAccepting(false);
    }
  }

  async function handleReject() {
    if (!data) return;
    setRejecting(true);
    try {
      await rejectDecomposition({ decompositionId: data._id });
    } finally {
      setRejecting(false);
    }
  }

  // Loading (initial query resolution)
  if (data === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          <p className="text-sm text-text-secondary">Loading task decomposition...</p>
        </div>
      </div>
    );
  }

  // Processing state — AI is working, show streamed tasks as they arrive
  if (isProcessing) {
    const streamedTasks = (data?.decomposition as any)?.tasks ?? [];
    const progress = (data as any)?.generationProgress;

    return (
      <div className="space-y-4">
        {/* Progress banner */}
        <div className="rounded-xl border border-blue-200 bg-status-info-bg p-4">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="shrink-0 animate-spin text-accent-default" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                {progress ?? "Generating task decomposition..."}
              </p>
              <p className="mt-0.5 text-xs text-accent-default">
                Tasks will appear below as they are generated.
              </p>
            </div>
          </div>
        </div>

        {/* Streamed tasks list */}
        {streamedTasks.length > 0 && (
          <div className="rounded-xl border border-border-default bg-surface-default p-4">
            <h4 className="mb-3 text-sm font-semibold text-text-heading">
              Tasks ({streamedTasks.length})
            </h4>
            <div className="space-y-3">
              {streamedTasks.map((task: any, i: number) => (
                <div key={i} className="rounded-lg border border-border-default p-3">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-text-heading">
                      <span className="mr-1.5 text-text-muted">#{task.task_number ?? i + 1}</span>
                      {task.title}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {task.story_points != null && (
                        <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                          {task.story_points} SP
                        </span>
                      )}
                      {task.task_type && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            TASK_TYPE_BADGE[task.task_type] ?? TASK_TYPE_BADGE.development
                          }`}
                        >
                          {task.task_type}
                        </span>
                      )}
                    </div>
                  </div>
                  {task.description && (
                    <p className="text-[11px] text-text-secondary">{task.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-status-error-bg p-6">
        <div className="flex flex-col items-center py-6">
          <AlertCircle size={32} className="mb-3 text-status-error-fg" />
          <p className="text-sm font-medium text-red-800">Task generation failed</p>
          <p className="mt-1 max-w-sm text-center text-xs text-status-error-fg">
            {data.error ?? "An unexpected error occurred while generating tasks."}
          </p>
          <button
            onClick={handleGenerate}
            className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No decomposition yet
  if (!data) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex flex-col items-center py-6">
          <ListTodo size={32} className="mb-3 text-accent-default" />
          <p className="text-sm font-medium text-text-heading">No task breakdown available</p>
          <p className="mt-1 text-xs text-text-muted">
            Generate an AI-powered task decomposition for this requirement.
          </p>
          <button
            onClick={handleGenerate}
            className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
          >
            Generate Tasks
          </button>
        </div>
      </div>
    );
  }

  // Accepted state
  if (isAccepted) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-200 bg-status-success-bg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-status-success-fg" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Tasks created and added to backlog
              </p>
              <p className="text-xs text-status-success-fg">
                Navigate to the Tasks page to view and manage the generated tasks.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
          >
            Re-generate Tasks
          </button>
        </div>
      </div>
    );
  }

  const decomposition = data.decomposition as {
    rationale?: string;
    critical_considerations?: string[];
    tasks?: Array<{
      task_number: number;
      title: string;
      description: string;
      story_points: number;
      task_type: string;
      depends_on?: number[];
      suggested_owner_role?: string;
      acceptance_criteria?: string[];
    }>;
    total_points?: number;
    estimated_sprints?: number;
  };

  const tasks = decomposition?.tasks ?? [];
  const totalPoints =
    decomposition?.total_points ?? tasks.reduce((sum, t) => sum + (t.story_points ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Rejected banner — allow re-generation */}
      {isRejected && (
        <div className="rounded-xl border border-border-default bg-surface-raised p-3">
          <p className="text-xs text-text-secondary">
            This decomposition was rejected. You can review it below or generate a new one.
          </p>
        </div>
      )}

      {/* Rationale */}
      {decomposition?.rationale && (
        <div className="rounded-xl border border-blue-200 bg-status-info-bg p-4">
          <h4 className="mb-1 text-sm font-semibold text-blue-800">Decomposition Rationale</h4>
          <p className="text-xs text-accent-default">{decomposition.rationale}</p>
        </div>
      )}

      {/* Critical Considerations */}
      {decomposition?.critical_considerations &&
        decomposition.critical_considerations.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-status-warning-bg p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Zap size={14} />
              Critical Considerations
            </h4>
            <ul className="space-y-1">
              {decomposition.critical_considerations.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-status-warning-fg">
                  <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Task List */}
      {tasks.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-heading">Tasks ({tasks.length})</h4>
            {!isRejected && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  disabled={rejecting}
                  className="flex items-center gap-1 rounded-lg bg-surface-raised px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated disabled:opacity-50"
                >
                  <XCircle size={12} />
                  {rejecting ? "Rejecting..." : "Reject"}
                </button>
                <button
                  onClick={handleAcceptAll}
                  disabled={accepting}
                  className="flex items-center gap-1 rounded-lg bg-accent-default px-3 py-1 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  <CheckCircle size={12} />
                  {accepting ? "Accepting..." : "Accept All Tasks"}
                </button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {tasks.map((task, i) => {
              const isSelected = selectedTasks.has(i);
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    isSelected ? "border-green-200 bg-status-success-bg" : "border-border-default"
                  }`}
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => toggleTask(i)}
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isSelected
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-border-default"
                        }`}
                      >
                        {isSelected && <CheckSquare size={10} />}
                      </button>
                      <div>
                        <p className="text-xs font-medium text-text-heading">
                          <span className="mr-1.5 text-text-muted">#{task.task_number}</span>
                          {task.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                        {task.story_points} SP
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          TASK_TYPE_BADGE[task.task_type] ?? TASK_TYPE_BADGE.development
                        }`}
                      >
                        {task.task_type}
                      </span>
                    </div>
                  </div>
                  <p className="ml-6 text-[11px] text-text-secondary">{task.description}</p>
                  {task.depends_on && task.depends_on.length > 0 && (
                    <div className="ml-6 mt-1.5 flex items-center gap-1 text-[11px] text-text-muted">
                      <ArrowRight size={10} />
                      Depends on: {task.depends_on.map((d) => `#${d}`).join(", ")}
                    </div>
                  )}
                  {task.suggested_owner_role && (
                    <p className="ml-6 mt-1 text-[11px] text-text-muted">
                      Owner: {task.suggested_owner_role}
                    </p>
                  )}
                  {task.acceptance_criteria && task.acceptance_criteria.length > 0 && (
                    <ul className="ml-6 mt-1.5 space-y-0.5">
                      {task.acceptance_criteria.map((ac, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-1.5 text-[11px] text-text-secondary"
                        >
                          <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                          {ac}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary footer */}
      <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface-default px-4 py-3">
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span>
            <span className="font-semibold text-text-heading">{totalPoints}</span> total points
          </span>
          {decomposition?.estimated_sprints && (
            <span>
              <span className="font-semibold text-text-heading">
                {decomposition.estimated_sprints}
              </span>{" "}
              estimated sprint{decomposition.estimated_sprints !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={isProcessing}
          className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          Re-generate Tasks
        </button>
      </div>
    </div>
  );
}
