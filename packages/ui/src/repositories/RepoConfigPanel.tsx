"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import type { ConnectedRepo, RepoRole } from "../source-control/types";
import { ROLE_OPTIONS } from "../source-control/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoConfigPanelProps {
  repo: ConnectedRepo & {
    _id: string;
    pathFilters?: string[];
    deployWorkflowNames?: string[];
    localPath?: string;
  };
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// RepoConfigPanel
// ---------------------------------------------------------------------------

export function RepoConfigPanel({ repo, onClose }: RepoConfigPanelProps) {
  // Mutations
  const updateRole = useMutation("sourceControl/repositories:updateRepositoryRole" as any);
  const updatePathFilters = useMutation("sourceControl/repositories:updatePathFilters" as any);
  const tagDeployWorkflows = useMutation("sourceControl/repositories:tagDeployWorkflows" as any);
  const setLocalPath = useMutation("sourceControl/repositories:setLocalPath" as any);
  const disconnectRepository = useMutation(
    "sourceControl/repositories:disconnectRepository" as any,
  );

  // Local form state
  const [role, setRole] = useState<RepoRole>(repo.role);
  const [pathFiltersText, setPathFiltersText] = useState((repo.pathFilters ?? []).join(", "));
  const [deployWorkflowsText, setDeployWorkflowsText] = useState(
    (repo.deployWorkflowNames ?? []).join(", "),
  );
  const [localPathValue, setLocalPathValue] = useState(repo.localPath ?? "");

  const [saving, setSaving] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  function csvToArray(text: string): string[] {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // --------------------------------------------------
  // Save — only sends mutations for changed fields
  // --------------------------------------------------

  async function handleSave() {
    setSaving(true);
    try {
      const promises: Promise<any>[] = [];

      if (role !== repo.role) {
        promises.push(updateRole({ repositoryId: repo._id as any, role }));
      }

      const newPathFilters = csvToArray(pathFiltersText);
      const oldPathFilters = repo.pathFilters ?? [];
      if (JSON.stringify(newPathFilters) !== JSON.stringify(oldPathFilters)) {
        promises.push(
          updatePathFilters({
            repositoryId: repo._id as any,
            pathFilters: newPathFilters,
          }),
        );
      }

      const newWorkflows = csvToArray(deployWorkflowsText);
      const oldWorkflows = repo.deployWorkflowNames ?? [];
      if (JSON.stringify(newWorkflows) !== JSON.stringify(oldWorkflows)) {
        promises.push(
          tagDeployWorkflows({
            repositoryId: repo._id as any,
            workflowNames: newWorkflows,
          }),
        );
      }

      const trimmedLocal = localPathValue.trim();
      if (trimmedLocal !== (repo.localPath ?? "")) {
        promises.push(
          setLocalPath({
            repositoryId: repo._id as any,
            localPath: trimmedLocal || undefined,
          }),
        );
      }

      await Promise.all(promises);
      onClose();
    } catch {
      // Mutation errors surface via Convex toast
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // Disconnect
  // --------------------------------------------------

  async function handleDisconnect() {
    setSaving(true);
    try {
      await disconnectRepository({ repositoryId: repo._id as any });
      onClose();
    } catch {
      // Mutation errors surface via Convex toast
    } finally {
      setSaving(false);
      setConfirmDisconnect(false);
    }
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-heading">Configure {repo.repoFullName}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Close
        </button>
      </div>

      {/* Role selector */}
      <div className="space-y-1.5">
        <label htmlFor="repo-role" className="block text-xs font-medium text-text-secondary">
          Role
        </label>
        <select
          id="repo-role"
          value={role}
          onChange={(e) => setRole(e.target.value as RepoRole)}
          disabled={saving}
          className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default disabled:opacity-50"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Path filters */}
      <div className="space-y-1.5">
        <label htmlFor="path-filters" className="block text-xs font-medium text-text-secondary">
          Path Filters
        </label>
        <input
          id="path-filters"
          type="text"
          placeholder="src/*, packages/core/*"
          value={pathFiltersText}
          onChange={(e) => setPathFiltersText(e.target.value)}
          disabled={saving}
          className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default disabled:opacity-50"
        />
        <p className="form-helper">Comma-separated glob patterns</p>
      </div>

      {/* Deploy workflows */}
      <div className="space-y-1.5">
        <label htmlFor="deploy-workflows" className="block text-xs font-medium text-text-secondary">
          Deploy Workflows
        </label>
        <input
          id="deploy-workflows"
          type="text"
          placeholder="deploy.yml, release.yml"
          value={deployWorkflowsText}
          onChange={(e) => setDeployWorkflowsText(e.target.value)}
          disabled={saving}
          className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default disabled:opacity-50"
        />
        <p className="form-helper">Comma-separated workflow file names</p>
      </div>

      {/* Local path */}
      <div className="space-y-1.5">
        <label htmlFor="local-path" className="block text-xs font-medium text-text-secondary">
          Local Path
        </label>
        <input
          id="local-path"
          type="text"
          placeholder="/Users/you/projects/repo"
          value={localPathValue}
          onChange={(e) => setLocalPathValue(e.target.value)}
          disabled={saving}
          className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default disabled:opacity-50"
        />
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between pt-1">
        {/* Disconnect */}
        <div>
          {confirmDisconnect ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Disconnect?</span>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={saving}
                className="text-xs font-medium text-status-error-fg hover:underline disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmDisconnect(false)}
                disabled={saving}
                className="text-xs text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              disabled={saving}
              className="text-xs font-medium text-status-error-fg hover:underline disabled:opacity-50"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-accent-default px-4 py-1.5 text-sm font-medium text-text-on-brand hover:bg-accent-strong disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-on-brand border-t-transparent" />
              Saving...
            </span>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
