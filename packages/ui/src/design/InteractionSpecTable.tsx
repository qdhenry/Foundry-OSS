"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

type InteractionSpec = {
  _id: string;
  componentName: string;
  trigger: string;
  animationType: string;
  duration?: string;
  description?: string;
};

type NewSpec = {
  componentName: string;
  trigger: string;
  animationType: string;
  duration: string;
  description: string;
};

const TRIGGER_OPTIONS = ["hover", "click", "focus", "scroll", "load"] as const;
const ANIMATION_OPTIONS = ["fade", "slide", "scale", "rotate", "custom"] as const;

const EMPTY_SPEC: NewSpec = {
  componentName: "",
  trigger: "hover",
  animationType: "fade",
  duration: "",
  description: "",
};

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4"}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

const INPUT_CLASS =
  "rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary w-full focus:outline-none focus:ring-2 focus:ring-accent-default";

export function InteractionSpecTable({ programId, orgId }: { programId: string; orgId: string }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSpec, setNewSpec] = useState<NewSpec>(EMPTY_SPEC);

  const interactions = useQuery(
    "designInteractions:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as InteractionSpec[] | undefined;

  const createInteraction = useMutation("designInteractions:create" as any);
  const removeInteraction = useMutation("designInteractions:remove" as any);

  const count = interactions?.length ?? 0;

  function handleFieldChange(field: keyof NewSpec, value: string) {
    setNewSpec((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!newSpec.componentName.trim()) return;
    await createInteraction({
      orgId,
      programId,
      componentName: newSpec.componentName.trim(),
      trigger: newSpec.trigger,
      animationType: newSpec.animationType,
      duration: newSpec.duration.trim() || undefined,
      description: newSpec.description.trim() || undefined,
    });
    setNewSpec(EMPTY_SPEC);
    setShowAddForm(false);
  }

  async function handleDelete(interactionId: string) {
    await removeInteraction({ interactionId });
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
        <h2 className="text-sm font-semibold text-text-heading">Interaction Specs ({count})</h2>
        <button
          type="button"
          className={showAddForm ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? "Cancel" : "Add"}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="border-b border-border-default px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-medium">Component Name</label>
              <input
                type="text"
                placeholder="e.g. PrimaryButton"
                value={newSpec.componentName}
                onChange={(e) => handleFieldChange("componentName", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-medium">Trigger</label>
              <select
                value={newSpec.trigger}
                onChange={(e) => handleFieldChange("trigger", e.target.value)}
                className={INPUT_CLASS}
              >
                {TRIGGER_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-medium">Animation Type</label>
              <select
                value={newSpec.animationType}
                onChange={(e) => handleFieldChange("animationType", e.target.value)}
                className={INPUT_CLASS}
              >
                {ANIMATION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-medium">Duration</label>
              <input
                type="text"
                placeholder="e.g. 300ms"
                value={newSpec.duration}
                onChange={(e) => handleFieldChange("duration", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted font-medium">Description</label>
            <textarea
              rows={2}
              placeholder="Describe the interaction behavior..."
              value={newSpec.description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={handleSave}
              disabled={!newSpec.componentName.trim()}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Table or empty state */}
      {interactions === undefined ? null : interactions.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-muted">No interaction specs defined yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-b border-border-default text-left text-xs text-text-muted px-5 py-3 font-medium">
                  Component
                </th>
                <th className="border-b border-border-default text-left text-xs text-text-muted px-5 py-3 font-medium">
                  Trigger
                </th>
                <th className="border-b border-border-default text-left text-xs text-text-muted px-5 py-3 font-medium">
                  Animation
                </th>
                <th className="border-b border-border-default text-left text-xs text-text-muted px-5 py-3 font-medium">
                  Duration
                </th>
                <th className="border-b border-border-default text-left text-xs text-text-muted px-5 py-3 font-medium">
                  Description
                </th>
                <th className="border-b border-border-default px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {interactions.map((spec) => (
                <tr key={spec._id} className="border-b border-border-default last:border-b-0">
                  <td className="px-5 py-3 text-text-primary font-medium">{spec.componentName}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary">
                      {spec.trigger}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{spec.animationType}</td>
                  <td className="px-5 py-3">
                    {spec.duration ? (
                      <span className="font-mono text-xs text-text-secondary">{spec.duration}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-text-secondary max-w-xs truncate">
                    {spec.description ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      aria-label="Delete interaction spec"
                      onClick={() => handleDelete(spec._id)}
                      className="text-text-muted hover:text-status-error-fg transition-colors"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
