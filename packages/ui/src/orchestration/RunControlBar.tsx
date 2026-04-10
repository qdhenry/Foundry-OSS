"use client";

import { useMutation } from "convex/react";

interface RunControlBarProps {
  runId: string;
  runStatus: string;
}

export function RunControlBar({ runId, runStatus }: RunControlBarProps) {
  const cancelRun = useMutation("orchestration/controls:cancelRun" as any);

  function handleCancel() {
    if (!window.confirm("Are you sure you want to cancel this orchestration run?")) return;
    cancelRun({ runId: runId as any });
  }

  function handleAddTask() {
    // Placeholder for v1
    if (typeof window !== "undefined" && "sonner" in window) {
      // If sonner toast is available it would be used here
    }
    alert("Coming soon: Add tasks to a running orchestration.");
  }

  const isPaused = runStatus === "paused";

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-subtle px-4 py-2">
      <span className="mr-2 text-xs font-medium text-text-secondary">Controls:</span>

      <button
        type="button"
        className="btn-secondary btn-xs"
        disabled
        title={isPaused ? "Resume All" : "Pause All"}
      >
        {isPaused ? "Resume All" : "Pause All"}
      </button>

      <button
        type="button"
        className="btn-secondary btn-xs text-status-error-fg hover:bg-status-error-bg"
        onClick={handleCancel}
      >
        Cancel Run
      </button>

      <button type="button" className="btn-secondary btn-xs" onClick={handleAddTask}>
        Add Task
      </button>
    </div>
  );
}
