"use client";

import { AlertTriangle, CheckCircle, MinusCircle, XCircle } from "lucide-react";

interface Check {
  _id: string;
  type: string;
  description: string;
  status: "passed" | "failed" | "warning" | "skipped";
  route?: string;
  expected?: string;
  actual?: string;
  aiExplanation?: string;
}

interface VerificationChecksListProps {
  checks: Check[];
}

const STATUS_ICON: Record<string, { icon: React.ElementType; className: string }> = {
  passed: { icon: CheckCircle, className: "text-status-success-fg" },
  failed: { icon: XCircle, className: "text-status-error-fg" },
  warning: { icon: AlertTriangle, className: "text-status-warning-fg" },
  skipped: { icon: MinusCircle, className: "text-text-muted" },
};

const TYPE_LABELS: Record<string, string> = {
  visual: "Visual",
  functional: "Functional",
  accessibility: "A11y",
  console_error: "Console",
  network_error: "Network",
};

export function VerificationChecksList({ checks }: VerificationChecksListProps) {
  if (checks.length === 0) return null;

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
        Checks ({checks.length})
      </h3>
      <div className="space-y-1">
        {checks.map((check) => {
          const { icon: Icon, className } = STATUS_ICON[check.status] ?? STATUS_ICON.skipped;
          return (
            <div
              key={check._id}
              className="group rounded-md px-2 py-1.5 hover:bg-surface-raised transition-colors"
            >
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${className}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary">{check.description}</span>
                    <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                      {TYPE_LABELS[check.type] ?? check.type}
                    </span>
                    {check.route && (
                      <span className="text-[10px] text-text-muted font-mono">{check.route}</span>
                    )}
                  </div>
                  {check.status === "failed" && (check.expected || check.actual) && (
                    <div className="mt-1 text-xs text-text-muted space-y-0.5">
                      {check.expected && (
                        <p>
                          Expected: <span className="text-text-secondary">{check.expected}</span>
                        </p>
                      )}
                      {check.actual && (
                        <p>
                          Actual: <span className="text-status-error-fg">{check.actual}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {check.aiExplanation && (
                    <p className="mt-1 text-xs text-text-muted italic">{check.aiExplanation}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
