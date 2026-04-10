"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ChevronRight, Shield, TrendingUp, Zap } from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface RiskAssessmentPanelProps {
  programId: Id<"programs">;
  changeType?: string;
  changeContext?: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-status-warning-bg text-status-warning-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

const PROBABILITY_BADGE: Record<string, string> = {
  very_likely: "bg-status-error-bg text-status-error-fg",
  likely: "bg-status-warning-bg text-status-warning-fg",
  possible: "bg-status-warning-bg text-status-warning-fg",
  unlikely: "bg-surface-raised text-text-secondary",
};

const _IMPACT_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-status-warning-bg text-status-warning-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

export function RiskAssessmentPanel({
  programId,
  changeType,
  changeContext,
}: RiskAssessmentPanelProps) {
  const data = useQuery(api.riskAutogeneration.getLatestAssessment, {
    programId,
  });
  const evaluateRisks = useMutation(api.riskAutogeneration.requestRiskEvaluation);

  const [evaluating, setEvaluating] = useState(false);

  async function handleEvaluate() {
    setEvaluating(true);
    try {
      await evaluateRisks({
        programId,
        changeType: changeType ?? "manual_review",
      });
    } finally {
      setEvaluating(false);
    }
  }

  // Loading
  if (data === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          <p className="text-sm text-text-secondary">Loading risk assessment...</p>
        </div>
      </div>
    );
  }

  // No assessment yet
  if (!data) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex flex-col items-center py-6">
          <Shield size={32} className="mb-3 text-accent-default" />
          <p className="text-sm font-medium text-text-heading">No risk assessment available</p>
          <p className="mt-1 text-xs text-text-muted">
            Run an AI-powered risk evaluation for this program.
          </p>
          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {evaluating ? "Evaluating..." : "Evaluate Risks"}
          </button>
        </div>
      </div>
    );
  }

  const assessment = data.assessment as {
    change_impact_summary?:
      | string
      | { overall_risk_level: string; confidence: string; summary: string };
    new_risks?: Array<{
      title: string;
      severity: string;
      probability: string;
      description: string;
      mitigation?: string;
    }>;
    escalations?: Array<{
      existing_risk_id: string;
      new_severity: string;
      rationale: string;
    }>;
    cascade_impacts?: Array<{
      impact_type: string;
      description: string;
      affected_area: string;
    }>;
    recommendations?: string[];
  };

  const newRisks = assessment.new_risks ?? [];
  const escalations = assessment.escalations ?? [];
  const cascadeImpacts = assessment.cascade_impacts ?? [];
  const recommendations = assessment.recommendations ?? [];

  return (
    <div className="space-y-4">
      {/* Change Impact Summary */}
      {assessment.change_impact_summary && (
        <div className="rounded-xl border border-status-warning-border bg-status-warning-bg p-4">
          <h4 className="mb-1 text-sm font-semibold text-status-warning-fg">
            Change Impact Summary
          </h4>
          <p className="text-xs text-status-warning-fg">
            {typeof assessment.change_impact_summary === "string"
              ? assessment.change_impact_summary
              : assessment.change_impact_summary.summary}
          </p>
          {typeof assessment.change_impact_summary === "object" && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  SEVERITY_BADGE[assessment.change_impact_summary.overall_risk_level] ??
                  SEVERITY_BADGE.medium
                }`}
              >
                {assessment.change_impact_summary.overall_risk_level}
              </span>
              <span className="text-[10px] text-status-warning-fg">
                Confidence: {assessment.change_impact_summary.confidence}
              </span>
            </div>
          )}
        </div>
      )}

      {/* New Risks */}
      {newRisks.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <AlertTriangle size={16} className="text-status-error-fg" />
            New Risks ({newRisks.length})
          </h4>
          <div className="space-y-3">
            {newRisks.map((risk, i) => (
              <div key={i} className="rounded-lg border border-border-default p-3">
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <h5 className="text-xs font-medium text-text-heading">{risk.title}</h5>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        SEVERITY_BADGE[risk.severity] ?? SEVERITY_BADGE.medium
                      }`}
                    >
                      {risk.severity}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        PROBABILITY_BADGE[risk.probability] ?? PROBABILITY_BADGE.possible
                      }`}
                    >
                      {risk.probability}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-text-secondary">{risk.description}</p>
                {risk.mitigation && (
                  <p className="mt-1.5 text-[11px] text-text-primary">
                    <span className="font-medium">Mitigation:</span> {risk.mitigation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escalations */}
      {escalations.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <TrendingUp size={16} className="text-status-warning-fg" />
            Escalations ({escalations.length})
          </h4>
          <div className="space-y-2">
            {escalations.map((esc, i) => (
              <div
                key={i}
                className="rounded-lg border border-status-warning-border bg-status-warning-bg p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-text-secondary">
                    {esc.existing_risk_id}
                  </span>
                  <ChevronRight size={12} className="text-text-muted" />
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      SEVERITY_BADGE[esc.new_severity] ?? SEVERITY_BADGE.medium
                    }`}
                  >
                    {esc.new_severity}
                  </span>
                </div>
                <p className="text-[11px] text-text-primary">{esc.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cascade Impacts */}
      {cascadeImpacts.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <Zap size={16} className="text-emerald-500" />
            Cascade Impacts ({cascadeImpacts.length})
          </h4>
          <div className="space-y-2">
            {cascadeImpacts.map((impact, i) => (
              <div key={i} className="rounded-lg border border-border-default p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-medium text-status-success-fg">
                    {impact.impact_type}
                  </span>
                  <span className="text-[11px] text-text-muted">{impact.affected_area}</span>
                </div>
                <p className="text-[11px] text-text-primary">{impact.description}</p>
              </div>
            ))}
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

      {/* Re-evaluate button */}
      <div className="flex justify-end">
        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {evaluating ? "Evaluating..." : "Evaluate Risks"}
        </button>
      </div>
    </div>
  );
}
