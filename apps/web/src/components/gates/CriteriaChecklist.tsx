"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

interface Criterion {
  title: string;
  description?: string;
  passed: boolean;
  evidence?: string;
}

interface CriteriaChecklistProps {
  gateId: string;
  criteria: Criterion[];
  isEditable: boolean;
}

export function CriteriaChecklist({ gateId, criteria, isEditable }: CriteriaChecklistProps) {
  const evaluateCriterion = useMutation(api.sprintGates.evaluateCriterion);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [evidenceInputs, setEvidenceInputs] = useState<Record<number, string>>({});

  const passedCount = criteria.filter((c) => c.passed).length;
  const progressPercent =
    criteria.length > 0 ? Math.round((passedCount / criteria.length) * 100) : 0;

  async function handleToggle(index: number, currentPassed: boolean) {
    if (!isEditable) return;
    setLoadingIndex(index);
    try {
      await evaluateCriterion({
        gateId: gateId as any,
        criterionIndex: index,
        passed: !currentPassed,
        evidence: evidenceInputs[index] ?? criteria[index].evidence,
      });
    } finally {
      setLoadingIndex(null);
    }
  }

  async function handleEvidenceSave(index: number) {
    if (!isEditable) return;
    setLoadingIndex(index);
    try {
      await evaluateCriterion({
        gateId: gateId as any,
        criterionIndex: index,
        passed: criteria[index].passed,
        evidence: evidenceInputs[index] ?? criteria[index].evidence,
      });
    } finally {
      setLoadingIndex(null);
    }
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">Progress</span>
          <span className="text-text-secondary">
            {passedCount} of {criteria.length} passed ({progressPercent}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className={`h-full rounded-full transition-all ${
              progressPercent === 100 ? "bg-status-success-fg" : "bg-accent-default"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Criteria list */}
      <div className="space-y-3">
        {criteria.map((criterion, index) => (
          <div
            key={index}
            className={`rounded-lg border p-3 transition-colors ${
              criterion.passed
                ? "border-status-success-border bg-status-success-bg"
                : "border-border-default bg-surface-default"
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Toggle */}
              <button
                onClick={() => handleToggle(index, criterion.passed)}
                disabled={!isEditable || loadingIndex === index}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                  criterion.passed
                    ? "border-status-success-fg bg-status-success-fg text-text-on-brand"
                    : "border-border-default bg-surface-default"
                } ${isEditable ? "cursor-pointer hover:border-status-success-fg" : "cursor-default opacity-70"}`}
              >
                {loadingIndex === index ? (
                  <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                ) : criterion.passed ? (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    criterion.passed ? "text-status-success-fg" : "text-text-heading"
                  }`}
                >
                  {criterion.title}
                </p>
                {criterion.description && (
                  <p className="mt-0.5 text-xs text-text-secondary">{criterion.description}</p>
                )}

                {/* Evidence input */}
                {isEditable && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Evidence link or note..."
                      value={evidenceInputs[index] ?? criterion.evidence ?? ""}
                      onChange={(e) =>
                        setEvidenceInputs((prev) => ({ ...prev, [index]: e.target.value }))
                      }
                      onBlur={() => {
                        if (
                          evidenceInputs[index] !== undefined &&
                          evidenceInputs[index] !== criterion.evidence
                        ) {
                          handleEvidenceSave(index);
                        }
                      }}
                      className="input flex-1 px-2 py-1 text-xs"
                    />
                  </div>
                )}
                {!isEditable && criterion.evidence && (
                  <p className="mt-1 text-xs text-text-muted">Evidence: {criterion.evidence}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
