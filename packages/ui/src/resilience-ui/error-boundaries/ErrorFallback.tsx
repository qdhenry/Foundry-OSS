"use client";

interface ErrorFallbackProps {
  error: Error | null;
  serviceName?: string;
  isCritical?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorFallback({
  error,
  serviceName,
  isCritical = false,
  onRetry,
  onDismiss,
}: ErrorFallbackProps) {
  const title = serviceName ? `${serviceName} is temporarily unavailable` : "Something went wrong";

  const description = isCritical
    ? "This feature requires a connection to work. Please try again in a moment."
    : "Some features may be limited. You can continue using other parts of the application.";

  return (
    <div className="flex min-h-[200px] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-status-error-border bg-status-error-bg p-6 text-center">
        <div className="mb-3 text-2xl">
          <svg
            className="mx-auto h-8 w-8 text-status-error-fg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>

        {error?.message && (
          <p className="mt-3 rounded-lg bg-surface-raised px-3 py-2 text-xs font-mono text-text-muted">
            {error.message.slice(0, 200)}
          </p>
        )}

        <div className="mt-4 flex items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-interactive-default px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
            >
              Try again
            </button>
          )}
          {onDismiss && !isCritical && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary hover:bg-interactive-subtle"
            >
              Continue without {serviceName?.toLowerCase() ?? "this feature"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
