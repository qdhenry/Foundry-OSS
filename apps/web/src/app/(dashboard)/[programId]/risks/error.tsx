"use client";

export default function RisksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="rounded-xl border border-status-error-border bg-status-error-bg px-8 py-10 text-center">
        <h2 className="mb-2 text-lg font-semibold text-status-error-fg">Risks Error</h2>
        <p className="mb-4 text-sm text-status-error-fg">
          {error.message || "Failed to load risks."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-status-error-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
