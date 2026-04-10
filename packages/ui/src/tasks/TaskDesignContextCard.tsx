"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

interface TaskDesignContextCardProps {
  taskId: string;
  programId: string;
  programSlug?: string;
}

export function TaskDesignContextCard({
  taskId,
  programId,
  programSlug,
}: TaskDesignContextCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  const snapshot = useQuery("taskDesignSnapshots:getByTask" as any, taskId ? { taskId } : "skip");
  const refreshSnapshot = useMutation("taskDesignSnapshots:refreshForTask" as any);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshSnapshot({ taskId });
    } catch (e) {
      console.error("Failed to refresh design snapshot:", e);
    } finally {
      setRefreshing(false);
    }
  }

  if (snapshot === undefined) return null; // loading

  // Build the design page link using slug if available, else programId
  const designPageHref = `/${programSlug || programId}/design`;

  if (snapshot === null) {
    return (
      <div className="card border-dashed px-4 py-6 text-center">
        <svg
          className="mx-auto mb-2 h-8 w-8 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
          />
        </svg>
        <p className="text-sm text-text-secondary">No design context attached</p>
        <p className="mt-1 text-xs text-text-muted">
          Upload design assets on the{" "}
          <a
            href={designPageHref}
            className="font-medium text-accent-default hover:text-accent-strong"
          >
            Design page
          </a>{" "}
          to enable design-aware AI execution.
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="mt-3 rounded-md bg-accent-default px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {refreshing ? "Syncing..." : "Sync Design Context"}
        </button>
      </div>
    );
  }

  // Parse resolved tokens to show color swatches
  let colors: Array<{ name: string; hex: string }> = [];
  try {
    const tokens = JSON.parse(snapshot.resolvedTokens);
    const colorsObj = tokens.colors || tokens.color || {};
    if (Array.isArray(colorsObj)) {
      colors = colorsObj.slice(0, 6).map((c: any) => ({
        name: c.name || "color",
        hex: c.hex || c.value || "#000",
      }));
    } else if (typeof colorsObj === "object") {
      colors = Object.entries(colorsObj)
        .slice(0, 6)
        .map(([name, val]: [string, any]) => ({
          name,
          hex: typeof val === "string" ? val : val?.value || val?.hex || "#000",
        }));
    }
  } catch {
    // ignore parse errors
  }

  // Count components
  let componentCount = 0;
  try {
    const comps = JSON.parse(snapshot.resolvedComponents);
    if (Array.isArray(comps)) componentCount = comps.length;
  } catch {
    // ignore parse errors
  }

  const assetCount = snapshot.assetIds?.length ?? 0;
  const hasTokenSet = !!snapshot.tokenSetId;

  return (
    <div className="card space-y-0 overflow-hidden">
      {/* Header — always visible, acts as collapse toggle */}
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-interactive-hover"
      >
        <div className="flex items-center gap-2">
          {/* Paintbrush icon */}
          <svg
            className="h-4 w-4 text-accent-default"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
            />
          </svg>
          <h3 className="text-sm font-semibold text-text-primary">Design Context</h3>
        </div>
        <div className="flex items-center gap-2">
          {snapshot.degraded && (
            <span className="rounded bg-status-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-status-warning-fg">
              Degraded
            </span>
          )}
          <span className="text-xs text-text-muted">v{snapshot.snapshotVersion}</span>
          {/* Chevron */}
          <svg
            className={`h-4 w-4 text-text-muted transition-transform ${collapsed ? "" : "rotate-180"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="space-y-3 border-t border-border-default px-4 pb-4 pt-3">
          {/* Stats row */}
          <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"
                />
              </svg>
              {assetCount} asset{assetCount !== 1 ? "s" : ""}
            </span>
            {hasTokenSet && (
              <span className="flex items-center gap-1">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125V6.75M6.75 21h10.5A2.25 2.25 0 0019.5 18.75V10.5m-9.402 9.402l6.402-6.402M19.5 10.5l-6.401 6.402M19.5 10.5V4.125c0-.621-.504-1.125-1.125-1.125h-5.25c-.621 0-1.125.504-1.125 1.125v3"
                  />
                </svg>
                Token set
              </span>
            )}
            {componentCount > 0 && (
              <span className="flex items-center gap-1">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25L12 17.25 2.25 12l4.179-2.25"
                  />
                </svg>
                {componentCount} component{componentCount !== 1 ? "s" : ""}
              </span>
            )}
            {snapshot.interactionSpecs && (
              <span className="flex items-center gap-1">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
                  />
                </svg>
                Interactions
              </span>
            )}
          </div>

          {/* Degraded warning */}
          {snapshot.degraded && (
            <div className="flex items-start gap-2 rounded-lg bg-status-warning-bg px-3 py-2">
              <svg
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning-fg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              <p className="text-[11px] text-status-warning-fg">
                Some design data was unavailable when this snapshot was created. Results may not
                fully reflect the intended design.
              </p>
            </div>
          )}

          {/* Color swatches */}
          {colors.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Colors
              </p>
              <div className="flex gap-1.5">
                {colors.map((c, i) => (
                  <div key={i} className="group relative">
                    <div
                      className="h-6 w-6 rounded-full border border-border-default shadow-sm"
                      style={{ backgroundColor: c.hex }}
                      title={`${c.name}: ${c.hex}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer: timestamp + actions */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-text-muted">
              Snapshot frozen{" "}
              {new Date(snapshot.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-[11px] font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                {refreshing ? "Syncing..." : "Refresh"}
              </button>
              <a
                href={designPageHref}
                className="text-[11px] font-medium text-accent-default hover:text-accent-strong"
              >
                View design assets
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
