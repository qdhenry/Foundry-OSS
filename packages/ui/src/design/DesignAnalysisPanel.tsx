"use client";

import { Download01, XClose } from "@untitledui/icons";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { toast } from "sonner";

interface DesignAnalysisPanelProps {
  assetId: string;
  assetName: string;
  programId: string;
  open: boolean;
  onClose: () => void;
}

export function DesignAnalysisPanel({
  assetId,
  assetName,
  programId,
  open,
  onClose,
}: DesignAnalysisPanelProps) {
  const analysis = useQuery(
    "designAnalyses:getByAsset" as any,
    open ? { designAssetId: assetId } : "skip",
  ) as any | null | undefined;

  const createFromAnalysis = useMutation("designTokenSets:createFromAnalysis" as any);

  async function handleUseAsTokens() {
    if (!analysis?._id) return;
    try {
      await createFromAnalysis({
        programId,
        analysisId: analysis._id,
        name: `Extracted from ${assetName}`,
      });
      toast.success("Design tokens created from analysis");
    } catch {
      toast.error("Failed to create tokens from analysis");
    }
  }

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const colors: any[] = analysis?.extractedColors ?? [];
  const typography: any[] = analysis?.extractedTypography ?? [];
  const components: any[] = analysis?.extractedComponents ?? [];
  const layout: any = analysis?.extractedLayout ?? null;
  const summary: string | undefined = analysis?.summary;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" aria-hidden="true" onClick={onClose} />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col border-l border-border-default bg-surface-default shadow-xl"
        role="dialog"
        aria-label={`Design analysis for ${assetName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h2 className="text-sm font-semibold text-text-heading truncate pr-4">{assetName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-interactive-subtle hover:text-text-primary"
            aria-label="Close panel"
          >
            <XClose size={18} />
          </button>
        </div>

        {/* Action Bar */}
        {analysis && analysis.extractedColors?.length > 0 && (
          <div className="border-b border-border-default px-5 py-3">
            <button
              onClick={handleUseAsTokens}
              className="btn-primary btn-sm inline-flex items-center gap-1.5 w-full justify-center"
            >
              <Download01 size={14} />
              Use as Design Tokens
            </button>
            <p className="text-[11px] text-text-muted mt-1.5 text-center">
              Creates a token set from these extracted colors and typography
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {analysis === undefined ? (
            <div className="flex items-center gap-2 py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
              <p className="text-sm text-text-secondary">Loading analysis...</p>
            </div>
          ) : analysis === null ? (
            <p className="text-sm text-text-muted py-4">No analysis available.</p>
          ) : (
            <>
              {/* Colors */}
              {colors.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Colors
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {colors.map((color: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-border-default p-2.5"
                      >
                        <div
                          className="h-8 w-8 shrink-0 rounded border border-border-default"
                          style={{ backgroundColor: color.hex ?? color.value }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">
                            {color.name ?? color.role ?? "Color"}
                          </p>
                          <p className="text-[11px] text-text-muted font-mono">
                            {color.hex ?? color.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Typography */}
              {typography.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Typography
                  </h3>
                  <div className="space-y-2">
                    {typography.map((typo: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border-default p-3">
                        <p className="text-xs font-semibold text-text-heading">
                          {typo.role ?? typo.name ?? `Style ${i + 1}`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-secondary">
                          {[typo.fontFamily, typo.fontSize && `${typo.fontSize}`, typo.fontWeight]
                            .filter(Boolean)
                            .join(" / ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Components */}
              {components.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Components ({components.length})
                  </h3>
                  <div className="space-y-2">
                    {components.map((comp: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border-default p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold text-text-heading">{comp.name}</p>
                          {comp.type && (
                            <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary">
                              {comp.type}
                            </span>
                          )}
                        </div>
                        {comp.description && (
                          <p className="text-[11px] text-text-secondary">{comp.description}</p>
                        )}
                        {comp.codeMatch && (
                          <p className="mt-1.5 text-[11px] text-accent-default">
                            Matched: {comp.codeMatch.componentName}
                            {comp.codeMatch.confidence != null &&
                              ` (${comp.codeMatch.confidence}%)`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Layout */}
              {layout && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Layout
                  </h3>
                  <div className="rounded-lg border border-border-default p-3 space-y-1.5">
                    {layout.type && (
                      <div className="flex gap-2 text-[11px]">
                        <span className="font-medium text-text-secondary w-24 shrink-0">Type</span>
                        <span className="text-text-primary">{layout.type}</span>
                      </div>
                    )}
                    {layout.columns != null && (
                      <div className="flex gap-2 text-[11px]">
                        <span className="font-medium text-text-secondary w-24 shrink-0">
                          Columns
                        </span>
                        <span className="text-text-primary">{layout.columns}</span>
                      </div>
                    )}
                    {layout.spacing && (
                      <div className="flex gap-2 text-[11px]">
                        <span className="font-medium text-text-secondary w-24 shrink-0">
                          Spacing
                        </span>
                        <span className="text-text-primary">{layout.spacing}</span>
                      </div>
                    )}
                    {layout.responsiveNotes && (
                      <div className="flex gap-2 text-[11px]">
                        <span className="font-medium text-text-secondary w-24 shrink-0">
                          Responsive
                        </span>
                        <span className="text-text-primary">{layout.responsiveNotes}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Full Analysis */}
              {summary && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Full Analysis
                  </h3>
                  <pre className="rounded-lg bg-surface-elevated p-3 text-[11px] text-text-primary whitespace-pre-wrap leading-relaxed">
                    {summary}
                  </pre>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
