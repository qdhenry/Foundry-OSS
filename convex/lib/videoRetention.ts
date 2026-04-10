import type { VideoRetentionPolicy } from "../shared/videoContracts";

export type RetentionCandidate = {
  retentionExpiresAt?: number;
  retentionStatus?: "active" | "expired";
  retentionCleanupAt?: number;
};

export type RetentionDecisionReason =
  | "no_retention_expiry"
  | "not_yet_expired"
  | "already_marked"
  | "eligible";

export function evaluateRetentionCandidate(
  candidate: RetentionCandidate,
  now: number,
): { eligible: boolean; reason: RetentionDecisionReason } {
  if (typeof candidate.retentionExpiresAt !== "number") {
    return { eligible: false, reason: "no_retention_expiry" };
  }

  if (candidate.retentionExpiresAt > now) {
    return { eligible: false, reason: "not_yet_expired" };
  }

  if (candidate.retentionStatus === "expired" || typeof candidate.retentionCleanupAt === "number") {
    return { eligible: false, reason: "already_marked" };
  }

  return { eligible: true, reason: "eligible" };
}

export function resolveRetentionExpiresAt(policy: VideoRetentionPolicy): number | undefined {
  const dayCountByPolicy: Record<Exclude<VideoRetentionPolicy, "indefinite">, number> = {
    "30_days": 30,
    "60_days": 60,
    "90_days": 90,
    "180_days": 180,
  };

  if (policy === "indefinite") {
    return undefined;
  }

  return Date.now() + dayCountByPolicy[policy] * 24 * 60 * 60 * 1000;
}
