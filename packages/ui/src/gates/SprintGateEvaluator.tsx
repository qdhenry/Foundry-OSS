"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowRight, CheckCircle, Clock, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";

interface SprintGateEvaluatorProps {
  sprintId: string;
  programId: string;
}

const STATUS_ICON: Record<string, { icon: typeof CheckCircle; color: string }> = {
  pass: { icon: CheckCircle, color: "text-green-500" },
  fail: { icon: XCircle, color: "text-red-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500" },
  pending: { icon: Clock, color: "text-text-muted" },
};

const VERDICT_BADGE: Record<string, string> = {
  ready: "bg-status-success-bg text-status-success-fg",
  conditional: "bg-status-warning-bg text-status-warning-fg",
  needs_work: "bg-status-error-bg text-status-error-fg",
};

const IMPACT_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

export function SprintGateEvaluator({ sprintId, programId }: SprintGateEvaluatorProps) {
  const data = useQuery("sprintGateEvaluation:getLatestEvaluation" as any, {
    sprintId,
  });
  const evaluateGate = useMutation("sprintGateEvaluation:requestGateEvaluation" as any);

  const [evaluating, setEvaluating] = useState(false);

  async function handleEvaluate() {
    setEvaluating(true);
    try {
      await evaluateGate({ sprintId });
    } finally {
      setEvaluating(false);
    }
  }

  // Loading
  if (data === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-green-500" />
          <p className="text-sm text-text-secondary">Loading gate evaluation...</p>
        </div>
      </div>
    );
  }

  // No evaluation yet
  if (!data) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex flex-col items-center py-6">
          <ShieldCheck size={32} className="mb-3 text-text-muted" />
          <p className="text-sm font-medium text-text-heading">No gate evaluation available</p>
          <p className="mt-1 text-xs text-text-muted">
            Run an AI-powered sprint gate readiness check.
          </p>
          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className="mt-4 rounded-lg bg-status-success-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {evaluating ? "Evaluating..." : "Evaluate Gate"}
          </button>
        </div>
      </div>
    );
  }

  const evaluation = data.evaluation as {
    overall_readiness?: number;
    gate_criteria?: Array<{
      name: string;
      status: string;
      completion_percent: number;
      blockers?: string[];
    }>;
    critical_blockers?: Array<{
      description: string;
      impact_level: string;
      resolution_suggestion: string;
      estimated_fix_time?: string;
    }>;
    health_assessment?: {
      verdict: string;
      risk_summary: string;
      team_confidence: number;
      schedule_impact: string;
    };
    recommendations?: string[];
    next_steps?: string[];
  };

  const readiness = evaluation.overall_readiness ?? 0;
  const criteria = evaluation.gate_criteria ?? [];
  const blockers = evaluation.critical_blockers ?? [];
  const health = evaluation.health_assessment;
  const recommendations = evaluation.recommendations ?? [];
  const nextSteps = evaluation.next_steps ?? [];

  const readinessColor =
    readiness >= 80
      ? "text-status-success-fg"
      : readiness >= 50
        ? "text-status-warning-fg"
        : "text-status-error-fg";

  const readinessBarColor =
    readiness >= 80 ? "bg-green-500" : readiness >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-4">
      {/* Readiness Score */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text-heading">Overall Readiness</h4>
          <span className={`text-2xl font-bold ${readinessColor}`}>{Math.round(readiness)}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className={`h-full rounded-full transition-all ${readinessBarColor}`}
            style={{ width: `${Math.min(readiness, 100)}%` }}
          />
        </div>
      </div>

      {/* Gate Criteria */}
      {criteria.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 text-sm font-semibold text-text-heading">
            Gate Criteria ({criteria.length})
          </h4>
          <div className="space-y-3">
            {criteria.map((criterion, i) => {
              const statusInfo = STATUS_ICON[criterion.status] ?? STATUS_ICON.pending;
              const Icon = statusInfo.icon;
              return (
                <div key={i} className="rounded-lg border border-border-default p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={statusInfo.color} />
                      <p className="text-xs font-medium text-text-heading">{criterion.name}</p>
                    </div>
                    <span className="text-xs font-semibold text-text-secondary">
                      {Math.round(criterion.completion_percent)}%
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
                    <div
                      className={`h-full rounded-full ${
                        criterion.status === "pass"
                          ? "bg-green-500"
                          : criterion.status === "warning"
                            ? "bg-amber-500"
                            : criterion.status === "fail"
                              ? "bg-red-500"
                              : "bg-surface-elevated"
                      }`}
                      style={{
                        width: `${Math.min(criterion.completion_percent, 100)}%`,
                      }}
                    />
                  </div>
                  {criterion.blockers && criterion.blockers.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {criterion.blockers.map((blocker, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-1.5 text-[11px] text-status-error-fg"
                        >
                          <XCircle size={10} className="mt-0.5 shrink-0" />
                          {blocker}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Critical Blockers */}
      {blockers.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-status-error-bg p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-800">
            <XCircle size={16} />
            Critical Blockers ({blockers.length})
          </h4>
          <div className="space-y-3">
            {blockers.map((blocker, i) => (
              <div key={i} className="rounded-lg border border-red-200 bg-surface-default p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      IMPACT_BADGE[blocker.impact_level] ?? IMPACT_BADGE.medium
                    }`}
                  >
                    {blocker.impact_level}
                  </span>
                  {blocker.estimated_fix_time && (
                    <span className="text-[10px] text-text-muted">
                      ~{blocker.estimated_fix_time}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-primary">{blocker.description}</p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  <span className="font-medium">Resolution:</span> {blocker.resolution_suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health Assessment */}
      {health && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 text-sm font-semibold text-text-heading">Health Assessment</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Verdict:</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  VERDICT_BADGE[health.verdict] ?? VERDICT_BADGE.needs_work
                }`}
              >
                {health.verdict === "ready"
                  ? "Ready"
                  : health.verdict === "conditional"
                    ? "Conditional"
                    : "Needs Work"}
              </span>
            </div>
            <p className="text-xs text-text-primary">{health.risk_summary}</p>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-text-secondary">Team Confidence</span>
                <span className="font-semibold text-text-heading">
                  {Math.round(health.team_confidence * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className={`h-full rounded-full ${
                    health.team_confidence >= 0.8
                      ? "bg-green-500"
                      : health.team_confidence >= 0.5
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.round(health.team_confidence * 100)}%`,
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              <span className="font-medium">Schedule Impact:</span> {health.schedule_impact}
            </p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-status-success-bg p-4">
          <h4 className="mb-2 text-sm font-semibold text-green-800">Recommendations</h4>
          <ul className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-status-success-fg">
                <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-status-info-bg p-4">
          <h4 className="mb-2 text-sm font-semibold text-blue-800">Next Steps</h4>
          <ul className="space-y-1.5">
            {nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-accent-default">
                <ArrowRight size={10} className="mt-0.5 shrink-0" />
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Re-evaluate button */}
      <div className="flex justify-end">
        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="rounded-lg bg-status-success-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {evaluating ? "Evaluating..." : "Evaluate Gate"}
        </button>
      </div>
    </div>
  );
}
