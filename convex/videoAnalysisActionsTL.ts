// @ts-nocheck
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";
import { buildAnalysisSystemPrompt } from "./ai/prompts";
import { withRetry } from "./ai/retry";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "./lib/aiCostTracking";
import {
  createIndex,
  DEFAULT_TWELVE_LABS_MODELS,
  getTaskStatus,
  retrieveVideoData,
  submitVideo,
} from "./lib/twelveLabsClient";

const POLL_INTERVAL_MS = 15_000;
const CLAUDE_MODEL = "claude-opus-4-6";
const TRANSCRIPT_PROMPT_CHAR_LIMIT = 80_000;

type JsonRecord = Record<string, unknown>;
type FindingConfidence = "high" | "medium" | "low";

type ParsedTranscript = {
  language: string;
  utterances: Array<{
    speakerId: string;
    startMs: number;
    endMs: number;
    text: string;
    confidence?: number;
  }>;
  fullText: string;
  totalDurationMs: number;
  speakerCount: number;
};

type NormalizedChapter = {
  index: number;
  startMs: number;
  endMs: number;
  topic?: string;
  summary?: string;
};

type GroupedFindings = {
  requirements: JsonRecord[];
  risks: JsonRecord[];
  integrations: JsonRecord[];
  decisions: JsonRecord[];
  actionItems: JsonRecord[];
  summary: string;
  confidence: FindingConfidence;
};

type VideoAnalysisLite = {
  _id: Id<"videoAnalyses">;
  orgId: string;
  programId: Id<"programs">;
  documentId: Id<"documents">;
  status?: string;
  videoUrl: string;
  videoDurationMs?: number;
  tlIndexId?: string;
  tlTaskId?: string;
  tlVideoId?: string;
};

type PersistOutputsResult = {
  insertedVideoFindings?: number;
  mirroredDiscoveryFindings?: number;
};

type RetrieveAndAnalyzeResult =
  | {
      ok: true;
      transcriptId: Id<"videoTranscripts">;
      segmentCount: number;
      insertedFindings: number;
    }
  | {
      ok: false;
      error: string;
    };

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function getByPath(root: unknown, dottedPath: string): unknown {
  const keys = dottedPath.split(".");
  let cursor: unknown = root;
  for (const key of keys) {
    const cursorRecord = asRecord(cursor);
    if (!cursorRecord) return undefined;
    cursor = cursorRecord[key];
  }
  return cursor;
}

function pickString(root: unknown, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = getByPath(root, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function pickNumber(root: unknown, paths: string[]): number | undefined {
  for (const path of paths) {
    const value = getByPath(root, path);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function normalizeConfidence(value: unknown): FindingConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Unknown Twelve Labs pipeline error";
}

function safeStringify(value: unknown, maxChars = 8_000): string {
  const serialized = JSON.stringify(value, null, 2);
  if (typeof serialized !== "string") return "null";
  if (serialized.length <= maxChars) return serialized;
  return `${serialized.slice(0, maxChars)}\n...<truncated>`;
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...<truncated>`;
}

function toMs(value: number, pathHint: string): number {
  if (!Number.isFinite(value)) return 0;
  const hint = pathHint.toLowerCase();
  if (hint.includes("ms")) return Math.max(0, Math.round(value));
  if (hint.includes("sec")) return Math.max(0, Math.round(value * 1000));
  if (hint.endsWith("start") || hint.endsWith("end")) {
    if (value > 10_000) return Math.max(0, Math.round(value));
    return Math.max(0, Math.round(value * 1000));
  }
  if (!Number.isInteger(value)) return Math.max(0, Math.round(value * 1000));
  return Math.max(0, Math.round(value));
}

function pickTimestampMs(root: unknown, paths: string[]): number | undefined {
  for (const path of paths) {
    const value = getByPath(root, path);
    if (typeof value === "number" && Number.isFinite(value)) {
      return toMs(value, path);
    }
  }
  return undefined;
}

function collectRecordArray(root: unknown, paths: string[]): JsonRecord[] {
  for (const path of paths) {
    const value = getByPath(root, path);
    if (!Array.isArray(value)) continue;
    const records = value
      .map((item) => asRecord(item))
      .filter((item): item is JsonRecord => item !== null);
    if (records.length > 0) return records;
  }
  return [];
}

function extractTranscriptSegments(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => asRecord(entry))
      .filter((entry): entry is JsonRecord => entry !== null);
  }

  const direct = collectRecordArray(payload, [
    "segments",
    "utterances",
    "transcript",
    "transcript.utterances",
    "transcript.segments",
    "data",
    "data.utterances",
    "data.segments",
    "data.transcript",
    "data.transcript.utterances",
    "data.transcript.segments",
  ]);
  return direct;
}

function mapSegmentToUtterance(segment: JsonRecord, fallbackIndex: number) {
  const startMs =
    pickTimestampMs(segment, [
      "start_ms",
      "startMs",
      "start_milliseconds",
      "start_sec",
      "start_seconds",
      "timestamps.start_ms",
      "timestamps.start",
      "start",
      "startTime",
      "time.start",
    ]) ?? fallbackIndex * 5_000;

  const rawEndMs =
    pickTimestampMs(segment, [
      "end_ms",
      "endMs",
      "end_milliseconds",
      "end_sec",
      "end_seconds",
      "timestamps.end_ms",
      "timestamps.end",
      "end",
      "endTime",
      "time.end",
    ]) ?? startMs + 5_000;

  const endMs = rawEndMs < startMs ? startMs : rawEndMs;
  const text =
    pickString(segment, ["text", "value", "content", "sentence", "transcript", "data.text"]) ?? "";
  if (!text) return null;

  const speakerId =
    pickString(segment, [
      "speaker_id",
      "speakerId",
      "speaker",
      "speaker_name",
      "speakerName",
      "speaker_label",
    ]) ?? `speaker_${fallbackIndex % 8}`;

  const confidence = pickNumber(segment, ["confidence", "score", "probability"]);
  const utterance: {
    speakerId: string;
    startMs: number;
    endMs: number;
    text: string;
    confidence?: number;
  } = {
    speakerId,
    startMs,
    endMs,
    text,
  };
  if (typeof confidence === "number") {
    utterance.confidence = confidence;
  }
  return utterance;
}

function parseTranscriptPayload(
  transcriptPayload: unknown,
  fallbackSummary: string,
  fallbackDurationMs: number,
): ParsedTranscript {
  const segments = extractTranscriptSegments(transcriptPayload);
  const utterances = segments
    .map((segment, index) => mapSegmentToUtterance(segment, index))
    .filter(
      (utterance): utterance is NonNullable<ReturnType<typeof mapSegmentToUtterance>> =>
        utterance !== null,
    );

  if (utterances.length === 0 && fallbackSummary.trim().length > 0) {
    utterances.push({
      speakerId: "speaker_0",
      startMs: 0,
      endMs: Math.max(5_000, fallbackDurationMs || 5_000),
      text: fallbackSummary.trim(),
      confidence: 0.35,
    });
  }

  const inferredDuration =
    utterances.length > 0
      ? Math.max(...utterances.map((utterance) => utterance.endMs))
      : fallbackDurationMs;

  const explicitDuration =
    pickTimestampMs(transcriptPayload, [
      "duration_ms",
      "durationMs",
      "duration_sec",
      "duration_seconds",
      "metadata.duration_ms",
      "metadata.duration",
      "data.duration_ms",
      "data.duration",
    ]) ?? inferredDuration;

  const fullText =
    pickString(transcriptPayload, [
      "full_text",
      "fullText",
      "text",
      "transcript_text",
      "data.full_text",
      "data.fullText",
      "data.text",
    ]) ??
    utterances
      .map((utterance) => utterance.text)
      .join(" ")
      .trim();

  const speakerCount =
    pickNumber(transcriptPayload, [
      "speaker_count",
      "speakerCount",
      "metadata.speaker_count",
      "data.speaker_count",
    ]) ?? new Set(utterances.map((utterance) => utterance.speakerId)).size;

  const language =
    pickString(transcriptPayload, [
      "language",
      "detected_language",
      "lang",
      "metadata.language",
      "data.language",
    ]) ?? "unknown";

  return {
    language,
    utterances,
    fullText,
    totalDurationMs: Math.max(0, Math.round(explicitDuration)),
    speakerCount,
  };
}

function extractSummaryText(summaryPayload: unknown): string {
  if (typeof summaryPayload === "string" && summaryPayload.trim().length > 0) {
    return summaryPayload.trim();
  }

  const summary =
    pickString(summaryPayload, [
      "summary",
      "text",
      "result",
      "data.summary",
      "data.text",
      "data.result",
      "summary.text",
      "content",
    ]) ?? "";
  if (summary) return summary;

  const firstArrayEntry = collectRecordArray(summaryPayload, [
    "summaries",
    "data.summaries",
    "results",
    "data.results",
  ])[0];

  return pickString(firstArrayEntry, ["summary", "text", "content", "result"]) ?? "";
}

function normalizeChapter(chapter: JsonRecord, index: number): NormalizedChapter {
  const startMs =
    pickTimestampMs(chapter, [
      "start_ms",
      "startMs",
      "start_sec",
      "start_seconds",
      "start",
      "startTime",
      "timestamps.start",
      "timestamps.start_ms",
    ]) ?? index * 60_000;

  const endCandidate =
    pickTimestampMs(chapter, [
      "end_ms",
      "endMs",
      "end_sec",
      "end_seconds",
      "end",
      "endTime",
      "timestamps.end",
      "timestamps.end_ms",
    ]) ?? startMs + 60_000;

  return {
    index,
    startMs,
    endMs: Math.max(endCandidate, startMs + 1_000),
    topic: pickString(chapter, ["topic", "title", "headline"]),
    summary: pickString(chapter, ["summary", "text", "description"]),
  };
}

function extractChapters(
  chaptersPayload: unknown,
  fallbackDurationMs: number,
): NormalizedChapter[] {
  const chapters = collectRecordArray(chaptersPayload, [
    "chapters",
    "data.chapters",
    "results",
    "data.results",
    "summaries",
    "data.summaries",
    "segments",
    "data.segments",
  ]).map((chapter, index) => normalizeChapter(chapter, index));

  if (chapters.length > 0) return chapters;

  return [
    {
      index: 0,
      startMs: 0,
      endMs: Math.max(5_000, fallbackDurationMs || 5_000),
      summary: "Single inferred chapter",
    },
  ];
}

function extractTopicsFromGist(gistPayload: unknown): string[] {
  const topics = new Set<string>();

  const candidateArrays: unknown[] = [];
  for (const path of ["topics", "hashtags", "data.topics", "data.hashtags", "result.topics"]) {
    const value = getByPath(gistPayload, path);
    if (Array.isArray(value)) candidateArrays.push(...value);
  }

  for (const item of candidateArrays) {
    if (typeof item === "string" && item.trim().length > 0) {
      topics.add(item.trim());
      continue;
    }
    const record = asRecord(item);
    const label = pickString(record, ["name", "topic", "label", "text"]);
    if (label) topics.add(label);
  }

  const primaryTopic = pickString(gistPayload, ["topic", "data.topic", "result.topic"]);
  if (primaryTopic) topics.add(primaryTopic);

  return Array.from(topics);
}

function coerceRecordArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => entry !== null);
}

function decorateFinding(
  finding: JsonRecord,
  defaults: {
    confidence: FindingConfidence;
    excerpt: string;
    startMs: number;
    endMs?: number;
  },
): JsonRecord {
  const sourceTimestamp =
    pickTimestampMs(finding, [
      "sourceTimestamp",
      "sourceTimestampMs",
      "timestampMs",
      "startMs",
      "start_ms",
      "sourceAttribution.sourceTimestamp",
      "source_attribution.source_timestamp",
      "sourceTimestampSec",
      "timestamp",
    ]) ?? defaults.startMs;

  const sourceTimestampEnd =
    pickTimestampMs(finding, [
      "sourceTimestampEnd",
      "sourceTimestampEndMs",
      "endMs",
      "end_ms",
      "sourceAttribution.sourceTimestampEnd",
      "source_attribution.source_timestamp_end",
      "sourceTimestampEndSec",
    ]) ?? defaults.endMs;

  const sourceExcerpt =
    pickString(finding, [
      "sourceExcerpt",
      "source_excerpt",
      "quote",
      "evidence",
      "description",
      "title",
      "summary",
      "sourceAttribution.sourceExcerpt",
    ]) ?? defaults.excerpt;

  const confidence = normalizeConfidence(finding.confidence) ?? defaults.confidence;

  return {
    ...finding,
    confidence,
    status:
      finding.status === "pending" ||
      finding.status === "approved" ||
      finding.status === "rejected" ||
      finding.status === "imported" ||
      finding.status === "edited"
        ? finding.status
        : "pending",
    sourceTimestamp,
    sourceTimestampEnd,
    sourceExcerpt,
  };
}

function parseClaudeJson(text: string): JsonRecord {
  let jsonText = text.trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) jsonText = fenced[1];
  const parsed = JSON.parse(jsonText) as unknown;
  const record = asRecord(parsed);
  if (!record) {
    throw new Error("Claude response was not a JSON object");
  }
  return record;
}

function buildGroupedFindings(
  parsed: JsonRecord,
  defaults: {
    confidence: FindingConfidence;
    excerpt: string;
    startMs: number;
    endMs?: number;
  },
): GroupedFindings {
  const reqs = coerceRecordArray(parsed.requirements).map((finding) =>
    decorateFinding(finding, defaults),
  );
  const risks = coerceRecordArray(parsed.risks).map((finding) =>
    decorateFinding(finding, defaults),
  );
  const integrations = coerceRecordArray(parsed.integrations).map((finding) =>
    decorateFinding(finding, defaults),
  );
  const decisions = coerceRecordArray(parsed.decisions).map((finding) =>
    decorateFinding(finding, defaults),
  );
  const actionItems = [
    ...coerceRecordArray(parsed.action_items),
    ...coerceRecordArray(parsed.actionItems),
  ].map((finding) => decorateFinding(finding, defaults));

  const summary =
    (typeof parsed.summary === "string" && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : "") || defaults.excerpt;

  return {
    requirements: reqs,
    risks,
    integrations,
    decisions,
    actionItems,
    summary,
    confidence: normalizeConfidence(parsed.confidence ?? defaults.confidence),
  };
}

function findingTimestampMs(finding: JsonRecord): number | undefined {
  return pickNumber(finding, ["sourceTimestamp", "timestampMs", "startMs"]);
}

function buildSegmentOutputs(
  grouped: GroupedFindings,
  chapters: NormalizedChapter[],
  totalDurationMs: number,
): JsonRecord[] {
  const allGrouped = {
    requirements: grouped.requirements,
    risks: grouped.risks,
    integrations: grouped.integrations,
    decisions: grouped.decisions,
    action_items: grouped.actionItems,
  };

  if (chapters.length === 0) {
    return [
      {
        segmentIndex: 0,
        startMs: 0,
        endMs: Math.max(totalDurationMs, 5_000),
        summary: grouped.summary,
        ...allGrouped,
      },
    ];
  }

  const buckets = chapters.map((chapter) => ({
    chapter,
    requirements: [] as JsonRecord[],
    risks: [] as JsonRecord[],
    integrations: [] as JsonRecord[],
    decisions: [] as JsonRecord[],
    action_items: [] as JsonRecord[],
  }));

  function placeFinding(key: keyof typeof allGrouped, finding: JsonRecord) {
    const timestamp = findingTimestampMs(finding);
    const chapterIndex =
      timestamp === undefined
        ? 0
        : chapters.findIndex(
            (chapter) => timestamp >= chapter.startMs && timestamp <= chapter.endMs,
          );
    const bucketIndex = chapterIndex >= 0 ? chapterIndex : 0;
    buckets[bucketIndex][key].push(finding);
  }

  for (const finding of grouped.requirements) placeFinding("requirements", finding);
  for (const finding of grouped.risks) placeFinding("risks", finding);
  for (const finding of grouped.integrations) placeFinding("integrations", finding);
  for (const finding of grouped.decisions) placeFinding("decisions", finding);
  for (const finding of grouped.actionItems) placeFinding("action_items", finding);

  const outputs = buckets
    .map((bucket, index) => ({
      segmentIndex: index,
      startMs: bucket.chapter.startMs,
      endMs: bucket.chapter.endMs,
      summary: bucket.chapter.summary ?? bucket.chapter.topic ?? grouped.summary,
      requirements: bucket.requirements,
      risks: bucket.risks,
      integrations: bucket.integrations,
      decisions: bucket.decisions,
      action_items: bucket.action_items,
    }))
    .filter(
      (segment) =>
        segment.requirements.length > 0 ||
        segment.risks.length > 0 ||
        segment.integrations.length > 0 ||
        segment.decisions.length > 0 ||
        segment.action_items.length > 0,
    );

  if (outputs.length > 0) return outputs;
  return [
    {
      segmentIndex: 0,
      startMs: 0,
      endMs: Math.max(totalDurationMs, 5_000),
      summary: grouped.summary,
      ...allGrouped,
    },
  ];
}

function buildOrgIndexName(orgId: string): string {
  const suffix = orgId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || "org";
  return `pmc-${suffix}-video-index`;
}

function resolveTargetPlatform(programTarget: unknown): "salesforce_b2b" | "bigcommerce_b2b" {
  return programTarget === "bigcommerce_b2b" ? "bigcommerce_b2b" : "salesforce_b2b";
}

async function getAnalysis(
  ctx: ActionCtx,
  analysisId: Id<"videoAnalyses">,
): Promise<VideoAnalysisLite> {
  const internalAny = internal as unknown as Record<string, Record<string, unknown>>;
  const getByIdRef = internalAny.videoAnalysis?.getById as any;
  const analysis = await (ctx as any).runQuery(getByIdRef, { analysisId });
  if (!analysis) throw new ConvexError("Video analysis not found");
  return analysis as VideoAnalysisLite;
}

async function logActivity(
  ctx: ActionCtx,
  args: {
    orgId: string;
    programId: Id<"programs">;
    analysisId: Id<"videoAnalyses">;
    step: string;
    message: string;
    level: "info" | "success" | "error";
    detail?: string;
  },
) {
  await ctx.runMutation(internal.videoAnalysis.logActivity, {
    orgId: args.orgId,
    programId: args.programId,
    analysisId: args.analysisId,
    step: args.step,
    message: args.message,
    detail: args.detail,
    level: args.level,
  });
}

async function markFailed(
  ctx: ActionCtx,
  args: {
    analysis: VideoAnalysisLite;
    failedStage: "indexing" | "analyzing";
    message: string;
  },
) {
  await ctx.runMutation(internal.videoAnalysis.updateStatus, {
    analysisId: args.analysis._id,
    status: "failed",
    failedStage: args.failedStage,
    failedError: args.message,
  });

  await logActivity(ctx, {
    orgId: args.analysis.orgId,
    programId: args.analysis.programId,
    analysisId: args.analysis._id,
    step: `${args.failedStage}_failed`,
    message: `Video pipeline failed during ${args.failedStage}`,
    detail: args.message,
    level: "error",
  });
}

export const submitToTwelveLabs = internalAction({
  args: {
    analysisId: v.id("videoAnalyses"),
  },
  handler: async (ctx, args) => {
    const analysis = await getAnalysis(ctx, args.analysisId);
    if (analysis.status === "complete") return { skipped: true, reason: "already_complete" };

    try {
      if (analysis.tlTaskId) {
        await logActivity(ctx, {
          orgId: analysis.orgId,
          programId: analysis.programId,
          analysisId: analysis._id,
          step: "twelve_labs_resumed",
          message: "Existing Twelve Labs task found. Resuming status polling.",
          level: "info",
        });

        await ctx.scheduler.runAfter(
          POLL_INTERVAL_MS,
          (internal as any).videoAnalysisActionsTL.pollTwelveLabsStatus,
          { analysisId: args.analysisId },
        );
        return { resumed: true, taskId: analysis.tlTaskId };
      }

      let orgIndex = null as null | { indexId: string; indexName: string };
      try {
        orgIndex = (await ctx.runMutation(internal.videoAnalysis.getOrCreateOrgIndex, {
          orgId: analysis.orgId,
        })) as { indexId: string; indexName: string };
      } catch (error) {
        const message = toErrorMessage(error);
        if (!message.includes("indexId and indexName are required")) {
          throw error;
        }
      }

      if (!orgIndex && analysis.tlIndexId) {
        orgIndex = (await ctx.runMutation(internal.videoAnalysis.getOrCreateOrgIndex, {
          orgId: analysis.orgId,
          indexId: analysis.tlIndexId,
          indexName: buildOrgIndexName(analysis.orgId),
        })) as { indexId: string; indexName: string };
      }

      if (!orgIndex) {
        const createdIndex = await createIndex(
          buildOrgIndexName(analysis.orgId),
          DEFAULT_TWELVE_LABS_MODELS,
        );
        orgIndex = (await ctx.runMutation(internal.videoAnalysis.getOrCreateOrgIndex, {
          orgId: analysis.orgId,
          indexId: createdIndex.indexId,
          indexName: createdIndex.indexName,
        })) as { indexId: string; indexName: string };
      }

      const submission = await submitVideo(orgIndex.indexId, analysis.videoUrl);

      await ctx.runMutation(internal.videoAnalysis.patchTwelveLabsFields, {
        analysisId: args.analysisId,
        tlIndexId: orgIndex.indexId,
        tlTaskId: submission.taskId,
      });

      await ctx.runMutation(internal.videoAnalysis.updateStatus, {
        analysisId: args.analysisId,
        status: "indexing",
        failedStage: undefined,
        failedError: undefined,
      });

      await logActivity(ctx, {
        orgId: analysis.orgId,
        programId: analysis.programId,
        analysisId: args.analysisId,
        step: "twelve_labs_submitted",
        message: "Submitted video to Twelve Labs for indexing.",
        detail: `Index ${orgIndex.indexId}, task ${submission.taskId}`,
        level: "info",
      });

      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        (internal as any).videoAnalysisActionsTL.pollTwelveLabsStatus,
        { analysisId: args.analysisId },
      );

      return { submitted: true, taskId: submission.taskId, indexId: orgIndex.indexId };
    } catch (error) {
      const message = toErrorMessage(error);
      await markFailed(ctx, {
        analysis,
        failedStage: "indexing",
        message,
      });
      return { submitted: false, error: message };
    }
  },
});

export const pollTwelveLabsStatus = internalAction({
  args: {
    analysisId: v.id("videoAnalyses"),
  },
  handler: async (ctx, args) => {
    const analysis = await getAnalysis(ctx, args.analysisId);
    if (analysis.status === "complete" || analysis.status === "failed") {
      return { skipped: true, reason: "terminal_status" };
    }

    if (!analysis.tlTaskId) {
      const message = "Missing tlTaskId while polling Twelve Labs status";
      await markFailed(ctx, {
        analysis,
        failedStage: "indexing",
        message,
      });
      return { ok: false, error: message };
    }

    try {
      const task = await getTaskStatus(analysis.tlTaskId);

      if (task.status === "ready") {
        const tlVideoId = task.videoId ?? analysis.tlVideoId;
        if (!tlVideoId) {
          throw new Error("Twelve Labs task is ready but no tlVideoId was returned by the API");
        }

        await ctx.runMutation(internal.videoAnalysis.patchTwelveLabsFields, {
          analysisId: args.analysisId,
          tlVideoId,
          tlIndexId: task.indexId ?? analysis.tlIndexId,
        });

        await logActivity(ctx, {
          orgId: analysis.orgId,
          programId: analysis.programId,
          analysisId: args.analysisId,
          step: "twelve_labs_ready",
          message: "Indexing complete. Retrieving transcript and metadata.",
          detail: `Video ${tlVideoId}`,
          level: "success",
        });

        await ctx.scheduler.runAfter(
          0,
          (internal as any).videoAnalysisActionsTL.retrieveAndAnalyze,
          {
            analysisId: args.analysisId,
          },
        );
        return { ok: true, status: "ready", tlVideoId };
      }

      if (task.status === "failed") {
        const message =
          task.error ?? `Twelve Labs indexing failed with status "${task.rawStatus || "unknown"}"`;
        await markFailed(ctx, {
          analysis,
          failedStage: "indexing",
          message,
        });
        return { ok: false, status: "failed", error: message };
      }

      await ctx.runMutation(internal.videoAnalysis.updateStatus, {
        analysisId: args.analysisId,
        status: "indexing",
      });

      await logActivity(ctx, {
        orgId: analysis.orgId,
        programId: analysis.programId,
        analysisId: args.analysisId,
        step: "twelve_labs_poll",
        message: `Twelve Labs indexing in progress (${task.rawStatus})`,
        detail: typeof task.progress === "number" ? `Progress: ${task.progress}` : undefined,
        level: "info",
      });

      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        (internal as any).videoAnalysisActionsTL.pollTwelveLabsStatus,
        { analysisId: args.analysisId },
      );

      return { ok: true, status: "processing", rawStatus: task.rawStatus };
    } catch (error) {
      const message = toErrorMessage(error);
      await markFailed(ctx, {
        analysis,
        failedStage: "indexing",
        message,
      });
      return { ok: false, error: message };
    }
  },
});

export const retrieveAndAnalyze = internalAction({
  args: {
    analysisId: v.id("videoAnalyses"),
  },
  handler: async (ctx, args): Promise<RetrieveAndAnalyzeResult> => {
    const analysis = await getAnalysis(ctx, args.analysisId);
    const startedAt = Date.now();

    try {
      if (!analysis.tlIndexId || !analysis.tlVideoId) {
        throw new Error("Missing tlIndexId/tlVideoId required for retrieval");
      }

      await ctx.runMutation(internal.videoAnalysis.updateStatus, {
        analysisId: args.analysisId,
        status: "analyzing",
        failedStage: undefined,
        failedError: undefined,
      });

      await logActivity(ctx, {
        orgId: analysis.orgId,
        programId: analysis.programId,
        analysisId: args.analysisId,
        step: "twelve_labs_retrieval_started",
        message: "Retrieving transcript, summary, chapters, and gist from Twelve Labs.",
        level: "info",
      });

      const retrieved = await retrieveVideoData(analysis.tlIndexId, analysis.tlVideoId);
      for (const warning of retrieved.warnings) {
        await logActivity(ctx, {
          orgId: analysis.orgId,
          programId: analysis.programId,
          analysisId: args.analysisId,
          step: "twelve_labs_retrieval_warning",
          message: "Twelve Labs retrieval warning",
          detail: warning,
          level: "info",
        });
      }

      const summaryText = extractSummaryText(retrieved.summary);
      const parsedTranscript = parseTranscriptPayload(
        retrieved.transcript,
        summaryText,
        analysis.videoDurationMs ?? 0,
      );
      const chapters = extractChapters(
        retrieved.chapters,
        parsedTranscript.totalDurationMs || analysis.videoDurationMs || 0,
      );
      const topics = extractTopicsFromGist(retrieved.gist);

      const transcriptId = (await ctx.runMutation(internal.videoAnalysis.createTranscript, {
        orgId: analysis.orgId,
        videoAnalysisId: args.analysisId,
        transcriptionService: "twelve-labs",
        language: parsedTranscript.language,
        totalDurationMs: parsedTranscript.totalDurationMs,
        speakerCount: parsedTranscript.speakerCount,
        utterances: parsedTranscript.utterances,
        fullText: parsedTranscript.fullText,
        wordCount: parsedTranscript.fullText.split(/\s+/).filter(Boolean).length,
      })) as Id<"videoTranscripts">;

      await ctx.runMutation(internal.videoAnalysis.patchAnalysisFields, {
        analysisId: args.analysisId,
        transcriptId,
        videoDurationMs: parsedTranscript.totalDurationMs || analysis.videoDurationMs || undefined,
      });

      await ctx.runMutation(internal.videoAnalysis.patchTwelveLabsFields, {
        analysisId: args.analysisId,
        tlSummary: summaryText || undefined,
        tlChapters: chapters,
        tlTopics: topics.length > 0 ? topics : undefined,
        tlGist: retrieved.gist ?? undefined,
      });

      await logActivity(ctx, {
        orgId: analysis.orgId,
        programId: analysis.programId,
        analysisId: args.analysisId,
        step: "twelve_labs_retrieved",
        message: `Stored transcript (${parsedTranscript.utterances.length} utterances) and TL metadata.`,
        level: "success",
      });

      const [program, workstreams, existingRequirementTitles, document] = await Promise.all([
        ctx.runQuery(internal.documentAnalysis.getProgramById, {
          programId: analysis.programId,
        }),
        ctx.runQuery(internal.workstreams.listByProgramInternal, {
          programId: analysis.programId,
        }),
        ctx.runQuery(internal.requirements.listTitles, {
          programId: analysis.programId,
        }),
        ctx.runQuery(internal.documentAnalysis.getDocumentById, {
          documentId: analysis.documentId,
        }),
      ]);

      if (!program) throw new Error("Program not found for video analysis context");

      const workstreamRecords = Array.isArray(workstreams) ? workstreams : [];
      const existingTitleList = Array.isArray(existingRequirementTitles)
        ? existingRequirementTitles
        : [];

      const targetPlatform = resolveTargetPlatform((program as JsonRecord).targetPlatform);

      const systemPrompt = buildAnalysisSystemPrompt({
        targetPlatform,
        workstreams: workstreamRecords.map((workstream) => ({
          shortCode: pickString(workstream as JsonRecord, ["shortCode", "short_code"]) ?? "WS-UNK",
          name: pickString(workstream, ["name"]) ?? "Unknown Workstream",
          description: pickString(workstream, ["description"]),
        })),
        existingRequirementTitles: existingTitleList
          .filter((title): title is string => typeof title === "string")
          .slice(0, 400),
      });

      const transcriptText = truncateText(
        parsedTranscript.fullText || summaryText || "Transcript unavailable",
        TRANSCRIPT_PROMPT_CHAR_LIMIT,
      );

      const fileName = pickString(document, ["fileName", "title"]) ?? "video-recording";

      const userPrompt = [
        "Analyze this migration call and extract structured findings.",
        "Use the transcript as the source of truth, then use chapter/gist context to improve precision.",
        "",
        "<video-context>",
        `<file-name>${fileName}</file-name>`,
        `<duration-ms>${parsedTranscript.totalDurationMs}</duration-ms>`,
        "<summary>",
        summaryText || "Not available",
        "</summary>",
        "<chapters>",
        safeStringify(chapters, 12_000),
        "</chapters>",
        "<gist>",
        safeStringify(retrieved.gist, 6_000),
        "</gist>",
        "<transcript>",
        transcriptText,
        "</transcript>",
        "</video-context>",
        "",
        "Return ONLY JSON (no markdown) with this schema:",
        "{",
        '  "requirements": [{ "title": string, "description": string, "priority": "must_have"|"should_have"|"nice_to_have"|"deferred", "fitGap": "native"|"config"|"custom_dev"|"third_party"|"not_feasible", "effortEstimate?": "low"|"medium"|"high"|"very_high", "suggestedWorkstream?": string, "rationale?": string, "sourceTimestampMs?": number, "sourceTimestampEndMs?": number, "sourceExcerpt?": string }],',
        '  "risks": [{ "title": string, "description": string, "severity": "critical"|"high"|"medium"|"low", "probability": "very_likely"|"likely"|"possible"|"unlikely", "mitigation?": string, "affectedWorkstreams?": string[], "sourceTimestampMs?": number, "sourceTimestampEndMs?": number, "sourceExcerpt?": string }],',
        '  "integrations": [{ "name": string, "sourceSystem": string, "targetSystem": string, "protocol": "api"|"webhook"|"file_transfer"|"database"|"middleware"|"other", "direction?": "inbound"|"outbound"|"bidirectional", "dataEntities?": string[], "complexity?": "low"|"medium"|"high", "description?": string, "sourceTimestampMs?": number, "sourceExcerpt?": string }],',
        '  "decisions": [{ "title": string, "description": string, "impact": "high"|"medium"|"low", "category": "architecture"|"data"|"integration"|"process"|"security"|"performance", "alternatives?": string[], "sourceTimestampMs?": number, "sourceExcerpt?": string }],',
        '  "action_items": [{ "title": string, "description": string, "owner?": string, "dueDate?": string, "priority?": "high"|"medium"|"low", "suggestedWorkstream?": string, "sourceTimestampMs?": number, "sourceExcerpt?": string }],',
        '  "summary": string,',
        '  "confidence": "high"|"medium"|"low"',
        "}",
      ].join("\n");

      await logActivity(ctx, {
        orgId: analysis.orgId,
        programId: analysis.programId,
        analysisId: args.analysisId,
        step: "claude_analysis_started",
        message: "Starting Claude extraction from transcript + Twelve Labs metadata.",
        level: "info",
      });

      const anthropic = getAnthropicClient();
      const aiResponse = await withRetry(
        async () =>
          await anthropic.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 16_384,
            system: systemPrompt,
            messages: [{ role: "user", content: [{ type: "text", text: userPrompt }] }],
          }),
        { maxRetries: 2, baseDelayMs: 2_000 },
      );

      const textBlock = aiResponse.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Claude response did not include a text block");
      }

      const parsedJson = parseClaudeJson(textBlock.text);
      const grouped = buildGroupedFindings(parsedJson, {
        confidence: normalizeConfidence(parsedJson.confidence),
        excerpt: summaryText || "Video analysis finding",
        startMs: 0,
        endMs: parsedTranscript.totalDurationMs,
      });

      const segmentOutputs = buildSegmentOutputs(
        grouped,
        chapters,
        parsedTranscript.totalDurationMs,
      );
      const synthesisOutput = {
        summary: grouped.summary,
        confidence: grouped.confidence,
        provider: "twelve_labs_claude",
        chapterCount: chapters.length,
        findings: [] as unknown[],
      };

      const segmentPersisted = (await ctx.runMutation(
        internal.videoAnalysis.persistSegmentOutputs,
        {
          analysisId: args.analysisId,
          segmentOutputs,
        },
      )) as PersistOutputsResult;

      const synthesisPersisted = (await ctx.runMutation(
        internal.videoAnalysis.persistSynthesisOutputs,
        {
          analysisId: args.analysisId,
          synthesisOutput,
        },
      )) as PersistOutputsResult;

      const usage = aiResponse.usage as
        | {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          }
        | undefined;
      const totalTokensUsed =
        (usage?.input_tokens ?? 0) +
        (usage?.output_tokens ?? 0) +
        (usage?.cache_creation_input_tokens ?? 0) +
        (usage?.cache_read_input_tokens ?? 0);

      const durationMs = Date.now() - startedAt;

      await ctx.runMutation(internal.videoAnalysis.updateStatus, {
        analysisId: args.analysisId,
        status: "complete",
        failedStage: undefined,
        failedError: undefined,
        totalTokensUsed,
        durationMs,
      });

      // Record AI usage for billing (best-effort)
      try {
        const tokenUsage = extractTokenUsage(aiResponse, CLAUDE_MODEL);
        await ctx.runMutation(internal.billing.usageRecords.recordAiUsage, {
          orgId: analysis.orgId,
          programId: analysis.programId,
          source: "video_analysis" as const,
          claudeModelId: CLAUDE_MODEL,
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          cacheReadTokens: tokenUsage.cacheReadTokens,
          cacheCreationTokens: tokenUsage.cacheCreationTokens,
          costUsd: calculateCostUsd(tokenUsage),
          durationMs,
          sourceEntityId: String(args.analysisId),
          sourceEntityTable: "videoAnalyses",
        });
      } catch (e) {
        console.error("[billing] Failed to record video analysis usage:", e);
      }

      // Best-effort execution logging
      try {
        const internalAny = internal as any;
        await ctx.runMutation(internalAny.ai.logExecution, {
          orgId: analysis.orgId,
          programId: analysis.programId,
          executionMode: "platform" as const,
          trigger: "manual" as const,
          taskType: "video_analysis",
          inputSummary: userPrompt.slice(0, 200),
          outputSummary: `${grouped.requirements.length} requirements, ${grouped.risks.length} risks, ${grouped.decisions.length} decisions`,
          tokensUsed: totalTokensUsed,
          durationMs,
          modelId: CLAUDE_MODEL,
        });
      } catch {
        /* best-effort */
      }

      const insertedCount: number =
        (segmentPersisted.insertedVideoFindings ?? 0) +
        (synthesisPersisted.insertedVideoFindings ?? 0);

      await logActivity(ctx, {
        orgId: analysis.orgId,
        programId: analysis.programId,
        analysisId: args.analysisId,
        step: "analysis_complete",
        message: `Analysis complete — ${insertedCount} findings extracted.`,
        detail: `Segments: ${segmentOutputs.length}, mirrored findings: ${
          (segmentPersisted.mirroredDiscoveryFindings ?? 0) +
          (synthesisPersisted.mirroredDiscoveryFindings ?? 0)
        }`,
        level: "success",
      });

      return {
        ok: true,
        transcriptId,
        segmentCount: segmentOutputs.length,
        insertedFindings: insertedCount,
      };
    } catch (error) {
      const message = toErrorMessage(error);
      await markFailed(ctx, {
        analysis,
        failedStage: "analyzing",
        message,
      });
      return { ok: false, error: message };
    }
  },
});
