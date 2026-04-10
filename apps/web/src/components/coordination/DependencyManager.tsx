"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

interface DependencyData {
  _id: Id<"workstreamDependencies">;
  sourceWorkstreamId: Id<"workstreams">;
  targetWorkstreamId: Id<"workstreams">;
  description?: string;
  status: "active" | "resolved" | "blocked";
}

type WorkstreamRecord = Doc<"workstreams">;

interface DependencyManagerProps {
  programId: Id<"programs">;
  orgId: string;
  dependency?: DependencyData;
  onClose: () => void;
}

export function DependencyManager({
  programId,
  orgId,
  dependency,
  onClose,
}: DependencyManagerProps) {
  const workstreams = useQuery(api.workstreams.listByProgram, { programId });
  const createDep = useMutation(api.workstreamDependencies.create);
  const updateDep = useMutation(api.workstreamDependencies.update);

  const isEdit = !!dependency;

  const [sourceId, setSourceId] = useState<string>(dependency?.sourceWorkstreamId ?? "");
  const [targetId, setTargetId] = useState<string>(dependency?.targetWorkstreamId ?? "");
  const [description, setDescription] = useState(dependency?.description ?? "");
  const [status, setStatus] = useState<"active" | "resolved" | "blocked">(
    dependency?.status ?? "active",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Filter target dropdown to exclude selected source
  const targetOptions = workstreams?.filter((ws: WorkstreamRecord) => ws._id !== sourceId) ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sourceId || !targetId) {
      setError("Please select both source and target workstreams.");
      return;
    }

    if (sourceId === targetId) {
      setError("Source and target workstreams must be different.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && dependency) {
        await updateDep({
          dependencyId: dependency._id,
          description: description || undefined,
          status,
        });
      } else {
        await createDep({
          orgId,
          programId,
          sourceWorkstreamId: sourceId as Id<"workstreams">,
          targetWorkstreamId: targetId as Id<"workstreams">,
          description: description || undefined,
          status,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  if (workstreams === undefined) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-default p-4">
        <div className="h-24 animate-pulse rounded bg-surface-raised" />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border-default bg-surface-default p-4"
    >
      <h4 className="mb-3 text-sm font-semibold text-text-heading">
        {isEdit ? "Edit Dependency" : "New Dependency"}
      </h4>

      {error && (
        <div className="mb-3 rounded-md bg-status-error-bg px-3 py-2 text-xs text-status-error-fg">
          {error}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3">
        {/* Source workstream */}
        <div>
          <label className="form-label">Source Workstream</label>
          <select
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              // Reset target if it matches new source
              if (e.target.value === targetId) {
                setTargetId("");
              }
            }}
            disabled={isEdit}
            className="select"
          >
            <option value="">Select workstream...</option>
            {workstreams.map((ws: WorkstreamRecord) => (
              <option key={ws._id} value={ws._id}>
                {ws.shortCode} - {ws.name}
              </option>
            ))}
          </select>
        </div>

        {/* Target workstream */}
        <div>
          <label className="form-label">Target Workstream</label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={isEdit}
            className="select"
          >
            <option value="">Select workstream...</option>
            {targetOptions.map((ws: WorkstreamRecord) => (
              <option key={ws._id} value={ws._id}>
                {ws.shortCode} - {ws.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="mb-3">
        <label className="form-label">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Describe the dependency relationship..."
          className="textarea"
        />
      </div>

      {/* Status */}
      <div className="mb-4">
        <label className="form-label">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "active" | "resolved" | "blocked")}
          className="select"
        >
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border-default bg-surface-default px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-interactive-hover"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
