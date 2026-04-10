import { v } from "convex/values";

export const videoAnalysisStatusValidator = v.union(
  v.literal("uploading"),
  v.literal("indexing"),
  // Legacy statuses kept to allow existing records to validate during rollout.
  v.literal("extracting"),
  v.literal("transcribing"),
  v.literal("classifying_frames"),
  v.literal("awaiting_speakers"),
  v.literal("analyzing"),
  v.literal("synthesizing"),
  v.literal("complete"),
  v.literal("failed"),
);

export const videoRetentionPolicyValidator = v.union(
  v.literal("30_days"),
  v.literal("60_days"),
  v.literal("90_days"),
  v.literal("180_days"),
  v.literal("indefinite"),
);

export const findingReviewStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("imported"),
  v.literal("edited"),
);

export const findingConfidenceValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

export const videoFindingTypeValidator = v.union(
  v.literal("requirement"),
  v.literal("risk"),
  v.literal("integration"),
  v.literal("decision"),
  v.literal("action_item"),
);

export const videoSourceSpeakerValidator = v.object({
  speakerId: v.string(),
  name: v.optional(v.string()),
  role: v.optional(v.string()),
});

export const videoFindingAttributionValidator = v.object({
  sourceTimestamp: v.number(),
  sourceTimestampEnd: v.optional(v.number()),
  sourceExcerpt: v.string(),
  sourceSpeaker: v.optional(videoSourceSpeakerValidator),
  sourceKeyframeUrls: v.optional(v.array(v.string())),
});

export const optionalVideoFindingAttributionValidator = v.object({
  sourceTimestamp: v.optional(v.number()),
  sourceTimestampEnd: v.optional(v.number()),
  sourceExcerpt: v.optional(v.string()),
  sourceSpeaker: v.optional(videoSourceSpeakerValidator),
  sourceKeyframeUrls: v.optional(v.array(v.string())),
});

export type VideoAnalysisStatus =
  | "uploading"
  | "indexing"
  | "extracting"
  | "transcribing"
  | "classifying_frames"
  | "awaiting_speakers"
  | "analyzing"
  | "synthesizing"
  | "complete"
  | "failed";

export type VideoRetentionPolicy = "30_days" | "60_days" | "90_days" | "180_days" | "indefinite";

export type FindingReviewStatus = "pending" | "approved" | "rejected" | "imported" | "edited";

export type FindingConfidence = "high" | "medium" | "low";

export type VideoFindingType = "requirement" | "risk" | "integration" | "decision" | "action_item";

export type VideoSourceSpeaker = {
  speakerId: string;
  name?: string;
  role?: string;
};

export type VideoFindingAttribution = {
  sourceTimestamp: number;
  sourceTimestampEnd?: number;
  sourceExcerpt: string;
  sourceSpeaker?: VideoSourceSpeaker;
  sourceKeyframeUrls?: string[];
};
