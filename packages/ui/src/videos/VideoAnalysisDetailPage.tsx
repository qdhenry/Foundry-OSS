"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useProgramContext } from "../programs";
import { AnalysisCompletionCard } from "./AnalysisCompletionCard";
import { PipelineProgress } from "./PipelineProgress";
import { VideoActivityFeed } from "./VideoActivityFeed";

const STATUS_LABELS: Record<string, string> = {
  uploading: "Uploading",
  indexing: "Indexing",
  analyzing: "Analyzing",
  complete: "Complete",
  failed: "Failed",
  extracting: "Indexing",
  transcribing: "Indexing",
  classifying_frames: "Indexing",
  awaiting_speakers: "Analyzing",
  synthesizing: "Analyzing",
};

const STATUS_STYLES: Record<string, string> = {
  uploading: "badge badge-warning",
  indexing: "badge badge-warning",
  analyzing: "badge badge-info",
  complete: "badge badge-success",
  failed: "badge badge-error",
  extracting: "badge badge-warning",
  transcribing: "badge badge-warning",
  classifying_frames: "badge badge-warning",
  awaiting_speakers: "badge badge-info",
  synthesizing: "badge badge-info",
};

const DEFAULT_STATUS_STYLE = "badge";

export function VideoAnalysisDetailPage() {
  const params = useParams();
  const analysisId = params.analysisId as string;
  const { programId, slug } = useProgramContext();

  const analysis = useQuery("videoAnalysis:get" as any, {
    analysisId: analysisId as any,
  });
  const activityLogs = useQuery("videoAnalysis:getActivityLogsByAnalysis" as any, {
    analysisId: analysisId as any,
  });
  const videoFindings = useQuery(
    "videoAnalysis:getVideoFindingsByAnalysis" as any,
    analysis?.status === "complete" ? { analysisId: analysisId as any } : "skip",
  );

  if (analysis === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
        </div>
      </div>
    );
  }

  const status = analysis.status ?? "unknown";
  const statusLabel = STATUS_LABELS[status] ?? status.replaceAll("_", " ");
  const statusClasses = STATUS_STYLES[status] ?? DEFAULT_STATUS_STYLE;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href={`/${slug}/videos`}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Videos
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="type-display-m text-text-heading">Video Analysis</h1>
        <span className={`${statusClasses}`}>{statusLabel}</span>
      </div>

      <PipelineProgress
        status={status}
        stageTimestamps={analysis.stageTimestamps as Record<string, number | undefined> | undefined}
        failedStage={analysis.failedStage}
        failedError={analysis.failedError}
      />

      {status === "complete" && (
        <AnalysisCompletionCard
          programId={String(programId)}
          videoFindings={videoFindings}
          analysis={{
            durationMs: analysis.durationMs,
            totalTokensUsed: analysis.totalTokensUsed,
            videoDurationMs: analysis.videoDurationMs,
            stageTimestamps: analysis.stageTimestamps as { completedAt?: number } | undefined,
          }}
        />
      )}

      <VideoActivityFeed logs={activityLogs} />
    </div>
  );
}

export default VideoAnalysisDetailPage;
