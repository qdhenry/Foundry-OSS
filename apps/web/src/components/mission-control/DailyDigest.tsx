"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface DailyDigestProps {
  programId: Id<"programs">;
  lastVisitTime: number;
}

export function DailyDigest({ programId, lastVisitTime }: DailyDigestProps) {
  const digestQuery = useQuery(api.missionControl.getDailyDigest, {
    programId,
    lastVisitTime,
  });

  const generateDigest = useAction(api.missionControlActions.generateDailyDigest);

  const [digest, setDigest] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  const triggerGeneration = useCallback(async () => {
    if (!digestQuery || digestQuery.source !== "generate" || !digestQuery.context) return;
    if (hasTriggered) return;

    setHasTriggered(true);
    setIsLoading(true);
    setError(null);

    try {
      const ctx = digestQuery.context;
      const timeDiffMs = Date.now() - ctx.lastVisitTime;
      const hours = Math.round(timeDiffMs / 3600000);
      const timeframe =
        hours < 1
          ? "Less than 1 hour"
          : hours < 24
            ? `${hours} hour${hours !== 1 ? "s" : ""}`
            : `${Math.round(hours / 24)} day${Math.round(hours / 24) !== 1 ? "s" : ""}`;

      const result = await generateDigest({
        orgId: ctx.orgId,
        programId: ctx.programId,
        userId: ctx.userId,
        changesSummary: JSON.stringify(ctx.changesSummary),
        workstreamSummary: JSON.stringify(ctx.workstreamSummary),
        taskSummary: JSON.stringify(ctx.taskSummary),
        timeframe,
      });

      if (result.success) {
        setDigest(result.digest);
      } else {
        setError(result.error ?? "Failed to generate digest");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [digestQuery, generateDigest, hasTriggered]);

  useEffect(() => {
    if (!digestQuery) return;

    if (digestQuery.source === "cache" && digestQuery.digest) {
      setDigest(digestQuery.digest);
      return;
    }

    if (digestQuery.source === "generate") {
      triggerGeneration();
    }
  }, [digestQuery, triggerGeneration]);

  return (
    <div className="rounded-lg border border-status-info-border bg-gradient-to-r from-status-info-bg to-status-info-bg p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-info-bg">
          <svg
            className="h-5 w-5 text-status-info-fg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="mb-2 text-lg font-semibold text-text-heading">Mission Control Pulse</h2>

          {isLoading && (
            <div className="mb-2 flex items-center gap-2 text-status-info-fg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-default opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-strong" />
              </span>
              <span className="text-sm">Analyzing your migration progress...</span>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-status-error-border bg-status-error-bg px-4 py-2 text-sm text-status-error-fg">
              {error}
            </div>
          )}

          {digest && <p className="text-base leading-relaxed text-text-primary">{digest}</p>}

          {!digest && !isLoading && !error && !digestQuery && (
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-3/4 rounded bg-surface-elevated" />
              <div className="h-4 w-1/2 rounded bg-surface-elevated" />
            </div>
          )}

          {digestQuery?.source === "cache" && digestQuery.metadata && (
            <div className="mt-3 flex items-center gap-3 text-xs text-status-info-fg">
              <span>{digestQuery.metadata.changeCount} changes analyzed</span>
              <span className="text-text-muted">|</span>
              <span>{digestQuery.metadata.workstreamsAffected} workstreams affected</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
