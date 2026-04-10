"use client";

import type { DiscoveryTab } from "./DiscoveryTabBar";

interface DiscoveryWorkflowBannerProps {
  activeTab: DiscoveryTab;
  documentCount: number;
  pendingFindingsCount: number;
  approvedCount: number;
  importedCount: number;
  onSwitchTab: (tab: DiscoveryTab) => void;
}

export function DiscoveryWorkflowBanner({
  activeTab,
  documentCount,
  pendingFindingsCount,
  approvedCount,
  importedCount,
  onSwitchTab,
}: DiscoveryWorkflowBannerProps) {
  // Determine the contextual message based on workflow state
  let message: string | null = null;
  let action: { label: string; onClick: () => void } | null = null;
  let tone = "border-status-info-border bg-status-info-bg text-status-info-fg";

  if (documentCount === 0) {
    message = "Start by uploading documents for AI analysis.";
    if (activeTab !== "documents") {
      action = { label: "Go to Documents", onClick: () => onSwitchTab("documents") };
    }
  } else if (pendingFindingsCount > 0) {
    message = `${pendingFindingsCount} finding${pendingFindingsCount === 1 ? "" : "s"} ready for review.`;
    tone = "border-status-warning-border bg-status-warning-bg text-status-warning-fg";
    if (activeTab !== "findings") {
      action = { label: "Review Findings", onClick: () => onSwitchTab("findings") };
    }
  } else if (approvedCount > 0) {
    message = `${approvedCount} approved finding${approvedCount === 1 ? "" : "s"} ready to import.`;
    tone = "border-status-success-border bg-status-success-bg text-status-success-fg";
    if (activeTab !== "findings") {
      action = { label: "Import Findings", onClick: () => onSwitchTab("findings") };
    }
  } else if (importedCount > 0) {
    message = "All findings processed. Track progress in workstream pipelines.";
    tone = "border-status-success-border bg-status-success-bg text-status-success-fg";
    if (activeTab !== "imported") {
      action = { label: "View Imported", onClick: () => onSwitchTab("imported") };
    }
  } else {
    // No actionable state — hide banner
    return null;
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{message}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-lg border border-current/20 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-interactive-hover"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
