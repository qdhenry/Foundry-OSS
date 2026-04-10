"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

interface VersionHistoryProps {
  skillId: string;
  onViewVersion: (versionId: string) => void;
  onCompare: (versionAId: string, versionBId: string) => void;
}

export function VersionHistory({ skillId, onViewVersion, onCompare }: VersionHistoryProps) {
  const versions = useQuery(
    api.skillVersions.listBySkill,
    skillId ? { skillId: skillId as any } : "skip",
  );

  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  function toggleCompareSelection(versionId: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1], versionId];
      }
      return [...prev, versionId];
    });
  }

  function handleCompare() {
    if (selectedForCompare.length === 2) {
      onCompare(selectedForCompare[0], selectedForCompare[1]);
    }
  }

  if (versions === undefined) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-text-muted">Loading versions...</p>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-text-muted">No version history</p>
      </div>
    );
  }

  return (
    <div>
      {/* Compare action bar */}
      {selectedForCompare.length === 2 && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-status-warning-bg px-3 py-2">
          <span className="text-xs font-medium text-status-warning-fg">2 versions selected</span>
          <button
            onClick={handleCompare}
            className="rounded-md bg-accent-default px-3 py-1 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
          >
            Compare
          </button>
        </div>
      )}

      <div className="space-y-2">
        {versions.map((version: any) => (
          <div
            key={version._id}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              selectedForCompare.includes(version._id)
                ? "border-accent-default bg-status-info-bg"
                : "border-border-default hover:bg-interactive-hover"
            }`}
          >
            {/* Compare checkbox */}
            <input
              type="checkbox"
              checked={selectedForCompare.includes(version._id)}
              onChange={() => toggleCompareSelection(version._id)}
              className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-border-default text-accent-default focus:ring-accent-default"
            />

            {/* Version info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs font-medium text-text-primary">
                  {version.version}
                </span>
                <span className="text-xs text-text-muted">{version.lineCount} lines</span>
              </div>
              {version.message && (
                <p className="mt-0.5 truncate text-xs text-text-secondary">{version.message}</p>
              )}
              <p className="mt-0.5 text-xs text-text-muted">
                {new Date(version._creationTime).toLocaleString()}
              </p>
            </div>

            {/* View button */}
            <button
              onClick={() => onViewVersion(version._id)}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent-default transition-colors hover:bg-interactive-hover"
            >
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
