"use client";

import { useQuery } from "convex/react";
import { AlertTriangle, CheckCircle, FileText, Lightbulb, Plus } from "lucide-react";
import { useState } from "react";
import * as generatedApi from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface DocumentAnalysisSuggestionsProps {
  documentId: Id<"documents">;
  programId: Id<"programs">;
}

const api: any = (generatedApi as any).api;

const CONFIDENCE_BADGE: Record<string, string> = {
  high: "bg-status-success-bg text-status-success-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-surface-elevated text-text-secondary",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

export function DocumentAnalysisSuggestions({
  documentId,
  programId,
}: DocumentAnalysisSuggestionsProps) {
  const analysis = useQuery(api.documentAnalysis.getByDocument, {
    documentId,
  });

  const [acceptedRequirements, setAcceptedRequirements] = useState<Set<number>>(new Set());
  const [acceptedRisks, setAcceptedRisks] = useState<Set<number>>(new Set());

  // Loading state
  if (analysis === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          <p className="text-sm text-text-secondary">Analyzing document...</p>
        </div>
      </div>
    );
  }

  // No analysis or pending
  if (!analysis || analysis.status !== "complete" || !analysis.findings) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default p-6">
        <div className="flex flex-col items-center py-6">
          <FileText size={32} className="mb-3 text-text-muted" />
          <p className="text-sm font-medium text-text-heading">
            {analysis?.status === "queued" ||
            analysis?.status === "extracting" ||
            analysis?.status === "analyzing"
              ? "Analysis in progress..."
              : "No analysis available"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {analysis?.status === "failed"
              ? "Analysis failed. Try again."
              : "Upload and analyze a document to see AI suggestions."}
          </p>
        </div>
      </div>
    );
  }

  const findings = analysis.findings as {
    requirements?: Array<{
      data: {
        title: string;
        description: string;
        priority?: string;
        fitGap?: string;
        suggestedWorkstream?: string;
        rationale?: string;
      };
      confidence: "high" | "medium" | "low";
      sourceExcerpt?: string;
    }>;
    risks?: Array<{
      data: {
        title: string;
        description: string;
        severity: string;
        probability?: string;
        mitigation?: string;
        affectedWorkstreams?: string[];
      };
      confidence: "high" | "medium" | "low";
    }>;
    decisions?: Array<{
      data: {
        title: string;
        description: string;
        impact?: string;
        category?: string;
      };
      confidence: "high" | "medium" | "low";
    }>;
    summary?: string;
    confidence?: string;
  };

  const requirements = findings.requirements ?? [];
  const risks = findings.risks ?? [];
  const decisions = findings.decisions ?? [];

  const totalFindings = requirements.length + risks.length + decisions.length;

  function handleAcceptRequirement(index: number) {
    setAcceptedRequirements((prev) => new Set(prev).add(index));
  }

  function handleAcceptRisk(index: number) {
    setAcceptedRisks((prev) => new Set(prev).add(index));
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-xl border border-green-200 bg-status-success-bg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle size={18} className="text-status-success-fg" />
          <h3 className="text-sm font-semibold text-green-800">AI Analysis Complete</h3>
        </div>
        <p className="mt-1 text-xs text-status-success-fg">
          Found {totalFindings} finding{totalFindings !== 1 ? "s" : ""}: {requirements.length}{" "}
          requirement{requirements.length !== 1 ? "s" : ""}, {risks.length} risk
          {risks.length !== 1 ? "s" : ""}, {decisions.length} decision
          {decisions.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {/* Suggested Requirements */}
      {requirements.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <Plus size={16} className="text-accent-default" />
            Suggested Requirements ({requirements.length})
          </h4>
          <div className="space-y-3">
            {requirements.map((req, i) => {
              const isAccepted = acceptedRequirements.has(i);
              const confidenceLevel = req.confidence ?? "medium";

              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    isAccepted ? "border-green-200 bg-status-success-bg" : "border-border-default"
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h5 className="text-sm font-medium text-text-heading">{req.data.title}</h5>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          CONFIDENCE_BADGE[confidenceLevel]
                        }`}
                      >
                        {confidenceLevel}
                      </span>
                      {req.data.priority && (
                        <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-[10px] font-medium text-accent-default">
                          {req.data.priority.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary">{req.data.description}</p>
                  {req.sourceExcerpt && (
                    <p className="mt-1.5 rounded bg-surface-raised px-2 py-1 text-[11px] italic text-text-muted">
                      &ldquo;{req.sourceExcerpt}&rdquo;
                    </p>
                  )}
                  <div className="mt-2">
                    <button
                      onClick={() => handleAcceptRequirement(i)}
                      disabled={isAccepted}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                        isAccepted
                          ? "cursor-default bg-status-success-bg text-status-success-fg"
                          : "bg-status-warning-bg text-status-warning-fg hover:bg-amber-100"
                      }`}
                    >
                      {isAccepted ? "Added" : "Add Requirement"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk Indicators */}
      {risks.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <AlertTriangle size={16} className="text-accent-default" />
            Risk Indicators ({risks.length})
          </h4>
          <div className="space-y-3">
            {risks.map((risk, i) => {
              const isAccepted = acceptedRisks.has(i);
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    isAccepted ? "border-green-200 bg-status-success-bg" : "border-border-default"
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h5 className="text-sm font-medium text-text-heading">{risk.data.title}</h5>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        SEVERITY_BADGE[risk.data.severity] ?? SEVERITY_BADGE.medium
                      }`}
                    >
                      {risk.data.severity}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">{risk.data.description}</p>
                  {risk.data.mitigation && (
                    <p className="mt-1.5 text-xs text-text-primary">
                      <span className="font-medium">Mitigation:</span> {risk.data.mitigation}
                    </p>
                  )}
                  <div className="mt-2">
                    <button
                      onClick={() => handleAcceptRisk(i)}
                      disabled={isAccepted}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                        isAccepted
                          ? "cursor-default bg-status-success-bg text-status-success-fg"
                          : "bg-status-warning-bg text-status-warning-fg hover:bg-amber-100"
                      }`}
                    >
                      {isAccepted ? "Logged" : "Log as Risk"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Decisions */}
      {decisions.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-default p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
            <Lightbulb size={16} className="text-accent-default" />
            Key Decisions ({decisions.length})
          </h4>
          <ul className="space-y-2">
            {decisions.map((decision, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-primary">
                <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                <div>
                  <span className="font-medium text-text-heading">{decision.data.title}</span>
                  {decision.data.description && (
                    <span className="ml-1 text-text-secondary">— {decision.data.description}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
