"use client";

import Link from "next/link";
import { useProgramContext } from "../programs";

type AnalysisRecord = {
  _id: string;
  _creationTime?: number;
  status?: string;
  failedError?: string;
  failedStage?: string;
  segmentOutputs?: unknown[];
  synthesisOutput?: unknown;
};

type KeyframeItem = {
  imageUrl: string;
  timestampMs?: number;
  caption?: string;
};

type FindingItem = {
  type: string;
  title: string;
  excerpt?: string;
  timestampMs?: number;
};

type GallerySection = {
  id: string;
  title: string;
  summary?: string;
  startMs?: number;
  endMs?: number;
  keyframes: KeyframeItem[];
  findings: FindingItem[];
};

type GalleryGroup = {
  analysisId: string;
  status: string;
  createdAt?: number;
  sections: GallerySection[];
  failedError?: string;
  failedStage?: string;
};

interface VisualDiscoveryGalleryProps {
  programId: string;
  analyses: AnalysisRecord[] | undefined;
}

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
  uploading: "bg-status-warning-bg text-status-warning-fg",
  indexing: "bg-status-warning-bg text-status-warning-fg",
  analyzing: "bg-status-info-bg text-accent-default",
  complete: "bg-status-success-bg text-status-success-fg",
  failed: "bg-status-error-bg text-status-error-fg",
  extracting: "bg-status-warning-bg text-status-warning-fg",
  transcribing: "bg-status-warning-bg text-status-warning-fg",
  classifying_frames: "bg-status-warning-bg text-status-warning-fg",
  awaiting_speakers: "bg-status-info-bg text-accent-default",
  synthesizing: "bg-status-info-bg text-accent-default",
};

const FINDING_TYPE_LABELS: Record<string, string> = {
  requirement: "Requirement",
  risk: "Risk",
  integration: "Integration",
  decision: "Decision",
  action_item: "Action Item",
};

const FINDING_TYPE_STYLES: Record<string, string> = {
  requirement: "bg-status-info-bg text-accent-default",
  risk: "bg-status-error-bg text-status-error-fg",
  integration: "bg-teal-100 text-teal-700",
  decision: "bg-status-warning-bg text-status-warning-fg",
  action_item: "bg-status-success-bg text-status-success-fg",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeKeyframes(segment: Record<string, unknown>): KeyframeItem[] {
  const structured = Array.isArray(segment.keyframes) ? segment.keyframes : [];
  const normalizedStructured = structured
    .map((entry): KeyframeItem | null => {
      const parsed = asRecord(entry);
      if (!parsed) return null;
      const imageUrl =
        typeof parsed.imageUrl === "string"
          ? parsed.imageUrl
          : typeof parsed.frameUrl === "string"
            ? parsed.frameUrl
            : null;
      if (!imageUrl) return null;
      const timestampMs =
        typeof parsed.timestampMs === "number"
          ? parsed.timestampMs
          : typeof segment.startMs === "number"
            ? segment.startMs
            : undefined;
      const caption = typeof parsed.caption === "string" ? parsed.caption : undefined;
      return {
        imageUrl,
        ...(typeof timestampMs === "number" ? { timestampMs } : {}),
        ...(typeof caption === "string" ? { caption } : {}),
      };
    })
    .filter((item): item is KeyframeItem => item !== null);

  const keyframeUrlList = Array.isArray(segment.keyframeUrls)
    ? segment.keyframeUrls
    : Array.isArray(segment.sourceKeyframeUrls)
      ? segment.sourceKeyframeUrls
      : [];

  const normalizedUrlList = keyframeUrlList
    .filter((entry): entry is string => typeof entry === "string")
    .map((url): KeyframeItem => {
      const timestampMs = typeof segment.startMs === "number" ? segment.startMs : undefined;
      return {
        imageUrl: url,
        ...(typeof timestampMs === "number" ? { timestampMs } : {}),
      };
    });

  const merged = [...normalizedStructured, ...normalizedUrlList];
  const deduped = new Map<string, KeyframeItem>();
  for (const frame of merged) {
    if (!deduped.has(frame.imageUrl)) {
      deduped.set(frame.imageUrl, frame);
    }
  }

  return Array.from(deduped.values());
}

function getFindingGroups(
  segment: Record<string, unknown>,
): Array<{ key: string; value: unknown[] }> {
  const groups: Array<{ key: string; value: unknown[] }> = [];
  const groupKeys = [
    "findings",
    "requirements",
    "risks",
    "integrations",
    "decisions",
    "action_items",
    "actionItems",
    "synthesizedFindings",
  ];

  for (const key of groupKeys) {
    const raw = segment[key];
    if (Array.isArray(raw)) {
      groups.push({ key, value: raw });
    }
  }

  return groups;
}

function mapGroupKeyToType(groupKey: string): string {
  if (groupKey === "requirements") return "requirement";
  if (groupKey === "risks") return "risk";
  if (groupKey === "integrations") return "integration";
  if (groupKey === "decisions") return "decision";
  if (groupKey === "actionItems" || groupKey === "action_items") return "action_item";
  return "requirement";
}

function normalizeFindings(segment: Record<string, unknown>): FindingItem[] {
  const findings: FindingItem[] = [];

  for (const group of getFindingGroups(segment)) {
    for (const rawFinding of group.value) {
      const finding = asRecord(rawFinding);
      if (!finding) continue;

      const data = asRecord(finding.data);
      const typeRaw =
        typeof finding.type === "string" ? finding.type : mapGroupKeyToType(group.key);
      const title =
        (typeof data?.title === "string" && data.title) ||
        (typeof finding.title === "string" && finding.title) ||
        `${FINDING_TYPE_LABELS[typeRaw] ?? "Finding"}`;

      findings.push({
        type: typeRaw,
        title,
        excerpt:
          typeof finding.sourceExcerpt === "string"
            ? finding.sourceExcerpt
            : typeof data?.description === "string"
              ? data.description
              : undefined,
        timestampMs:
          typeof finding.sourceTimestamp === "number"
            ? finding.sourceTimestamp
            : typeof segment.startMs === "number"
              ? segment.startMs
              : undefined,
      });
    }
  }

  return findings;
}

function parseSections(analysis: AnalysisRecord): GallerySection[] {
  const sectionList: GallerySection[] = [];
  const rawSegments = Array.isArray(analysis.segmentOutputs) ? analysis.segmentOutputs : [];

  rawSegments.forEach((rawSegment, index) => {
    const segment = asRecord(rawSegment);
    if (!segment) return;

    const keyframes = normalizeKeyframes(segment);
    const findings = normalizeFindings(segment);

    sectionList.push({
      id: `${analysis._id}-segment-${index}`,
      title:
        typeof segment.topic === "string" && segment.topic.trim()
          ? segment.topic
          : `Segment ${index + 1}`,
      summary:
        typeof segment.summary === "string"
          ? segment.summary
          : typeof segment.description === "string"
            ? segment.description
            : undefined,
      startMs: typeof segment.startMs === "number" ? segment.startMs : undefined,
      endMs: typeof segment.endMs === "number" ? segment.endMs : undefined,
      keyframes,
      findings,
    });
  });

  if (sectionList.length === 0) {
    const synthesis = asRecord(analysis.synthesisOutput);
    if (synthesis) {
      const keyframes = normalizeKeyframes(synthesis);
      const findings = normalizeFindings(synthesis);
      sectionList.push({
        id: `${analysis._id}-synthesis`,
        title: "Synthesis",
        summary: typeof synthesis.summary === "string" ? synthesis.summary : undefined,
        keyframes,
        findings,
      });
    }
  }

  return sectionList;
}

function formatClock(ms?: number): string {
  if (typeof ms !== "number") return "--:--";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRange(startMs?: number, endMs?: number): string | null {
  if (typeof startMs !== "number") return null;
  if (typeof endMs === "number" && endMs >= startMs) {
    return `${formatClock(startMs)} - ${formatClock(endMs)}`;
  }
  return formatClock(startMs);
}

function formatStatus(status?: string): string {
  if (!status) return "Unknown";
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

function formatDateLabel(timestamp?: number): string {
  if (typeof timestamp !== "number") return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function toGalleryGroups(analyses: AnalysisRecord[]): GalleryGroup[] {
  return [...analyses]
    .sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
    .map((analysis) => ({
      analysisId: analysis._id,
      createdAt: analysis._creationTime,
      status: analysis.status ?? "unknown",
      sections: parseSections(analysis),
      failedError: analysis.failedError,
      failedStage: analysis.failedStage,
    }));
}

export function VisualDiscoveryGallery({ programId, analyses }: VisualDiscoveryGalleryProps) {
  const { slug } = useProgramContext();
  if (analyses === undefined) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default px-6 py-12">
        <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
        <p className="text-center text-sm text-text-secondary">
          Loading visual discovery gallery...
        </p>
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-default bg-surface-default px-6 py-14 text-center">
        <p className="text-lg font-semibold text-text-heading">No video analyses yet</p>
        <p className="mt-1 text-sm text-text-secondary">
          Upload a call recording to generate keyframes, context, and linked findings.
        </p>
        <Link
          href={`/${slug}/videos/upload`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          Upload First Video
        </Link>
      </div>
    );
  }

  const galleryGroups = toGalleryGroups(analyses);
  const keyframeCount = galleryGroups.reduce(
    (total, group) =>
      total + group.sections.reduce((acc, section) => acc + section.keyframes.length, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-3">
        <span className="rounded-full bg-status-warning-bg px-2.5 py-1 text-xs font-semibold text-status-warning-fg">
          {analyses.length} analysis{analyses.length === 1 ? "" : "es"}
        </span>
        <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-text-primary">
          {keyframeCount} keyframe{keyframeCount === 1 ? "" : "s"}
        </span>
      </div>

      {galleryGroups.map((group) => {
        const hasVisuals = group.sections.some((section) => section.keyframes.length > 0);
        const statusClasses = STATUS_STYLES[group.status] ?? "bg-surface-raised text-text-primary";

        return (
          <section
            key={group.analysisId}
            className="rounded-xl border border-border-default bg-surface-default p-4 sm:p-6"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-heading">
                  Analysis {group.analysisId}
                </h2>
                <p className="mt-1 text-xs text-text-secondary">
                  Generated {formatDateLabel(group.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses}`}>
                  {formatStatus(group.status)}
                </span>
                <Link
                  href={`/${slug}/videos/${group.analysisId}`}
                  className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-interactive-hover"
                >
                  Open analysis
                </Link>
              </div>
            </div>

            {group.status === "failed" && (
              <div className="mb-4 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2">
                <p className="text-sm font-medium text-status-error-fg">Analysis failed</p>
                <p className="text-xs text-status-error-fg">
                  {group.failedStage ? `Stage: ${group.failedStage}. ` : ""}
                  {group.failedError ?? "No additional error context available."}
                </p>
              </div>
            )}

            {!hasVisuals ? (
              <div className="rounded-lg border border-dashed border-border-default px-4 py-8 text-center">
                <p className="text-sm font-medium text-text-heading">No keyframes available yet</p>
                <p className="mt-1 text-xs text-text-secondary">
                  Keyframes appear once indexing and analysis artifacts are available.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {group.sections.map((section) => {
                  if (section.keyframes.length === 0) return null;
                  const rangeLabel = formatRange(section.startMs, section.endMs);

                  return (
                    <article
                      key={section.id}
                      className="rounded-lg border border-border-default p-4"
                    >
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-text-heading">
                            {section.title}
                          </h3>
                          {section.summary && (
                            <p className="mt-1 text-xs text-text-primary">{section.summary}</p>
                          )}
                        </div>
                        {rangeLabel && (
                          <span className="rounded-full bg-surface-raised px-2 py-1 text-xs font-medium text-text-primary">
                            {rangeLabel}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {section.keyframes.map((frame, index) => (
                          <figure
                            key={`${frame.imageUrl}-${index}`}
                            className="overflow-hidden rounded-lg border border-border-default bg-surface-raised"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={frame.imageUrl}
                              alt={`Keyframe ${index + 1} from ${section.title}`}
                              className="h-36 w-full object-cover sm:h-40"
                            />
                            <figcaption className="space-y-1 px-2.5 py-2 text-xs text-text-primary">
                              <p className="font-medium text-text-heading">
                                {frame.caption ?? "Captured frame"}
                              </p>
                              {typeof frame.timestampMs === "number" && (
                                <p className="text-text-secondary">
                                  {formatClock(frame.timestampMs)}
                                </p>
                              )}
                            </figcaption>
                          </figure>
                        ))}
                      </div>

                      {section.findings.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Linked Findings
                          </p>
                          <div className="space-y-2">
                            {section.findings.slice(0, 4).map((finding, idx) => {
                              const typeClasses =
                                FINDING_TYPE_STYLES[finding.type] ??
                                "bg-surface-raised text-text-primary";
                              return (
                                <div
                                  key={`${finding.title}-${idx}`}
                                  className="rounded-md border border-border-default px-3 py-2 text-xs"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 font-medium ${typeClasses}`}
                                    >
                                      {FINDING_TYPE_LABELS[finding.type] ?? "Finding"}
                                    </span>
                                    <span className="font-medium text-text-heading">
                                      {finding.title}
                                    </span>
                                    {typeof finding.timestampMs === "number" && (
                                      <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-text-primary">
                                        {formatClock(finding.timestampMs)}
                                      </span>
                                    )}
                                  </div>
                                  {finding.excerpt && (
                                    <p className="mt-1 text-text-primary">{finding.excerpt}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
