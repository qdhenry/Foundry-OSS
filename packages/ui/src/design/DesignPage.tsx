"use client";

import { useOrganization } from "@clerk/nextjs";
import { DownloadCloud01, Palette, Trash01, Upload01 } from "@untitledui/icons";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { useProgramContext } from "../programs";
import { DesignAnalysisPanel } from "./DesignAnalysisPanel";
import { DesignTokenEditor } from "./DesignTokenEditor";
import { DesignUploadZone } from "./DesignUploadZone";
import { InteractionSpecTable } from "./InteractionSpecTable";

type ActiveView = "gallery" | "hierarchy";

const TYPE_LABELS: Record<string, string> = {
  screenshot: "Screenshot",
  tokens: "Tokens",
  styleGuide: "Style Guide",
  prototype: "Prototype",
  interactionSpec: "Interaction",
  animationSnippet: "Animation",
};

const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-status-info-bg text-status-info-fg",
  analyzing: "bg-status-info-bg text-status-info-fg",
  analyzed: "bg-status-success-bg text-status-success-fg",
  error: "bg-status-error-bg text-status-error-fg",
};

export function DesignPage() {
  const [activeView, setActiveView] = useState<ActiveView>("gallery");
  const [selectedAsset, setSelectedAsset] = useState<{ id: string; name: string } | null>(null);
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<string>("");
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>("");
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const { programId } = useProgramContext();

  const designAssets = useQuery(
    "designAssets:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as any[] | undefined;

  const tokenSets = useQuery(
    "designTokenSets:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as any[] | undefined;

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as any[] | undefined;

  const requirements = useQuery(
    "requirements:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as any[] | undefined;

  const removeAsset = useMutation("designAssets:remove" as any);

  const assetCount = designAssets?.length ?? 0;
  const tokenCount = tokenSets?.length ?? 0;
  const isEmpty = assetCount === 0 && tokenCount === 0;

  const filteredAssets = (designAssets || []).filter((asset: any) => {
    if (selectedWorkstreamId && asset.workstreamId !== selectedWorkstreamId) return false;
    if (selectedRequirementId && asset.requirementId !== selectedRequirementId) return false;
    return true;
  });

  async function handleDeleteAsset(e: React.MouseEvent, assetId: string, assetName: string) {
    e.stopPropagation(); // Don't open the analysis panel
    if (!confirm(`Delete "${assetName}"? This cannot be undone.`)) return;
    try {
      await removeAsset({ assetId });
      toast.success(`Deleted "${assetName}"`);
    } catch (_err) {
      toast.error("Failed to delete asset");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Design System</h1>
          <p className="text-sm text-text-secondary">
            {assetCount > 0 || tokenCount > 0
              ? `${assetCount} asset${assetCount !== 1 ? "s" : ""}, ${tokenCount} token set${tokenCount !== 1 ? "s" : ""}`
              : "Upload screenshots and design files to build your design context"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`btn-sm ${activeView === "gallery" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveView("gallery")}
          >
            Gallery
          </button>
          <button
            type="button"
            className={`btn-sm ${activeView === "hierarchy" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveView("hierarchy")}
          >
            Hierarchy
          </button>
        </div>
      </div>

      {/* Upload zone */}
      <DesignUploadZone
        orgId={orgId}
        programId={programId as string}
        workstreamId={selectedWorkstreamId || undefined}
        requirementId={selectedRequirementId || undefined}
      />

      {/* Scope filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-3 py-2">
        <label className="text-xs font-medium text-text-secondary">Scope</label>
        <select
          value={selectedWorkstreamId}
          onChange={(e) => {
            setSelectedWorkstreamId(e.target.value);
            setSelectedRequirementId("");
          }}
          className="h-7 rounded-md border border-border-default bg-surface-default px-2 text-xs text-text-primary outline-none focus:border-accent-default"
        >
          <option value="">All workstreams</option>
          {workstreams?.map((ws: any) => (
            <option key={ws._id} value={ws._id}>
              {ws.name}
            </option>
          ))}
        </select>
        <select
          value={selectedRequirementId}
          onChange={(e) => setSelectedRequirementId(e.target.value)}
          disabled={!selectedWorkstreamId}
          className="h-7 rounded-md border border-border-default bg-surface-default px-2 text-xs text-text-primary outline-none focus:border-accent-default disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">All requirements</option>
          {(requirements || [])
            .filter((r: any) => !selectedWorkstreamId || r.workstreamId === selectedWorkstreamId)
            .map((r: any) => (
              <option key={r._id} value={r._id}>
                {r.refId}: {r.title}
              </option>
            ))}
        </select>
        {(selectedWorkstreamId || selectedRequirementId) && (
          <button
            type="button"
            onClick={() => {
              setSelectedWorkstreamId("");
              setSelectedRequirementId("");
            }}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Clear
          </button>
        )}
        {selectedWorkstreamId && (
          <span className="ml-auto text-xs text-text-muted">
            Uploads will be scoped to:{" "}
            <span className="text-text-secondary">
              {workstreams?.find((ws: any) => ws._id === selectedWorkstreamId)?.name}
              {selectedRequirementId && requirements && (
                <> &gt; {requirements.find((r: any) => r._id === selectedRequirementId)?.title}</>
              )}
            </span>
          </span>
        )}
      </div>

      {/* Content */}
      {isEmpty ? (
        <div className="card border-dashed flex flex-col items-center justify-center py-16 text-center">
          <Palette size={48} className="mb-4 text-text-muted" />
          <h2 className="text-sm text-text-heading font-semibold">No design assets yet</h2>
          <p className="text-xs text-text-muted mt-1 max-w-sm">
            Upload screenshots, style guides, or design tokens to power AI-driven design context for
            your builds.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button type="button" className="btn-primary btn-sm inline-flex items-center gap-2">
              <Upload01 size={16} />
              Upload
            </button>
            <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-2">
              <DownloadCloud01 size={16} />
              Import
            </button>
          </div>
        </div>
      ) : activeView === "gallery" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAssets.map((asset: any) => (
            <div
              key={asset._id}
              className="card group overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedAsset({ id: asset._id, name: asset.name })}
            >
              {/* Thumbnail area */}
              <div className="relative flex h-40 items-center justify-center bg-interactive-subtle">
                {asset.type === "screenshot" && asset.fileUrl ? (
                  <img
                    src={asset.fileUrl}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Palette size={32} className="text-text-muted" />
                )}

                {/* Analyzing spinner overlay */}
                {asset.status === "analyzing" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}

                {/* Delete button — visible on hover */}
                <button
                  onClick={(e) => handleDeleteAsset(e, asset._id, asset.name)}
                  className="absolute right-2 top-2 rounded-lg bg-surface-default/80 p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-status-error-bg hover:text-status-error-fg group-hover:opacity-100"
                  title="Delete asset"
                >
                  <Trash01 size={16} />
                </button>
              </div>

              {/* Details */}
              <div className="space-y-2 p-4">
                <h3 className="text-sm text-text-heading font-medium truncate">{asset.name}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block rounded bg-interactive-subtle px-1.5 py-0.5 text-xs text-text-secondary">
                    {TYPE_LABELS[asset.type] ?? asset.type}
                  </span>
                  {asset.status === "analyzing" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-status-info-bg px-1.5 py-0.5 text-xs text-status-info-fg">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      analyzing
                    </span>
                  ) : (
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs ${STATUS_STYLES[asset.status] ?? ""}`}
                    >
                      {asset.status}
                    </span>
                  )}
                </div>
                {/* Scope labels */}
                {asset.workstreamId && (
                  <span className="text-xs text-text-secondary truncate">
                    {workstreams?.find((w: any) => w._id === asset.workstreamId)?.name}
                    {asset.requirementId && requirements && (
                      <>
                        {" "}
                        &gt; {requirements.find((r: any) => r._id === asset.requirementId)?.title}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-text-muted">
            Hierarchy view coming soon. This will display assets organized by workstream and
            requirement.
          </p>
        </div>
      )}
      {/* Token Editor */}
      {programId && <DesignTokenEditor programId={programId as string} />}

      {/* Interaction Specs */}
      {programId && <InteractionSpecTable programId={programId as string} orgId={orgId} />}

      {selectedAsset && (
        <DesignAnalysisPanel
          assetId={selectedAsset.id}
          assetName={selectedAsset.name}
          programId={programId as string}
          open={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}
