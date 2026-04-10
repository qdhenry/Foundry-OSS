import { useEffect, useState } from "react";
import {
  clearDesktopFatalError,
  DESKTOP_FATAL_ERROR_EVENT,
  readDesktopFatalError,
  type DesktopFatalError,
} from "../lib/desktop-logging";
import { navigateDesktop } from "../shims/navigation";

export function DesktopFatalErrorOverlay() {
  const [fatalError, setFatalError] = useState<DesktopFatalError | null>(() =>
    readDesktopFatalError()
  );

  useEffect(() => {
    function handleFatalError(event: Event) {
      const customEvent = event as CustomEvent<DesktopFatalError>;
      setFatalError(customEvent.detail ?? null);
    }

    window.addEventListener(DESKTOP_FATAL_ERROR_EVENT, handleFatalError);
    return () => {
      window.removeEventListener(DESKTOP_FATAL_ERROR_EVENT, handleFatalError);
    };
  }, []);

  if (!fatalError) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[1000] flex justify-center px-4">
      <div className="w-full max-w-3xl rounded-xl border border-status-error-border bg-status-error-bg p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-status-error-fg">
              Runtime Error
            </p>
            <p className="mt-1 text-sm font-semibold text-text-heading">
              {fatalError.message}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Route: <span className="font-mono">{fatalError.pathname}</span>
            </p>
          </div>
          <button
            className="rounded-lg border border-border-default px-2 py-1 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
            onClick={() => {
              clearDesktopFatalError();
              setFatalError(null);
            }}
          >
            Dismiss
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            className="btn-primary btn-sm"
            onClick={() => navigateDesktop("/programs", { replace: true })}
          >
            Go to Programs
          </button>
          <button
            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
}
