"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface DailyDigestProps {
  programId: string;
  lastVisitTime: number;
}

type DailyDigestMetadata = {
  changeCount: number;
  workstreamsAffected: number;
};

type DailyDigestContext = {
  orgId: string;
  programId: string;
  userId: string;
  changesSummary: unknown;
  workstreamSummary: unknown;
  taskSummary: unknown;
  lastVisitTime: number;
};

type DailyDigestQueryResult =
  | {
      digest: string;
      source: "cache";
      metadata?: DailyDigestMetadata;
    }
  | {
      digest: null;
      source: "generate";
      context?: DailyDigestContext;
    }
  | null
  | undefined;

type GenerateDigestResult = {
  success: boolean;
  digest: string;
  error?: string;
};

type GenerateDigestArgs = {
  orgId: string;
  programId: string;
  userId: string;
  changesSummary: string;
  workstreamSummary: string;
  taskSummary: string;
  timeframe: string;
};

// Minimum time (ms) to show loading on refresh so the user always sees feedback
const MIN_REFRESH_MS = 800;

export function DailyDigest({ programId, lastVisitTime }: DailyDigestProps) {
  const [queryTimestamp, setQueryTimestamp] = useState(lastVisitTime);

  const digestQuery = useQuery("missionControl:getDailyDigest" as any, {
    programId,
    lastVisitTime: queryTimestamp,
  }) as DailyDigestQueryResult;

  const generateDigest = useAction("missionControlActions:generateDailyDigest" as any) as (
    args: GenerateDigestArgs,
  ) => Promise<GenerateDigestResult>;

  const [digest, setDigest] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  // Use refs for refresh tracking — immune to React batching/stale closure issues
  const isRefreshingRef = useRef(false);
  const refreshStartRef = useRef(0);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showRefreshSuccess = useCallback(() => {
    setShowLoading(false);
    setRefreshSuccess(true);
    clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setRefreshSuccess(false), 3000);
  }, []);

  const triggerGeneration = useCallback(
    async (context: DailyDigestContext) => {
      setIsLoading(true);
      setError(null);

      try {
        const timeDiffMs = Date.now() - context.lastVisitTime;
        const hours = Math.round(timeDiffMs / 3600000);
        const timeframe =
          hours < 1
            ? "Less than 1 hour"
            : hours < 24
              ? `${hours} hour${hours !== 1 ? "s" : ""}`
              : `${Math.round(hours / 24)} day${Math.round(hours / 24) !== 1 ? "s" : ""}`;

        const result = await generateDigest({
          orgId: context.orgId,
          programId: context.programId,
          userId: context.userId,
          changesSummary: JSON.stringify(context.changesSummary),
          workstreamSummary: JSON.stringify(context.workstreamSummary),
          taskSummary: JSON.stringify(context.taskSummary),
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
    },
    [generateDigest],
  );

  // Handle query results
  useEffect(() => {
    if (!digestQuery) return;

    if (digestQuery.source === "cache" && digestQuery.digest) {
      if (isRefreshingRef.current) {
        // Refresh got instant cache hit — hold loading for min duration, then show success
        const pendingDigest = digestQuery.digest;
        const elapsed = Date.now() - refreshStartRef.current;
        const remaining = Math.max(0, MIN_REFRESH_MS - elapsed);

        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = setTimeout(() => {
          isRefreshingRef.current = false;
          setDigest(pendingDigest);
          showRefreshSuccess();
        }, remaining);
      } else {
        setDigest(digestQuery.digest);
      }
      return;
    }

    if (digestQuery.source === "generate" && digestQuery.context) {
      if (!hasTriggered) {
        setHasTriggered(true);
        const wasRefreshing = isRefreshingRef.current;
        void triggerGeneration(digestQuery.context).then(() => {
          if (wasRefreshing) {
            const elapsed = Date.now() - refreshStartRef.current;
            const remaining = Math.max(0, MIN_REFRESH_MS - elapsed);
            clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = setTimeout(() => {
              isRefreshingRef.current = false;
              showRefreshSuccess();
            }, remaining);
          }
        });
      }
    }
  }, [digestQuery, triggerGeneration, hasTriggered, showRefreshSuccess]);

  const handleRefresh = useCallback(() => {
    isRefreshingRef.current = true;
    refreshStartRef.current = Date.now();
    setShowLoading(true);
    setRefreshSuccess(false);
    setError(null);
    setDigest("");
    setHasTriggered(false);
    setQueryTimestamp(Date.now());
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(successTimerRef.current);
      clearTimeout(loadingTimerRef.current);
    };
  }, []);

  const isActive = showLoading || isLoading;

  return (
    <div className="rounded-lg border border-status-info-border bg-gradient-to-r from-status-info-bg to-status-info-bg p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-info-bg">
          <svg
            className="h-5 w-5 text-status-info-fg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-heading">Mission Control Pulse</h2>
            {refreshSuccess ? (
              <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-status-success-fg">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Updated
              </span>
            ) : (
              <button
                onClick={handleRefresh}
                disabled={isActive}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-status-info-fg transition-colors hover:bg-status-info-bg/60 disabled:cursor-not-allowed disabled:opacity-50"
                title="Refresh pulse with latest data"
              >
                <svg
                  className={`h-3.5 w-3.5 ${isActive ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                  />
                </svg>
                {isActive ? "Refreshing..." : "Refresh"}
              </button>
            )}
          </div>

          {isActive && (
            <div className="mb-2 flex items-center gap-2 text-status-info-fg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-default opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-strong" />
              </span>
              <span className="text-sm">Analyzing your migration progress...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between rounded-md border border-status-error-border bg-status-error-bg px-4 py-2">
              <span className="text-sm text-status-error-fg">{error}</span>
              <button
                onClick={handleRefresh}
                className="ml-3 shrink-0 rounded px-2 py-1 text-xs font-medium text-status-error-fg transition-colors hover:bg-status-error-bg/80"
              >
                Retry
              </button>
            </div>
          )}

          {digest && !isActive && (
            <div
              className={[
                "prose prose-sm max-w-none text-text-primary",
                "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-text-heading [&_h1]:mb-2 [&_h1]:mt-3",
                "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-text-heading [&_h2]:mb-1.5 [&_h2]:mt-2.5",
                "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-text-heading [&_h3]:mb-1 [&_h3]:mt-2",
                "[&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2 [&_p]:last:mb-0",
                "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ul]:text-sm",
                "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_ol]:text-sm",
                "[&_li]:mb-1 [&_li]:text-sm [&_li]:leading-relaxed",
                "[&_strong]:font-semibold [&_strong]:text-text-heading",
                "[&_em]:italic",
                "[&_hr]:border-status-info-border [&_hr]:my-3",
                "[&_blockquote]:border-l-2 [&_blockquote]:border-status-info-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-text-secondary",
              ].join(" ")}
            >
              <ReactMarkdown>{digest}</ReactMarkdown>
            </div>
          )}

          {!digest && !error && (isActive || !digestQuery) && (
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-3/4 rounded bg-surface-elevated" />
              <div className="h-4 w-full rounded bg-surface-elevated" />
              <div className="h-4 w-1/2 rounded bg-surface-elevated" />
            </div>
          )}

          {!isActive && digestQuery?.source === "cache" && digestQuery.metadata && (
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
