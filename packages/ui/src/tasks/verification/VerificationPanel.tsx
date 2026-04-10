"use client";

import { useAction, useQuery } from "convex/react";
import { AlertCircle, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { VerificationChecksList } from "./VerificationChecksList";
import { VerificationScreenshotGrid } from "./VerificationScreenshotGrid";
import { VerificationStatusBadge } from "./VerificationStatusBadge";
import { VerificationSummary } from "./VerificationSummary";

interface VerificationPanelProps {
  taskId: string;
}

export function VerificationPanel({ taskId }: VerificationPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRetriggering, setIsRetriggering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Query latest verification for this task
  const latest = useQuery(
    "taskVerifications:getLatestByTask" as any,
    taskId ? { taskId } : "skip",
  ) as any;

  // Conditionally query checks and screenshots when a verification exists
  const verificationId = latest?._id as string | undefined;

  const checks = useQuery(
    "taskVerifications:getChecks" as any,
    verificationId ? { verificationId } : "skip",
  ) as any[] | undefined;

  const screenshots = useQuery(
    "taskVerifications:getScreenshots" as any,
    verificationId ? { verificationId } : "skip",
  ) as any[] | undefined;

  const retriggerVerification = useAction("taskVerifications:retriggerVerification" as any);

  async function handleRetrigger() {
    if (isRetriggering) return;
    setIsRetriggering(true);
    setErrorMessage(null);
    try {
      const result: any = await retriggerVerification({ taskId });
      if (result && !result.success) {
        setErrorMessage(result.error ?? "Unable to re-verify this task");
      }
    } catch (err) {
      console.error("[VerificationPanel] Failed to retrigger verification:", err);
      setErrorMessage("Failed to trigger verification. Please try again.");
    } finally {
      setIsRetriggering(false);
    }
  }

  // Derive check counts
  const checksPassed = checks?.filter((c: any) => c.status === "passed").length ?? 0;
  const checksFailed = checks?.filter((c: any) => c.status === "failed").length ?? 0;
  const checksTotal = checks?.length ?? 0;

  const status = (latest?.status ?? "pending") as
    | "pending"
    | "provisioning"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";

  const isRunning = status === "provisioning" || status === "running";

  // Compute duration
  const durationMs =
    latest?.completedAt && latest?.startedAt ? latest.completedAt - latest.startedAt : undefined;

  // Loading state — query still resolving
  if (latest === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Verification</h2>
        </div>
        <p className="mt-2 text-sm text-text-muted">Loading verification data...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed((c) => !c)}
          className="flex items-center gap-1.5 text-sm font-semibold text-text-primary"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <ShieldCheck className="h-4 w-4 text-text-muted" />
          Verification
        </button>

        <div className="flex items-center gap-2">
          {latest && (
            <VerificationStatusBadge
              status={status}
              checksPassed={checksPassed}
              checksTotal={checksTotal}
              checksFailed={checksFailed}
            />
          )}
          {/* Re-verify button */}
          {!isRunning && (
            <button
              onClick={handleRetrigger}
              disabled={isRetriggering}
              className="flex items-center gap-1 rounded-lg border border-border-default px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised disabled:opacity-50"
            >
              {isRetriggering ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Re-verify
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-status-error-fg" />
          <p className="text-sm text-status-error-fg">{errorMessage}</p>
        </div>
      )}

      {/* Body */}
      {!isCollapsed && (
        <>
          {/* No verification exists yet */}
          {!latest && (
            <div className="py-6 text-center">
              <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-text-muted" />
              <p className="text-xs text-text-muted">No verification has been run yet.</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Verification will run automatically after sandbox execution completes.
              </p>
            </div>
          )}

          {/* Running state */}
          {latest && isRunning && (
            <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin text-accent-default" />
              {status === "provisioning"
                ? "Provisioning verification sandbox..."
                : "Running verification checks..."}
            </div>
          )}

          {/* Completed / failed — show results */}
          {latest && !isRunning && (
            <div className="space-y-4">
              <VerificationSummary
                checksTotal={checksTotal}
                checksPassed={checksPassed}
                checksFailed={checksFailed}
                screenshotCount={screenshots?.length ?? 0}
                durationMs={durationMs}
                aiSummary={latest.aiSummary}
              />

              {checks && checks.length > 0 && <VerificationChecksList checks={checks} />}

              {screenshots && screenshots.length > 0 && (
                <VerificationScreenshotGrid screenshots={screenshots} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
