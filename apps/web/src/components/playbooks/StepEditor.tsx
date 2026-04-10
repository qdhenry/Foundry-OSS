"use client";

import type { Id } from "../../../convex/_generated/dataModel";

interface PlaybookStep {
  title: string;
  description?: string;
  workstreamId?: Id<"workstreams">;
  estimatedHours?: number;
}

interface Workstream {
  _id: Id<"workstreams">;
  name: string;
  shortCode: string;
}

interface StepEditorProps {
  steps: PlaybookStep[];
  onChange: (steps: PlaybookStep[]) => void;
  workstreams: Workstream[];
}

export function StepEditor({ steps, onChange, workstreams }: StepEditorProps) {
  function updateStep(index: number, updates: Partial<PlaybookStep>) {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    onChange(newSteps);
  }

  function addStep() {
    onChange([...steps, { title: "" }]);
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: "up" | "down") {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === steps.length - 1) return;
    const newSteps = [...steps];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
    onChange(newSteps);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Steps</label>
        <span className="text-xs text-text-muted">
          {steps.length} step{steps.length !== 1 ? "s" : ""}
        </span>
      </div>

      {steps.length === 0 && (
        <p className="text-xs text-text-muted">
          No steps yet. Add a step to define the playbook workflow.
        </p>
      )}

      {steps.map((step, index) => (
        <div key={index} className="rounded-lg border border-border-default bg-surface-raised p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Step {index + 1}</span>
            <div className="flex items-center gap-1">
              {/* Move up */}
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveStep(index, "up")}
                className="rounded p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary disabled:opacity-30"
                title="Move up"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              {/* Move down */}
              <button
                type="button"
                disabled={index === steps.length - 1}
                onClick={() => moveStep(index, "down")}
                className="rounded p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary disabled:opacity-30"
                title="Move down"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* Remove */}
              <button
                type="button"
                onClick={() => removeStep(index)}
                className="rounded p-1 text-text-muted transition-colors hover:bg-status-error-bg hover:text-status-error-fg"
                title="Remove step"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Step title */}
          <div className="mb-2">
            <input
              value={step.title}
              onChange={(e) => updateStep(index, { title: e.target.value })}
              placeholder="Step title"
              className="input"
            />
          </div>

          {/* Step description */}
          <div className="mb-2">
            <textarea
              value={step.description ?? ""}
              onChange={(e) =>
                updateStep(index, {
                  description: e.target.value || undefined,
                })
              }
              placeholder="Step description (optional)"
              rows={2}
              className="textarea"
            />
          </div>

          {/* Workstream + estimated hours */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Workstream</label>
              <select
                value={step.workstreamId ?? ""}
                onChange={(e) =>
                  updateStep(index, {
                    workstreamId: e.target.value
                      ? (e.target.value as Id<"workstreams">)
                      : undefined,
                  })
                }
                className="select"
              >
                <option value="">None</option>
                {workstreams.map((ws) => (
                  <option key={ws._id} value={ws._id}>
                    {ws.shortCode} - {ws.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Est. Hours</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={step.estimatedHours ?? ""}
                onChange={(e) =>
                  updateStep(index, {
                    estimatedHours: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="0"
                className="input"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add step button */}
      <button
        type="button"
        onClick={addStep}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-default py-3 text-sm font-medium text-text-secondary transition-colors hover:border-accent-default hover:text-accent-default"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Step
      </button>
    </div>
  );
}
