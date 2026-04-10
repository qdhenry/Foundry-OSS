import { describe, expect, it } from "vitest";
import { evaluateRetentionCandidate } from "../../convex/lib/videoRetention";

describe("video retention selection logic", () => {
  it("returns eligible only when expiry exists, is in the past, and is not already marked", () => {
    const now = Date.now();

    expect(
      evaluateRetentionCandidate(
        {
          retentionExpiresAt: now - 1,
          retentionStatus: "active",
        },
        now,
      ),
    ).toEqual({ eligible: true, reason: "eligible" });
  });

  it("skips non-expiring analyses", () => {
    const now = Date.now();
    expect(evaluateRetentionCandidate({}, now)).toEqual({
      eligible: false,
      reason: "no_retention_expiry",
    });
  });

  it("skips analyses whose retention window has not expired yet", () => {
    const now = Date.now();
    expect(
      evaluateRetentionCandidate(
        {
          retentionExpiresAt: now + 60_000,
        },
        now,
      ),
    ).toEqual({
      eligible: false,
      reason: "not_yet_expired",
    });
  });

  it("skips analyses already marked as expired", () => {
    const now = Date.now();
    expect(
      evaluateRetentionCandidate(
        {
          retentionExpiresAt: now - 1,
          retentionStatus: "expired",
        },
        now,
      ),
    ).toEqual({
      eligible: false,
      reason: "already_marked",
    });
  });

  it("skips analyses with an existing cleanup timestamp", () => {
    const now = Date.now();
    expect(
      evaluateRetentionCandidate(
        {
          retentionExpiresAt: now - 1,
          retentionCleanupAt: now - 1_000,
        },
        now,
      ),
    ).toEqual({
      eligible: false,
      reason: "already_marked",
    });
  });
});
