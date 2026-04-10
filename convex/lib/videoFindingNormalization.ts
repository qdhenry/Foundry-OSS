import type {
  FindingConfidence,
  FindingReviewStatus,
  VideoFindingType,
  VideoSourceSpeaker,
} from "../shared/videoContracts";

export const FINDING_TYPE_BY_GROUP_KEY: Record<string, VideoFindingType> = {
  requirements: "requirement",
  risks: "risk",
  integrations: "integration",
  decisions: "decision",
  action_items: "action_item",
  actionItems: "action_item",
};

export type FindingNormalizationDefaults = {
  segmentIndex?: number;
  sourceTimestamp?: number;
  sourceTimestampEnd?: number;
  sourceExcerpt?: string;
  sourceSpeaker?: VideoSourceSpeaker;
  sourceKeyframeUrls?: string[];
  synthesisNote?: string;
};

export type NormalizedFinding = {
  type: VideoFindingType;
  data: Record<string, unknown>;
  confidence: FindingConfidence;
  status: FindingReviewStatus;
  suggestedWorkstream?: string;
  sourceAttribution: {
    sourceTimestamp: number;
    sourceTimestampEnd?: number;
    sourceExcerpt: string;
    sourceSpeaker?: VideoSourceSpeaker;
    sourceKeyframeUrls?: string[];
  };
  segmentIndex?: number;
  synthesisNote?: string;
  reviewReady: boolean;
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeFindingType(value: unknown): VideoFindingType | null {
  if (value === "requirement") return "requirement";
  if (value === "risk") return "risk";
  if (value === "integration") return "integration";
  if (value === "decision") return "decision";
  if (value === "action_item") return "action_item";
  return null;
}

export function normalizeFindingConfidence(value: unknown): FindingConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

export function normalizeFindingReviewStatus(value: unknown): FindingReviewStatus {
  if (
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "imported" ||
    value === "edited"
  ) {
    return value;
  }
  return "pending";
}

export function normalizeSpeaker(value: unknown): VideoSourceSpeaker | undefined {
  const speaker = asRecord(value);
  if (!speaker) return undefined;
  if (typeof speaker.speakerId !== "string") return undefined;
  return {
    speakerId: speaker.speakerId,
    name: typeof speaker.name === "string" ? speaker.name : undefined,
    role: typeof speaker.role === "string" ? speaker.role : undefined,
  };
}

export function extractKeyframeUrls(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const urls = value.filter((url): url is string => typeof url === "string");
    return urls.length > 0 ? urls : undefined;
  }

  const record = asRecord(value);
  if (!record || !Array.isArray(record.keyframes)) return undefined;
  const urls = record.keyframes
    .map((keyframe) => {
      const parsed = asRecord(keyframe);
      if (!parsed) return null;
      if (typeof parsed.imageUrl === "string") return parsed.imageUrl;
      if (typeof parsed.frameUrl === "string") return parsed.frameUrl;
      return null;
    })
    .filter((url): url is string => typeof url === "string");
  return urls.length > 0 ? urls : undefined;
}

export function normalizeFinding(
  rawFinding: unknown,
  defaults: FindingNormalizationDefaults,
  typeOverride?: VideoFindingType,
): NormalizedFinding | null {
  const finding = asRecord(rawFinding);
  if (!finding) return null;

  const type = typeOverride ?? normalizeFindingType(finding.type);
  if (!type) return null;

  const nestedData = asRecord(finding.data);
  const data =
    nestedData ??
    Object.fromEntries(
      Object.entries(finding).filter(
        ([key]) =>
          ![
            "type",
            "confidence",
            "status",
            "suggestedWorkstream",
            "sourceTimestamp",
            "sourceTimestampEnd",
            "sourceExcerpt",
            "sourceSpeaker",
            "sourceKeyframeUrls",
            "sourceAttribution",
            "segmentIndex",
            "synthesisNote",
            "reviewReady",
            "readyForReview",
          ].includes(key),
      ),
    );

  const sourceAttributionRecord = asRecord(finding.sourceAttribution);
  const sourceTimestamp =
    (typeof finding.sourceTimestamp === "number" ? finding.sourceTimestamp : undefined) ??
    (typeof sourceAttributionRecord?.sourceTimestamp === "number"
      ? sourceAttributionRecord.sourceTimestamp
      : undefined) ??
    defaults.sourceTimestamp ??
    0;
  const sourceTimestampEnd =
    (typeof finding.sourceTimestampEnd === "number" ? finding.sourceTimestampEnd : undefined) ??
    (typeof sourceAttributionRecord?.sourceTimestampEnd === "number"
      ? sourceAttributionRecord.sourceTimestampEnd
      : undefined) ??
    defaults.sourceTimestampEnd;
  const sourceExcerpt =
    (typeof finding.sourceExcerpt === "string" ? finding.sourceExcerpt : undefined) ??
    (typeof sourceAttributionRecord?.sourceExcerpt === "string"
      ? sourceAttributionRecord.sourceExcerpt
      : undefined) ??
    defaults.sourceExcerpt ??
    (typeof data.title === "string" ? data.title : undefined) ??
    "Excerpt unavailable";
  const sourceSpeaker =
    normalizeSpeaker(finding.sourceSpeaker) ??
    normalizeSpeaker(sourceAttributionRecord?.sourceSpeaker) ??
    defaults.sourceSpeaker;
  const sourceKeyframeUrls =
    extractKeyframeUrls(finding.sourceKeyframeUrls) ??
    extractKeyframeUrls(sourceAttributionRecord?.sourceKeyframeUrls) ??
    defaults.sourceKeyframeUrls;

  const reviewReadyRaw =
    typeof finding.reviewReady === "boolean"
      ? finding.reviewReady
      : typeof finding.readyForReview === "boolean"
        ? finding.readyForReview
        : undefined;

  return {
    type,
    data,
    confidence: normalizeFindingConfidence(finding.confidence),
    status: normalizeFindingReviewStatus(finding.status),
    suggestedWorkstream:
      typeof finding.suggestedWorkstream === "string" ? finding.suggestedWorkstream : undefined,
    sourceAttribution: {
      sourceTimestamp,
      sourceTimestampEnd,
      sourceExcerpt,
      sourceSpeaker,
      sourceKeyframeUrls,
    },
    segmentIndex:
      typeof finding.segmentIndex === "number" ? finding.segmentIndex : defaults.segmentIndex,
    synthesisNote:
      typeof finding.synthesisNote === "string" ? finding.synthesisNote : defaults.synthesisNote,
    reviewReady: reviewReadyRaw ?? true,
  };
}

export function collectFindingsFromOutput(
  output: unknown,
  defaults: FindingNormalizationDefaults,
): NormalizedFinding[] {
  const normalized: NormalizedFinding[] = [];
  if (Array.isArray(output)) {
    for (const finding of output) {
      const parsed = normalizeFinding(finding, defaults);
      if (parsed) normalized.push(parsed);
    }
    return normalized;
  }

  const root = asRecord(output);
  if (!root) return normalized;

  const directFindings = Array.isArray(root.findings) ? root.findings : [];
  for (const finding of directFindings) {
    const parsed = normalizeFinding(finding, defaults);
    if (parsed) normalized.push(parsed);
  }

  const synthesizedFindings = Array.isArray(root.synthesizedFindings)
    ? root.synthesizedFindings
    : [];
  for (const synthesizedFinding of synthesizedFindings) {
    const synthesizedRecord = asRecord(synthesizedFinding);
    if (!synthesizedRecord) continue;

    const sourceTimestampsMs = Array.isArray(synthesizedRecord.sourceTimestampsMs)
      ? synthesizedRecord.sourceTimestampsMs.filter(
          (value): value is number => typeof value === "number",
        )
      : [];
    const dedupedFromSegments = Array.isArray(synthesizedRecord.dedupedFromSegments)
      ? synthesizedRecord.dedupedFromSegments.filter(
          (value): value is number => typeof value === "number",
        )
      : [];

    const parsed = normalizeFinding(
      {
        ...synthesizedRecord,
        sourceTimestamp:
          sourceTimestampsMs.length > 0
            ? Math.min(...sourceTimestampsMs)
            : defaults.sourceTimestamp,
        sourceTimestampEnd:
          sourceTimestampsMs.length > 0
            ? Math.max(...sourceTimestampsMs)
            : defaults.sourceTimestampEnd,
        sourceSpeaker:
          Array.isArray(synthesizedRecord.sourceSpeakers) &&
          typeof synthesizedRecord.sourceSpeakers[0] === "string"
            ? { speakerId: synthesizedRecord.sourceSpeakers[0] }
            : defaults.sourceSpeaker,
        sourceExcerpt:
          Array.isArray(synthesizedRecord.sourceExcerpts) &&
          typeof synthesizedRecord.sourceExcerpts[0] === "string"
            ? synthesizedRecord.sourceExcerpts[0]
            : defaults.sourceExcerpt,
        sourceKeyframeUrls: Array.isArray(synthesizedRecord.sourceKeyframeUrls)
          ? synthesizedRecord.sourceKeyframeUrls
          : defaults.sourceKeyframeUrls,
        segmentIndex:
          dedupedFromSegments.length > 0 ? dedupedFromSegments[0] : defaults.segmentIndex,
      },
      defaults,
    );
    if (parsed) normalized.push(parsed);
  }

  for (const [groupKey, type] of Object.entries(FINDING_TYPE_BY_GROUP_KEY)) {
    const group = root[groupKey];
    if (!Array.isArray(group)) continue;
    for (const finding of group) {
      const parsed = normalizeFinding(finding, defaults, type);
      if (parsed) normalized.push(parsed);
    }
  }

  return normalized;
}

export function findingSignature(finding: {
  type: VideoFindingType;
  segmentIndex?: number;
  sourceTimestamp: number;
  sourceTimestampEnd?: number;
  sourceExcerpt: string;
  synthesisNote?: string;
}): string {
  return [
    finding.type,
    finding.segmentIndex ?? "",
    finding.sourceTimestamp,
    finding.sourceTimestampEnd ?? "",
    finding.sourceExcerpt.trim().toLowerCase(),
    finding.synthesisNote ?? "",
  ].join("\x1E");
}
