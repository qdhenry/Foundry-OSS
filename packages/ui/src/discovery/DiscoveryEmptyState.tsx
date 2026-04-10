"use client";

interface DiscoveryEmptyStateProps {
  onCreateRequirement: () => void;
  onOpenDocuments: () => void;
}

export function DiscoveryEmptyState({
  onCreateRequirement,
  onOpenDocuments,
}: DiscoveryEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border-default bg-surface-default px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-status-warning-bg">
        <svg
          className="h-7 w-7 text-accent-default"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-heading">Start Your Discovery Hub</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-text-secondary">
        Upload source documents for AI extraction, then review and import findings into structured
        requirements.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onOpenDocuments}
          className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-interactive-hover"
        >
          Open Document Zone
        </button>
        <button
          onClick={onCreateRequirement}
          className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
        >
          Create Requirement
        </button>
      </div>
    </div>
  );
}
