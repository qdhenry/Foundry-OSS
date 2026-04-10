"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";

export interface TourViewerProps {
  analysisId: string;
  orgId: string;
}

export function TourViewer({ analysisId, orgId }: TourViewerProps) {
  const { isAuthenticated } = useConvexAuth();
  const [selectedTourIndex, setSelectedTourIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const tours = useQuery(
    "codebaseAnalysis:getTours" as any,
    isAuthenticated && orgId ? { analysisId, orgId } : "skip",
  ) as any[] | undefined;

  const activeTour = tours?.[selectedTourIndex] ?? null;
  const steps = activeTour?.steps ?? [];
  const step = steps[currentStep] ?? null;
  const totalSteps = steps.length;

  function goToStep(index: number) {
    if (index >= 0 && index < totalSteps) {
      setCurrentStep(index);
    }
  }

  if (tours === undefined) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  if (!tours || tours.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-border-default bg-surface-secondary">
        <div className="text-center">
          <svg
            className="mx-auto mb-3 h-8 w-8 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
            />
          </svg>
          <p className="text-sm text-text-secondary">
            No guided tours available for this analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tour selector */}
      {tours.length > 1 && (
        <div>
          <label className="text-xs font-medium text-text-muted">Select Tour</label>
          <select
            value={selectedTourIndex}
            onChange={(e) => {
              setSelectedTourIndex(Number(e.target.value));
              setCurrentStep(0);
            }}
            className="mt-1 block w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default"
          >
            {tours.map((tour: any, index: number) => (
              <option key={index} value={index}>
                {tour.name ?? tour.title ?? `Tour ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tour header */}
      <div className="rounded-xl border border-border-default bg-surface-secondary p-5">
        <h3 className="text-sm font-semibold text-text-heading">
          {activeTour?.name ?? activeTour?.title ?? "Guided Tour"}
        </h3>
        {activeTour?.description && (
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            {activeTour.description}
          </p>
        )}
      </div>

      {/* Step content */}
      {step && (
        <div className="rounded-xl border border-border-default bg-surface-default p-6">
          {/* Step number */}
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-default text-xs font-bold text-white">
              {currentStep + 1}
            </span>
            <h4 className="text-sm font-semibold text-text-heading">
              {step.title ?? `Step ${currentStep + 1}`}
            </h4>
          </div>

          {/* Step explanation */}
          <div className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
            {step.explanation ?? step.description ?? step.content ?? ""}
          </div>

          {/* File reference */}
          {step.filePath && (
            <div className="mt-4 rounded-lg bg-surface-secondary px-3 py-2">
              <span className="text-xs font-medium text-text-muted">File: </span>
              <span className="text-xs font-mono text-text-primary">
                {step.filePath}
                {step.lineStart ? `:${step.lineStart}` : ""}
                {step.lineEnd ? `-${step.lineEnd}` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goToStep(currentStep - 1)}
          disabled={currentStep === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-xs font-medium text-text-primary transition-all duration-200 hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Previous
        </button>

        <span className="text-xs text-text-muted">
          Step {currentStep + 1} of {totalSteps}
        </span>

        <button
          onClick={() => goToStep(currentStep + 1)}
          disabled={currentStep >= totalSteps - 1}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-xs font-medium text-text-primary transition-all duration-200 hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Progress dots */}
      {totalSteps > 1 && (
        <div className="flex justify-center gap-1.5">
          {steps.map((_: any, index: number) => (
            <button
              key={index}
              onClick={() => goToStep(index)}
              className={`h-2 w-2 rounded-full transition-all duration-200 ${
                index === currentStep
                  ? "bg-accent-default scale-125"
                  : index < currentStep
                    ? "bg-status-success-fg/50"
                    : "bg-border-default"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
