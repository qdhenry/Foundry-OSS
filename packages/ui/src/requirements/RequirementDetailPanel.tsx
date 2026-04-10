"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";

type Priority = "must_have" | "should_have" | "nice_to_have" | "deferred";
type Status = "draft" | "approved" | "in_progress" | "complete" | "deferred";

const PRIORITY_LABELS: Record<Priority, string> = {
  must_have: "Must Have",
  should_have: "Should Have",
  nice_to_have: "Nice to Have",
  deferred: "Deferred",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  must_have: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  should_have: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  nice_to_have: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  deferred: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  approved: "Approved",
  in_progress: "In Progress",
  complete: "Complete",
  deferred: "Deferred",
};

const STATUS_COLORS: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  complete: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  deferred: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const FIT_GAP_LABELS: Record<string, string> = {
  native: "Native",
  config: "Configuration",
  custom_dev: "Custom Development",
  third_party: "Third Party",
  not_feasible: "Not Feasible",
};

const EFFORT_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  very_high: "Very High",
};

const DELIVERY_PHASE_LABELS: Record<string, string> = {
  phase_1: "Phase 1",
  phase_2: "Phase 2",
  phase_3: "Phase 3",
};

interface RequirementDetailPanelProps {
  requirementId: string;
  open: boolean;
  onClose: () => void;
}

export function RequirementDetailPanel({
  requirementId,
  open,
  onClose,
}: RequirementDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const requirement = useQuery("requirements:get" as any, open ? { requirementId } : "skip");

  const designAssets = useQuery(
    "designAssets:listByRequirement" as any,
    open && requirement ? { programId: requirement.programId, requirementId } : "skip",
  );

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 transition-opacity" />
      <div
        ref={panelRef}
        className="relative w-full max-w-lg animate-slide-in-right border-l border-border-default bg-surface-page shadow-xl"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
            <h2 className="text-sm font-semibold text-text-heading">Requirement Details</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {!requirement ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Title + Ref ID */}
                <div>
                  <p className="text-xs font-mono text-text-muted">{requirement.refId}</p>
                  <h3 className="mt-1 text-base font-semibold text-text-heading">
                    {requirement.title}
                  </h3>
                </div>

                {/* Description */}
                {requirement.description && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Description
                    </h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
                      {requirement.description}
                    </p>
                  </div>
                )}

                {/* Metadata Grid */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Properties
                  </h4>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <MetadataField label="Priority">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_COLORS[requirement.priority as Priority]}`}
                      >
                        {PRIORITY_LABELS[requirement.priority as Priority]}
                      </span>
                    </MetadataField>

                    <MetadataField label="Status">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[requirement.status as Status]}`}
                      >
                        {STATUS_LABELS[requirement.status as Status]}
                      </span>
                    </MetadataField>

                    <MetadataField label="Fit/Gap">
                      <span className="text-sm text-text-primary">
                        {FIT_GAP_LABELS[requirement.fitGap] ?? requirement.fitGap}
                      </span>
                    </MetadataField>

                    <MetadataField label="Effort">
                      <span className="text-sm text-text-primary">
                        {requirement.effortEstimate
                          ? (EFFORT_LABELS[requirement.effortEstimate] ??
                            requirement.effortEstimate)
                          : "Not set"}
                      </span>
                    </MetadataField>

                    <MetadataField label="Delivery Phase">
                      <span className="text-sm text-text-primary">
                        {requirement.deliveryPhase
                          ? (DELIVERY_PHASE_LABELS[requirement.deliveryPhase] ??
                            requirement.deliveryPhase)
                          : "Not set"}
                      </span>
                    </MetadataField>

                    {requirement.batch && (
                      <MetadataField label="Batch">
                        <span className="text-sm text-text-primary">{requirement.batch}</span>
                      </MetadataField>
                    )}
                  </div>
                </div>

                {/* Dependencies */}
                {requirement.resolvedDependencies &&
                  requirement.resolvedDependencies.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Dependencies ({requirement.resolvedDependencies.length})
                      </h4>
                      <ul className="mt-2 space-y-1.5">
                        {requirement.resolvedDependencies.map((dep: any) => (
                          <li
                            key={dep._id}
                            className="flex items-center gap-2 rounded-md border border-border-default px-3 py-2"
                          >
                            <span className="font-mono text-xs text-text-muted">{dep.refId}</span>
                            <span className="text-sm text-text-primary">{dep.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Evidence Files */}
                {requirement.evidenceFiles && requirement.evidenceFiles.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Evidence ({requirement.evidenceFiles.length})
                    </h4>
                    <ul className="mt-2 space-y-1.5">
                      {requirement.evidenceFiles.map((file: any) => (
                        <li
                          key={file._id}
                          className="flex items-center gap-2 rounded-md border border-border-default px-3 py-2"
                        >
                          <svg
                            className="h-4 w-4 shrink-0 text-text-muted"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                          </svg>
                          {file.downloadUrl ? (
                            <a
                              href={file.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-accent-default hover:underline"
                            >
                              {file.fileName ?? "Download"}
                            </a>
                          ) : (
                            <span className="text-sm text-text-secondary">
                              {file.fileName ?? "File"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Design Assets */}
                {designAssets && designAssets.length > 0 && (
                  <div className="border-t border-border-default pt-4 mt-4">
                    <h3 className="mb-3 text-sm font-semibold text-text-primary">
                      Design Assets ({designAssets.length})
                    </h3>
                    <div className="space-y-2">
                      {designAssets.map((asset: any) => (
                        <div
                          key={asset._id}
                          className="flex items-center gap-3 rounded-lg border border-border-default p-2"
                        >
                          {asset.fileUrl && asset.type === "screenshot" ? (
                            <img
                              src={asset.fileUrl}
                              alt={asset.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-elevated text-xs text-text-muted">
                              {asset.type === "tokens" ? "{}" : "📄"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm text-text-primary">{asset.name}</p>
                            <p className="text-xs text-text-muted">{asset.type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetadataField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-surface-raised px-3 py-2">
      <p className="text-[11px] font-medium text-text-muted">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
