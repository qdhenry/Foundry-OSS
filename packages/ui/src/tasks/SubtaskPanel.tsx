"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  PauseCircle,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { gsap } from "../theme/gsap";
import { useSlideReveal } from "../theme/useAnimations";
import { SubtaskDetailTabs } from "./SubtaskDetailTabs";

interface SubtaskPanelProps {
  taskId: string;
  task: {
    hasSubtasks?: boolean;
    subtaskGenerationStatus?: string;
    subtaskGenerationError?: string;
  };
  onExecuteAll?: () => void;
  onExecuteSelected?: (subtaskIds: string[]) => void;
  onExecuteSubtask?: (subtaskId: string, title: string, prompt: string) => void;
  isExecutionActive?: boolean;
}

type Subtask = {
  _id: string;
  title: string;
  description: string;
  prompt: string;
  estimatedFiles: number;
  complexityScore: number;
  estimatedDurationMs: number;
  allowedFiles?: string[];
  order: number;
  isPausePoint: boolean;
  status: string;
  retryCount: number;
  commitSha?: string;
  filesChanged?: string[];
  scopeViolations?: string[];
  executionDurationMs?: number;
  errorMessage?: string;
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-text-muted" />,
  executing: <Loader2 className="h-4 w-4 animate-spin text-accent-default" />,
  retrying: <Loader2 className="h-4 w-4 animate-spin text-status-warning-fg" />,
  completed: <CheckCircle className="h-4 w-4 text-status-success-fg" />,
  failed: <XCircle className="h-4 w-4 text-status-error-fg" />,
  skipped: <SkipForward className="h-4 w-4 text-text-muted" />,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  executing: "Executing",
  retrying: "Retrying",
  completed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
};

export function SubtaskPanel({
  taskId,
  task,
  onExecuteAll,
  onExecuteSelected,
  onExecuteSubtask,
  isExecutionActive,
}: SubtaskPanelProps) {
  const subtasks = useQuery("subtasks:listByTask" as any, { taskId });

  const generateSubtasks = useMutation("subtaskGeneration:requestSubtaskGeneration" as any);
  const generationStatus = useQuery("subtaskGeneration:getGenerationStatus" as any, { taskId });

  const createSubtask = useMutation("subtasks:create" as any);
  const updateSubtask = useMutation("subtasks:update" as any);
  const removeSubtask = useMutation("subtasks:remove" as any);
  const reorderSubtasks = useMutation("subtasks:reorder" as any);

  const continueAfterPause = useAction("sandbox/orchestrator:continueAfterPause" as any);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);
  useSlideReveal(contentRef, !isCollapsed);
  const [expandedSubtask, setExpandedSubtask] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [addingTitle, setAddingTitle] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTitle, setEditingTitle] = useState<{ id: string; value: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionMode = selectedIds.size > 0;

  const genStatus = generationStatus?.status ?? task.subtaskGenerationStatus ?? "idle";
  const genError = generationStatus?.error ?? task.subtaskGenerationError;
  const isProcessing = genStatus === "processing";
  const hasSubtasks = subtasks && subtasks.length > 0;

  const completedCount = subtasks?.filter((s: Subtask) => s.status === "completed").length ?? 0;
  const totalCount = subtasks?.length ?? 0;
  const failedCount = subtasks?.filter((s: Subtask) => s.status === "failed").length ?? 0;
  const isExecuting =
    subtasks?.some((s: Subtask) => s.status === "executing" || s.status === "retrying") ?? false;
  const isPaused =
    subtasks?.some(
      (s: Subtask) =>
        s.isPausePoint &&
        s.status === "completed" &&
        subtasks.some((n: Subtask) => n.order > s.order && n.status === "pending"),
    ) ?? false;
  const allDone = totalCount > 0 && completedCount === totalCount;

  async function handleBreakDown() {
    setIsGenerating(true);
    try {
      await generateSubtasks({ taskId });
    } catch (err) {
      console.error("Failed to generate subtasks:", err);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAddSubtask() {
    if (!addingTitle.trim()) return;
    await createSubtask({ taskId, title: addingTitle.trim() });
    setAddingTitle("");
    setShowAddForm(false);
  }

  async function handleRemove(subtaskId: string) {
    await removeSubtask({ subtaskId });
  }

  async function handleTitleSave(subtaskId: string, newTitle: string) {
    if (!newTitle.trim()) return;
    await updateSubtask({ subtaskId, title: newTitle.trim() });
    setEditingTitle(null);
  }

  async function handleMoveUp(index: number) {
    if (!subtasks || index <= 0) return;
    const ids = subtasks.map((s: Subtask) => s._id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    await reorderSubtasks({ taskId, subtaskIds: ids });
  }

  async function handleMoveDown(index: number) {
    if (!subtasks || index >= subtasks.length - 1) return;
    const ids = subtasks.map((s: Subtask) => s._id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    await reorderSubtasks({ taskId, subtaskIds: ids });
  }

  async function handleTogglePausePoint(subtask: Subtask) {
    await updateSubtask({ subtaskId: subtask._id, isPausePoint: !subtask.isPausePoint });
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-default">
      {/* Header */}
      <button
        onClick={() => {
          const next = !isCollapsed;
          setIsCollapsed(next);
          if (chevronRef.current) {
            gsap.to(chevronRef.current, {
              rotation: next ? -90 : 0,
              duration: 0.25,
              ease: "power2.out",
            });
          }
        }}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2">
          <ChevronDown ref={chevronRef} className="h-4 w-4 text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Subtasks</h2>
          {totalCount > 0 && (
            <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-text-secondary">
              {completedCount}/{totalCount}
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-status-error-fg">
              <AlertTriangle className="h-3 w-3" />
              {failedCount} failed
            </span>
          )}
          {allDone && totalCount > 0 && (
            <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-xs font-medium text-status-success-fg">
              All complete
            </span>
          )}
        </div>
        {/* Progress bar (in header) */}
        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full bg-status-success-fg transition-all"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </button>

      <div ref={contentRef}>
        <div className="border-t border-border-default px-5 pb-5">
          {/* Generation states */}
          {(isProcessing || isGenerating) && (
            <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin text-accent-default" />
              {generationStatus?.progress ?? "Generating subtasks..."}
            </div>
          )}

          {genStatus === "error" && genError && (
            <div className="mt-3 rounded-lg border border-status-error-border bg-status-error-bg p-3">
              <div className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-error-fg" />
                <div>
                  <p className="text-sm font-medium text-status-error-fg">Generation failed</p>
                  <p className="mt-1 text-xs text-status-error-fg">{genError}</p>
                </div>
              </div>
              <button
                onClick={handleBreakDown}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-status-error-fg hover:text-status-error-fg"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </button>
            </div>
          )}

          {/* Empty state — Break Down button */}
          {!hasSubtasks && !isProcessing && !isGenerating && genStatus !== "error" && (
            <div className="flex items-center justify-between py-4">
              <p className="text-sm text-text-muted">
                No subtasks yet. Break this task down into executable steps.
              </p>
              <button
                onClick={handleBreakDown}
                disabled={isProcessing}
                className="flex items-center gap-1.5 rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5" />
                Break Down
              </button>
            </div>
          )}

          {/* Select All / Deselect All */}
          {hasSubtasks &&
            !isExecutionActive &&
            (() => {
              const pendingIds =
                subtasks
                  ?.filter((s: Subtask) => s.status === "pending")
                  .map((s: Subtask) => s._id) ?? [];
              const allPendingSelected =
                pendingIds.length > 0 && pendingIds.every((id: string) => selectedIds.has(id));
              return pendingIds.length > 0 ? (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (allPendingSelected) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(pendingIds));
                      }
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      readOnly
                      className="h-3.5 w-3.5 rounded border-border-default text-accent-default focus:ring-accent-default"
                    />
                    {allPendingSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>
              ) : null;
            })()}

          {/* Subtask list */}
          {hasSubtasks && (
            <div className="mt-3 space-y-1">
              {subtasks.map((subtask: Subtask, index: number) => (
                <div key={subtask._id} className="group rounded-lg border border-border-default">
                  {/* Subtask row */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    {/* Selection checkbox */}
                    {subtask.status === "pending" && !isExecutionActive && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(subtask._id)}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(subtask._id)) {
                              next.delete(subtask._id);
                            } else {
                              next.add(subtask._id);
                            }
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-border-default text-accent-default focus:ring-accent-default"
                      />
                    )}

                    {/* Status icon */}
                    <div className="shrink-0">
                      {STATUS_ICON[subtask.status] ?? STATUS_ICON.pending}
                    </div>

                    {/* Order number */}
                    <span className="w-5 shrink-0 text-xs font-mono text-text-muted">
                      {subtask.order + 1}
                    </span>

                    {/* Title (editable) */}
                    {editingTitle?.id === subtask._id ? (
                      <input
                        value={editingTitle.value}
                        onChange={(e) =>
                          setEditingTitle({ id: subtask._id, value: e.target.value })
                        }
                        onBlur={() => handleTitleSave(subtask._id, editingTitle.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleTitleSave(subtask._id, editingTitle.value);
                          if (e.key === "Escape") setEditingTitle(null);
                        }}
                        className="input flex-1"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingTitle({ id: subtask._id, value: subtask.title })}
                        className="flex-1 truncate text-left text-sm text-text-primary hover:text-text-heading"
                      >
                        {subtask.title}
                      </button>
                    )}

                    {/* Pause point indicator */}
                    {subtask.isPausePoint && (
                      <span title="Pause point">
                        <PauseCircle className="h-3.5 w-3.5 shrink-0 text-status-warning-fg" />
                      </span>
                    )}

                    {/* Complexity badge */}
                    <span className="shrink-0 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                      C{subtask.complexityScore}
                    </span>

                    {/* Status label */}
                    <span className="shrink-0 text-[10px] text-text-muted">
                      {STATUS_LABEL[subtask.status]}
                    </span>

                    {/* Expand/collapse toggle */}
                    <button
                      onClick={() =>
                        setExpandedSubtask(expandedSubtask === subtask._id ? null : subtask._id)
                      }
                      className="shrink-0 rounded p-0.5 text-text-muted hover:bg-interactive-hover hover:text-text-secondary"
                    >
                      {expandedSubtask === subtask._id ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Action buttons (visible on hover) */}
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {/* Play button for pending subtasks */}
                      {subtask.status === "pending" &&
                        onExecuteSubtask &&
                        !isExecutionActive &&
                        !selectionMode && (
                          <button
                            onClick={() =>
                              onExecuteSubtask(subtask._id, subtask.title, subtask.prompt)
                            }
                            className="rounded p-0.5 text-accent-default hover:bg-status-info-bg hover:text-accent-strong"
                            title="Execute this subtask"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                      {/* Retry button for failed subtasks */}
                      {subtask.status === "failed" && onExecuteSubtask && !isExecutionActive && (
                        <button
                          onClick={() =>
                            onExecuteSubtask(subtask._id, subtask.title, subtask.prompt)
                          }
                          className="rounded p-0.5 text-status-warning-fg hover:bg-status-warning-bg hover:text-status-warning-fg"
                          title="Retry this subtask"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {index > 0 && subtask.status === "pending" && (
                        <button
                          onClick={() => handleMoveUp(index)}
                          className="rounded p-0.5 text-text-muted hover:bg-interactive-hover hover:text-text-secondary"
                          title="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {subtasks && index < subtasks.length - 1 && subtask.status === "pending" && (
                        <button
                          onClick={() => handleMoveDown(index)}
                          className="rounded p-0.5 text-text-muted hover:bg-interactive-hover hover:text-text-secondary"
                          title="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {subtask.status === "pending" && (
                        <button
                          onClick={() => handleTogglePausePoint(subtask)}
                          className={`rounded p-0.5 transition-colors ${
                            subtask.isPausePoint
                              ? "text-status-warning-fg hover:bg-status-warning-bg"
                              : "text-text-muted hover:bg-interactive-hover hover:text-text-secondary"
                          }`}
                          title={subtask.isPausePoint ? "Remove pause point" : "Set pause point"}
                        >
                          <PauseCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(subtask.status === "pending" || subtask.status === "failed") && (
                        <button
                          onClick={() => handleRemove(subtask._id)}
                          className="rounded p-0.5 text-text-muted hover:bg-status-error-bg hover:text-status-error-fg"
                          title="Delete subtask"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Error message for failed subtasks */}
                  {subtask.status === "failed" && subtask.errorMessage && (
                    <div className="mx-3 mb-2 rounded bg-status-error-bg px-2 py-1 text-xs text-status-error-fg">
                      {subtask.errorMessage}
                    </div>
                  )}

                  {/* Scope violation warning */}
                  {subtask.scopeViolations && subtask.scopeViolations.length > 0 && (
                    <div className="mx-3 mb-2 flex items-start gap-1 rounded bg-status-warning-bg px-2 py-1 text-xs text-status-warning-fg">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>Scope violations: {subtask.scopeViolations.join(", ")}</span>
                    </div>
                  )}

                  {/* Expanded detail view */}
                  {expandedSubtask === subtask._id && <SubtaskDetailTabs subtask={subtask} />}
                </div>
              ))}
            </div>
          )}

          {/* Add subtask form */}
          {showAddForm ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={addingTitle}
                onChange={(e) => setAddingTitle(e.target.value)}
                placeholder="Subtask title..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSubtask();
                  if (e.key === "Escape") {
                    setShowAddForm(false);
                    setAddingTitle("");
                  }
                }}
                className="input flex-1"
              />
              <button
                onClick={handleAddSubtask}
                className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand hover:bg-accent-strong"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setAddingTitle("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                Add subtask
              </button>
              {hasSubtasks && (
                <button
                  onClick={handleBreakDown}
                  disabled={isProcessing || isGenerating}
                  className="flex items-center gap-1 text-xs font-medium text-accent-default hover:text-accent-strong disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Regenerate
                </button>
              )}
            </div>
          )}

          {/* Execution controls */}
          {hasSubtasks && !isExecuting && (
            <div className="mt-4 flex items-center gap-2 border-t border-border-default pt-3">
              {isPaused && continueAfterPause && (
                <button
                  onClick={async () => {
                    try {
                      await continueAfterPause({ taskId });
                    } catch (err) {
                      console.error("Failed to continue:", err);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand hover:bg-accent-strong"
                >
                  <Play className="h-3.5 w-3.5" />
                  Continue Execution
                </button>
              )}
              {!isPaused && !isExecutionActive && selectedIds.size > 0 && onExecuteSelected && (
                <>
                  <button
                    onClick={() => onExecuteSelected(Array.from(selectedIds) as string[])}
                    className="flex items-center gap-1.5 rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand hover:bg-accent-strong"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Execute Selected ({selectedIds.size})
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs font-medium text-text-secondary hover:text-text-primary"
                  >
                    Clear Selection
                  </button>
                </>
              )}
              {!isPaused && !isExecutionActive && selectedIds.size === 0 && onExecuteAll && (
                <button
                  onClick={onExecuteAll}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand hover:bg-accent-strong"
                >
                  <Play className="h-3.5 w-3.5" />
                  Execute All Subtasks
                </button>
              )}
              {failedCount > 0 && subtasks && (
                <span className="text-xs text-status-error-fg">
                  {failedCount} subtask(s) failed. Retry or skip to continue.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
